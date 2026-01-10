/**
 * k6 Load Test: API Endpoints
 *
 * Tests performance of critical API endpoints under load
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
    "http_req_duration{name:/api\\/effective-hashtags/}": ["p(95)<1000"],
    "http_req_duration{name:/api\\/queue-schedule/}": ["p(95)<500"],
    "http_req_duration{name:/api\\/upload/}": ["p(95)<5000"],
    "http_req_duration{name:/api\\/publish/}": ["p(95)<3000"],
  },
};

export default function () {
  const session = createSession();

  // Test: Effective Hashtags API
  const hashtagsResponse = authenticatedRequest(
    "GET",
    "/api/effective-hashtags?queueTypeId=test-queue",
    null,
    session
  );
  check(hashtagsResponse, {
    "effective-hashtags: status 200": (r) => r.status === 200,
    "effective-hashtags: response time < 1s": (r) => r.timings.duration < 1000,
  });

  sleep(1);

  // Test: Queue Schedule API
  const scheduleResponse = authenticatedRequest(
    "GET",
    "/api/queue-schedule?queueTypeId=test-queue&timezone=America/New_York",
    null,
    session
  );
  check(scheduleResponse, {
    "queue-schedule: status 200": (r) => r.status === 200,
    "queue-schedule: response time < 500ms": (r) => r.timings.duration < 500,
    "queue-schedule: has nextScheduleTime": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.nextScheduleTime !== undefined;
      } catch {
        return false;
      }
    },
  });

  sleep(1);

  // Test: Payment Status API
  const paymentResponse = authenticatedRequest(
    "POST",
    "/api/payment-status",
    { paymentId: "test-payment-123" },
    session
  );
  check(paymentResponse, {
    "payment-status: status 200": (r) => r.status === 200,
    "payment-status: response time < 2s": (r) => r.timings.duration < 2000,
  });

  sleep(1);

  // Test: Thread View API
  const threadResponse = authenticatedRequest(
    "GET",
    "/api/thread-view?eventId=test-event-123",
    null,
    session
  );
  check(threadResponse, {
    "thread-view: status 200": (r) => r.status === 200,
    "thread-view: response time < 2s": (r) => r.timings.duration < 2000,
  });

  sleep(1);

  // Test: Link Preview API
  const linkPreviewResponse = authenticatedRequest(
    "GET",
    "/api/link-preview?url=https://example.com",
    null,
    session
  );
  check(linkPreviewResponse, {
    "link-preview: status 200": (r) => r.status === 200,
    "link-preview: response time < 3s": (r) => r.timings.duration < 3000,
  });

  sleep(1);
}

// Summary is handled automatically by k6
