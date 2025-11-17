# VS Code Integration for Font Scanner

Complete VS Code setup for seamless development and deployment.

**Server:** 143.198.147.93 | **Domain:** font-scanner.com

---

## 🎯 What You Get

- ✅ **One-Click Deploy** - Press Ctrl+Shift+B
- ✅ **Remote SSH** - Edit files on server
- ✅ **Task Runner** - View logs, restart, check status
- ✅ **Git Integration** - Push and deploy

---

## 📦 Step 1: Install VS Code Extensions

1. Open VS Code
2. Press `Ctrl+Shift+X` (Extensions)
3. Install these:

**Required:**
- **Remote - SSH** (ms-vscode-remote.remote-ssh)

**Recommended:**
- **SFTP** (liximomo.sftp)
- **ESLint** (dbaeumer.vscode-eslint)
- **Prettier** (esbenp.prettier-vscode)
- **GitLens** (eamodio.gitlens)

**Or:** Press `Ctrl+Shift+P` → "Extensions: Show Recommended Extensions"

---

## 🔑 Step 2: Set Up SSH Key

### Generate SSH Key (Windows PowerShell):

```powershell
# Generate key
ssh-keygen -t ed25519 -C "peter@font-scanner.com"
# Press Enter 3 times (default location, no passphrase)

# View public key
type $env:USERPROFILE\.ssh\id_ed25519.pub
# Copy the output
```

### Add Key to Droplet:

```bash
# SSH to droplet as root
ssh root@143.198.147.93

# Add your public key
mkdir -p /home/fontscanner/.ssh
nano /home/fontscanner/.ssh/authorized_keys
# Paste your public key, save (Ctrl+O, Enter, Ctrl+X)

# Set permissions
chmod 700 /home/fontscanner/.ssh
chmod 600 /home/fontscanner/.ssh/authorized_keys
chown -R fontscanner:fontscanner /home/fontscanner/.ssh
exit
```

### Test Connection:

```powershell
ssh fontscanner@143.198.147.93
# Should connect without password!
```

---

## ⚙️ Step 3: Configure SSH in VS Code

1. Press `Ctrl+Shift+P`
2. Type: "Remote-SSH: Open SSH Configuration File"
3. Select: `C:\Users\YourName\.ssh\config`

**Add this:**

```
Host font-scanner
    HostName 143.198.147.93
    User fontscanner
    Port 22
    IdentityFile ~/.ssh/id_ed25519
    ForwardAgent yes
```

**Save file**

---

## 🚀 Step 4: One-Click Deploy

The `.vscode/tasks.json` is already configured!

### Deploy (Default Task):

```
Press: Ctrl+Shift+B
```

This will:
1. Push to GitHub
2. Pull on server
3. Install dependencies
4. Restart PM2

### Other Tasks:

Press `Ctrl+Shift+P` → "Tasks: Run Task" →

- **⚡ Quick Deploy** - Deploy without npm install
- **📋 View Logs** - See production logs
- **📊 Check Status** - PM2 status
- **🔄 Restart App** - Restart application

---

## 🖥️ Step 5: Remote SSH (Edit Files on Server)

### Connect:

1. Press `F1`
2. Type: "Remote-SSH: Connect to Host"
3. Select: **font-scanner**
4. New window opens
5. Click "Open Folder"
6. Navigate to: `/var/www/fontscanner`

**You're now editing directly on the server!**

Changes are live immediately. No need to deploy.

---

## 📝 Common Workflows

### Workflow A: Local Dev + Deploy

1. Edit locally
2. `git commit -am "message"`
3. Press `Ctrl+Shift+B` (deploy)

### Workflow B: Direct Remote

1. Connect via Remote SSH
2. Edit on server
3. Changes live instantly

---

## 🛠️ Quick Commands

### In VS Code Terminal:

```bash
# Deploy manually
git push && ssh fontscanner@143.198.147.93 'cd /var/www/fontscanner && git pull && pm2 restart fontscanner'

# View logs
ssh fontscanner@143.198.147.93 'pm2 logs fontscanner'

# Check status
ssh fontscanner@143.198.147.93 'pm2 status'
```

---

## 🐛 Troubleshooting

### SSH Connection Fails

```powershell
# Test manually
ssh fontscanner@143.198.147.93

# If asks for password, SSH key not set up
# Re-do Step 2
```

### Deploy Task Hangs

```bash
# SSH to server
ssh fontscanner@143.198.147.93

# Check PM2
pm2 status
pm2 logs fontscanner

# Restart if needed
pm2 restart fontscanner
```

---

## ⚡ Pro Tips

### Custom Keyboard Shortcuts

File → Preferences → Keyboard Shortcuts

```json
[
  {
    "key": "ctrl+alt+d",
    "command": "workbench.action.tasks.runTask",
    "args": "🚀 Deploy to Production"
  }
]
```

### Port Forwarding

When connected via Remote SSH:
- Press `F1` → "Forward a Port" → `3000`
- Access at: `http://localhost:3000`

---

## 🎯 Quick Reference

| Action | Shortcut |
|--------|----------|
| Deploy | `Ctrl+Shift+B` |
| Run Task | `Ctrl+Shift+P` → Tasks |
| SSH Connect | `F1` → Remote-SSH |
| Terminal | `Ctrl+` ` |
| Git Panel | `Ctrl+Shift+G` |
| Search Files | `Ctrl+P` |
| Command Palette | `Ctrl+Shift+P` |

---

## ✅ Setup Checklist

- [ ] Installed Remote-SSH extension
- [ ] Generated SSH key
- [ ] Added key to droplet
- [ ] Tested SSH (no password)
- [ ] Created SSH config
- [ ] Can connect via Remote-SSH
- [ ] Tested deploy (Ctrl+Shift+B)

---

**You're ready!** 🎉

Press `Ctrl+Shift+B` to deploy!

---

See also:
- [DEPLOY_NOW.md](DEPLOY_NOW.md) - Deployment commands
- [deploy/QUICK_REFERENCE.md](deploy/QUICK_REFERENCE.md) - Command reference
