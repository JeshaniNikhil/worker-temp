#!/bin/bash
# Deploy Frontend + Database on Oracle

set -e

echo "=========================================="
echo "🚀 Oracle Frontend + Database Deployment"
echo "=========================================="
echo ""

# Configuration
DEPLOY_DIR="/opt/wolf-validator-frontend"
REPO_URL="https://github.com/JeshaniNikhil/worker-temp.git"
BRANCH="main"

# Install prerequisites
echo "📦 Step 1/7: Installing prerequisites..."
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

if ! command -v git &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y git
fi

echo "✅ Prerequisites installed"
echo ""

# Clone or update repository
echo "📥 Step 2/7: Cloning/updating repository..."
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

# Copy docker-compose and nginx config
echo "📋 Step 3/7: Setting up configuration..."
cp deployment/oracle/docker-compose.oracle.yml docker-compose.yml
mkdir -p deployment/oracle
cp deployment/oracle/nginx.conf deployment/oracle/nginx.conf

echo "✅ Configuration ready"
echo ""

# Stop existing containers
echo "🛑 Step 4/7: Stopping existing containers..."
docker compose down 2>/dev/null || true

echo "✅ Containers stopped"
echo ""

# Build images
echo "🔨 Step 5/7: Building Docker images..."
docker compose build --no-cache

echo "✅ Build complete"
echo ""

# Start services
echo "🚀 Step 6/7: Starting services..."
docker compose up -d

echo "✅ Services started"
echo ""

# Wait and verify
echo "⏳ Step 7/7: Verifying services..."
sleep 15

echo "📊 Container status:"
docker compose ps

echo ""
echo "🧪 Testing database connection from Volknode..."
echo "Run this on Volknode to test:"
echo "psql postgresql://wolfuser:wolfpass123@92.4.73.23:5432/emailplatform -c 'SELECT version();'"

echo ""
echo "=========================================="
echo "✅ Oracle Frontend + DB Deployed!"
echo "=========================================="
echo ""
echo "Services running:"
echo "- Database: 92.4.73.23:5432"
echo "- Frontend: https://data-validator.wolfgroupindia.com"
echo ""
echo "Next steps:"
echo "1. Deploy backend on Volknode"
echo "2. Update frontend .env to point to Volknode API"
echo "3. Test full flow"
echo ""
