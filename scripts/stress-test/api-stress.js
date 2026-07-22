import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://royaltica-production.up.railway.app';
const TOKEN = __ENV.AUTH_TOKEN || '';
const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    smoke: { executor: 'constant-vus', vus: 1, duration: '10s', startTime: '0s' },
    load: { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '30s', target: 10 }, { duration: '1m', target: 10 }, { duration: '30s', target: 0 }], startTime: '15s' },
    stress: { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '30s', target: 25 }, { duration: '1m', target: 50 }, { duration: '30s', target: 0 }], startTime: '2m30s' },
  },
  thresholds: { http_req_duration: ['p(95)<2000'], errors: ['rate<0.1'] },
};

const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } : {};

export default function () {
  group('Health', () => {
    const r = http.get(`${BASE_URL}/health`);
    check(r, { 'health 200': (r) => r.status === 200 }) || errorRate.add(1);
  });
  if (TOKEN) {
    group('Invoices', () => {
      const r = http.get(`${BASE_URL}/invoices?page=1&limit=20`, { headers });
      check(r, { 'invoices 200': (r) => r.status === 200 }) || errorRate.add(1);
    });
    group('Payments', () => {
      const r = http.get(`${BASE_URL}/payments?page=1&limit=10`, { headers });
      check(r, { 'payments 200': (r) => r.status === 200 }) || errorRate.add(1);
    });
    group('Suppliers', () => {
      const r = http.get(`${BASE_URL}/suppliers?page=1&limit=20`, { headers });
      check(r, { 'suppliers 200': (r) => r.status === 200 }) || errorRate.add(1);
    });
  }
  sleep(1);
}
