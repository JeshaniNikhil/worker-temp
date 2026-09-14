#!/bin/bash
# Test script for production deployment

SERVER_IP="92.4.73.23"
API_BASE="http://${SERVER_IP}:8003"

echo "=========================================="
echo "Production Deployment Test"
echo "=========================================="

echo ""
echo "1. Testing API health..."
curl -s "${API_BASE}/docs" | head -20
echo ""

echo "2. Testing frontend..."
curl -s "http://${SERVER_IP}:8081/" | head -10
echo ""

echo "3. Checking worker status..."
ssh -i ~/Desktop/keys/ssh-key-2026-07-30.key ubuntu@${SERVER_IP} 'docker logs wolf-group-data-validator-worker-1 --tail 5'
echo ""

echo "4. Testing single email validation..."
curl -s -X POST "${API_BASE}/api/validation/single" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@gmail.com"}' | python3 -m json.tool
echo ""

echo "=========================================="
echo "✅ Production test complete!"
echo ""
echo "Next steps:"
echo "1. Open http://92.4.73.23:8081 in your browser"
echo "2. Upload a CSV file with emails"
echo "3. Verify no 'result.get()' errors appear"
echo "4. Test pause/resume/terminate/delete controls"
echo "=========================================="
