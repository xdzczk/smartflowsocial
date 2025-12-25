import { defineConfig } from "vitest/config";
import { resolve } from "path";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Test environment - use 'node' for server-side tests, 'jsdom' for React components
    environment: "node",
    // Glob patterns for test files
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}", "**/property/**/*.test.ts"],
    // Exclude patterns
    exclude: ["node_modules", "build", "tests/e2e", ".next", ".remix"],
    // Setup files
    setupFiles: ["./tests/setup.ts"],
    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html", "lcov"],
      exclude: [
        "node_modules/",
        "build/",
        "tests/e2e/",
        "tests/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/entry.*",
        "**/root.tsx",
        "**/tailwind.css",
        "prisma/",
        "server.ts",
        "worker.ts",
      ],
      // Coverage thresholds - enforce minimum coverage
      thresholds: {
        lines: 70,
        functions: 65,
        branches: 60,
        statements: 70,
      },
      // Report uncovered lines
      reportOnFailure: true,
      // Include all files (even those with no tests)
      all: true,
      // Skip full coverage for files that are hard to test
      skipFull: false,
    },
    // Test result reporting
    reporters: [
      "default",
      ["junit", { outputFile: "test-results/junit.xml" }],
      ["json", { outputFile: "test-results/results.json" }],
    ],
    // Global test timeout
    testTimeout: 10000,
    // Use threads for faster execution
    threads: true,
    // Watch mode configuration
    watch: false,
  },
  resolve: {
    alias: {
      "~": resolve(__dirname, "./app"),
      "~/tests": resolve(__dirname, "./tests"),
      "~/tests/*": resolve(__dirname, "./tests/*"),
    },
  },
});
