# Font Scanner - Deployment Quick Reference Card

## 🚀 1-Minute Deploy Checklist

### Information You Need
```
Droplet IP: _____._____._____._____
Domain: _____________________
Email: _____________________
```

### Quick Deploy Commands

```bash
# 1. SSH into droplet
ssh root@YOUR_IP

# 2. Download and run server setup
curl -o setup-server.sh https://raw.githubusercontent.com/YOUR_REPO/deploy/setup-server.sh
chmod +x setup-server.sh
./setup-server.sh

# 3. Clone and deploy app
git clone YOUR_REPO_URL /var/www/fontscanner
cd /var/www/fontscanner
chmod +x deploy/*.sh
./deploy/deploy-app.sh

# 4. Configure Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/fontscanner
sudo sed -i 's/DOMAIN_NAME/YOUR-DOMAIN.com/g' /etc/nginx/sites-available/fontscanner
sudo ln -s /etc/nginx/sites-available/fontscanner /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

# 5. Setup SSL
sudo ./deploy/setup-ssl.sh

# 6. Update app domain URLs
find src/public -type f \( -name "*.html" -o -name "*.xml" -o -name "*.txt" \) -exec sed -i 's/fontscanner\.app/YOUR-DOMAIN.com/g' {} +
pm2 restart fontscanner

# Done! Visit https://YOUR-DOMAIN.com
```

---

## 📝 Common Commands

### Application Management (PM2)
```bash
pm2 status                    # Check status
pm2 logs fontscanner          # View logs
pm2 restart fontscanner       # Restart app
pm2 stop fontscanner          # Stop app
pm2 monit                     # Real-time monitoring
```

### Server Management
```bash
systemctl status nginx        # Check Nginx
systemctl restart nginx       # Restart Nginx
nginx -t                      # Test Nginx config
ufw status                    # Check firewall
```

### SSL Management
```bash
certbot certificates          # List certificates
certbot renew                 # Renew certificates
systemctl status certbot.timer # Check auto-renewal
```

### Monitoring
```bash
htop                          # System resources
df -h                         # Disk usage
free -h                       # Memory usage
tail -f /var/log/nginx/fontscanner_access.log  # Access logs
tail -f /var/log/nginx/fontscanner_error.log   # Error logs
```

---

## 🔧 Troubleshooting Quick Fixes

### App Won't Start
```bash
pm2 logs fontscanner --lines 100  # Check logs
cd /var/www/fontscanner
npm install --production          # Reinstall deps
pm2 restart fontscanner
```

### 502 Bad Gateway
```bash
pm2 status                    # Check if app running
netstat -tlnp | grep 3000    # Check port 3000
pm2 start fontscanner        # Start if offline
systemctl restart nginx       # Restart Nginx
```

### SSL Issues
```bash
dig +short YOUR-DOMAIN.com    # Verify DNS
certbot renew                 # Renew certificate
systemctl restart nginx       # Restart Nginx
```

### High Memory
```bash
nano /var/www/fontscanner/.env
# Set: BROWSER_POOL_MAX=5
pm2 restart fontscanner
```

---

## 🎯 Post-Deployment Tasks

1. **Submit Sitemap**
   - Google: https://search.google.com/search-console
   - Bing: https://www.bing.com/webmasters
   - Submit: https://YOUR-DOMAIN.com/sitemap.xml

2. **Validate Schema**
   - Rich Results: https://search.google.com/test/rich-results
   - Schema Validator: https://validator.schema.org/

3. **Test Social Cards**
   - Facebook: https://developers.facebook.com/tools/debug/
   - Twitter: https://cards-dev.twitter.com/validator

4. **Security Check**
   - SSL Test: https://www.ssllabs.com/ssltest/
   - Headers: https://securityheaders.com/

---

## 📞 Important Files

- `/var/www/fontscanner` - Application directory
- `/var/www/fontscanner/.env` - Environment variables
- `/etc/nginx/sites-available/fontscanner` - Nginx config
- `/var/log/nginx/fontscanner_*.log` - Nginx logs
- `~/.pm2/logs/` - PM2 logs

---

## 🆘 Emergency Commands

**App crashed and won't restart:**
```bash
pm2 delete fontscanner
cd /var/www/fontscanner
pm2 start src/server.js --name fontscanner --instances 2 --exec-mode cluster
pm2 save
```

**Nginx won't start:**
```bash
nginx -t                      # Check for errors
systemctl stop nginx
systemctl start nginx
systemctl status nginx -l
```

**Out of disk space:**
```bash
df -h                         # Check usage
find /var/www/fontscanner/reports -mtime +7 -delete  # Clean old reports
apt autoremove -y             # Clean packages
journalctl --vacuum-time=3d   # Clean logs
```

**Server unresponsive:**
```bash
# From DigitalOcean console:
# Droplets > Your Droplet > Access > Launch Droplet Console
# Then:
systemctl restart nginx
pm2 restart fontscanner
```

---

For full documentation, see [DEPLOY.md](DEPLOY.md)
