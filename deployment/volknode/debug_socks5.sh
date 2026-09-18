#!/bin/bash
# Debug SOCKS5 connection issues
# Run this on Volknode while Oracle tries to connect

echo "=========================================="
echo "  SOCKS5 Debug Monitor"
echo "=========================================="
echo ""

echo "[1] Checking if SOCKS5 is running..."
SOCKS5_PID=$(ps aux | grep "socks5_server.py" | grep -v grep | awk '{print $2}')
if [ -z "$SOCKS5_PID" ]; then
    echo "❌ SOCKS5 not running!"
    echo ""
    echo "Start it with:"
    echo "  cd /opt/worker-temp && bash deployment/volknode/run_me.sh"
    exit 1
else
    echo "✅ SOCKS5 running (PID: $SOCKS5_PID)"
fi
echo ""

echo "[2] Checking port 8080..."
sudo netstat -tlnp | grep 8080
if [ $? -eq 0 ]; then
    echo "✅ Port 8080 listening"
else
    echo "❌ Port 8080 NOT listening!"
fi
echo ""

echo "[3] Checking UFW firewall..."
sudo ufw status numbered | grep 8080
if [ $? -eq 0 ]; then
    echo "✅ Port 8080 allowed in firewall"
else
    echo "⚠️  Port 8080 not in firewall rules"
    echo "Adding rule..."
    sudo ufw allow 8080
fi
echo ""

echo "[4] Testing from Oracle server..."
echo "Run this command on Oracle:"
echo ""
echo "  curl -v --socks5 87.251.66.181:8080 --socks5-user smtpuser:change_me_proxy_password http://google.com"
echo ""
echo "=========================================="
echo "  Watching SOCKS5 logs (CTRL+C to stop)"
echo "=========================================="
echo ""
echo "Logs should show:"
echo "  [SOCKS5] Connection from <IP>"
echo "  [SOCKS5] Auth OK: smtpuser"
echo "  [SOCKS5] CONNECT <host>:25"
echo ""
echo "If no logs appear, Oracle can't reach this server!"
echo ""

# Tail the log or follow process
tail -f /opt/volknode-socks5/socks5.log 2>/dev/null || {
    echo "No log file, following process output..."
    echo "(SOCKS5 logs appear in the terminal where run_me.sh is running)"
}
