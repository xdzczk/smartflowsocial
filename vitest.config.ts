import { resolve } from "path";

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Test environment - use 'node' for server-side tests, 'jsdom' for React components
    environment: "node",
    // Glob patterns for test files
    include: [
      "**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
      "**/property/**/*.test.ts",
    ],
    // Exclude patterns
    exclude: ["node_modules", "build", "tests/e2e", ".next", ".remix"],
    // Setup files
    setupFiles: ["./tests/setup.ts"],
    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html", "lcov"],
      // Only include files that should be unit/integration tested
      // Exclude UI components and routes (tested via E2E)
      include: [
        "app/**/*.server.ts",
        "app/**/*.server.tsx",
        "app/lib/**/*.ts",
        "app/models/**/*.ts",
        "app/features/**/*.server.ts",
        "app/features/**/services/**/*.ts",
        "app/features/**/queries/**/*.ts",
        "app/features/**/commands/**/*.ts",
        "app/features/**/handlers/**/*.ts",
        "app/features/**/utils/**/*.ts",
        "app/infra/**/*.ts",
        "app/utils/**/*.ts",
      ],
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
        // Exclude UI components (tested via E2E)
        "app/components/**",
        "app/features/**/components/**",
        "app/routes/**",
        // Exclude hooks (often tested via component tests)
        "app/features/**/hooks/**",
        // Exclude client-side only files
        "app/**/*.client.ts",
        "app/**/*.client.tsx",
        // Exclude type definition files (not testable)
        "app/**/*.types.ts",
        "app/**/types.ts",
        "app/models/**/post.types.ts",
        "app/infra/**/queue-types.ts",
        // Exclude example/reference files
        "app/**/*.example.ts",
        "app/lib/error-handler.example.ts",
        // Exclude re-export/index files that only export types
        "app/infra/queue/index.ts",
        // Exclude React hooks that require browser environment
        "app/lib/useLocalStorage.ts",
        // Exclude client-side React Query hooks (require browser environment)
        "app/lib/query/**",
        // Exclude client-side validation hooks (require React context)
        "app/lib/validation/hooks/**",
        // Exclude client-safe wrapper files (tested via their server counterparts)
        "app/**/*.client-safe.ts",
        // Exclude client-safe loader-responses wrapper (tested via loader-responses.server.ts)
        "app/lib/validation/loader-responses.ts",
        // Exclude re-export/index files that only export types
        "app/lib/validation/index.ts",
      ],
      // Coverage thresholds - adjusted to be more realistic
      // These will be enforced on files that are actually tested
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
      // Report uncovered lines
      reportOnFailure: true,
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
    // Watch mode configuration
    watch: false,
    // Pool for parallel execution
    pool: "threads",
    // Ensure mocks/module state don't leak across test files.
    isolate: true,
  },
  resolve: {
    alias: {
      "~": resolve(__dirname, "./app"),
      "~/tests": resolve(__dirname, "./tests"),
      "~/tests/*": resolve(__dirname, "./tests/*"),
    },
  },
});
