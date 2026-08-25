# Troubleshooting Nginx 504 Gateway Timeout in Mailcow

The 504 Gateway Timeout error occurs because Mailcow's Nginx is attempting to proxy requests to `http://169.58.131.43:8003` (the public IP) instead of routing them internally through the Docker network to `http://api2:8003`. 

Since `api2` is connected to the `mailcowdockerized_mailcow-network`, Nginx can and should resolve `api2` directly. By proxying to the public IP, the request leaves the internal network and is likely blocked by a firewall or dropped, causing the timeout.

Here is the exact step-by-step guide to fix this issue safely on your production server.

## Step 1: Locate the Incorrect Nginx Configuration

Run this command on your VPS to find which Mailcow Nginx configuration file contains the incorrect hardcoded IP:

```bash
grep -rn "169.58.131.43:8003" /opt/mailcow-dockerized/data/conf/nginx/
```

This will likely point to a custom site configuration file such as `/opt/mailcow-dockerized/data/conf/nginx/site.validator.custom` or `validator.wolfgroupindia.com.conf`.

## Step 2: Fix the Upstream URL

Edit the file identified in Step 1. Change the `proxy_pass` directive from the public IP to the internal Docker service name.

Change this:
```nginx
proxy_pass http://169.58.131.43:8003;
```

To this:
```nginx
proxy_pass http://api2:8003;
```

*Note: Mailcow custom configs (`site.*.custom` and `*.conf` in `data/conf/nginx/`) are safe to edit and will not be overwritten by Mailcow on restart.*

## Step 3: Verify Nginx Can Resolve `api2`

Before reloading Nginx, verify that the Nginx container can resolve and reach `api2` on the internal network:

```bash
docker exec -it mailcowdockerized-nginx-mailcow-1 curl -I http://api2:8003/
```
*You should receive a `HTTP/1.1 200 OK` response.*

## Step 4: Reload Mailcow Nginx

Once you have verified connectivity, reload the Nginx configuration. This applies the changes without downtime:

```bash
cd /opt/mailcow-dockerized
docker compose exec nginx-mailcow nginx -s reload
```

## Step 5: Verify Production Endpoints

Test the API endpoints through the public URL to ensure the 504 error is resolved:

```bash
curl -I https://validator.wolfgroupindia.com/api/validation/jobs?limit=5
```
*You should receive a `HTTP/2 200` response instead of a 504.*

## Step 6: Verify Docker Compose Networking (Optional / Sanity Check)

Ensure that your `/opt/email-validator/docker-compose.yml` is correctly configured so `api2` stays on the Mailcow network securely without exposing port 8003 to the public web.

It should look something like this:

```yaml
services:
  api2:
    build: ./backend
    command: uvicorn app.main:app --host 0.0.0.0 --port 8003
    # DO NOT use 'ports: - "8003:8003"' here, it exposes it publicly!
    networks:
      - mailcow-network
      - internal-network # for redis/db

  worker:
    # Worker configuration remains unchanged
    # It communicates with redis internally via redis://redis:6379/0

networks:
  mailcow-network:
    external:
      name: mailcowdockerized_mailcow-network
  internal-network:
    driver: bridge
```

If you make changes to the validator's `docker-compose.yml`, apply them by running:
```bash
cd /opt/email-validator
docker compose up -d
```

## Step 7: Check Logs if Issues Persist

If you still encounter 504 errors, check the Mailcow Nginx logs in real-time:
```bash
cd /opt/mailcow-dockerized
docker compose logs -f nginx-mailcow
```
