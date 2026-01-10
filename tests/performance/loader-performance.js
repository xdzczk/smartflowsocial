/**
 * k6 Load Test: Loader Performance
 *
 * Tests performance of Remix loaders under load
 */

import { check, sleep } from "k6";
import { authenticatedRequest, createSession, thresholds } from "./k6-setup.js";

export const options = {
  stages: [
    { duration: "30s", target: 10 }, // Ramp up to 10 users
    { duration: "1m", target: 10 }, // Stay at 10 users
    { duration: "30s", target: 20 }, // Ramp up to 20 users
    { duration: "1m", target: 20 }, // Stay at 20 users
    { duration: "30s", target: 0 }, // Ramp down
  ],
  thresholds: {
    ...thresholds,
    "http_req_duration{name:/dashboard/}": ["p(95)<2000"],
    "http_req_duration{name:/dashboard\\/scheduled/}": ["p(95)<2000"],
    "http_req_duration{name:/dashboard\\/calendar/}": ["p(95)<3000"],
  },
};

export default function () {
  const session = createSession();

  // Test: Dashboard Loader
  const dashboardResponse = authenticatedRequest(
    "GET",
    "/dashboard",
    null,
    session
  );
  check(dashboardResponse, {
    "dashboard: status 200": (r) => r.status === 200,
    "dashboard: response time < 2s": (r) => r.timings.duration < 2000,
    "dashboard: has content": (r) => r.body.length > 0,
  });

  sleep(1);

  // Test: Scheduled Posts Loader
  const scheduledResponse = authenticatedRequest(
    "GET",
    "/dashboard/scheduled",
    null,
    session
  );
  check(scheduledResponse, {
    "scheduled: status 200": (r) => r.status === 200,
    "scheduled: response time < 2s": (r) => r.timings.duration < 2000,
  });

  sleep(1);

  // Test: Calendar Loader
  const calendarResponse = authenticatedRequest(
    "GET",
    "/dashboard/calendar/regular",
    null,
    session
  );
  check(calendarResponse, {
    "calendar: status 200": (r) => r.status === 200,
    "calendar: response time < 3s": (r) => r.timings.duration < 3000,
  });

  sleep(1);

  // Test: Drafts Loader
  const draftsResponse = authenticatedRequest(
    "GET",
    "/dashboard/drafts",
    null,
    session
  );
  check(draftsResponse, {
    "drafts: status 200": (r) => r.status === 200,
    "drafts: response time < 2s": (r) => r.timings.duration < 2000,
  });

  sleep(1);

  // Test: Posted Loader
  const postedResponse = authenticatedRequest(
    "GET",
    "/dashboard/posted",
    null,
    session
  );
  check(postedResponse, {
    "posted: status 200": (r) => r.status === 200,
    "posted: response time < 2s": (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
