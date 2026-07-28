#!/bin/bash

while ! nc -z database 5432 2>/dev/null; do
  echo "Waiting for database on database:5432..."
  sleep 2
done

echo "Database is ready!"

# Esegue le migrazioni del database
npx prisma migrate deploy

# Rigenera il Prisma Client
npx prisma generate

exec npm run start:dev