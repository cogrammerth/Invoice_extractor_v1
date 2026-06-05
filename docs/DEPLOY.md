# Deployment Guide — Thai Invoice Extractor

> **Easy read:** open [DEPLOY.html](./DEPLOY.html) in your browser (sidebar navigation, printable).

Step-by-step instructions for deploying this app. Pick the path that matches your environment.

| Path | Best for | Public internet | Auto-update from GitHub |
|------|----------|-----------------|-------------------------|
| [**A — Railway + GitHub**](#a--railway--github-recommended-for-cloud) | Cloud hosting, no server admin | Yes (Railway URLs) | Yes — `git push` redeploys |
| [**B — Local server + Docker**](#b--local-server--docker-lan-no-public-ip) | Office/home LAN, no public IP | No (LAN only) | Yes — `git pull` + script |
| [**C — VPS + Docker**](#c--vps--docker-public-server) | Your own Ubuntu server with domain | Yes (with Nginx + TLS) | Yes — `git pull` + script |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Railway Docker images, build reference | — | — |
| [SELF-HOSTED.md](./SELF-HOSTED.md) | Bare metal, Nginx, Certbot details | — | — |

---

## Before you deploy

### What to put on the server

**Do not copy only `backend/` and `frontend/`.** The layout depends on the path:

| Path | Required folders |
|------|------------------|
| Railway + GitHub | Full repo on GitHub (Railway clones it) |
| Docker (local or VPS) | Repo root: `backend/`, `frontend/`, `docker/` + `backend/.env` |

**Never commit** `backend/.env` with real secrets. Create it on the server or in Railway Variables.

### Accounts and keys

| Item | Required |
|------|----------|
| [Anthropic API key](https://console.anthropic.com) | Yes — Claude vision extraction |
| GitHub repository | Yes for Railway and `git pull` workflows |
| Railway account | Path A only |
| Domain name | Path C (optional for Path B) |

### Architecture (all paths)

```text
Browser
   │
   ├──► Frontend (React static, port 8080 or Railway)
   │
   └──► Backend API (Express, port 3000)
            │
            ├──► PostgreSQL 17
            └──► Anthropic Claude API (outbound HTTPS)
```

---

## A — Railway + GitHub (recommended for cloud)

Railway builds from your GitHub repo. Each `git push` to the connected branch triggers a new deploy.

### A1. Push code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

Ensure `.gitignore` excludes `backend/.env`, `node_modules/`, and `backend/uploads/`.

### A2. Create Railway project

1. Sign in at [railway.app](https://railway.app) with **GitHub**.
2. **New Project**.
3. **+ New** → **Database** → **PostgreSQL**.
4. Note the Postgres service name (e.g. `Postgres`).

### A3. Deploy backend (API)

1. **+ New** → **GitHub Repo** → select your repository.
2. Rename the service to `invoice-api`.
3. **Settings** → **Root Directory** → `backend` → Save.

Railway reads `backend/railway.toml`:

- Build: `npm ci --include=dev && npm run build`
- Start: `npm start` (`node dist/server.js`)
- Health check: `/health`

4. **Variables** — add:

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference syntax) or paste from Postgres |
| `ANTHROPIC_API_KEY` | Your Claude API key |
| `JWT_SECRET` | Random string, ≥ 32 characters |
| `RUN_MIGRATIONS_ON_START` | `true` |
| `JWT_ISSUER` | `thai-invoice-extractor` |
| `JWT_AUDIENCE` | `thai-invoice-api` |

5. **Settings** → **Networking** → **Generate Domain**.
6. Copy the backend URL, e.g. `https://invoice-api-production-xxxx.up.railway.app`.
7. Verify: open `https://YOUR-BACKEND-URL/health` — expect `{ "success": true, "status": "ok" }`.

Set URL variables (update again after frontend domain exists):

| Variable | Value |
|----------|--------|
| `PUBLIC_API_BASE_URL` | `https://YOUR-BACKEND-URL` |
| `ALLOWED_ORIGIN` | `https://YOUR-FRONTEND-URL` (set in A4) |
| `FRONTEND_AUTH_CALLBACK_URL` | `https://YOUR-FRONTEND-URL/auth/callback` |

### A4. Deploy frontend (UI)

1. In the **same project**: **+ New** → **GitHub Repo** → same repository.
2. Rename to `invoice-ui`.
3. **Settings** → **Root Directory** → `frontend` → Save.

4. **Variables** (required **before** build — Vite inlines these at build time):

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | `https://YOUR-BACKEND-URL` (no trailing slash) |
| `VITE_APP_NAME` | `Thai Invoice Extractor` |

5. **Networking** → **Generate Domain** → copy frontend URL.

6. Return to **invoice-api** → update and redeploy:

```env
ALLOWED_ORIGIN=https://YOUR-FRONTEND-URL
FRONTEND_AUTH_CALLBACK_URL=https://YOUR-FRONTEND-URL/auth/callback
```

### A5. Create admin user

Run from your PC against Railway Postgres `DATABASE_URL` (copy from Postgres → Variables):

```bash
cd backend
npm ci

# Linux / macOS
export DATABASE_URL="postgresql://..."
npm run user:seed -- admin@yourcompany.com 'YourSecurePassword123!' admin

# Windows PowerShell
$env:DATABASE_URL="postgresql://..."
npm run user:seed -- admin@yourcompany.com 'YourSecurePassword123!' admin
```

Or with Railway CLI:

```bash
npm install -g @railway/cli
railway login
cd backend
railway link    # select project + invoice-api service
railway run npm run user:seed -- admin@yourcompany.com 'YourSecurePassword123!' admin
```

Log in at your frontend Railway URL.

### A6. Auto-update from GitHub

After setup, every push redeploys automatically:

```bash
git add .
git commit -m "feat: your change"
git push origin main
```

| Changed folder | Redeploys |
|----------------|-----------|
| `backend/**` | `invoice-api` |
| `frontend/**` | `invoice-ui` |

**Important:** If `VITE_API_URL` changes, trigger a **frontend** redeploy (new build). Backend-only env changes need an **API** redeploy.

### A7. Railway checklist

- [ ] `GET /health` on backend URL returns OK
- [ ] Frontend loads over HTTPS
- [ ] `ALLOWED_ORIGIN` matches frontend URL exactly
- [ ] `VITE_API_URL` points to backend URL
- [ ] Admin user seeded
- [ ] Test invoice upload works
- [ ] Optional: attach a **Volume** to API service for persistent `UPLOAD_DIR`

### A8. Railway troubleshooting

| Symptom | Fix |
|---------|-----|
| `tsc: not found` | Root Directory must be `backend` or `frontend`; never run `npm run build` in Start Command |
| `Environment validation failed` | Compare variables with `backend/.env.example` |
| CORS errors | `ALLOWED_ORIGIN` must equal frontend URL (scheme + host + port) |
| UI calls wrong API | Fix `VITE_API_URL`, redeploy frontend |
| `Table "extractions" does not exist` | Set `RUN_MIGRATIONS_ON_START=true`, redeploy API |
| Uploads lost after redeploy | Railway disk is ephemeral; add a volume or object storage |

---

## B — Local server + Docker (LAN, no public IP)

For an **on-prem Ubuntu box** on your office/home network without a public IP. Users on the same LAN open the app by IP (e.g. `http://192.168.1.50:8080`).

No domain, Nginx, or Certbot required for basic use.

### B1. Install Docker on Ubuntu

```bash
sudo apt update
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Log out and back in, then:

```bash
docker compose version
sudo apt install -y git
```

### B2. Clone from GitHub

```bash
sudo mkdir -p /opt/invoice-extractor
sudo chown $USER:$USER /opt/invoice-extractor
cd /opt/invoice-extractor
git clone https://github.com/YOUR_USER/YOUR_REPO.git .
```

### B3. Find LAN IP

```bash
hostname -I
# Example: 192.168.1.50
```

Use a **fixed IP** (DHCP reservation on your router) so URLs do not break.

### B4. Configure

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Example for LAN (`192.168.1.50` = your IP):

```env
NODE_ENV=production
DATABASE_URL=postgresql://invoice:invoice@postgres:5432/invoice_extractor
ANTHROPIC_API_KEY=sk-ant-your-key
JWT_SECRET=your-random-secret-at-least-32-characters-long

ALLOWED_ORIGIN=http://192.168.1.50:8080
PUBLIC_API_BASE_URL=http://192.168.1.50:3000
FRONTEND_AUTH_CALLBACK_URL=http://192.168.1.50:8080/auth/callback

RUN_MIGRATIONS_ON_START=true
UPLOAD_DIR=/app/uploads
```

Edit `docker/docker-compose.yml` — frontend build args:

```yaml
frontend:
  build:
    args:
      VITE_API_URL: http://192.168.1.50:3000
      VITE_APP_NAME: Thai Invoice Extractor
```

Optional — persist uploads on host:

```yaml
backend:
  volumes:
    - ../backend/uploads:/app/uploads
```

```bash
mkdir -p backend/uploads
```

### B5. Start stack

```bash
cd /opt/invoice-extractor/docker
docker compose up -d --build
docker compose ps
curl http://localhost:3000/health
```

Open from any PC on the LAN: `http://192.168.1.50:8080`

### B6. Create admin user (one time)

```bash
cd /opt/invoice-extractor/backend
export DATABASE_URL="postgresql://invoice:invoice@localhost:5432/invoice_extractor"
npm ci
npm run user:seed -- admin@local 'YourPassword123!' admin
```

### B7. Update from GitHub

Use the included script:

```bash
/opt/invoice-extractor/scripts/deploy-docker.sh
```

Or manually:

```bash
cd /opt/invoice-extractor
git pull origin main
cd docker
docker compose up -d --build
```

`backend/.env` on the server is preserved; do not commit it to GitHub.

### B8. LAN notes

- **Email/password login** works on LAN. OAuth (Google/Microsoft) needs a public callback URL unless you add VPN/tunnel.
- **CORS:** `ALLOWED_ORIGIN` must match the browser URL exactly (including `http` and port).
- **Firewall:** allow LAN only, not the whole internet:

  ```bash
  sudo ufw allow from 192.168.0.0/16 to any port 3000
  sudo ufw allow from 192.168.0.0/16 to any port 8080
  ```

- Do **not** expose PostgreSQL (5432) to your router.

---

## C — VPS + Docker (public server)

For a cloud VPS with a public IP and optional custom domain. Full Nginx + TLS steps are in [SELF-HOSTED.md](./SELF-HOSTED.md) (Path A).

Quick summary:

1. Clone repo to `/opt/invoice-extractor` (same as B2).
2. Configure `backend/.env` with **HTTPS** URLs and your domain.
3. Set `VITE_API_URL` in `docker/docker-compose.yml` to your API domain.
4. `cd docker && docker compose up -d --build`
5. Install Nginx + Certbot (see SELF-HOSTED.md).
6. Seed admin user (same as B6).
7. Update with `scripts/deploy-docker.sh`.

---

## Environment variables reference

### Backend (runtime)

| Variable | Required | Notes |
|----------|----------|--------|
| `NODE_ENV` | Yes | `production` in deploy |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `JWT_SECRET` | Yes | ≥ 32 characters |
| `ALLOWED_ORIGIN` | Yes | Exact frontend URL users open in browser |
| `PUBLIC_API_BASE_URL` | Yes | Public API URL (OAuth, links) |
| `FRONTEND_AUTH_CALLBACK_URL` | Yes | `{frontend}/auth/callback` |
| `RUN_MIGRATIONS_ON_START` | Recommended | `true` for Railway / Docker |
| `UPLOAD_DIR` | Optional | Default `./uploads`; use volume in production |
| `CLAUDE_MODEL` | Optional | Default `claude-sonnet-4-6` |

See `backend/.env.example` for rate limits, SSO, and cost dashboard settings.

### Frontend (build time only)

| Variable | Required | Notes |
|----------|----------|--------|
| `VITE_API_URL` | Yes | Backend URL; rebuild when changed |
| `VITE_APP_NAME` | Optional | Shown in UI |

On Docker, set via `docker/docker-compose.yml` `build.args`. On Railway, set as service variables before build.

---

## Post-deploy checklist (all paths)

- [ ] Backend `/health` returns success
- [ ] Frontend loads in browser
- [ ] Admin user created (`npm run user:seed`)
- [ ] Login works
- [ ] Invoice upload and extraction work
- [ ] `ALLOWED_ORIGIN` matches frontend URL exactly
- [ ] Secrets only in Railway Variables or server `backend/.env` — not in Git
- [ ] Database backups configured (Railway plugin backups or `pg_dump` cron)

---

## Choosing a path

| Question | Recommendation |
|----------|----------------|
| No server to manage? | **Railway + GitHub** (Path A) |
| Internal office tool, no public IP? | **Local Docker** (Path B) |
| Own Ubuntu VPS + domain? | **VPS Docker** (Path C) + [SELF-HOSTED.md](./SELF-HOSTED.md) |
| Want `git push` → live site? | **Railway + GitHub** (Path A) |
| Want full control on LAN? | **Local Docker** (Path B) |

---

## Cursor + Railway MCP

Manage Railway (deploy, logs, env vars) from Cursor via the **Railway MCP** server.

**Already configured** in `.cursor/mcp.json` (remote OAuth — no local CLI required for MCP).

1. **Restart Cursor** (or reload window).
2. Open **Cursor Settings → MCP** — confirm `railway` shows as connected.
3. On first use, complete **OAuth** in the browser when prompted.
4. In chat, you can ask e.g. “List my Railway projects” or “Redeploy invoice-api”.

Re-install manually if needed:

```bash
railway mcp install --agent cursor --remote
```

Local MCP (uses Railway CLI instead of OAuth URL):

```bash
railway login
railway mcp install --agent cursor
```

---

## Related docs

- [DEPLOYMENT.md](./DEPLOYMENT.md) — build commands, Railway Docker images, CI
- [SELF-HOSTED.md](./SELF-HOSTED.md) — Nginx, Certbot, bare metal, firewall
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — common runtime errors
- [API.md](./API.md) — endpoints and response shapes
