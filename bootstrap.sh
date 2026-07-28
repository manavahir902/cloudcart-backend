#!/bin/bash
# CloudCart Pro - EC2 bootstrap script
# This runs automatically once, the first time a new instance boots.
# It recreates everything we did manually in Phase 5 & 6 so that any new
# instance launched by the Auto Scaling Group is immediately ready to serve traffic.

set -e  # exit immediately if any command fails, instead of continuing silently broken

# ---- Update system ----
yum update -y

# ---- Install Node.js 20 LTS ----
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs git nginx

# ---- Install PM2 globally ----
npm install -g pm2

# ---- Pull the application code ----
# NOTE: replace this URL with YOUR actual GitHub repo from Phase 6
cd /home/ec2-user
git clone https://github.com/YOUR-USERNAME/cloudcart-backend.git
cd cloudcart-backend
npm install

# ---- Create .env file ----
# NOTE: In Phase 20 we move this to Secrets Manager instead of a plaintext
# file baked into the script. Fine for tonight, NOT fine for real production.
cat > .env << 'EOF'
PORT=3000
JWT_SECRET=some-long-random-string-you-make-up
EOF

# ---- Start app with PM2 ----
sudo -u ec2-user pm2 start server.js --name cloudcart-backend
sudo -u ec2-user pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user

# ---- Configure Nginx reverse proxy ----
cat > /etc/nginx/conf.d/cloudcart.conf << 'EOF'
server {
    listen 80;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

# Remove default nginx welcome page config to avoid conflicting server blocks
sed -i '0,/location \/ {/{/location \/ {/,/}/d}' /etc/nginx/nginx.conf 2>/dev/null || true

systemctl enable nginx
systemctl restart nginx
