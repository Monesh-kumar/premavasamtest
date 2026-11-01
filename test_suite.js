const http = require('http');

const routes = [
  { path: '/', expectedText: 'PREMA VASAM' },
  { path: '/about', expectedText: 'About Us' },
  { path: '/sponsormeals', expectedText: 'Sponsor Meals' },
  { path: '/activities', expectedText: 'Activities' },
  { path: '/achievements', expectedText: 'Achievements' },
  { path: '/gallery', expectedText: 'Photo Gallery' },
  { path: '/volunteers', expectedText: 'Volunteers' },
  { path: '/contact', expectedText: 'Contact Us' },
  { path: '/howhelp', expectedText: 'How Can You Help' },
  { path: '/admin', expectedText: 'Admin Portal' }
];

function fetchRoute(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request(`http://localhost:3000${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function runTests() {
  console.log('--- 1. TESTING GET ROUTES ---');
  let allRoutesOk = true;
  for (const r of routes) {
    try {
      const res = await fetchRoute(r.path);
      const contains = res.data.includes(r.expectedText);
      const is200 = res.status === 200;
      console.log(`[${is200 && contains ? 'PASS' : 'FAIL'}] GET ${r.path} -> ${res.status} (Contains "${r.expectedText}": ${contains})`);
      if (!is200 || !contains) allRoutesOk = false;
    } catch(err) {
      console.log(`[FAIL] GET ${r.path} -> Error: ${err.message}`);
      allRoutesOk = false;
    }
  }

  console.log('\n--- 2. VERIFYING NO ADMIN/STAFF LINKS ON PUBLIC PAGES ---');
  const publicRoutes = ['/', '/about', '/sponsormeals', '/activities', '/achievements', '/gallery', '/volunteers', '/contact', '/howhelp'];
  let noAdminLinks = true;
  for (const p of publicRoutes) {
    const res = await fetchRoute(p);
    const hasAdminLink = res.data.includes('href="/admin"') || res.data.includes('href="/admin.html"');
    const hasStaffText = /staff\s*portal|staff\s*login/i.test(res.data);
    if (hasAdminLink || hasStaffText) {
      console.log(`[FAIL] ${p} has leaked admin link/staff text!`);
      noAdminLinks = false;
    } else {
      console.log(`[PASS] ${p} clean: no staff/admin links.`);
    }
  }

  console.log('\n--- 3. TESTING API ENDPOINTS ---');
  
  // Test Stats
  const statsRes = await fetchRoute('/api/stats');
  console.log(`[${statsRes.status === 200 ? 'PASS' : 'FAIL'}] GET /api/stats -> ${statsRes.status}`);

  // Test Meal Booking
  const mealRes = await postJson('/api/meals/book', {
    sponsor_name: 'Testing Suite Automated',
    sponsor_phone: '+91 99999 11111',
    sponsor_email: 'test@example.com',
    sponsor_date: '2026-12-25',
    occasion: 'Testing Verification',
    selected_items: 'Special Lunch Feast',
    total_amount: 7500,
    notes: 'Automated verification check'
  });
  console.log(`[${mealRes.status === 200 && mealRes.body.ok ? 'PASS' : 'FAIL'}] POST /api/meals/book -> ${mealRes.status}, id: ${mealRes.body?.id}`);

  // Test Donation Record
  const donRes = await postJson('/api/donations/record', {
    donor_name: 'Test Donor Suite',
    donor_email: 'donor@example.com',
    donor_phone: '+91 98888 22222',
    pan_number: 'ABCDE1234F',
    amount: 5000,
    transfer_type: 'Bank of Baroda Net Banking',
    reference_number: 'TESTUTR999888',
    notes: 'Automated verification record'
  });
  console.log(`[${donRes.status === 200 && donRes.body.ok ? 'PASS' : 'FAIL'}] POST /api/donations/record -> ${donRes.status}, id: ${donRes.body?.id}`);

  // Test Volunteer Application
  const volRes = await postJson('/api/volunteers/apply', {
    full_name: 'Test Volunteer Suite',
    phone: '+91 97777 33333',
    email: 'volunteer@example.com',
    skills: 'Physiotherapy & Music',
    message: 'Testing volunteer application flow'
  });
  console.log(`[${volRes.status === 200 && volRes.body.ok ? 'PASS' : 'FAIL'}] POST /api/volunteers/apply -> ${volRes.status}, id: ${volRes.body?.id}`);

  // Test Contact Send
  const conRes = await postJson('/api/contacts/send', {
    name: 'Test Contact Suite',
    email: 'contact@example.com',
    subject: 'General Inquiry',
    message: 'Testing contact inquiry flow'
  });
  console.log(`[${conRes.status === 200 && conRes.body.ok ? 'PASS' : 'FAIL'}] POST /api/contacts/send -> ${conRes.status}, id: ${conRes.body?.id}`);

  console.log('\n--- ALL VERIFICATIONS COMPLETE ---');
}

runTests();
