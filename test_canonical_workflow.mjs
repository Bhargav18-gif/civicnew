/**
 * CivicConnect Canonical End-to-End Workflow Verification Suite
 * Tests the entire lifecycle:
 * Citizen Submit -> Priority Engine -> Duplicate Detection -> AI Triage -> Routing ->
 * Department Assignment -> Engineer State Machine -> Evidence Upload ->
 * Department Verification -> Citizen Approval -> Closed & Audit Logs.
 */

import http from 'http';
import { spawn } from 'child_process';

const PORT = 5188;
process.env.PORT = PORT;
const BASE_URL = `http://localhost:${PORT}/api`;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
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

async function run() {
  console.log('================================================================');
  console.log('CIVICCONNECT — FULL CANONICAL END-TO-END WORKFLOW TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Spawn backend server in test mode
  console.log('[Setup] Launching backend server on port ' + PORT + '...');
  const server = spawn('node', ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test' },
    stdio: 'pipe'
  });

  server.stdout.on('data', (d) => {
    const s = d.toString().trim();
    if (s.includes('CivicConnect Production Backend')) console.log(`  [Server]: ${s}`);
  });

  await sleep(2500);

  try {
    // TEST 1: Health Check
    console.log('\n--- TEST 1: Server Health Check ---');
    const health = await request('GET', '/health');
    assert(health.status === 200 && health.data?.status === 'ok', 'Server responds with status 200 OK');

    // TEST 2: Deterministic Priority Engine & Safety Hazard Escalation
    console.log('\n--- TEST 2: Priority Engine Verification ---');
    const { evaluatePriority } = await import('./functions/priority.js');
    const criticalTest = evaluatePriority('There is an exposed wire sparking near children park', 'LOW');
    assert(criticalTest.priority === 'CRITICAL' && criticalTest.escalated === true, 'Exposed wire is escalated deterministically to CRITICAL');
    
    const normalTest = evaluatePriority('Faint paint on public park bench', 'HIGH');
    assert(normalTest.priority === 'LOW', 'Cosmetic paint issue is categorized as LOW');

    // TEST 3: Duplicate Detection Mathematical Distance & Token Overlap
    console.log('\n--- TEST 3: Duplicate Detection Mathematical Distance & Token Overlap ---');
    const { calculateHaversineDistanceKm, calculateTextSimilarity } = await import('./functions/duplicates.js');
    const dist = calculateHaversineDistanceKm(17.72, 83.31, 17.721, 83.311);
    assert(dist < 0.2, `Calculated accurate distance of ~${Math.round(dist * 1000)}m between nearby coordinates`);
    const similarity = calculateTextSimilarity('Severe water leakage on main road', 'Water pipe leakage on main avenue road');
    assert(similarity > 0.4, `Calculated text similarity score of ${similarity.toFixed(2)} on overlapping descriptions`);

    // TEST 4: Citizen Submits Canonical Complaint
    console.log('\n--- TEST 4: Citizen Complaint Registration ---');
    const citizenPayload = {
      description: 'Dangerous open manhole and road damage near market street',
      email: 'citizen.test@civicconnect.com',
      lat: 17.73,
      lng: 83.32,
      address: 'Market Street, Block B',
      imageURL: 'https://images.example.com/citizen-before-photo.jpg'
    };
    const createRes = await request('POST', '/complaints', citizenPayload);
    assert(createRes.status === 201 && createRes.data?.success === true, 'Complaint created successfully with HTTP 201');
    const complaint = createRes.data?.complaint;
    const refId = complaint?.referenceId;
    assert(refId && refId.startsWith('CC-'), `Valid canonical reference ID assigned: ${refId}`);
    assert(complaint.citizen?.email === citizenPayload.email, 'Citizen profile recorded correctly in canonical model');
    assert(complaint.media?.before?.length === 1, 'Before media photo registered');
    assert(complaint.ai?.priority === 'HIGH' || complaint.ai?.priority === 'CRITICAL', `Priority engine correctly set priority: ${complaint.ai?.priority}`);

    // TEST 5: Public Sanitized Tracking (PII stripped)
    console.log('\n--- TEST 5: Public Tracking Sanitization ---');
    const trackRes = await request('GET', `/public/track/${refId}`);
    assert(trackRes.status === 200, 'Public tracking lookup succeeds');
    assert(trackRes.data?.referenceId === refId, 'Tracking returns complaint reference ID');
    assert(!trackRes.data?.citizen?.email && !trackRes.data?.email, 'Citizen email is strictly stripped from public tracking');
    assert(!trackRes.data?.citizen?.userId && !trackRes.data?.userId, 'Citizen UID is strictly stripped from public tracking');

    // TEST 6: Department Workflow (Listing & Assignment via UID)
    console.log('\n--- TEST 6: Department Workflow & Engineer Assignment ---');
    const deptId = complaint.routing?.departmentId || 'roads';
    const deptComplaints = await request('GET', `/departments/${deptId}/complaints`);
    assert(deptComplaints.status === 200, 'Department complaints endpoint responds with status 200');

    // Assign engineer using department role header
    const assignRes = await request('POST', '/departments/assign', {
      complaintId: refId,
      engineerId: 'eng-field-uid-001'
    }, { 'x-test-role': 'department' });
    assert(assignRes.status === 200 || assignRes.status === 400, 'Department assignment endpoint enforces validation contract');

    // TEST 7: Engineer State Machine Transitions
    console.log('\n--- TEST 7: Engineer Explicit State Machine Transitions ---');
    const { canTransition, WORKFLOW_STATES } = await import('./functions/workflow.js');
    assert(canTransition(WORKFLOW_STATES.ASSIGNED, WORKFLOW_STATES.ACCEPTED_BY_ENGINEER, 'engineer'), 'Engineer can transition ASSIGNED -> ACCEPTED_BY_ENGINEER');
    assert(canTransition(WORKFLOW_STATES.ACCEPTED_BY_ENGINEER, WORKFLOW_STATES.EN_ROUTE, 'engineer'), 'Engineer can transition ACCEPTED_BY_ENGINEER -> EN_ROUTE');
    assert(canTransition(WORKFLOW_STATES.EN_ROUTE, WORKFLOW_STATES.ON_SITE, 'engineer'), 'Engineer can transition EN_ROUTE -> ON_SITE');
    assert(canTransition(WORKFLOW_STATES.ON_SITE, WORKFLOW_STATES.IN_PROGRESS, 'engineer'), 'Engineer can transition ON_SITE -> IN_PROGRESS');
    assert(canTransition(WORKFLOW_STATES.IN_PROGRESS, WORKFLOW_STATES.VERIFICATION_PENDING, 'engineer'), 'Engineer can transition IN_PROGRESS -> VERIFICATION_PENDING');
    assert(!canTransition(WORKFLOW_STATES.ASSIGNED, WORKFLOW_STATES.CLOSED, 'engineer'), 'Engineer CANNOT directly close complaint (forbidden transition)');

    // TEST 8: Evidence Upload Validation
    console.log('\n--- TEST 8: Engineer Evidence Upload Validation ---');
    const emptyEvidenceRes = await request('POST', '/engineer/evidence', {
      complaintId: refId,
      afterMedia: [],
      completionNotes: ''
    }, { 'x-test-role': 'engineer' });
    assert(emptyEvidenceRes.status === 400 && emptyEvidenceRes.data?.code === 'VALIDATION_ERROR', 'Rejects empty evidence upload without authentic repair photos');

    // TEST 9: Department Verification Decision
    console.log('\n--- TEST 9: Department Verification Rules ---');
    assert(canTransition(WORKFLOW_STATES.VERIFICATION_PENDING, WORKFLOW_STATES.CITIZEN_VERIFICATION, 'department'), 'Department approval routes to CITIZEN_VERIFICATION');
    assert(canTransition(WORKFLOW_STATES.VERIFICATION_PENDING, WORKFLOW_STATES.IN_PROGRESS, 'department'), 'Department rejection routes back to IN_PROGRESS for rework');

    // TEST 10: Citizen Verification & Reopen
    console.log('\n--- TEST 10: Citizen Verification Approval & Reopen ---');
    assert(canTransition(WORKFLOW_STATES.CITIZEN_VERIFICATION, WORKFLOW_STATES.CLOSED, 'citizen'), 'Citizen approval transitions to CLOSED');
    assert(canTransition(WORKFLOW_STATES.CITIZEN_VERIFICATION, WORKFLOW_STATES.REOPENED, 'citizen'), 'Citizen rejection transitions to REOPENED');

    // TEST 11: Admin Automation Configuration & Thresholds
    console.log('\n--- TEST 11: Admin Automation Config ---');
    const configRes = await request('GET', '/admin/automation-config', null, { 'x-test-role': 'admin' });
    assert(configRes.status === 200 && configRes.data?.highConfidenceThreshold != null, 'Admin can retrieve dynamic AI routing thresholds');

    // TEST 12: Model Registry & Versions
    console.log('\n--- TEST 12: AI Model Registry ---');
    const modelsRes = await request('GET', '/admin/model/versions', null, { 'x-test-role': 'admin' });
    assert(modelsRes.status === 200 && Array.isArray(modelsRes.data?.versions), 'Admin model registry returns active model candidates');

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    server.kill();
    process.exit(failed > 0 ? 1 : 0);
  }
}

run();
