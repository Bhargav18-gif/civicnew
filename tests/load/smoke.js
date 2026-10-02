import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: parseInt(__ENV.K6_VUS || '5'),
  duration: __ENV.K6_DURATION || '10s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:5177/api';

export default function () {
  // 1. Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'health response is ok': (r) => JSON.parse(r.body).status === 'ok',
  });

  // 2. Public complaint list
  const mapRes = http.get(`${BASE_URL}/public/map-complaints`);
  check(mapRes, {
    'public map status is 200': (r) => r.status === 200,
  });

  // 3. Submit synthetic complaint
  const payload = JSON.stringify({
    description: `Smoke Load Test ${Date.now()}: Pothole observed on road`,
    category: 'Roads & Infrastructure',
    lat: 17.7289,
    lng: 83.3031,
    email: 'smoke.test@civicconnect.com'
  });

  const headers = { 'Content-Type': 'application/json' };
  const postRes = http.post(`${BASE_URL}/complaints`, payload, { headers });
  check(postRes, {
    'complaint created (200/201)': (r) => r.status === 200 || r.status === 201,
  });

  sleep(1);
}
