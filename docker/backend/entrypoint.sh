#!/bin/bash

while ! nc -z database 5432 2>/dev/null; do
  echo "Waiting for database on database:5432..."
  sleep 2
done

echo "Database is ready!"

#npm install -D typescript tsx @types/node @prisma/adapter-pg pg @types/pg dotenv

# Rigenera il Prisma Client prima di usare il client
npx prisma generate

# Esegue le migrazioni del database
npx prisma migrate deploy

# Esegue lo seed (idempotente)
npx prisma db seed

exec npm run start:dev