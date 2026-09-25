#!/bin/bash
# Comprehensive verification script for Oracle deployment
# Run: bash verify_all.sh

set -e

echo "=========================================="
echo "  Oracle Email Validator - Full Verification"
echo "=========================================="
echo ""

# 1. Docker Services Check
echo "[1/10] Docker Services Status"
echo "=============================="
docker compose ps
echo ""

# 2. API Health Check
echo "[2/10] API Health Check"
echo "========================"
curl -s http://localhost:8003/ 2>&1 | head -5 || echo "⚠️  API not responding on localhost"
echo ""

# 3. Database Check
echo "[3/10] Database Connectivity"
echo "============================="
docker compose exec -T db psql -U user -d emailplatform -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema='public';" 2>&1 | tail -3 || echo "❌ DB connection failed"
echo ""

# 4. Redis Check
echo "[4/10] Redis Connectivity"
echo "=========================="
docker compose exec -T redis redis-cli ping 2>&1 || echo "❌ Redis failed"
echo ""

# 5. Celery Worker Check
echo "[5/10] Celery Worker Status"
echo "============================"
docker compose logs worker --tail=5 | grep -E "Started|ready|ready|error" || echo "⚠️  Check worker logs manually"
echo ""

# 6. SOCKS5 Environment Variables
echo "[6/10] SOCKS5 Configuration"
echo "==========================="
echo "Host: $(grep 'SOCKS5_PROXY_HOST' docker-compose.yml | head -1 | awk '{print $NF}')"
echo "Port: $(grep 'SOCKS5_PROXY_PORT' docker-compose.yml | head -1 | awk '{print $NF}')"
echo "User: $(grep 'SOCKS5_PROXY_USER' docker-compose.yml | head -1 | awk '{print $NF}')"
echo ""

# 7. API Code Check
echo "[7/10] API SOCKS5 Code"
echo "======================"
if grep -q "check_email" backend/app/core/smtp_socks5.py; then
    echo "✅ check_email function exists"
else
    echo "❌ check_email function MISSING"
fi
if grep -q "SOCKS5_PROXY_HOST" backend/app/core/smtp_socks5.py; then
    echo "✅ SOCKS5 environment variables used"
else
    echo "❌ SOCKS5 env vars NOT used"
fi
echo ""

# 8. Test Single Email Validation
echo "[8/10] Test Single Email Validation"
echo "===================================="
RESULT=$(curl -s http://localhost:8003/api/validation/single \
  -X POST -H 'Content-Type: application/json' \
  -d '{"email":"test@gmail.com"}' 2>&1)
echo "$RESULT" | jq . || echo "Response: $RESULT"
echo ""

# 9. Network Connectivity to Volknode
echo "[9/10] Volknode Connectivity"
echo "============================="
echo "Ping Volknode (87.251.66.181):"
ping -c 3 87.251.66.181 2>&1 | tail -3
echo ""
echo "Port 443 status:"
timeout 2 nc -zv 87.251.66.181 443 2>&1 | grep -E "succeeded|refused|timed" || echo "Timeout (expected until OCI rule added)"
echo ""

# 10. Frontend Check
echo "[10/10] Frontend Status"
echo "======================="
curl -s http://localhost:8081/ | head -1 || echo "⚠️  Frontend not accessible"
echo ""

echo "=========================================="
echo "  ✅ Verification Complete!"
echo "=========================================="
echo ""
echo "Next Step:"
echo "----------"
echo "Add OCI Security List rule:"
echo "  Protocol: TCP"
echo "  Destination CIDR: 87.251.66.181/32"
echo "  Destination Port: 443"
echo "  Action: ALLOW"
echo ""
echo "Then test:"
echo "  curl -s -k https://data-validator.wolfgroupindia.com/api/validation/single \\"
echo "    -X POST -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"test@gmail.com\"}' | jq ."
echo ""
