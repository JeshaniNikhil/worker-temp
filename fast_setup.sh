#!/bin/bash
# Fast Volknode Setup - No venv, install globally, start API

cd /opt
rm -rf worker-temp 2>/dev/null || true
git clone -q https://github.com/JeshaniNikhil/worker-temp.git worker-temp
cd worker-temp

cat > .env <<'EOF'
DATABASE_URL=postgresql://wolfuser:wolfpass123@92.4.73.23:5432/emailplatform
SMTP_VALIDATION_ENABLED=true
SMTP_TIMEOUT=30
ENV=production
EOF

python3 -m pip install -q fastapi uvicorn sqlalchemy psycopg[binary] dnspython pydantic email-validator python-multipart httpx pysocks --break-system-packages

echo "✅ Setup complete!"
echo ""
echo "Starting API on port 8003..."
cd /opt/worker-temp
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8003 --workers 1
