# Production Deployment

Backend: Express 4 + Mongoose 8 (Node ≥ 18). Frontend: Vite 8 + React 19 (static build).
The frontend calls the API through a **relative `/api`** base URL, so the API must be
served from the **same origin** (reverse proxy) or `VITE_API_URL` must be overridden.

---

## 1. Prerequisites

- Node.js ≥ 18 (audited on Node 24 / npm 11)
- MongoDB ≥ 6 reachable by the backend
- A reverse proxy (nginx / Caddy / Traefik) terminating TLS

---

## 2. Backend configuration

Create `timetable-system/backend/.env`:

```dotenv
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/timetable_db     # or a managed URI + auth
JWT_SECRET=<32+ char random string>                     # REQUIRED — app refuses to boot without it
JWT_EXPIRES_IN=7d
CLIENT_URL=https://yourdomain.example,https://www.yourdomain.example   # CORS allow-list, comma-separated
```

Hard rules enforced at boot (`src/server.js`):

- `JWT_SECRET` missing ⇒ **process exits**.
- `NODE_ENV=production` and `JWT_SECRET` < 32 chars ⇒ **process exits**.

### First run (one-time admin)
No default admin exists in production. Create it once:

```bash
curl -X POST https://yourdomain.example/api/auth/setup \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<strong-password>"}'
```

- Password must be ≥ 8 chars.
- The `admin_setup_lock` guarantees only **one** setup request ever succeeds;
  later calls return `400 Admin already exists`.
- There is no seed password anywhere in production (the `admin/admin123` path in
  `clearData.js` runs **only** when `NODE_ENV` is not `production`).

### Build & run
```bash
cd timetable-system/backend
npm ci
npm test          # 25 tests: 16 engine + 9 integration (needs a local mongod)
npm start         # node src/server.js
```

### Rate limits (already configured)
| Limiter | Limit |
|---------|-------|
| `apiLimiter` (all `/api`) | 1000 / 15 min |
| `authLimiter` (setup + logins) | 20 / 15 min |
| `heavyLimiter` (generation) | 100 / hour |

All three skip when `NODE_ENV=test`.

---

## 3. Frontend build

```bash
cd timetable-system/frontend
npm ci
npm run lint      # 0 errors / 37 warnings (exit 0) — see AUDIT_REPORT §7
npm run build     # outputs dist/
```

If the API is on a **different origin**, set `VITE_API_URL` at build time:
```bash
VITE_API_URL=https://api.yourdomain.example/api npm run build
```
Otherwise keep the default `VITE_API_URL=/api`.

---

## 4. Reverse proxy (same-origin, recommended)

```nginx
server {
  listen 443 ssl http2;
  server_name yourdomain.example;

  # Frontend
  root /var/www/timetable/frontend/dist;
  index index.html;

  location / {
    try_files $uri /index.html;         # SPA fallback
  }

  location /api/ {
    proxy_pass         http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    client_max_body_size 10m;            # express.json limit is 10mb
  }

  location /uploads/ {
    alias /var/www/timetable/backend/uploads/;
    expires 7d;
  }
}
```

Set `CLIENT_URL` to the exact public origin(s) (scheme + host, no trailing slash)
so the CORS allow-list matches.

---

## 5. Static uploads directory
`app.js` serves `process.cwd()/uploads`. Persist it (volume/bind mount) and back it
up; the multer temp/`uploads` path must survive restarts.

---

## 6. Verification checklist

- [ ] `GET /api/health` → `200 {"success":true}`
- [ ] `GET /api/auth/setup-status` → `adminExists: false` before setup, `true` after
- [ ] `POST /api/auth/setup` twice → one `201`, one `400`
- [ ] `GET /api/timetable/versions` with no token → `401`
- [ ] Anonymous `GET /api/download/pdf/all-classes?versionId=<draft>` → `404`
- [ ] Teacher A requesting Teacher B's timetable → `403`
- [ ] `npm test` → **25 passing, 0 failing**
- [ ] `npm run build` (frontend) → exit 0
- [ ] Wrong `Origin` header → CORS rejected
- [ ] Login 21× rapidly → `429` from `authLimiter`

---

## 7. Production hardening (beyond this repo's changes)

- TLS + HSTS at the proxy; the app ships `helmet` with CSP disabled (enable a
  tuned CSP once the frontend origin is final).
- Managed MongoDB with auth (`MONGODB_URI` credentials in a secret store, not `.env` in Vite).
- Secret injection from the platform (environment/secret manager), never committed.
- Process supervision (`systemd` / `pm2`) + log rotation.
- Backups for MongoDB + `uploads/`.
- External SMTP for `emailconfig` (stored in DB; configure via admin Settings).

---

## 7. Managed hosting: Render + MongoDB Atlas (recommended)

A blueprint is committed at the repo root (`render.yaml`) that deploys both
services. Render does not host MongoDB, so the database is Atlas M0 (free).

### 7.1 Create the database (Atlas M0)
1. https://cloud.mongodb.com -> create an **M0 (free)** cluster.
2. **Database Access** -> add a user with `readWrite` on `timetable_db`.
3. **Network Access** -> allow `0.0.0.0/0` (or Render's outbound IPs).
4. **Connect -> Drivers** -> copy the `mongodb+srv://...` string.

### 7.2 Deploy with the blueprint
1. Render dashboard -> **New -> Blueprint** -> pick this repo. Render reads
   `render.yaml` and creates `timetable-backend` (web) + `timetable-frontend` (static).
2. On the **backend** service, set the dashboard-only env vars:
   - `MONGODB_URI` = the Atlas SRV string
   - `CLIENT_URL`  = `https://<frontend>.onrender.com` (fill after the frontend URL is known)
   (`JWT_SECRET` is auto-generated; `NODE_ENV=production` is set by the blueprint.)
3. On the **frontend** service set `VITE_API_URL = https://<backend>.onrender.com/api`
   and **redeploy** the frontend (Vite inlines env vars at build time).

### 7.3 First-run admin
Production has no default admin. Create one once:
```bash
curl -X POST https://<backend>.onrender.com/api/auth/setup \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<strong-password>"}'
```

### 7.4 Notes
- **Free tier sleeps** after ~15 min idle; the first request then takes 30-60s.
- **Ephemeral disk**: the `uploads/` directory is lost on redeploy/restart (the
  engine needs no disk). Add a Persistent Disk if uploads must persist.
- Copy existing local data into Atlas with `node scripts/migrateToAtlas.js`
  (`--dry` first).

---

## 8. Not yet done

- **Browser/E2E automation was not run** during this audit — only unit/integration
  tests and a production build. Run a smoke pass on staging after deploy.
- Frontend lint passes with **0 errors / 37 warnings**; the two React Compiler
  rules (`set-state-in-effect`, `react-refresh/only-export-components`) are
  intentionally at `warn` — see `AUDIT_REPORT.md` §7.
