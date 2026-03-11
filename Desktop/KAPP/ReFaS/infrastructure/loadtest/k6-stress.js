import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8002';
const PROM_URL = __ENV.PROM_URL || 'http://localhost:9090';
const REALTIME_METRICS_URL = __ENV.REALTIME_METRICS_URL || 'http://localhost:8003/metrics/';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || __ENV.JWT || '';
const TEST_TENANT_ID = __ENV.TEST_TENANT_ID || 'tenant-stress';

const STAGE_1_DURATION = __ENV.STAGE_1_DURATION || '2m';
const STAGE_2_DURATION = __ENV.STAGE_2_DURATION || '2m';
const STAGE_3_DURATION = __ENV.STAGE_3_DURATION || '2m';
const STAGE_4_DURATION = __ENV.STAGE_4_DURATION || '2m';
const STAGE_1_TARGET = Number(__ENV.STAGE_1_TARGET || 50);
const STAGE_2_TARGET = Number(__ENV.STAGE_2_TARGET || 100);
const STAGE_3_TARGET = Number(__ENV.STAGE_3_TARGET || 200);
const STAGE_4_TARGET = Number(__ENV.STAGE_4_TARGET || 300);

const stressPublishSuccess = new Counter('stress_publish_success_total');
const stressPublishFailure = new Counter('stress_publish_failure_total');
const stressAuthFailureRate = new Rate('stress_auth_failure_rate');
const stressConsumptionHealthyRate = new Rate('stress_consumption_healthy_rate');
const stressNoConsumptionAlertClearRate = new Rate('stress_no_consumption_alert_clear_rate');

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
  const alerts = alertsJson?.data?.alerts || [];
  return alerts.some((alert) => alert.state === 'firing' && alert.labels?.alertname === alertName);
}

export const options = {
  stages: [
    { duration: STAGE_1_DURATION, target: STAGE_1_TARGET },
    { duration: STAGE_2_DURATION, target: STAGE_2_TARGET },
    { duration: STAGE_3_DURATION, target: STAGE_3_TARGET },
    { duration: STAGE_4_DURATION, target: STAGE_4_TARGET },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<800'],
    'http_req_duration{name:stress_publish_event}': ['p(95)<800'],
    stress_auth_failure_rate: ['rate<0.05'],
    stress_consumption_healthy_rate: ['rate>0.70'],
    stress_no_consumption_alert_clear_rate: ['rate>0.95'],
  },
};

export function setup() {
  if (!AUTH_TOKEN) {
    throw new Error('AUTH_TOKEN (or JWT) is required for stress profile.');
  }

  const health = http.get(`${BASE_URL}/health`, { tags: { name: 'stress_health_check' } });
  check(health, { 'api health returns 200': (r) => r.status === 200 });

  return { token: AUTH_TOKEN, tenantId: TEST_TENANT_ID };
}

export default function (data) {
  const cropId = `stress-${__VU}-${__ITER}`;
  const price = 100 + (__ITER % 100);
  const traceId = `stress-trace-${__VU}-${__ITER}`;

  const response = http.post(
    `${BASE_URL}/market/price-update?crop_id=${cropId}&new_price=${price}`,
    null,
    {
      headers: {
        Authorization: `Bearer ${data.token}`,
        'X-Trace-Id': traceId,
      },
      tags: { name: 'stress_publish_event' },
    }
  );

  const ok = check(response, {
    'stress publish returns 200': (r) => r.status === 200,
    'stress tenant id matches': (r) => r.body.includes(`"tenantId":"${data.tenantId}"`),
  });

  if (response.status === 401 || response.status === 403) {
    stressAuthFailureRate.add(1);
  } else {
    stressAuthFailureRate.add(0);
  }

  if (ok) {
    stressPublishSuccess.add(1);
  } else {
    stressPublishFailure.add(1);
  }

  if (__ITER % 30 === 0) {
    const apiMetrics = http.get(`${BASE_URL}/metrics/`, { tags: { name: 'stress_api_metrics_poll' } });
    const rtMetrics = http.get(REALTIME_METRICS_URL, { tags: { name: 'stress_rt_metrics_poll' } });
    const promAlerts = http.get(`${PROM_URL}/api/v1/alerts`, { tags: { name: 'stress_alert_poll' } });

    const published = sumMetric(apiMetrics.body, 'events_published_total');
    const consumed = sumMetric(rtMetrics.body, 'events_consumed_total');

    const consumptionRatio = published > 0 ? consumed / published : 1;
    stressConsumptionHealthyRate.add(consumptionRatio >= 0.8);

    const noConsumptionFiring = hasActiveAlert(promAlerts.json(), 'NoEventConsumption');
    stressNoConsumptionAlertClearRate.add(!noConsumptionFiring);
  }

  sleep(0.5);
}
