#!/bin/bash
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true
systemctl stop volknode-socks5 2>/dev/null || true
systemctl disable volknode-socks5 2>/dev/null || true
rm -rf /opt/volknode-socks5 /opt/wolf-validator-backend /opt/wolf-group-data-validator
rm -f /etc/systemd/system/volknode-socks5.service
systemctl daemon-reload
docker system prune -af --volumes
echo "✅ Done!"
