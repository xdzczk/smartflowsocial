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

// Test configuration
 
export const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

// Helper function to create authenticated session
export function createSession() {
  // In a real scenario, you would authenticate here
  // For now, we'll use a mock session cookie
  return {
    cookies: {
      // Add session cookies if needed
    },
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "k6-load-test",
    },
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
};

// Common test options
export const commonOptions = {
  thresholds,
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};




