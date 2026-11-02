#!/usr/bin/env bash
# One-time root setup for the portal on a native (no Docker) Ubuntu server. Safe to re-run.
#   sudo bash /var/www/online-learning/deploy/native/setup-root.sh
#
# 1. Installs MongoDB 8.0 (official repo), local-only, 256 MB cache, password protected.
#    The app's connection string is written to server/.env; the admin login to /root/.mongodb-admin.
# 2. Adds the nginx site for $DOMAIN (other sites are left alone) and gets an HTTPS certificate.
# 3. Makes pm2 (running as $APP_USER) start again after a reboot.
set -euo pipefail

APP="${APP:-/var/www/online-learning}"
DOMAIN="${DOMAIN:-dlcs.lectures.managemyschools.in}"
APP_USER="${APP_USER:-${SUDO_USER:-satyam}}"
DB=lectures

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo"; exit 1; }
[ -f "$APP/server/.env" ] || { echo "$APP/server/.env not found; set up the app first"; exit 1; }
log() { printf '\n\033[1;34m== %s\033[0m\n' "$*"; }

# ---------------------------------------------------------------- MongoDB
if ! command -v mongod >/dev/null; then
  log "Installing MongoDB 8.0"
  apt-get install -y gnupg curl
  curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | gpg --dearmor --yes -o /usr/share/keyrings/mongodb-server-8.0.gpg
  . /etc/os-release
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${VERSION_CODENAME}/mongodb-org/8.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-8.0.list
  apt-get update
  apt-get install -y mongodb-org
else
  log "MongoDB already installed: $(mongod --version | head -1)"
fi

write_mongod_conf() { # $1 = "auth" to require logins
  [ -f /etc/mongod.conf.orig ] || cp /etc/mongod.conf /etc/mongod.conf.orig
  cat > /etc/mongod.conf <<EOF
# Portal database. Original kept at /etc/mongod.conf.orig
storage:
  dbPath: /var/lib/mongodb
  wiredTiger:
    engineConfig:
      cacheSizeGB: 0.25   # 1 GB server shared with MySQL and PHP
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
net:
  port: 27017
  bindIp: 127.0.0.1       # never reachable from outside
processManagement:
  timeZoneInfo: /usr/share/zoneinfo
$([ "${1:-}" = auth ] && printf 'security:\n  authorization: enabled\n')
EOF
}

wait_mongo() { for _ in $(seq 1 30); do mongosh --quiet --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1 && return 0; sleep 1; done; echo "mongod did not start"; exit 1; }

if ! grep -q 'authorization: enabled' /etc/mongod.conf 2>/dev/null; then
  log "Configuring MongoDB and creating logins"
  write_mongod_conf
  systemctl enable --now mongod
  systemctl restart mongod
  wait_mongo
  ADMIN_PW="$(openssl rand -hex 24)"
  APP_PW="$(openssl rand -hex 24)"
  mongosh --quiet admin --eval "
    if (!db.getUser('admin')) db.createUser({ user: 'admin', pwd: '$ADMIN_PW', roles: ['root'] });
    else db.changeUserPassword('admin', '$ADMIN_PW');
    const app = db.getSiblingDB('$DB');
    if (!app.getUser('portal')) app.createUser({ user: 'portal', pwd: '$APP_PW', roles: [{ role: 'readWrite', db: '$DB' }] });
    else app.changeUserPassword('portal', '$APP_PW');"
  printf 'MONGO_ADMIN_USER=admin\nMONGO_ADMIN_PASSWORD=%s\n' "$ADMIN_PW" > /root/.mongodb-admin
  chmod 600 /root/.mongodb-admin
  URI="mongodb://portal:${APP_PW}@127.0.0.1:27017/${DB}?authSource=${DB}"
  if grep -q '^MONGO_URI=' "$APP/server/.env"; then
    sed -i "s#^MONGO_URI=.*#MONGO_URI=${URI}#" "$APP/server/.env"
  else
    echo "MONGO_URI=${URI}" >> "$APP/server/.env"
  fi
  chown "$APP_USER:$APP_USER" "$APP/server/.env"; chmod 600 "$APP/server/.env"
  write_mongod_conf auth
  systemctl restart mongod
  wait_mongo
  echo "MongoDB ready; app login written to $APP/server/.env, admin login in /root/.mongodb-admin"
else
  log "MongoDB already configured with logins"
  systemctl enable --now mongod
fi

# ---------------------------------------------------------------- nginx
log "nginx site for $DOMAIN"
SITE=/etc/nginx/sites-available/online-learning
if [ ! -f "$SITE" ]; then
  sed -e "s#__DOMAIN__#${DOMAIN}#g" -e "s#__APP__#${APP}#g" "$APP/deploy/native/nginx-site.conf" > "$SITE"
  ln -sf "$SITE" /etc/nginx/sites-enabled/online-learning
fi
# nginx (www-data) must be able to read the built site
chmod o+rx "$APP" "$APP/client" "$APP/client/dist" 2>/dev/null || true
nginx -t
systemctl reload nginx

# ---------------------------------------------------------------- HTTPS
SERVER_IPS="$(hostname -I) $(curl -fsS -4 https://ifconfig.me 2>/dev/null || true)"
DNS_IP="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}')"
if [ -n "$DNS_IP" ] && grep -qw "$DNS_IP" <<<"$SERVER_IPS"; then
  if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    log "HTTPS certificate already present"
  else
    log "Getting HTTPS certificate"
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect --register-unsafely-without-email --keep-until-expiring
  fi
else
  log "Skipping HTTPS: $DOMAIN does not point to this server yet (DNS says '${DNS_IP:-nothing}'). Add the DNS record and re-run this script."
fi

# ---------------------------------------------------------------- pm2 on boot
if ! systemctl list-unit-files | grep -q "^pm2-${APP_USER}.service"; then
  log "Starting pm2 for $APP_USER on boot"
  env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "$(getent passwd "$APP_USER" | cut -d: -f6)"
else
  log "pm2 already starts on boot for $APP_USER"
fi

log "Done. Next (as $APP_USER): cd $APP && pm2 start deploy/native/ecosystem.config.cjs && pm2 save"
