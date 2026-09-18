#!/bin/bash
# Install SOCKS5 as a permanent systemd service on Volknode
# Run once: bash install_socks5_service.sh

echo "=========================================="
echo "  Installing SOCKS5 as System Service"
echo "=========================================="
echo ""

# Create service directory
mkdir -p /opt/volknode-socks5

# Copy SOCKS5 server script
cat > /opt/volknode-socks5/socks5_server.py << 'PYTHON_SOCKS5'
#!/usr/bin/env python3
import socket, struct, select, logging, sys, signal

logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s [SOCKS5] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/opt/volknode-socks5/socks5.log')
    ]
)
logger = logging.getLogger()

SOCKS_VERSION = 5
SOCKS5_USER = "smtpuser"
SOCKS5_PASS = "change_me_proxy_password"
LISTEN_PORT = 8080

def handle_client(c):
    client_ip = None
    try:
        # Get client IP
        client_ip = c.getpeername()[0]
        
        # Version + auth methods
        v, nm = struct.unpack('!BB', c.recv(2))
        c.recv(nm)
        c.send(struct.pack('!BB', SOCKS_VERSION, 2))
        
        # Auth
        v = struct.unpack('!B', c.recv(1))[0]
        ul = struct.unpack('!B', c.recv(1))[0]
        u = c.recv(ul).decode()
        pl = struct.unpack('!B', c.recv(1))[0]
        p = c.recv(pl).decode()
        
        if u == SOCKS5_USER and p == SOCKS5_PASS:
            c.send(struct.pack('!BB', v, 0))
            logger.info(f"✅ Auth OK: {u} from {client_ip}")
        else:
            c.send(struct.pack('!BB', v, 1))
            logger.warning(f"❌ Auth FAILED: {u} from {client_ip}")
            c.close()
            return
        
        # Connect request
        v, cmd, _, at = struct.unpack('!BBBB', c.recv(4))
        
        if at == 1:  # IPv4
            ip = '.'.join(map(str, struct.unpack('!BBBB', c.recv(4))))
            port = struct.unpack('!H', c.recv(2))[0]
        elif at == 3:  # Domain
            dl = struct.unpack('!B', c.recv(1))[0]
            ip = c.recv(dl).decode()
            port = struct.unpack('!H', c.recv(2))[0]
        else:
            c.close()
            return
        
        logger.info(f"🔗 CONNECT {ip}:{port} from {client_ip}")
        
        # Connect to target
        t = socket.socket()
        t.settimeout(15)
        t.connect((ip, port))
        
        # Send success
        c.send(struct.pack('!BBBBIH', SOCKS_VERSION, 0, 0, 1, 0, 0))
        
        # Relay data
        c.setblocking(False)
        t.setblocking(False)
        
        while True:
            r, _, x = select.select([c, t], [], [c, t], 1.0)
            if c in r:
                d = c.recv(4096)
                if d: 
                    t.send(d)
                else: 
                    break
            if t in r:
                d = t.recv(4096)
                if d: 
                    c.send(d)
                else: 
                    break
            if x:
                break
        
        logger.info(f"✅ Session closed: {ip}:{port}")
        t.close()
        c.close()
        
    except Exception as e:
        logger.error(f"❌ Error (client: {client_ip}): {e}")
        try:
            c.close()
        except:
            pass

def signal_handler(sig, frame):
    logger.info("Shutting down gracefully...")
    sys.exit(0)

# Main server
s = socket.socket()
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(('0.0.0.0', LISTEN_PORT))
s.listen(10)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

logger.info(f"🚀 SOCKS5 Server Started")
logger.info(f"   Listening: 0.0.0.0:{LISTEN_PORT}")
logger.info(f"   Username: {SOCKS5_USER}")
logger.info(f"   Log: /opt/volknode-socks5/socks5.log")

try:
    while True:
        try:
            c, a = s.accept()
            logger.info(f"📞 Connection from {a[0]}:{a[1]}")
            handle_client(c)
        except Exception as e:
            logger.error(f"Accept error: {e}")
            continue
except KeyboardInterrupt:
    pass
finally:
    logger.info("Server stopped")
    s.close()
PYTHON_SOCKS5

chmod +x /opt/volknode-socks5/socks5_server.py

# Create systemd service
cat > /etc/systemd/system/volknode-socks5.service << 'SYSTEMD_SERVICE'
[Unit]
Description=Volknode SOCKS5 Proxy for SMTP
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/volknode-socks5
ExecStart=/usr/bin/python3 /opt/volknode-socks5/socks5_server.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SYSTEMD_SERVICE

echo "✅ Service file created"
echo ""

# Reload systemd
systemctl daemon-reload
echo "✅ Systemd reloaded"
echo ""

# Enable and start
systemctl enable volknode-socks5
echo "✅ Service enabled (starts on boot)"
echo ""

systemctl start volknode-socks5
echo "✅ Service started"
echo ""

# Allow port in firewall
ufw allow 8080 2>/dev/null
ufw allow out 25 2>/dev/null
echo "✅ Firewall configured"
echo ""

# Check status
echo "=========================================="
echo "  Service Status"
echo "=========================================="
systemctl status volknode-socks5 --no-pager
echo ""

echo "=========================================="
echo "  ✅ Installation Complete!"
echo "=========================================="
echo ""
echo "SOCKS5 Server: 87.251.66.181:8080"
echo "Username: smtpuser"
echo "Password: change_me_proxy_password"
echo ""
echo "Useful commands:"
echo "  systemctl status volknode-socks5    # Check status"
echo "  systemctl restart volknode-socks5   # Restart"
echo "  journalctl -u volknode-socks5 -f    # Watch logs"
echo "  tail -f /opt/volknode-socks5/socks5.log  # Watch file logs"
echo ""
