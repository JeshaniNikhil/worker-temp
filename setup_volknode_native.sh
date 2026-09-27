#!/bin/bash
# Volknode Native Python Setup (No Docker)
# Lightweight deployment for 1vCPU, 1GB RAM

set -e

echo "=========================================="
echo "🚀 Volknode Native Python Setup"
echo "=========================================="
echo ""

# Step 1: Install Python and dependencies
echo "📦 Step 1/6: Installing system packages..."
apt-get update
apt-get install -y python3 python3-pip python3-venv git postgresql-client
echo "✅ System packages installed"
echo ""

# Step 2: Clone repository
echo "📥 Step 2/6: Cloning repository..."
cd /opt
rm -rf wolf-validator-backend 2>/dev/null || true
git clone -b main https://github.com/JeshaniNikhil/worker-temp.git wolf-validator-backend
cd wolf-validator-backend
echo "✅ Repository cloned"
echo ""

# Step 3: Create Python virtual environment
echo "🐍 Step 3/6: Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip setuptools wheel
echo "✅ Virtual environment created"
echo ""

# Step 4: Install Python dependencies
echo "📚 Step 4/6: Installing Python dependencies..."
pip install -r backend/requirements.txt
echo "✅ Dependencies installed"
echo ""

# Step 5: Create environment file
echo "🔐 Step 5/6: Creating environment file..."
cat > /opt/wolf-validator-backend/.env <<'EOF'
DATABASE_URL=postgresql://wolfuser:wolfpass123@92.4.73.23:5432/emailplatform
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=wolf-validator-secret-key-2024-production
SMTP_VALIDATION_ENABLED=true
SMTP_TIMEOUT=30
ENV=production
EOF
echo "✅ Environment file created"
echo ""

# Step 6: Start API on port 8003
echo "🚀 Step 6/6: Starting API server..."
cd /opt/wolf-validator-backend
source venv/bin/activate

# Create startup script
cat > start_api.sh <<'EOF'
#!/bin/bash
cd /opt/wolf-validator-backend
source venv/bin/activate
export $(cat .env | grep -v '#' | xargs)
uvicorn app.main:app --host 0.0.0.0 --port 8003 --workers 2
EOF

chmod +x start_api.sh
echo "✅ API startup script created"
echo ""

# Test API
echo "🧪 Testing API..."
timeout 5 bash -c 'cd /opt/wolf-validator-backend && source venv/bin/activate && export $(cat .env | grep -v "#" | xargs) && uvicorn app.main:app --host 127.0.0.1 --port 9999 &
sleep 3
curl -s http://127.0.0.1:9999/ && echo "" && kill %1 2>/dev/null || true' || true

echo ""
echo "=========================================="
echo "✅ Volknode Native Setup Complete!"
echo "=========================================="
echo ""
echo "📊 Resource usage (lightweight):"
echo "- CPU: ~5-10%"
echo "- RAM: ~150-200MB"
echo "- Storage: ~500MB"
echo ""
echo "🚀 To start API server:"
echo "   cd /opt/wolf-validator-backend && bash start_api.sh"
echo ""
echo "🧪 Test email validation (once running):"
echo "   curl -s http://localhost:8003/api/validation/single \\"
echo "     -X POST -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\":\"test@gmail.com\"}' | jq ."
echo ""
echo "📝 To run in background:"
echo "   cd /opt/wolf-validator-backend && nohup bash start_api.sh > api.log 2>&1 &"
echo ""
echo "📋 View logs:"
echo "   tail -f /opt/wolf-validator-backend/api.log"
echo ""
