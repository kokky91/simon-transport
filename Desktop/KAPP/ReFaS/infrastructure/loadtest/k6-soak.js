import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8002';
const REALTIME_METRICS_URL = __ENV.REALTIME_METRICS_URL || 'http://localhost:8003/metrics/';
const PROM_URL = __ENV.PROM_URL || 'http://localhost:9090';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const TEST_TENANT_ID = __ENV.TEST_TENANT_ID || 'tenant-soak';
const K6_VUS = Number(__ENV.K6_VUS || 15);
const K6_DURATION = __ENV.K6_DURATION || '15m';

const publishSuccess = new Counter('soak_publish_success_total');
const publishFailure = new Counter('soak_publish_failure_total');
const authFailureRate = new Rate('soak_auth_failure_rate');
const consumedProgressRate = new Rate('soak_consumed_progress_rate');
const wsMetricHealthyRate = new Rate('soak_ws_metric_healthy_rate');
const noConsumptionAlertRate = new Rate('soak_no_consumption_alert_clear_rate');

let lastConsumed = null;

function sumMetric(metricText, metricName) {
  return metricText
    .split('\n')
    .filter((line) => line.startsWith(`${metricName}{`) || line.startsWith(`${metricName} `))
    .reduce((sum, line) => {
      const value = Number(line.split(' ').pop());
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
}

function hasActiveAlert(alertsJson, alertName) {
  const groups = alertsJson?.data?.alerts || [];
  return groups.some((alert) => alert.state === 'firing' && alert.labels?.alertname === alertName);
}

export const options = {
  vus: K6_VUS,
  duration: K6_DURATION,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<400'],
    'http_req_duration{name:soak_publish_event}': ['p(95)<400'],
    soak_auth_failure_rate: ['rate<0.01'],
    soak_consumed_progress_rate: ['rate>0.95'],
    soak_ws_metric_healthy_rate: ['rate>0.99'],
    soak_no_consumption_alert_clear_rate: ['rate>0.99'],
  },
};

export function setup() {
  if (!AUTH_TOKEN) {
    throw new Error('AUTH_TOKEN is required. Generate a tenant JWT before running soak profile.');
  }

  const health = http.get(`${BASE_URL}/health`, { tags: { name: 'soak_health_check' } });
  check(health, { 'api health returns 200': (r) => r.status === 200 });

  const metricsRes = http.get(REALTIME_METRICS_URL, { tags: { name: 'soak_metrics_check' } });
  check(metricsRes, { 'realtime metrics returns 200': (r) => r.status === 200 });

  const initialConsumed = sumMetric(metricsRes.body, 'events_consumed_total');

  return {
    token: AUTH_TOKEN,
    tenantId: TEST_TENANT_ID,
    initialConsumed,
  };
}

export default function (data) {
  const cropId = `soak-${__VU}-${__ITER}`;
  const price = 200 + (__ITER % 40);
  const traceId = `soak-trace-${__VU}-${__ITER}`;

  const publishRes = http.post(
    `${BASE_URL}/market/price-update?crop_id=${cropId}&new_price=${price}`,
    null,
    {
      headers: {
        Authorization: `Bearer ${data.token}`,
        'X-Trace-Id': traceId,
      },
      tags: { name: 'soak_publish_event' },
    }
  );

  const ok = check(publishRes, {
    'soak publish returns 200': (r) => r.status === 200,
    'soak tenant id matches': (r) => r.body.includes(`"tenantId":"${data.tenantId}"`),
  });

  if (publishRes.status === 401 || publishRes.status === 403) {
    authFailureRate.add(1);
  } else {
    authFailureRate.add(0);
  }

  if (ok) {
    publishSuccess.add(1);
  } else {
    publishFailure.add(1);
  }

  if (__ITER % 25 === 0) {
    const metricsRes = http.get(REALTIME_METRICS_URL, { tags: { name: 'soak_metrics_poll' } });
    const consumedNow = sumMetric(metricsRes.body, 'events_consumed_total');
    const wsActive = sumMetric(metricsRes.body, 'ws_connections_active');

    if (lastConsumed === null) {
      lastConsumed = consumedNow;
    }

    consumedProgressRate.add(consumedNow >= lastConsumed);
    wsMetricHealthyRate.add(wsActive >= 0);
    lastConsumed = consumedNow;

    const alertsRes = http.get(`${PROM_URL}/api/v1/alerts`, { tags: { name: 'soak_alert_poll' } });
    const noConsumptionFiring = hasActiveAlert(alertsRes.json(), 'NoEventConsumption');
    noConsumptionAlertRate.add(!noConsumptionFiring);
  }

  sleep(0.2);
}

export function teardown(data) {
  const metricsRes = http.get(REALTIME_METRICS_URL, { tags: { name: 'soak_teardown_metrics' } });
  const consumedEnd = sumMetric(metricsRes.body, 'events_consumed_total');

  if (consumedEnd <= data.initialConsumed) {
    throw new Error('Soak failed: events_consumed_total did not increase over test window.');
  }
}
