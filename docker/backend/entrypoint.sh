#!/bin/sh

# Exit immediately if any command returns a non-zero exit code (an error)
set -e

echo ""
echo "=== Starting Backend Service ==="

# Generate Prisma client based on current schema
echo "Generating Prisma Client..."
npx prisma generate

# Apply any pending database migrations
echo "Applying database migrations..."
npx prisma migrate deploy

# Run database seed (idempotent initial data)
echo "Seeding database..."
npx prisma db seed

echo "Backend initialization complete! Starting application..."
echo ""

# Execute the command passed as argument to the Dockerfile (CMD). Using 'exec'
# is ESSENTIAL because exec replaces the shell process with the application process.
# This way the Node process becomes PID 1 and correctly receives stop signals.
exec "$@"