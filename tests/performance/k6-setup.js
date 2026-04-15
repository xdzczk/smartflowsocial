/**
 * k6 Performance Testing Setup
 *
 * This file contains shared utilities and configuration for k6 load tests
 */

import http from "k6/http";
import { check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// Custom metrics
export const errorRate = new Rate("errors");
export const responseTime = new Trend("response_time");
export const requestCount = new Counter("requests");
export const authenticatedSessionRate = new Rate("authenticated_sessions");
export const authProbeDuration = new Trend("auth_probe_duration_ms");

// Test configuration

export const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const SESSION_COOKIE_NAME = __ENV.K6_SESSION_COOKIE_NAME || "session";
const SESSION_COOKIE_VALUE = __ENV.K6_SESSION_COOKIE_VALUE || "";
const SESSION_COOKIES = __ENV.K6_SESSION_COOKIES || "";
const BEARER_TOKEN = __ENV.K6_BEARER_TOKEN || "";
const REQUIRE_AUTH =
  (__ENV.K6_REQUIRE_AUTH || "true").toLowerCase() !== "false";
const AUTH_PROBE_PATH = __ENV.K6_AUTH_PROBE_PATH || "/dashboard";
const USER_AGENT = __ENV.K6_USER_AGENT || "k6-load-test";

function parseCookieHeader(raw) {
  const cookies = {};
  if (!raw) return cookies;
  for (const pair of raw.split(";")) {
    const [rawName, ...rest] = pair.trim().split("=");
    const name = rawName?.trim();
    const value = rest.join("=").trim();
    if (!name || !value) continue;
    cookies[name] = value;
  }
  return cookies;
}

function buildAuthCookies() {
  const parsed = parseCookieHeader(SESSION_COOKIES);
  if (SESSION_COOKIE_VALUE) {
    parsed[SESSION_COOKIE_NAME] = SESSION_COOKIE_VALUE;
  }
  return parsed;
}

function ensureAuthIsValid(session) {
  const start = Date.now();
  const response = http.get(`${BASE_URL}${AUTH_PROBE_PATH}`, {
    headers: session.headers,
    cookies: session.cookies,
    redirects: 0,
    tags: { name: "auth_probe" },
  });
  authProbeDuration.add(Date.now() - start);
  const okStatus = response.status >= 200 && response.status < 400;
  authenticatedSessionRate.add(okStatus ? 1 : 0);
  if (REQUIRE_AUTH && !okStatus) {
    throw new Error(
      `[k6] Auth probe failed (${response.status}) against ${AUTH_PROBE_PATH}. Configure K6_SESSION_COOKIE_VALUE or K6_SESSION_COOKIES.`
    );
  }
}

export function getTestConfig() {
  return {
    queueTypeId: __ENV.K6_QUEUE_TYPE_ID || "regular",
    paymentId: __ENV.K6_PAYMENT_ID || "test-payment-123",
    sampleEventId: __ENV.K6_EVENT_ID || "f".repeat(64),
    postIdsCount: Number(__ENV.K6_POST_IDS_COUNT || 20),
  };
}

export function createPostIds(prefix = "post") {
  const { postIdsCount } = getTestConfig();
  return Array.from(
    { length: postIdsCount },
    (_, index) => `${prefix}-${index + 1}`
  );
}

// Helper function to create authenticated session
export function createSession() {
  const cookies = buildAuthCookies();
  const hasCookie = Object.keys(cookies).length > 0;
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT,
  };
  if (BEARER_TOKEN) {
    headers.Authorization = `Bearer ${BEARER_TOKEN}`;
  }
  const session = {
    cookies,
    headers,
  };

  if (!hasCookie && !BEARER_TOKEN && REQUIRE_AUTH) {
    throw new Error(
      "[k6] Missing auth credentials. Set K6_SESSION_COOKIE_VALUE, K6_SESSION_COOKIES, or K6_BEARER_TOKEN."
    );
  }

  if (hasCookie || BEARER_TOKEN) {
    ensureAuthIsValid(session);
  } else {
    authenticatedSessionRate.add(0);
  }

  return {
    cookies,
    headers,
  };
}

// Helper function to make authenticated request
export function authenticatedRequest(method, url, body = null, session = null) {
  const params = {
    headers: session?.headers || {},
    cookies: session?.cookies || {},
    tags: { name: url },
  };

  let response;
  if (method === "GET") {
    response = http.get(`${BASE_URL}${url}`, params);
  } else if (method === "POST") {
    response = http.post(`${BASE_URL}${url}`, JSON.stringify(body), params);
  } else if (method === "PUT") {
    response = http.put(`${BASE_URL}${url}`, JSON.stringify(body), params);
  } else if (method === "DELETE") {
    response = http.del(`${BASE_URL}${url}`, null, params);
  }

  const success = check(response, {
    "status is 200-299": (r) => r.status >= 200 && r.status < 300,
    "response time < 2000ms": (r) => r.timings.duration < 2000,
  });

  errorRate.add(!success);
  responseTime.add(response.timings.duration);
  requestCount.add(1);

  return response;
}

// Performance thresholds
export const thresholds = {
  http_req_duration: ["p(95)<2000", "p(99)<5000"], // 95% of requests < 2s, 99% < 5s
  http_req_failed: ["rate<0.01"], // Error rate < 1%
  errors: ["rate<0.01"], // Custom error rate < 1%
  response_time: ["p(95)<2000", "p(99)<5000"], // Response time thresholds
  authenticated_sessions: ["rate>0.95"],
};

// Common test options
export const commonOptions = {
  thresholds,
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};
