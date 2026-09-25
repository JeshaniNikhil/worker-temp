# Split Architecture Deployment Guide

## 🏗️ Architecture Overview

This deployment splits the application across two servers to bypass Oracle Cloud's port 25 restrictions:

**Volknode (87.251.66.181)** - Backend Server
- ✅ Backend API (FastAPI) on port 8003
- ✅ Celery Worker for background tasks
- ✅ Redis for queue management
- ✅ **Direct SMTP port 25 access** (no proxy needed!)

**Oracle (92.4.73.23)** - Frontend & Database
- ✅ PostgreSQL Database on port 5432
- ✅ Frontend (React + Nginx) on ports 80/443
- ✅ Public domain: https://data-validator.wolfgroupindia.com
- ✅ Nginx proxies `/api/*` requests to Volknode backend

## 📊 Benefits

1. **No SOCKS5 proxy needed** - Backend has direct port 25 access on Volknode
2. **Simpler architecture** - No complex networking or proxy configuration
3. **Better performance** - No proxy overhead for SMTP validation
4. **Database on Oracle** - Fast NVMe SSD storage, PostgreSQL-optimized
5. **Frontend on Oracle** - Serves static files with SSL from your domain

## 🚀 Deployment Steps

### Step 1: Deploy Backend on Volknode

SSH into Volknode (87.251.66.181):

```bash
# Download and run deployment script
curl -s https://raw.githubusercontent.com/JeshaniNikhil/worker-temp/main/deployment/volknode/deploy_volknode.sh -o /tmp/deploy.sh
bash /tmp/deploy.sh
```

Or manually:

```bash
# Clone repo
git clone https://github.com/JeshaniNikhil/worker-temp.git /opt/wolf-validator-backend
cd /opt/wolf-validator-backend

# Copy docker-compose
cp deployment/volknode/docker-compose.volknode.yml docker-compose.yml

# Start services
docker compose up -d --build

# Check status
docker compose ps

# Test API
curl -s http://localhost:8003/
```

### Step 2: Deploy Frontend + Database on Oracle

SSH into Oracle (92.4.73.23):

```bash
# Download and run deployment script
curl -s https://raw.githubusercontent.com/JeshaniNikhil/worker-temp/main/deployment/oracle/deploy_oracle.sh -o /tmp/deploy.sh
bash /tmp/deploy.sh
```

Or manually:

```bash
# Clone repo
cd /opt/wolf-group-data-validator
git pull origin main

# Copy docker-compose
cp deployment/oracle/docker-compose.oracle.yml docker-compose.yml

# Copy nginx config
mkdir -p deployment/oracle
cp deployment/oracle/nginx.conf deployment/oracle/nginx.conf

# Start services
docker compose up -d --build

# Check status
docker compose ps
```

### Step 3: Configure Database Access

On Oracle, allow Volknode to access PostgreSQL:

```bash
# PostgreSQL is already exposed on 0.0.0.0:5432 in the docker-compose
# Verify it's listening:
docker compose ps db
netstat -tlnp | grep 5432

# Test from Volknode:
psql postgresql://wolfuser:wolfpass123@92.4.73.23:5432/emailplatform -c 'SELECT version();'
```

### Step 4: Update Frontend API URL

On Oracle, update the frontend to point to Volknode backend:

```bash
cd /opt/wolf-group-data-validator

# Update frontend environment (if using .env)
# Or Nginx already proxies /api/ to Volknode in deployment/oracle/nginx.conf
# Just rebuild frontend if needed:
docker compose restart frontend
```

### Step 5: Test Full Flow

```bash
# Test from anywhere:
curl -s https://data-validator.wolfgroupindia.com/api/validation/single \
  -X POST -H 'Content-Type: application/json' \
  -d '{"email":"support@github.com"}' | jq .

# Expected response:
{
  "email": "support@github.com",
  "status": "DELIVERABLE",
  "reason": "SMTP server accepted mailbox",
  "execution_time_ms": 2500
}
```

## 🔧 Configuration

### Environment Variables

**Volknode (Backend):**
```bash
DATABASE_URL=postgresql://wolfuser:wolfpass123@92.4.73.23:5432/emailplatform
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=<your-secret-key>
SMTP_VALIDATION_ENABLED=true
SMTP_TIMEOUT=30
ENV=production
```

**Oracle (Frontend):**
```bash
VITE_API_URL=http://87.251.66.181:8003  # Points to Volknode backend
```

### Firewall Rules

**Oracle:**
- ✅ Allow incoming 80, 443 (HTTPS)
- ✅ Allow incoming 5432 from 87.251.66.181 (PostgreSQL)

**Volknode:**
- ✅ Allow incoming 8003 from 92.4.73.23 (API)
- ✅ Allow outgoing port 25 (SMTP validation)

## 📝 Maintenance

### View Logs

**Volknode:**
```bash
cd /opt/wolf-validator-backend
docker compose logs -f api      # API logs
docker compose logs -f worker   # Worker logs
docker compose logs -f redis    # Redis logs
```

**Oracle:**
```bash
cd /opt/wolf-group-data-validator
docker compose logs -f db        # Database logs
docker compose logs -f frontend  # Frontend logs
```

### Restart Services

**Volknode:**
```bash
cd /opt/wolf-validator-backend
docker compose restart api worker
```

**Oracle:**
```bash
cd /opt/wolf-group-data-validator
docker compose restart frontend db
```

### Update Code

**Volknode:**
```bash
cd /opt/wolf-validator-backend
git pull origin main
docker compose build --no-cache
docker compose up -d
```

**Oracle:**
```bash
cd /opt/wolf-group-data-validator
git pull origin main
docker compose build --no-cache
docker compose up -d
```

## 🧪 Testing

### Test SMTP Validation (Port 25)

On Volknode, verify direct port 25 access:

```bash
# Test SMTP connection to Gmail
telnet gmail-smtp-in.l.google.com 25

# Test email validation API
curl -s http://localhost:8003/api/validation/single \
  -X POST -H 'Content-Type: application/json' \
  -d '{"email":"test@gmail.com"}' | jq .
```

### Test Database Connection

From Volknode to Oracle:

```bash
psql postgresql://wolfuser:wolfpass123@92.4.73.23:5432/emailplatform -c '\dt'
```

### Test Frontend

Visit: https://data-validator.wolfgroupindia.com

Use the Single Validation page to validate emails through the UI.

## 🎯 Summary

✅ **Backend (Volknode)**: Direct port 25 SMTP validation without proxy
✅ **Frontend (Oracle)**: SSL-enabled domain serving React app
✅ **Database (Oracle)**: Fast NVMe PostgreSQL on port 5432
✅ **Nginx Proxy**: Oracle proxies `/api/*` to Volknode seamlessly

No SOCKS5 proxy, no port restrictions, clean architecture! 🚀
