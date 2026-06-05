# Self-Hosted Server Deployment Guide

Deploy **Thai Invoice Extractor** on your own VPS or dedicated server (DigitalOcean, AWS EC2, Azure VM, on-prem Linux, etc.).

**Quick picks:**

- [DEPLOY.md](./DEPLOY.md) — local LAN Docker (no public IP) or VPS Docker summary
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Railway, build reference, Docker Hub

## Architecture

```text
                    Internet (HTTPS)
                           │
                    ┌──────▼──────┐
                    │   Nginx     │  TLS + reverse proxy
                    │  (port 443) │
                    └──┬───────┬──┘
                       │       │
              UI ──────┘       └──── API
                       │       │
                ┌──────▼──┐ ┌──▼────────┐
                │ Frontend│ │ Backend   │
                │ static  │ │ Node 24   │
                │ :8080   │ │ :3000     │
                └─────────┘ └─────┬─────┘
                                  │
                           ┌──────▼──────┐
                           │ PostgreSQL  │
                           │     17      │
                           └─────────────┘
                                  │
                           ┌──────▼──────┐
                           │ Anthropic   │
                           │ Claude API  │
                           └─────────────┘
```

| Component | Technology | Internal port |
|-----------|------------|---------------|
| Frontend | React 19 + Vite (static) | 8080 |
| Backend | Node 24 + Express + TypeScript | 3000 |
| Database | PostgreSQL 17+ | 5432 |
| External | Anthropic Claude Vision | HTTPS outbound |

---

## Server specifications

### Minimum (small team / testing)

| Resource | Spec |
|----------|------|
| CPU | 2 vCPU |
| RAM | 4 GB |
| Disk | 40 GB SSD |
| OS | Ubuntu 22.04/24.04 LTS (recommended) |

### Recommended (production, ~10–50 users)

| Resource | Spec |
|----------|------|
| CPU | 4 vCPU |
| RAM | 8 GB |
| Disk | 80–100 GB SSD |
| OS | Ubuntu 24.04 LTS |
| Backup | Daily PostgreSQL backup |

### Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Do **not** expose PostgreSQL (5432) or the backend (3000) directly to the internet.

---

## Prerequisites

| Item | Notes |
|------|--------|
| Domain | e.g. `invoices.example.com` and `api.invoices.example.com` |
| Anthropic API key | https://console.anthropic.com |
| SSH access | sudo user on the server |
| Project code | Git clone or copy to server |

Software (pick one path):

- **Path A:** Docker + Docker Compose (recommended)
- **Path B:** Node 24 + PostgreSQL 17 + Nginx (bare metal)

---

## Path A — Docker Compose (recommended)

### A1. Prepare the server

```bash
ssh user@YOUR_SERVER_IP
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in
docker compose version
```

### A2. Clone the project

```bash
sudo mkdir -p /opt/invoice-extractor
sudo chown $USER:$USER /opt/invoice-extractor
cd /opt/invoice-extractor
git clone https://github.com/cogrammerth/Invoice_extractor_v1.git .
```

### A3. Configure backend

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Example production values:

```env
NODE_ENV=production
PORT=3000

DATABASE_URL=postgresql://invoice:STRONG_DB_PASSWORD@postgres:5432/invoice_extractor

ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-6

UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE_MB=20
LOG_LEVEL=info

JWT_SECRET=your-random-secret-at-least-32-characters-long
JWT_ISSUER=thai-invoice-extractor
JWT_AUDIENCE=thai-invoice-api

ALLOWED_ORIGIN=https://invoices.example.com
PUBLIC_API_BASE_URL=https://api.invoices.example.com
FRONTEND_AUTH_CALLBACK_URL=https://invoices.example.com/auth/callback

RUN_MIGRATIONS_ON_START=true
JWT_ACCESS_EXPIRES_IN=15m
```

Update `docker/docker-compose.yml` Postgres password to match `DATABASE_URL`:

```yaml
POSTGRES_PASSWORD: STRONG_DB_PASSWORD
```

Set frontend build args in `docker/docker-compose.yml`:

```yaml
args:
  VITE_API_URL: https://api.invoices.example.com
  VITE_APP_NAME: Thai Invoice Extractor
```

Optional — persist uploads on the host:

```yaml
backend:
  volumes:
    - ../backend/uploads:/app/uploads
```

```bash
mkdir -p backend/uploads
```

### A4. Start the stack

```bash
cd docker
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

Verify on the server:

```bash
curl http://localhost:3000/health
curl -I http://localhost:8080
```

Expected health response:

```json
{ "success": true, "status": "ok" }
```

### A5. Nginx + HTTPS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo nano /etc/nginx/sites-available/invoice-extractor
```

```nginx
server {
    listen 80;
    server_name invoices.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api.invoices.example.com;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/invoice-extractor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d invoices.example.com -d api.invoices.example.com
```

### A6. DNS

| Type | Name | Value |
|------|------|--------|
| A | `invoices` | YOUR_SERVER_IP |
| A | `api.invoices` | YOUR_SERVER_IP |

Test:

```text
https://api.invoices.example.com/health
https://invoices.example.com
```

### A7. Create first admin user

Postgres is exposed on localhost when using Docker Compose. Install Node 24 on the host, then:

```bash
cd /opt/invoice-extractor/backend
export DATABASE_URL="postgresql://invoice:STRONG_DB_PASSWORD@localhost:5432/invoice_extractor"
npm ci
npm run user:seed -- you@example.com 'YourSecurePassword123!' admin
```

Log in on the UI with that email and password.

---

## Path B — Bare metal (no Docker)

### B1. Install software

```bash
# Node 24
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 24

# PostgreSQL + Nginx
sudo apt install -y postgresql postgresql-contrib nginx certbot python3-certbot-nginx
```

### B2. Create database

```bash
sudo -u postgres psql
```

```sql
CREATE USER invoice WITH PASSWORD 'STRONG_DB_PASSWORD';
CREATE DATABASE invoice_extractor OWNER invoice;
\q
```

### B3. Build the app

```bash
cd /opt/invoice-extractor
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit backend/.env (see Path A3; use localhost in DATABASE_URL)
# Edit frontend/.env: VITE_API_URL=https://api.invoices.example.com

cd backend && npm ci && npm run build && npm run db:migrate
cd ../frontend && npm ci && npm run build
```

Backend `DATABASE_URL` example:

```env
DATABASE_URL=postgresql://invoice:STRONG_DB_PASSWORD@localhost:5432/invoice_extractor
```

### B4. systemd service for API

Create `/etc/systemd/system/invoice-api.service`:

```ini
[Unit]
Description=Thai Invoice Extractor API
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/invoice-extractor/backend
EnvironmentFile=/opt/invoice-extractor/backend/.env
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo mkdir -p /opt/invoice-extractor/backend/uploads
sudo chown -R www-data:www-data /opt/invoice-extractor/backend/uploads
sudo systemctl daemon-reload
sudo systemctl enable --now invoice-api
sudo systemctl status invoice-api
```

### B5. Nginx for frontend + API

Frontend (static files):

```nginx
server {
    listen 80;
    server_name invoices.example.com;
    root /opt/invoice-extractor/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Add the API server block from Path A5, then run Certbot as in A5.

---

## Environment variables reference

### Backend (runtime)

| Variable | Required | Notes |
|----------|----------|--------|
| `NODE_ENV` | Yes | `production` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `JWT_SECRET` | Yes | ≥ 32 characters |
| `ALLOWED_ORIGIN` | Yes | Exact frontend HTTPS URL |
| `PUBLIC_API_BASE_URL` | Yes | Public API HTTPS URL |
| `FRONTEND_AUTH_CALLBACK_URL` | Yes | SPA OAuth callback URL |
| `RUN_MIGRATIONS_ON_START` | Optional | `true` to auto-migrate on boot |

See `backend/.env.example` for all options.

### Frontend (build time)

| Variable | Required |
|----------|----------|
| `VITE_API_URL` | Yes — backend public URL |
| `VITE_APP_NAME` | Optional |

Rebuild frontend when `VITE_API_URL` changes.

---

## Post-deploy checklist

- [ ] `GET /health` returns `{ "success": true, "status": "ok" }`
- [ ] Frontend loads over HTTPS
- [ ] Admin user created via `user:seed`
- [ ] Login and test invoice upload work
- [ ] `ALLOWED_ORIGIN` matches frontend URL exactly (HTTPS, no typo)
- [ ] Postgres not publicly exposed
- [ ] Upload directory on persistent disk
- [ ] Daily DB backups configured

---

## Security checklist

- [ ] TLS 1.2+ (Certbot)
- [ ] Strong passwords and `JWT_SECRET`
- [ ] Firewall: SSH, 80, 443 only
- [ ] Never commit `.env`
- [ ] SSH key auth (disable password login)
- [ ] Optional: `AUTH_ALLOWED_EMAIL_DOMAINS=yourcompany.com`

---

## Optional SSO

Add to `backend/.env`:

```env
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=common

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Register OAuth redirect URIs in Azure / Google console:

```text
https://api.invoices.example.com/api/auth/oauth/microsoft/callback
https://api.invoices.example.com/api/auth/oauth/google/callback
```

---

## Maintenance

| Task | Command |
|------|---------|
| API logs (Docker) | `docker compose -f docker/docker-compose.yml logs -f backend` |
| API logs (systemd) | `journalctl -u invoice-api -f` |
| Restart API | `docker compose restart backend` or `sudo systemctl restart invoice-api` |
| Update app | `git pull`, rebuild, restart |
| DB backup | `pg_dump -Fc invoice_extractor > backup.dump` |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Environment validation failed` | Compare `backend/.env` with `backend/.env.example` |
| CORS errors | Set `ALLOWED_ORIGIN` to exact frontend origin (HTTPS) |
| `401 Unauthorized` | Seed user; check JWT expiry |
| `503 DATABASE_ERROR` | Postgres running; run `npm run db:migrate` |
| UI calls wrong API | Rebuild frontend with correct `VITE_API_URL` |
| Upload fails | Set `client_max_body_size 25M` in Nginx |
| `Table "extractions" does not exist` | Run migrations or set `RUN_MIGRATIONS_ON_START=true` |

See also [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) and [DEPLOYMENT.md](./DEPLOYMENT.md).
