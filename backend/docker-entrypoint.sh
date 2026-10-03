#!/bin/sh
set -e

# Apply DB migrations. flock serialises this when several replicas start at once
# against the same shared volume.
DB_DIR="$(dirname "${DATABASE_URL#file:}")"
mkdir -p "$DB_DIR"
flock "$DB_DIR/.migrate.lock" npx prisma migrate deploy

exec "$@"
