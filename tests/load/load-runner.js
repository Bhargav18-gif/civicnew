/**
 * CivicConnect Automated Multi-Stage Load & Performance Testing Engine
 * Executes Smoke, Load, Stress, and Spike stages, records percentile latency distributions,
 * throughput, error rates, and generates `reports/load-test-summary.json` & `.html`.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:5177/api';

async function executeStage({ name, concurrentUsers, totalRequests, description, endpoint, method, payloadGenerator }) {
  console.log(`\n▶ Running Stage: [${name}] - ${concurrentUsers} VUs | Target: ${totalRequests} Requests (${description})`);

  const latencies = [];
  let successfulRequests = 0;
  let failedRequests = 0;
  let timeouts = 0;

  const startTime = Date.now();
  let completed = 0;
  let inFlight = 0;
  let reqIndex = 0;

  async function worker() {
    while (reqIndex < totalRequests) {
      const currentIdx = reqIndex++;
      const reqStart = Date.now();
      try {
        const payload = payloadGenerator ? payloadGenerator(currentIdx) : null;
        const config = { timeout: 8000, validateStatus: () => true };
        
        let res;
        if (method === 'POST') {
          res = await axios.post(`${BASE_URL}${endpoint}`, payload, config);
        } else {
          res = await axios.get(`${BASE_URL}${endpoint}`, config);
        }

        const duration = Date.now() - reqStart;
        latencies.push(duration);

        if (res.status >= 200 && res.status < 400) {
          successfulRequests++;
        } else {
          failedRequests++;
        }
      } catch (err) {
        const duration = Date.now() - reqStart;
        latencies.push(duration);
        failedRequests++;
        if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
          timeouts++;
        }
      }
      completed++;
    }
  }

  // Launch worker pool
  const workers = [];
  const poolSize = Math.min(concurrentUsers, totalRequests);
  for (let i = 0; i < poolSize; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  const totalDurationMs = Date.now() - startTime;
  latencies.sort((a, b) => a - b);

  const avgLatency = latencies.length > 0 ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2) : 0;
  const p90 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.90)] : 0;
  const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
  const p99 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0;
  const minLatency = latencies[0] || 0;
  const maxLatency = latencies[latencies.length - 1] || 0;
  const reqPerSec = ((totalRequests / (totalDurationMs / 1000)) || 0).toFixed(2);
  const errorRate = ((failedRequests / totalRequests) * 100).toFixed(2);

  const summary = {
    stage: name,
    concurrentUsers,
    totalRequests,
    successfulRequests,
    failedRequests,
    timeouts,
    durationSeconds: (totalDurationMs / 1000).toFixed(2),
    requestsPerSecond: Number(reqPerSec),
    errorRatePercent: Number(errorRate),
    metrics: {
      minMs: minLatency,
      avgMs: Number(avgLatency),
      p90Ms: p90,
      p95Ms: p95,
      p99Ms: p99,
      maxMs: maxLatency,
    }
  };

  console.log(`  ✓ Completed in ${summary.durationSeconds}s | Req/s: ${reqPerSec} | Avg: ${avgLatency}ms | p95: ${p95}ms | Error: ${errorRate}%`);
  return summary;
}

export async function runAllLoadTests() {
  console.log('================================================================');
  console.log(' CIVICCONNECT — AUTOMATED LOAD & STRESS TESTING SUITE');
  console.log('================================================================');

  const configuredVu = parseInt(process.env.K6_VUS || '50', 10);

  const results = [];

  // Stage 1: Smoke Test
  results.push(await executeStage({
    name: 'SMOKE_TEST',
    concurrentUsers: 5,
    totalRequests: 25,
    description: 'Baseline health & map query',
    endpoint: '/public/map-complaints',
    method: 'GET'
  }));

  // Stage 2: Load Test (Concurrent Complaint Ingestion)
  results.push(await executeStage({
    name: 'LOAD_INGESTION',
    concurrentUsers: Math.min(configuredVu, 50),
    totalRequests: 100,
    description: 'Simultaneous citizen complaint submission',
    endpoint: '/complaints',
    method: 'POST',
    payloadGenerator: (idx) => ({
      description: `Load Test ${idx}: Potentially dangerous street obstacle on Sector 7`,
      category: 'Roads & Infrastructure',
      lat: 17.7289,
      lng: 83.3031,
      email: `loaduser${idx}@civicconnect.com`
    })
  }));

  // Stage 3: Stress Stage
  results.push(await executeStage({
    name: 'STRESS_READ_HEAVY',
    concurrentUsers: Math.min(configuredVu * 2, 100),
    totalRequests: 200,
    description: 'Rapid health and status queries',
    endpoint: '/health',
    method: 'GET'
  }));

  // Stage 4: Spike Stage
  results.push(await executeStage({
    name: 'SPIKE_BURST',
    concurrentUsers: 150,
    totalRequests: 150,
    description: 'Instant concurrent traffic spike',
    endpoint: '/public/map-complaints',
    method: 'GET'
  }));

  // Save JSON summary
  const reportsDir = path.resolve(__dirname, '..', '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const jsonReport = {
    testSuite: 'CivicConnect Automated Load & Stress Suite',
    timestamp: new Date().toISOString(),
    apiBase: BASE_URL,
    stages: results
  };

  fs.writeFileSync(
    path.join(reportsDir, 'load-test-summary.json'),
    JSON.stringify(jsonReport, null, 2),
    'utf8'
  );

  // Generate HTML Report
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CivicConnect Load Test Summary</title>
  <style>
    :root { --bg: #0b0f19; --card-bg: #131b2e; --text: #e2e8f0; --border: #1e293b; --pass: #10b981; --accent: #06b6d4; }
    body { font-family: -apple-system, sans-serif; background: var(--bg); color: var(--text); padding: 30px; margin: 0; }
    .container { max-width: 1100px; margin: 0 auto; }
    .header { border-bottom: 1px solid var(--border); padding-bottom: 20px; margin-bottom: 25px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 18px; }
    .val { font-size: 26px; font-weight: 700; color: var(--accent); margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; background: var(--card-bg); border-radius: 12px; overflow: hidden; border: 1px solid var(--border); margin-top: 20px; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border); font-size: 13px; }
    th { background: #0f172a; color: #94a3b8; }
    .badge { padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; background: rgba(16,185,129,0.15); color: var(--pass); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0 0 8px 0; font-size: 26px;">⚡ CivicConnect Load & Throughput Test Summary</h1>
      <p style="margin:0; color:#94a3b8; font-size: 14px;">k6-Compatible Multi-Stage Load & Latency Distribution Analysis</p>
      <p style="margin:4px 0 0 0; color:#94a3b8; font-size: 13px;">Tested at: ${new Date().toUTCString()}</p>
    </div>

    <div class="grid">
      <div class="card">
        <div style="font-size:12px; color:#94a3b8;">TOTAL REQUESTS EXECUTED</div>
        <div class="val">${results.reduce((a, b) => a + b.totalRequests, 0)}</div>
      </div>
      <div class="card">
        <div style="font-size:12px; color:#94a3b8;">AVG LATENCY ACROSS RUNS</div>
        <div class="val">${(results.reduce((a, b) => a + b.metrics.avgMs, 0) / results.length).toFixed(1)} ms</div>
      </div>
      <div class="card">
        <div style="font-size:12px; color:#94a3b8;">OVERALL SUCCESS RATE</div>
        <div class="val" style="color:var(--pass);">${(100 - (results.reduce((a, b) => a + b.failedRequests, 0) / results.reduce((a, b) => a + b.totalRequests, 0) * 100)).toFixed(2)}%</div>
      </div>
    </div>

    <h2>Load Test Stage Breakdowns</h2>
    <table>
      <thead>
        <tr>
          <th>Stage</th>
          <th>VUs</th>
          <th>Total Requests</th>
          <th>Duration (s)</th>
          <th>Throughput (Req/s)</th>
          <th>Avg Latency</th>
          <th>p90 Latency</th>
          <th>p95 Latency</th>
          <th>p99 Latency</th>
          <th>Error Rate</th>
        </tr>
      </thead>
      <tbody>
        ${results.map(r => `
          <tr>
            <td style="font-weight:600; color:#fff;">${r.stage}</td>
            <td>${r.concurrentUsers}</td>
            <td>${r.totalRequests}</td>
            <td>${r.durationSeconds}s</td>
            <td style="color:#38bdf8; font-weight:600;">${r.requestsPerSecond}</td>
            <td>${r.metrics.avgMs} ms</td>
            <td>${r.metrics.p90Ms} ms</td>
            <td style="font-weight:600; color:#facc15;">${r.metrics.p95Ms} ms</td>
            <td>${r.metrics.p99Ms} ms</td>
            <td><span class="badge">${r.errorRatePercent}%</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(reportsDir, 'load-test-summary.html'), htmlContent, 'utf8');
  console.log(`\n✅ Load test reports generated:`);
  console.log(`  - reports/load-test-summary.json`);
  console.log(`  - reports/load-test-summary.html\n`);
  return jsonReport;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runAllLoadTests();
}
