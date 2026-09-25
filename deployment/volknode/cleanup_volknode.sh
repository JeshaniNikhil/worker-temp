#!/bin/bash
# Complete cleanup script for Volknode server
# Removes old SOCKS5 proxy, old deployments, and Docker containers

set -e

echo "=========================================="
echo "🧹 Volknode Complete Cleanup"
echo "=========================================="
echo ""

# Stop and remove all Docker containers
echo "🛑 Step 1/6: Stopping all Docker containers..."
if command -v docker &> /dev/null; then
    docker stop $(docker ps -aq) 2>/dev/null || echo "No running containers"
    docker rm $(docker ps -aq) 2>/dev/null || echo "No containers to remove"
    echo "✅ All Docker containers stopped and removed"
else
    echo "⚠️  Docker not installed, skipping container cleanup"
fi
echo ""

# Remove Docker images (optional - uncomment if you want to remove images too)
# echo "🗑️  Removing Docker images..."
# docker rmi $(docker images -q) -f 2>/dev/null || echo "No images to remove"

# Stop and disable SOCKS5 service
echo "🛑 Step 2/6: Stopping SOCKS5 service..."
if systemctl is-active --quiet volknode-socks5 2>/dev/null; then
    sudo systemctl stop volknode-socks5
    sudo systemctl disable volknode-socks5
    echo "✅ SOCKS5 service stopped and disabled"
else
    echo "⚠️  SOCKS5 service not running"
fi
echo ""

# Remove SOCKS5 files
echo "🗑️  Step 3/6: Removing SOCKS5 files..."
if [ -d "/opt/volknode-socks5" ]; then
    sudo rm -rf /opt/volknode-socks5
    echo "✅ Removed /opt/volknode-socks5"
else
    echo "⚠️  /opt/volknode-socks5 not found"
fi

if [ -f "/etc/systemd/system/volknode-socks5.service" ]; then
    sudo rm -f /etc/systemd/system/volknode-socks5.service
    sudo systemctl daemon-reload
    echo "✅ Removed SOCKS5 systemd service"
else
    echo "⚠️  SOCKS5 service file not found"
fi
echo ""

# Remove old deployment directories
echo "🗑️  Step 4/6: Removing old deployment directories..."
OLD_DIRS=(
    "/opt/wolf-validator-backend"
    "/opt/wolf-group-data-validator"
    "/root/wolf-validator"
    "/home/*/wolf-validator*"
)

for dir in "${OLD_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        sudo rm -rf "$dir"
        echo "✅ Removed $dir"
    fi
done
echo ""

# Clean Docker system
echo "🧹 Step 5/6: Cleaning Docker system..."
if command -v docker &> /dev/null; then
    docker system prune -af --volumes 2>/dev/null || true
    echo "✅ Docker system cleaned (removed unused containers, networks, images, volumes)"
else
    echo "⚠️  Docker not installed, skipping Docker cleanup"
fi
echo ""

# Show disk space
echo "💾 Step 6/6: Checking disk space..."
df -h / | grep -E '^Filesystem|/$' || df -h /
echo ""

# Summary
echo "=========================================="
echo "✅ Volknode Cleanup Complete!"
echo "=========================================="
echo ""
echo "Removed:"
echo "- ✅ All Docker containers and volumes"
echo "- ✅ SOCKS5 proxy service and files"
echo "- ✅ Old deployment directories"
echo "- ✅ Unused Docker images and networks"
echo ""
echo "Server is now clean and ready for fresh deployment!"
echo ""
echo "Next steps:"
echo "1. Deploy backend: bash deployment/volknode/deploy_volknode.sh"
echo ""
