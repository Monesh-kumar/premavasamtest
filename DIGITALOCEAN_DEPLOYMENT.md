# Prema Vasam • DigitalOcean Production Deployment & Hosting Guide

This guide details the technical requirements, architecture, and step-by-step procedure for hosting **Prema Vasam** on **DigitalOcean**.

---

## 1. Hosting Architecture Comparison on DigitalOcean

| Option | Best For | Monthly Cost | Pros | Considerations |
|:---|:---|:---:|:---|:---|
| **Option A: DigitalOcean Droplet (Recommended)** | Production (Full control, lowest cost) | **$4 – $6 / mo** (BLR1 Bangalore) | • Runs Node.js 22 + Nginx natively<br>• Persistent local SSD for SQLite WAL<br>• Extremely low latency for Indian visitors<br>• Zero external dependency overhead | Requires initial Ubuntu setup (SSH, Nginx, PM2, Certbot). |
| **Option B: DigitalOcean App Platform** | Hands-off PaaS (Auto-deploy on `git push`) | **$5 – $6 / mo** ($5 basic + $1 volume) | • Automatic builds from GitHub<br>• Managed SSL certificates<br>• Automated DDoS protection | Must attach a **Persistent Volume** at `/app/data` so SQLite persists across deployments. |
| **Option C: Docker on Droplet** | Containerized workflow | **$4 – $6 / mo** | • Uses included `Dockerfile` and `docker-compose.yml`<br>• Isolated non-root container environment | Requires managing Docker engine updates. |

---

## 2. Option A: DigitalOcean Droplet Deployment (Step-by-Step)

### Step 1: Create Your Droplet in DigitalOcean
1. Log into your **DigitalOcean Cloud Console**.
2. Click **Create** &rarr; **Droplets**.
3. Choose specifications:
   - **Distribution:** Ubuntu 24.04 LTS (x64).
   - **Droplet Type:** Basic (Regular SSD / 1GB RAM / 1 vCPU / 25GB SSD / 1000GB Transfer) — **$4 or $6/mo**.
   - **Datacenter Region:** **BLR1 (Bangalore, India)** — *strongly recommended for lowest latency to donors and visitors in Chennai/India*.
   - **Authentication:** SSH Key (recommended) or strong root password.
4. Click **Create Droplet**. Note your **Droplet IPv4 address**.

---

### Step 2: Initial Server Hardening & Firewall
SSH into your droplet:
```bash
ssh root@YOUR_DROPLET_IP
```

1. **Update packages and install security tools:**
   ```bash
   apt update && apt upgrade -y
   apt install -y ufw curl git fail2ban
   ```

2. **Configure UFW Firewall:**
   ```bash
   ufw default deny incoming
   ufw default allow outgoing
   ufw allow OpenSSH
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw enable
   ```
   *(Port 3000 remains blocked from the public internet; only Nginx will talk to Node locally).*

---

### Step 3: Install Node.js 22 LTS & PM2
Prema Vasam requires **Node.js >= 22.5.0** because it utilizes the high-performance native `node:sqlite` engine.

1. **Install Node.js 22 LTS via NodeSource:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   apt install -y nodejs
   
   # Verify version (should show v22.x)
   node -v
   ```

2. **Install PM2 globally (Process Manager):**
   ```bash
   npm install -g pm2
   ```

---

### Step 4: Clone the Application & Configure Environment
1. **Clone repository to `/var/www/premavasam`:**
   ```bash
   git clone https://github.com/Prem-charitable-trust/premavasam-webpage.git /var/www/premavasam
   cd /var/www/premavasam
   ```

2. **Create your production `.env` file:**
   ```bash
   cp .env.example .env
   nano .env
   ```
   Configure the following production values:
   ```ini
   PORT=3000
   NODE_ENV=production
   CORS_ORIGIN="https://premavasam.org"
   TRUST_PROXY=true
   ADMIN_USER="admin"
   ADMIN_PASSWORD="YourStrongUniqueAdminPasswordHere"
   ADMIN_NAME="Premavasam Administrator"
   ADMIN_ROLE="Superadmin"
   ADMIN_EMAIL="premavasam1999@gmail.com"
   ```

3. **Verify Database Directory & Permissions:**
   ```bash
   # Prema Vasam will automatically initialize database.sqlite in WAL mode
   npm test
   ```

---

### Step 5: Start Node Application with PM2
1. **Start the application using the included ecosystem configuration:**
   ```bash
   pm2 start ecosystem.config.js
   ```

2. **Enable PM2 to auto-start on server reboots:**
   ```bash
   pm2 save
   pm2 startup
   # Copy and execute the sudo command PM2 prints on screen
   ```

3. **Verify health endpoint:**
   ```bash
   curl http://localhost:3000/api/health
   # Returns: {"status":"healthy","uptime":...,"database":"connected","version":"2.0.0"}
   ```

---

### Step 6: Configure Nginx Reverse Proxy
1. **Install Nginx:**
   ```bash
   apt install -y nginx
   ```

2. **Copy the included Nginx template:**
   ```bash
   cp /var/www/premavasam/nginx.conf.example /etc/nginx/sites-available/premavasam
   ```

3. **Update domain name in the file:**
   ```bash
   nano /etc/nginx/sites-available/premavasam
   # Ensure server_name points to your actual domain (e.g. premavasam.org www.premavasam.org)
   ```

4. **Enable the site and reload Nginx:**
   ```bash
   ln -s /etc/nginx/sites-available/premavasam /etc/nginx/sites-enabled/
   rm -f /etc/nginx/sites-enabled/default
   nginx -t && systemctl reload nginx
   ```

---

### Step 7: Free SSL via Let's Encrypt Certbot
1. **Point your domain's DNS A-records in GoDaddy / Namecheap / DigitalOcean:**
   - Host `@` &rarr; `YOUR_DROPLET_IP`
   - Host `www` &rarr; `YOUR_DROPLET_IP`

2. **Run Certbot:**
   ```bash
   apt install -y certbot python3-certbot-nginx
   certbot --nginx -d premavasam.org -d www.premavasam.org
   ```
   Certbot will automatically install SSL certificates and set up automatic 90-day renewal timers.

---

### Step 8: Set Up Automated WAL-Safe SQLite Backups
Set up a daily cron job to run Prema Vasam's backup suite:
```bash
crontab -e
```
Add the following line (runs at 2:00 AM daily):
```cron
0 2 * * * cd /var/www/premavasam && /usr/bin/node backup.js >> /var/log/premavasam_backup.log 2>&1
```

---

## 3. Option B: DigitalOcean App Platform Deployment

If you prefer managed PaaS where DigitalOcean handles server updates and auto-deploys from GitHub:

1. In the DigitalOcean console, go to **Apps** &rarr; **Create App**.
2. Connect your GitHub repository (`premavasam-webpage`).
3. Under **Components &rarr; Settings**:
   - **HTTP Port:** `3000`
   - **Health Check Path:** `/api/health`
4. **CRITICAL FOR SQLITE PERSISTENCE:**
   - In App Platform, click **Add Component** &rarr; **Volume**.
   - Create a **1 GB Persistent Volume** ($1/mo) and set the mount path to:
     `/app/data`
5. **Environment Variables:**
   - `NODE_ENV` = `production`
   - `PORT` = `3000`
   - `TRUST_PROXY` = `true`
   - `DB_PATH` = `/app/data/database.sqlite`
   - `BACKUP_DIR` = `/app/data/backups`
   - `CORS_ORIGIN` = `https://premavasam.org`
   - `ADMIN_USER` = `admin`
   - `ADMIN_PASSWORD` = *(Encrypted Secret)*
6. Click **Deploy**. DigitalOcean will provision SSL and run the container with persistent storage at `/app/data`.

---

## 4. DigitalOcean Readiness Checklist

| Requirement | Prema Vasam Implementation | Status |
|:---|:---|:---:|
| **Node.js 22 LTS Runtime** | Configured in `package.json` (`engines: >=22.0.0`) and `Dockerfile` (`FROM node:22-alpine`). | **READY** |
| **Reverse Proxy Support** | `TRUST_PROXY=true` config implemented; real client IP extracted from `x-forwarded-for`. | **READY** |
| **Security Headers & CSP** | Built-in HSTS, strict CSP, X-Frame-Options, X-Content-Type-Options. | **READY** |
| **Persistent SQLite Storage** | `DB_PATH` configurable via environment; supports local SSD, Docker volumes, and App Platform volumes. | **READY** |
| **Process Monitoring** | Included `ecosystem.config.js` for PM2 auto-restart and crash recovery. | **READY** |
| **Uptime Health Checks** | Dedicated `/api/health` checking database connectivity and server uptime. | **READY** |
| **Automated Backups** | Included `backup.js` using atomic `VACUUM INTO`, integrity checks, and retention pruning. | **READY** |
| **Nginx Reverse Proxy Template** | Pre-configured `nginx.conf.example` with SSL, Gzip, and sensitive file blocking. | **READY** |

---

## Summary Recommendation
For best performance and cost-efficiency, deploy on a **DigitalOcean Droplet ($4 - $6/month) in the BLR1 (Bangalore) region** using **PM2** and **Nginx**. This delivers single-digit millisecond latency to Chennai, full local SSD persistence for SQLite, and zero external database hosting fees.
