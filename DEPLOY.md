# Deploying the lecture portal for a school (example: dlcs)

The end result is that `https://dlcs.lectures.managemyschools.in` is live, and students and staff log in with their **SMS user ID and password**.

Two codebases are involved:

| What | Repo | Where it runs |
| --- | --- | --- |
| SSO endpoints | `sms` (Laravel) | the existing SMS server, e.g. `dlcs.managemyschools.in` |
| Lecture portal | `online-lectures` (this repo) | Docker on any server, here the same one as the SMS |

---

## 1. SMS: ship the SSO code

On your machine, in the `sms` repo:

```bash
git switch master && git pull
git merge --no-ff feature/lectures-sso-auto
git push origin master
```

On the SMS server:

```bash
cd /path/to/sms
git pull
php artisan config:clear
```

No `composer install` or `php artisan db:command` is needed: there are no new packages and no migrations.

Add to the SMS `.env`, then run `php artisan config:clear` again:

```
LECTURES_SSO_TENANTS=dlcs
```

The key pair is created automatically in `storage/keys/` on first use, so `storage/` must be writable by the PHP user (it already is if the SMS can write logs).

**Check:**

```bash
curl -s https://dlcs.managemyschools.in/sso/lectures/public-key | head -1
# -----BEGIN PUBLIC KEY-----
curl -s -X POST https://dlcs.managemyschools.in/api/sso/lectures/login \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"x","password":"x","audience":"https://dlcs.lectures.managemyschools.in"}'
# {"message":"Wrong user ID or password."}
```

> Testing from your laptop first? Also set `LECTURES_SSO_ALLOW_LOCALHOST=true`, then open `http://dlcs.lectures.localhost:5173`. The local portal works out the school and its SMS from that name. Remove the localhost setting once the real portal is live.

## 2. DNS

At your DNS provider for `managemyschools.in`, add an **A record**:

| Name | Value |
| --- | --- |
| `dlcs.lectures` | the server's public IP |

Or add a wildcard `*.lectures`, so future schools need no DNS change. Check with `dig +short dlcs.lectures.managemyschools.in`.

## 3. Put this repo on GitHub (once)

```bash
cd online-lectures
gh repo create Satyam34563/online-lectures --private --source . --push
# or: create an empty repo on github.com, then
# git remote add origin git@github.com:Satyam34563/online-lectures.git && git push -u origin main
```

## 4. Server: run the portal

Install Docker if needed:

```bash
curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker "$USER"   # log out and back in afterwards
```

Clone the repo and configure it:

```bash
sudo mkdir -p /opt/lectures && sudo chown "$USER" /opt/lectures
git clone git@github.com:Satyam34563/online-lectures.git /opt/lectures/dlcs
cd /opt/lectures/dlcs
cp docker/.env.prod.example docker/.env.prod
nano docker/.env.prod
```

In `docker/.env.prod`, set at least:

```
COMPOSE_PROJECT_NAME=lectures-dlcs  # keeps each school's containers and database separate
HTTP_PORT=127.0.0.1:8080          # host Nginx in front; use another port per school (8081, ...)
MONGO_ROOT_PASSWORD=<openssl rand -hex 24>
JWT_SECRET=<openssl rand -hex 32>
CLIENT_ORIGIN=https://dlcs.lectures.managemyschools.in
REQUIRE_LOGIN_TO_VIEW=true
ALLOW_LOCAL_LOGIN=false
SMS_MOCK=false
```

Nothing SMS-specific is needed: the SMS address `https://dlcs.managemyschools.in` is derived from `CLIENT_ORIGIN`.

Start it:

```bash
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d --build
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod ps   # all "running"/"healthy"
curl -s http://127.0.0.1:8080/api/health                                                        # {"ok":true,"db":true}
```

## 5. HTTPS in front (host Nginx + Let's Encrypt)

```bash
sudo cp docker/host-nginx.example.conf /etc/nginx/sites-available/dlcs-lectures
sudo ln -s /etc/nginx/sites-available/dlcs-lectures /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d dlcs.lectures.managemyschools.in
```

If the SMS server uses Apache instead, proxy the same host name to `http://127.0.0.1:8080` with `ProxyPass` / `ProxyPassReverse` and `RequestHeader set X-Forwarded-Proto https`.

## 6. Check it works

1. Open `https://dlcs.lectures.managemyschools.in/login` and log in with an SMS **Admin** user ID and password. You become the portal admin automatically.
2. **Manage → Classes & subjects**: create classes named **exactly** as in the SMS (e.g. `Class 9`, with section `A` if the SMS uses sections), plus subjects and chapters. Students are linked to a class by matching name.
3. Log in as a student and a teacher to confirm their roles.
4. Optional: in the SMS, add a "Lectures" menu link to `route('sso.lectures')`. Users already logged in to the SMS land on the portal signed in.

## 7. Backups

```bash
crontab -e
30 2 * * * /opt/lectures/dlcs/docker/backup.sh >> /var/log/lectures-dlcs-backup.log 2>&1
```

## Updating later

Portal:

```bash
cd /opt/lectures/dlcs && git pull
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d --build
```

SMS: the usual `git pull` + `php artisan config:clear`.

## Adding another school (e.g. abc)

1. Add `abc` to `LECTURES_SSO_TENANTS` in the SMS `.env` (comma separated), then run `php artisan config:clear`.
2. Add a DNS record for `abc.lectures` (skip if you used the wildcard).
3. Repeat steps 4–5 in `/opt/lectures/abc` with `COMPOSE_PROJECT_NAME=lectures-abc`, `HTTP_PORT=127.0.0.1:8081`, `CLIENT_ORIGIN=https://abc.lectures.managemyschools.in`, and an Nginx file for that name.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Login page says the SMS "can't be reached" | `curl https://dlcs.managemyschools.in/sso/lectures/public-key` from the server. A 404 means step 1 isn't deployed or `LECTURES_SSO_TENANTS` is missing. Run `docker compose … logs api` for details. |
| "Wrong user ID or password" for a correct login | Use the same ID and password that work on the SMS login page. Ten wrong tries lock that ID for 10 minutes. |
| "Unknown lecture portal address" | `CLIENT_ORIGIN` must be exactly `https://dlcs.lectures.managemyschools.in` (no trailing slash), matching the SMS's derived portal address. |
| "Could not verify your School Management System login" | Server clocks differ by more than 30 seconds (`timedatectl`), or the token is for another school. |
| Student logs in but sees no class | The portal class name doesn't match the SMS class name exactly. |
