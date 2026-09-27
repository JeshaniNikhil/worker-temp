#!/bin/bash
# ==============================================================================
# VOLKNODE NATIVE BACKEND SETUP (NO DOCKER, 1 vCPU / 1GB RAM OPTIMIZED)
# Complete setup for FastAPI + Celery + Redis connected to Oracle PostgreSQL
# ==============================================================================

set -e

echo "=================================================="
echo "🚀 VOLKNODE NATIVE BACKEND SETUP"
echo "=================================================="
echo ""

# ------------------------------------------------------------------------------
# Step 1: Enable Swap Memory (SKIPPED - ALREADY DONE)
# ------------------------------------------------------------------------------
echo "✅ Step 1/6: Swap memory already configured. Skipping..."
echo ""

# ------------------------------------------------------------------------------
# Step 2: Install System Packages via APT (SKIPPED - ALREADY DONE)
# ------------------------------------------------------------------------------
echo "✅ Step 2/6: System packages already installed. Skipping..."
echo ""

# ------------------------------------------------------------------------------
# Step 3: Project Directory
# ------------------------------------------------------------------------------
echo "📥 Step 3/6: Using current project directory..."
DEPLOY_DIR="/opt/worker-temp"

if [ -d "$DEPLOY_DIR" ]; then
    cd "$DEPLOY_DIR"
else
    echo "❌ Directory $DEPLOY_DIR not found!"
    exit 1
fi
echo "✅ Repository ready at $DEPLOY_DIR"
echo ""

# ------------------------------------------------------------------------------
# Step 4: Python Virtual Environment & Requirements
# ------------------------------------------------------------------------------
echo "🐍 Step 4/6: Configuring Python virtual environment..."
VENV_DIR="/opt/venv"
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv --system-site-packages "$VENV_DIR"
fi

# Fix Python 3.13 psycopg-c compatibility issue by forcing pure python psycopg
$VENV_DIR/bin/pip uninstall -y psycopg-binary psycopg-c psycopg2-binary || true
pip uninstall -y psycopg-binary psycopg-c psycopg2-binary --break-system-packages || true
$VENV_DIR/bin/pip install psycopg==3.1.18 || true

source "$VENV_DIR/bin/activate"
pip install --no-cache-dir --quiet -r backend/requirements.txt || pip install --no-cache-dir -r backend/requirements.txt --break-system-packages || true
echo "✅ Python dependencies ready."
echo ""

# ------------------------------------------------------------------------------
# Step 5: Configure Environment (.env) & Systemd Services
# ------------------------------------------------------------------------------
echo "🔐 Step 5/6: Configuring environment & systemd services..."

# Re-enforce pure python psycopg after requirements.txt installation
$VENV_DIR/bin/pip uninstall -y psycopg-binary psycopg-c psycopg2-binary || true
pip uninstall -y psycopg-binary psycopg-c psycopg2-binary --break-system-packages || true
$VENV_DIR/bin/pip install psycopg==3.1.18 || true

cat > "$DEPLOY_DIR/backend/.env" <<'EOF'
DATABASE_URL=postgresql+psycopg://wolfuser:wolfpass123@92.4.73.23:5432/emailplatform
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
WorkingDirectory=$DEPLOY_DIR/backend
EnvironmentFile=$DEPLOY_DIR/backend/.env
ExecStart=$VENV_DIR/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8003 --workers 1
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
WorkingDirectory=$DEPLOY_DIR/backend
EnvironmentFile=$DEPLOY_DIR/backend/.env
ExecStart=$VENV_DIR/bin/python3 -m celery -A app.worker.celery_app worker --loglevel=info -c 1
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
echo "🧪 Step 6/6: Verifying backend deployment..."
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
