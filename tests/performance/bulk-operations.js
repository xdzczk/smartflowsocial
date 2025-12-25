/**
 * k6 Load Test: Bulk Operations
 * 
 * Tests performance of bulk post operations under load
 */

import { check, sleep } from "k6";
import http from "k6/http";
import { BASE_URL, authenticatedRequest, createSession, thresholds } from "./k6-setup.js";

export const options = {
  stages: [
    { duration: "30s", target: 5 }, // Ramp up to 5 users
    { duration: "1m", target: 5 }, // Stay at 5 users
    { duration: "30s", target: 10 }, // Ramp up to 10 users
    { duration: "1m", target: 10 }, // Stay at 10 users
    { duration: "30s", target: 0 }, // Ramp down
  ],
  thresholds: {
    ...thresholds,
    "http_req_duration{name:/dashboard.*action/}": ["p(95)<3000"],
    "http_req_duration{name:/scheduled.*action/}": ["p(95)<3000"],
  },
};

export default function () {
  const session = createSession();

  // Test: Bulk Delete Posts
  const bulkDeleteResponse = authenticatedRequest(
    "POST",
    "/dashboard",
    {
      _action: "bulkDelete",
      postIds: Array.from({ length: 10 }, (_, i) => `post-${i + 1}`),
    },
    session,
  );
  check(bulkDeleteResponse, {
    "bulk-delete: status 200": (r) => r.status === 200,
    "bulk-delete: response time < 3s": (r) => r.timings.duration < 3000,
  });

  sleep(2);

  // Test: Bulk Schedule Posts
  const bulkScheduleResponse = authenticatedRequest(
    "POST",
    "/dashboard/scheduled",
    {
      _action: "bulkDelete",
      postIds: Array.from({ length: 5 }, (_, i) => `post-${i + 1}`),
    },
    session,
  );
  check(bulkScheduleResponse, {
    "bulk-schedule: status 200": (r) => r.status === 200,
    "bulk-schedule: response time < 3s": (r) => r.timings.duration < 3000,
  });

  sleep(2);

  // Test: Bulk Sign & Resume Drafts
  const bulkSignResponse = authenticatedRequest(
    "POST",
    "/dashboard/drafts",
    {
      _action: "bulkSignAndResume",
      postIds: Array.from({ length: 5 }, (_, i) => `post-${i + 1}`),
    },
    session,
  );
  check(bulkSignResponse, {
    "bulk-sign: status 200": (r) => r.status === 200,
    "bulk-sign: response time < 5s": (r) => r.timings.duration < 5000,
  });

  sleep(2);
}

