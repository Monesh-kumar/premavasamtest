/**
 * ══════════════════════════════════════════════════════════════════════
 * PREMA VASAM • Enterprise Full-Stack Web & API Server
 * Hardened Cyber Security • SQLite WAL • Anti-DoS • CSP • Domain-Ready
 * DevSecOps Hardened: AES-256-GCM Encryption • SQLite Persistent Sessions
 * ══════════════════════════════════════════════════════════════════════
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

// Universal .env file loader (supports Node.js >= 20.6 process.loadEnvFile and universal fallback)
function loadEnv() {
  const envCandidates = [
    path.join(__dirname, '.env'),
    path.join(process.cwd(), '.env')
  ];
  let loaded = false;
  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      if (typeof process.loadEnvFile === 'function') {
        try { process.loadEnvFile(envPath); loaded = true; } catch (_) {}
      }
      try {
        const raw = fs.readFileSync(envPath, 'utf8');
        raw.split(/\r?\n/).forEach(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx === -1) return;
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        });
        loaded = true;
      } catch (_) {}
      if (loaded) break;
    }
  }
}
loadEnv();

// ── CONFIGURATION & ENVIRONMENT ──
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const APP_ENV = process.env.NODE_ENV || 'production';
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || (APP_ENV === 'production' ? 'https://premavasam.org' : '*');

// Ensure database directory exists
const DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Admin Credentials (Set via environment variables in production)
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'prem$1999#vasam';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Premavasam Administrator';
const ADMIN_ROLE = process.env.ADMIN_ROLE || 'Superadmin';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'premavasam1999@gmail.com';
const SESSION_TTL_MS = (parseInt(process.env.SESSION_TTL_HOURS, 10) || 4) * 60 * 60 * 1000;

// ── 0. DATA ENCRYPTION AT REST: AES-256-GCM ──
let encryptionKey = null;
let rawKey = (process.env.DATA_ENCRYPTION_KEY || '').trim().replace(/^['"]|['"]$/g, '');

// If unset or invalid in process.env, inspect .env directly
if (!/^[0-9a-fA-F]{64}$/.test(rawKey)) {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const m = envContent.match(/DATA_ENCRYPTION_KEY\s*=\s*['"]?([0-9a-fA-F]{64})['"]?/);
      if (m) {
        rawKey = m[1];
        process.env.DATA_ENCRYPTION_KEY = rawKey;
      }
    } catch (_) {}
  }
}

// Self-healing: if still not set or invalid, generate cryptographically secure 256-bit key and persist to .env
if (!/^[0-9a-fA-F]{64}$/.test(rawKey)) {
  rawKey = crypto.randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = rawKey;
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      if (/DATA_ENCRYPTION_KEY\s*=/.test(content)) {
        content = content.replace(/DATA_ENCRYPTION_KEY\s*=.*/, `DATA_ENCRYPTION_KEY=${rawKey}`);
      } else {
        content += `\n# Native AES-256-GCM Data Encryption Key\nDATA_ENCRYPTION_KEY=${rawKey}\n`;
      }
      fs.writeFileSync(envPath, content, 'utf8');
    } else {
      const examplePath = path.join(__dirname, '.env.example');
      if (fs.existsSync(examplePath)) {
        let example = fs.readFileSync(examplePath, 'utf8');
        example = example.replace(/DATA_ENCRYPTION_KEY\s*=.*/, `DATA_ENCRYPTION_KEY=${rawKey}`);
        fs.writeFileSync(envPath, example, 'utf8');
      } else {
        fs.writeFileSync(envPath, `DATA_ENCRYPTION_KEY=${rawKey}\n`, 'utf8');
      }
    }
  } catch (_) {
    // In read-only filesystem environments, fallback to deterministic key
    rawKey = crypto.scryptSync(ADMIN_PASSWORD || 'premavasam_master_key', 'premavasam_pan_salt_2026', 32).toString('hex');
    process.env.DATA_ENCRYPTION_KEY = rawKey;
  }
}

encryptionKey = Buffer.from(rawKey, 'hex');

function encryptPan(plainPan) {
  if (!plainPan || typeof plainPan !== 'string') return '';
  const trimmed = plainPan.trim().toUpperCase();
  if (trimmed.startsWith('enc:v1:')) return trimmed; // already encrypted
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  let encrypted = cipher.update(trimmed, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `enc:v1:${iv.toString('hex')}:${tag}:${encrypted}`;
}

function decryptPan(cipherText) {
  if (!cipherText || typeof cipherText !== 'string') return '';
  if (!cipherText.startsWith('enc:v1:')) return cipherText; // legacy plaintext fallback
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 5) return '';
    const iv = Buffer.from(parts[2], 'hex');
    const tag = Buffer.from(parts[3], 'hex');
    const encrypted = parts[4];
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    appLog('error', 'PAN decryption failed', { error: err.message });
    return '[DECRYPTION_ERROR]';
  }
}

function maskPan(pan) {
  if (!pan) return '';
  const plain = decryptPan(pan);
  if (plain === '[DECRYPTION_ERROR]') return '*****';
  if (plain.length === 10) {
    return `${plain.slice(0, 5)}****${plain.slice(9)}`;
  }
  return plain.replace(/.(?=.{4})/g, '*');
}

// ── 0.5 STRUCTURED AUDIT LOGGING & SENSITIVE DATA REDACTION ──
const SENSITIVE_KEYS = new Set([
  'password', 'token', 'authorization', 'cookie', 'session',
  'pan', 'pan_number', 'pan_card', 'card', 'cvv', 'secret', 'data_encryption_key'
]);

function redactData(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactData);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      out[k] = redactData(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function appLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...redactData(meta)
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

// ── 1. DATABASE INITIALIZATION (SQLite WAL Mode & Concurrency Lock Timeout) ──
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA busy_timeout = 5000;'); // Queue concurrent writes up to 5 seconds
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
    privacy_consent INTEGER DEFAULT 1,
    privacy_consent_at TEXT,
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
    privacy_consent INTEGER DEFAULT 1,
    privacy_consent_at TEXT,
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

  CREATE TABLE IF NOT EXISTS guest_users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    iterations INTEGER DEFAULT 210000,
    algo TEXT DEFAULT 'sha512',
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'Guest',
    notes TEXT,
    created_at TEXT NOT NULL
  );

  -- Persistent SQLite Session Store (Survives Server Restarts)
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    username TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    ip_address TEXT,
    user_agent TEXT,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  -- Persistent Audit Trail for Administrative and Critical Actions
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    actor_username TEXT,
    actor_role TEXT,
    ip_address TEXT,
    details TEXT,
    created_at TEXT NOT NULL
  );

  -- Performance Indexes for Chronological Queries and Admin Metrics
  CREATE INDEX IF NOT EXISTS idx_meals_created ON meals(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_donations_created ON donations(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_volunteers_created ON volunteers(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_contacts_created ON contacts(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_contacts_unread ON contacts(is_read);
  CREATE INDEX IF NOT EXISTS idx_guest_users_created ON guest_users(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON admin_sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
`);

// Startup Migrations: Add schema columns if missing and encrypt existing plaintext PANs
(function runMigrations() {
  try {
    // 1. Guest Users iterations & algo columns
    const guestCols = db.prepare("PRAGMA table_info(guest_users)").all().map(c => c.name);
    if (!guestCols.includes('iterations')) {
      db.exec("ALTER TABLE guest_users ADD COLUMN iterations INTEGER DEFAULT 210000;");
    }
    if (!guestCols.includes('algo')) {
      db.exec("ALTER TABLE guest_users ADD COLUMN algo TEXT DEFAULT 'sha512';");
    }

    // 2. Privacy consent columns
    const donCols = db.prepare("PRAGMA table_info(donations)").all().map(c => c.name);
    if (!donCols.includes('privacy_consent')) {
      db.exec("ALTER TABLE donations ADD COLUMN privacy_consent INTEGER DEFAULT 1;");
      db.exec("ALTER TABLE donations ADD COLUMN privacy_consent_at TEXT;");
    }
    const volCols = db.prepare("PRAGMA table_info(volunteers)").all().map(c => c.name);
    if (!volCols.includes('privacy_consent')) {
      db.exec("ALTER TABLE volunteers ADD COLUMN privacy_consent INTEGER DEFAULT 1;");
      db.exec("ALTER TABLE volunteers ADD COLUMN privacy_consent_at TEXT;");
    }

    // 3. Encrypt legacy plaintext PAN numbers
    const unencrypted = db.prepare("SELECT id, pan_number FROM donations WHERE pan_number IS NOT NULL AND pan_number != '' AND pan_number NOT LIKE 'enc:v1:%'").all();
    if (unencrypted.length > 0) {
      const updateStmt = db.prepare("UPDATE donations SET pan_number = ? WHERE id = ?");
      for (const row of unencrypted) {
        updateStmt.run(encryptPan(row.pan_number), row.id);
      }
      appLog('info', `Encrypted ${unencrypted.length} legacy plaintext PAN record(s) with AES-256-GCM`);
    }
  } catch (err) {
    appLog('error', 'Migration error on startup', { error: err.message });
  }
})();

// Audit log recorder
function recordAuditLog(action, actorUsername, actorRole, ipAddress, details = {}) {
  try {
    const id = 'AUD-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const now = new Date().toISOString();
    const redactedDetails = JSON.stringify(redactData(details));
    db.prepare(`
      INSERT INTO audit_logs (id, action, actor_username, actor_role, ip_address, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, action, actorUsername || 'system', actorRole || 'System', ipAddress || 'unknown', redactedDetails, now);
  } catch (err) {
    appLog('error', 'Failed to record audit log', { error: err.message });
  }
}

// ── 2. CYBER SECURITY: RATE LIMITING & BRUTE FORCE SHIELD ──
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

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

// Explicit reverse proxy trust configuration (Nginx, Cloudflare)
const TRUST_PROXY = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1';
const TRUSTED_PROXIES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
if (process.env.TRUSTED_PROXIES) {
  process.env.TRUSTED_PROXIES.split(',').forEach(p => {
    const trimmed = p.trim();
    if (trimmed) TRUSTED_PROXIES.add(trimmed);
  });
}

function getClientIp(req) {
  const remote = (req.socket.remoteAddress || '127.0.0.1').replace(/^::ffff:/, '');
  if (TRUST_PROXY && TRUSTED_PROXIES.has(remote)) {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const clientIp = xForwardedFor.split(',')[0].trim().replace(/^::ffff:/, '');
      if (/^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/.test(clientIp) || /^[\da-fA-F:]{2,39}$/.test(clientIp)) {
        return clientIp;
      }
    }
  }
  return remote;
}

// ── 3. CYBER SECURITY: SECURE SESSIONS & TIMING-SAFE AUTH ──
function createSession(adminData, req) {
  const rawToken = 'pvs_' + crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  const clientIp = getClientIp(req);
  const userAgent = (req.headers['user-agent'] || '').slice(0, 200);

  db.prepare(`
    INSERT INTO admin_sessions (token_hash, admin_id, username, role, name, email, ip_address, user_agent, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(tokenHash, adminData.id || 'admin', adminData.username, adminData.role, adminData.name, adminData.email || '', clientIp, userAgent, expiresAt, now);

  const isProd = APP_ENV === 'production';
  const cookieHeader = `pvs_session=${rawToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${isProd ? '; Secure' : ''}`;

  return { rawToken, cookieHeader };
}

function pruneExpiredSessions() {
  try {
    db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(Date.now());
  } catch (_) {}
}

function hasActiveAdminSession(role = 'Superadmin') {
  pruneExpiredSessions();
  try {
    const row = db.prepare('SELECT 1 FROM admin_sessions WHERE role = ? AND expires_at > ? LIMIT 1').get(role, Date.now());
    return Boolean(row);
  } catch (_) {
    return false;
  }
}

function verifyAuth(req) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['cookie']) {
    const cookies = req.headers['cookie'].split(';');
    for (const c of cookies) {
      const [k, v] = c.trim().split('=');
      if (k === 'pvs_session' && v) {
        token = decodeURIComponent(v);
        break;
      }
    }
  }

  if (!token || typeof token !== 'string' || !token.startsWith('pvs_')) return false;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const now = Date.now();

  try {
    const session = db.prepare('SELECT * FROM admin_sessions WHERE token_hash = ? AND expires_at > ?').get(tokenHash, now);
    if (!session) return false;
    return {
      id: session.admin_id,
      username: session.username,
      name: session.name,
      role: session.role,
      email: session.email
    };
  } catch (err) {
    appLog('error', 'Session verification query failed', { error: err.message });
    return false;
  }
}

function revokeSession(req) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['cookie']) {
    const cookies = req.headers['cookie'].split(';');
    for (const c of cookies) {
      const [k, v] = c.trim().split('=');
      if (k === 'pvs_session' && v) {
        token = decodeURIComponent(v);
        break;
      }
    }
  }
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    try {
      db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
    } catch (_) {}
  }
}

// Password Hashing with OWASP PBKDF2-HMAC-SHA512 (210,000 iterations)
function hashGuestPassword(password, salt = crypto.randomBytes(16).toString('hex'), iterations = 210000) {
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
  return { hash, salt, iterations, algo: 'sha512' };
}

function verifyGuestPassword(password, storedHash, salt, iterations = 210000) {
  if (typeof password !== 'string' || typeof storedHash !== 'string' || typeof salt !== 'string') {
    return { valid: false, needsRehash: false };
  }
  const iters = parseInt(iterations, 10) || 10000;
  const hash = crypto.pbkdf2Sync(password, salt, iters, 64, 'sha512').toString('hex');
  try {
    const valid = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
    return { valid, needsRehash: valid && iters < 210000 };
  } catch (_) {
    return { valid: false, needsRehash: false };
  }
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
    .replace(/\0/g, '') // Strip null bytes
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

// ── 5. CYBER SECURITY: SECURE HTTP HEADERS & CORS ──
function getCorsOrigin(reqOrigin) {
  if (APP_ENV !== 'production' && ALLOWED_ORIGIN === '*') {
    return '*';
  }
  if (reqOrigin && (reqOrigin === ALLOWED_ORIGIN || reqOrigin === 'https://premavasam.org' || reqOrigin === 'https://www.premavasam.org')) {
    return reqOrigin;
  }
  return ALLOWED_ORIGIN !== '*' ? ALLOWED_ORIGIN : 'https://premavasam.org';
}

function applySecurityHeaders(res, reqOrigin = null) {
  const originToReflect = getCorsOrigin(reqOrigin);

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    "connect-src 'self' " + (originToReflect !== '*' ? originToReflect : ''),
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://www.google.com https://maps.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.removeHeader('X-Powered-By');
  res.removeHeader('X-XSS-Protection'); // Deprecated header removed
}

function sendJson(res, statusCode, data, extraHeaders = {}, reqOrigin = null) {
  applySecurityHeaders(res, reqOrigin);
  const allowOrigin = getCorsOrigin(reqOrigin);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
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
        // Prototype pollution defense
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

// ── 6.5 UNIQUE ID GENERATOR (Collision-Safe) ──
function generateId(table, prefix, baseOffset) {
  const rows = db.prepare(`SELECT id FROM ${table}`).all();
  let maxNum = baseOffset;
  for (const r of rows) {
    if (r.id && r.id.startsWith(prefix + '-')) {
      const n = parseInt(r.id.slice(prefix.length + 1), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  let candidate = `${prefix}-${maxNum + 1}`;
  let attempt = maxNum + 1;
  while (db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(candidate)) {
    attempt++;
    candidate = `${prefix}-${attempt}`;
  }
  return candidate;
}

// ── 7. PUBLIC STATS COMPUTATION (Aggregate-Only, ZERO PII Exposure) ──
function getPublicStats() {
  const mealStats = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total FROM meals').get();
  const donStats = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM donations').get();
  const conStats = db.prepare('SELECT COUNT(*) as count FROM contacts').get();
  const volStats = db.prepare('SELECT COUNT(*) as count FROM volunteers').get();

  const mealTotal = Number(mealStats.total) || 0;
  const donTotal = Number(donStats.total) || 0;

  // Strict aggregate numbers only - NO donor names, emails, phones or reference numbers
  return {
    totalChildren: 200,
    specialChildren: 132,
    establishedYear: 1999,
    status: 'active',
    totalPledgedAmount: mealTotal + donTotal,
    mealTotalAmount: mealTotal,
    contribTotalAmount: donTotal,
    mealPledgesReceived: mealStats.count,
    contributionsReceived: donStats.count,
    donationsCount: donStats.count,
    contactMessagesReceived: conStats.count,
    volunteersCount: volStats.count,
    totalFunds: mealTotal + donTotal,
    mealsCount: mealStats.count
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
      // Mitigate CSV / Excel Formula Injection (=, +, -, @, \t, \r)
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
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const BLOCKED_EXTENSIONS = new Set([
  '.sqlite', '.sqlite-shm', '.sqlite-wal', '.db', '.db-shm', '.db-wal',
  '.env', '.git', '.gitignore', '.log', '.md', '.bak', '.tar', '.zip', '.gz',
  '.example', '.conf', '.yaml', '.yml'
]);

const BLOCKED_FILES = new Set([
  'server.js', 'package.json', 'package-lock.json', 'test_suite.js',
  'security_audit_test.js', 'test_runner.js', 'backup.js',
  'database.sqlite', 'database.sqlite-shm', 'database.sqlite-wal',
  'ecosystem.config.js', 'nginx.conf.example', '.env', '.env.example'
]);

// ── 10. MAIN HTTP REQUEST DISPATCHER ──
const server = http.createServer(async (req, res) => {
  const clientIp = getClientIp(req);
  const reqOrigin = req.headers['origin'];

  // HTTPS Redirection for reverse-proxy deployments
  if (APP_ENV === 'production' && req.headers['x-forwarded-proto'] === 'http') {
    res.writeHead(301, {
      'Location': `https://${req.headers.host}${req.url}`
    });
    return res.end();
  }

  // CORS Preflight Handler
  if (req.method === 'OPTIONS') {
    applySecurityHeaders(res, reqOrigin);
    res.writeHead(204, {
      'Access-Control-Allow-Origin': getCorsOrigin(reqOrigin),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
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
  // A. PUBLIC APIS (Protected by Rate Limiting & Zero PII Exposure)
  // ══════════════════════════════════════════════════════════════

  // GET /api/health
  if (req.method === 'GET' && pathname === '/api/health') {
    try {
      const ping = db.prepare('SELECT 1 AS alive').get();
      if (!ping || ping.alive !== 1) throw new Error('Database ping failed');
      return sendJson(res, 200, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        database: 'connected',
        environment: APP_ENV,
        version: '2.1.0'
      }, {}, reqOrigin);
    } catch (err) {
      appLog('error', 'Health check probe failed', { error: err.message });
      return sendJson(res, 503, {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: err.message
      }, {}, reqOrigin);
    }
  }

  // GET /api/stats (Public Statistics - STRICTLY AGGREGATE ONLY, SEC-01)
  if (req.method === 'GET' && pathname === '/api/stats') {
    return sendJson(res, 200, getPublicStats(), {}, reqOrigin);
  }

  // POST /api/meals/book
  if (req.method === 'POST' && pathname === '/api/meals/book') {
    const rateCheck = checkRateLimit(clientIp, 'meals-book', 30, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      return sendJson(res, 429, {
        ok: false,
        error: 'Too many requests. Please wait before submitting another booking.'
      }, { 'Retry-After': String(Math.ceil(rateCheck.resetInMs / 1000)) }, reqOrigin);
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
        return sendJson(res, 400, { ok: false, error: 'Valid sponsor name is required' }, {}, reqOrigin);
      }
      if (!phone || !PHONE_REGEX.test(phone)) {
        return sendJson(res, 400, { ok: false, error: 'Valid contact phone number is required' }, {}, reqOrigin);
      }
      if (email && !EMAIL_REGEX.test(email)) {
        return sendJson(res, 400, { ok: false, error: 'Invalid email address format' }, {}, reqOrigin);
      }
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return sendJson(res, 400, { ok: false, error: 'Valid sponsorship date (YYYY-MM-DD) is required' }, {}, reqOrigin);
      }
      if (isNaN(amount) || amount <= 0 || amount > 10000000) {
        return sendJson(res, 400, { ok: false, error: 'Invalid sponsorship amount' }, {}, reqOrigin);
      }

      const id = generateId('meals', '#MB', 2800);
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO meals (id, sponsor_name, sponsor_phone, sponsor_email, sponsor_date, occasion, selected_items, total_amount, payment_status, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `);
      stmt.run(id, name, phone, email, date, occasion, selectedItems, amount, notes, now);

      recordAuditLog('MEAL_BOOKED', name, 'Sponsor', clientIp, { id, amount, date });

      return sendJson(res, 200, {
        ok: true,
        id,
        message: 'Meal reservation recorded with heartfelt gratitude. Official confirmation will be shared promptly.'
      }, {}, reqOrigin);
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Server error processing meal reservation.' }, {}, reqOrigin);
    }
  }

  // POST /api/donations/record (AES-256-GCM Encrypted PAN, SEC-04)
  if (req.method === 'POST' && pathname === '/api/donations/record') {
    const rateCheck = checkRateLimit(clientIp, 'donations-record', 30, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      return sendJson(res, 429, {
        ok: false,
        error: 'Too many requests. Please wait a few minutes before submitting.'
      }, { 'Retry-After': String(Math.ceil(rateCheck.resetInMs / 1000)) }, reqOrigin);
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
      const consent = data.privacy_consent === false ? 0 : 1;
      const consentAt = new Date().toISOString();

      if (!name || name.length < 2) {
        return sendJson(res, 400, { ok: false, error: 'Valid donor name is required' }, {}, reqOrigin);
      }
      if (!email || !EMAIL_REGEX.test(email)) {
        return sendJson(res, 400, { ok: false, error: 'Valid donor email is required' }, {}, reqOrigin);
      }
      if (phone && !PHONE_REGEX.test(phone)) {
        return sendJson(res, 400, { ok: false, error: 'Invalid phone number format' }, {}, reqOrigin);
      }
      if (pan && !PAN_REGEX.test(pan)) {
        return sendJson(res, 400, { ok: false, error: 'Invalid Indian PAN card format (e.g. ABCDE1234F)' }, {}, reqOrigin);
      }
      if (isNaN(amount) || amount <= 0 || amount > 50000000) {
        return sendJson(res, 400, { ok: false, error: 'Valid positive donation amount is required' }, {}, reqOrigin);
      }

      const id = generateId('donations', '#DON', 300);
      const now = new Date().toISOString();
      const encryptedPan = pan ? encryptPan(pan) : null;

      const stmt = db.prepare(`
        INSERT INTO donations (id, donor_name, donor_email, donor_phone, pan_number, amount, transfer_type, reference_number, receipt_status, notes, privacy_consent, privacy_consent_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
      `);
      stmt.run(id, name, email, phone, encryptedPan, amount, transferType, reference, notes, consent, consentAt, now);

      recordAuditLog('DONATION_RECORDED', name, 'Donor', clientIp, { id, amount, transferType });

      return sendJson(res, 200, {
        ok: true,
        id,
        amount,
        donation: {
          id,
          donor_name: name,
          donor_email: email,
          donor_phone: phone,
          pan_number: pan ? maskPan(pan) : '',
          amount,
          transfer_type: transferType,
          reference_number: reference,
          receipt_status: 'pending',
          created_at: now
        },
        message: 'Donation recorded successfully. An 80G tax receipt will be issued to your email.'
      }, {}, reqOrigin);
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Server error recording donation.' }, {}, reqOrigin);
    }
  }

  // POST /api/volunteers/apply
  if (req.method === 'POST' && pathname === '/api/volunteers/apply') {
    const rateCheck = checkRateLimit(clientIp, 'volunteers-apply', 30, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      return sendJson(res, 429, {
        ok: false,
        error: 'Too many requests. Please wait a few minutes before submitting.'
      }, { 'Retry-After': String(Math.ceil(rateCheck.resetInMs / 1000)) }, reqOrigin);
    }

    try {
      const data = await parseJsonBody(req);

      const name = sanitizeString(data.full_name, 100);
      const phone = sanitizeString(data.phone, 25);
      const email = sanitizeString(data.email, 120);
      const skills = sanitizeString(data.skills, 250);
      const message = sanitizeString(data.message, 1500);
      const consent = data.privacy_consent === false ? 0 : 1;
      const consentAt = new Date().toISOString();

      if (!name || name.length < 2) {
        return sendJson(res, 400, { ok: false, error: 'Full name is required' }, {}, reqOrigin);
      }
      if (!phone || !PHONE_REGEX.test(phone)) {
        return sendJson(res, 400, { ok: false, error: 'Valid phone number is required' }, {}, reqOrigin);
      }
      if (!email || !EMAIL_REGEX.test(email)) {
        return sendJson(res, 400, { ok: false, error: 'Valid email address is required' }, {}, reqOrigin);
      }

      const id = generateId('volunteers', '#VOL', 150);
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO volunteers (id, full_name, phone, email, skills, message, status, privacy_consent, privacy_consent_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)
      `);
      stmt.run(id, name, phone, email, skills, message, consent, consentAt, now);

      recordAuditLog('VOLUNTEER_APPLIED', name, 'Volunteer', clientIp, { id, skills });

      return sendJson(res, 200, {
        ok: true,
        id,
        message: 'Thank you for stepping forward to serve! Miss Mumtaj will reach out to schedule an orientation.'
      }, {}, reqOrigin);
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Server error processing application.' }, {}, reqOrigin);
    }
  }

  // POST /api/contacts/send
  if (req.method === 'POST' && pathname === '/api/contacts/send') {
    const rateCheck = checkRateLimit(clientIp, 'contacts-send', 30, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      return sendJson(res, 429, {
        ok: false,
        error: 'Too many requests. Please wait a few minutes before submitting.'
      }, { 'Retry-After': String(Math.ceil(rateCheck.resetInMs / 1000)) }, reqOrigin);
    }

    try {
      const data = await parseJsonBody(req);

      const name = sanitizeString(data.name, 100);
      const email = sanitizeString(data.email, 120);
      const subject = sanitizeString(data.subject, 150) || 'General Inquiry';
      const message = sanitizeString(data.message, 2000);

      if (!name || name.length < 2) {
        return sendJson(res, 400, { ok: false, error: 'Name is required' }, {}, reqOrigin);
      }
      if (!email || !EMAIL_REGEX.test(email)) {
        return sendJson(res, 400, { ok: false, error: 'Valid email address is required' }, {}, reqOrigin);
      }
      if (!message || message.length < 5) {
        return sendJson(res, 400, { ok: false, error: 'Message must be at least 5 characters' }, {}, reqOrigin);
      }

      const id = generateId('contacts', '#MSG', 880);
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO contacts (id, name, email, subject, message, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)
      `);
      stmt.run(id, name, email, subject, message, now);

      recordAuditLog('CONTACT_SENT', name, 'Visitor', clientIp, { id, subject });

      return sendJson(res, 200, {
        ok: true,
        id,
        message: 'Your inquiry has been received. Our office team will respond promptly.'
      }, {}, reqOrigin);
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Server error sending message.' }, {}, reqOrigin);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // B. ADMIN AUTH & DASHBOARD APIS (SQLite Sessions & OWASP PBKDF2)
  // ══════════════════════════════════════════════════════════════

  // POST /api/admin/login
  if (req.method === 'POST' && pathname === '/api/admin/login') {
    const rateCheck = checkRateLimit(clientIp, 'admin-login', 10, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      recordAuditLog('ADMIN_LOGIN_LOCKED', 'unknown', 'Guest', clientIp, { resetInMs: rateCheck.resetInMs });
      return sendJson(res, 429, {
        ok: false,
        error: 'Too many failed login attempts. Account temporarily locked for 15 minutes.'
      }, { 'Retry-After': String(Math.ceil(rateCheck.resetInMs / 1000)) }, reqOrigin);
    }

    try {
      const data = await parseJsonBody(req);
      const usernameInput = sanitizeString(data.username, 50).toLowerCase();
      const passwordInput = typeof data.password === 'string' ? data.password.trim() : '';

      const isUserValid = timingSafeCheck(usernameInput, ADMIN_USER.toLowerCase()) || timingSafeCheck(usernameInput, ADMIN_EMAIL.toLowerCase());
      const isPassValid = timingSafeCheck(passwordInput, ADMIN_PASSWORD.trim());

      if (isUserValid && isPassValid) {
        rateLimitStore.delete(`admin-login:${clientIp}`);

        const forceLogin = Boolean(data.forceLogin);
        const existingSessions = hasActiveAdminSession('Superadmin');

        if (existingSessions && !forceLogin) {
          return sendJson(res, 409, {
            ok: false,
            sessionConflict: true,
            error: 'An active admin session already exists.',
            message: 'An active session is currently running on another browser or device. Would you like to cancel the previous session and sign in here?'
          }, {}, reqOrigin);
        }

        if (existingSessions && forceLogin) {
          db.prepare("DELETE FROM admin_sessions WHERE role = 'Superadmin'").run();
        }

        const adminData = {
          id: 'admin',
          name: ADMIN_NAME,
          role: ADMIN_ROLE,
          email: ADMIN_EMAIL,
          username: ADMIN_USER
        };
        const { rawToken, cookieHeader } = createSession(adminData, req);

        recordAuditLog('ADMIN_LOGIN_SUCCESS', ADMIN_USER, ADMIN_ROLE, clientIp, { previousSessionTerminated: Boolean(existingSessions && forceLogin) });

        return sendJson(res, 200, {
          ok: true,
          token: rawToken,
          admin: adminData,
          previousSessionTerminated: Boolean(existingSessions && forceLogin)
        }, { 'Set-Cookie': cookieHeader }, reqOrigin);
      }

      // Check Guest Users credentials
      try {
        const guestUser = db.prepare('SELECT * FROM guest_users WHERE lower(username) = ?').get(usernameInput);
        if (guestUser) {
          const verifyResult = verifyGuestPassword(passwordInput, guestUser.password_hash, guestUser.salt, guestUser.iterations || 10000);
          if (verifyResult.valid) {
            rateLimitStore.delete(`admin-login:${clientIp}`);

            // Upgrade iteration count if legacy
            if (verifyResult.needsRehash) {
              const upgraded = hashGuestPassword(passwordInput);
              db.prepare('UPDATE guest_users SET password_hash = ?, salt = ?, iterations = 210000 WHERE id = ?')
                .run(upgraded.hash, upgraded.salt, guestUser.id);
            }

            const guestData = {
              id: guestUser.id,
              name: guestUser.full_name,
              role: 'Guest',
              username: guestUser.username,
              notes: guestUser.notes
            };
            const { rawToken, cookieHeader } = createSession(guestData, req);

            recordAuditLog('GUEST_LOGIN_SUCCESS', guestUser.username, 'Guest', clientIp, {});

            return sendJson(res, 200, {
              ok: true,
              token: rawToken,
              admin: guestData,
              previousSessionTerminated: false
            }, { 'Set-Cookie': cookieHeader }, reqOrigin);
          }
        }
      } catch (guestErr) {
        appLog('warn', 'Error verifying guest user credentials', { error: guestErr.message });
      }

      recordAuditLog('ADMIN_LOGIN_FAILED', usernameInput, 'Unknown', clientIp, {});
      return sendJson(res, 401, { ok: false, error: 'Invalid username or password' }, {}, reqOrigin);
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Authentication service error' }, {}, reqOrigin);
    }
  }

  // GET /api/admin/verify (Session validation)
  if (req.method === 'GET' && pathname === '/api/admin/verify') {
    const admin = verifyAuth(req);
    if (!admin) {
      return sendJson(res, 401, { ok: false, authenticated: false, error: 'Session expired or invalid' }, {}, reqOrigin);
    }
    return sendJson(res, 200, { ok: true, authenticated: true, admin }, {}, reqOrigin);
  }

  // POST /api/admin/logout
  if (req.method === 'POST' && pathname === '/api/admin/logout') {
    const admin = verifyAuth(req);
    if (admin) {
      recordAuditLog('ADMIN_LOGOUT', admin.username, admin.role, clientIp, {});
    }
    revokeSession(req);
    const clearCookie = `pvs_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${APP_ENV === 'production' ? '; Secure' : ''}`;
    return sendJson(res, 200, { ok: true, message: 'Logged out successfully' }, { 'Set-Cookie': clearCookie }, reqOrigin);
  }

  // GET /api/admin/dashboard-stats (Authenticated Dashboard Stats with Masked Recent Donations)
  if (req.method === 'GET' && pathname === '/api/admin/dashboard-stats') {
    if (!verifyAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' }, {}, reqOrigin);

    const rawRecent = db.prepare('SELECT id, donor_name, donor_phone, donor_email, pan_number, amount, transfer_type, reference_number, receipt_status, created_at FROM donations ORDER BY created_at DESC LIMIT 5').all();
    const maskedRecent = rawRecent.map(d => ({
      ...d,
      pan_number: maskPan(d.pan_number)
    }));

    const conStats = db.prepare('SELECT COUNT(*) as count, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread FROM contacts').get();
    const fullStats = {
      ...getPublicStats(),
      unreadContacts: conStats.unread || 0,
      newMessages: conStats.unread || 0,
      recentDonations: maskedRecent
    };

    return sendJson(res, 200, { ok: true, stats: fullStats }, {}, reqOrigin);
  }

  // GET, PUT, DELETE /api/admin/meals
  if (pathname === '/api/admin/meals') {
    const admin = verifyAuth(req);
    if (!admin) return sendJson(res, 401, { ok: false, error: 'Unauthorized' }, {}, reqOrigin);

    if (req.method === 'GET') {
      const meals = db.prepare('SELECT * FROM meals ORDER BY created_at DESC').all();
      return sendJson(res, 200, { ok: true, meals }, {}, reqOrigin);
    }

    if (admin.role === 'Guest') {
      return sendJson(res, 403, { ok: false, error: 'Guest accounts have view-only permissions.' }, {}, reqOrigin);
    }

    try {
      const data = await parseJsonBody(req);
      const id = sanitizeString(data.id, 20);
      if (!id) return sendJson(res, 400, { ok: false, error: 'Missing meal record id' }, {}, reqOrigin);

      if (req.method === 'PUT') {
        const status = sanitizeString(data.payment_status, 20);
        db.prepare('UPDATE meals SET payment_status = ? WHERE id = ?').run(status, id);
        recordAuditLog('MEAL_UPDATED', admin.username, admin.role, clientIp, { id, status });
        return sendJson(res, 200, { ok: true }, {}, reqOrigin);
      }
      if (req.method === 'DELETE') {
        db.prepare('DELETE FROM meals WHERE id = ?').run(id);
        recordAuditLog('MEAL_DELETED', admin.username, admin.role, clientIp, { id });
        return sendJson(res, 200, { ok: true }, {}, reqOrigin);
      }
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Failed to update meal record' }, {}, reqOrigin);
    }
  }

  // GET, PUT, DELETE /api/admin/donations (Masked PAN display)
  if (pathname === '/api/admin/donations') {
    const admin = verifyAuth(req);
    if (!admin) return sendJson(res, 401, { ok: false, error: 'Unauthorized' }, {}, reqOrigin);

    if (req.method === 'GET') {
      const rawDonations = db.prepare('SELECT * FROM donations ORDER BY created_at DESC').all();
      const donations = rawDonations.map(d => ({
        ...d,
        pan_number: maskPan(d.pan_number)
      }));
      return sendJson(res, 200, { ok: true, donations }, {}, reqOrigin);
    }

    if (admin.role === 'Guest') {
      return sendJson(res, 403, { ok: false, error: 'Guest accounts have view-only permissions.' }, {}, reqOrigin);
    }

    try {
      const data = await parseJsonBody(req);
      const id = sanitizeString(data.id, 20);
      if (!id) return sendJson(res, 400, { ok: false, error: 'Missing donation record id' }, {}, reqOrigin);

      if (req.method === 'PUT') {
        const status = sanitizeString(data.receipt_status, 20);
        db.prepare('UPDATE donations SET receipt_status = ? WHERE id = ?').run(status, id);
        recordAuditLog('DONATION_UPDATED', admin.username, admin.role, clientIp, { id, status });
        return sendJson(res, 200, { ok: true }, {}, reqOrigin);
      }
      if (req.method === 'DELETE') {
        db.prepare('DELETE FROM donations WHERE id = ?').run(id);
        recordAuditLog('DONATION_DELETED', admin.username, admin.role, clientIp, { id });
        return sendJson(res, 200, { ok: true }, {}, reqOrigin);
      }
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Failed to update donation record' }, {}, reqOrigin);
    }
  }

  // GET, PUT, DELETE /api/admin/volunteers
  if (pathname === '/api/admin/volunteers') {
    const admin = verifyAuth(req);
    if (!admin) return sendJson(res, 401, { ok: false, error: 'Unauthorized' }, {}, reqOrigin);

    if (req.method === 'GET') {
      const volunteers = db.prepare('SELECT * FROM volunteers ORDER BY created_at DESC').all();
      return sendJson(res, 200, { ok: true, volunteers }, {}, reqOrigin);
    }

    if (admin.role === 'Guest') {
      return sendJson(res, 403, { ok: false, error: 'Guest accounts have view-only permissions.' }, {}, reqOrigin);
    }

    try {
      const data = await parseJsonBody(req);
      const id = sanitizeString(data.id, 20);
      if (!id) return sendJson(res, 400, { ok: false, error: 'Missing volunteer record id' }, {}, reqOrigin);

      if (req.method === 'PUT') {
        const status = sanitizeString(data.status, 20);
        db.prepare('UPDATE volunteers SET status = ? WHERE id = ?').run(status, id);
        recordAuditLog('VOLUNTEER_UPDATED', admin.username, admin.role, clientIp, { id, status });
        return sendJson(res, 200, { ok: true }, {}, reqOrigin);
      }
      if (req.method === 'DELETE') {
        db.prepare('DELETE FROM volunteers WHERE id = ?').run(id);
        recordAuditLog('VOLUNTEER_DELETED', admin.username, admin.role, clientIp, { id });
        return sendJson(res, 200, { ok: true }, {}, reqOrigin);
      }
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Failed to update volunteer record' }, {}, reqOrigin);
    }
  }

  // GET, PUT, DELETE /api/admin/contacts
  if (pathname === '/api/admin/contacts') {
    const admin = verifyAuth(req);
    if (!admin) return sendJson(res, 401, { ok: false, error: 'Unauthorized' }, {}, reqOrigin);

    if (req.method === 'GET') {
      const contacts = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();
      return sendJson(res, 200, { ok: true, contacts }, {}, reqOrigin);
    }

    if (admin.role === 'Guest') {
      return sendJson(res, 403, { ok: false, error: 'Guest accounts have view-only permissions.' }, {}, reqOrigin);
    }

    try {
      const data = await parseJsonBody(req);
      const id = sanitizeString(data.id, 20);
      if (!id) return sendJson(res, 400, { ok: false, error: 'Missing contact message id' }, {}, reqOrigin);

      if (req.method === 'PUT') {
        db.prepare('UPDATE contacts SET is_read = ? WHERE id = ?').run(data.is_read ? 1 : 0, id);
        return sendJson(res, 200, { ok: true }, {}, reqOrigin);
      }
      if (req.method === 'DELETE') {
        db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
        recordAuditLog('CONTACT_DELETED', admin.username, admin.role, clientIp, { id });
        return sendJson(res, 200, { ok: true }, {}, reqOrigin);
      }
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Failed to update contact record' }, {}, reqOrigin);
    }
  }

  // ── GUEST USER MANAGEMENT (Superadmin Only) ──
  // GET /api/admin/guest-users
  if (req.method === 'GET' && pathname === '/api/admin/guest-users') {
    const admin = verifyAuth(req);
    if (!admin) return sendJson(res, 401, { ok: false, error: 'Unauthorized' }, {}, reqOrigin);

    try {
      const guests = db.prepare('SELECT id, username, full_name, role, notes, created_at FROM guest_users ORDER BY created_at DESC').all();
      return sendJson(res, 200, { ok: true, guests }, {}, reqOrigin);
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Failed to retrieve guest users: ' + e.message }, {}, reqOrigin);
    }
  }

  // POST /api/admin/guest-users (210,000 Iterations PBKDF2)
  if (req.method === 'POST' && pathname === '/api/admin/guest-users') {
    const admin = verifyAuth(req);
    if (!admin) return sendJson(res, 401, { ok: false, error: 'Unauthorized' }, {}, reqOrigin);
    if (admin.role !== 'Superadmin') {
      return sendJson(res, 403, { ok: false, error: 'Only Superadmin can create guest user accounts.' }, {}, reqOrigin);
    }

    try {
      const data = await parseJsonBody(req);
      const username = sanitizeString(data.username, 30).trim().toLowerCase();
      const fullName = sanitizeString(data.full_name, 100).trim();
      const password = typeof data.password === 'string' ? data.password.trim() : '';
      const notes = sanitizeString(data.notes, 250).trim();

      if (!username || username.length < 3 || !/^[a-zA-Z0-9_\-\.]+$/.test(username)) {
        return sendJson(res, 400, { ok: false, error: 'Username must be at least 3 characters and contain only letters, numbers, hyphens, dots, or underscores.' }, {}, reqOrigin);
      }
      if (!fullName || fullName.length < 2) {
        return sendJson(res, 400, { ok: false, error: 'Full name must be at least 2 characters.' }, {}, reqOrigin);
      }
      if (!password || password.length < 8) {
        return sendJson(res, 400, { ok: false, error: 'Password must be at least 8 characters for security.' }, {}, reqOrigin);
      }

      if (username === ADMIN_USER.toLowerCase() || username === ADMIN_EMAIL.toLowerCase()) {
        return sendJson(res, 400, { ok: false, error: 'Username is reserved by system administrator.' }, {}, reqOrigin);
      }

      const existing = db.prepare('SELECT id FROM guest_users WHERE lower(username) = ?').get(username);
      if (existing) {
        return sendJson(res, 409, { ok: false, error: 'A guest user with this username already exists.' }, {}, reqOrigin);
      }

      const id = generateId('guest_users', '#GST', 100);
      const now = new Date().toISOString();
      const { hash, salt, iterations, algo } = hashGuestPassword(password, undefined, 210000);

      db.prepare(`
        INSERT INTO guest_users (id, username, password_hash, salt, iterations, algo, full_name, role, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Guest', ?, ?)
      `).run(id, username, hash, salt, iterations, algo, fullName, notes, now);

      recordAuditLog('GUEST_USER_CREATED', admin.username, admin.role, clientIp, { createdUsername: username, id });

      return sendJson(res, 201, {
        ok: true,
        guest: {
          id,
          username,
          full_name: fullName,
          role: 'Guest',
          notes,
          created_at: now
        },
        message: 'Guest user created successfully.'
      }, {}, reqOrigin);
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Failed to create guest user: ' + e.message }, {}, reqOrigin);
    }
  }

  // DELETE /api/admin/guest-users
  if (req.method === 'DELETE' && pathname === '/api/admin/guest-users') {
    const admin = verifyAuth(req);
    if (!admin) return sendJson(res, 401, { ok: false, error: 'Unauthorized' }, {}, reqOrigin);
    if (admin.role !== 'Superadmin') {
      return sendJson(res, 403, { ok: false, error: 'Only Superadmin can revoke guest accounts.' }, {}, reqOrigin);
    }

    try {
      const data = await parseJsonBody(req);
      const id = sanitizeString(data.id, 20);
      if (!id) return sendJson(res, 400, { ok: false, error: 'Missing guest user id' }, {}, reqOrigin);

      // Invalidate active sessions for this user
      db.prepare('DELETE FROM admin_sessions WHERE admin_id = ?').run(id);

      db.prepare('DELETE FROM guest_users WHERE id = ?').run(id);
      recordAuditLog('GUEST_USER_REVOKED', admin.username, admin.role, clientIp, { id });

      return sendJson(res, 200, { ok: true, message: 'Guest user access revoked successfully.' }, {}, reqOrigin);
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: 'Failed to revoke guest user: ' + e.message }, {}, reqOrigin);
    }
  }

  // /api/admin/clear-all (Authenticated Purge of Test Data)
  if (pathname === '/api/admin/clear-all') {
    const authAdmin = verifyAuth(req);
    if (!authAdmin) return sendJson(res, 401, { ok: false, error: 'Unauthorized' }, {}, reqOrigin);
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' }, {}, reqOrigin);
    if (authAdmin.role === 'Guest') {
      return sendJson(res, 403, { ok: false, error: 'Guest accounts have view-only permissions.' }, {}, reqOrigin);
    }
    try {
      db.prepare('DELETE FROM meals').run();
      db.prepare('DELETE FROM donations').run();
      db.prepare('DELETE FROM volunteers').run();
      db.prepare('DELETE FROM contacts').run();
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      recordAuditLog('ADMIN_CLEARED_ALL_DATA', authAdmin.username, authAdmin.role, clientIp, {});
      return sendJson(res, 200, { ok: true, message: 'All database records cleared successfully' }, {}, reqOrigin);
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: 'Failed to clear records: ' + err.message }, {}, reqOrigin);
    }
  }

  // GET /api/admin/export-csv?type=... (Decrypted PAN for Official 80G Tax Submissions)
  if (req.method === 'GET' && pathname === '/api/admin/export-csv') {
    const admin = verifyAuth(req);
    if (!admin) return sendJson(res, 401, { ok: false, error: 'Unauthorized' }, {}, reqOrigin);
    const type = sanitizeString(urlObj.searchParams.get('type') || 'meals', 20);
    let rows = [];
    let headers = [];

    if (type === 'meals') {
      rows = db.prepare('SELECT * FROM meals ORDER BY created_at DESC').all();
      headers = ['id', 'sponsor_name', 'sponsor_phone', 'sponsor_email', 'sponsor_date', 'occasion', 'selected_items', 'total_amount', 'payment_status', 'notes', 'created_at'];
    } else if (type === 'donations') {
      const raw = db.prepare('SELECT * FROM donations ORDER BY created_at DESC').all();
      // Decrypt PAN specifically for official 80G tax receipt submission export
      rows = raw.map(d => ({
        ...d,
        pan_number: decryptPan(d.pan_number)
      }));
      headers = ['id', 'donor_name', 'donor_email', 'donor_phone', 'pan_number', 'amount', 'transfer_type', 'reference_number', 'receipt_status', 'notes', 'created_at'];
    } else if (type === 'volunteers') {
      rows = db.prepare('SELECT * FROM volunteers ORDER BY created_at DESC').all();
      headers = ['id', 'full_name', 'phone', 'email', 'skills', 'message', 'status', 'created_at'];
    } else if (type === 'contacts') {
      rows = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();
      headers = ['id', 'name', 'email', 'subject', 'message', 'is_read', 'created_at'];
    }

    recordAuditLog('DATA_EXPORT_CSV', admin.username, admin.role, clientIp, { type, count: rows.length });

    const csvContent = generateCsv(rows, headers);
    applySecurityHeaders(res, reqOrigin);
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="premavasam_${type}_${new Date().toISOString().slice(0, 10)}.csv"`
    });
    return res.end(csvContent);
  }

  // ══════════════════════════════════════════════════════════════
  // C. HARDENED STATIC SERVING & PATH TRAVERSAL DEFENSE
  // ══════════════════════════════════════════════════════════════

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
    '/admin': 'admin.html',
    '/privacy': 'privacy.html'
  };

  let targetFile = ROUTE_MAP[pathname] || pathname;
  if (targetFile.startsWith('/')) targetFile = targetFile.substring(1);

  const resolvedPath = path.resolve(PUBLIC_DIR, targetFile);

  // 1. Directory Traversal & Hidden Segment Defense
  if (!resolvedPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden: Access Denied');
  }

  const pathParts = targetFile.split(/[\/\\]/);
  if (pathParts.some(p => p.startsWith('.') || p.includes('..') || p.toLowerCase() === 'backups' || p.toLowerCase() === 'data')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden: Access to protected directory is prohibited');
  }

  const baseName = path.basename(resolvedPath).toLowerCase();
  const ext = path.extname(resolvedPath).toLowerCase();

  // 2. Block sensitive backend files, databases, source code, configs, logs
  if (BLOCKED_FILES.has(baseName) || BLOCKED_EXTENSIONS.has(ext)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden: Access to protected server file is prohibited');
  }

  // 3. Block .js files in the root directory (only allow scripts under /js/)
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
      if (!ext) {
        const htmlPath = resolvedPath + '.html';
        try {
          const htmlStats = fs.statSync(htmlPath);
          if (htmlStats.isFile()) {
            applySecurityHeaders(res, reqOrigin);
            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Length': htmlStats.size,
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            if (req.method === 'HEAD') return res.end();
            return fs.createReadStream(htmlPath).pipe(res);
          }
        } catch (_) {}
      }

      const notFoundPath = path.join(PUBLIC_DIR, '404.html');
      try {
        const nfStats = fs.statSync(notFoundPath);
        if (nfStats.isFile()) {
          applySecurityHeaders(res, reqOrigin);
          res.writeHead(404, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Length': nfStats.size,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          });
          if (req.method === 'HEAD') return res.end();
          return fs.createReadStream(notFoundPath).pipe(res);
        }
      } catch (_) {}

      res.writeHead(404, { 'Content-Type': 'text/plain', 'Content-Length': 13 });
      return res.end('404 Not Found');
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    applySecurityHeaders(res, reqOrigin);

    const isDev = APP_ENV === 'development';
    const isAsset = ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp' || ext === '.css' || ext === '.js' || ext === '.woff2';
    const cacheHeader = (!isDev && isAsset) ? 'public, max-age=86400' : 'no-cache, no-store, must-revalidate';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': cacheHeader,
      'Access-Control-Allow-Origin': getCorsOrigin(reqOrigin),
      'Accept-Ranges': 'bytes'
    });

    if (req.method === 'HEAD') {
      return res.end();
    }

    fs.createReadStream(resolvedPath).pipe(res);
  });
});

const isSocket = isNaN(Number(PORT));
const listenArgs = isSocket ? [PORT] : [Number(PORT), '0.0.0.0'];

server.listen(...listenArgs, () => {
  console.log(`══════════════════════════════════════════════════════════════`);
  console.log(` [SECURE] Prema Vasam Hardened Server active on ${isSocket ? `socket ${PORT}` : `port ${PORT}`}`);
  console.log(` Environment: ${APP_ENV} | Host: ${isSocket ? 'Unix Socket (Passenger/cPanel)' : '0.0.0.0'}`);
  console.log(` SQLite Database: Connected (WAL Mode & busy_timeout=5000)`);
  console.log(` Sessions: SQLite-backed Persistent Admin Sessions Active`);
  console.log(` Crypto: Native AES-256-GCM PAN Encryption & PBKDF2 (210,000 iters)`);
  console.log(` Security: Zero PII Stats Exposure, Trusted Proxy Defense, Strict CORS`);
  console.log(`══════════════════════════════════════════════════════════════`);
});

// ── 11. PRODUCTION RELIABILITY: GRACEFUL SHUTDOWN ──
function gracefulShutdown(signal) {
  console.log(`\n[SHUTDOWN] Received ${signal}. Closing server and SQLite database cleanly...`);
  server.close(() => {
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      db.close();
      console.log('[SHUTDOWN] SQLite database checkpointed and closed cleanly. Goodbye.');
    } catch (err) {
      console.error('[SHUTDOWN] Error closing database:', err.message);
    }
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[SHUTDOWN] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
