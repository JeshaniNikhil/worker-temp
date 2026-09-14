# Volknode SOCKS5 SMTP Proxy Setup Instructions

## Current Location
You're at: `/root@173917:~/worker-temp#`

## Step 1: Navigate to Project Directory
```bash
cd /opt/wolf-group-data-validator
```

## Step 2: GIT PULL (Get Latest Code)
```bash
git pull origin main
```

This will update with:
- SOCKS5 proxy configuration
- Updated SMTP checker
- Docker compose files

## Step 3: Navigate to Deployment Folder
```bash
cd /opt/wolf-group-data-validator/deployment/volknode
```

## Step 4: Start SOCKS5 Proxy
```bash
docker compose up -d
```

This starts the SOCKS5 proxy container on port 1080.

## Step 5: Verify SOCKS5 is Running
```bash
docker ps | grep volknode-smtp-socks5
```

Should show:
```
volknode-smtp-socks5    serjs/socks5    ...    0.0.0.0:1080->1080/tcp
```

## Step 6: Test Connection from Oracle Server
(Run this from Oracle at 92.4.73.23)
```bash
curl -s -k https://data-validator.wolfgroupindia.com/api/validation/single \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"test@gmail.com"}'
```

Should now return valid status!

## Troubleshooting

### Check Volknode IP
```bash
curl -s ifconfig.me
# Should show: 87.251.66.181 (or your IP)
```

### Check SOCKS5 Logs
```bash
docker logs volknode-smtp-socks5
```

### Verify Port 1080 is Open
```bash
netstat -tlnp | grep 1080
# or
ss -tlnp | grep 1080
```

### Test SOCKS5 Proxy Manually
```bash
# From Oracle server, test if port 1080 is reachable
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/87.251.66.181/1080' && echo "✅ Port 1080 open" || echo "❌ Port 1080 blocked"
```

## Full Command Summary
```bash
# 1. Navigate
cd /opt/wolf-group-data-validator

# 2. Update code
git pull origin main

# 3. Go to deployment
cd deployment/volknode

# 4. Start SOCKS5
docker compose up -d

# 5. Verify
docker ps | grep volknode-smtp-socks5
```

Done! The SOCKS5 proxy will be running on `87.251.66.181:1080`
