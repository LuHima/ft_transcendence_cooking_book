#!/bin/sh

# Exit immediately if any command returns a non-zero exit code (an error)
set -e

SSL_DIR="${SSL_DIR:-/etc/nginx/ssl}"
DOMAIN="${DOMAIN_NAME:-localhost}"

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

# Production environment
if [ "$IS_PRODUCTION" -eq 1 ]; then
	echo "=== Production Mode Active ==="
	echo "Target domain: ${DOMAIN}"

	# Check: acme.sh availability
	if [ -z "$ACME_BIN" ]; then
		echo "ERROR: acme.sh was not found in PATH or /usr/share/acme.sh/."
		exit 1
	fi

	# Check: DOMAIN_NAME cannot be localhost or loopback in production
	if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "localhost" ] || \
	[ "$DOMAIN" = "127.0.0.1" ]; then
		echo -n "ERROR: PRODUCTION_FLAG is enabled, but DOMAIN_NAME "
		echo "('${DOMAIN}') is invalid."
		echo -n "Let's Encrypt requires a valid public domain name "
		echo "(e.g. yourdomain.com or sub.yourdomain.com)."
		exit 1
	fi

	# Check: Infomaniak API token must be provided
	if [ -z "$INFOMANIAK_API_TOKEN" ]; then
		echo -n "ERROR: PRODUCTION_FLAG is enabled, but "
		echo "INFOMANIAK_API_TOKEN is empty or unset."
		echo "Please provide a valid Infomaniak API token in your .env file."
		exit 1
	fi

	# Check if valid non-self-signed certificate already exists for this domain
	NEED_ISSUE=0
	if [ ! -f "$SSL_DIR/transcendence.crt" ] || \
	[ ! -f "$SSL_DIR/transcendence.key" ]; then
		echo "No existing certificate files found in ${SSL_DIR}."
		NEED_ISSUE=1
	else
		# Check if existing certificate is self-signed
		# (Issuer Hash equals Subject Hash)
		ISSUER_HASH=$(openssl x509 -in "$SSL_DIR/transcendence.crt" \
			-noout -issuer_hash 2>/dev/null || echo "1")
		SUBJECT_HASH=$(openssl x509 -in "$SSL_DIR/transcendence.crt" \
			-noout -subject_hash 2>/dev/null || echo "2")
		if [ -n "$ISSUER_HASH" ] && [ "$ISSUER_HASH" = "$SUBJECT_HASH" ]; then
			echo -n "Existing certificate in ${SSL_DIR} is self-signed. "
			echo "Replacing with Let's Encrypt certificate..."
			NEED_ISSUE=1
		elif ! openssl x509 -checkend 86400 -noout -in \
		"$SSL_DIR/transcendence.crt" >/dev/null 2>&1; then
			echo -n "Existing certificate is expired or expiring within "
			echo "24 hours. Re-issuing..."
			NEED_ISSUE=1
		elif ! openssl x509 -in "$SSL_DIR/transcendence.crt" \
		-noout -text 2>/dev/null | \
		grep -E "DNS:${DOMAIN}(,|\$)|CN[[:space:]]*=[[:space:]]*${DOMAIN}" \
		>/dev/null 2>&1; then
			echo -n "Existing certificate does not match DOMAIN_NAME "
			echo "(${DOMAIN}). Re-issuing..."
			NEED_ISSUE=1
		else
			echo -n "Valid Let's Encrypt certificate for ${DOMAIN} already "
			echo "exists in ${SSL_DIR}, skipping issuance."
		fi
	fi

	if [ "$NEED_ISSUE" -eq 1 ]; then
		echo -n "Issuing Let's Encrypt certificate via Infomaniak DNS-01 "
		echo "challenge for domain: ${DOMAIN}..."

		# Check if Let's Encrypt staging environment is requested
		STAGING_SERVER="letsencrypt"
		case "$(echo "${ACME_STAGING:-false}" | tr '[:upper:]' '[:lower:]')" in
			true|1|yes|on)
				STAGING_SERVER="letsencrypt_test"
				echo -n "[STAGING] ACME_STAGING is enabled: using "
				echo "Let's Encrypt Staging environment."
				;;
		esac

		# Export the Infomaniak API token so the acme.sh dns_infomaniak hook
		# can access it
		export INFOMANIAK_API_TOKEN

		# Set default CA to Let's Encrypt
		"$ACME_BIN" --set-default-ca --server ${STAGING_SERVER} \
			>/dev/null 2>&1 || true

		# Register ACME account if needed
		if [ -n "$ACME_EMAIL" ]; then
			echo "Registering ACME account with email: ${ACME_EMAIL}..."
			"$ACME_BIN" --register-account -m "$ACME_EMAIL" \
				--server ${STAGING_SERVER} || true
		else
			echo "Registering ACME account without email..."
			"$ACME_BIN" --register-account --register-unsafely-without-email \
				--server ${STAGING_SERVER} || true
		fi

		# Issue certificate with DNS-01 Infomaniak hook
		"$ACME_BIN" --issue \
			--dns dns_infomaniak \
			-d "$DOMAIN" \
			--server ${STAGING_SERVER}

		# Install certificates into Nginx SSL directory
		"$ACME_BIN" --install-cert \
			-d "$DOMAIN" \
			--key-file "$SSL_DIR/transcendence.key" \
			--fullchain-file "$SSL_DIR/transcendence.crt"

		chmod 600 "$SSL_DIR/transcendence.key"
		chmod 644 "$SSL_DIR/transcendence.crt"
		echo "Let's Encrypt certificate issued and installed successfully."
	else
		echo -n "SSL certificate already exists in ${SSL_DIR}, "
		echo "skipping generation."
	fi

else
	echo "=== Development Mode Active ==="
	echo "Target domain: ${DOMAIN}"

	# Check if an existing certificate is present, valid, and matches DOMAIN
	NEED_SELF_SIGNED=0
	if [ ! -f "$SSL_DIR/transcendence.crt" ] || \
	[ ! -f "$SSL_DIR/transcendence.key" ]; then
		NEED_SELF_SIGNED=1
	elif ! openssl x509 -checkend 86400 -noout -in \
	"$SSL_DIR/transcendence.crt" >/dev/null 2>&1; then
		echo -n "Existing self-signed certificate is expired or expiring within "
		echo "24 hours."
		NEED_SELF_SIGNED=1
	elif ! openssl x509 -in "$SSL_DIR/transcendence.crt" \
	-noout -text 2>/dev/null | \
	grep -E "DNS:${DOMAIN}(,|\$)|CN[[:space:]]*=[[:space:]]*${DOMAIN}" \
	>/dev/null 2>&1; then
		echo "Existing certificate does not match DOMAIN_NAME (${DOMAIN})."
		NEED_SELF_SIGNED=1
	fi

	if [ "$NEED_SELF_SIGNED" -eq 1 ]; then
		echo "Generating self-signed SSL certificate for domain: ${DOMAIN}..."

		# Generate the self-signed certificate with OpenSSL:
		# req:				command for creating certificate requests.
		# -x509:			generate a self-signed X.509 certificate instead of a 
		#					request.
		# -nodes:			don't encrypt the private key (otherwise nginx asks for
		#					password at startup and blocks).
		# -newkey rsa:2048:	generate both a new certificate and a new 2048-bit RSA
		#					private key.
		# -days 365:		set certificate validity period to 365 days (1 year).
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
		# O=42 Firenze		→	Organization name.
		# OU=transcendence	→	Organizational Unit (team/project).
		# CN=$DOMAIN		→	Common Name (main host/domain name, e.g. localhost).
		# UID=transcendence	→	User Identifier (optional extra identity attribute).
		openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
		-keyout "$SSL_DIR/transcendence.key" \
		-out "$SSL_DIR/transcendence.crt" \
		-subj "/C=IT/ST=Tuscany/L=Florence/O=WeCook/OU=transcendence/CN=${DOMAIN}/UID=transcendence" \
		-addext "subjectAltName=DNS:${DOMAIN},IP:127.0.0.1"
		
		chmod 600 "$SSL_DIR/transcendence.key"
		chmod 644 "$SSL_DIR/transcendence.crt"
    	echo "SSL certificate generated successfully."
	else
		echo "SSL certificate already exists in ${SSL_DIR}, skipping generation."
	fi
fi

# Generate a self-signed TLS certificate at runtime if not already generated.
# Moving this from the Dockerfile ensures private keys are not baked into image
# layers and allows dynamic domain names via DOMAIN_NAME environment variable.

echo ""
echo "=== Starting Nginx Web Server ==="
if [ "$IS_PRODUCTION" -eq 1 ]; then
	echo "Environment: PRODUCTION (Let's Encrypt DNS-01)"
else
	echo "Environment: DEVELOPMENT (Self-Signed Certificate)"
fi
echo "Application URL -> https://${DOMAIN}:8443"
echo ""

# Execute the command passed as argument to the Dockerfile (CMD). Using 'exec'
# is ESSENTIAL because exec replaces the shell process with the NGINX process.
# This way NGINX becomes PID 1 and correctly receives stop signals.
exec "$@"