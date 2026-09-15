#!/bin/sh


while ! nc -z frontend 5173 2>/dev/null; do
  echo "Waiting for frontend on frontend:5173..."
  sleep 2
done

echo " "

echo "Frontend is ready!"

echo " "
echo " "

echo "Link site -> https://localhost:8443"


# Execute the command passed as argument to the Dockerfile (CMD). Using 'exec'
# is ESSENTIAL because exec replaces the shell process with the NGINX process.
# This way NGINX becomes PID 1 and correctly receives stop signals.
exec "$@"