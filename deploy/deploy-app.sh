#!/bin/bash

#############################################################################
# Font Scanner - Application Deployment Script
#
# Run this script as the fontscanner user (NOT root)
#############################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration - UPDATE THESE!
DOMAIN="fontscanner.app"  # Change to your domain
APP_DIR="/var/www/fontscanner"
GIT_REPO=""  # Add your git repo URL if using git

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}Font Scanner - Application Deployment${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Check if running as fontscanner user
if [ "$USER" != "fontscanner" ] && [ "$USER" != "root" ]; then
    echo -e "${YELLOW}Warning: You should run this as 'fontscanner' user${NC}"
    echo -e "${YELLOW}Current user: $USER${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}Step 1: Navigate to application directory${NC}"
cd "$APP_DIR"

echo ""
echo -e "${GREEN}Step 2: Install dependencies${NC}"
npm install --production

echo ""
echo -e "${GREEN}Step 3: Install Puppeteer Chromium${NC}"
# Puppeteer downloads Chromium on first install
node -e "require('puppeteer')" || npm rebuild puppeteer

echo ""
echo -e "${GREEN}Step 4: Create production environment file${NC}"
if [ ! -f .env ]; then
    cat > .env << EOF
# Production Environment Configuration
NODE_ENV=production
PORT=3000

# Rate Limiting - Production Values
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
SCAN_RATE_LIMIT_WINDOW_MS=900000
SCAN_RATE_LIMIT_MAX_REQUESTS=20
DOWNLOAD_RATE_LIMIT_WINDOW_MS=900000
DOWNLOAD_RATE_LIMIT_MAX_REQUESTS=50

# Security
CORS_ORIGIN=https://$DOMAIN

# Puppeteer
PUPPETEER_HEADLESS=true
PUPPETEER_TIMEOUT=30000

# Browser Pool
BROWSER_POOL_MIN=2
BROWSER_POOL_MAX=10
BROWSER_POOL_IDLE_TIMEOUT=300000
BROWSER_POOL_ACQUIRE_TIMEOUT=30000

# Lighthouse
LIGHTHOUSE_TIMEOUT_MS=120000
LIGHTHOUSE_MAX_WAIT_MS=90000
LIGHTHOUSE_RETRIES=3

# Reports
REPORTS_DIR=./reports
REPORTS_RETENTION_DAYS=7

# Logging
LOG_LEVEL=WARN

# Error Telemetry
ERROR_TELEMETRY_ENABLED=true
ERROR_TELEMETRY_THRESHOLD_MINUTE=10
ERROR_TELEMETRY_THRESHOLD_HOUR=100
ERROR_TELEMETRY_THRESHOLD_DAY=1000
EOF
    echo -e "${GREEN}.env file created${NC}"
else
    echo -e "${YELLOW}.env file already exists, skipping${NC}"
fi

echo ""
echo -e "${GREEN}Step 5: Create reports directory${NC}"
mkdir -p reports
chmod 755 reports

echo ""
echo -e "${GREEN}Step 6: Stop existing PM2 processes${NC}"
pm2 delete fontscanner 2>/dev/null || echo "No existing process to delete"

echo ""
echo -e "${GREEN}Step 7: Start application with PM2${NC}"
pm2 start src/server.js --name fontscanner \
    --instances 2 \
    --exec-mode cluster \
    --max-memory-restart 1G \
    --env production

echo ""
echo -e "${GREEN}Step 8: Configure PM2 startup${NC}"
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u fontscanner --hp /home/fontscanner

echo ""
echo -e "${GREEN}Step 9: Check application status${NC}"
pm2 status
pm2 logs fontscanner --lines 20 --nostream

echo ""
echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}Application deployment complete!${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""
echo -e "${YELLOW}Useful PM2 commands:${NC}"
echo "  pm2 status              - Check application status"
echo "  pm2 logs fontscanner    - View application logs"
echo "  pm2 restart fontscanner - Restart application"
echo "  pm2 stop fontscanner    - Stop application"
echo "  pm2 monit               - Monitor resources"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Configure Nginx reverse proxy (run as root)"
echo "2. Set up SSL with Let's Encrypt"
echo "3. Update DNS to point to this server"
echo ""
