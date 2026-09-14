#!/bin/bash
# Simple SOCKS5 SMTP Proxy Setup for Volknode (No Docker Required)
# Low-resource setup: Pure Python SOCKS5 server

set -e

echo "=========================================="
echo "  Volknode SOCKS5 Proxy Setup"
echo "=========================================="
echo ""

# Go to project root
cd /opt/wolf-group-data-validator

echo "[1/5] Installing Python dependencies..."
pip3 install -q pysocks dnspython

echo "[2/5] Creating SOCKS5 proxy server..."
mkdir -p /opt/volknode-socks5

cat > /opt/volknode-socks5/socks5_server.py << 'PYTHON_SCRIPT'
#!/usr/bin/env python3
"""
Simple SOCKS5 proxy server for SMTP relay.
Lightweight, no external dependencies (uses built-in asyncio).
Port: 1080
"""
import socket
import struct
import sys
import logging

logging.basicConfig(level=logging.INFO, format='[SOCKS5] %(message)s')
logger = logging.getLogger()

SOCKS_VERSION = 5
SOCKS5_USER = "smtpuser"
SOCKS5_PASS = "change_me_proxy_password"

def handle_client(client_socket):
    """Handle SOCKS5 client connection."""
    try:
        # Receive greeting
        version, nmethods = struct.unpack('!BB', client_socket.recv(2))
        if version != SOCKS_VERSION:
            client_socket.close()
            return
        
        # Read auth methods
        methods = struct.unpack('!' + 'B' * nmethods, client_socket.recv(nmethods))
        
        # Send auth response (Username/Password)
        client_socket.send(struct.pack('!BB', SOCKS_VERSION, 2))
        
        # Receive auth credentials
        version = struct.unpack('!B', client_socket.recv(1))[0]
        username_len = struct.unpack('!B', client_socket.recv(1))[0]
        username = client_socket.recv(username_len).decode()
        password_len = struct.unpack('!B', client_socket.recv(1))[0]
        password = client_socket.recv(password_len).decode()
        
        # Verify credentials
        if username == SOCKS5_USER and password == SOCKS5_PASS:
            client_socket.send(struct.pack('!BB', version, 0))  # Success
            logger.info(f"Auth success for {username}")
        else:
            client_socket.send(struct.pack('!BB', version, 1))  # Fail
            client_socket.close()
            return
        
        # Receive CONNECT request
        version, cmd, _, addr_type = struct.unpack('!BBBB', client_socket.recv(4))
        
        if addr_type == 1:  # IPv4
            ip = '.'.join(map(str, struct.unpack('!BBBB', client_socket.recv(4))))
            port = struct.unpack('!H', client_socket.recv(2))[0]
        elif addr_type == 3:  # Domain
            domain_len = struct.unpack('!B', client_socket.recv(1))[0]
            ip = client_socket.recv(domain_len).decode()
            port = struct.unpack('!H', client_socket.recv(2))[0]
        else:
            client_socket.close()
            return
        
        logger.info(f"CONNECT to {ip}:{port}")
        
        # Connect to target
        target = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        target.connect((ip, port))
        
        # Send success response
        client_socket.send(struct.pack('!BBBBIH', SOCKS_VERSION, 0, 0, 1, 0, 0))
        
        # Relay data (simple)
        client_socket.setblocking(False)
        target.setblocking(False)
        
        import select
        while True:
            r, w, x = select.select([client_socket, target], [], [client_socket, target], 0.5)
            if client_socket in r:
                data = client_socket.recv(4096)
                if data:
                    target.send(data)
            if target in r:
                data = target.recv(4096)
                if data:
                    client_socket.send(data)
            if not r:
                break
        
        target.close()
        client_socket.close()
        
    except Exception as e:
        logger.error(f"Error: {e}")
        try:
            client_socket.close()
        except:
            pass

def run_server(port=1080):
    """Run SOCKS5 server."""
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('0.0.0.0', port))
    server.listen(5)
    logger.info(f"SOCKS5 server listening on port {port}")
    
    try:
        while True:
            client, addr = server.accept()
            logger.info(f"Connection from {addr[0]}:{addr[1]}")
            handle_client(client)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    finally:
        server.close()

if __name__ == '__main__':
    run_server(1080)
PYTHON_SCRIPT

chmod +x /opt/volknode-socks5/socks5_server.py

echo "[3/5] Creating systemd service..."
sudo tee /etc/systemd/system/volknode-socks5.service > /dev/null << 'SYSTEMD'
[Unit]
Description=Volknode SOCKS5 SMTP Proxy
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 /opt/volknode-socks5/socks5_server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SYSTEMD

echo "[4/5] Starting SOCKS5 service..."
sudo systemctl daemon-reload
sudo systemctl enable volknode-socks5
sudo systemctl restart volknode-socks5

echo "[5/5] Verifying..."
sleep 2
if sudo systemctl is-active --quiet volknode-socks5; then
    echo ""
    echo "✅ SOCKS5 proxy is running!"
    echo ""
    echo "Details:"
    echo "  - Host: 0.0.0.0"
    echo "  - Port: 1080"
    echo "  - Username: smtpuser"
    echo "  - Password: change_me_proxy_password"
    echo ""
    echo "Check logs with: sudo journalctl -u volknode-socks5 -f"
else
    echo "❌ Failed to start SOCKS5 service"
    sudo systemctl status volknode-socks5
fi
