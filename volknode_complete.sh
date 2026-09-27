#!/bin/bash
# Complete Volknode Setup: Clean Old + Install Fresh Native Python Backend
# One script to rule them all!

set -e

echo "=========================================="
echo "🧹 CLEANUP + 🚀 SETUP"
echo "=========================================="
echo ""

# PART 1: CLEANUP
echo "🧹 PART 1: Cleaning old setup..."
echo ""

# Stop/remove Docker if it exists
echo "Stopping Docker containers..."
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true
docker system prune -af --volumes 2>/dev/null || true

# Stop old systemd services
echo "Stopping old services..."
systemctl stop wolf-validator 2>/dev/null || true
systemctl stop volknode-socks5 2>/dev/null || true

# Remove old files
echo "Removing old directories..."
rm -rf /opt/volknode-socks5
rm -rf /opt/wolf-validator-backend
rm -rf /opt/wolf-group-data-validator
rm -f /etc/systemd/system/volknode-socks5.service
rm -f /etc/systemd/system/wolf-validator.service
systemctl daemon-reload

echo "✅ Cleanup complete"
echo ""

# PART 2: FRESH SETUP
echo "🚀 PART 2: Fresh native Python setup..."
echo ""

# Install system packages
echo "📦 Installing system packages..."
apt-get update -qq
apt-get install -y -qq python3 python3-pip python3-venv git postgresql-client > /dev/null 2>&1
echo "✅ System packages installed"
echo ""

# Clone repository
echo "📥 Cloning repository..."
cd /opt
git clone -q -b main https://github.com/JeshaniNikhil/worker-temp.git wolf-validator-backend
cd wolf-validator-backend
echo "✅ Repository cloned"
echo ""

# Create virtual environment
echo "🐍 Creating Python virtual environment..."
python3 -m venv venv > /dev/null 2>&1
source venv/bin/activate
pip install -q --upgrade pip setuptools wheel
echo "✅ Virtual environment ready"
echo ""

# Install dependencies
echo "📚 Installing Python dependencies..."
pip install -q -r backend/requirements.txt
echo "✅ Dependencies installed"
echo ""

# Create environment file
echo "🔐 Creating .env file..."
cat > .env <<'EOF'
DATABASE_URL=postgresql://wolfuser:wolfpass123@92.4.73.23:5432/emailplatform
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=wolf-validator-secret-key-2024-production
SMTP_VALIDATION_ENABLED=true
SMTP_TIMEOUT=30
ENV=production
EOF
echo "✅ Environment file created"
echo ""

# Create startup script
echo "📝 Creating startup script..."
cat > /opt/wolf-validator-backend/start.sh <<'EOF'
#!/bin/bash
cd /opt/wolf-validator-backend
source venv/bin/activate
export $(cat .env | grep -v '#' | xargs)
exec uvicorn app.main:app --host 0.0.0.0 --port 8003 --workers 2
EOF
chmod +x /opt/wolf-validator-backend/start.sh
echo "✅ Startup script created"
echo ""

# Install as systemd service
echo "⚙️  Installing systemd service..."
cat > /etc/systemd/system/wolf-validator.service <<'EOF'
[Unit]
Description=Wolf Validator API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/wolf-validator-backend
Environment="PATH=/opt/wolf-validator-backend/venv/bin"
EnvironmentFile=/opt/wolf-validator-backend/.env
ExecStart=/opt/wolf-validator-backend/start.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable wolf-validator > /dev/null 2>&1
echo "✅ Systemd service installed"
echo ""

# Start service
echo "🚀 Starting API service..."
systemctl start wolf-validator
sleep 3
echo "✅ API started"
echo ""

# Test
echo "🧪 Testing API..."
STATUS=$(systemctl is-active wolf-validator)
if [ "$STATUS" = "active" ]; then
    echo "✅ Service is running"
    
    # Try a test request
    for i in {1..5}; do
        if curl -s http://localhost:8003/ >/dev/null 2>&1; then
            echo "✅ API responding on port 8003"
            break
        fi
        if [ $i -lt 5 ]; then
            echo "Waiting for API to fully start... ($i/5)"
            sleep 1
        fi
    done
else
    echo "⚠️  Service failed to start"
    echo "Check logs: journalctl -u wolf-validator -n 30"
fi
echo ""

# Show info
echo "=========================================="
echo "✅ VOLKNODE SETUP COMPLETE!"
echo "=========================================="
echo ""
echo "📊 System: 1vCPU, 1GB RAM, 5GB Storage"
echo "📍 Location: /opt/wolf-validator-backend"
echo "🔌 API: http://87.251.66.181:8003"
echo ""
echo "✅ Running as systemd service (auto-start on reboot)"
echo ""
echo "📝 Useful commands:"
echo ""
echo "1. Check status:"
echo "   systemctl status wolf-validator"
echo ""
echo "2. View logs (live):"
echo "   journalctl -u wolf-validator -f"
echo ""
echo "3. Stop service:"
echo "   systemctl stop wolf-validator"
echo ""
echo "4. Start service:"
echo "   systemctl start wolf-validator"
echo ""
echo "5. Test email validation:"
echo "   curl -s http://localhost:8003/api/validation/single \\"
echo "     -X POST -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\":\"test@gmail.com\"}' | jq ."
echo ""
echo "=========================================="
