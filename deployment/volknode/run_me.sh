#!/bin/bash
# ==============================================================================
# VOLKNODE NATIVE BACKEND SETUP (NO DOCKER, 1 vCPU / 1GB RAM OPTIMIZED)
# Complete setup for FastAPI + Celery + Redis connected to Oracle PostgreSQL
# Fast & Lightweight installation without apt pipe hangs or interactive prompts
# ==============================================================================

set -e

# Disable all interactive prompts & automatic restart prompts
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

echo "=================================================="
echo "🚀 VOLKNODE NATIVE BACKEND SETUP"
echo "=================================================="
echo ""

# ------------------------------------------------------------------------------
# Step 1: Enable Swap Memory FIRST (Prevents OOM freezes during apt)
# ------------------------------------------------------------------------------
echo "🧠 Step 1/7: Checking Memory & Swap..."
SWAP_TOTAL=$(free -m | awk '/^Swap:/ {print $2}')
if [ "$SWAP_TOTAL" -eq 0 ]; then
    echo "⚠️ No swap detected! Creating 1GB swap file to prevent OOM freezes..."
    fallocate -l 1G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=1024
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile || true
    echo "/swapfile swap swap defaults 0 0" >> /etc/fstab || true
    echo "✅ 1GB Swap created and activated."
else
    echo "✅ Swap memory already active (${SWAP_TOTAL}MB)."
fi
echo ""

# ------------------------------------------------------------------------------
# Step 2: Ensure Repository (/opt/worker-temp) Exists
# ------------------------------------------------------------------------------
echo "📥 Step 2/7: Checking project directory (/opt/worker-temp)..."
mkdir -p /opt

if [ ! -d "/opt/worker-temp" ]; then
    echo "⚠️ /opt/worker-temp not found. Installing git and cloning repository..."
    apt-get update -qq
    apt-get install -y -qq --no-install-recommends git
    git clone -b main https://github.com/JeshaniNikhil/worker-temp.git /opt/worker-temp
    echo "✅ Repository cloned to /opt/worker-temp"
else
    echo "✅ /opt/worker-temp found."
fi

cd /opt/worker-temp
echo ""

# ------------------------------------------------------------------------------
# Step 3: Install Core System Packages via APT (Fast & Non-interactive)
# ------------------------------------------------------------------------------
echo "📦 Step 3/7: Installing system packages via apt-get (this takes ~30s)..."
apt-get update -qq

apt-get install -y -qq --no-install-recommends \
    -o Dpkg::Options::="--force-confdef" \
    -o Dpkg::Options::="--force-confold" \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    git \
    redis-server \
    curl \
    jq \
    postgresql-client \
    python3-fastapi \
    python3-uvicorn \
    python3-sqlalchemy \
    python3-psycopg \
    python3-celery \
    python3-redis \
    python3-dnspython \
    python3-pydantic \
    python3-email-validator \
    python3-httpx \
    python3-multipart \
    python3-jinja2 \
    python3-passlib \
    python3-bcrypt \
    python3-openpyxl \
    python3-socks \
    python3-phonenumbers

systemctl enable redis-server || true
systemctl restart redis-server || true
echo "✅ System packages installed & Redis started."
echo ""

# ------------------------------------------------------------------------------
# Step 4: Python Virtual Environment & Requirements
# ------------------------------------------------------------------------------
echo "🐍 Step 4/7: Configuring Python virtual environment..."
VENV_DIR="/opt/venv"
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv --system-site-packages "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"
pip install --no-cache-dir --quiet -r backend/requirements.txt || pip install --no-cache-dir -r backend/requirements.txt --break-system-packages || true
echo "✅ Python dependencies ready."
echo ""

# ------------------------------------------------------------------------------
# Step 5: Configure Environment (.env) & Systemd Services
# ------------------------------------------------------------------------------
echo "🔐 Step 5/7: Configuring environment & systemd services..."

cat > "/opt/worker-temp/backend/.env" <<'EOF'
DATABASE_URL=postgresql://wolfuser:wolfpass123@92.4.73.23:5432/emailplatform
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
REDIS_URL=redis://127.0.0.1:6379/0
SECRET_KEY=wolf-validator-secret-key-2026-production
SMTP_VALIDATION_ENABLED=true
SMTP_TIMEOUT=30
USE_SOCKS5=false
ENV=production
EOF

# Create Systemd Service for API (Uvicorn)
cat > /etc/systemd/system/wolf-backend.service <<EOF
[Unit]
Description=Wolf Email Validator FastAPI Service
After=network.target redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/worker-temp/backend
EnvironmentFile=/opt/worker-temp/backend/.env
ExecStart=$VENV_DIR/bin/uvicorn app.main:app --host 0.0.0.0 --port 8003 --workers 1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Create Systemd Service for Celery Worker
cat > /etc/systemd/system/wolf-worker.service <<EOF
[Unit]
Description=Wolf Email Validator Celery Worker Service
After=network.target redis-server.service wolf-backend.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/worker-temp/backend
EnvironmentFile=/opt/worker-temp/backend/.env
ExecStart=$VENV_DIR/bin/celery -A app.worker.celery_app worker --loglevel=info -c 1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable wolf-backend wolf-worker
systemctl restart wolf-backend wolf-worker
echo "✅ Systemd services configured and restarted."
echo ""

# ------------------------------------------------------------------------------
# Step 6: Testing & Verification
# ------------------------------------------------------------------------------
echo "🧪 Step 6/7: Verifying backend deployment..."
sleep 3

# Check services status
if systemctl is-active --quiet wolf-backend; then
    echo "✅ wolf-backend service: RUNNING"
else
    echo "❌ wolf-backend service: FAILED"
    systemctl status wolf-backend --no-pager
fi

if systemctl is-active --quiet wolf-worker; then
    echo "✅ wolf-worker service: RUNNING"
else
    echo "❌ wolf-worker service: FAILED"
    systemctl status wolf-worker --no-pager
fi

echo ""
echo "Testing Root API Endpoint..."
API_RESP=$(curl -s http://localhost:8003/ || echo "Failed")
echo "API Response: $API_RESP"
echo ""

echo "Testing Single Email Validation Endpoint..."
VAL_RESP=$(curl -s -X POST http://localhost:8003/api/validation/single \
    -H "Content-Type: application/json" \
    -d '{"email":"support@github.com"}' || echo "Failed")
echo "Validation Response: $VAL_RESP"

echo ""
echo "=================================================="
echo "🎉 VOLKNODE BACKEND SETUP COMPLETE!"
echo "=================================================="
echo ""
echo "🌐 API URL: http://87.251.66.181:8003"
echo "📜 View API Logs:    journalctl -u wolf-backend -f"
echo "📜 View Worker Logs: journalctl -u wolf-worker -f"
echo "🔄 Restart Backend:  systemctl restart wolf-backend wolf-worker"
echo "=================================================="
