# 🚀 Font Scanner - Your Custom Deployment Guide

**Droplet IP:** 143.198.147.93
**Domain:** font-scanner.com
**Email:** peter@font-scanner.com
**Server:** 4GB RAM, 2 vCPUs, 80GB SSD, Ubuntu 24.04 LTS

---

## ⚡ Quick Deploy (Copy & Paste These Commands)

### Step 1: SSH into Your Droplet

```bash
ssh root@143.198.147.93
```

**First time?** You'll be asked to verify the host key - type `yes`

---

### Step 2: Run Server Setup (One Command)

```bash
curl -o setup-server.sh https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/font-scanner/main/deploy/setup-server.sh && chmod +x setup-server.sh && ./setup-server.sh
```

⏱️ **Takes ~5 minutes** - Installs Node.js, Nginx, PM2, Chromium dependencies, etc.

**When done:**
```bash
# Set password for fontscanner user
passwd fontscanner
# Enter a secure password twice

# Switch to fontscanner user
su - fontscanner
```

---

### Step 3: Clone Repository & Deploy

```bash
# Clone your repo
cd /var/www/fontscanner
git clone https://github.com/YOUR_GITHUB_USERNAME/font-scanner.git .

# Make scripts executable
chmod +x deploy/*.sh

# Run deployment
./deploy/deploy-app.sh
```

⏱️ **Takes ~3 minutes** - Installs dependencies, sets up PM2, starts app

---

### Step 4: Configure Nginx

```bash
# Exit fontscanner user (back to root)
exit

# Configure Nginx
cd /var/www/fontscanner
cp deploy/nginx.conf /etc/nginx/sites-available/fontscanner
sed -i 's/DOMAIN_NAME/font-scanner.com/g' /etc/nginx/sites-available/fontscanner
ln -s /etc/nginx/sites-available/fontscanner /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

⏱️ **Takes ~1 minute**

**Test:** Visit http://143.198.147.93 in browser (should work now, but no HTTPS yet)

---

### Step 5: Update DNS (Do This on Your Domain Registrar)

**Before SSL will work, configure DNS:**

Go to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.) and add:

```
Type: A
Name: @
Value: 143.198.147.93
TTL: 3600

Type: A
Name: www
Value: 143.198.147.93
TTL: 3600
```

**Wait 5-30 minutes for DNS to propagate**, then verify:

```bash
dig +short font-scanner.com
# Should return: 143.198.147.93
```

---

### Step 6: Set Up SSL (After DNS Propagates)

```bash
# On your droplet (as root)
cd /var/www/fontscanner
./deploy/setup-ssl.sh

# When prompted:
# Domain: font-scanner.com
# Email: peter@font-scanner.com
# Confirm: y
```

⏱️ **Takes ~2 minutes** - Obtains Let's Encrypt certificate, configures HTTPS

---

### Step 7: Update Application URLs

```bash
# Switch to fontscanner user
su - fontscanner
cd /var/www/fontscanner

# Replace placeholder domain with yours
find src/public -type f \( -name "*.html" -o -name "*.xml" -o -name "*.txt" \) -exec sed -i 's/fontscanner\.app/font-scanner.com/g' {} +

# Restart app
pm2 restart fontscanner

# Exit fontscanner user
exit
```

---

### Step 8: Fix CORS Configuration

```bash
# Edit server.js to fix CORS
su - fontscanner
cd /var/www/fontscanner
nano src/server.js
```

**Find line 82-86 and change:**

```javascript
// BEFORE:
cors({
  origin: config.nodeEnv === 'production' ? false : true,
})

// AFTER:
cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
})
```

**Save:** Ctrl+O, Enter, Ctrl+X

**Restart:**
```bash
pm2 restart fontscanner
exit
```

---

## ✅ Verification Checklist

```bash
# Check app is running
pm2 status
# Should show: fontscanner | online | 2 instances

# Check Nginx
systemctl status nginx
# Should show: active (running)

# Check SSL
curl -I https://font-scanner.com
# Should show: HTTP/2 200

# Check logs
pm2 logs fontscanner --lines 20 --nostream
```

**Test in browser:**
- Visit: https://font-scanner.com
- Should see Font Scanner with 🔒 lock icon
- Try analyzing a website (e.g., google.com)

---

## 🎉 Success!

Your Font Scanner is now live at:
- **https://font-scanner.com**
- **https://www.font-scanner.com**

---

## 📝 Post-Deployment Tasks

### 1. Submit Sitemap to Google

- Visit: https://search.google.com/search-console
- Add property: `font-scanner.com`
- Verify ownership
- Submit sitemap: `https://font-scanner.com/sitemap.xml`

### 2. Submit Sitemap to Bing

- Visit: https://www.bing.com/webmasters
- Import from Google Search Console
- Or manually add site

### 3. Validate Schema Markup

- Test: https://search.google.com/test/rich-results
- Enter: `https://font-scanner.com`
- Should show: WebApplication, FAQPage, BreadcrumbList schemas

### 4. Test Social Cards

- Facebook: https://developers.facebook.com/tools/debug/
- Twitter: https://cards-dev.twitter.com/validator
- Enter: `https://font-scanner.com`

### 5. Upload Visual Assets

From your local machine:

```bash
scp favicon.ico fontscanner@143.198.147.93:/var/www/fontscanner/src/public/
scp favicon-*.png fontscanner@143.198.147.93:/var/www/fontscanner/src/public/
scp apple-touch-icon.png fontscanner@143.198.147.93:/var/www/fontscanner/src/public/
scp og-*.png fontscanner@143.198.147.93:/var/www/fontscanner/src/public/
scp logo.png fontscanner@143.198.147.93:/var/www/fontscanner/src/public/
```

---

## 🔧 Useful Commands

**Application:**
```bash
pm2 status                    # Check status
pm2 logs fontscanner          # View logs
pm2 restart fontscanner       # Restart app
pm2 monit                     # Monitor resources
```

**Server:**
```bash
systemctl status nginx        # Check Nginx
systemctl restart nginx       # Restart Nginx
htop                          # System resources
```

**SSL:**
```bash
certbot certificates          # Check certificate
certbot renew                 # Renew certificate
```

---

## 🆘 Troubleshooting

**App won't start:**
```bash
pm2 logs fontscanner --lines 100
cd /var/www/fontscanner
npm install --production
pm2 restart fontscanner
```

**502 Bad Gateway:**
```bash
pm2 status
pm2 start fontscanner
systemctl restart nginx
```

**SSL issues:**
```bash
dig +short font-scanner.com
certbot renew
systemctl restart nginx
```

---

For full documentation, see:
- [DEPLOY.md](DEPLOY.md) - Complete deployment guide
- [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) - Pre-deployment checklist
- [deploy/QUICK_REFERENCE.md](deploy/QUICK_REFERENCE.md) - Command reference

---

**Next:** See VS Code Integration instructions below!
