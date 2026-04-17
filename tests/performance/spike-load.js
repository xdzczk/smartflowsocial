/**
 * k6 Load Test: Spike Profile
 *
 * Simulates sudden traffic surges to catch autoscaling and queue backpressure issues.
 */

import { check, sleep } from "k6";

import { authenticatedRequest, createSession, thresholds } from "./k6-setup.js";

export const options = {
  scenarios: {
    spike_then_recover: {
      executor: "ramping-arrival-rate",
      startRate: 5,
      timeUnit: "1s",
      preAllocatedVUs: 30,
      maxVUs: 150,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "20s", target: 80 },
        { duration: "1m", target: 80 },
        { duration: "30s", target: 10 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    ...thresholds,
    "http_req_duration{name:/dashboard/}": ["p(95)<2500"],
    "http_req_duration{name:/api\\/queue-schedule/}": ["p(95)<900"],
  },
};

export default function () {
  const session = createSession();

  const dashboard = authenticatedRequest("GET", "/dashboard", null, session);
  check(dashboard, {
    "spike-dashboard: status 200": (r) => r.status === 200,
  });

  const queueSchedule = authenticatedRequest(
    "GET",
    "/api/queue-schedule?queueTypeId=regular&timezone=UTC",
    null,
    session
  );
  check(queueSchedule, {
    "spike-queue-schedule: status 200": (r) => r.status === 200,
  });

  sleep(0.5);
}
