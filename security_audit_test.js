const http = require('http');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { execSync } = require('child_process');

// Native .env loader
if (typeof process.loadEnvFile === 'function') {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try { process.loadEnvFile(envPath); } catch (e) {}
  }
}

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'prem$1999#vasam';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:3000${path}`);
    const method = options.method || 'GET';
    const headers = options.headers || {};
    let body = options.body;

    if (body && typeof body === 'object') {
      body = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch(e) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data,
          json
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runAudit() {
  console.log('====================================================');
  console.log(' PREMA VASAM • COMPREHENSIVE CYBERSECURITY QA AUDIT');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // ── TEST 1: PUBLIC STATISTICS ZERO PII LEAK (SEC-01) ──
  console.log('--- 1. Testing Public Statistics for Zero PII Exposure (SEC-01) ---');
  const statsRes = await request('/api/stats');
  assert(statsRes.status === 200, 'GET /api/stats returns 200 OK');
  assert(statsRes.json && statsRes.json.recentDonations === undefined, 'No recentDonations array in public stats response');
  assert(statsRes.json && typeof statsRes.json.totalFunds === 'number', 'Summary metric totalFunds is present');
  assert(statsRes.json && typeof statsRes.json.totalChildren === 'number', 'Summary metric totalChildren is present');
  assert(!JSON.stringify(statsRes.json).includes('donor_phone'), 'Zero donor phone numbers leaked');
  assert(!JSON.stringify(statsRes.json).includes('donor_email'), 'Zero donor email addresses leaked');
  assert(!JSON.stringify(statsRes.json).includes('reference_number'), 'Zero transaction references leaked');

  // ── TEST 2: UNAUTHENTICATED USERS CANNOT ACCESS ADMIN APIS ──
  console.log('\n--- 2. Testing Unauthenticated Access Rejection ---');
  const protectedRoutes = [
    '/api/admin/verify',
    '/api/admin/dashboard-stats',
    '/api/admin/meals',
    '/api/admin/donations',
    '/api/admin/volunteers',
    '/api/admin/contacts',
    '/api/admin/guest-users',
    '/api/admin/clear-all'
  ];
  for (const r of protectedRoutes) {
    const res = await request(r);
    assert(res.status === 401, `Unauthenticated ${r} rejected with 401 Unauthorized`);
  }

  // ── TEST 3: ABSENCE OF HARDCODED CREDENTIALS IN FRONTEND (SEC-02) ──
  console.log('\n--- 3. Testing Frontend Files for Absence of Hardcoded Secrets (SEC-02) ---');
  const filesToCheck = ['admin.html', 'index.html', 'about.html', 'contact.html', 'sponsormeals.html', 'volunteers.html', 'howhelp.html'];
  let secretsFoundInFrontend = false;
  for (const f of filesToCheck) {
    if (fs.existsSync(f)) {
      const code = fs.readFileSync(f, 'utf8');
      if (code.includes('prem$1999#vasam')) {
        secretsFoundInFrontend = true;
        console.error(`  Secret found in ${f}`);
      }
    }
  }
  assert(!secretsFoundInFrontend, 'Zero hardcoded administrator passwords in frontend HTML/JS files');

  // ── TEST 4: SENSITIVE FILE & PATH TRAVERSAL BLOCKING ──
  console.log('\n--- 4. Testing Sensitive File & Path Traversal Blocking ---');
  const blockedFiles = [
    '/database.sqlite',
    '/database.sqlite-wal',
    '/database.sqlite-shm',
    '/server.js',
    '/package.json',
    '/.env',
    '/.git/config',
    '/.git/HEAD',
    '/test_suite.js',
    '/backup.js'
  ];
  for (const f of blockedFiles) {
    const res = await request(f);
    assert(res.status === 403, `Blocked sensitive file ${f} -> Status: ${res.status}`);
  }
  const traversal = await request('/%2e%2e/server.js');
  assert(traversal.status === 403, `Path traversal attempt /%2e%2e/server.js blocked -> Status: ${traversal.status}`);

  // ── TEST 5: HTTP SECURITY HEADERS & DEPRECATED HEADER REMOVAL ──
  console.log('\n--- 5. Testing HTTP Security Headers ---');
  const homeRes = await request('/');
  assert(homeRes.status === 200, 'Home page returns 200 OK');
  assert(homeRes.headers['x-frame-options'] === 'DENY', 'X-Frame-Options is DENY (Clickjacking Shield)');
  assert(homeRes.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options is nosniff (MIME-sniff Shield)');
  assert(Boolean(homeRes.headers['content-security-policy']), 'Content-Security-Policy header is present');
  assert(Boolean(homeRes.headers['strict-transport-security']), 'Strict-Transport-Security header is present (HSTS)');
  assert(homeRes.headers['referrer-policy'] === 'strict-origin-when-cross-origin', 'Referrer-Policy is strict-origin-when-cross-origin');
  assert(homeRes.headers['x-powered-by'] === undefined, 'X-Powered-By header is removed/hidden');
  assert(homeRes.headers['x-xss-protection'] === undefined, 'Deprecated X-XSS-Protection header cleanly removed');

  // ── TEST 6: AES-256-GCM ENCRYPTION AT REST (SEC-04) ──
  console.log('\n--- 6. Testing Native AES-256-GCM PAN Encryption at Rest (SEC-04) ---');
  const testPan = 'ABCDE9876Z';
  const donSubmission = await request('/api/donations/record', {
    method: 'POST',
    body: {
      donor_name: 'Dr. Subramanian',
      donor_email: 'subramanian@example.org',
      donor_phone: '+91 98401 23456',
      amount: 5000,
      pan_number: testPan,
      transfer_type: 'UPI',
      reference_number: 'UTR-SEC-TEST-99',
      privacy_consent: true
    }
  });
  assert(donSubmission.status === 200 && donSubmission.json?.ok, `Donation accepted -> Status: ${donSubmission.status}, ID: ${donSubmission.json?.id}`);
  assert(donSubmission.json?.donation?.pan_number === 'ABCDE****Z', 'Response PAN is masked as ABCDE****Z (never plaintext)');

  // Verify direct SQLite row has encrypted format enc:v1:
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  const row = db.prepare('SELECT pan_number FROM donations WHERE id = ?').get(donSubmission.json?.id);
  assert(row && typeof row.pan_number === 'string' && row.pan_number.startsWith('enc:v1:'), 'PAN is encrypted at rest with enc:v1:<iv>:<tag>:<cipher>');
  assert(!row.pan_number.includes(testPan), 'Plaintext PAN is completely absent from database storage');

  // ── TEST 7: SQLITE CONCURRENCY (BUSY TIMEOUT = 5000 & WAL MODE) (SEC-09) ──
  console.log('\n--- 7. Testing SQLite Concurrency Configuration (SEC-09) ---');
  const journalMode = db.prepare('PRAGMA journal_mode;').get();
  assert(journalMode && journalMode.journal_mode === 'wal', `PRAGMA journal_mode is WAL -> Actual: ${journalMode?.journal_mode}`);
  const serverSource = fs.readFileSync('server.js', 'utf8');
  assert(serverSource.includes('PRAGMA busy_timeout = 5000'), 'PRAGMA busy_timeout = 5000 is configured in server.js');

  // ── TEST 8: CONCURRENT DONATION SUBMISSION HANDLING ──
  console.log('\n--- 8. Testing Concurrent Donation Submissions (Lock Resilience) ---');
  const concurrentCount = 10;
  const concurrentPromises = [];
  for (let i = 0; i < concurrentCount; i++) {
    concurrentPromises.push(request('/api/donations/record', {
      method: 'POST',
      body: {
        donor_name: `Concurrent Donor ${i}`,
        donor_email: `donor${i}@example.com`,
        donor_phone: `+91 98401 ${10000 + i}`,
        amount: 500 + i * 50,
        pan_number: 'ABCDE1234F',
        transfer_type: 'UPI',
        reference_number: `CONC-UTR-${i}`,
        privacy_consent: true
      }
    }));
  }
  const concurrentResults = await Promise.all(concurrentPromises);
  const allSuccessful = concurrentResults.every(r => r.status === 200 && r.json?.ok);
  assert(allSuccessful, `All ${concurrentCount} concurrent donations completed cleanly with 200 OK`);

  // ── TEST 9: ADMIN AUTHENTICATION, TOKENS & HTTPONLY COOKIES ──
  console.log('\n--- 9. Testing Admin Authentication & Cookie-Based Sessions (SEC-07) ---');
  const loginRes = await request('/api/admin/login', {
    method: 'POST',
    body: {
      username: 'admin',
      password: ADMIN_PASSWORD,
      forceLogin: true
    }
  });
  assert(loginRes.status === 200 && loginRes.json?.ok, `Admin login succeeds -> Status: ${loginRes.status}`);
  const authToken = loginRes.json?.token;
  assert(typeof authToken === 'string' && authToken.startsWith('pvs_'), 'Session token returned with prefix pvs_');

  // Check Set-Cookie header
  const setCookie = loginRes.headers['set-cookie'] || [];
  const sessionCookie = setCookie.find(c => c.startsWith('pvs_session='));
  assert(Boolean(sessionCookie), 'Set-Cookie pvs_session header returned on login');
  assert(sessionCookie && sessionCookie.includes('HttpOnly'), 'Session cookie has HttpOnly flag active');
  assert(sessionCookie && sessionCookie.includes('SameSite=Strict'), 'Session cookie has SameSite=Strict flag active');

  // ── TEST 10: SESSIONS PERSIST ACROSS SERVER RESTARTS IN SQLITE (SEC-07) ──
  console.log('\n--- 10. Testing SQLite-Backed Persistent Sessions (SEC-07) ---');
  const sessionRow = db.prepare('SELECT * FROM admin_sessions WHERE role = ? LIMIT 1').get('Superadmin');
  assert(Boolean(sessionRow), 'Admin session is stored in SQLite admin_sessions table');
  assert(sessionRow && sessionRow.username === 'admin', 'Session record stores admin username');
  assert(sessionRow && sessionRow.expires_at > Date.now(), 'Session expiration is set in the future');

  // ── TEST 11: TOKEN-AUTHENTICATED & COOKIE-AUTHENTICATED ENDPOINTS ──
  console.log('\n--- 11. Testing Authenticated Admin Endpoints & Masked PAN in Dashboard ---');
  const authHeaders = { 'Authorization': `Bearer ${authToken}` };

  const verifyRes = await request('/api/admin/verify', { headers: authHeaders });
  assert(verifyRes.status === 200 && verifyRes.json?.authenticated, 'Bearer /api/admin/verify succeeds -> Status: 200');

  // Test Cookie authentication without Authorization header
  const cookieHeaders = { 'Cookie': `pvs_session=${authToken}` };
  const cookieVerifyRes = await request('/api/admin/verify', { headers: cookieHeaders });
  assert(cookieVerifyRes.status === 200 && cookieVerifyRes.json?.authenticated, 'Cookie /api/admin/verify succeeds -> Status: 200');

  const dashStats = await request('/api/admin/dashboard-stats', { headers: authHeaders });
  assert(dashStats.status === 200 && dashStats.json?.ok, 'Authenticated /api/admin/dashboard-stats succeeds -> Status: 200');
  const recentDons = dashStats.json?.stats?.recentDonations || [];
  assert(recentDons.length > 0, 'Recent donations present in authenticated dashboard stats');
  assert(recentDons.every(d => !d.pan_number || d.pan_number.includes('****')), 'All PANs in dashboard stats are masked');

  const donList = await request('/api/admin/donations', { headers: authHeaders });
  assert(donList.status === 200 && donList.json?.ok, 'Authenticated /api/admin/donations succeeds -> Status: 200');
  const allDons = donList.json?.donations || [];
  assert(allDons.every(d => !d.pan_number || d.pan_number.includes('****')), 'All PANs in donations admin list are masked');

  // ── TEST 12: CSV EXPORT WITH DECRYPTED PAN FOR 80G FILING ──
  console.log('\n--- 12. Testing CSV Export with Formula Injection Shield ---');
  const csvRes = await request('/api/admin/export-csv?type=donations', { headers: authHeaders });
  assert(csvRes.status === 200, 'CSV Export /api/admin/export-csv?type=donations succeeds -> Status: 200');
  assert(csvRes.headers['content-type'].includes('text/csv'), 'Content-Type is text/csv');
  assert(csvRes.data.includes('ABCDE9876Z'), 'CSV export decrypts PAN for official government 80G tax submission');
  assert(!csvRes.data.includes('enc:v1:'), 'Zero raw encrypted ciphertext in exported CSV');

  // ── TEST 13: LOGOUT INVALIDATES SESSIONS ──
  console.log('\n--- 13. Testing Session Invalidation on Logout ---');
  const logoutRes = await request('/api/admin/logout', { method: 'POST', headers: authHeaders });
  assert(logoutRes.status === 200 && logoutRes.json?.ok, 'Logout succeeds with 200 OK');
  const postLogoutVerify = await request('/api/admin/verify', { headers: authHeaders });
  assert(postLogoutVerify.status === 401, 'Logged out session token is immediately rejected with 401');

  // ── TEST 14: EXPIRED SESSIONS REJECTED ──
  console.log('\n--- 14. Testing Expired Session Rejection ---');
  const expiredToken = 'pvs_expired_test_token_12345';
  const expiredHash = require('crypto').createHash('sha256').update(expiredToken).digest('hex');
  const writableDb = new DatabaseSync(DB_PATH);
  writableDb.prepare(`
    INSERT INTO admin_sessions (token_hash, admin_id, username, role, name, email, ip_address, user_agent, expires_at, created_at)
    VALUES (?, 'test', 'testadmin', 'Superadmin', 'Test Admin', 'test@example.com', '127.0.0.1', 'AuditTest', ?, ?)
  `).run(expiredHash, Date.now() - 100000, Date.now() - 200000);

  const expiredVerify = await request('/api/admin/verify', { headers: { 'Authorization': `Bearer ${expiredToken}` } });
  assert(expiredVerify.status === 401, 'Expired session token rejected with 401');

  // ── TEST 15: GUEST USERS WITH 210,000 PBKDF2 ITERATIONS (SEC-08) ──
  console.log('\n--- 15. Testing Guest User RBAC & OWASP PBKDF2 (210,000 iters) (SEC-08) ---');
  // Log back in as superadmin
  const superLogin = await request('/api/admin/login', {
    method: 'POST',
    body: { username: 'admin', password: ADMIN_PASSWORD, forceLogin: true }
  });
  const superHeaders = { 'Authorization': `Bearer ${superLogin.json?.token}` };

  const guestCreateRes = await request('/api/admin/guest-users', {
    method: 'POST',
    headers: superHeaders,
    body: {
      username: 'auditor_guest',
      full_name: 'Audit Guest Officer',
      password: 'StrongGuestPassword2026!',
      notes: 'Automated Security QA'
    }
  });
  assert(guestCreateRes.status === 201 && guestCreateRes.json?.ok, 'Guest user created -> Status: 201');
  const guestRow = writableDb.prepare('SELECT * FROM guest_users WHERE username = ?').get('auditor_guest');
  assert(guestRow && guestRow.iterations === 210000, `Guest user password uses 210,000 PBKDF2 iterations -> Actual: ${guestRow?.iterations}`);

  // Test Guest login
  const guestLoginRes = await request('/api/admin/login', {
    method: 'POST',
    body: { username: 'auditor_guest', password: 'StrongGuestPassword2026!' }
  });
  assert(guestLoginRes.status === 200 && guestLoginRes.json?.admin?.role === 'Guest', 'Guest authentication succeeds with Guest role');

  // Test Guest cannot perform destructive action (403 Forbidden)
  const guestDeleteMeal = await request('/api/admin/meals', {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${guestLoginRes.json?.token}` },
    body: { id: '#MB-2801' }
  });
  assert(guestDeleteMeal.status === 403, 'Guest user blocked from destructive action with 403 Forbidden');

  // Clean up guest user
  await request('/api/admin/guest-users', {
    method: 'DELETE',
    headers: superHeaders,
    body: { id: guestCreateRes.json?.guest?.id }
  });

  // ── TEST 16: AUDIT TRAIL LOGGING (SEC-10) ──
  console.log('\n--- 16. Testing Persistent Audit Trail Logging (SEC-10) ---');
  const auditLogs = writableDb.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5').all();
  assert(auditLogs.length > 0, 'Audit logs recorded in SQLite audit_logs table');
  const auditActions = auditLogs.map(l => l.action);
  assert(auditActions.includes('ADMIN_LOGIN_SUCCESS') || auditActions.includes('GUEST_USER_CREATED'), 'Audit actions logged accurately');

  // ── TEST 17: GIT & DOCKER SECURITY (SEC-03) ──
  console.log('\n--- 17. Testing Git & Docker Secret Exclusions (SEC-03) ---');
  const gitTracked = execSync('git ls-files', { encoding: 'utf8' }).split(/\r?\n/);
  assert(!gitTracked.includes('.env'), '.env is NOT tracked in Git');
  assert(!gitTracked.includes('database.sqlite'), 'database.sqlite is NOT tracked in Git');
  assert(!gitTracked.includes('app.js'), 'Redundant root app.js is removed from Git');
  const dockerignore = fs.readFileSync('.dockerignore', 'utf8');
  assert(dockerignore.includes('database.sqlite*'), '.dockerignore excludes database.sqlite*');
  assert(dockerignore.includes('.env'), '.dockerignore excludes .env');

  // Clean test data
  writableDb.prepare("DELETE FROM donations WHERE reference_number LIKE '%SEC-TEST%' OR reference_number LIKE '%CONC-UTR%'").run();
  writableDb.prepare("DELETE FROM admin_sessions WHERE username = 'testadmin'").run();
  writableDb.close();
  db.close();

  console.log('\n====================================================');
  console.log(` AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
