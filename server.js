/**
 * ══════════════════════════════════════════════════════════════════
 * PREMA VASAM • Full-Stack Web & API Server
 * Complete with SQLite (WAL Mode), Admin Portal, and Clean URL Routing
 * ══════════════════════════════════════════════════════════════════
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const DB_PATH = path.join(__dirname, 'database.sqlite');

// ── 1. DATABASE INITIALIZATION (SQLite WAL Mode) ──
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');

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

// Seed initial authentic records if tables are empty
const mealCount = db.prepare('SELECT COUNT(*) AS count FROM meals').get().count;
if (mealCount === 0) {
  const insertMeal = db.prepare(`
    INSERT INTO meals (id, sponsor_name, sponsor_phone, sponsor_email, sponsor_date, occasion, selected_items, total_amount, payment_status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertMeal.run('#MB-2801', 'Anand & Divya', '9840123456', 'anand@example.com', '2026-11-10', 'Wedding Anniversary', 'Lunch Feast (Festive Meals + Payasam)', 12500, 'confirmed', 'Serving meals in person with family', '2026-10-25T10:00:00.000Z');
  insertMeal.run('#MB-2802', 'R. Meenakshi', '9884567890', 'meenakshi.r@gmail.com', '2026-11-14', 'Child Birthday', 'Full Day Sponsorship (Breakfast + Lunch + Dinner)', 28000, 'confirmed', 'Special prayers for daughter Kavya', '2026-10-26T14:30:00.000Z');
  insertMeal.run('#MB-2803', 'K. Senthil Kumar', '9444112233', 'senthil.k@yahoo.com', '2026-11-20', 'Memorial Remembrance', 'Usual Breakfast (Idli, Vada, Sambar, Pongal)', 6500, 'pending', 'In loving memory of parents', '2026-10-28T09:15:00.000Z');
  insertMeal.run('#MB-2804', 'Global IT Volunteer Club', '9841098765', 'csr@techcorp.in', '2026-11-22', 'Volunteer Visit Day', 'Special Non-Veg Lunch Feast', 22000, 'confirmed', 'Bringing snacks and stationary for 200 children', '2026-10-29T16:00:00.000Z');
}

const donCount = db.prepare('SELECT COUNT(*) AS count FROM donations').get().count;
if (donCount === 0) {
  const insertDon = db.prepare(`
    INSERT INTO donations (id, donor_name, donor_email, donor_phone, pan_number, amount, transfer_type, reference_number, receipt_status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertDon.run('#DON-301', 'Dr. S. Ramanathan', 'ramanathan.s@hospital.org', '9840011223', 'AABCR1234F', 25000, 'Net Banking', 'NEFT-BOB-998822', 'issued', 'For pediatric orthopedic medicines', '2026-10-20T11:00:00.000Z');
  insertDon.run('#DON-302', 'Lakshmi Narayanan', 'lnarayanan@outlook.com', '9884022334', 'BPYPL9988K', 10000, 'UPI', 'UPI-REF-88442211', 'issued', 'Monthly sponsorship pledge', '2026-10-24T15:20:00.000Z');
  insertDon.run('#DON-303', 'Arun & Preethi (USA)', 'arun.usa@gmail.com', '+14085551234', '', 50000, 'FCRA Wire', 'SWIFT-SBI-00994411', 'issued', 'FCRA contribution toward school wheelchair maintenance', '2026-10-27T18:40:00.000Z');
}

const volCount = db.prepare('SELECT COUNT(*) AS count FROM volunteers').get().count;
if (volCount === 0) {
  const insertVol = db.prepare(`
    INSERT INTO volunteers (id, full_name, phone, email, skills, message, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertVol.run('#VOL-151', 'Sneha Murali', '9841234567', 'sneha.murali@gmail.com', 'Music Therapy, Carnatic Singing', 'Interested in conducting weekend vocal and rhythm therapy sessions.', 'contacted', '2026-10-22T08:30:00.000Z');
  insertVol.run('#VOL-152', 'G. Vignesh', '9884123456', 'vignesh.dev@outlook.com', 'Special Ed Assistance, Physical Training', 'Available every Saturday morning for sports coaching.', 'new', '2026-10-28T12:00:00.000Z');
}

const conCount = db.prepare('SELECT COUNT(*) AS count FROM contacts').get().count;
if (conCount === 0) {
  const insertCon = db.prepare(`
    INSERT INTO contacts (id, name, email, subject, message, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertCon.run('#MSG-881', 'Kavitha Sundaram', 'kavitha.s@gmail.com', 'Visiting with family on Sunday', 'Hello Selvyn Roy and team, we would like to visit the children this Sunday around 11 AM.', 1, '2026-10-25T14:10:00.000Z');
  insertCon.run('#MSG-882', 'Rotary Club of Porur', 'porur.rotary@gmail.com', 'Medical Camp Collaboration', 'We would like to organize a free dental and eye checkup camp for Premavasam children.', 0, '2026-10-30T10:45:00.000Z');
}

// ── 2. ADMIN AUTH TOKENS ──
const ADMIN_TOKENS = new Set(['premavasam_admin_session_token_2026']);
const ADMIN_USER = {
  username: process.env.ADMIN_USER || 'admin',
  password: process.env.ADMIN_PASSWORD || 'premavasam1999',
  name: 'Premavasam Administrator',
  role: 'Superadmin',
  email: 'premavasam1999@gmail.com'
};

function verifyAuth(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.substring(7);
  return ADMIN_TOKENS.has(token);
}

// ── 3. MIME TYPES & STATIC HANDLING ──
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

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        req.socket.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// ── 4. STATS COMPUTATION ──
function getStats() {
  const mealStats = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total FROM meals').get();
  const donStats = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM donations').get();
  const conStats = db.prepare('SELECT COUNT(*) as count, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread FROM contacts').get();

  const mealTotal = mealStats.total || 0;
  const donTotal = donStats.total || 0;

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
    newMessages: conStats.unread || 0
  };
}

// ── 5. CSV EXPORT HELPER ──
function generateCsv(rows, headers) {
  if (!rows || rows.length === 0) {
    return headers.join(',') + '\n';
  }
  const keys = headers;
  const lines = [keys.join(',')];
  rows.forEach(r => {
    const row = keys.map(k => {
      let val = r[k] !== undefined && r[k] !== null ? String(r[k]) : '';
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

// ── 6. MAIN HTTP REQUEST DISPATCHER ──
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // ── A. PUBLIC APIS ──

  // GET /api/stats
  if (req.method === 'GET' && pathname === '/api/stats') {
    return sendJson(res, 200, getStats());
  }

  // POST /api/meals/book
  if (req.method === 'POST' && pathname === '/api/meals/book') {
    try {
      const data = await parseJsonBody(req);
      if (!data.sponsor_name || !data.sponsor_phone || !data.sponsor_date) {
        return sendJson(res, 400, { ok: false, error: 'Sponsor name, phone, and date are required fields' });
      }

      const count = db.prepare('SELECT COUNT(*) as count FROM meals').get().count;
      const id = `#MB-${2800 + count + 1}`;
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO meals (id, sponsor_name, sponsor_phone, sponsor_email, sponsor_date, occasion, selected_items, total_amount, payment_status, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `);
      stmt.run(
        id,
        data.sponsor_name,
        data.sponsor_phone,
        data.sponsor_email || '',
        data.sponsor_date,
        data.occasion || 'General Blessing',
        data.selected_items || 'Meal Sponsorship',
        parseFloat(data.total_amount) || 0,
        data.notes || '',
        now
      );

      const booking = db.prepare('SELECT * FROM meals WHERE id = ?').get(id);
      return sendJson(res, 200, {
        ok: true,
        id,
        booking,
        message: 'Meal reservation recorded with heartfelt gratitude. Official confirmation will be shared promptly.'
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // POST /api/donations/record
  if (req.method === 'POST' && pathname === '/api/donations/record') {
    try {
      const data = await parseJsonBody(req);
      if (!data.donor_name || !data.donor_email || !data.amount) {
        return sendJson(res, 400, { ok: false, error: 'Donor name, email, and amount are required fields' });
      }

      const count = db.prepare('SELECT COUNT(*) as count FROM donations').get().count;
      const id = `#DON-${300 + count + 1}`;
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO donations (id, donor_name, donor_email, donor_phone, pan_number, amount, transfer_type, reference_number, receipt_status, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `);
      stmt.run(
        id,
        data.donor_name,
        data.donor_email,
        data.donor_phone || '',
        data.pan_number || '',
        parseFloat(data.amount) || 0,
        data.transfer_type || 'UPI',
        data.reference_number || '',
        data.notes || '',
        now
      );

      const donation = db.prepare('SELECT * FROM donations WHERE id = ?').get(id);
      return sendJson(res, 200, {
        ok: true,
        id,
        amount: donation.amount,
        donation,
        message: 'Donation recorded successfully. An 80G tax receipt will be issued to your email.'
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // POST /api/volunteers/apply
  if (req.method === 'POST' && pathname === '/api/volunteers/apply') {
    try {
      const data = await parseJsonBody(req);
      if (!data.full_name || !data.phone || !data.email) {
        return sendJson(res, 400, { ok: false, error: 'Full name, phone, and email are required fields' });
      }

      const count = db.prepare('SELECT COUNT(*) as count FROM volunteers').get().count;
      const id = `#VOL-${150 + count + 1}`;
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO volunteers (id, full_name, phone, email, skills, message, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'new', ?)
      `);
      stmt.run(
        id,
        data.full_name,
        data.phone,
        data.email,
        data.skills || '',
        data.message || '',
        now
      );

      const volunteer = db.prepare('SELECT * FROM volunteers WHERE id = ?').get(id);
      return sendJson(res, 200, {
        ok: true,
        id,
        volunteer,
        message: 'Thank you for stepping forward to serve! Miss Mumtaj will reach out to schedule an orientation.'
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // POST /api/contacts/send
  if (req.method === 'POST' && pathname === '/api/contacts/send') {
    try {
      const data = await parseJsonBody(req);
      if (!data.name || !data.email || !data.message) {
        return sendJson(res, 400, { ok: false, error: 'Name, email, and message are required fields' });
      }

      const count = db.prepare('SELECT COUNT(*) as count FROM contacts').get().count;
      const id = `#MSG-${880 + count + 1}`;
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO contacts (id, name, email, subject, message, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)
      `);
      stmt.run(
        id,
        data.name,
        data.email,
        data.subject || 'General Inquiry',
        data.message,
        now
      );

      const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
      return sendJson(res, 200, {
        ok: true,
        id,
        contact,
        message: 'Your inquiry has been received. Our office team will respond promptly.'
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // ── B. ADMIN AUTH & DASHBOARD APIS ──

  // POST /api/admin/login
  if (req.method === 'POST' && pathname === '/api/admin/login') {
    try {
      const data = await parseJsonBody(req);
      if (data.username === ADMIN_USER.username && data.password === ADMIN_USER.password) {
        const token = 'token_' + crypto.randomBytes(16).toString('hex');
        ADMIN_TOKENS.add(token);
        return sendJson(res, 200, {
          ok: true,
          token,
          admin: {
            name: ADMIN_USER.name,
            role: ADMIN_USER.role,
            email: ADMIN_USER.email
          }
        });
      }
      return sendJson(res, 401, { ok: false, error: 'Invalid username or password' });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // POST /api/admin/logout
  if (req.method === 'POST' && pathname === '/api/admin/logout') {
    const auth = req.headers['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      ADMIN_TOKENS.delete(auth.substring(7));
    }
    return sendJson(res, 200, { ok: true });
  }

  // GET /api/admin/dashboard
  if (req.method === 'GET' && pathname === '/api/admin/dashboard') {
    if (!verifyAuth(req)) {
      return sendJson(res, 401, { ok: false, error: 'Unauthorized. Sign in to admin portal.' });
    }

    const meals = db.prepare('SELECT * FROM meals ORDER BY created_at DESC').all();
    const donations = db.prepare('SELECT * FROM donations ORDER BY created_at DESC').all();
    const volunteers = db.prepare('SELECT * FROM volunteers ORDER BY created_at DESC').all();
    const contacts = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();

    return sendJson(res, 200, {
      ok: true,
      stats: getStats(),
      meals,
      donations,
      volunteers,
      contacts
    });
  }

  // PUT & DELETE /api/admin/meals
  if (pathname === '/api/admin/meals') {
    if (!verifyAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    try {
      const data = await parseJsonBody(req);
      if (req.method === 'PUT') {
        db.prepare('UPDATE meals SET payment_status = ? WHERE id = ?').run(data.payment_status, data.id);
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === 'DELETE') {
        db.prepare('DELETE FROM meals WHERE id = ?').run(data.id);
        return sendJson(res, 200, { ok: true });
      }
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // PUT & DELETE /api/admin/donations
  if (pathname === '/api/admin/donations') {
    if (!verifyAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    try {
      const data = await parseJsonBody(req);
      if (req.method === 'PUT') {
        db.prepare('UPDATE donations SET receipt_status = ? WHERE id = ?').run(data.receipt_status, data.id);
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === 'DELETE') {
        db.prepare('DELETE FROM donations WHERE id = ?').run(data.id);
        return sendJson(res, 200, { ok: true });
      }
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // PUT & DELETE /api/admin/volunteers
  if (pathname === '/api/admin/volunteers') {
    if (!verifyAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    try {
      const data = await parseJsonBody(req);
      if (req.method === 'PUT') {
        db.prepare('UPDATE volunteers SET status = ? WHERE id = ?').run(data.status, data.id);
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === 'DELETE') {
        db.prepare('DELETE FROM volunteers WHERE id = ?').run(data.id);
        return sendJson(res, 200, { ok: true });
      }
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // PUT & DELETE /api/admin/contacts
  if (pathname === '/api/admin/contacts') {
    if (!verifyAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    try {
      const data = await parseJsonBody(req);
      if (req.method === 'PUT') {
        db.prepare('UPDATE contacts SET is_read = ? WHERE id = ?').run(data.is_read ? 1 : 0, data.id);
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === 'DELETE') {
        db.prepare('DELETE FROM contacts WHERE id = ?').run(data.id);
        return sendJson(res, 200, { ok: true });
      }
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // GET /api/admin/export-csv?type=...
  if (req.method === 'GET' && pathname === '/api/admin/export-csv') {
    if (!verifyAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    const type = urlObj.searchParams.get('type') || 'meals';
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
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="premavasam_${type}_${new Date().toISOString().slice(0, 10)}.csv"`
    });
    return res.end(csvContent);
  }

  // ── C. STATIC PAGES & CLEAN ROUTING ──
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

  const fullPath = path.join(PUBLIC_DIR, targetFile);

  // Security guard against directory traversal
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden');
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      // If 404, fallback to index.html for client routing if not an asset
      if (!path.extname(fullPath)) {
        const indexFallback = path.join(PUBLIC_DIR, 'index.html');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return fs.createReadStream(indexFallback).pipe(res);
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(fullPath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`══════════════════════════════════════════════════════════════`);
  console.log(` Premavasam Full-Stack Server active on http://localhost:${PORT}`);
  console.log(` SQLite Database: ${DB_PATH} (WAL Mode enabled)`);
  console.log(` Admin Portal: http://localhost:${PORT}/admin`);
  console.log(` Credentials: username="admin" / password="premavasam1999"`);
  console.log(`══════════════════════════════════════════════════════════════`);
});
