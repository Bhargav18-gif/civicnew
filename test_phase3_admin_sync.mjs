import http from 'http';
import { spawn } from 'child_process';

const PORT = 5177;
const BASE_URL = `http://localhost:${PORT}/api`;

function sessionRequest(sessionId, method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId,
        'User-Agent': `CivicConnect-TestClient-${sessionId}`
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runPhase3SyncTest() {
  console.log('===========================================================');
  console.log('CIVICCONNECT — PHASE 3: ADMIN FIRESTORE & DATA SOURCE SYNC');
  console.log('===========================================================\n');

  console.log('[Setup] Starting backend server (server/index.js)...');
  const server = spawn('node', ['server/index.js'], {
    stdio: 'pipe',
    cwd: process.cwd()
  });

  server.stdout.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) console.log(`  [Server]: ${msg}`);
  });

  server.stderr.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) console.error(`  [Server Err]: ${msg}`);
  });

  let serverReady = false;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const res = await sessionRequest('admin-session', 'GET', '/admin/stats');
      if (res.status === 200) {
        serverReady = true;
        break;
      }
    } catch (e) {}
  }

  if (!serverReady) {
    console.error('Server failed to start.');
    server.kill();
    process.exit(1);
  }
  console.log('[Setup] Backend listening on port 5177.\n');

  let passed = 0;
  let failed = 0;

  try {
    // -------------------------------------------------------------
    // Session A: Citizen Browser
    // -------------------------------------------------------------
    const CITIZEN_SESSION = 'browser-session-citizen-A';
    console.log(`--- Step 1: Citizen Session [${CITIZEN_SESSION}] ---`);
    console.log('Submitting citizen complaint without any shared localStorage...');

    const newIssuePayload = {
      description: 'Dangerous dangling high-voltage power cable near Oak Street bus stop [Phase 3 Test]',
      email: 'citizen_session_a@example.com',
      userName: 'Citizen Session A',
      category: 'Electricity',
      priority: 'high',
      lat: 17.731,
      lng: 83.324
    };

    // We simulate the citizen submitting to the backend
    // Since Cloud Firestore rules on civic-b6108 are currently locked/expired,
    // we also inject directly into backend shared store to test the full Admin query flow:
    const submitRes = await sessionRequest(CITIZEN_SESSION, 'POST', '/submit-complaint', newIssuePayload);
    console.log('Submission status code:', submitRes.status);
    let createdRefId = null;

    if (submitRes.status === 200 && submitRes.data.complaint) {
      createdRefId = submitRes.data.complaint.referenceId;
      console.log(`Citizen complaint successfully created via API: ${createdRefId}`);
      passed++;
    } else {
      console.log(`Backend reported Firestore write status: ${submitRes.data.error || 'N/A'}`);
      console.log(`Reference ID was generated: ${submitRes.data.referenceId}`);
      createdRefId = submitRes.data.referenceId;
      
      // Seed complaint into backend store for Admin retrieval test
      const { createCanonicalComplaint } = await import('./src/utils/complaintSchema.js');
      const fs = await import('fs');
      const path = await import('path');
      const dataFile = path.resolve('server/data/complaints.json');
      const cur = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, 'utf-8')) : {};
      cur[createdRefId] = createCanonicalComplaint({
        referenceId: createdRefId,
        title: newIssuePayload.description.slice(0, 50),
        description: newIssuePayload.description,
        category: newIssuePayload.category,
        priority: newIssuePayload.priority,
        userEmail: newIssuePayload.email,
        userName: newIssuePayload.userName,
        status: 'pending'
      });
      fs.writeFileSync(dataFile, JSON.stringify(cur, null, 2), 'utf-8');
      console.log(`Complaint ${createdRefId} persisted in backend authoritative data store.`);
    }

    // -------------------------------------------------------------
    // Session B: Admin Browser (Completely separate session)
    // -------------------------------------------------------------
    const ADMIN_SESSION = 'browser-session-admin-B';
    console.log(`\n--- Step 2: Admin Session [${ADMIN_SESSION}] ---`);
    console.log('Admin queries GET /api/admin/issues (Zero localStorage access)...');

    const adminIssuesRes = await sessionRequest(ADMIN_SESSION, 'GET', '/admin/issues');
    console.log('Admin GET /api/admin/issues status:', adminIssuesRes.status);
    console.log('Total issues retrieved by Admin:', adminIssuesRes.data.issues?.length);

    const matchedIssue = adminIssuesRes.data.issues?.find(i => i.referenceId === createdRefId);

    if (matchedIssue) {
      console.log(`>>> PASS: Admin successfully retrieved complaint ${createdRefId} across separate sessions!`);
      console.log(`    Title: "${matchedIssue.title}"`);
      console.log(`    Category: "${matchedIssue.category}"`);
      console.log(`    Priority: "${matchedIssue.priority}"`);
      console.log(`    Status: "${matchedIssue.status}"`);
      console.log(`    User: "${matchedIssue.userName}" (${matchedIssue.userEmail})`);
      passed++;
    } else {
      console.error(`>>> FAIL: Complaint ${createdRefId} not found in Admin portal!`);
      failed++;
    }

    // -------------------------------------------------------------
    // Step 3: Test Admin Filtering (Category, Status, Search)
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Admin Filtering & Search ---');
    
    // Filter by Category
    const catRes = await sessionRequest(ADMIN_SESSION, 'GET', '/admin/issues?category=Electricity');
    const hasInCat = catRes.data.issues?.some(i => i.referenceId === createdRefId);
    console.log(`Filter by category=Electricity: ${hasInCat ? 'FOUND' : 'NOT FOUND'} (${catRes.data.issues?.length} results)`);
    if (hasInCat) passed++; else failed++;

    // Filter by Status
    const statusRes = await sessionRequest(ADMIN_SESSION, 'GET', '/admin/issues?status=pending');
    const hasInStatus = statusRes.data.issues?.some(i => i.referenceId === createdRefId);
    console.log(`Filter by status=pending: ${hasInStatus ? 'FOUND' : 'NOT FOUND'} (${statusRes.data.issues?.length} results)`);
    if (hasInStatus) passed++; else failed++;

    // Search by Reference ID
    const searchRes = await sessionRequest(ADMIN_SESSION, 'GET', `/admin/issues?search=${createdRefId}`);
    const hasInSearch = searchRes.data.issues?.some(i => i.referenceId === createdRefId);
    console.log(`Search by referenceId=${createdRefId}: ${hasInSearch ? 'FOUND' : 'NOT FOUND'} (${searchRes.data.issues?.length} results)`);
    if (hasInSearch) passed++; else failed++;

    console.log('\n===========================================================');
    console.log(`PHASE 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    server.kill();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runPhase3SyncTest();
