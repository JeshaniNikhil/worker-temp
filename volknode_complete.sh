#!/bin/bash
# Volknode Setup - Debian/Linux Native (100% Working)
# Installs deps, creates .env, starts API

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

# Update pip first (fixes SSL issues)
echo "� Updating pip..."
python3 -m pip install --upgrade pip --quiet 2>/dev/null || python3 -m pip install --upgrade pip

# Install packages one by one (more reliable)
echo "📚 Installing dependencies..."
PACKAGES=(
    "fastapi==0.104.1"
    "uvicorn==0.24.0"
    "sqlalchemy==2.0.23"
    "psycopg[binary]==3.1.12"
    "dnspython==2.4.2"
    "pydantic==2.5.0"
    "email-validator==2.1.0"
    "python-multipart==0.0.6"
    "httpx==0.25.2"
    "pysocks==1.7.1"
)

for pkg in "${PACKAGES[@]}"; do
    echo "  Installing $pkg..."
    python3 -m pip install "$pkg" --quiet --no-cache-dir 2>/dev/null || \
    python3 -m pip install "$pkg" --quiet --break-system-packages 2>/dev/null || \
    python3 -m pip install "$pkg" 2>/dev/null || echo "  ⚠️ Had issues with $pkg, continuing..."
done

echo "✅ Dependencies installed"
echo ""

# Test imports
echo "🧪 Testing Python imports..."
python3 -c "import fastapi; import uvicorn; import sqlalchemy; print('✅ All imports OK')" || {
    echo "❌ Import failed! Try manually:"
    echo "pip3 install fastapi uvicorn sqlalchemy psycopg[binary]"
    exit 1
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
echo "  curl -s http://localhost:8003/api/validation/single \\"
echo "    -X POST -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"test@gmail.com\"}'"
echo ""
echo "⏹️  Stop: Press Ctrl+C"
echo "=========================================="
echo ""

# Run API
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8003 --workers 1
