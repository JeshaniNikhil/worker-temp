#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "========================================="
echo "   Volknode SMTP Worker Setup Script"
echo "========================================="
echo "This script will install Python, setup the"
echo "Celery worker, and connect it to Oracle."
echo "========================================="
echo ""

# 1. Update and install dependencies
echo "[1/6] Installing system dependencies..."
apt-get update
apt-get install -y python3 python3-venv python3-pip git

# 2. Setup Virtual Environment
echo "[2/6] Setting up Python virtual environment..."
cd backend
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

# 3. Ask for configuration details (since VNC makes copy/paste hard)
echo ""
echo "========================================="
echo "   Configuration (Interactive Prompt)"
echo "========================================="
read -p "Enter Oracle Cloud Public IP Address: " ORACLE_IP
read -p "Enter PostgreSQL Database Password: " DB_PASSWORD
read -p "Enter Redis Password (if any, else press Enter): " REDIS_PASSWORD
read -p "Enter your sending Domain (e.g. yourdomain.com): " DOMAIN_NAME

# Determine Volknode's own IP
VOLKNODE_IP=$(curl -s ifconfig.me)

echo ""
echo "[3/6] Generating .env file..."
cat > .env << EOF
# ── Remote Oracle Cloud Connection ────────────────────────────────────
DATABASE_URL=postgresql://user:${DB_PASSWORD}@${ORACLE_IP}:5432/emailplatform
CELERY_BROKER_URL=redis://:${REDIS_PASSWORD}@${ORACLE_IP}:6379/0
CELERY_RESULT_BACKEND=redis://:${REDIS_PASSWORD}@${ORACLE_IP}:6379/0

# ── Outbound SMTP Identity ───────────────────────────────────────────
SMTP_SOURCE_IP=${VOLKNODE_IP}
SMTP_VERIFICATION_FROM=verify@${DOMAIN_NAME}
SMTP_HELO_HOST=mail.${DOMAIN_NAME}

# Rate limiting
SMTP_DELAY_MIN=1.2
SMTP_DELAY_MAX=2.8
EOF

# 4. Create systemd service
echo "[4/6] Creating systemd service (email-worker.service)..."
cat > /etc/systemd/system/email-worker.service << EOF
[Unit]
Description=Email Validation Celery Worker
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)
EnvironmentFile=$(pwd)/.env
ExecStart=$(pwd)/venv/bin/celery -A app.worker.celery_app worker --loglevel=info --concurrency=1 -n worker@volknode
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 5. Start and enable service
echo "[5/6] Starting background service..."
systemctl daemon-reload
systemctl enable email-worker
systemctl restart email-worker

echo "[6/6] Setup Complete!"
echo "========================================="
echo "Worker is now running in the background."
echo "Check status with: systemctl status email-worker"
echo "View logs with:    journalctl -u email-worker -f"
echo "========================================="
echo ""
echo "IMPORTANT: Don't forget to allow Volknode's IP (${VOLKNODE_IP})"
echo "to access ports 5432 and 6379 on your Oracle Cloud firewall!"
echo "========================================="
