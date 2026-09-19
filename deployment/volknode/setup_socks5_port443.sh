#!/bin/bash
# Volknode SOCKS5 Setup - Port 443 (HTTPS - always open)
# Run: bash setup_socks5_port443.sh

set -e

echo "=========================================="
echo "  Volknode SOCKS5 Port 443 Setup"
echo "=========================================="
echo ""

# Stop service
echo "[1/4] Stopping SOCKS5 service..."
systemctl stop volknode-socks5 2>/dev/null || true

# Update SOCKS5 server to use port 443
echo "[2/4] Updating SOCKS5 to use port 443..."
sed -i 's/LISTEN_PORT = 8080/LISTEN_PORT = 443/g' /opt/volknode-socks5/socks5_server.py

# Start service
echo "[3/4] Starting SOCKS5 service..."
systemctl start volknode-socks5

# Wait for startup
sleep 2

# Check status
echo "[4/4] Checking service status..."
systemctl status volknode-socks5 --no-pager | head -5

echo ""
echo "=========================================="
echo "  ✅ Setup Complete!"
echo "=========================================="
echo ""
echo "SOCKS5 now listening on: 0.0.0.0:443"
echo "Username: smtpuser"
echo "Password: change_me_proxy_password"
echo ""
echo "Check logs:"
echo "  journalctl -u volknode-socks5 -f"
echo ""

