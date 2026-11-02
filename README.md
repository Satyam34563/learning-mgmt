# School Lectures Portal

A MERN app (one deployment per school) for organising school lecture recordings by **class → subject → chapter**, with teachers, free-form key–value details, timetable view, progress tracking, and single sign-on from the school's main **School Management System (SMS)**.

| Part | Stack |
| --- | --- |
| `client/` | React 19, Vite, React Router, TanStack Query, Tailwind CSS |
| `server/` | Node, Express 5, Mongoose 9, Zod |
| Database | Self-hosted MongoDB 7 in Docker (dev and prod) |
| `docker/` | Dev and prod Compose files, Nginx config, backup script |

## Run locally

Needs Node 24+ and Docker.

```bash
npm install
cp server/.env.example server/.env
npm run db:up       # MongoDB in Docker on 127.0.0.1:27017
npm run seed        # sample classes, subjects, chapters, lectures and demo accounts
npm run dev         # API on :4000, web on http://localhost:5173
```

Demo accounts (password `admin12345`): `admin@school.local`, `teacher@school.local`, `student@school.local`.
With `SMS_MOCK=true` (the dev default), **Continue with School Management System** opens a fake SMS login page so you can try the SSO flow as any role.

Other scripts: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run format`, `npm run db:down`.

## Features

- **Catalogue**: classes (with sections), subjects (with a colour), chapters (per subject, linked to one or more classes), teachers.
- **Lectures**: belong to one or more classes, a subject, an optional chapter and teacher. Video link (YouTube, Google Drive, or direct file), attachments, tags, date and period, draft/published status, and any number of **key–value details** (`meta`, e.g. `term = Term 1`). Every meta key automatically becomes a filter.
- **Browse**: full-text search; filters for class, subject, chapter, teacher, meta, tag and date range; class drill-down page.
- **Timetable**: week grid by date × period for a class. Students land on their own class.
- **Students**: resume where you left off (YouTube/file videos are tracked automatically), "Continue watching", bookmarks, history, mark as done.
- **Staff**: create and edit lectures, upload attachments, manage the catalogue, **bulk import** from CSV/Excel (with a dry-run check and downloadable template), a "missing lectures" report (chapters with no lectures yet).
- **Admin**: users and roles, analytics (most watched, output per teacher, completion rate, active learners).

### Roles

| Role | Can |
| --- | --- |
| `student` | Browse, watch, track progress, bookmark |
| `teacher` | All of the above, plus create, edit and delete *their own* lectures, add chapters, and bulk import |
| `admin` | Everything, including catalogue, users and analytics |

Anonymous visitors can browse published lectures unless `REQUIRE_LOGIN_TO_VIEW=true`.

## SMS login

Each school runs **its own portal**, and users sign in through that school's School Management System (the Laravel SMS at `<school>.managemyschools.in`). The portal never sees SMS passwords or passkeys.

1. A user clicks **Continue with School Management System**, which opens `/api/auth/sms/login` on the portal.
2. The portal redirects to `SMS_LOGIN_URL` (`https://<school>.managemyschools.in/sso/lectures`) with `redirect_uri` and `state`.
3. The SMS requires its normal login (ID number + password, plus a passkey for admins and operators). It checks that `redirect_uri` is exactly this school's portal callback, then returns the user with a **60-second RS256 token**.
4. The portal verifies the signature, issuer (`SMS_TOKEN_ISSUER`, the school's SMS domain) and audience (`SMS_TOKEN_AUDIENCE`, this portal's origin). It then creates or updates the user, sets its own session cookie, and returns the user to where they started.

Opening `/sso/lectures` from inside the SMS (e.g. from a "Lectures" menu link) runs the same flow in reverse, so users already logged in to the SMS land on the portal signed in.

**Token claims** (built by `LecturesSsoController` in the SMS):

| Claim | Source in SMS | Example |
| --- | --- | --- |
| `sub` | `users.id` | `"1843"` |
| `name` | `users.name` | `"Riya Singh"` |
| `role` | `Student` (from `usertype`) or `Teacher` / `Admin` / `Operator` (from `role`) | `"Student"` |
| `class`, `section` | latest `assign_students` → `student_classes.name`, `student_sections.name` | `"Class 9"`, `"A"` |
| `email` | `users.email_id` if it's a valid email | |
| `id_no` | `users.id_no` (admission / employee number) | |

Other SMS users (drivers, attendance logins, inactive accounts) are refused at the SMS. `SMS_ROLE_MAP` maps `operator` to `admin`.
Students are placed in the portal class whose **name (and section) match the SMS**, so name portal classes exactly as the SMS does.

### Setting up a school

On the SMS server, once for all schools:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out storage/keys/lectures-sso-private.pem
openssl pkey -in storage/keys/lectures-sso-private.pem -pubout -out storage/keys/lectures-sso-public.pem
```

Per school, add its portal to the SMS `.env`, then run `php artisan config:clear`:

```
LECTURES_SSO_PORTALS={"dps.managemyschools.in":"https://lectures.dps.edu.in"}
```

In that school's portal (`docker/.env.prod`), set `SMS_LOGIN_URL`, `SMS_TOKEN_ISSUER`, `SMS_TOKEN_AUDIENCE`, and the public key (`SMS_TOKEN_PUBLIC_KEY_FILE` or `SMS_TOKEN_PUBLIC_KEY`). Only the SMS holds the private key, so a portal's config can't be used to mint logins.

## Deploy (self-hosted)

On the server (Docker installed):

```bash
git clone <repo> /opt/online-lectures && cd /opt/online-lectures
cp docker/.env.prod.example docker/.env.prod   # fill in secrets, domain and SMS settings
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d --build
```

- `web` (Nginx) serves the React build and proxies `/api` and `/uploads` to `api`. MongoDB is **not** exposed outside the Docker network.
- Put HTTPS in front (Caddy, Certbot, or your host's load balancer). Cookies are `Secure` in production.
- Optional break-glass local admin: `docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod exec api node dist/scripts/seed.js --admin` (needs `SEED_ADMIN_PASSWORD` set and `ALLOW_LOCAL_LOGIN=true` to use it).

### Backups

`docker/backup.sh` dumps MongoDB (gzipped archive) and the uploads volume into `backups/`, keeping 14 days. Add it to cron:

```
30 2 * * * /opt/online-lectures/docker/backup.sh >> /var/log/lectures-backup.log 2>&1
```

Restore instructions are at the bottom of the script. Copy `backups/` off the server too, for example with rclone to cloud storage.

## API overview

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/lectures` | `class, subject, chapter, teacher, tag, meta=key:value,…, q, from, to, status, sort, page, limit` |
| GET | `/api/lectures/:id` · `/meta-keys` · `/tags` | |
| POST/PUT/DELETE | `/api/lectures[/:id]` | staff |
| CRUD | `/api/classes` `/api/subjects` `/api/chapters` `/api/teachers` | write: admin (chapters: staff) |
| POST | `/api/uploads` | multipart `file`; staff |
| GET/POST | `/api/import/lectures/template` · `/api/import/lectures?dryRun=&create=` | staff |
| GET/PUT/DELETE | `/api/me/progress/:id` · `/continue` · `/history` · `/bookmarks[/:id]` | any logged-in user |
| GET | `/api/stats` · `/stats/gaps` (staff) · `/stats/analytics` (admin) | |
| * | `/api/auth/options` · `/me` · `/login` · `/logout` · `/sms/login` · `/sms/callback` | |
| * | `/api/users` | admin |

## Ideas for later

PWA/offline viewing, a Hindi or regional-language UI, per-chapter quizzes, moving attachments to S3/MinIO, and video hosting with HLS.
