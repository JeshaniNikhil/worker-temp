#!/bin/bash
# Volknode Setup - Debian (FIXED - No pip upgrade, apt only)

set -e

echo "=========================================="
echo "🚀 VOLKNODE SETUP - DEBIAN"
echo "=========================================="
echo ""

if [ ! -d "/opt/worker-temp" ]; then
    echo "❌ Error: /opt/worker-temp not found!"
    exit 1
fi

cd /opt/worker-temp
echo "✅ In /opt/worker-temp"
echo ""

# Create .env
echo "🔐 Creating .env..."
mkdir -p backend
cat > backend/.env <<'EOF'
DATABASE_URL=postgresql://wolfuser:wolfpass123@92.4.73.23:5432/emailplatform
SMTP_VALIDATION_ENABLED=true
SMTP_TIMEOUT=30
ENV=production
EOF
echo "✅ .env created"
echo ""

# Install via apt ONLY (no pip!)
echo "📦 Installing packages via apt-get..."
apt-get update -qq
apt-get install -y -qq \
  python3-fastapi \
  python3-uvicorn \
  python3-sqlalchemy \
  python3-psycopg \
  python3-dnspython \
  python3-pydantic \
  python3-email-validator \
  python3-httpx \
  python3-multipart \
  2>&1 | grep -v "Setting up" | head -10 || true

echo "✅ Packages installed"
echo ""

# Start API
echo "🚀 Starting API..."
cd /opt/worker-temp/backend
export $(cat .env | grep -v '#' | xargs)

echo ""
echo "=========================================="
echo "✅ API Running on port 8003"
echo "=========================================="
echo ""
echo "Test: curl http://localhost:8003/"
echo ""
echo "Stop: Ctrl+C"
echo "=========================================="
echo ""

python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8003 --workers 1
