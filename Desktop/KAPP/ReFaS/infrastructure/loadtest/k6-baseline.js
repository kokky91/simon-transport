import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8002';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const TEST_TENANT_ID = __ENV.TEST_TENANT_ID || 'tenant-loadtest';
const K6_VUS = Number(__ENV.K6_VUS || 10);
const K6_DURATION = __ENV.K6_DURATION || '2m';

const publishSuccess = new Counter('publish_success_total');
const publishFailure = new Counter('publish_failure_total');
const authFailureRate = new Rate('publish_auth_failure_rate');

export const options = {
  vus: K6_VUS,
  duration: K6_DURATION,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    'http_req_duration{name:publish_event}': ['p(95)<350'],
    publish_auth_failure_rate: ['rate<0.01'],
  },
};

export function setup() {
  if (!AUTH_TOKEN) {
    throw new Error('AUTH_TOKEN is required. Generate a tenant JWT before running k6 baseline.');
  }

  const health = http.get(`${BASE_URL}/health`, {
    tags: { name: 'health_check' },
  });

  check(health, {
    'health endpoint returns 200': (r) => r.status === 200,
  });

  return { token: AUTH_TOKEN, tenantId: TEST_TENANT_ID };
}

export default function (data) {
  const cropId = `crop-${__VU}-${__ITER}`;
  const price = 100 + (__ITER % 50);
  const traceId = `k6-trace-${__VU}-${__ITER}`;

  const response = http.post(
    `${BASE_URL}/market/price-update?crop_id=${cropId}&new_price=${price}`,
    null,
    {
      headers: {
        Authorization: `Bearer ${data.token}`,
        'X-Trace-Id': traceId,
      },
      tags: { name: 'publish_event' },
    }
  );

  const ok = check(response, {
    'publish returns 200': (r) => r.status === 200,
    'publish body contains published=true': (r) => r.body.includes('"published":true'),
    'trace id round-trips': (r) => r.headers['X-Trace-Id'] === traceId,
    'tenant id matches token tenant': (r) => r.body.includes(`"tenantId":"${data.tenantId}"`),
  });

  if (response.status === 401 || response.status === 403) {
    authFailureRate.add(1);
  } else {
    authFailureRate.add(0);
  }

  if (ok) {
    publishSuccess.add(1);
  } else {
    publishFailure.add(1);
  }

  sleep(0.2);
}
