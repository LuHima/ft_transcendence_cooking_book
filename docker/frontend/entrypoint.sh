#!/bin/sh

# Exit immediately if any command returns a non-zero exit code (an error)
set -e

echo ""
echo "=== Starting Frontend Service ==="
echo "Frontend dev server is launching on port 5173..."
echo ""

# The source tree is bind-mounted while node_modules lives in a separate
# Docker volume, so refresh dependencies when the package manifest changes.
npm install

# Execute the command passed as argument to the Dockerfile (CMD). Using 'exec'
# is ESSENTIAL because exec replaces the shell process with the application process.
# This way the Node process becomes PID 1 and correctly receives stop signals.
exec "$@"