import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 50 },
    { duration: '20s', target: 100 },
    { duration: '20s', target: 250 },
    { duration: '10s', target: 500 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:5177/api';

export default function () {
  // Public tracking
  const trackRes = http.get(`${BASE_URL}/public/map-complaints`);
  check(trackRes, {
    'status is 200': (r) => r.status === 200,
  });

  // Complaint submission
  const payload = JSON.stringify({
    description: `Load Test User ${__VU}-${__ITER}: Water pipe burst on sidewalk`,
    category: 'Water Supply',
    lat: 17.7321,
    lng: 83.3105,
    email: `loaduser_${__VU}@civicconnect.com`
  });

  const headers = { 'Content-Type': 'application/json' };
  const res = http.post(`${BASE_URL}/complaints`, payload, { headers });
  check(res, {
    'complaint registered': (r) => r.status === 200 || r.status === 201,
  });

  sleep(0.5);
}
