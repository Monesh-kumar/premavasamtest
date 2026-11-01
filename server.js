/**
 * ══════════════════════════════════════════════════════════════════════
 * PREMA VASAM • Enterprise Full-Stack Web & API Server
 * Hardened Cyber Security • SQLite WAL • Anti-DoS • CSP • Domain-Ready
 * ══════════════════════════════════════════════════════════════════════
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

// ── CONFIGURATION & ENVIRONMENT ──
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const DB_PATH = path.join(__dirname, 'database.sqlite');
const APP_ENV = process.env.NODE_ENV || 'production';
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || '*'; // Configure to your domain in production e.g. 'https://premavasam.org'

// Admin Credentials (Set via environment variables in production)
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'premavasam1999';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Premavasam Administrator';
const ADMIN_ROLE = process.env.ADMIN_ROLE || 'Superadmin';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'premavasam1999@gmail.com';

// ── 1. DATABASE INITIALIZATION (SQLite WAL Mode) ──
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS meals (
    id TEXT PRIMARY KEY,
    sponsor_name TEXT NOT NULL,
    sponsor_phone TEXT NOT NULL,
    sponsor_email TEXT,
    sponsor_date TEXT NOT NULL,
    occasion TEXT,
    selected_items TEXT,
    total_amount REAL DEFAULT 0,
    payment_status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS donations (
    id TEXT PRIMARY KEY,
    donor_name TEXT NOT NULL,
    donor_email TEXT NOT NULL,
    donor_phone TEXT,
    pan_number TEXT,
    amount REAL NOT NULL,
    transfer_type TEXT DEFAULT 'UPI',
    reference_number TEXT,
    receipt_status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS volunteers (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    skills TEXT,
    message TEXT,
    status TEXT DEFAULT 'new',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );
`);

// ── 2. CYBER SECURITY: RATE LIMITING & BRUTE FORCE SHIELD ──
// Sliding-window in-memory store
const rateLimitStore = new Map();

function checkRateLimit(ip, bucket, maxRequests, windowMs) {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  let record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    rateLimitStore.set(key, record);
    return { allowed: true, remaining: maxRequests - 1, resetInMs: windowMs };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetInMs: record.resetTime - now };
  }

  record.count++;
  return { allowed: true, remaining: maxRequests - record.count, resetInMs: record.resetTime - now };
}

// Automatic cleanup every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

function getClientIp(req) {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

// ── 3. CYBER SECURITY: SECURE SESSIONS & TIMING-SAFE AUTH ──
// Active token storage with timestamps and expiration (4 hours)
const activeSessions = new Map();
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

function generateSessionToken(adminData) {
  const token = 'pvs_' + crypto.randomBytes(32).toString('hex');
  const session = {
    token,
    admin: adminData,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS
  };
  activeSessions.set(token, session);
  return token;
}

function verifyAuth(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.substring(7).trim();
  const session = activeSessions.get(token);
  if (!session) return false;

  // Check token expiration
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return false;
  }
  return session.admin;
}

function timingSafeCheck(userInput, actualSecret) {
  if (typeof userInput !== 'string' || typeof actualSecret !== 'string') return false;
  const aHash = crypto.createHash('sha256').update(userInput).digest();
  const bHash = crypto.createHash('sha256').update(actualSecret).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

// ── 4. CYBER SECURITY: DEEP INPUT SANITIZATION & ESCAPING ──
function sanitizeString(str, maxLength = 200) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Strip ASCII control characters
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^[\d\s+\-()]{7,25}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/i;

// ── 5. CYBER SECURITY: SECURE HTTP HEADERS ──
function applySecurityHeaders(res, origin = ALLOWED_ORIGIN) {
  // Content Security Policy (Prevents Cross-Site Scripting & Injection)
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' " + (origin !== '*' ? origin : ''),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Frame-Options', 'DENY'); // Clickjacking prevention
  res.setHeader('X-Content-Type-Options', 'nosniff'); // MIME-sniffing prevention
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload'); // HTTPS Enforce
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.removeHeader('X-Powered-By'); // Hide backend server technology
}

function sendJson(res, statusCode, data, extraHeaders = {}) {
  applySecurityHeaders(res);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extraHeaders
  };
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(data));
}

// ── 6. SAFE JSON BODY PARSER (Max 100KB Anti-DoS Limit) ──
function parseJsonBody(req, maxBytes = 100 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytesReceived = 0;

    req.on('data', chunk => {
      bytesReceived += chunk.length;
      if (bytesReceived > maxBytes) {
        req.socket.destroy();
        return reject(new Error('Payload too large. Maximum allowed size is 100KB.'));
      }
      body += chunk;
    });

    req.on('end', () => {
      if (!body) return resolve({});
      try {
        const parsed = JSON.parse(body);
        // Prototype pollution shield
        if (parsed && typeof parsed === 'object') {
          delete parsed.__proto__;
          delete parsed.constructor;
          delete parsed.prototype;
        }
        resolve(parsed);
      } catch (err) {
        reject(new Error('Invalid JSON format.'));
      }
    });

    req.on('error', reject);
  });
}

// ── 7. STATS COMPUTATION ──
function getStats() {
  const mealStats = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total FROM meals').get();
  const donStats = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM donations').get();
  const conStats = db.prepare('SELECT COUNT(*) as count, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread FROM contacts').get();
  const volStats = db.prepare('SELECT COUNT(*) as count FROM volunteers').get();

  const mealTotal = Number(mealStats.total) || 0;
  const donTotal = Number(donStats.total) || 0;

  return {
    totalChildren: 200,
    specialChildren: 132,
    establishedYear: 1999,
    database: 'SQLite (WAL Mode)',
    status: 'active',
    totalPledgedAmount: mealTotal + donTotal,
    mealTotalAmount: mealTotal,
    contribTotalAmount: donTotal,
    mealPledgesReceived: mealStats.count,
    contributionsReceived: donStats.count,
    contactMessagesReceived: conStats.count,
    volunteersCount: volStats.count,
    totalFunds: mealTotal + donTotal,
    mealsCount: mealStats.count,
    unreadContacts: conStats.unread || 0,
    newMessages: conStats.unread || 0
  };
}

// ── 8. SECURE CSV EXPORT HELPER (Formula Injection Protected) ──
function generateCsv(rows, headers) {
  if (!rows || rows.length === 0) {
    return headers.join(',') + '\n';
  }
  const lines = [headers.join(',')];
  rows.forEach(r => {
    const row = headers.map(k => {
      let val = r[k] !== undefined && r[k] !== null ? String(r[k]) : '';
      // Mitigate CSV / Excel Formula Injection (=, +, -, @)
      if (/^[=+\-@\t\r]/.test(val)) {
        val = "'" + val;
      }
      val = val.replace(/"/g, '""');
      if (val.includes(',') || val.includes('\n') || val.includes('"')) {
        val = `"${val}"`;
      }
      return val;
    });
    lines.push(row.join(','));
  });
  return lines.join('\n');
}

// ── 9. ALLOWED STATIC EXTENSIONS & MIME TYPES ──
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// SENSITIVE FILES THAT MUST NEVER BE SERVED OVER HTTP
const BLOCKED_EXTENSIONS = new Set([
  '.sqlite', '.sqlite-shm', '.sqlite-wal', '.db', '.db-shm', '.db-wal',
  '.env', '.git', '.gitignore', '.log', '.md', '.bak', '.tar', '.zip', '.gz'
]);

const BLOCKED_FILES = new Set([
  'server.js', 'package.json', 'package-lock.json', 'test_suite.js',
  'database.sqlite', 'database.sqlite-shm', 'database.sqlite-wal'
]);

// ── 10. MAIN HTTP REQUEST DISPATCHER ──
const server = http.createServer(async (req, res) => {
  const clientIp = getClientIp(req);

  // HTTPS Redirection header check for reverse-proxy domain deployments (Cloudflare / Render / Nginx)
  if (APP_ENV === 'production' && req.headers['x-forwarded-proto'] === 'http') {
    res.writeHead(301, {
      'Location': `https://${req.headers.host}${req.url}`
    });
    return res.end();
  }

  // CORS Preflight Handler
  if (req.method === 'OPTIONS') {
    applySecurityHeaders(res);
    res.writeHead(204, {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  let urlObj;
  try {
    urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('400 Bad Request');
  }

  const pathname = urlObj.pathname;

  // ══════════════════════════════════════════════════════════════
  // A. PUBLIC APIS (Protected by Rate Limiting & Validation)
  // ══════════════════════════════════════════════════════════════

  // GET /api/stats
  if (req.method === 'GET' && pathname === '/api/stats') {
    return sendJson(res, 200, getStats());
  }

  // POST /api/meals/book
  if (req.method === 'POST' && pathname === '/api/meals/book') {
    const rateCheck = checkRateLimit(clientIp, 'meals-book', 10, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      return sendJson(res, 429, {
        ok: false,
        error: 'Too many requests. Please wait before submitting another booking.'
      }, { 'Retry-After': String(Math.ceil(rateCheck.resetInMs / 1000)) });
    }

    try {
      const data = await parseJsonBody(req);

      const name = sanitizeString(data.sponsor_name, 100);
      const phone = sanitizeString(data.sponsor_phone, 25);
      const email = sanitizeString(data.sponsor_email, 120);
      const date = sanitizeString(data.sponsor_date, 20);
      const occasion = sanitizeString(data.occasion, 100) || 'General Blessing';
      const selectedItems = sanitizeString(data.selected_items, 300) || 'Meal Sponsorship';
      const notes = sanitizeString(data.notes, 1000);
      const amount = parseFloat(data.total_amount);

      if (!name || name.length < 2) {
        return sendJson(res, 400, { ok: false, error: 'Valid sponsor name is required' });
      }
      if (!phone || !PHONE_REGEX.test(phone)) {
        return sendJson(res, 400, { ok: false, error: 'Valid contact phone number is required' });
      }
      if (email && !EMAIL_REGEX.test(email)) {
        return sendJson(res, 400, { ok: false, error: 'Invalid email address format' });
      }
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return sendJson(res, 400, { ok: false, error: 'Valid sponsorship date (YYYY-MM-DD) is required' });
      }
      if (isNaN(amount) || amount <= 0 || amount > 10000000) {
        return sendJson(res, 400, { ok: false, error: 'Invalid sponsorship amount' });
      }

      const count = db.prepare('SELECT COUNT(*) as count FROM meals').get().count;
      const id = `#MB-${2800 + count + 1}`;
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO meals (id, sponsor_name, sponsor_phone, sponsor_email, sponsor_date, occasion, selected_items, total_amount, payment_status, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `);
      stmt.run(id, name, phone, email, date, occasion, selectedItems, amount, notes, now);

      const booking = db.prepare('SELECT * FROM meals WHERE id = ?').get(id);
      return sendJson(res, 200, {
        ok: true,
        id,
        booking,
        message: 'Meal reservation recorded with heartfelt gratitude. Official confirmation will be shared promptly.'
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Server error processing meal reservation.' });
    }
  }

  // POST /api/donations/record
  if (req.method === 'POST' && pathname === '/api/donations/record') {
    const rateCheck = checkRateLimit(clientIp, 'donations-record', 10, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      return sendJson(res, 429, {
        ok: false,
        error: 'Too many requests. Please wait a few minutes before submitting.'
      }, { 'Retry-After': String(Math.ceil(rateCheck.resetInMs / 1000)) });
    }

    try {
      const data = await parseJsonBody(req);

      const name = sanitizeString(data.donor_name, 100);
      const email = sanitizeString(data.donor_email, 120);
      const phone = sanitizeString(data.donor_phone, 25);
      const pan = sanitizeString(data.pan_number, 15).toUpperCase();
      const transferType = sanitizeString(data.transfer_type, 30) || 'UPI';
      const reference = sanitizeString(data.reference_number, 50);
      const notes = sanitizeString(data.notes, 1000);
      const amount = parseFloat(data.amount);

      if (!name || name.length < 2) {
        return sendJson(res, 400, { ok: false, error: 'Valid donor name is required' });
      }
      if (!email || !EMAIL_REGEX.test(email)) {
        return sendJson(res, 400, { ok: false, error: 'Valid donor email is required' });
      }
      if (phone && !PHONE_REGEX.test(phone)) {
        return sendJson(res, 400, { ok: false, error: 'Invalid phone number format' });
      }
      if (pan && !PAN_REGEX.test(pan)) {
        return sendJson(res, 400, { ok: false, error: 'Invalid Indian PAN card format (e.g. ABCDE1234F)' });
      }
      if (isNaN(amount) || amount <= 0 || amount > 50000000) {
        return sendJson(res, 400, { ok: false, error: 'Valid positive donation amount is required' });
      }

      const count = db.prepare('SELECT COUNT(*) as count FROM donations').get().count;
      const id = `#DON-${300 + count + 1}`;
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO donations (id, donor_name, donor_email, donor_phone, pan_number, amount, transfer_type, reference_number, receipt_status, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `);
      stmt.run(id, name, email, phone, pan, amount, transferType, reference, notes, now);

      const donation = db.prepare('SELECT * FROM donations WHERE id = ?').get(id);
      return sendJson(res, 200, {
        ok: true,
        id,
        amount: donation.amount,
        donation,
        message: 'Donation recorded successfully. An 80G tax receipt will be issued to your email.'
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Server error recording donation.' });
    }
  }

  // POST /api/volunteers/apply
  if (req.method === 'POST' && pathname === '/api/volunteers/apply') {
    const rateCheck = checkRateLimit(clientIp, 'volunteers-apply', 10, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      return sendJson(res, 429, {
        ok: false,
        error: 'Too many requests. Please wait a few minutes before submitting.'
      }, { 'Retry-After': String(Math.ceil(rateCheck.resetInMs / 1000)) });
    }

    try {
      const data = await parseJsonBody(req);

      const name = sanitizeString(data.full_name, 100);
      const phone = sanitizeString(data.phone, 25);
      const email = sanitizeString(data.email, 120);
      const skills = sanitizeString(data.skills, 250);
      const message = sanitizeString(data.message, 1500);

      if (!name || name.length < 2) {
        return sendJson(res, 400, { ok: false, error: 'Full name is required' });
      }
      if (!phone || !PHONE_REGEX.test(phone)) {
        return sendJson(res, 400, { ok: false, error: 'Valid phone number is required' });
      }
      if (!email || !EMAIL_REGEX.test(email)) {
        return sendJson(res, 400, { ok: false, error: 'Valid email address is required' });
      }

      const count = db.prepare('SELECT COUNT(*) as count FROM volunteers').get().count;
      const id = `#VOL-${150 + count + 1}`;
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO volunteers (id, full_name, phone, email, skills, message, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'new', ?)
      `);
      stmt.run(id, name, phone, email, skills, message, now);

      const volunteer = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(id);
      return sendJson(res, 200, {
        ok: true,
        id,
        volunteer,
        message: 'Thank you for stepping forward to serve! Miss Mumtaj will reach out to schedule an orientation.'
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Server error processing application.' });
    }
  }

  // POST /api/contacts/send
  if (req.method === 'POST' && pathname === '/api/contacts/send') {
    const rateCheck = checkRateLimit(clientIp, 'contacts-send', 10, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      return sendJson(res, 429, {
        ok: false,
        error: 'Too many requests. Please wait a few minutes before submitting.'
      }, { 'Retry-After': String(Math.ceil(rateCheck.resetInMs / 1000)) });
    }

    try {
      const data = await parseJsonBody(req);

      const name = sanitizeString(data.name, 100);
      const email = sanitizeString(data.email, 120);
      const subject = sanitizeString(data.subject, 150) || 'General Inquiry';
      const message = sanitizeString(data.message, 2000);

      if (!name || name.length < 2) {
        return sendJson(res, 400, { ok: false, error: 'Name is required' });
      }
      if (!email || !EMAIL_REGEX.test(email)) {
        return sendJson(res, 400, { ok: false, error: 'Valid email address is required' });
      }
      if (!message || message.length < 5) {
        return sendJson(res, 400, { ok: false, error: 'Message must be at least 5 characters' });
      }

      const count = db.prepare('SELECT COUNT(*) as count FROM contacts').get().count;
      const id = `#MSG-${880 + count + 1}`;
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO contacts (id, name, email, subject, message, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)
      `);
      stmt.run(id, name, email, subject, message, now);

      return sendJson(res, 200, {
        ok: true,
        id,
        message: 'Your inquiry has been received. Our office team will respond promptly.'
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Server error sending message.' });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // B. ADMIN AUTH & DASHBOARD APIS (Protected by Timing-Safe Auth)
  // ══════════════════════════════════════════════════════════════

  // POST /api/admin/login (Anti-Brute Force Protected)
  if (req.method === 'POST' && pathname === '/api/admin/login') {
    const rateCheck = checkRateLimit(clientIp, 'admin-login', 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return sendJson(res, 429, {
        ok: false,
        error: 'Too many failed login attempts. Account temporarily locked for 15 minutes.'
      }, { 'Retry-After': String(Math.ceil(rateCheck.resetInMs / 1000)) });
    }

    try {
      const data = await parseJsonBody(req);
      const usernameInput = sanitizeString(data.username, 50);
      const passwordInput = typeof data.password === 'string' ? data.password : '';

      const isUserValid = timingSafeCheck(usernameInput, ADMIN_USER);
      const isPassValid = timingSafeCheck(passwordInput, ADMIN_PASSWORD);

      if (isUserValid && isPassValid) {
        // Reset brute-force counter on successful login
        rateLimitStore.delete(`admin-login:${clientIp}`);

        const adminData = {
          name: ADMIN_NAME,
          role: ADMIN_ROLE,
          email: ADMIN_EMAIL
        };
        const token = generateSessionToken(adminData);

        return sendJson(res, 200, {
          ok: true,
          token,
          admin: adminData
        });
      }

      return sendJson(res, 401, { ok: false, error: 'Invalid username or password' });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Authentication service error' });
    }
  }

  // GET /api/admin/verify (Session validation)
  if (req.method === 'GET' && pathname === '/api/admin/verify') {
    const admin = verifyAuth(req);
    if (!admin) {
      return sendJson(res, 401, { ok: false, authenticated: false, error: 'Session expired or invalid' });
    }
    return sendJson(res, 200, { ok: true, authenticated: true, admin });
  }

  // POST /api/admin/logout
  if (req.method === 'POST' && pathname === '/api/admin/logout') {
    const auth = req.headers['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      activeSessions.delete(auth.substring(7).trim());
    }
    return sendJson(res, 200, { ok: true, message: 'Logged out successfully' });
  }

  // GET /api/admin/dashboard-stats
  if (req.method === 'GET' && pathname === '/api/admin/dashboard-stats') {
    if (!verifyAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    return sendJson(res, 200, { ok: true, stats: getStats() });
  }

  // GET, PUT, DELETE /api/admin/meals
  if (pathname === '/api/admin/meals') {
    if (!verifyAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });

    if (req.method === 'GET') {
      const meals = db.prepare('SELECT * FROM meals ORDER BY created_at DESC').all();
      return sendJson(res, 200, { ok: true, meals });
    }

    try {
      const data = await parseJsonBody(req);
      const id = sanitizeString(data.id, 20);
      if (!id) return sendJson(res, 400, { ok: false, error: 'Missing meal record id' });

      if (req.method === 'PUT') {
        const status = sanitizeString(data.payment_status, 20);
        db.prepare('UPDATE meals SET payment_status = ? WHERE id = ?').run(status, id);
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === 'DELETE') {
        db.prepare('DELETE FROM meals WHERE id = ?').run(id);
        return sendJson(res, 200, { ok: true });
      }
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Failed to update meal record' });
    }
  }

  // GET, PUT, DELETE /api/admin/donations
  if (pathname === '/api/admin/donations') {
    if (!verifyAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });

    if (req.method === 'GET') {
      const donations = db.prepare('SELECT * FROM donations ORDER BY created_at DESC').all();
      return sendJson(res, 200, { ok: true, donations });
    }

    try {
      const data = await parseJsonBody(req);
      const id = sanitizeString(data.id, 20);
      if (!id) return sendJson(res, 400, { ok: false, error: 'Missing donation record id' });

      if (req.method === 'PUT') {
        const status = sanitizeString(data.receipt_status, 20);
        db.prepare('UPDATE donations SET receipt_status = ? WHERE id = ?').run(status, id);
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === 'DELETE') {
        db.prepare('DELETE FROM donations WHERE id = ?').run(id);
        return sendJson(res, 200, { ok: true });
      }
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Failed to update donation record' });
    }
  }

  // GET, PUT, DELETE /api/admin/volunteers
  if (pathname === '/api/admin/volunteers') {
    if (!verifyAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });

    if (req.method === 'GET') {
      const volunteers = db.prepare('SELECT * FROM volunteers ORDER BY created_at DESC').all();
      return sendJson(res, 200, { ok: true, volunteers });
    }

    try {
      const data = await parseJsonBody(req);
      const id = sanitizeString(data.id, 20);
      if (!id) return sendJson(res, 400, { ok: false, error: 'Missing volunteer record id' });

      if (req.method === 'PUT') {
        const status = sanitizeString(data.status, 20);
        db.prepare('UPDATE volunteers SET status = ? WHERE id = ?').run(status, id);
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === 'DELETE') {
        db.prepare('DELETE FROM volunteers WHERE id = ?').run(id);
        return sendJson(res, 200, { ok: true });
      }
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Failed to update volunteer record' });
    }
  }

  // GET, PUT, DELETE /api/admin/contacts
  if (pathname === '/api/admin/contacts') {
    if (!verifyAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });

    if (req.method === 'GET') {
      const contacts = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();
      return sendJson(res, 200, { ok: true, contacts });
    }

    try {
      const data = await parseJsonBody(req);
      const id = sanitizeString(data.id, 20);
      if (!id) return sendJson(res, 400, { ok: false, error: 'Missing contact message id' });

      if (req.method === 'PUT') {
        db.prepare('UPDATE contacts SET is_read = ? WHERE id = ?').run(data.is_read ? 1 : 0, id);
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === 'DELETE') {
        db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
        return sendJson(res, 200, { ok: true });
      }
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Failed to update contact record' });
    }
  }

  // GET /api/admin/export-csv?type=...
  if (req.method === 'GET' && pathname === '/api/admin/export-csv') {
    if (!verifyAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    const type = sanitizeString(urlObj.searchParams.get('type') || 'meals', 20);
    let rows = [];
    let headers = [];

    if (type === 'meals') {
      rows = db.prepare('SELECT * FROM meals ORDER BY created_at DESC').all();
      headers = ['id', 'sponsor_name', 'sponsor_phone', 'sponsor_email', 'sponsor_date', 'occasion', 'selected_items', 'total_amount', 'payment_status', 'notes', 'created_at'];
    } else if (type === 'donations') {
      rows = db.prepare('SELECT * FROM donations ORDER BY created_at DESC').all();
      headers = ['id', 'donor_name', 'donor_email', 'donor_phone', 'pan_number', 'amount', 'transfer_type', 'reference_number', 'receipt_status', 'notes', 'created_at'];
    } else if (type === 'volunteers') {
      rows = db.prepare('SELECT * FROM volunteers ORDER BY created_at DESC').all();
      headers = ['id', 'full_name', 'phone', 'email', 'skills', 'message', 'status', 'created_at'];
    } else if (type === 'contacts') {
      rows = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();
      headers = ['id', 'name', 'email', 'subject', 'message', 'is_read', 'created_at'];
    }

    const csvContent = generateCsv(rows, headers);
    applySecurityHeaders(res);
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="premavasam_${type}_${new Date().toISOString().slice(0, 10)}.csv"`
    });
    return res.end(csvContent);
  }

  // ══════════════════════════════════════════════════════════════
  // C. HARDENED STATIC SERVING & PATH TRAVERSAL DEFENSE
  // ══════════════════════════════════════════════════════════════

  // Only GET & HEAD allowed for static assets
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    return res.end('405 Method Not Allowed');
  }

  const ROUTE_MAP = {
    '/': 'index.html',
    '/about': 'about.html',
    '/sponsormeals': 'sponsormeals.html',
    '/howhelp': 'howhelp.html',
    '/gallery': 'gallery.html',
    '/contact': 'contact.html',
    '/volunteers': 'volunteers.html',
    '/activities': 'activities.html',
    '/achievements': 'achievements.html',
    '/admin': 'admin.html'
  };

  let targetFile = ROUTE_MAP[pathname] || pathname;
  if (targetFile.startsWith('/')) targetFile = targetFile.substring(1);

  // Normalize path and resolve against PUBLIC_DIR
  const resolvedPath = path.resolve(PUBLIC_DIR, targetFile);

  // 1. Directory Traversal & Hidden Segment Defense
  if (!resolvedPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden: Access Denied');
  }

  const pathParts = targetFile.split(/[\/\\]/);
  if (pathParts.some(p => p.startsWith('.') || p.includes('..'))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden: Access to hidden files or directories is prohibited');
  }

  const baseName = path.basename(resolvedPath).toLowerCase();
  const ext = path.extname(resolvedPath).toLowerCase();

  // 2. Critical Defense: Block sensitive backend files, databases, source code, logs
  if (BLOCKED_FILES.has(baseName) || BLOCKED_EXTENSIONS.has(ext)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden: Access to protected server file is prohibited');
  }

  // 3. Block .js files in the root directory (only allow scripts under /js/ directory)
  if (ext === '.js' && path.dirname(resolvedPath) === PUBLIC_DIR) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden: Root scripts are not public');
  }

  // 4. Validate allowed file extension
  if (ext && !MIME_TYPES[ext]) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden: Unsupported file format');
  }

  fs.stat(resolvedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Clean URL HTML fallback (e.g. /about -> /about.html)
      if (!ext) {
        const htmlPath = resolvedPath + '.html';
        if (fs.existsSync(htmlPath)) {
          applySecurityHeaders(res);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return fs.createReadStream(htmlPath).pipe(res);
        }
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    applySecurityHeaders(res);

    // Cache headers for static assets
    const isAsset = ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.css' || ext === '.js' || ext === '.woff2';
    const cacheHeader = isAsset ? 'public, max-age=86400' : 'no-cache';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheHeader,
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN
    });

    if (req.method === 'HEAD') {
      return res.end();
    }

    fs.createReadStream(resolvedPath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`══════════════════════════════════════════════════════════════`);
  console.log(` [SECURE] Prema Vasam Full-Stack Server active on port ${PORT}`);
  console.log(` Environment: ${APP_ENV} | Host: 0.0.0.0`);
  console.log(` SQLite Database: Connected (WAL Mode Enabled)`);
  console.log(` Security: Path-traversal blocked, CSP active, Rate-limiting active`);
  console.log(`══════════════════════════════════════════════════════════════`);
});
