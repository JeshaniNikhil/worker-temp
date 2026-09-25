#!/bin/bash
# Deploy Backend (API + Worker + Redis) on Volknode

set -e

echo "=========================================="
echo "🚀 Volknode Backend Deployment"
echo "=========================================="
echo ""

# Configuration
DEPLOY_DIR="/opt/wolf-validator-backend"
REPO_URL="https://github.com/JeshaniNikhil/worker-temp.git"
BRANCH="main"

# Install prerequisites
echo "📦 Step 1/8: Installing prerequisites..."
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

if ! command -v docker compose &> /dev/null; then
    echo "Docker Compose not found!"
    exit 1
fi

if ! command -v git &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y git
fi

echo "✅ Prerequisites installed"
echo ""

# Clone or update repository
echo "📥 Step 2/8: Cloning/updating repository..."
if [ -d "$DEPLOY_DIR" ]; then
    cd "$DEPLOY_DIR"
    git fetch origin
    git reset --hard origin/$BRANCH
else
    sudo mkdir -p "$DEPLOY_DIR"
    sudo chown $USER:$USER "$DEPLOY_DIR"
    git clone -b $BRANCH "$REPO_URL" "$DEPLOY_DIR"
    cd "$DEPLOY_DIR"
fi

echo "✅ Repository ready"
echo ""

# Copy docker-compose file
echo "📋 Step 3/8: Setting up Docker Compose..."
cp deployment/volknode/docker-compose.volknode.yml docker-compose.yml

echo "✅ Docker Compose configured"
echo ""

# Create .env file if needed
echo "🔐 Step 4/8: Setting up environment..."
if [ ! -f ".env" ]; then
    cat > .env <<EOF
DATABASE_URL=postgresql://wolfuser:wolfpass123@92.4.73.23:5432/emailplatform
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=$(openssl rand -hex 32)
SMTP_VALIDATION_ENABLED=true
SMTP_TIMEOUT=30
ENV=production
EOF
fi

echo "✅ Environment configured"
echo ""

# Stop existing containers
echo "🛑 Step 5/8: Stopping existing containers..."
docker compose down 2>/dev/null || true

echo "✅ Containers stopped"
echo ""

# Build images
echo "🔨 Step 6/8: Building Docker images..."
docker compose build --no-cache

echo "✅ Build complete"
echo ""

# Start services
echo "🚀 Step 7/8: Starting services..."
docker compose up -d

echo "✅ Services started"
echo ""

# Wait and verify
echo "⏳ Step 8/8: Waiting for services to start..."
sleep 20

echo "📊 Container status:"
docker compose ps

echo ""
echo "🧪 Testing API endpoint..."
RESPONSE=$(curl -s http://localhost:8003/ 2>/dev/null || echo "API not responding")
echo "Response: $RESPONSE"

echo ""
echo "=========================================="
echo "✅ Volknode Backend Deployed!"
echo "=========================================="
echo ""
echo "Services running:"
echo "- API: http://87.251.66.181:8003"
echo "- Redis: localhost:6379"
echo "- Worker: Background processing"
echo ""
echo "Test API:"
echo "curl -s http://87.251.66.181:8003/api/validation/single \\"
echo "  -X POST -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"test@gmail.com\"}' | jq ."
echo ""
echo "View logs:"
echo "cd $DEPLOY_DIR && docker compose logs -f"
echo ""
