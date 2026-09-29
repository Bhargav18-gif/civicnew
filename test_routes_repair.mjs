import http from 'http';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { app } = require('./functions/index.js');

const PORT = 5199;
const BASE_URL = `http://127.0.0.1:${PORT}`;

process.env.NODE_ENV = 'test';

async function run() {
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`[TEST RUNNER] Test server listening on port ${PORT}`);
  // Allow initial service account handshake
  await new Promise(r => setTimeout(r, 1500));

  let passed = 0;
  let failed = 0;

  async function check(name, url, options = {}, validator) {
    try {
      const res = await fetch(`${BASE_URL}${url}`, options);
      const data = await res.json().catch(() => null);
      const isOk = validator ? validator(res, data) : res.status === 200;

      if (isOk) {
        console.log(`  ✓ PASS: ${name} [HTTP ${res.status}]`);
        passed++;
      } else {
        console.error(`  ✗ FAIL: ${name} [HTTP ${res.status}] -> Response:`, data);
        failed++;
      }
    } catch (err) {
      console.error(`  ✗ ERROR: ${name} ->`, err.message);
      failed++;
    }
  }

  console.log('\n--- AUDITING ALL CRITICAL API ROUTES ---');

  // 1. Health checks
  await check('GET /api/health', '/api/health', {}, (r, d) => r.status === 200 && d.status === 'ok');
  await check('GET /api/ai/health', '/api/ai/health', {}, (r, d) => (r.status === 200 || r.status === 503) && (d.status === 'healthy' || d.errorCode === 'MODEL_ARTIFACT_MISSING'));

  // 2. Admin & Stats
  await check(
    'GET /api/admin/stats (Admin Token)',
    '/api/admin/stats',
    { headers: { 'x-test-role': 'admin' } },
    (r, d) => r.status === 200 && d.success === true && typeof d.stats?.totalComplaints === 'number'
  );

  // 3. Department Stats
  await check(
    'GET /api/departments/stats',
    '/api/departments/stats',
    {},
    (r, d) => r.status === 200 && d.success === true && Array.isArray(d.departments) && d.departments.length > 0
  );

  // 4. Issues Department Stats
  await check(
    'GET /api/issues/department-stats',
    '/api/issues/department-stats',
    {},
    (r, d) => r.status === 200 && d.success === true && Array.isArray(d.departments)
  );

  // 5. Issues Stats
  await check(
    'GET /api/issues/stats',
    '/api/issues/stats',
    {},
    (r, d) => r.status === 200 && d.success === true && typeof d.stats?.total === 'number' && Array.isArray(d.byDepartment)
  );

  // 6. AI Model Versions
  await check(
    'GET /api/admin/model/versions (Admin Token)',
    '/api/admin/model/versions',
    { headers: { 'x-test-role': 'admin' } },
    (r, d) => r.status === 200 && d.success === true && (Array.isArray(d.models) || d.systemStatus === 'MODEL_ARTIFACT_MISSING')
  );

  // 7. AI Training Runs
  await check(
    'GET /api/admin/ai/training/runs (Admin Token)',
    '/api/admin/ai/training/runs',
    { headers: { 'x-test-role': 'admin' } },
    (r, d) => r.status === 200 && d.success === true && Array.isArray(d.runs)
  );

  // 8. AI Training Status
  await check(
    'GET /api/admin/ai/training-status (Admin Token)',
    '/api/admin/ai/training-status',
    { headers: { 'x-test-role': 'admin' } },
    (r, d) => r.status === 200 && d.success === true && (d.status === 'IDLE' || d.status === 'RUNNING') && d.modelHealth
  );

  // 9. Automation Config
  await check(
    'GET /api/admin/automation-config (Admin Token)',
    '/api/admin/automation-config',
    { headers: { 'x-test-role': 'admin' } },
    (r, d) => r.status === 200 && (typeof d.highConfidenceThreshold === 'number' || typeof d.config?.highConfidenceThreshold === 'number')
  );

  // 10. AI Classification
  await check(
    'POST /api/ai/classify (Valid Input)',
    '/api/ai/classify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Exposed live power wire sparking on pedestrian path.' })
    },
    (r, d) => (r.status === 200 && d.department) || (r.status === 503 && (d.error?.code === 'AI_UNAVAILABLE' || d.error?.code === 'MODEL_ARTIFACT_MISSING'))
  );

  // 11. Security - 404 handler returns clean JSON
  await check(
    'GET /api/unknown-route -> Standard JSON 404 (Never HTML)',
    '/api/non-existent-endpoint-test',
    {},
    (r, d) => r.status === 404 && d.success === false && d.error?.code === 'NOT_FOUND'
  );

  console.log(`\n========================================================`);
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================================\n`);

  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

run();
