#!/bin/bash

#############################################################################
# Font Scanner - SSL Setup with Let's Encrypt
#
# Run as root after Nginx is configured and domain is pointing to server
#############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}SSL Certificate Setup (Let's Encrypt)${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Get domain from user
read -p "Enter your domain name (e.g., fontscanner.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Domain cannot be empty${NC}"
    exit 1
fi

read -p "Enter your email for SSL notifications: " EMAIL
if [ -z "$EMAIL" ]; then
    echo -e "${RED}Email cannot be empty${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Domain: $DOMAIN${NC}"
echo -e "${YELLOW}Email: $EMAIL${NC}"
echo ""
read -p "Is this correct? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled"
    exit 1
fi

echo ""
echo -e "${GREEN}Step 1: Checking DNS propagation${NC}"
echo "Verifying that $DOMAIN points to this server..."
SERVER_IP=$(curl -s ifconfig.me)
DOMAIN_IP=$(dig +short $DOMAIN | tail -n1)

echo "Server IP: $SERVER_IP"
echo "Domain resolves to: $DOMAIN_IP"

if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
    echo -e "${YELLOW}Warning: Domain does not point to this server yet${NC}"
    echo -e "${YELLOW}Update your DNS A record to point to: $SERVER_IP${NC}"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Please update DNS and try again"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}Step 2: Stop Certbot from using standalone mode${NC}"
# Ensure Nginx is running for webroot method
systemctl status nginx || systemctl start nginx

echo ""
echo -e "${GREEN}Step 3: Obtain SSL certificate${NC}"
certbot --nginx -d $DOMAIN -d www.$DOMAIN \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --redirect

echo ""
echo -e "${GREEN}Step 4: Test SSL renewal${NC}"
certbot renew --dry-run

echo ""
echo -e "${GREEN}Step 5: Set up auto-renewal${NC}"
# Certbot automatically sets up a systemd timer
systemctl status certbot.timer || systemctl enable certbot.timer

echo ""
echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}SSL setup complete!${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""
echo -e "${GREEN}Your site is now accessible at:${NC}"
echo -e "${GREEN}https://$DOMAIN${NC}"
echo -e "${GREEN}https://www.$DOMAIN${NC}"
echo ""
echo -e "${YELLOW}Certificate Details:${NC}"
certbot certificates -d $DOMAIN
echo ""
echo -e "${YELLOW}SSL will auto-renew. Check renewal status:${NC}"
echo "  certbot renew --dry-run"
echo "  systemctl status certbot.timer"
echo ""
