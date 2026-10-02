/**
 * CivicConnect — Practical Load & Stress Testing Engine
 * 
 * Performs high-concurrency load testing against:
 * 1. Live Web Portal CDN (https://civic-b6108.web.app)
 * 2. API Read Endpoints (Health, Public Map Complaints, Statistics)
 * 3. API Transactional Write Ingest (Citizen Grievance Submissions)
 * 4. Stress Burst Phase (High Concurrency Ramp-Up)
 */

const axios = require('axios');
const http = require('http');
const https = require('https');

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 300 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 300 });

const client = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 10000,
  validateStatus: () => true
});

const LIVE_HOSTING_URL = 'https://civic-b6108.web.app';
const API_BASE = 'http://127.0.0.1:5177/api';
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyDJAJ1lLBAiSlP5T2XbLxe7Hjjje5U7nkw';

async function firebaseAuth(email, password) {
  try {
    const res = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      { email, password, returnSecureToken: true }
    );
    return res.data.idToken;
  } catch (err) {
    return null;
  }
}

function calculatePercentiles(latencies) {
  if (!latencies.length) return { min: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0, avg: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const getIndex = (p) => Math.min(Math.floor(sorted.length * p), sorted.length - 1);
  const sum = sorted.reduce((acc, v) => acc + v, 0);

  return {
    min: sorted[0],
    p50: sorted[getIndex(0.50)],
    p90: sorted[getIndex(0.90)],
    p95: sorted[getIndex(0.95)],
    p99: sorted[getIndex(0.99)],
    max: sorted[sorted.length - 1],
    avg: Math.round(sum / sorted.length)
  };
}

async function runWorkerPool(tasks, concurrency) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      const fn = tasks[i];
      try {
        const res = await fn();
        results[i] = res;
      } catch (err) {
        results[i] = { success: false, status: 0, latency: 0, error: err.message };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

async function benchmarkEndpoint(name, url, method = 'GET', data = null, headers = {}, totalRequests = 100, concurrency = 20) {
  console.log(`\n⏳ Running Load Test: [${name}]`);
  console.log(`   Target: ${url}`);
  console.log(`   Total Requests: ${totalRequests} | Concurrency: ${concurrency} simultaneous connections`);

  const tasks = Array.from({ length: totalRequests }, () => async () => {
    const start = process.hrtime.bigint();
    try {
      const res = await client({
        method,
        url,
        data,
        headers
      });
      const end = process.hrtime.bigint();
      const latencyMs = Number((end - start) / 1000000n);
      const isSuccess = res.status >= 200 && res.status < 400;
      return { success: isSuccess, status: res.status, latency: latencyMs, bytes: JSON.stringify(res.data || '').length };
    } catch (err) {
      const end = process.hrtime.bigint();
      const latencyMs = Number((end - start) / 1000000n);
      return { success: false, status: err.response?.status || 0, latency: latencyMs, error: err.message, bytes: 0 };
    }
  });

  const overallStart = Date.now();
  const results = await runWorkerPool(tasks, concurrency);
  const totalDurationSec = (Date.now() - overallStart) / 1000;

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const latencies = results.map(r => r.latency);
  const stats = calculatePercentiles(latencies);
  const rps = (totalRequests / totalDurationSec).toFixed(1);
  const totalBytes = results.reduce((acc, r) => acc + (r.bytes || 0), 0);
  const transferKb = (totalBytes / 1024).toFixed(1);

  console.log(`   ✅ Finished in: ${totalDurationSec.toFixed(2)}s | RPS: ${rps} req/sec`);
  console.log(`   📈 Success Rate: ${((successful.length / totalRequests) * 100).toFixed(1)}% (${successful.length}/${totalRequests})`);
  console.log(`   ⏱️  Latency -> Min: ${stats.min}ms | Avg: ${stats.avg}ms | p50: ${stats.p50}ms | p95: ${stats.p95}ms | p99: ${stats.p99}ms | Max: ${stats.max}ms`);
  if (failed.length > 0) {
    console.log(`   ⚠️  Failures: ${failed.length} (Status codes: ${[...new Set(failed.map(f => f.status))].join(', ')})`);
  }

  return {
    name,
    target: url,
    totalRequests,
    concurrency,
    durationSec: totalDurationSec,
    rps: Number(rps),
    successRate: (successful.length / totalRequests) * 100,
    stats,
    totalBytesKb: Number(transferKb)
  };
}

async function runFullPracticalLoadTest() {
  console.log('================================================================');
  console.log(' CIVICCONNECT LIVE LOAD & TRAFFIC CAPACITY BENCHMARK SUITE');
  console.log(' Timestamp: ' + new Date().toISOString());
  console.log('================================================================');

  const report = [];

  // 1. Live Firebase Hosting Global Edge CDN
  const cdnTest = await benchmarkEndpoint(
    'Live Web Portal CDN (Single-Page App Entrypoint)',
    LIVE_HOSTING_URL,
    'GET',
    null,
    {},
    100,
    25
  );
  report.push(cdnTest);

  // 2. Read Benchmark: Public Health Check
  const healthTest = await benchmarkEndpoint(
    'Backend Health & Engine Status API',
    `${API_BASE}/health`,
    'GET',
    null,
    {},
    200,
    30
  );
  report.push(healthTest);

  // 3. Read Benchmark: Public Map Grievance Feed (Supabase PostgreSQL Query)
  const mapTest = await benchmarkEndpoint(
    'Public Map Grievance Feed (PostgreSQL Geo Query)',
    `${API_BASE}/public/map-complaints`,
    'GET',
    null,
    {},
    150,
    25
  );
  report.push(mapTest);

  // 4. Authenticated Benchmark: Department Manager Queue Query
  const deptToken = await firebaseAuth('roads.dept@civicconnect.com', 'Dept@Roads123');
  if (deptToken) {
    const deptQueryTest = await benchmarkEndpoint(
      'Authenticated Department Queue (Scoping & Filtering)',
      `${API_BASE}/departments/roads/complaints`,
      'GET',
      null,
      { Authorization: `Bearer ${deptToken}` },
      100,
      20
    );
    report.push(deptQueryTest);
  }

  // 5. Transactional Ingestion Benchmark: Citizen Grievance Submissions
  const citizenToken = await firebaseAuth('citizen.test@civicconnect.com', 'Citizen@12345');
  if (citizenToken) {
    let complaintCounter = 0;
    const writeTasks = Array.from({ length: 50 }, () => async () => {
      complaintCounter++;
      const payload = {
        title: `Automated Load Test Issue #${complaintCounter}`,
        description: `High-concurrency load test verification record #${complaintCounter} testing database ingest and queue durability.`,
        latitude: 17.7289 + (Math.random() * 0.01),
        longitude: 83.3031 + (Math.random() * 0.01),
        address: 'Load Test Avenue, Sector 5',
        priority: 'MEDIUM'
      };

      const start = process.hrtime.bigint();
      try {
        const res = await client.post(`${API_BASE}/complaints`, payload, {
          headers: { Authorization: `Bearer ${citizenToken}` }
        });
        const end = process.hrtime.bigint();
        const latencyMs = Number((end - start) / 1000000n);
        const isSuccess = res.status === 200 || res.status === 201;
        return { success: isSuccess, status: res.status, latency: latencyMs, bytes: JSON.stringify(res.data).length };
      } catch (err) {
        const end = process.hrtime.bigint();
        const latencyMs = Number((end - start) / 1000000n);
        return { success: false, status: err.response?.status || 0, latency: latencyMs, error: err.message };
      }
    });

    console.log(`\n⏳ Running Load Test: [Transactional Grievance Ingestion (DB Writes)]`);
    console.log(`   Target: ${API_BASE}/complaints`);
    console.log(`   Total Writes: 50 | Concurrency: 10 simultaneous submissions`);
    const writeStart = Date.now();
    const writeResults = await runWorkerPool(writeTasks, 10);
    const writeDuration = (Date.now() - writeStart) / 1000;
    const writeSuccess = writeResults.filter(r => r.success);
    const writeStats = calculatePercentiles(writeResults.map(r => r.latency));
    const writeRps = (50 / writeDuration).toFixed(1);

    console.log(`   ✅ Finished in: ${writeDuration.toFixed(2)}s | RPS: ${writeRps} req/sec`);
    console.log(`   📈 Success Rate: ${((writeSuccess.length / 50) * 100).toFixed(1)}% (${writeSuccess.length}/50)`);
    console.log(`   ⏱️  Latency -> Min: ${writeStats.min}ms | Avg: ${writeStats.avg}ms | p50: ${writeStats.p50}ms | p95: ${writeStats.p95}ms | Max: ${writeStats.max}ms`);

    report.push({
      name: 'Transactional Grievance Ingestion (DB Writes)',
      target: `${API_BASE}/complaints`,
      totalRequests: 50,
      concurrency: 10,
      durationSec: writeDuration,
      rps: Number(writeRps),
      successRate: (writeSuccess.length / 50) * 100,
      stats: writeStats
    });
  }

  // 6. High-Concurrency Burst Test
  const burstTest = await benchmarkEndpoint(
    'High-Concurrency Burst Stress Test (Simultaneous Spike)',
    `${API_BASE}/health`,
    'GET',
    null,
    {},
    500,
    50
  );
  report.push(burstTest);

  console.log('\n================================================================');
  console.log(' 🏁 BENCHMARK COMPLETE — GENERATING PERFORMANCE PROFILE');
  console.log('================================================================\n');

  return report;
}

runFullPracticalLoadTest()
  .then((report) => {
    const fs = require('fs');
    fs.writeFileSync('load_test_results.json', JSON.stringify(report, null, 2));
    console.log('Saved benchmark results to load_test_results.json');
  })
  .catch(console.error);
