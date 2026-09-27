#!/bin/bash
# ==============================================================================
# VOLKNODE BACKEND SETUP - FastAPI + Celery Worker
# Architecture: Volknode = API + Worker (port 25 SMTP)
#               Oracle   = PostgreSQL DB + Redis + Frontend
# ==============================================================================

set -e

echo "=================================================="
echo "🚀 VOLKNODE BACKEND SETUP"
echo "Architecture: Volknode=API+Worker | Oracle=DB+Redis+Frontend"
echo "=================================================="
echo ""

DEPLOY_DIR="/opt/worker-temp"
VENV_DIR="/opt/venv"

# ------------------------------------------------------------------------------
# Step 1: Change to deploy directory
# ------------------------------------------------------------------------------
echo "📁 Step 1: Using project directory $DEPLOY_DIR"
if [ ! -d "$DEPLOY_DIR" ]; then
    echo "  Directory not found. Cloning..."
    apt-get install -y git 2>/dev/null || true
    git clone -b main https://github.com/JeshaniNikhil/worker-temp.git "$DEPLOY_DIR"
fi
cd "$DEPLOY_DIR"
echo "✅ Ready at $DEPLOY_DIR"
echo ""

# ------------------------------------------------------------------------------
# Step 2: Python Virtual Environment
# ------------------------------------------------------------------------------
echo "🐍 Step 2: Setting up Python virtual environment..."
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv --system-site-packages "$VENV_DIR"
    echo "  Created new venv at $VENV_DIR"
fi
source "$VENV_DIR/bin/activate"
echo "  Installing requirements..."
pip install --no-cache-dir -q -r backend/requirements.txt 2>&1 | tail -5 || true

# CRITICAL FIX: Force pure-python psycopg (psycopg-c breaks on Python 3.13)
echo "  Fixing psycopg for Python 3.13 compatibility..."
pip uninstall -y psycopg-binary psycopg-c 2>/dev/null || true
pip install -q psycopg==3.1.18 2>/dev/null || true

echo "✅ Python dependencies ready."
echo ""

# ------------------------------------------------------------------------------
# Step 3: Configure .env - Point to Oracle DB and Oracle Redis
# ------------------------------------------------------------------------------
echo "🔐 Step 3: Writing .env configuration..."

cat > "$DEPLOY_DIR/backend/.env" << 'ENVEOF'
# Oracle PostgreSQL (public port 5432)
DATABASE_URL=postgresql+psycopg://wolfuser:wolfpass123@92.4.73.23:5432/emailplatform

# Oracle Redis as Celery broker (public port 6379, with password)
CELERY_BROKER_URL=redis://:wolfredis123@92.4.73.23:6379/0
REDIS_URL=redis://:wolfredis123@92.4.73.23:6379/0
CELERY_RESULT_BACKEND=redis://:wolfredis123@92.4.73.23:6379/0

# Security
SECRET_KEY=wolf-validator-secret-key-2026-production

# SMTP - Direct port 25 from Volknode (no SOCKS5 needed)
SMTP_VALIDATION_ENABLED=true
SMTP_TIMEOUT=30
USE_SOCKS5=false

ENV=production
ENVEOF

echo "✅ .env written (Oracle DB @ 92.4.73.23:5432, Oracle Redis @ 92.4.73.23:6379)"
echo ""

# ------------------------------------------------------------------------------
# Step 4: Test Oracle DB and Redis Connections
# ------------------------------------------------------------------------------
echo "🔌 Step 4: Testing connections to Oracle..."
source "$VENV_DIR/bin/activate"

DB_TEST=$(python3 -c "
import psycopg
try:
    conn = psycopg.connect('postgresql://wolfuser:wolfpass123@92.4.73.23:5432/emailplatform', connect_timeout=5)
    conn.close()
    print('DB_OK')
except Exception as e:
    print(f'DB_FAIL: {e}')
" 2>/dev/null)

if echo "$DB_TEST" | grep -q "DB_OK"; then
    echo "✅ Oracle PostgreSQL: CONNECTED"
else
    echo "⚠️  Oracle PostgreSQL: $DB_TEST"
    echo "   NOTE: Open port 5432 in Oracle Cloud Security List for Volknode IP 87.251.66.181"
fi

REDIS_TEST=$(python3 -c "
import redis
try:
    r = redis.Redis(host='92.4.73.23', port=6379, password='wolfredis123', socket_timeout=5)
    r.ping()
    print('REDIS_OK')
except Exception as e:
    print(f'REDIS_FAIL: {e}')
" 2>/dev/null)

if echo "$REDIS_TEST" | grep -q "REDIS_OK"; then
    echo "✅ Oracle Redis: CONNECTED"
else
    echo "⚠️  Oracle Redis: $REDIS_TEST"
    echo "   NOTE: Open port 6379 in Oracle Cloud Security List for Volknode IP 87.251.66.181"
fi

# Test port 25
echo ""
echo "📧 Step 4b: Testing outbound port 25 SMTP from Volknode..."
if timeout 5 bash -c 'cat /dev/null > /dev/tcp/gmail-smtp-in.l.google.com/25' 2>/dev/null; then
    echo "✅ Port 25 SMTP: OPEN - Email verification will work!"
else
    echo "❌ Port 25 SMTP: BLOCKED"
fi
echo ""

# ------------------------------------------------------------------------------
# Step 5: Create Systemd Services
# ------------------------------------------------------------------------------
echo "⚙️  Step 5: Configuring systemd services..."

cat > /etc/systemd/system/wolf-backend.service << SVCEOF
[Unit]
Description=Wolf Email Validator FastAPI Backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$DEPLOY_DIR/backend
EnvironmentFile=$DEPLOY_DIR/backend/.env
ExecStart=$VENV_DIR/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8003 --workers 1
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

cat > /etc/systemd/system/wolf-worker.service << SVCEOF
[Unit]
Description=Wolf Email Validator Celery Worker (Port 25 SMTP)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$DEPLOY_DIR/backend
EnvironmentFile=$DEPLOY_DIR/backend/.env
ExecStart=$VENV_DIR/bin/python3 -m celery -A app.worker.celery_app worker --loglevel=info --concurrency=1 -n volknode_worker@%h
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable wolf-backend wolf-worker
systemctl restart wolf-backend wolf-worker
echo "✅ Systemd services configured and restarted."
echo ""

# ------------------------------------------------------------------------------
# Step 6: Verify Everything
# ------------------------------------------------------------------------------
echo "🧪 Step 6: Verifying deployment..."
sleep 5

if systemctl is-active --quiet wolf-backend; then
    echo "✅ wolf-backend (API):    RUNNING"
else
    echo "❌ wolf-backend (API):    FAILED"
    journalctl -u wolf-backend --no-pager -n 20
fi

if systemctl is-active --quiet wolf-worker; then
    echo "✅ wolf-worker (Celery):  RUNNING"
else
    echo "❌ wolf-worker (Celery):  FAILED"
    journalctl -u wolf-worker --no-pager -n 20
fi

echo ""
echo "Testing API..."
sleep 3
API_RESP=$(curl -s --max-time 5 http://localhost:8003/ || echo "timeout - check DB connection")
echo "  API Root: $API_RESP"

echo ""
echo "=================================================="
echo "🎉 VOLKNODE BACKEND SETUP COMPLETE!"
echo "=================================================="
echo ""
echo "📋 Architecture:"
echo "   Browser → https://data-validator.wolfgroupindia.com"
echo "          → Oracle Frontend (Nginx on port 8081)"
echo "          → /api/* → Volknode API (87.251.66.181:8003)"
echo "          → Celery Worker does port 25 SMTP checks"
echo "          → Results stored in Oracle PostgreSQL"
echo ""
echo "🔗 Volknode API:    http://87.251.66.181:8003"
echo "🌐 Live Domain:     https://data-validator.wolfgroupindia.com"
echo ""
echo "📜 Logs:"
echo "   journalctl -u wolf-backend -f    (API)"
echo "   journalctl -u wolf-worker -f     (Worker/SMTP)"
echo "🔄 Restart: systemctl restart wolf-backend wolf-worker"
echo "=================================================="

