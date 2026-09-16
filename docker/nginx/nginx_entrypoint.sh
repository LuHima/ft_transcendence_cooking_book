#!/bin/sh

# Exit immediately if any command returns a non-zero exit code (an error)
set -e

SSL_DIR="/etc/nginx/ssl"
DOMAIN="${DOMAIN_NAME:-localhost}"

mkdir -p "$SSL_DIR"

# Generate a self-signed TLS certificate at runtime if not already generated.
# Moving this from the Dockerfile ensures private keys are not baked into image
# layers and allows dynamic domain names via DOMAIN_NAME environment variable.
if [ ! -f "$SSL_DIR/transcendence.crt" ] || \
	[ ! -f "$SSL_DIR/transcendence.key" ]; then

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

echo ""
echo "=== Starting Nginx Web Server ==="
echo "Application URL -> https://${DOMAIN}:8443"
echo ""

# Execute the command passed as argument to the Dockerfile (CMD). Using 'exec'
# is ESSENTIAL because exec replaces the shell process with the NGINX process.
# This way NGINX becomes PID 1 and correctly receives stop signals.
exec "$@"