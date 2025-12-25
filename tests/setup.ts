/**
 * Vitest setup file
 * This file runs before all tests and configures the test environment
 */

import { expect, afterEach, vi } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Mock environment variables if needed
process.env.NODE_ENV = process.env.NODE_ENV || "test";

// Suppress console errors in tests (optional - remove if you want to see them)
// global.console = {
//   ...console,
//   error: vi.fn(),
//   warn: vi.fn(),
// };

