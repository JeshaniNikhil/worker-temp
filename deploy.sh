#!/bin/bash
set -e

# Deployment script for Wolf Group Data Verifier
# Deploys fixed code to Oracle production server

echo "=========================================="
echo "Wolf Group Data Verifier - Deployment"
echo "=========================================="

# Configuration
REMOTE_USER="ubuntu"
REMOTE_HOST="92.4.73.23"
SSH_KEY="$HOME/Desktop/keys/ssh-key-2026-07-30.key"
REMOTE_PATH="/opt/wolf-group-data-validator"
LOCAL_PATH="."

echo "🔧 Testing SSH connection..."
ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$REMOTE_USER@$REMOTE_HOST" "echo 'SSH connection successful'"

echo ""
echo "📦 Syncing backend code to production..."
rsync -avz --progress \
  -e "ssh -i $SSH_KEY" \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='venv' \
  --exclude='emailplatform.db' \
  ./backend/ \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/backend/"

echo ""
echo "📦 Syncing frontend code to production..."
rsync -avz --progress \
  -e "ssh -i $SSH_KEY" \
  --exclude='node_modules' \
  --exclude='dist' \
  ./frontend/ \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/frontend/"

echo ""
echo "📦 Syncing docker-compose.yml..."
rsync -avz --progress \
  -e "ssh -i $SSH_KEY" \
  ./docker-compose.yml \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"

echo ""
echo "🔄 Restarting Docker containers on production..."
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'ENDSSH'
cd /opt/wolf-group-data-validator
echo "Stopping containers..."
docker compose down
echo "Building fresh images..."
docker compose build --no-cache
echo "Starting containers..."
docker compose up -d
echo "Waiting for services to start..."
sleep 10
echo "Container status:"
docker compose ps
echo ""
echo "Worker logs (last 30 lines):"
docker compose logs --tail=30 worker
ENDSSH

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔍 Verification steps:"
echo "1. Check frontend: http://92.4.73.23:8081"
echo "2. Check API: http://92.4.73.23:8003/docs"
echo "3. Monitor worker logs: ssh -i $SSH_KEY $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_PATH && docker compose logs -f worker'"
echo ""
echo "📝 Key fixes deployed:"
echo "  ✓ Fixed Celery worker.py - removed .get() call (DIRECT check_email() now)"
echo "  ✓ Added DELETE /api/validation/jobs/{job_id} endpoint"
echo "  ✓ Fixed pause/resume/terminate with proper auth handling"
echo "  ✓ Fixed auth checks to allow null user_id access"
echo ""
