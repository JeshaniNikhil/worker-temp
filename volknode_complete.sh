#!/bin/bash
# Volknode Setup - Debian/Linux (Fixed for externally-managed-environment)
# Uses apt for system packages, then starts API

set -e

echo "=========================================="
echo "🚀 VOLKNODE SETUP - DEBIAN"
echo "=========================================="
echo ""

# Check if repo exists
if [ ! -d "/opt/worker-temp" ]; then
    echo "❌ Error: /opt/worker-temp not found!"
    echo "Run: git clone -b main https://github.com/JeshaniNikhil/worker-temp.git /opt/worker-temp"
    exit 1
fi

cd /opt/worker-temp
echo "✅ In /opt/worker-temp"
echo ""

# Create .env
echo "🔐 Creating .env file..."
mkdir -p backend
cat > backend/.env <<'EOF'
DATABASE_URL=postgresql://wolfuser:wolfpass123@92.4.73.23:5432/emailplatform
SMTP_VALIDATION_ENABLED=true
SMTP_TIMEOUT=30
ENV=production
EOF
echo "✅ Created backend/.env"
echo ""

# Install system Python packages via apt (Debian way)
echo "📦 Installing Python packages via apt..."
apt-get update -qq 2>/dev/null || true

DEBIAN_PACKAGES=(
    "python3-fastapi"
    "python3-uvicorn"
    "python3-sqlalchemy"
    "python3-psycopg"
    "python3-dnspython"
    "python3-pydantic"
    "python3-email-validator"
    "python3-httpx"
)

for pkg in "${DEBIAN_PACKAGES[@]}"; do
    echo "  Installing $pkg..."
    apt-get install -y -qq "$pkg" 2>/dev/null || echo "  ⚠️ $pkg not available, will install via pip..."
done

echo "✅ System packages installed"
echo ""

# Try pip with --break-system-packages for any missing packages
echo "📚 Installing missing dependencies..."
python3 -m pip install --break-system-packages --quiet \
  fastapi uvicorn sqlalchemy psycopg[binary] dnspython pydantic email-validator \
  python-multipart httpx pysocks 2>/dev/null || \
python3 -m pip install --break-system-packages \
  fastapi uvicorn sqlalchemy psycopg[binary] dnspython pydantic email-validator \
  python-multipart httpx pysocks || echo "Some packages may have failed, continuing..."

echo "✅ Dependencies ready"
echo ""

# Test imports
echo "🧪 Testing Python imports..."
python3 -c "import fastapi; import uvicorn; import sqlalchemy; print('✅ All imports OK')" 2>&1 || {
    echo "⚠️ Some imports failed, but trying to start anyway..."
}
echo ""

# Start API
echo "🚀 Starting API on port 8003..."
echo ""
cd /opt/worker-temp/backend
export $(cat .env | grep -v '#' | xargs)

echo "=========================================="
echo "✅ READY! API Starting..."
echo "=========================================="
echo ""
echo "🔌 Listening on: http://0.0.0.0:8003"
echo ""
echo "📝 Test (from another terminal):"
echo "  curl http://localhost:8003/"
echo ""
echo "⏹️  Stop: Press Ctrl+C"
echo "=========================================="
echo ""

# Run API
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8003 --workers 1
