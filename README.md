# Premavasam • A Home of Love

> **"To Serve... Not to be Served"**  
> Registered Charitable Trust (Regd. No. 419 of 1999) caring for 200+ mentally challenged, physically challenged, and destitute children in Chennai, India.

---

## Overview

This repository contains the full-stack web application for **Premavasam**, meticulously rebuilt and styled using the **Yuna Nature organic design system** (inspired by Anariel Design's Yuna Nature block theme).

The application is completely self-contained with **zero external npm dependencies**, powered by Node.js and a high-performance **SQLite database running in Write-Ahead Logging (WAL) mode**, fully hardened for enterprise domain deployment and cyber attack prevention.

---

## 🛡️ Cyber Security Hardening & Attack Prevention

The backend and frontend have been audited and hardened against top cyber threats (OWASP Top 10):

1. **Information Leakage & Sensitive File Protection**:
   - Direct static file downloads of `database.sqlite`, `database.sqlite-wal`, `server.js`, `package.json`, `.env`, and git metadata (`.git/`) are strictly blocked (`403 Forbidden`).
   - Strict whitelist for allowed static extensions (`.html`, `.css`, `.js`, `.png`, `.jpg`, `.jpeg`, `.svg`, `.webp`, `.ico`).
2. **Path Traversal & Directory Traversal Shield**:
   - Resolves all file paths against root and validates that `resolvedPath.startsWith(PUBLIC_DIR)`.
   - Blocks dot-segments (`..`, `/.`, hidden files) and encoded directory traversal attempts (`%2e%2e`).
3. **Advanced HTTP Security Headers**:
   - `Content-Security-Policy`: Restricts script and resource execution to self and trusted CDNs (`unpkg.com`, `fonts.googleapis.com`, `fonts.gstatic.com`).
   - `X-Frame-Options: DENY`: Blocks Clickjacking and UI redressing attacks.
   - `X-Content-Type-Options: nosniff`: Enforces strict MIME typing and blocks MIME-confusion attacks.
   - `Strict-Transport-Security (HSTS)`: Enforces HTTPS communication (`max-age=31536000; includeSubDomains; preload`).
   - `Referrer-Policy: strict-origin-when-cross-origin`: Protects referrer information.
   - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`: Disables unwanted browser hardware APIs.
   - `X-Powered-By`: Suppressed to prevent server fingerprinting.
4. **Brute-Force & Denial of Service (DoS) Shield**:
   - Sliding-window in-memory Rate Limiter:
     - Admin Login: Max 5 failed attempts per 15 minutes before 15-minute lock (`429 Too Many Requests`).
     - Public Submission Forms: Max 10 requests per 10 minutes per IP.
     - Payload Size Limit: Strict 500KB cap per request (`413 Payload Too Large`).
5. **Timing-Attack Resilient Authentication**:
   - Constant-time string comparison (`crypto.timingSafeEqual`) on SHA-256 digests protects admin credentials from timing side-channel attacks.
6. **Dynamic Cryptographic Session Management**:
   - Ephemeral, 32-byte cryptographically secure random session tokens (`pvs_<64-hex>`) with automatic 4-hour expiration (`SESSION_TTL_MS`).
7. **Input Sanitization & Injection Protection**:
   - Strips control characters, null bytes, and non-printable characters.
   - Strict regex validation for phone numbers, emails, dates (YYYY-MM-DD), and Indian PAN card formats.
   - Prototype pollution shield deletes `__proto__`, `constructor`, and `prototype` keys on parsed JSON.
   - CSV / Excel Formula Injection mitigation (escapes `=`, `+`, `-`, `@`, `\t`, `\r` prefixes in exports).

---

## 🌐 Custom Domain Hosting & Deployment Guide

Follow these steps to deploy Premavasam to your production domain (e.g., `https://premavasam.org` or `https://www.premavasam.org`):

### 1. Environment Configuration

Copy the example environment template and configure your production values:

```bash
cp .env.example .env
```

Edit `.env`:
```ini
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://premavasam.org
ADMIN_USER=admin
ADMIN_PASSWORD=SetAStrongRandomPasswordHere!
ADMIN_EMAIL=premavasam1999@gmail.com
```

### 2. Deployment Options

#### Option A: Cloud Platforms (Railway / Render / DigitalOcean App Platform)
1. Link your GitHub repository (`https://github.com/Monesh-kumar/premavasamtest.git`).
2. Set Build Command: *(Leave blank or `npm test`)*
3. Set Start Command: `npm start`
4. In Environment Variables, set `NODE_ENV`, `CORS_ORIGIN`, `ADMIN_USER`, and `ADMIN_PASSWORD`.
5. Attach your custom domain in the platform's Custom Domain settings.

#### Option B: Linux VPS (Ubuntu / Debian / CentOS with Nginx & PM2)
1. **Clone repository**:
   ```bash
   git clone https://github.com/Monesh-kumar/premavasamtest.git /var/www/premavasam
   cd /var/www/premavasam
   cp .env.example .env
   ```
2. **Start with PM2 process manager**:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "premavasam"
   pm2 save
   pm2 startup
   ```
3. **Configure Nginx Reverse Proxy with SSL (Certbot Let's Encrypt)**:
   ```nginx
   server {
       server_name premavasam.org www.premavasam.org;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
4. **Obtain Free SSL Certificate**:
   ```bash
   sudo certbot --nginx -d premavasam.org -d www.premavasam.org
   ```

#### Option C: Docker & Docker Compose
1. **Run with Docker Compose**:
   ```bash
   docker compose up -d
   ```
2. **Or build and run manually**:
   ```bash
   docker build -t premavasam-web .
   docker run -d -p 3000:3000 --name premavasam -v sqlite_data:/app premavasam-web
   ```

### 3. DNS Configuration
Set the following DNS records with your domain registrar:
- **A Record**: `@` &rarr; `<Your Server IP>`
- **CNAME Record**: `www` &rarr; `premavasam.org` (or platform alias e.g. `your-app.up.railway.app`)

---

## 🧪 Automated Test & Penetration Suite

Run the full automated test and cybersecurity audit:

```bash
# Run all tests
npm test

# Or run the penetration audit directly
node security_audit_test.js
```

All 41 penetration assertions (blocked file downloads, security headers, rate limiting, timing attack checks, XSS/injection resistance) must pass before deployment.

---

## Project Structure

```
premavasam-webpage/
├── index.html            # Main landing page with hero, stats, and sponsorship planner
├── about.html            # Story, mission, history, and Pioneers of Love
├── sponsormeals.html     # Comprehensive meal menu with multi-select booking
├── activities.html       # Clinical therapies and special education
├── achievements.html     # Special Olympics, state awards, and milestones
├── gallery.html          # Categorized photo gallery with modal lightbox
├── volunteers.html       # Volunteer testimonials and application workflow
├── contact.html          # Directions, campus address, and message inquiry form
├── howhelp.html          # Domestic 80G & SBI FCRA accounts with registration
├── admin.html            # Internal back-office administration suite (/admin)
├── server.js             # Hardened cyber-secure Node.js server & REST API
├── database.sqlite       # SQLite WAL mode database (auto-created if missing)
├── package.json          # Application configuration & npm scripts
├── .env.example          # Production domain environment template
├── .gitignore            # Git exclusion rules
├── test_suite.js         # Functional routing & API verification suite
├── security_audit_test.js # Penetration test suite (OWASP hardening verifier)
├── css/
│   └── styles.css        # Full Yuna Nature Design System stylesheet
└── images/               # High-resolution local image assets
    ├── gallery/          # Categorized gallery photos
    ├── logo.png          # Premavasam official emblem
    └── mumtaj.jpg        # Face-centered leadership portrait
```

---

## Contact & Location

- **Address**: No. 15, Thiru V.K.A. Road, Gerugambakkam, Porur, Chennai – 600128, Tamil Nadu, India.
- **Phone**: +91 96772 38998 (9:00 AM – 8:00 PM IST)
- **Email**: premavasam1999@gmail.com
- **Website**: [https://www.premavasam.org](https://www.premavasam.org)
