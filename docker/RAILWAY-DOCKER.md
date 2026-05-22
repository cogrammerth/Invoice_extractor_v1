# Quick reference: deploy to Railway with Docker (no GitHub)

Replace placeholders before running.

## 1. Build images (repo root)

```powershell
cd "c:\Synnex Project\Invoice_extractor_v1"

docker build -f docker/Dockerfile.backend -t YOUR_USER/invoice-api:latest .

docker build -f docker/Dockerfile.frontend `
  --build-arg VITE_API_URL=https://YOUR-BACKEND.up.railway.app `
  --build-arg VITE_APP_NAME="Thai Invoice Extractor" `
  -t YOUR_USER/invoice-ui:latest .
```

## 2. Push to Docker Hub

```powershell
docker login
docker push YOUR_USER/invoice-api:latest
docker push YOUR_USER/invoice-ui:latest
```

## 3. Railway dashboard

1. **PostgreSQL** plugin
2. **Empty service** → Deploy from Docker Hub → `YOUR_USER/invoice-api:latest`
3. Variables: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `JWT_SECRET` (32+ chars), `NODE_ENV=production`, `RUN_MIGRATIONS_ON_START=true`, CORS/OAuth URLs
4. Generate domain for API
5. **Empty service** → `YOUR_USER/invoice-ui:latest` (rebuild image if API URL changed)
6. Generate domain for UI → update API `ALLOWED_ORIGIN` → redeploy API

## 4. Health check

```text
GET https://YOUR-BACKEND.up.railway.app/health
```

Full guide: [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)
