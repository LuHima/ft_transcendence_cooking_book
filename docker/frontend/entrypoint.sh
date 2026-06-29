#!/bin/bash

while ! nc -z backend 3000 2>/dev/null; do
  echo "Waiting for backend on backend:3000..."
  sleep 2
done

echo "Backend is ready!"

exec npm run dev -- --host 0.0.0.0 --port 5173