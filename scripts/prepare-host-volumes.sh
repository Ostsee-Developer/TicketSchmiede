#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/opt/backup/ticket-schmiede}"

mkdir -p "$BACKUP_DIR"
chown -R 1000:1000 "$BACKUP_DIR"
chmod -R 750 "$BACKUP_DIR"

echo "Prepared $BACKUP_DIR for the app container user 1000:1000"
