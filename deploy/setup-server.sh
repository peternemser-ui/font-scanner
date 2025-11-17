#!/bin/bash

#############################################################################
# Font Scanner - DigitalOcean Server Setup Script
#
# This script sets up a fresh Ubuntu droplet for Font Scanner deployment
# Run as root or with sudo
#############################################################################

set -e  # Exit on error

echo "========================================="
echo "Font Scanner - Server Setup"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

echo -e "${GREEN}Step 1: Update system packages${NC}"
apt update && apt upgrade -y

echo ""
echo -e "${GREEN}Step 2: Install Node.js 18.x LTS${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

echo ""
echo -e "${GREEN}Step 3: Install build essentials and dependencies${NC}"
apt install -y build-essential git nginx certbot python3-certbot-nginx ufw

echo ""
echo -e "${GREEN}Step 4: Install PM2 process manager${NC}"
npm install -g pm2

echo ""
echo -e "${GREEN}Step 5: Install Chromium dependencies for Puppeteer${NC}"
apt install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils

echo ""
echo -e "${GREEN}Step 6: Configure firewall${NC}"
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw allow 80/tcp
ufw allow 443/tcp

echo ""
echo -e "${GREEN}Step 7: Create deployment user${NC}"
if id "fontscanner" &>/dev/null; then
    echo "User 'fontscanner' already exists"
else
    useradd -m -s /bin/bash fontscanner
    usermod -aG sudo fontscanner
    echo "User 'fontscanner' created"
fi

echo ""
echo -e "${GREEN}Step 8: Create application directory${NC}"
mkdir -p /var/www/fontscanner
chown -R fontscanner:fontscanner /var/www/fontscanner

echo ""
echo -e "${GREEN}Step 9: Configure swap (for better performance)${NC}"
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
    echo "2GB swap created"
else
    echo "Swap already exists"
fi

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Server setup complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Set password for fontscanner user: passwd fontscanner"
echo "2. Switch to fontscanner user: su - fontscanner"
echo "3. Clone your repository"
echo "4. Run deploy-app.sh script"
echo ""
echo -e "${YELLOW}System Information:${NC}"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "PM2 installed: $(pm2 --version)"
echo "Nginx installed: $(nginx -v 2>&1)"
echo ""
