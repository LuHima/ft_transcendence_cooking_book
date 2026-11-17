#!/bin/sh

# Exit immediately if any command returns a non-zero exit code (an error)
set -e

SSL_DIR="${SSL_DIR:-/etc/nginx/ssl}"
DOMAIN="${DOMAIN_NAME:-localhost}"

# Fetch INFOMANIAK_API_TOKEN from Vault, if Vault credentials are provided.
# Falls back to whatever INFOMANIAK_API_TOKEN is already in the environment
# (useful for local dev without Vault, or if Vault is unreachable).
VAULT_ADDR="${VAULT_ADDR:-http://vault:8200}"

# Perform a Vault HTTP request and capture HTTP status + body without aborting
# under `set -e` (acme falls back to env / self-signed certs on failure).
vault_request() {
	_method="$1"
	_url="$2"
	_header="$3"
	_body="$4"

	set +e
	if [ -n "$_body" ]; then
		_raw=$(curl -sS -w '\n%{http_code}' -X "$_method" -d "$_body" "$_url")
	elif [ -n "$_header" ]; then
		_raw=$(curl -sS -w '\n%{http_code}' -X "$_method" -H "$_header" "$_url")
	else
		_raw=$(curl -sS -w '\n%{http_code}' -X "$_method" "$_url")
	fi
	_rc=$?
	set -e

	if [ "$_rc" -ne 0 ]; then
		VAULT_HTTP_CODE=0
		VAULT_RESP_BODY="curl exit ${_rc}"
		return 1
	fi

	VAULT_HTTP_CODE=$(printf '%s\n' "$_raw" | tail -n 1)
	VAULT_RESP_BODY=$(printf '%s\n' "$_raw" | sed '$d')
	return 0
}

if [ "${USE_VAULT:-true}" != "true" ]; then
	echo "INFO: Vault disabled (USE_VAULT=${USE_VAULT}); skipping Vault fetch."
elif [ -z "$VAULT_ROLE_ID" ] || [ -z "$VAULT_SECRET_ID" ]; then
	echo "WARNING: ACME_VAULT_ROLE_ID or ACME_VAULT_SECRET_ID is not set (mapped to VAULT_ROLE_ID / VAULT_SECRET_ID); check docker/.env. Using existing environment INFOMANIAK_API_TOKEN (if any)." >&2
else
	echo "=== Authenticating to Vault (acme-role) ==="

	if ! vault_request POST "${VAULT_ADDR}/v1/auth/approle/login" "" \
		"{\"role_id\":\"${VAULT_ROLE_ID}\",\"secret_id\":\"${VAULT_SECRET_ID}\"}"; then
		echo "WARNING: Could not reach Vault at ${VAULT_ADDR} (${VAULT_RESP_BODY}); using existing environment INFOMANIAK_API_TOKEN (if any)." >&2
	elif [ "$VAULT_HTTP_CODE" -ne 200 ]; then
		if [ "$VAULT_HTTP_CODE" -eq 400 ] || [ "$VAULT_HTTP_CODE" -eq 403 ]; then
			echo "WARNING: Vault AppRole login rejected for acme-role (HTTP ${VAULT_HTTP_CODE}): ${VAULT_RESP_BODY}. Check ACME_VAULT_ROLE_ID and ACME_VAULT_SECRET_ID in docker/.env (they must match the active Vault instance; run 'make vault-init' to resync). Using existing environment INFOMANIAK_API_TOKEN (if any)." >&2
		else
			echo "WARNING: Vault AppRole login failed for acme-role (HTTP ${VAULT_HTTP_CODE}): ${VAULT_RESP_BODY}. Using existing environment INFOMANIAK_API_TOKEN (if any)." >&2
		fi
	else
		VAULT_TOKEN=$(echo "$VAULT_RESP_BODY" | grep -o '"client_token":"[^"]*"' | cut -d'"' -f4)

		if [ -z "$VAULT_TOKEN" ]; then
			echo "WARNING: Vault AppRole login succeeded for acme-role, but client_token was missing; using existing environment INFOMANIAK_API_TOKEN (if any)." >&2
		elif ! vault_request GET "${VAULT_ADDR}/v1/secret/data/acme" "X-Vault-Token: ${VAULT_TOKEN}" ""; then
			echo "WARNING: Could not reach Vault at ${VAULT_ADDR} while reading secret/data/acme (${VAULT_RESP_BODY}); using existing environment INFOMANIAK_API_TOKEN (if any)." >&2
		elif [ "$VAULT_HTTP_CODE" -ne 200 ]; then
			echo "WARNING: Failed to read secret/data/acme from Vault (HTTP ${VAULT_HTTP_CODE}): ${VAULT_RESP_BODY}. Using existing environment INFOMANIAK_API_TOKEN (if any)." >&2
		else
			FETCHED_TOKEN=$(echo "$VAULT_RESP_BODY" | grep -o '"INFOMANIAK_API_TOKEN":"[^"]*"' | cut -d'"' -f4)

			if [ -n "$FETCHED_TOKEN" ]; then
				INFOMANIAK_API_TOKEN="$FETCHED_TOKEN"
				echo "=== INFOMANIAK_API_TOKEN retrieved from Vault ==="
			else
				echo "WARNING: Vault reachable but no INFOMANIAK_API_TOKEN found; using existing environment value (if any)."
			fi
		fi
	fi
fi

mkdir -p "$SSL_DIR"

# Determine environment mode: 'true', '1', 'yes', 'on' enable production mode
# (Let's Encrypt certificate using DNS-01 challenge via Infomaniak API).
# Anything else defaults to development mode (local self-signed certificates).
IS_PRODUCTION=0
case "$(echo "${PRODUCTION_FLAG:-false}" | tr '[:upper:]' '[:lower:]')" in
	true|1|yes|on)
		IS_PRODUCTION=1
		;;
	*)
		IS_PRODUCTION=0
		;;
esac

# Locate acme.sh executable
if command -v acme.sh >/dev/null 2>&1; then
	ACME_BIN="acme.sh"
elif [ -x "/usr/share/acme.sh/acme.sh" ]; then
	ACME_BIN="/usr/share/acme.sh/acme.sh"
else
	ACME_BIN=""
fi

# Function to generate self-signed certificate with multi-domain SAN
generate_self_signed() {
	echo "Generating self-signed SSL certificate for domain: ${DOMAIN}..."

	# Generate the self-signed certificate with OpenSSL:
	# req:				command for creating certificate requests.
	# -x509:			generate a self-signed X.509 certificate.
	# -nodes:			don't encrypt the private key (otherwise nginx asks for
	#					password at startup and blocks).
	# -newkey rsa:2048:	generate both a new certificate and a new 2048-bit RSA
	#					private key.
	# -days 365:		set certificate validity period to 365 days (1 yr).
	# -keyout:			path where the private key will be saved.
	# -out:				path where the certificate (public key) will be saved.
	# -subj:			fill certificate subject fields automatically (non-
	#					interactive).
	# -addext:			add X.509 extensions directly from CLI (non-
	#					interactive). Here it sets Subject Alternative Name
	#					(SAN), which modern TLS clients use to validate
	#					hostnames/IPs in the certificate.
	# The meaning of all the fields under -subj are:
	# C=IT				→	Country (2-letter ISO code: Italy).
	# ST=Tuscany		→	State/Province/Region (Tuscany / Toscana).
	# L=Florence		→	Locality/City (Florence / Firenze).
	# O=WeCook			→	Organization name.
	# OU=dev			→	Organizational Unit (team/project).
	# CN=$DOMAIN		→	Common Name (main host/domain name, e.g. localhost).
	# UID=WeCook		→	User Identifier (optional extra identity attribute).
	openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
		-keyout "$SSL_DIR/transcendence.key" \
		-out "$SSL_DIR/transcendence.crt" \
		-subj "/C=IT/ST=Tuscany/L=Florence/O=WeCook/OU=dev/CN=${DOMAIN}/UID=WeCook" \
		-addext "subjectAltName=DNS:${DOMAIN},DNS:localhost,IP:127.0.0.1"

	chmod 644 "$SSL_DIR/transcendence.key"
	chmod 644 "$SSL_DIR/transcendence.crt"
	echo "Self-signed SSL certificate generated successfully."
}

LETS_ENCRYPT_ISSUED=0

# Production environment
if [ "$IS_PRODUCTION" -eq 1 ]; then
	echo "=== Production Mode Active ==="
	echo "Target domain: ${DOMAIN}"

	CAN_USE_ACME=1

	# Check: acme.sh availability
	if [ -z "$ACME_BIN" ]; then
		echo "WARNING: acme.sh was not found in PATH or /usr/share/acme.sh/."
		CAN_USE_ACME=0
	fi

	# Check: DOMAIN_NAME cannot be localhost or loopback in production
	if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "localhost" ] || [ "$DOMAIN" = "127.0.0.1" ]; then
		echo "WARNING: PRODUCTION_FLAG is enabled, but DOMAIN_NAME ('${DOMAIN}') is not a public domain name."
		CAN_USE_ACME=0
	fi

	# Check: Infomaniak API token must be provided
	if [ -z "$INFOMANIAK_API_TOKEN" ]; then
		echo "WARNING: PRODUCTION_FLAG is enabled, but INFOMANIAK_API_TOKEN is empty or unset."
		CAN_USE_ACME=0
	fi

	if [ "$CAN_USE_ACME" -eq 0 ]; then
		echo "WARNING: Cannot issue Let's Encrypt certificate; falling back to self-signed TLS certificate."
		if [ ! -f "$SSL_DIR/transcendence.crt" ] || [ ! -f "$SSL_DIR/transcendence.key" ]; then
			generate_self_signed
		else
			echo "Existing SSL certificate found in ${SSL_DIR}, using existing certificate."
		fi
	else
		# Check if valid non-self-signed certificate already exists for this domain
		NEED_ISSUE=0
		if [ ! -f "$SSL_DIR/transcendence.crt" ] || [ ! -f "$SSL_DIR/transcendence.key" ]; then
			echo "No existing certificate files found in ${SSL_DIR}."
			NEED_ISSUE=1
		else
			# Check if existing certificate is self-signed (Issuer Hash equals Subject Hash)
			ISSUER_HASH=$(openssl x509 -in "$SSL_DIR/transcendence.crt" -noout -issuer_hash 2>/dev/null || echo "1")
			SUBJECT_HASH=$(openssl x509 -in "$SSL_DIR/transcendence.crt" -noout -subject_hash 2>/dev/null || echo "2")
			if [ -n "$ISSUER_HASH" ] && [ "$ISSUER_HASH" = "$SUBJECT_HASH" ]; then
				echo "Existing certificate in ${SSL_DIR} is self-signed. Replacing with Let's Encrypt certificate..."
				NEED_ISSUE=1
			elif ! openssl x509 -checkend 86400 -noout -in "$SSL_DIR/transcendence.crt" >/dev/null 2>&1; then
				echo "Existing certificate is expired or expiring within 24 hours. Re-issuing..."
				NEED_ISSUE=1
			elif ! openssl x509 -in "$SSL_DIR/transcendence.crt" -noout -text 2>/dev/null | grep -E "DNS:${DOMAIN}(,|\$)|CN[[:space:]]*=[[:space:]]*${DOMAIN}" >/dev/null 2>&1; then
				echo "Existing certificate does not match DOMAIN_NAME (${DOMAIN}). Re-issuing..."
				NEED_ISSUE=1
			else
				echo "Valid Let's Encrypt certificate for ${DOMAIN} already exists in ${SSL_DIR}, skipping issuance."
				LETS_ENCRYPT_ISSUED=1
			fi
		fi

		if [ "$NEED_ISSUE" -eq 1 ]; then
			echo "Issuing Let's Encrypt certificate via Infomaniak DNS-01 challenge for domain: ${DOMAIN}..."

			# Check if Let's Encrypt staging environment is requested
			ACME_SERVER="letsencrypt"
			case "$(echo "${ACME_STAGING:-false}" | tr '[:upper:]' '[:lower:]')" in
				true|1|yes|on)
					ACME_SERVER="letsencrypt_test"
					echo "[STAGING] ACME_STAGING is enabled: using Let's Encrypt Staging environment."
					;;
			esac

			export INFOMANIAK_API_TOKEN

			"$ACME_BIN" --set-default-ca --server ${ACME_SERVER} >/dev/null 2>&1 || true

			if [ -n "$ACME_EMAIL" ]; then
				echo "Registering ACME account with email: ${ACME_EMAIL}..."
				"$ACME_BIN" --register-account -m "$ACME_EMAIL" --server ${ACME_SERVER} >/dev/null 2>&1 || true
			else
				echo "Registering ACME account without email..."
				"$ACME_BIN" --register-account --register-unsafely-without-email --server ${ACME_SERVER} >/dev/null 2>&1 || true
			fi

			# Attempt challenge issuance; catch error non-fatally
			if "$ACME_BIN" --issue --dns dns_infomaniak -d "$DOMAIN" --server ${ACME_SERVER} && \
			   "$ACME_BIN" --install-cert -d "$DOMAIN" \
			       --key-file "$SSL_DIR/transcendence.key" \
			       --fullchain-file "$SSL_DIR/transcendence.crt" \
			       --reloadcmd "nginx -s reload || true"; then
				chmod 644 "$SSL_DIR/transcendence.key"
				chmod 644 "$SSL_DIR/transcendence.crt"
				echo "Let's Encrypt certificate issued and installed successfully."
				LETS_ENCRYPT_ISSUED=1
			else
				echo "WARNING: ACME DNS-01 challenge failed; falling back to self-signed TLS certificate."
				generate_self_signed
			fi
		fi
	fi

	# Configure automated daily renewal cron job for acme.sh in production if LE succeeded
	if [ "$LETS_ENCRYPT_ISSUED" -eq 1 ]; then
		"$ACME_BIN" --install-cronjob >/dev/null 2>&1 || true
		if ! crontab -l 2>/dev/null | grep -q "acme.sh.*--cron"; then
			mkdir -p /var/spool/cron/crontabs
			echo "0 0 * * * \"$ACME_BIN\" --cron --home \"/root/.acme.sh\" >/dev/null 2>&1" >> /var/spool/cron/crontabs/root
			chmod 600 /var/spool/cron/crontabs/root 2>/dev/null || true
		fi
		if command -v crond >/dev/null 2>&1; then
			echo "Starting background cron daemon (crond) for certificate auto-renewal..."
			crond -b -L /var/log/cron.log
		fi
	fi

else
	echo "=== Development Mode Active ==="
	echo "Target domain: ${DOMAIN}"

	NEED_SELF_SIGNED=0
	if [ ! -f "$SSL_DIR/transcendence.crt" ] || [ ! -f "$SSL_DIR/transcendence.key" ]; then
		NEED_SELF_SIGNED=1
	elif ! openssl x509 -checkend 86400 -noout -in "$SSL_DIR/transcendence.crt" >/dev/null 2>&1; then
		echo "Existing self-signed certificate is expired or expiring within 24 hours."
		NEED_SELF_SIGNED=1
	elif ! openssl x509 -in "$SSL_DIR/transcendence.crt" -noout -text 2>/dev/null | grep -E "DNS:${DOMAIN}(,|\$)|CN[[:space:]]*=[[:space:]]*${DOMAIN}" >/dev/null 2>&1; then
		echo "Existing certificate does not match DOMAIN_NAME (${DOMAIN})."
		NEED_SELF_SIGNED=1
	fi

	if [ "$NEED_SELF_SIGNED" -eq 1 ]; then
		generate_self_signed
	else
		echo "SSL certificate already exists in ${SSL_DIR}, skipping generation."
	fi
fi

echo ""
echo "=== Certificate ready ==="
if [ "$LETS_ENCRYPT_ISSUED" -eq 1 ]; then
	echo "Environment: PRODUCTION (Let's Encrypt DNS-01)"
else
	echo "Environment: Self-Signed Certificate Fallback/Dev"
fi
echo ""

# Keep the container alive so nginx can access certificates on shared volume
tail -f /dev/null
