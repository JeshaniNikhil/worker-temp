#!/bin/bash
# Complete Volknode Backend Setup & Test
# Deploy API, Worker, Redis and test SMTP validation

set -e

echo "=========================================="
echo "🚀 Volknode Backend Setup"
echo "=========================================="
echo ""

# Step 1: Clone repository
echo "📥 Step 1/7: Cloning repository..."
cd /opt
rm -rf wolf-validator-backend 2>/dev/null || true
git clone -b main https://github.com/JeshaniNikhil/worker-temp.git wolf-validator-backend
cd wolf-validator-backend
echo "✅ Repository cloned"
echo ""

# Step 2: Copy docker-compose
echo "📋 Step 2/7: Setting up Docker Compose..."
cp deployment/volknode/docker-compose.volknode.yml docker-compose.yml
echo "✅ Docker Compose configured"
echo ""

# Step 3: Create .env file
echo "🔐 Step 3/7: Creating environment file..."
cat > .env <<'EOF'
DATABASE_URL=postgresql://wolfuser:wolfpass123@92.4.73.23:5432/emailplatform
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=wolf-validator-secret-key-2024-production
SMTP_VALIDATION_ENABLED=true
SMTP_TIMEOUT=30
ENV=production
EOF
echo "✅ Environment file created"
echo ""

# Step 4: Build images
echo "🔨 Step 4/7: Building Docker images (takes 2-3 minutes)..."
docker compose build --no-cache
echo "✅ Build complete"
echo ""

# Step 5: Start services
echo "🚀 Step 5/7: Starting services..."
docker compose up -d
echo "✅ Services started"
echo ""

# Step 6: Wait and check status
echo "⏳ Step 6/7: Waiting 20 seconds for services to start..."
sleep 20

echo "📊 Container status:"
docker compose ps
echo ""

# Step 7: Test API
echo "🧪 Step 7/7: Testing API endpoint..."
echo ""
echo "Testing: GET http://localhost:8003/"
curl -s http://localhost:8003/ || echo "API not ready yet"
echo ""
echo ""

# Test email validation
echo "Testing: POST http://localhost:8003/api/validation/single"
echo ""
RESPONSE=$(curl -s http://localhost:8003/api/validation/single \
  -X POST -H 'Content-Type: application/json' \
  -d '{"email":"test@gmail.com"}' 2>/dev/null || echo '{}')

echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if database is reachable
echo "🗄️  Testing database connection..."
if psql postgresql://wolfuser:wolfpass123@92.4.73.23:5432/emailplatform -c 'SELECT 1' >/dev/null 2>&1; then
    echo "✅ Database connection works!"
else
    echo "⚠️  Database not reachable yet (Oracle may not be running)"
fi
echo ""

# View logs if there are errors
if ! docker compose ps api --format "{{.State}}" | grep -q "Up"; then
    echo "⚠️  API container not running. Checking logs..."
    docker compose logs api | tail -30
fi

echo ""
echo "=========================================="
echo "✅ Volknode Backend Setup Complete!"
echo "=========================================="
echo ""
echo "Services running on Volknode (87.251.66.181):"
echo "- API: http://87.251.66.181:8003"
echo "- Redis: localhost:6379"
echo "- Worker: Background processing"
echo ""
echo "Test commands:"
echo ""
echo "1. Test API health:"
echo "   curl http://localhost:8003/"
echo ""
echo "2. Test email validation:"
echo "   curl -s http://localhost:8003/api/validation/single \\"
echo "     -X POST -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\":\"support@github.com\"}' | jq ."
echo ""
echo "3. View logs:"
echo "   cd /opt/wolf-validator-backend && docker compose logs -f api"
echo ""
echo "4. Stop services:"
echo "   cd /opt/wolf-validator-backend && docker compose down"
echo ""
