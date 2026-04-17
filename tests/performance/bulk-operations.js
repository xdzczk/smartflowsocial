/**
 * k6 Load Test: Bulk Operations
 *
 * Tests performance of bulk post operations under load
 */

import { check, sleep } from "k6";
import {
  authenticatedRequest,
  createPostIds,
  createSession,
  thresholds,
} from "./k6-setup.js";

export const options = {
  scenarios: {
    sustained_bulk_write: {
      executor: "ramping-vus",
      stages: [
        { duration: "1m", target: 5 },
        { duration: "2m", target: 12 },
        { duration: "1m", target: 0 },
      ],
    },
  },
  thresholds: {
    ...thresholds,
    "http_req_duration{name:/dashboard/}": ["p(95)<3500"],
    "http_req_duration{name:/dashboard\\/scheduled/}": ["p(95)<3500"],
    "http_req_duration{name:/dashboard\\/drafts/}": ["p(95)<5000"],
  },
};

export default function () {
  const session = createSession();
  const postIds = createPostIds("bulk-post");
  const deleteIds = postIds.slice(0, 10);
  const scheduleIds = postIds.slice(0, 5);

  // Test: Bulk Delete Posts
  const bulkDeleteResponse = authenticatedRequest(
    "POST",
    "/dashboard",
    {
      _action: "bulkDelete",
      postIds: deleteIds,
    },
    session
  );
  check(bulkDeleteResponse, {
    "bulk-delete: status 200": (r) => r.status === 200,
    "bulk-delete: response time < 3s": (r) => r.timings.duration < 3000,
  });

  sleep(1);

  // Read path mixed between writes to emulate realistic operator behavior.
  const dashboardReadResponse = authenticatedRequest(
    "GET",
    "/dashboard/scheduled",
    null,
    session
  );
  check(dashboardReadResponse, {
    "scheduled-loader-after-write: status 200": (r) => r.status === 200,
    "scheduled-loader-after-write: response time < 2.5s": (r) =>
      r.timings.duration < 2500,
  });

  sleep(1);

  // Test: Bulk Schedule Posts
  const bulkScheduleResponse = authenticatedRequest(
    "POST",
    "/dashboard/scheduled",
    {
      _action: "bulkDelete",
      postIds: scheduleIds,
    },
    session
  );
  check(bulkScheduleResponse, {
    "bulk-schedule: status 200": (r) => r.status === 200,
    "bulk-schedule: response time < 3s": (r) => r.timings.duration < 3000,
  });

  sleep(1);

  // Test: Bulk Sign & Resume Drafts
  const bulkSignResponse = authenticatedRequest(
    "POST",
    "/dashboard/drafts",
    {
      _action: "bulkSignAndResume",
      postIds: scheduleIds,
    },
    session
  );
  check(bulkSignResponse, {
    "bulk-sign: status 200": (r) => r.status === 200,
    "bulk-sign: response time < 5s": (r) => r.timings.duration < 5000,
  });

  sleep(1);
}
