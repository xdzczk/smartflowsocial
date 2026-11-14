import http from "k6/http";
import { check, sleep } from "k6";

/**
 * Short /healthcheck probe.
 * K6_TARGET_KIND=fixture means the local harness, not SmartFlowSocial.
 * K6_TARGET_KIND=application-health means a real origin's health route only.
 * Capacity numbers come from the authenticated scripts, and only against staging.
 */
export function handleSummary(data) {
  const kind = __ENV.K6_TARGET_KIND || "unspecified";
  const failed = data.metrics.http_req_failed?.values?.rate ?? "unknown";
  return {
    stdout: `k6 target kind: ${kind}. http_req_failed rate: ${failed}. This smoke is not a capacity benchmark.\n`,
  };
}
export const options = {
  vus: 2,
  duration: "15s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
  },
};

const base = __ENV.BASE_URL || "http://127.0.0.1:3999";

export default function () {
  const response = http.get(`${base}/healthcheck`);
  check(response, {
    "health responds 200": (result) => result.status === 200,
  });
  sleep(0.5);
}
