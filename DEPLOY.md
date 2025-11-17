

# Font Scanner - DigitalOcean Deployment Guide

Complete step-by-step guide to deploy Font Scanner to DigitalOcean.

---

## 📋 Prerequisites

### What You Need

1. **DigitalOcean Droplet**
   - Minimum: 2GB RAM, 2 CPU cores, 50GB SSD
   - Recommended: 4GB RAM, 2 CPU cores, 80GB SSD
   - OS: Ubuntu 22.04 or 24.04 LTS

2. **Domain Name**
   - A registered domain (e.g., fontscanner.com)
   - Access to DNS management

3. **Local Machine**
   - Git installed
   - SSH client

4. **Information Needed**
   - Droplet IP address
   - Domain name
   - Email address (for SSL certificates)

---

## 🚀 Quick Start (5 Steps)

```bash
# 1. SSH into your droplet
ssh root@YOUR_DROPLET_IP

# 2. Run server setup
bash <(curl -s https://raw.githubusercontent.com/YOUR_REPO/main/deploy/setup-server.sh)

# 3. Clone repo and deploy
git clone YOUR_REPO_URL /var/www/fontscanner
cd /var/www/fontscanner
chmod +x deploy/*.sh
./deploy/deploy-app.sh

# 4. Configure Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/fontscanner
sudo sed -i 's/DOMAIN_NAME/your-domain.com/g' /etc/nginx/sites-available/fontscanner
sudo ln -s /etc/nginx/sites-available/fontscanner /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

# 5. Setup SSL
sudo ./deploy/setup-ssl.sh
```

---

## 📖 Detailed Step-by-Step Guide

### Step 1: Create and Access Droplet

1. **Create Droplet on DigitalOcean**
   - Go to: https://cloud.digitalocean.com/droplets/new
   - Choose Ubuntu 22.04 LTS
   - Select plan: Basic ($12/mo - 2GB RAM recommended minimum)
   - Choose datacenter region closest to your users
   - Add SSH key (recommended) or use password
   - Click "Create Droplet"

2. **Note Your Droplet IP**
   ```
   Example: 165.227.123.45
   ```

3. **SSH into Droplet**
   ```bash
   ssh root@165.227.123.45
   # Enter password or use SSH key
   ```

---

### Step 2: Configure DNS

**Before proceeding, set up your domain DNS:**

1. Go to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)

2. Add A records:
   ```
   Type: A
   Name: @
   Value: YOUR_DROPLET_IP
   TTL: 3600

   Type: A
   Name: www
   Value: YOUR_DROPLET_IP
   TTL: 3600
   ```

3. **Wait 5-30 minutes** for DNS propagation

4. **Verify DNS** (from your local machine):
   ```bash
   dig your-domain.com +short
   # Should return your droplet IP
   ```

---

### Step 3: Run Server Setup Script

On your droplet (as root):

```bash
# Download and run setup script
curl -o setup-server.sh https://raw.githubusercontent.com/YOUR_REPO/main/deploy/setup-server.sh
chmod +x setup-server.sh
./setup-server.sh
```

**What this does:**
- ✅ Updates system packages
- ✅ Installs Node.js 18.x LTS
- ✅ Installs Nginx web server
- ✅ Installs Certbot for SSL
- ✅ Installs PM2 process manager
- ✅ Installs Chromium dependencies for Puppeteer
- ✅ Configures firewall (UFW)
- ✅ Creates fontscanner user
- ✅ Creates application directory
- ✅ Sets up 2GB swap space

**Expected output:**
```
=========================================
Server setup complete!
=========================================

Next steps:
1. Set password for fontscanner user: passwd fontscanner
2. Switch to fontscanner user: su - fontscanner
3. Clone your repository
4. Run deploy-app.sh script
```

---

### Step 4: Deploy Application

#### Option A: Deploy from GitHub (Recommended)

```bash
# Still as root, create fontscanner user password
passwd fontscanner
# Enter new password twice

# Switch to fontscanner user
su - fontscanner

# Navigate to app directory
cd /var/www/fontscanner

# Clone your repository
git clone https://github.com/YOUR_USERNAME/font-scanner.git .

# Make scripts executable
chmod +x deploy/*.sh

# Run deployment script
./deploy/deploy-app.sh
```

#### Option B: Deploy from Local Files

From your **local machine**:

```bash
# Navigate to your project
cd f:\dev\font-scanner

# Upload to server (replace IP and update path if needed)
scp -r . fontscanner@YOUR_DROPLET_IP:/var/www/fontscanner/

# SSH into server
ssh fontscanner@YOUR_DROPLET_IP

# Navigate to app directory
cd /var/www/fontscanner

# Make scripts executable
chmod +x deploy/*.sh

# Run deployment
./deploy/deploy-app.sh
```

**What deploy-app.sh does:**
- ✅ Installs npm dependencies
- ✅ Downloads Puppeteer Chromium
- ✅ Creates production .env file
- ✅ Creates reports directory
- ✅ Starts app with PM2 (2 instances, cluster mode)
- ✅ Configures PM2 auto-startup

**Expected output:**
```
=========================================
Application deployment complete!
=========================================

Useful PM2 commands:
  pm2 status              - Check application status
  pm2 logs fontscanner    - View application logs
  pm2 restart fontscanner - Restart application
```

---

### Step 5: Configure Nginx Reverse Proxy

**Switch back to root** (or use sudo):

```bash
# Exit fontscanner user
exit

# Or prefix commands with sudo if not root
```

**Set up Nginx:**

```bash
# Copy Nginx config
cp /var/www/fontscanner/deploy/nginx.conf /etc/nginx/sites-available/fontscanner

# Replace DOMAIN_NAME with your actual domain
sed -i 's/DOMAIN_NAME/your-domain.com/g' /etc/nginx/sites-available/fontscanner

# Enable site
ln -s /etc/nginx/sites-available/fontscanner /etc/nginx/sites-enabled/

# Remove default site (optional)
rm -f /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# Restart Nginx
systemctl restart nginx
```

**Verify Nginx is running:**
```bash
systemctl status nginx
```

**Test your site:**
Visit `http://your-domain.com` in browser (should work now, but no HTTPS yet)

---

### Step 6: Set Up SSL with Let's Encrypt

**Important:** DNS must be pointing to your server before this step!

```bash
# Run SSL setup script
cd /var/www/fontscanner
./deploy/setup-ssl.sh

# Follow prompts:
# - Enter your domain (e.g., fontscanner.com)
# - Enter your email (for renewal notifications)
# - Confirm details
```

**What this does:**
- ✅ Verifies DNS is pointing to server
- ✅ Obtains SSL certificate from Let's Encrypt
- ✅ Configures Nginx for HTTPS
- ✅ Sets up automatic renewal (via systemd timer)
- ✅ Redirects HTTP → HTTPS

**Test SSL:**
```bash
# Test renewal process
certbot renew --dry-run

# Check certificate
certbot certificates

# Visit your site
# https://your-domain.com (should have lock icon 🔒)
```

---

### Step 7: Update Application URLs

**Critical:** Replace placeholder domain in your app

```bash
# Switch to fontscanner user
su - fontscanner
cd /var/www/fontscanner

# Replace fontscanner.app with your domain
find src/public -type f \( -name "*.html" -o -name "*.xml" -o -name "*.txt" \) -exec sed -i 's/fontscanner\.app/your-domain.com/g' {} +

# Restart app
pm2 restart fontscanner

# Exit fontscanner user
exit
```

**Files updated:**
- index.html
- dashboard.html
- seo-analyzer.html
- performance-analyzer.html
- accessibility-analyzer.html
- sitemap.xml
- robots.txt

---

### Step 8: Verify Deployment

**✅ Checklist:**

```bash
# 1. Check application is running
pm2 status
# Should show: fontscanner | online | 2 instances

# 2. Check logs for errors
pm2 logs fontscanner --lines 50 --nostream

# 3. Check Nginx
systemctl status nginx
# Should show: active (running)

# 4. Check firewall
sudo ufw status
# Should allow: 22/tcp, 80/tcp, 443/tcp, Nginx Full

# 5. Test HTTP redirect
curl -I http://your-domain.com
# Should show: 301 redirect to https://

# 6. Test HTTPS
curl -I https://your-domain.com
# Should show: 200 OK

# 7. Check SSL certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com < /dev/null 2>/dev/null | openssl x509 -noout -dates
# Should show valid dates

# 8. Test in browser
# Visit: https://your-domain.com
# - Should load without warnings
# - Lock icon should be present
# - Try analyzing a website
```

---

## 🔧 Post-Deployment Configuration

### 1. Update CORS in server.js

**IMPORTANT:** Fix CORS configuration (see PRODUCTION_READINESS.md)

On your server:

```bash
su - fontscanner
cd /var/www/fontscanner

# Edit src/server.js
nano src/server.js
# OR use vim if you prefer
```

**Find line 82-86:**
```javascript
cors({
  origin: config.nodeEnv === 'production' ? false : true, // ❌ WRONG!
})
```

**Replace with:**
```javascript
cors({
  origin: config.cors.origin, // ✅ CORRECT - uses CORS_ORIGIN from .env
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
})
```

**Save and restart:**
```bash
pm2 restart fontscanner
```

### 2. Create Visual Assets

Upload your favicon and Open Graph images:

```bash
# From your local machine, upload images:
scp favicon.ico fontscanner@YOUR_IP:/var/www/fontscanner/src/public/
scp favicon-*.png fontscanner@YOUR_IP:/var/www/fontscanner/src/public/
scp apple-touch-icon.png fontscanner@YOUR_IP:/var/www/fontscanner/src/public/
scp og-*.png fontscanner@YOUR_IP:/var/www/fontscanner/src/public/
scp twitter-image.png fontscanner@YOUR_IP:/var/www/fontscanner/src/public/
scp logo.png fontscanner@YOUR_IP:/var/www/fontscanner/src/public/
scp screenshot.png fontscanner@YOUR_IP:/var/www/fontscanner/src/public/
```

### 3. Submit to Search Engines

1. **Google Search Console**
   - Go to: https://search.google.com/search-console
   - Add property: your-domain.com
   - Verify ownership (DNS or HTML file method)
   - Submit sitemap: https://your-domain.com/sitemap.xml

2. **Bing Webmaster Tools**
   - Go to: https://www.bing.com/webmasters
   - Add site: your-domain.com
   - Import from Google Search Console (easier)
   - Submit sitemap: https://your-domain.com/sitemap.xml

### 4. Validate SEO & Schema

1. **Google Rich Results Test**
   - Visit: https://search.google.com/test/rich-results
   - Test URL: https://your-domain.com
   - Verify: WebApplication, FAQPage, BreadcrumbList schemas

2. **Schema Validator**
   - Visit: https://validator.schema.org/
   - Test each page
   - Verify no errors

3. **Social Media Cards**
   - Facebook: https://developers.facebook.com/tools/debug/
   - Twitter: https://cards-dev.twitter.com/validator
   - LinkedIn: https://www.linkedin.com/post-inspector/

### 5. Set Up Monitoring (Optional but Recommended)

#### Install monitoring tools:

```bash
# As root or with sudo
npm install -g pm2-logrotate

# Configure log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

#### Enable PM2 monitoring:

```bash
# Create free PM2.io account: https://app.pm2.io
pm2 link YOUR_SECRET_KEY YOUR_PUBLIC_KEY
```

---

## 📊 Monitoring & Maintenance

### Useful Commands

**Check Application Status:**
```bash
pm2 status                    # View all processes
pm2 show fontscanner          # Detailed info
pm2 monit                     # Real-time monitoring
```

**View Logs:**
```bash
pm2 logs fontscanner          # Live logs
pm2 logs fontscanner --lines 100  # Last 100 lines
pm2 logs fontscanner --err    # Only errors
```

**Restart/Stop:**
```bash
pm2 restart fontscanner       # Restart app
pm2 reload fontscanner        # Zero-downtime reload
pm2 stop fontscanner          # Stop app
pm2 delete fontscanner        # Remove from PM2
```

**System Resources:**
```bash
htop                          # Interactive process viewer
df -h                         # Disk usage
free -h                       # Memory usage
netstat -tlnp | grep 3000    # Check port 3000
```

**Nginx:**
```bash
systemctl status nginx        # Check status
nginx -t                      # Test configuration
systemctl restart nginx       # Restart Nginx
tail -f /var/log/nginx/fontscanner_access.log  # Access logs
tail -f /var/log/nginx/fontscanner_error.log   # Error logs
```

**SSL Certificates:**
```bash
certbot certificates          # List certificates
certbot renew                 # Manual renewal
certbot renew --dry-run       # Test renewal
systemctl status certbot.timer  # Auto-renewal status
```

### Updates & Maintenance

**Update Application Code:**

```bash
# SSH as fontscanner user
ssh fontscanner@YOUR_IP
cd /var/www/fontscanner

# Pull latest changes
git pull origin main

# Install any new dependencies
npm install --production

# Restart app
pm2 restart fontscanner

# Check logs
pm2 logs fontscanner --lines 50
```

**Update System Packages:**

```bash
# As root or with sudo
apt update
apt upgrade -y
apt autoremove -y

# Reboot if kernel updated
reboot
```

**Clean Up Old Reports:**

```bash
# Reports are auto-cleaned based on REPORTS_RETENTION_DAYS
# Manual cleanup if needed:
find /var/www/fontscanner/reports -type f -mtime +7 -delete
```

---

## 🐛 Troubleshooting

### Application Won't Start

**Check logs:**
```bash
pm2 logs fontscanner --lines 100
```

**Common issues:**

1. **Port 3000 in use:**
   ```bash
   netstat -tlnp | grep 3000
   kill <PID>
   pm2 restart fontscanner
   ```

2. **Missing dependencies:**
   ```bash
   cd /var/www/fontscanner
   npm install --production
   pm2 restart fontscanner
   ```

3. **Chromium not found:**
   ```bash
   node -e "require('puppeteer')"
   # Or reinstall
   npm rebuild puppeteer
   ```

### Nginx 502 Bad Gateway

**Check if app is running:**
```bash
pm2 status
# If offline, start it:
pm2 start fontscanner
```

**Check if port 3000 is listening:**
```bash
netstat -tlnp | grep 3000
# Should show: tcp ... 0.0.0.0:3000 ... LISTEN
```

**Check Nginx config:**
```bash
nginx -t
# Fix any errors shown
```

### SSL Certificate Issues

**Certificate not obtained:**
```bash
# Verify DNS points to server
dig +short your-domain.com

# Check firewall allows port 80
ufw status | grep 80

# Try again
certbot --nginx -d your-domain.com -d www.your-domain.com
```

**Certificate expired:**
```bash
# Manual renewal
certbot renew

# Check auto-renewal
systemctl status certbot.timer
systemctl list-timers | grep certbot
```

### High Memory Usage

**Check memory:**
```bash
free -h
htop
```

**Reduce browser pool:**
```bash
nano /var/www/fontscanner/.env
# Set: BROWSER_POOL_MAX=5 (instead of 10)

pm2 restart fontscanner
```

**Add more swap:**
```bash
# Create 4GB swap (if you have 2GB currently)
fallocate -l 4G /swapfile2
chmod 600 /swapfile2
mkswap /swapfile2
swapon /swapfile2
echo '/swapfile2 none swap sw 0 0' >> /etc/fstab
```

### Rate Limiting Too Aggressive

**Check current limits:**
```bash
cat /var/www/fontscanner/.env | grep RATE_LIMIT
```

**Adjust if needed:**
```bash
nano /var/www/fontscanner/.env
# Modify values as needed
# Then restart:
pm2 restart fontscanner
```

### Can't Access Site

**1. Check DNS:**
```bash
dig +short your-domain.com
# Should return your droplet IP
```

**2. Check firewall:**
```bash
ufw status
# Should allow: 80, 443, Nginx Full
```

**3. Check Nginx:**
```bash
systemctl status nginx
nginx -t
```

**4. Check application:**
```bash
pm2 status
curl http://localhost:3000
```

---

## 🔐 Security Best Practices

### Regular Updates

**Set up automatic security updates:**

```bash
# As root
apt install unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
```

### Firewall Configuration

**Verify firewall is active:**
```bash
ufw status verbose
```

**Only these ports should be open:**
- 22 (SSH)
- 80 (HTTP - for Let's Encrypt)
- 443 (HTTPS)

### SSH Hardening

**Disable password authentication (after setting up SSH keys):**

```bash
nano /etc/ssh/sshd_config

# Set these:
PasswordAuthentication no
PermitRootLogin prohibit-password
```

**Restart SSH:**
```bash
systemctl restart sshd
```

### Fail2Ban (Optional)

**Install Fail2Ban to prevent brute force:**

```bash
apt install fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

---

## 📈 Performance Optimization

### Enable Nginx Caching

Add to `/etc/nginx/sites-available/fontscanner`:

```nginx
# Add at top level (outside server blocks)
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=fontscanner_cache:10m max_size=1g inactive=60m;

# Then in location / block:
proxy_cache fontscanner_cache;
proxy_cache_valid 200 10m;
proxy_cache_bypass $http_cache_control;
add_header X-Cache-Status $upstream_cache_status;
```

**Create cache directory:**
```bash
mkdir -p /var/cache/nginx
chown www-data:www-data /var/cache/nginx
nginx -t && systemctl restart nginx
```

### Increase Open Files Limit

For high traffic:

```bash
# Edit limits.conf
nano /etc/security/limits.conf

# Add:
* soft nofile 65536
* hard nofile 65536
```

**Restart server:**
```bash
reboot
```

### Enable HTTP/2

Already enabled in nginx.conf if using SSL. Verify:

```bash
curl -I --http2 https://your-domain.com | grep HTTP
# Should show: HTTP/2 200
```

---

## 📞 Support & Resources

**Official Docs:**
- [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) - Pre-deployment checklist
- [SEO_GUIDE.md](SEO_GUIDE.md) - SEO implementation guide
- [README.md](README.md) - Application documentation

**External Resources:**
- DigitalOcean Tutorials: https://www.digitalocean.com/community/tutorials
- Let's Encrypt Docs: https://letsencrypt.org/docs/
- PM2 Documentation: https://pm2.keymetrics.io/docs/
- Nginx Documentation: https://nginx.org/en/docs/

**Testing Tools:**
- SSL Test: https://www.ssllabs.com/ssltest/
- Security Headers: https://securityheaders.com/
- Google PageSpeed: https://pagespeed.web.dev/
- GTmetrix: https://gtmetrix.com/

---

## ✅ Deployment Checklist

Use this checklist to ensure everything is set up:

- [ ] DigitalOcean droplet created (2GB+ RAM recommended)
- [ ] DNS A records configured (@ and www)
- [ ] DNS propagated (verified with `dig`)
- [ ] SSH access to droplet working
- [ ] Server setup script completed
- [ ] Application deployed with PM2
- [ ] PM2 auto-startup configured
- [ ] Nginx installed and configured
- [ ] Nginx config tested (`nginx -t`)
- [ ] Firewall configured (UFW)
- [ ] SSL certificate obtained
- [ ] HTTPS working (lock icon in browser)
- [ ] HTTP → HTTPS redirect working
- [ ] Application accessible at https://your-domain.com
- [ ] Can analyze a test website successfully
- [ ] CORS configuration fixed in server.js
- [ ] Domain URLs updated (replaced fontscanner.app)
- [ ] Visual assets uploaded (favicons, OG images)
- [ ] Sitemap submitted to Google Search Console
- [ ] Sitemap submitted to Bing Webmaster Tools
- [ ] Schema markup validated
- [ ] Social media cards tested
- [ ] PM2 logs show no errors
- [ ] Nginx access logs working
- [ ] SSL auto-renewal tested
- [ ] Monitoring set up (optional)
- [ ] Backups configured (optional)

---

**🎉 Congratulations!**

Your Font Scanner application should now be live and accessible at https://your-domain.com!

**Next Steps:**
1. Test all features thoroughly
2. Monitor logs for first 24 hours
3. Share your new site!

**Created:** 2025-11-17
