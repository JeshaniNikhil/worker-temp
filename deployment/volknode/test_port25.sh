#!/bin/bash
# Test if Volknode can use port 25 for SMTP
# Run this on Volknode VNC terminal

echo "=========================================="
echo "  Port 25 Connectivity Test"
echo "=========================================="
echo ""

echo "[1/5] Checking UFW firewall rules..."
sudo ufw allow out 25 2>/dev/null
sudo ufw status numbered | grep -E "25|Status"
echo ""

echo "[2/5] Testing telnet to Gmail SMTP..."
timeout 10 bash -c 'exec 3<>/dev/tcp/smtp.gmail.com/25 && echo "✅ Port 25 OPEN" || echo "❌ Port 25 BLOCKED"'
echo ""

echo "[3/5] Testing Python socket to Gmail..."
python3 << 'EOF'
import socket, sys
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(10)
    print("Connecting to smtp.gmail.com:25...")
    s.connect(('smtp.gmail.com', 25))
    banner = s.recv(1024).decode()
    print("✅ SUCCESS! Port 25 works!")
    print("Banner:", banner)
    s.close()
    sys.exit(0)
except socket.timeout:
    print("❌ TIMEOUT - Port 25 likely blocked by ISP")
    sys.exit(1)
except ConnectionRefusedError:
    print("❌ CONNECTION REFUSED - Firewall blocking")
    sys.exit(1)
except Exception as e:
    print(f"❌ FAILED: {type(e).__name__}: {e}")
    sys.exit(1)
EOF

PORT25_WORKS=$?
echo ""

echo "[4/5] Checking SOCKS5 server status..."
ps aux | grep "socks5_server.py" | grep -v grep || echo "⚠️  SOCKS5 not running"
sudo netstat -tlnp | grep 8080 || echo "⚠️  Port 8080 not listening"
echo ""

echo "[5/5] Testing SOCKS5 locally..."
if command -v curl &> /dev/null; then
    timeout 10 curl -s --socks5 127.0.0.1:8080 --socks5-user smtpuser:change_me_proxy_password http://google.com > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ SOCKS5 works locally"
    else
        echo "❌ SOCKS5 failed"
    fi
else
    echo "⚠️  curl not installed, skipping SOCKS5 test"
fi
echo ""

echo "=========================================="
echo "  SUMMARY"
echo "=========================================="
if [ $PORT25_WORKS -eq 0 ]; then
    echo "✅ Port 25: WORKING"
    echo "   Volknode can reach SMTP servers!"
    echo "   SOCKS5 proxy should work."
else
    echo "❌ Port 25: BLOCKED"
    echo "   Volknode ISP blocks outbound port 25"
    echo "   SOCKS5 won't help - use DNS validation instead"
fi
echo ""
