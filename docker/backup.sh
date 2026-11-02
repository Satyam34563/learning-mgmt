#!/usr/bin/env sh
# Nightly MongoDB + uploads backup for the production stack. Keeps the last $KEEP_DAYS days.
# Install on the server (runs at 02:30):
#   crontab -e
#   30 2 * * * /opt/online-lectures/docker/backup.sh >> /var/log/lectures-backup.log 2>&1
set -eu

cd "$(dirname "$0")"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"
DEST="../backups"
mkdir -p "$DEST"

# shellcheck disable=SC1091
. ./.env.prod

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.prod"

# Database: compressed archive written inside the mongo container's /backups mount
$COMPOSE exec -T mongo mongodump \
  --username "$MONGO_ROOT_USER" --password "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin \
  --db lectures --gzip --archive="/backups/lectures_$STAMP.archive.gz"

# Uploaded attachments
$COMPOSE exec -T api tar -czf - -C /data uploads > "$DEST/uploads_$STAMP.tar.gz"

find "$DEST" -name 'lectures_*.archive.gz' -mtime "+$KEEP_DAYS" -delete
find "$DEST" -name 'uploads_*.tar.gz' -mtime "+$KEEP_DAYS" -delete
echo "[$STAMP] backup ok"

# Restore:
#   docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T mongo mongorestore \
#     --username "$MONGO_ROOT_USER" --password "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin \
#     --gzip --archive=/backups/lectures_<STAMP>.archive.gz --drop
