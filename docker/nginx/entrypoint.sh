#!/bin/sh


while ! nc -z frontend 5173 2>/dev/null; do
  echo "Waiting for frontend on frontend:5173..."
  sleep 2
done

echo "Frontend is ready!"

exec nginx -g "daemon off; error_log /dev/stdout warn;"