const http = require('http');

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
  console.log(' CYBERSECURITY PENETRATION & HARDENING AUDIT');
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

  // 1. BLOCKED FILES & INFORMATION DISCLOSURE
  console.log('--- 1. Testing Information Disclosure & File Blocking ---');
  const blockedPaths = [
    '/database.sqlite',
    '/database.sqlite-wal',
    '/database.sqlite-shm',
    '/server.js',
    '/package.json',
    '/.env',
    '/.git/config',
    '/.git/HEAD',
    '/test_suite.js'
  ];

  for (const p of blockedPaths) {
    const res = await request(p);
    assert(res.status === 403, `Blocked sensitive file ${p} -> Status: ${res.status}`);
  }

  // Path Traversal Attempt
  const traversalRes = await request('/%2e%2e/server.js');
  assert(traversalRes.status === 403 || traversalRes.status === 400 || traversalRes.status === 404, `Path traversal attempt /%2e%2e/server.js blocked -> Status: ${traversalRes.status}`);

  // 2. SECURITY HEADERS VERIFICATION
  console.log('\n--- 2. Testing HTTP Security Headers ---');
  const homeRes = await request('/');
  assert(homeRes.status === 200, 'Home page returns 200 OK');
  assert(homeRes.headers['x-frame-options'] === 'DENY', 'X-Frame-Options is DENY (Clickjacking Shield)');
  assert(homeRes.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options is nosniff (MIME-sniff Shield)');
  assert(!!homeRes.headers['content-security-policy'], 'Content-Security-Policy header is present');
  assert(!!homeRes.headers['strict-transport-security'], 'Strict-Transport-Security header is present (HSTS)');
  assert(homeRes.headers['referrer-policy'] === 'strict-origin-when-cross-origin', 'Referrer-Policy is strict-origin-when-cross-origin');
  assert(!homeRes.headers['x-powered-by'], 'X-Powered-By header is removed/hidden');

  // 3. INPUT VALIDATION & INJECTION RESISTANCE
  console.log('\n--- 3. Testing Input Validation & Injection Resistance ---');
  
  // Negative amount
  const negDonation = await request('/api/donations/record', {
    method: 'POST',
    body: {
      donor_name: 'Hacker Joe',
      donor_email: 'joe@example.com',
      amount: -500,
      pan_number: 'ABCDE1234F'
    }
  });
  assert(negDonation.status === 400, `Negative donation rejected -> Status: ${negDonation.status}`);

  // Invalid email
  const badEmailDonation = await request('/api/donations/record', {
    method: 'POST',
    body: {
      donor_name: 'Hacker Joe',
      donor_email: 'not-an-email',
      amount: 500,
      pan_number: 'ABCDE1234F'
    }
  });
  assert(badEmailDonation.status === 400, `Malformed email rejected -> Status: ${badEmailDonation.status}`);

  // Invalid PAN format
  const badPanDonation = await request('/api/donations/record', {
    method: 'POST',
    body: {
      donor_name: 'Hacker Joe',
      donor_email: 'joe@example.com',
      amount: 500,
      pan_number: 'INVALID_PAN_123'
    }
  });
  assert(badPanDonation.status === 400, `Invalid PAN format rejected -> Status: ${badPanDonation.status}`);

  // Valid Donation
  const validDonation = await request('/api/donations/record', {
    method: 'POST',
    body: {
      donor_name: 'Penetration Tester',
      donor_email: 'sec-audit@example.com',
      donor_phone: '+91 99999 88888',
      amount: 1000,
      pan_number: 'ABCDE1234F',
      transfer_type: 'UPI',
      reference_number: 'AUDIT-REF-001',
      notes: 'Clean security audit test'
    }
  });
  assert(validDonation.status === 200 && validDonation.json?.ok, `Valid donation accepted -> Status: ${validDonation.status}, ID: ${validDonation.json?.id}`);

  // 4. ADMIN AUTHENTICATION & SESSION MANAGEMENT
  console.log('\n--- 4. Testing Admin Authentication & Dynamic Sessions ---');

  // Unauthorized access to admin endpoints
  const unauthVerify = await request('/api/admin/verify');
  assert(unauthVerify.status === 401, `Unauthenticated /api/admin/verify returns 401 -> Status: ${unauthVerify.status}`);

  const unauthStats = await request('/api/admin/dashboard-stats');
  assert(unauthStats.status === 401, `Unauthenticated /api/admin/dashboard-stats returns 401 -> Status: ${unauthStats.status}`);

  const forgedTokenVerify = await request('/api/admin/verify', {
    headers: { 'Authorization': 'Bearer pvs_fake_token_1234567890abcdef1234567890' }
  });
  assert(forgedTokenVerify.status === 401, `Forged session token returns 401 -> Status: ${forgedTokenVerify.status}`);

  // Valid Login
  const loginRes = await request('/api/admin/login', {
    method: 'POST',
    body: {
      username: 'admin',
      password: process.env.ADMIN_PASSWORD || 'premavasam1999'
    }
  });
  assert(loginRes.status === 200 && loginRes.json?.ok, `Valid login succeeds -> Status: ${loginRes.status}`);
  const token = loginRes.json?.token;
  assert(typeof token === 'string' && token.startsWith('pvs_'), `Dynamic session token returned with prefix pvs_`);

  if (token) {
    // Test authenticated endpoints with dynamic token
    const authHeaders = { 'Authorization': `Bearer ${token}` };

    const authVerify = await request('/api/admin/verify', { headers: authHeaders });
    assert(authVerify.status === 200 && authVerify.json?.authenticated, `Token-authenticated /api/admin/verify succeeds -> Status: ${authVerify.status}`);

    const authStats = await request('/api/admin/dashboard-stats', { headers: authHeaders });
    assert(authStats.status === 200 && authStats.json?.ok, `Token-authenticated /api/admin/dashboard-stats succeeds -> Status: ${authStats.status}`);

    const authMeals = await request('/api/admin/meals', { headers: authHeaders });
    assert(authMeals.status === 200 && authMeals.json?.ok, `Token-authenticated /api/admin/meals succeeds -> Status: ${authMeals.status}`);

    const authDonations = await request('/api/admin/donations', { headers: authHeaders });
    assert(authDonations.status === 200 && authDonations.json?.ok, `Token-authenticated /api/admin/donations succeeds -> Status: ${authDonations.status}`);

    const authVolunteers = await request('/api/admin/volunteers', { headers: authHeaders });
    assert(authVolunteers.status === 200 && authVolunteers.json?.ok, `Token-authenticated /api/admin/volunteers succeeds -> Status: ${authVolunteers.status}`);

    const authContacts = await request('/api/admin/contacts', { headers: authHeaders });
    assert(authContacts.status === 200 && authContacts.json?.ok, `Token-authenticated /api/admin/contacts succeeds -> Status: ${authContacts.status}`);
  }

  // 5. PUBLIC ROUTE INTEGRITY & LEAKAGE
  console.log('\n--- 5. Verifying No Admin/Staff Link Leakage on Public Pages ---');
  const publicRoutes = ['/', '/about', '/sponsormeals', '/activities', '/achievements', '/gallery', '/volunteers', '/contact', '/howhelp'];
  for (const route of publicRoutes) {
    const res = await request(route);
    const hasAdminLink = res.data.includes('href="/admin"') || res.data.includes('href="/admin.html"');
    const hasStaffText = /staff\s*portal|staff\s*login/i.test(res.data);
    assert(!hasAdminLink && !hasStaffText, `Public page ${route} has zero staff/admin leaks`);
  }

  console.log('\n====================================================');
  console.log(` AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Audit fatal error:', err);
  process.exit(1);
});
