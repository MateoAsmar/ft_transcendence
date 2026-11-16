#!/bin/sh

set -e
DB_FILE=/data/ft_transcendence.db
SCHEMA_FILE=/database/schema.sql

# Ensure the /data directory exists (bind-mounted from host database/dbdata)
mkdir -p "$(dirname "$DB_FILE")"

if [ ! -f "$DB_FILE" ]; then
  echo "Initializing SQLite database at $DB_FILE"
  sqlite3 "$DB_FILE" < "$SCHEMA_FILE"
  chmod 666 "$DB_FILE"
  echo "Database initialized successfully at $DB_FILE"
  echo "This file is accessible on the host at database/dbdata/ft_transcendence.db"
else
  echo "Database exists at $DB_FILE - ensuring schema is up to date"
  sqlite3 "$DB_FILE" < "$SCHEMA_FILE"
  echo "Database schema updated at $DB_FILE"
fi

# Keep container running so other services can depend_on it
exec tail -f /dev/null
