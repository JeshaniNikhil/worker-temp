#!/bin/bash
# Volknode Auto-Setup Script - Run this once!
# No Docker required - Pure Python setup
# Works with /opt/worker-temp/ path

set -e

echo "=========================================="
echo "  Volknode SOCKS5 Auto Setup"
echo "=========================================="
echo ""

# Detect if we're in worker-temp or wolf-group-data-validator
if [ -d "/opt/worker-temp" ]; then
    PROJECT_PATH="/opt/worker-temp"
    echo "✓ Found /opt/worker-temp"
elif [ -d "/opt/wolf-group-data-validator" ]; then
    PROJECT_PATH="/opt/wolf-group-data-validator"
    echo "✓ Found /opt/wolf-group-data-validator"
else
    echo "❌ Neither /opt/worker-temp nor /opt/wolf-group-data-validator found"
    exit 1
fi

cd "$PROJECT_PATH"

# Step 1: Install Python dependencies
echo "[STEP 1/3] Installing Python dependencies..."
pip3 install -q pysocks dnspython 2>/dev/null || pip install -q pysocks dnspython

# Step 2: Create SOCKS5 directory and Python script
echo "[STEP 2/3] Creating SOCKS5 server..."
mkdir -p /opt/volknode-socks5

cat > /opt/volknode-socks5/socks5_server.py << 'PYTHON_SOCKS5'
#!/usr/bin/env python3
import socket, struct, select, logging, sys
logging.basicConfig(level=logging.INFO, format='[SOCKS5] %(message)s')
logger = logging.getLogger()

SOCKS_VERSION = 5
SOCKS5_USER = "smtpuser"
SOCKS5_PASS = "change_me_proxy_password"

def handle_client(c):
    try:
        v, nm = struct.unpack('!BB', c.recv(2))
        c.recv(nm)
        c.send(struct.pack('!BB', SOCKS_VERSION, 2))
        v = struct.unpack('!B', c.recv(1))[0]
        ul = struct.unpack('!B', c.recv(1))[0]
        u = c.recv(ul).decode()
        pl = struct.unpack('!B', c.recv(1))[0]
        p = c.recv(pl).decode()
        if u == SOCKS5_USER and p == SOCKS5_PASS:
            c.send(struct.pack('!BB', v, 0))
            logger.info(f"Auth OK: {u}")
        else:
            c.send(struct.pack('!BB', v, 1))
            c.close()
            return
        v, cmd, _, at = struct.unpack('!BBBB', c.recv(4))
        if at == 1:
            ip = '.'.join(map(str, struct.unpack('!BBBB', c.recv(4))))
            port = struct.unpack('!H', c.recv(2))[0]
        elif at == 3:
            dl = struct.unpack('!B', c.recv(1))[0]
            ip = c.recv(dl).decode()
            port = struct.unpack('!H', c.recv(2))[0]
        else:
            c.close()
            return
        logger.info(f"CONNECT {ip}:{port}")
        t = socket.socket()
        t.settimeout(10)
        t.connect((ip, port))
        c.send(struct.pack('!BBBBIH', SOCKS_VERSION, 0, 0, 1, 0, 0))
        c.setblocking(False)
        t.setblocking(False)
        while True:
            r, _, x = select.select([c, t], [], [c, t], 0.5)
            if c in r:
                d = c.recv(4096)
                if d: t.send(d)
                else: break
            if t in r:
                d = t.recv(4096)
                if d: c.send(d)
                else: break
        t.close()
        c.close()
    except Exception as e:
        logger.error(f"Error: {e}")
        try:
            c.close()
        except:
            pass

s = socket.socket()
s.setsockopt(1, 15, 1)
s.bind(('0.0.0.0', 1080))
s.listen(10)
logger.info("SOCKS5 listening on 0.0.0.0:1080")
logger.info("Username: smtpuser")
logger.info("Password: change_me_proxy_password")
try:
    while True:
        try:
            c, a = s.accept()
            logger.info(f"Connection from {a[0]}")
            handle_client(c)
        except Exception as e:
            logger.error(f"Accept error: {e}")
            continue
except KeyboardInterrupt:
    logger.info("Shutting down...")
    s.close()
    sys.exit(0)
PYTHON_SOCKS5

chmod +x /opt/volknode-socks5/socks5_server.py

# Step 3: Start SOCKS5 server
echo "[STEP 3/3] Starting SOCKS5 server..."
echo ""
echo "=========================================="
echo "  ✅ SOCKS5 Server Starting!"
echo "=========================================="
echo ""
echo "Port: 1080"
echo "Username: smtpuser"
echo "Password: change_me_proxy_password"
echo ""
echo "Now testing connection..."
echo ""

python3 /opt/volknode-socks5/socks5_server.py
