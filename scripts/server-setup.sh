#!/usr/bin/env bash
# Hetzner server setup for nightbeak.dev / nightbeak.com
# Run from your local machine: bash scripts/server-setup.sh
# Requires: SSH key at ~/.ssh/hetzner_deploy with access to root@178.104.48.184

set -euo pipefail

SERVER="root@178.104.48.184"
SSH="ssh -i ~/.ssh/hetzner_deploy -o StrictHostKeyChecking=accept-new"

echo "==> [1/11] System update + base tools"
$SSH $SERVER "apt update && DEBIAN_FRONTEND=noninteractive apt upgrade -y && apt install -y curl git ufw fail2ban"

echo "==> [2/11] Install Docker"
$SSH $SERVER "curl -fsSL https://get.docker.com | sh && systemctl enable docker && systemctl start docker"

echo "==> [3/11] Configure firewall"
$SSH $SERVER "
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow ssh
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
"

echo "==> [4/11] Create deploy user"
$SSH $SERVER "
  if ! id deploy &>/dev/null; then
    useradd -m -s /bin/bash deploy
  fi
  usermod -aG docker deploy
  mkdir -p /home/deploy/.ssh
  chmod 700 /home/deploy/.ssh
  touch /home/deploy/.ssh/authorized_keys
  chmod 600 /home/deploy/.ssh/authorized_keys
  chown -R deploy:deploy /home/deploy/.ssh
"

echo "==> [5/11] Generate deploy SSH keypair"
$SSH $SERVER "
  ssh-keygen -t ed25519 -C 'github-actions-nightbeak' -f /tmp/deploy_key -N ''
  cat /tmp/deploy_key.pub >> /home/deploy/.ssh/authorized_keys
  echo '--- PRIVATE KEY (add as GitHub Secret HETZNER_SSH_KEY) ---'
  cat /tmp/deploy_key
  echo '--- END PRIVATE KEY ---'
  rm /tmp/deploy_key /tmp/deploy_key.pub
"

echo "==> [6/11] Create directories"
$SSH $SERVER "
  mkdir -p /var/www/sanguo
  chown -R deploy:deploy /var/www/sanguo
  mkdir -p /root/nightbeak/nginx/conf.d
  mkdir -p /var/www/certbot
"

echo "==> [7/11] Write nginx HTTP config"
$SSH $SERVER "cat > /root/nightbeak/nginx/conf.d/nightbeak.conf << 'NGINXEOF'
server {
    listen 80;
    server_name nightbeak.dev www.nightbeak.dev nightbeak.com www.nightbeak.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        root /var/www/sanguo;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
}
NGINXEOF"

echo "==> [8/11] Write Docker Compose + start nginx"
$SSH $SERVER "cat > /root/nightbeak/docker-compose.yml << 'COMPOSEEOF'
services:
  nginx:
    image: nginx:alpine
    container_name: nightbeak-nginx
    ports:
      - \"80:80\"
      - \"443:443\"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - /var/www/sanguo:/var/www/sanguo:ro
      - /var/www/certbot:/var/www/certbot:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    restart: unless-stopped
COMPOSEEOF
cd /root/nightbeak && docker compose up -d && docker ps | grep nightbeak-nginx"

echo "==> [9/11] Issue SSL certificates (Certbot)"
$SSH $SERVER "
  apt install -y certbot
  certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d nightbeak.dev \
    -d www.nightbeak.dev \
    -d nightbeak.com \
    -d www.nightbeak.com \
    --email nicolas.coldewey@googlemail.com \
    --agree-tos \
    --non-interactive
"

echo "==> [10/11] Update nginx config to HTTPS + reload"
$SSH $SERVER "cat > /root/nightbeak/nginx/conf.d/nightbeak.conf << 'NGINXEOF'
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name nightbeak.dev www.nightbeak.dev nightbeak.com www.nightbeak.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://nightbeak.dev\$request_uri;
    }
}

# HTTPS main server
server {
    listen 443 ssl;
    server_name nightbeak.dev www.nightbeak.dev nightbeak.com www.nightbeak.com;

    ssl_certificate /etc/letsencrypt/live/nightbeak.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nightbeak.dev/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /var/www/sanguo;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|gif|ico|svg|woff2|tcg)$ {
        expires 1y;
        add_header Cache-Control \"public, immutable\";
    }
}
NGINXEOF
docker exec nightbeak-nginx nginx -s reload && echo 'nginx reloaded'"

echo "==> [11/11] Set up Certbot auto-renewal cron"
$SSH $SERVER "(crontab -l 2>/dev/null; echo '0 3 * * * certbot renew --quiet && docker exec nightbeak-nginx nginx -s reload') | crontab -"

echo ""
echo "======================================================"
echo "Server setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy the PRIVATE KEY printed above (between the --- markers)"
echo "2. Add GitHub Secrets in Wynillo/Echoes-of-Sanguo:"
echo "   HETZNER_HOST  = 178.104.48.184"
echo "   HETZNER_SSH_KEY = <the private key>"
echo "3. Push a tag to trigger deployment:"
echo "   git tag v0.1.0 -m 'Initial release'"
echo "   git push && git push --tags"
echo "======================================================"
