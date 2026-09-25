#!/bin/bash
# Wolf Group Data Validator - Oracle Deployment Fix
# Fixes psycopg module error and tests SOCKS5 connectivity

set -e

echo "=========================================="
echo "🚀 Wolf Group Data Validator - Oracle Fix"
echo "=========================================="
echo ""

# 1. Navigate to project
echo "📁 Step 1/9: Navigating to project directory..."
cd /opt/wolf-group-data-validator || { echo "❌ Directory not found!"; exit 1; }
echo "✅ In /opt/wolf-group-data-validator"
echo ""

# 2. Pull latest code
echo "📥 Step 2/9: Pulling latest code from Bitbucket..."
git pull origin main || { echo "❌ Git pull failed!"; exit 1; }
echo "✅ Code updated"
echo ""

# 3. Verify requirements.txt fix
echo "📋 Step 3/9: Verifying requirements.txt..."
if grep -q "psycopg\[binary\]" backend/requirements.txt; then
    echo "✅ psycopg[binary] found in requirements.txt"
else
    echo "⚠️  psycopg[binary] not found, adding it..."
    sed -i 's/psycopg2-binary/psycopg[binary]>=3.1.0/g' backend/requirements.txt
fi
echo ""

# 4. Remove old image
echo "🗑️  Step 4/9: Removing old API image..."
docker rmi wolf-group-data-validator-api2 -f 2>/dev/null || true
echo "✅ Old image removed"
echo ""

# 5. Rebuild with --no-cache
echo "🔨 Step 5/9: Rebuilding API container (takes 2-3 minutes)..."
docker compose build --no-cache api2 || { echo "❌ Build failed!"; exit 1; }
echo "✅ Build complete"
echo ""

# 6. Stop and restart
echo "🔄 Step 6/9: Restarting API container..."
docker compose down api2 2>/dev/null || true
docker compose up -d api2 || { echo "❌ Failed to start API!"; exit 1; }
echo "✅ API container restarted"
echo ""

# 7. Wait for startup
echo "⏳ Step 7/9: Waiting 30 seconds for API to start..."
sleep 30
echo "✅ Wait complete"
echo ""

# 8. Check status
echo "📊 Step 8/9: Checking container status..."
docker compose ps api2
echo ""

# Check if container is actually running
STATUS=$(docker compose ps api2 --format "{{.State}}" 2>/dev/null || echo "unknown")
if [[ "$STATUS" == "running" ]] || [[ "$STATUS" == *"Up"* ]]; then
    echo "✅ API container is UP!"
else
    echo "⚠️  API container status: $STATUS"
    echo "Checking logs for errors..."
    docker compose logs api2 | tail -30
fi
echo ""

# 9. Test API
echo "🧪 Step 9/9: Testing API endpoint..."
RESPONSE=$(curl -s http://localhost:8003/api/validation/single \
  -X POST -H 'Content-Type: application/json' \
  -d '{"email":"test@gmail.com"}' 2>/dev/null || echo '{"error":"API not responding"}')

echo "API Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

# Verify API is working
if echo "$RESPONSE" | grep -q "DELIVERABLE\|NOT_DELIVERABLE\|UNKNOWN"; then
    echo "✅ API is working correctly!"
else
    echo "❌ API still failing!"
    echo "Checking recent logs..."
    docker compose logs api2 | tail -50
    exit 1
fi
echo ""

# Test port 443 connectivity
echo "=========================================="
echo "🔌 Testing Volknode SOCKS5 Connectivity"
echo "=========================================="
echo ""
echo "Testing connection to 87.251.66.181:443..."
if timeout 5 nc -zv 87.251.66.181 443 2>&1; then
    echo ""
    echo "✅ Port 443 WORKS! SOCKS5 proxy is reachable!"
else
    echo ""
    echo "❌ Port 443 is BLOCKED!"
    echo ""
    echo "⚠️  You need to add OCI egress rule:"
    echo "   Destination CIDR: 87.251.66.181/32"
    echo "   Port: 443"
    echo "   Protocol: TCP"
    echo "   Action: ALLOW"
fi
echo ""

# Final summary
echo "=========================================="
echo "📊 Deployment Summary"
echo "=========================================="
echo "✅ psycopg driver fixed"
echo "✅ API container rebuilt"
echo "✅ API endpoint responding"
if timeout 5 nc -zv 87.251.66.181 443 2>&1 >/dev/null; then
    echo "✅ Volknode SOCKS5 connectivity working"
    echo ""
    echo "🎉 READY FOR PRODUCTION!"
    echo ""
    echo "Test with real SMTP validation:"
    echo "curl -s http://localhost:8003/api/validation/single \\"
    echo "  -X POST -H 'Content-Type: application/json' \\"
    echo "  -d '{\"email\":\"support@github.com\"}' | jq ."
else
    echo "⚠️  Volknode connectivity blocked (add OCI rule)"
    echo ""
    echo "After adding OCI egress rule, test with:"
    echo "timeout 5 nc -zv 87.251.66.181 443"
fi
echo ""
echo "=========================================="
