#!/bin/bash
# Volknode Setup - Fast version (skip system packages, assume git already done)
# Just setup Python, .env, and start API

set -e

echo "=========================================="
echo "🚀 VOLKNODE SETUP - STEP 2"
echo "=========================================="
echo ""

# Go to cloned repo
echo "📁 Moving to /opt/worker-temp..."
cd /opt/worker-temp
echo "✅ In worker-temp directory"
echo ""

# Create .env in backend directory
echo "🔐 Creating .env file..."
mkdir -p backend
cat > backend/.env <<'EOF'
DATABASE_URL=postgresql://wolfuser:wolfpass123@92.4.73.23:5432/emailplatform
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=wolf-validator-secret-key-2024-production
SMTP_VALIDATION_ENABLED=true
SMTP_TIMEOUT=30
ENV=production
EOF
echo "✅ Environment file created at backend/.env"
echo ""

# Install Python dependencies globally (no venv - simpler for 1GB RAM)
echo "📚 Installing Python dependencies (this takes 1-2 minutes)..."
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

# Start API directly
echo "� Starting API on port 8003..."
cd /opt/worker-temp/backend
export $(cat .env | grep -v '#' | xargs)
echo ""
echo "=========================================="
echo "✅ Setup complete! Starting API..."
echo "=========================================="
echo ""
echo "� API will run on: http://87.251.66.181:8003"
echo ""
echo "📝 To test (in another terminal):"
echo "   curl http://localhost:8003/api/validation/single \\"
echo "     -X POST -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\":\"test@gmail.com\"}' | jq ."
echo ""
echo "⏹️  To stop: Press Ctrl+C"
echo "=========================================="
echo ""

# Run API
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8003 --workers 1
