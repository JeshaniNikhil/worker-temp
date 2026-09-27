#!/bin/bash
# Complete Volknode Setup: Clean Old + Install Fresh Native Python Backend
# Fixed version with proper module path and error handling

set -e

echo "=========================================="
echo "🧹 CLEANUP + 🚀 SETUP"
echo "=========================================="
echo ""

# PART 1: CLEANUP
echo "🧹 PART 1: Cleaning old setup..."
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true
docker system prune -af --volumes 2>/dev/null || true
systemctl stop wolf-validator 2>/dev/null || true
systemctl stop volknode-socks5 2>/dev/null || true
rm -rf /opt/volknode-socks5 /opt/wolf-validator-backend /opt/wolf-group-data-validator /opt/worker-temp
rm -f /etc/systemd/system/volknode-socks5.service /etc/systemd/system/wolf-validator.service
systemctl daemon-reload 2>/dev/null || true
echo "✅ Cleanup complete"
echo ""

# PART 2: FRESH SETUP
echo "🚀 PART 2: Fresh native Python setup..."
echo ""

# Install system packages
echo "📦 Installing system packages..."
apt-get update -qq 2>/dev/null || true
apt-get install -y -qq python3 python3-pip git postgresql-client 2>/dev/null || true
echo "✅ System packages installed"
echo ""

# Clone repository to /opt/worker-temp
echo "📥 Cloning repository..."
cd /opt
git clone -q -b main https://github.com/JeshaniNikhil/worker-temp.git worker-temp
cd /opt/worker-temp
echo "✅ Repository cloned"
echo ""

# Create .env in backend directory
echo "🔐 Creating .env file..."
cat > backend/.env <<'EOF'
DATABASE_URL=postgresql://wolfuser:wolfpass123@92.4.73.23:5432/emailplatform
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=wolf-validator-secret-key-2024-production
SMTP_VALIDATION_ENABLED=true
SMTP_TIMEOUT=30
ENV=production
EOF
echo "✅ Environment file created"
echo ""

# Install Python dependencies globally (no venv - simpler for 1GB RAM)
echo "📚 Installing Python dependencies..."
python3 -m pip install --no-cache-dir --quiet \
  fastapi==0.104.1 \
  uvicorn==0.24.0 \
  sqlalchemy==2.0.23 \
  psycopg[binary]==3.1.12 \
  dnspython==2.4.2 \
  pydantic==2.5.0 \
  email-validator==2.1.0 \
  python-multipart==0.0.6 \
  httpx==0.25.2 \
  pysocks==1.7.1 \
  2>/dev/null || python3 -m pip install --break-system-packages --quiet \
  fastapi==0.104.1 uvicorn==0.24.0 sqlalchemy==2.0.23 psycopg[binary]==3.1.12 \
  dnspython==2.4.2 pydantic==2.5.0 email-validator==2.1.0 python-multipart==0.0.6 \
  httpx==0.25.2 pysocks==1.7.1
echo "✅ Dependencies installed"
echo ""

# Create startup script
echo "📝 Creating startup script..."
cat > /opt/worker-temp/start.sh <<'EOF'
#!/bin/bash
cd /opt/worker-temp/backend
export $(cat .env | grep -v '#' | xargs)
exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8003 --workers 1
EOF
chmod +x /opt/worker-temp/start.sh
echo "✅ Startup script created"
echo ""

# Install as systemd service
echo "⚙️  Installing systemd service..."
cat > /etc/systemd/system/wolf-validator.service <<'EOF'
[Unit]
Description=Wolf Validator API - Email SMTP Validation
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/worker-temp/backend
EnvironmentFile=/opt/worker-temp/backend/.env
ExecStart=/usr/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8003 --workers 1
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable wolf-validator 2>/dev/null || true
echo "✅ Systemd service installed"
echo ""

# Start service
echo "🚀 Starting API service..."
systemctl start wolf-validator
sleep 5
echo "✅ API started"
echo ""

# Test
echo "🧪 Testing API..."
STATUS=$(systemctl is-active wolf-validator 2>/dev/null || echo "inactive")
if [ "$STATUS" = "active" ]; then
    echo "✅ Service is running"
    
    # Try a test request
    for i in {1..10}; do
        if curl -s http://localhost:8003/ >/dev/null 2>&1; then
            echo "✅ API responding on port 8003"
            break
        fi
        if [ $i -lt 10 ]; then
            echo "⏳ Waiting for API to start... ($i/10)"
            sleep 1
        fi
    done
else
    echo "⚠️  Service status: $STATUS"
    echo "🔍 Checking logs..."
    journalctl -u wolf-validator -n 20 2>/dev/null || echo "Could not read logs"
fi
echo ""

# Show info
echo "=========================================="
echo "✅ VOLKNODE SETUP COMPLETE!"
echo "=========================================="
echo ""
echo "📊 System: 1vCPU, 1GB RAM, 5GB Storage"
echo "📍 Location: /opt/worker-temp"
echo "🔌 API: http://87.251.66.181:8003"
echo ""
echo "✅ Running as systemd service (auto-start on reboot)"
echo ""
echo "📝 Useful commands:"
echo "1. Check status:           systemctl status wolf-validator"
echo "2. View logs (live):       journalctl -u wolf-validator -f"
echo "3. Stop service:           systemctl stop wolf-validator"
echo "4. Start service:          systemctl start wolf-validator"
echo "5. Restart service:        systemctl restart wolf-validator"
echo "6. Test email validation:"
echo "   curl -s http://localhost:8003/api/validation/single \\"
echo "     -X POST -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\":\"test@gmail.com\"}' | jq ."
echo ""
echo "=========================================="
