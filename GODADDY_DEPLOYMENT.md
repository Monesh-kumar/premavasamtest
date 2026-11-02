# Prema Vasam • GoDaddy Production Deployment Guide

This guide explains how to deploy the Prema Vasam web platform to **GoDaddy** under your live domain.

---

## 1. Is Docker Required for GoDaddy?

**No, Docker is NOT required.**

* **GoDaddy Shared Hosting / Web Hosting Plus (cPanel):** Docker is not supported on shared cPanel hosting because shared users do not have root daemon privileges. Instead, GoDaddy provides the native **"Setup Node.js App"** tool (powered by CloudLinux / Phusion Passenger), which runs Node.js natively.
* **GoDaddy VPS / Dedicated Servers:** You can use Docker if you prefer, but running Node.js directly via **PM2** (using the included `ecosystem.config.js`) is lighter, faster, and much easier to manage.

---

## 2. Option A: Deploying on GoDaddy cPanel Hosting (Most Common)

If your GoDaddy account has cPanel:

### Step 1: Upload Your Files
1. In GoDaddy, open your **cPanel Dashboard** &rarr; **File Manager**.
2. Create a folder in your home directory (for example, `/home/yourusername/premavasam` or directly in `public_html`).
3. Upload your project files:
   * `server.js`
   * `app.js`
   * `package.json`
   * `.htaccess`
   * `.env` (create from `.env.example`)
   * Folders: `css/`, `images/`, `icons/`
   * HTML pages: `index.html`, `about.html`, `sponsormeals.html`, `activities.html`, `achievements.html`, `gallery.html`, `volunteers.html`, `contact.html`, `howhelp.html`, `admin.html`, `404.html`
   * Metadata: `robots.txt`, `sitemap.xml`
4. *(Note: Do NOT upload `node_modules`. Our production server has zero external runtime dependencies!)*

### Step 2: Configure "Setup Node.js App" in cPanel
1. In cPanel, scroll down to the **Software** section and click **Setup Node.js App**.
2. Click **Create Application**.
3. Fill in the fields:
   * **Node.js version:** Select **22.x** (Active LTS) or latest available (minimum 20.6+).
   * **Application mode:** `Production`
   * **Application root:** `premavasam` (or the folder path where you placed the files).
   * **Application URL:** Select your live domain (e.g. `premavasam.org` or `www.premavasam.org`).
   * **Application startup file:** `server.js`
4. Add **Environment Variables** (bottom of the page):
   * `NODE_ENV` = `production`
   * `ADMIN_USER` = `admin`
   * `ADMIN_PASSWORD` = `<YourStrongSecretPassword>`
   * `CORS_ORIGIN` = `https://yourdomain.com`
5. Click **Create** (or **Save**).
6. Click **Restart** to boot up the server.

---

## 3. Option B: Deploying on GoDaddy Linux VPS / Dedicated Server (SSH + PM2)

If you have a GoDaddy VPS with SSH / root access:

1. **Connect via SSH:**
   ```bash
   ssh root@YOUR_SERVER_IP
   ```

2. **Install Node.js 22 LTS (if not already installed):**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
   apt-get install -y nodejs
   ```

3. **Install PM2 Process Manager globally:**
   ```bash
   npm install -g pm2
   ```

4. **Clone the repository:**
   ```bash
   git clone https://github.com/Monesh-kumar/premavasamtest.git /var/www/premavasam
   cd /var/www/premavasam
   ```

5. **Configure Production Secrets:**
   ```bash
   cp .env.example .env
   nano .env
   ```
   Set your live domain in `CORS_ORIGIN` and a secure password in `ADMIN_PASSWORD`.

6. **Start with PM2 using the included ecosystem file:**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

---

## 4. Domain & SSL Setup on GoDaddy

1. **Point Your Domain's DNS:**
   * In GoDaddy **DNS Management**, point the `A` record (`@`) to your hosting server's IP address.
   * Point the `CNAME` record (`www`) to `@`.
2. **Enable HTTPS / SSL:**
   * In cPanel, navigate to **SSL/TLS Status** and click **Run AutoSSL** (or install your GoDaddy SSL certificate).
   * The included [`.htaccess`](file:///.htaccess) automatically redirects all HTTP traffic to HTTPS.

---

## 5. Security & Verification Checklist

- [ ] `ADMIN_PASSWORD` updated from default in cPanel / `.env`.
- [ ] Direct download of `database.sqlite` blocked (protected by [`.htaccess`](file:///.htaccess) and `server.js`).
- [ ] Visit `https://yourdomain.com/` — check home page and hero slideshow.
- [ ] Visit `https://yourdomain.com/api/stats` — returns JSON status 200 OK.
- [ ] Visit `https://yourdomain.com/admin` — verify admin login with new password.
