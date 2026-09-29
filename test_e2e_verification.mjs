import http from 'http';
import { spawn } from 'child_process';

const PORT = 5177;
const BASE_URL = `http://localhost:${PORT}/api`;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
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

async function runTests() {
  console.log('====================================================');
  console.log('Starting End-to-End CivicConnect Dataflow Verification');
  console.log('====================================================\n');

  // 1. Start Server
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

  // Wait for server to become responsive
  let serverReady = false;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const res = await request('GET', '/admin/stats');
      if (res.status === 200) {
        serverReady = true;
        break;
      }
    } catch (e) {}
  }

  if (!serverReady) {
    console.error('Server failed to start within timeout.');
    server.kill();
    process.exit(1);
  }
  console.log('[Setup] Backend server is listening and ready.\n');

  let testPassed = 0;
  let testFailed = 0;

  try {
    // TEST A: Departments endpoint
    console.log('--- TEST A: Departments endpoint (GET /api/departments) ---');
    const deptRes = await request('GET', '/departments');
    console.log('Departments Response Status:', deptRes.status);
    console.log('Departments count:', Array.isArray(deptRes.data) ? deptRes.data.length : 'not array');
    if (deptRes.status === 200 && Array.isArray(deptRes.data) && deptRes.data.length > 0) {
      console.log(`>>> PASS: Departments endpoint returned ${deptRes.data.length} municipal departments: ${deptRes.data.map(d => d.name).join(', ')}\n`);
      testPassed++;
    } else {
      console.error('>>> FAIL: Departments endpoint failed');
      testFailed++;
    }

    // TEST B: User role lookup endpoint
    console.log('--- TEST B: User role resolution (GET /api/user/role) ---');
    const adminRoleRes = await request('GET', '/user/role?email=admin@civicconnect.com');
    const deptRoleRes = await request('GET', '/user/role?email=roads@civicconnect.com');
    const engRoleRes = await request('GET', '/user/role?email=engineer@civicconnect.com');
    const citizenRoleRes = await request('GET', '/user/role?email=citizen@example.com');

    console.log('Role responses:', {
      admin: adminRoleRes.data.role,
      department: deptRoleRes.data.role,
      engineer: engRoleRes.data.role,
      citizen: citizenRoleRes.data.role
    });

    if (
      adminRoleRes.data.role === 'admin' &&
      deptRoleRes.data.role === 'department' &&
      engRoleRes.data.role === 'engineer' &&
      citizenRoleRes.data.role === 'citizen'
    ) {
      console.log('>>> PASS: Role resolution correctly identified all 4 civic roles\n');
      testPassed++;
    } else {
      console.error('>>> FAIL: User role resolution failed');
      testFailed++;
    }

    // TEST 1 & 2: Citizen submits complaint and receives valid referenceId
    console.log('--- TEST 1 & 2: Citizen submits complaint ---');
    const citizenEmail = `citizen_${Date.now()}@example.com`;
    const submitRes = await request('POST', '/submit-complaint', {
      description: 'Major water main burst and street flooding on 5th Avenue [E2E Test]',
      email: citizenEmail,
      userName: 'Verification Citizen',
      category: 'Water',
      priority: 'high',
      lat: 17.72,
      lng: 83.31
    });

    console.log('Citizen Submission Response Status:', submitRes.status);
    console.log('Submission Body:', JSON.stringify(submitRes.data, null, 2));

    const complaint = submitRes.data.complaint;
    if (submitRes.status === 200 && submitRes.data.success && complaint && complaint.referenceId) {
      console.log(`>>> PASS: Complaint created with ID: ${complaint.referenceId}\n`);
      testPassed++;
    } else {
      console.error('>>> FAIL: Citizen submission failed');
      testFailed++;
      throw new Error('Complaint submission failed');
    }

    const testRefId = complaint.referenceId;

    // TEST 3: Admin queries complaint list from separate session
    console.log('--- TEST 3: Admin retrieves complaints via /api/admin/issues ---');
    const adminRes = await request('GET', '/admin/issues');
    console.log('Admin Issues Count:', adminRes.data.issues?.length);
    const foundInAdmin = adminRes.data.issues?.find((i) => i.referenceId === testRefId);

    if (foundInAdmin) {
      console.log(`>>> PASS: Admin successfully sees complaint ${testRefId}`);
      console.log(`    Title: "${foundInAdmin.title}", Category: "${foundInAdmin.category}", Status: "${foundInAdmin.status}"\n`);
      testPassed++;
    } else {
      console.error(`>>> FAIL: Complaint ${testRefId} not found in Admin portal`);
      testFailed++;
    }

    // TEST 4: Admin updates complaint status
    console.log('--- TEST 4: Admin changes complaint status to in-progress ---');
    const updateRes = await request('PATCH', `/admin/issues/${testRefId}`, {
      status: 'in-progress'
    });
    console.log('Update Status Response:', updateRes.status, updateRes.data.issue?.status);

    if (updateRes.status === 200 && updateRes.data.issue?.status === 'in-progress') {
      console.log(`>>> PASS: Admin status update successful for ${testRefId}\n`);
      testPassed++;
    } else {
      console.error('>>> FAIL: Admin status update failed');
      testFailed++;
    }

    // TEST 5: Citizen tracks complaint and sees updated status
    console.log('--- TEST 5: Citizen tracks complaint via /api/issues/:id ---');
    const trackRes = await request('GET', `/issues/${testRefId}`);
    console.log('Track Response Status:', trackRes.status);
    console.log('Tracked Status:', trackRes.data.issue?.status);

    if (trackRes.status === 200 && trackRes.data.issue?.status === 'in-progress') {
      console.log(`>>> PASS: Citizen tracking shows synchronized status "in-progress"\n`);
      testPassed++;
    } else {
      console.error('>>> FAIL: Citizen tracking did not reflect updated status');
      testFailed++;
    }

    // TEST 6: Admin assigns department
    console.log('--- TEST 6: Admin assigns department (Roads) ---');
    const assignDeptRes = await request('PATCH', `/admin/issues/${testRefId}`, {
      assignedDepartment: 'Roads',
      category: 'Roads'
    });

    const deptFilterRes = await request('GET', '/admin/issues?category=Roads');
    const foundInDept = deptFilterRes.data.issues?.find((i) => i.referenceId === testRefId);

    if (foundInDept && foundInDept.assignedDepartment === 'Roads') {
      console.log(`>>> PASS: Department query received complaint ${testRefId} under Roads\n`);
      testPassed++;
    } else {
      console.error('>>> FAIL: Department did not receive assigned complaint');
      testFailed++;
    }

    // TEST 7: Department assigns engineer
    console.log('--- TEST 7: Department assigns engineer ---');
    const assignEngRes = await request('PATCH', `/admin/issues/${testRefId}`, {
      assignedEngineer: 'Rajesh Engineer',
      assignedEngineerId: 'eng-101',
      status: 'assigned'
    });

    const checkEngRes = await request('GET', `/issues/${testRefId}`);
    if (checkEngRes.data.issue?.assignedEngineer === 'Rajesh Engineer') {
      console.log(`>>> PASS: Engineer assignment verified for ${testRefId}\n`);
      testPassed++;
    } else {
      console.error('>>> FAIL: Engineer assignment failed');
      testFailed++;
    }

    // TEST 8: AI classification offline failure handling
    console.log('--- TEST 8: AI classification offline failure handling ---');
    const aiRes = await request('POST', '/admin/ai/classify', {
      description: 'Massive pothole on highway ramp causing tire punctures'
    });

    console.log('AI Response:', JSON.stringify(aiRes.data, null, 2));
    if (aiRes.data.classificationStatus === 'fallback' && aiRes.data.confidence === 0 && aiRes.data.requires_admin_review === true) {
      console.log('>>> PASS: AI failure handled gracefully with fallback status and no fake confidence\n');
      testPassed++;
    } else {
      console.error('>>> FAIL: AI failure not handled correctly');
      testFailed++;
    }

    // TEST 9: Citizen feedback and auto-reopening
    console.log('--- TEST 9: Citizen feedback submission & auto-reopen ---');
    const fbRes = await request('POST', `/issues/${testRefId}/feedback`, {
      rating: 1,
      comment: 'The leak is still active, water everywhere!',
      resolutionStatus: 'Not Resolved'
    });

    console.log('Feedback Response Status:', fbRes.status);
    console.log('Complaint Status after Feedback:', fbRes.data.issue?.status);

    if (fbRes.data.issue?.status === 'reopened') {
      console.log('>>> PASS: Citizen feedback auto-reopened the issue successfully!\n');
      testPassed++;
    } else {
      console.error('>>> FAIL: Feedback reopening failed');
      testFailed++;
    }

  } catch (err) {
    console.error('Error during test execution:', err);
  } finally {
    console.log('====================================================');
    console.log(`VERIFICATION SUMMARY: ${testPassed} PASSED, ${testFailed} FAILED`);
    console.log('====================================================');
    server.kill();
    process.exit(testFailed > 0 ? 1 : 0);
  }
}

runTests();
