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


exec nginx -g "daemon off; error_log /dev/stdout warn;"