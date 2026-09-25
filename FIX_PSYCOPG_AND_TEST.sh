#!/bin/bash

set -e

echo "📥 Pulling latest code from Bitbucket..."
cd /opt/wolf-group-data-validator
git pull origin main

echo "✅ Code updated!"
echo ""

echo "🔧 Fixing psycopg and rebuilding API container..."

# Verify requirements.txt has the fix
echo "📋 Checking requirements.txt:"
grep psycopg backend/requirements.txt

# Remove old API image to force full rebuild
echo "🔨 Removing old API image..."
docker rmi wolf-group-data-validator-api2 -f 2>/dev/null || true

# Clean rebuild
echo "🔨 Rebuilding API container (this takes 2-3 minutes)..."
docker compose build --no-cache api2

# Stop and restart
echo "🔄 Restarting API container..."
docker compose down api2 2>/dev/null || true
docker compose up -d api2

# Wait for startup
echo "⏳ Waiting 30 seconds for API to start..."
sleep 30

# Check status
echo "📊 Container status:"
docker compose ps api2

# Wait a bit more if still restarting
for i in {1..5}; do
  STATUS=$(docker compose ps api2 --format "{{.State}}")
  if [[ "$STATUS" == "Up"* ]]; then
    echo "✅ API is UP!"
    break
  fi
  if [ $i -lt 5 ]; then
    echo "⏳ Still starting... ($i/5)"
    sleep 10
  fi
done

# Test API
echo "🧪 Testing API endpoint..."
RESPONSE=$(curl -s http://localhost:8003/api/validation/single \
  -X POST -H 'Content-Type: application/json' \
  -d '{"email":"test@gmail.com"}' 2>/dev/null || echo '{"error":"API not responding"}')

echo "Response: $RESPONSE"

# Check if psycopg is working
if echo "$RESPONSE" | grep -q "DELIVERABLE\|NOT_DELIVERABLE\|UNKNOWN"; then
  echo "✅ API is working!"
else
  echo "❌ API still failing. Checking logs..."
  docker compose logs api2 | tail -50
fi

# Test port 443 connectivity to Volknode
echo ""
echo "🔌 Testing port 443 connectivity to Volknode (87.251.66.181)..."
timeout 5 nc -zv 87.251.66.181 443 && echo "✅ Port 443 WORKS!" || echo "❌ Still blocked on port 443"

echo ""
echo "✅ Setup complete! Ready to test SOCKS5 proxy."
