#!/bin/bash
# Volknode SOCKS5 Verification Script
# Run: bash verify_socks5.sh

echo "=========================================="
echo "  Volknode SOCKS5 - Full Verification"
echo "=========================================="
echo ""

echo "[1/5] SOCKS5 Service Status"
echo "============================"
systemctl status volknode-socks5 --no-pager | head -10
echo ""

echo "[2/5] SOCKS5 Port Check"
echo "======================="
netstat -tlnp | grep 443 || echo "⚠️  Port 443 not found"
echo ""

echo "[3/5] SOCKS5 Listening Address"
echo "=============================="
grep "LISTEN_PORT" /opt/volknode-socks5/socks5_server.py
echo ""

echo "[4/5] Port 25 Connectivity (SMTP)"
echo "=================================="
timeout 5 bash -c 'exec 3<>/dev/tcp/smtp.gmail.com/25 && echo "✅ Port 25 to Gmail works" || echo "❌ Port 25 blocked"'
echo ""

echo "[5/5] Recent SOCKS5 Logs"
echo "========================"
journalctl -u volknode-socks5 --no-pager -n 10
echo ""

echo "=========================================="
echo "  ✅ Volknode Ready!"
echo "=========================================="
echo ""
echo "SOCKS5 Server: 0.0.0.0:443"
echo "Username: smtpuser"
echo "Password: change_me_proxy_password"
echo ""
