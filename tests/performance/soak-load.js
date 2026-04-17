/**
 * k6 Load Test: Soak Profile
 *
 * Runs steady traffic over longer duration to catch latency drift and memory leaks.
 */

import { check, sleep } from "k6";

import { authenticatedRequest, createSession, thresholds } from "./k6-setup.js";

export const options = {
  scenarios: {
    sustained_soak: {
      executor: "constant-arrival-rate",
      rate: 12,
      timeUnit: "1s",
      duration: "20m",
      preAllocatedVUs: 40,
      maxVUs: 120,
    },
  },
  thresholds: {
    ...thresholds,
    "http_req_duration{name:/dashboard\\/scheduled/}": ["p(95)<2300"],
    "http_req_duration{name:/api\\/thread-view/}": ["p(95)<2500"],
  },
};

export default function () {
  const session = createSession();

  const scheduled = authenticatedRequest(
    "GET",
    "/dashboard/scheduled",
    null,
    session
  );
  check(scheduled, {
    "soak-scheduled: status 200": (r) => r.status === 200,
  });

  const thread = authenticatedRequest(
    "GET",
    `/api/thread-view?eventId=${"f".repeat(64)}`,
    null,
    session
  );
  check(thread, {
    "soak-thread-view: status 200": (r) => r.status === 200,
  });

  sleep(1);
}
