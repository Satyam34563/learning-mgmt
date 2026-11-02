# Native deploy (no Docker)

For a small server that already runs other sites (here the school's SMS on a 1 GB droplet), where Docker's overhead isn't worth it. MongoDB runs as a system service, the API runs under pm2, and nginx serves the built site.

| What | Where |
| --- | --- |
| Code | `/var/www/online-learning` (owned by the deploy user, e.g. `satyam`) |
| Settings | `server/.env` (mode 600) |
| Site | `client/dist`, served by nginx for `dlcs.lectures.managemyschools.in` |
| API | pm2 process `online-learning-api` on `127.0.0.1:4000`, logs in `logs/` |
| Database | MongoDB 8 on `127.0.0.1:27017`, database `lectures`, 256 MB cache; admin login in `/root/.mongodb-admin` |
| Uploads | `server/uploads` |

## First install

```bash
# 1. as root: a folder the deploy user owns
sudo mkdir -p /var/www/online-learning && sudo chown $USER:$USER /var/www/online-learning

# 2. as the deploy user
git clone https://github.com/Satyam34563/learning-mgmt.git /var/www/online-learning
cd /var/www/online-learning
npm ci && npm run build
cp server/.env.example server/.env   # then set NODE_ENV=production, JWT_SECRET, CLIENT_ORIGIN, … (see below)

# 3. as root: MongoDB, nginx site, HTTPS, pm2 on boot
sudo bash deploy/native/setup-root.sh

# 4. as the deploy user: start the API
pm2 start deploy/native/ecosystem.config.cjs && pm2 save
```

Production `server/.env` (MONGO_URI is filled in by `setup-root.sh`):

```
NODE_ENV=production
API_PORT=4000
JWT_SECRET=<openssl rand -hex 32>
CLIENT_ORIGIN=https://dlcs.lectures.managemyschools.in
UPLOAD_DIR=/var/www/online-learning/server/uploads
REQUIRE_LOGIN_TO_VIEW=false
ALLOW_LOCAL_LOGIN=false
SMS_MOCK=false
SMS_ROLE_MAP={"student":"student","teacher":"teacher","admin":"admin","operator":"admin"}
```

DNS: an A record for `dlcs.lectures` pointing at the server. Without it, `setup-root.sh` skips HTTPS; re-run it once the record exists.

## Updating

```bash
cd /var/www/online-learning
git pull && npm ci && npm run build && pm2 restart online-learning-api
```

## Backups

```bash
sudo bash -c 'source /root/.mongodb-admin && mongodump -u "$MONGO_ADMIN_USER" -p "$MONGO_ADMIN_PASSWORD" --authenticationDatabase admin --db lectures --gzip --archive=/var/backups/lectures_$(date +%F).archive.gz'
```
