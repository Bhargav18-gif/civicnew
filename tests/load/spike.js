import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5s', target: 50 },
    { duration: '10s', target: 600 }, // Instant spike
    { duration: '10s', target: 600 },
    { duration: '5s', target: 50 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<4000'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:5177/api';

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(0.1);
}
