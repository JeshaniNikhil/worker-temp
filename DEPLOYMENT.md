# 🚀 Contabo VPS Deployment Guide

## Prerequisites
- Contabo VPS with Ubuntu 22.04 or 24.04
- Additional static IP: `169.58.234.98` ordered and attached
- Port 25 unblocked by Contabo (open a support ticket if not done yet)
- Reverse DNS (PTR) set in Contabo panel
- Domain name (for nginx + SSL)

---

## Step 1: Initial Server Setup

```bash
# SSH into your VPS
ssh root@YOUR_MAIN_VPS_IP

# Update system
apt update && apt upgrade -y

# Install required tools
apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx git curl
systemctl enable docker && systemctl start docker
```

---

## Step 2: Configure Your Additional Static IP (169.58.234.98)

Contabo assigns the second IP. Make sure it's visible:
```bash
ip addr show
```

You should see `169.58.234.98` listed. If not, check Contabo control panel → IP Management.

Set the **Reverse PTR record** in the Contabo control panel:
- Go to: Customer Control Panel → Server Management → Reverse DNS
- Set: `169.58.234.98` → `mail.yourdomain.com` (use your own domain)

---

## Step 3: Clone the Project

```bash
cd /opt
git clone https://github.com/YOUR_REPO/ai-email-content-maker.git
cd ai-email-content-maker
```

---

## Step 4: Create Environment Configuration

```bash
# Create the .env file for Docker Compose
cat > .env << 'EOF'
# SMTP source IP — use your additional static Contabo IP
SMTP_SOURCE_IP=169.58.234.98

# Database
DATABASE_URL=sqlite:///./emailplatform.db

# Redis (Celery broker)
REDIS_URL=redis://redis:6379/0
EOF
```

---

## Step 5: Create/Update docker-compose.yml

Make sure your `docker-compose.yml` includes the env file and exposes port 25:

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    env_file: .env
    environment:
      - SMTP_SOURCE_IP=${SMTP_SOURCE_IP}
    ports:
      - "8000:8000"
    depends_on:
      - redis
    restart: always

  celery:
    build: ./backend
    command: celery -A app.celery_app worker --loglevel=info --concurrency=4
    env_file: .env
    environment:
      - SMTP_SOURCE_IP=${SMTP_SOURCE_IP}
    depends_on:
      - redis
    restart: always

  redis:
    image: redis:7-alpine
    restart: always

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    restart: always
```

---

## Step 6: Build and Start

```bash
docker compose up -d --build
```

Verify all containers are running:
```bash
docker compose ps
docker compose logs -f backend
```

---

## Step 7: Test SMTP from the VPS

Verify port 25 works from your VPS with the static IP:
```bash
# Test connecting to Gmail MX
nc -vz gmail-smtp-in.l.google.com 25

# Test that your outbound IP is correct
python3 -c "
import smtplib, socket
s = smtplib.SMTP(timeout=10)
s.source_address = ('169.58.234.98', 0)
s.connect('gmail-smtp-in.l.google.com', 25)
print('Connected! Banner:', s.getwelcome())
s.quit()
"
```

---

## Step 8: Nginx Reverse Proxy + SSL

```bash
# Create Nginx config
cat > /etc/nginx/sites-available/emailvalidator << 'EOF'
server {
    server_name yourdomain.com;

    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120s;
    }

    location / {
        proxy_pass http://localhost:3000/;
        proxy_set_header Host $host;
    }
}
EOF

ln -s /etc/nginx/sites-available/emailvalidator /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Install SSL certificate (free Let's Encrypt)
certbot --nginx -d yourdomain.com
```

---

## Step 9: Test the Full Validation

```bash
# Run a quick Python test from inside the container
docker compose exec backend python3 -c "
import os
os.environ['SMTP_SOURCE_IP'] = '169.58.234.98'
from app.core.email_checker import check_email
print('Gmail valid:',    check_email('nikhiljeshani9@gmail.com'))
print('Gmail invalid:',  check_email('notreal99999@gmail.com'))
print('Catch-all domain:', check_email('info@wolfgroupindia.com'))
"
```

Expected results:
- `nikhiljeshani9@gmail.com` → `('DELIVERABLE', ...)`
- `notreal99999@gmail.com` → `('NOT DELIVERABLE', ...)`
- `info@wolfgroupindia.com` → `('RISKY', 'Catch-All domain...')`

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 25 still blocked | Open Contabo support ticket: "Please unblock outbound port 25 for email verification on IP 169.58.234.98" |
| IP not binding | Check `ip addr show` — ensure 169.58.234.98 is assigned on `eth0` or `ens3` |
| SMTP timeout to Microsoft/Yahoo | These providers are stricter. The PTR record + established reputation IP helps. May take 24-48hrs. |
| 550 Auth errors from Google | Your PTR/HELO hostname must match. Set `HELO_HOST=mail.yourdomain.com` in `.env` |
