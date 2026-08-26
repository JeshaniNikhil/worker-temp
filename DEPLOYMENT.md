# 🚀 Email Validator — Production Deployment Guide
## Contabo VPS · Docker Compose · Nginx · SSL

> Last updated to match the latest codebase (sequential Celery worker, CATCH_ALL status, live results UI).

---

## Architecture Overview

```
                        Internet
                           │
                      [Nginx :80/:443]
                      /             \
         [Frontend :3000]      [API :8000]
            React SPA           FastAPI
                                    │
                              [Worker]
                           Celery (sequential)
                                    │
                    ┌───────────────┴───────────────┐
                [Redis :6379]              [PostgreSQL :5432]
                  Task queue                  Results DB
```

5 Docker containers:
| Container | Role |
|-----------|------|
| `db` | PostgreSQL — stores jobs + results |
| `redis` | Redis — Celery broker/backend |
| `api` | FastAPI — serves REST endpoints |
| `worker` | Celery — sequential email validation |
| `frontend` | Nginx static — serves React app |

---

## Step 1: Server Prerequisites

SSH into your Contabo VPS and install Docker:

```bash
ssh root@YOUR_VPS_IP

# Update system
apt update && apt upgrade -y

# Install Docker + Compose + Nginx + Certbot
apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx git curl ufw

# Enable Docker
systemctl enable docker && systemctl start docker

# Add your user to docker group (if not root)
usermod -aG docker $USER
```

**Contabo-specific: Request Port 25 unblocked**
Open a support ticket with Contabo:
> "Please unblock outbound port 25 for SMTP email verification on IP `YOUR_STATIC_IP`. Use case: outbound email validation only, no mass mailing."

**Set Reverse DNS (PTR record)** in Contabo control panel:
- Customer Panel → Server → Reverse DNS
- Set `YOUR_STATIC_IP` → `mail.yourdomain.com`

---

## Step 2: Clone the Project

```bash
cd /opt
git clone https://github.com/YOUR_REPO/ai-email-platform.git email-platform
cd email-platform
```

If already cloned and you're just updating:
```bash
cd /opt/email-platform
git pull
```

---

## Step 3: Create `.env` File

```bash
cat > .env << 'EOF'
# ── Database ──────────────────────────────────────────────────────────
POSTGRES_USER=emailuser
POSTGRES_PASSWORD=CHANGE_THIS_STRONG_PASSWORD
POSTGRES_DB=emailplatform
DATABASE_URL=postgresql://emailuser:CHANGE_THIS_STRONG_PASSWORD@db:5432/emailplatform

# ── Redis / Celery ────────────────────────────────────────────────────
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# ── SMTP Verification Identity ────────────────────────────────────────
# Use your Contabo additional static IP for SMTP outbound
SMTP_SOURCE_IP=169.58.234.98
SMTP_VERIFICATION_FROM=verify@mail.yourdomain.com
SMTP_HELO_HOST=mail.yourdomain.com

# ── Rate Limiting (Contabo-safe sequential SMTP) ──────────────────────
# Min/max seconds between each SMTP check in bulk jobs
SMTP_DELAY_MIN=1.2
SMTP_DELAY_MAX=2.8
EOF
```

> **⚠️ Change `CHANGE_THIS_STRONG_PASSWORD` to a real password before deploying!**

---

## Step 4: Update `docker-compose.yml`

Replace the existing `docker-compose.yml` with this production-ready version:

```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    # Do NOT expose 5432 publicly in production

  redis:
    image: redis:7-alpine
    restart: always
    # Do NOT expose 6379 publicly in production

  api:
    build:
      context: ./backend
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
    restart: always
    env_file: .env
    ports:
      - "8000:8000"
    depends_on:
      - db
      - redis
    # Allow outbound port 25 for SMTP verification
    network_mode: host  # OR use 'bridge' + cap_add below
    # cap_add: [NET_ADMIN]  # Uncomment if using bridge network

  worker:
    build:
      context: ./backend
    # concurrency=1 enforces sequential processing — DO NOT increase
    command: celery -A app.worker.celery_app worker --loglevel=info --concurrency=1 -n worker@%h
    restart: always
    env_file: .env
    depends_on:
      - db
      - redis
    network_mode: host

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod   # see Step 5
    restart: always
    ports:
      - "3000:80"
    depends_on:
      - api

volumes:
  postgres_data:
```

> **Note on `network_mode: host`:** Required so the worker/API can bind to `SMTP_SOURCE_IP` (your static IP) for outbound SMTP. If your VPS doesn't allow host networking, use `bridge` + `cap_add: [NET_RAW, NET_ADMIN]`.

---

## Step 5: Create Production Frontend Dockerfile

The existing `frontend/Dockerfile` runs `npm run dev` (development mode). Create a production version:

```bash
cat > frontend/Dockerfile.prod << 'EOF'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF
```

Create `frontend/nginx.conf` (serves React SPA + proxies `/api`):

```bash
cat > frontend/nginx.conf << 'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Serve React SPA — all routes fall back to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to FastAPI backend
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }
}
EOF
```

> **If using external Nginx (not inside Docker):** Skip the proxy in `frontend/nginx.conf` and configure it in system Nginx instead (see Step 7).

---

## Step 6: Build & Start All Containers

```bash
cd /opt/email-platform

# Build images (takes ~2-5 min first time)
docker compose build --no-cache

# Start all services in background
docker compose up -d

# Watch logs
docker compose logs -f
```

Verify all containers are healthy:
```bash
docker compose ps
```

Expected output:
```
NAME        STATUS          PORTS
db          Up              5432/tcp
redis       Up              6379/tcp
api         Up              0.0.0.0:8000->8000/tcp
worker      Up
frontend    Up              0.0.0.0:3000->80/tcp
```

---

## Step 7: Nginx Reverse Proxy + SSL (System Nginx)

```bash
# Create site config
cat > /etc/nginx/sites-available/emailvalidator << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Larger body for CSV uploads
    client_max_body_size 50M;

    # API — long timeout for SMTP validation
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
    }

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/emailvalidator /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Get free SSL certificate
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up by certbot; verify:
certbot renew --dry-run
```

---

## Step 8: Firewall Setup

```bash
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw enable

# Check outbound port 25 works (after Contabo unblocks it)
nc -vz gmail-smtp-in.l.google.com 25
```

---

## Step 9: Verify Everything Works

```bash
# 1. Test API is up
curl http://localhost:8000/

# 2. Run a single email check inside the container
docker compose exec api python3 -c "
import os
os.environ['SMTP_SOURCE_IP'] = '169.58.234.98'
from app.core.email_checker import check_email
print('Test 1:', check_email('nikhiljeshani9@gmail.com'))
print('Test 2:', check_email('notreal99999@gmail.com'))
"

# 3. Check Celery worker is consuming tasks
docker compose logs worker --tail=30

# 4. Check Redis is working
docker compose exec redis redis-cli ping
# Expected: PONG

# 5. Check DB
docker compose exec db psql -U emailuser -d emailplatform -c "\dt"
```

---

## Step 10: Updating After Code Changes

```bash
cd /opt/email-platform

# Pull latest code
git pull

# Rebuild only changed containers (fast)
docker compose build api worker frontend

# Restart with zero-downtime rolling restart
docker compose up -d --no-deps api worker frontend

# Watch for errors
docker compose logs -f api worker
```

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_SOURCE_IP` | *(empty)* | Contabo static IP for SMTP outbound binding |
| `SMTP_VERIFICATION_FROM` | `verify@validator.wolfgroupindia.com` | MAIL FROM address used in SMTP handshake |
| `SMTP_HELO_HOST` | `validator.wolfgroupindia.com` | EHLO/HELO hostname |
| `SMTP_DELAY_MIN` | `1.2` | Min seconds between SMTP checks in bulk jobs |
| `SMTP_DELAY_MAX` | `2.8` | Max seconds between SMTP checks (jitter) |
| `CELERY_BROKER_URL` | `redis://localhost:6379/0` | Redis URL for Celery |
| `DATABASE_URL` | SQLite | PostgreSQL URL for production |

---

## Celery Worker — Important Notes

The worker runs with **`--concurrency=1`** (sequential, 1 email at a time).

**Do NOT increase concurrency** — it will cause:
- Multiple simultaneous SMTP connections from the same IP
- Rate-limit bans from mail servers (Gmail, Yahoo, Microsoft)
- Contabo IP blacklisting

The jitter delay (`SMTP_DELAY_MIN` / `SMTP_DELAY_MAX`) adds randomness to avoid pattern-based detection.

**Processing speed estimate:**
| Emails | Avg time |
|--------|----------|
| 50 | ~2 min |
| 100 | ~4 min |
| 500 | ~20 min |
| 1000 | ~40 min |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| CSV upload gives 500 error | Check `docker compose logs worker` — Redis/Celery issue |
| Port 25 blocked | Open Contabo support ticket to unblock outbound port 25 |
| SMTP Source IP bind error | Run `ip addr show` — verify `SMTP_SOURCE_IP` is assigned on the VPS |
| Catch-all shows as DELIVERABLE | Pull latest code — this was fixed |
| Worker not processing jobs | Check `docker compose ps worker` — restart with `docker compose restart worker` |
| SSL certificate fails | Ensure port 80 is open in UFW and domain DNS points to VPS |
| DB connection error | Check `DATABASE_URL` in `.env` matches PostgreSQL credentials |
