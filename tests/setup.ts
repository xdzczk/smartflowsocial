/**
 * Vitest setup file
 * This file runs before all tests and configures the test environment
 */

import * as matchers from "@testing-library/jest-dom/matchers";
import { expect, afterEach, vi } from "vitest";
// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Mock environment variables if needed
process.env["NODE_ENV"] = process.env["NODE_ENV"] || "test";

// Set required environment variables for tests
// These are needed by modules that check env vars at import time
process.env["DATABASE_URL"] ??=
  process.env["TEST_DATABASE_URL"] ??
  "postgresql://postgres:postgres@localhost:5432/smartflow_test";

process.env["TEST_DATABASE_URL"] ??=
  process.env["DATABASE_URL"] ??
  "postgresql://postgres:postgres@localhost:5432/smartflow_test";

process.env["SESSION_SECRET"] ??=
  "test-session-secret-very-long-and-secure-32-chars-minimum";

// Required by centralized env validation
process.env["NOSTR_PUBLISHER_URL"] ??= "http://localhost:3001/publish";
process.env["REDIS_URL"] ??= "redis://localhost:6379";

// Suppress console errors in tests (optional - remove if you want to see them)
// global.console = {
//   ...console,
//   error: vi.fn(),
//   warn: vi.fn(),
// };
