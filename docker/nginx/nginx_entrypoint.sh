#!/bin/sh

# ANSI escape codes for colorful messages
RED="\e[31m"
GREEN="\e[32m"
RESETCOLOR="\e[0m"

# Run a command and fail fast with an explicit log message on error.
# This guarantees the container exits if WordPress bootstrap is not successful.
# The first parameter passed to this function is a description of the step.
# The following parameters are to command that is executed in the step ("$@").
# Directive 'shift 1' shifts argv by 1: former $2 becomes new $1, so only the
# command is executed with "$@" without the description of the step.
run_step() {
	step_name="$1"
	shift 1		
	if ! "$@"; then
		echo -e "${RED}$step_name failed." \
				"Exiting container.${RESETCOLOR}" >&2
		exit 1
	fi
}

# Non-sensitive environment variable fallback used when missing from .env.
DOMAIN_NAME="${DOMAIN_NAME:-localhost}"
NGINX_PORT="${NGINX_PORT:-443}"

# SSL certificate should be created in the entrypoint instead of the Dockerfile.
# The reasons for this are:
# -	Security: when generated during docker build, private keys are permanently
#   baked into the image filesystem layers. If the image is pushed to a registry
#   or shared, the private key leaks with it.
# -	Dynamic configuration (DOMAIN_NAME): gnerating the certificate in the entry-
#   point lets us dynamically read $DOMAIN_NAME at container startup.
# - Image Portability: the image becomes environment-agnostic; we can build it
#   once and run it anywhere with different domain names.
# - Persistence: in the entrypoint script, we can test if the SSL certificate
#   already exists and only generates it when needed; then, if we mount a volume
#   to /etc/nginx/ssl, the cert. persists even when the container is recreated.

# Check if the certificate already exists, otherwise create it
if [ ! -f /etc/nginx/ssl/transcendence.crt ]; then

    echo "SSL configuration in progress..."

    # 1) Create the folder for certificates
	echo "Creating directory to store SSL certificate..."
	run_step "SSL Directory creation" \
    	mkdir -p /etc/nginx/ssl

    # 2) Generate the self-signed certificate with OpenSSL
	# req:		command for creating certificate requests.
	# -x509:	generate a self-signed X.509 certificate instead of a request.
	# -nodes:	don't encrypt the private key (otherwise nginx asks for
	#			password at startup and blocks).
	# -out:		where to save the certificate (public key).
	# -keyout:	where to save the private key.
	# -subj:	fill certificate fields automatically (non-interactive).
	# -addext:	add X.509 extensions directly from CLI (non-interactive).
	#			here it sets Subject Alternative Name (SAN), which modern
	#			TLS clients use to validate hostnames/IPs in the certificate.
	# The meaning of all the fields under -subj are:
	# C=FR				→	Country (2-letter ISO code), here France.
	# ST=IDF			→	State/Province, here Île-de-France.
	# L=Paris			→	Locality/City.
	# O=42				→	Organization name.
	# OU=42				→	Organizational Unit (department/team).
	# CN=$DOMAIN_NAME	→	Common Name (historically main host/domain).
	# UID=transcendence	→	User Identifier (extra identity attribute).
	echo "Creating SSL certificate with OpenSSL..."
	run_step "SSL Certificate creation" \
    	openssl req \
		-x509 \
		-nodes \
		-out /etc/nginx/ssl/transcendence.crt \
		-keyout /etc/nginx/ssl/transcendence.key \
		-subj "/C=FR/ST=IDF/L=Paris/O=42/OU=42/CN=$DOMAIN_NAME/UID=transcendence" \
		-addext "subjectAltName=DNS:$DOMAIN_NAME,IP:127.0.0.1"
    
    echo -e "${GREEN}SSL configured!${RESETCOLOR}"
fi

echo "Starting NGINX..."
echo "Application URL -> https://$DOMAIN_NAME:$NGINX_PORT"


# Execute the command passed as argument to the Dockerfile (CMD). Using 'exec'
# is ESSENTIAL because exec replaces the shell process with the NGINX process.
# This way NGINX becomes PID 1 and correctly receives stop signals.
exec "$@"