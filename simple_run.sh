#!/bin/bash
# Simple run - start API from correct directory

cd /opt/worker-temp/backend

cat > .env <<'EOF'
DATABASE_URL=postgresql://wolfuser:wolfpass123@92.4.73.23:5432/emailplatform
SMTP_VALIDATION_ENABLED=true
SMTP_TIMEOUT=30
ENV=production
EOF

# Install deps if needed
python3 -m pip install -q fastapi uvicorn sqlalchemy psycopg[binary] dnspython pydantic email-validator python-multipart httpx pysocks --break-system-packages 2>/dev/null || true

echo "Starting API..."
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8003 --workers 1
