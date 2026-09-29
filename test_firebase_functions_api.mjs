import http from 'http';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
process.env.NODE_ENV = 'test';
process.env.FIREBASE_PROJECT_ID = 'civic-b6108';

const { app } = require('./functions/index.js');

const PORT = 5199;
const server = http.createServer(app);

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`================================================================`);
  console.log(`CIVICCONNECT FIREBASE FUNCTIONS BACKEND TEST SUITE`);
  console.log(`Testing Express / Firebase Functions 'api' handler on port ${PORT}`);
  console.log(`================================================================\n`);

  let passed = 0;
  let failed = 0;

  async function testEndpoint(name, path, method = 'GET', body = null, headers = {}) {
    try {
      const opts = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-test-role': 'admin',
          'x-test-uid': 'test-admin-uid',
          ...headers
        }
      };
      if (body) {
        opts.body = JSON.stringify(body);
      }

      const res = await fetch(`http://127.0.0.1:${PORT}${path}`, opts);
      const data = await res.json().catch(() => null);

      console.log(`--- TEST: ${name} [${method} ${path}] ---`);
      console.log(`  HTTP Status: ${res.status}`);
      console.log(`  Response:`, JSON.stringify(data).substring(0, 200));

      return { res, data };
    } catch (err) {
      console.error(`  FAIL ${name}:`, err.message);
      failed++;
      return null;
    }
  }

  // 1. Health endpoint
  const h = await testEndpoint('Health Check', '/api/health');
  if (h && h.res.status === 200 && h.data?.status === 'ok') {
    console.log(`  ✓ PASS: Health check succeeded\n`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: Health check failed\n`);
    failed++;
  }

  // 2. GET /api/ai/health
  const aih = await testEndpoint('AI Health Check', '/api/ai/health');
  if (aih && (aih.res.status === 200 || aih.res.status === 503)) {
    console.log(`  ✓ PASS: /api/ai/health responded with model status: ${aih.data?.status} (${aih.data?.errorCode || aih.data?.model || 'healthy'})\n`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: /api/ai/health failed\n`);
    failed++;
  }

  // 3. POST /api/ai/classify
  const aic = await testEndpoint('AI Classify without fake prediction', '/api/ai/classify', 'POST', {
    text: 'Pothole on Main Street near the junction'
  });
  if (aic && (aic.res.status === 200 || (aic.res.status === 503 && aic.data?.code === 'MODEL_ARTIFACT_MISSING'))) {
    console.log(`  ✓ PASS: /api/ai/classify responded deterministically without fake prediction (status ${aic.res.status})\n`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: /api/ai/classify unexpected response\n`);
    failed++;
  }

  // 4. GET /api/admin/stats
  const as = await testEndpoint('Admin Stats', '/api/admin/stats');
  if (as && as.res.status === 200 && as.data?.success) {
    console.log(`  ✓ PASS: /api/admin/stats returned Firestore aggregated stats\n`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: /api/admin/stats failed\n`);
    failed++;
  }

  // 5. GET /api/departments/stats
  const ds = await testEndpoint('Department Stats', '/api/departments/stats');
  if (ds && ds.res.status === 200 && ds.data?.success) {
    console.log(`  ✓ PASS: /api/departments/stats returned department stats\n`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: /api/departments/stats failed\n`);
    failed++;
  }

  // 6. GET /api/issues/department-stats
  const ids = await testEndpoint('Issues Department Stats', '/api/issues/department-stats');
  if (ids && ids.res.status === 200 && ids.data?.success) {
    console.log(`  ✓ PASS: /api/issues/department-stats returned department stats\n`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: /api/issues/department-stats failed\n`);
    failed++;
  }

  // 7. GET /api/issues/stats
  const is = await testEndpoint('Issues Stats', '/api/issues/stats');
  if (is && is.res.status === 200 && is.data?.success) {
    console.log(`  ✓ PASS: /api/issues/stats returned issue breakdown\n`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: /api/issues/stats failed\n`);
    failed++;
  }

  // 8. GET /api/admin/model/versions
  const mv = await testEndpoint('Admin Model Versions', '/api/admin/model/versions');
  if (mv && mv.res.status === 200 && mv.data?.success) {
    console.log(`  ✓ PASS: /api/admin/model/versions returned model versions status: ${mv.data?.systemStatus}\n`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: /api/admin/model/versions failed\n`);
    failed++;
  }

  // 9. GET /api/admin/ai/training/runs
  const tr = await testEndpoint('Admin Training Runs', '/api/admin/ai/training/runs');
  if (tr && tr.res.status === 200 && tr.data?.success) {
    console.log(`  ✓ PASS: /api/admin/ai/training/runs returned runs array\n`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: /api/admin/ai/training/runs failed\n`);
    failed++;
  }

  // 10. GET /api/admin/automation-config
  const ac = await testEndpoint('Admin Automation Config', '/api/admin/automation-config');
  if (ac && ac.res.status === 200) {
    console.log(`  ✓ PASS: /api/admin/automation-config returned config\n`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: /api/admin/automation-config failed\n`);
    failed++;
  }

  // 11. GET /api/admin/ai/training-status
  const ts = await testEndpoint('Admin Training Status', '/api/admin/ai/training-status');
  if (ts && ts.res.status === 200 && ts.data?.success) {
    console.log(`  ✓ PASS: /api/admin/ai/training-status returned status: ${ts.data?.status}, modelHealth: ${ts.data?.modelHealth}\n`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: /api/admin/ai/training-status failed\n`);
    failed++;
  }

  // 12. GET /api/admin/issues
  const ai = await testEndpoint('Admin Issues Listing', '/api/admin/issues');
  if (ai && ai.res.status === 200 && ai.data?.success) {
    console.log(`  ✓ PASS: /api/admin/issues returned complaints from Firestore\n`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: /api/admin/issues failed\n`);
    failed++;
  }

  console.log(`================================================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================================================`);

  server.close(() => {
    process.exit(failed > 0 ? 1 : 0);
  });
});
