#!/bin/bash
# Volknode Auto-Setup Script - Run this once!
# No Docker required - Pure Python setup

set -e

echo "=========================================="
echo "  Volknode SOCKS5 Auto Setup"
echo "=========================================="
echo ""

# Step 1: Navigate to project
echo "[STEP 1/4] Updating code from GitHub..."
cd /opt/wolf-group-data-validator
git fetch origin
git checkout main
git pull origin main

# Step 2: Make setup script executable
echo "[STEP 2/4] Preparing setup script..."
chmod +x deployment/volknode/setup_socks5.sh

# Step 3: Run SOCKS5 setup
echo "[STEP 3/4] Installing SOCKS5 proxy..."
bash deployment/volknode/setup_socks5.sh

# Step 4: Done
echo ""
echo "=========================================="
echo "  ✅ Setup Complete!"
echo "=========================================="
echo ""
echo "SOCKS5 Proxy is now running on port 1080"
echo ""
echo "Next steps on Oracle server:"
echo "  curl -s -k https://data-validator.wolfgroupindia.com/api/validation/single \\"
echo "    -X POST -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"test@gmail.com\"}'"
echo ""
echo "Monitor SOCKS5 logs:"
echo "  sudo journalctl -u volknode-socks5 -f"
echo ""
