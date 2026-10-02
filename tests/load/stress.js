import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '15s', target: 200 },
    { duration: '30s', target: 500 },
    { duration: '30s', target: 1000 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3500'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:5177/api';

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(0.2);
}
