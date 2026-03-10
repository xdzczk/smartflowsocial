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
        // Auth reconnect and NIP-46 (Phase 2 tests count toward coverage)
        "app/features/auth/reconnect/**/*.ts",
        "app/features/auth/nip46/**/*.ts",
        // Auth signer core (connection-*, sessions, relay utils – unit tests count)
        "app/features/auth/signer/**/*.ts",
        // Reconnect lifecycle and helpers (reconnect-lifecycle.test.ts, used by reconnect flows)
        "app/features/auth/reconnect-lifecycle.client.ts",
        "app/features/auth/reconnect-dialog-utils.client.ts",
        "app/features/auth/reconnect-uri.client.ts",
        // nostr-adapter (nostr-edge-cases.test.ts)
        "app/lib/nostr-adapter.client.ts",
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
        // Exclude client-side only files (except auth/reconnect, auth/nip46, auth/signer, reconnect-*.client, nostr-adapter – included above)
        "app/lib/nostr-circuit-breaker.client.ts",
        "app/lib/validation/utils.client.ts",
        "app/lib/nostr-connection-metrics.client.ts",
        "app/lib/zap-flow.client.ts",
        "app/lib/deep-link-handler.client.ts",
        "app/lib/safe-console.client.ts",
        "app/lib/sentry.client.ts",
        "app/lib/clear-client-cache.client.ts",
        "app/lib/locale-defaults.client.ts",
        "app/lib/error-handler.client.ts",
        "app/lib/sync-manager.client.ts",
        "app/lib/correlation-id.client.ts",
        "app/lib/nostr-timeout-utils.client.ts",
        "app/lib/nip07-readiness.client.ts",
        "app/features/referral/**/*.client.ts",
        "app/features/posts/**/*.client.ts",
        "app/features/upload/**/*.client.ts",
        "app/features/notifications/**/*.client.ts",
        "app/features/auth/use*.client.ts",
        "app/features/auth/reconnect-state.client.ts",
        "app/features/auth/reconnect-health.client.ts",
        "app/features/auth/login-flow.client.ts",
        "app/features/auth/nip46-login.client.ts",
        "app/features/auth/nip07-login.client.ts",
        "app/features/auth/login-api.client.ts",
        "app/features/auth/lifecycle-manager.client.ts",
        "app/features/auth/nostr-signer.client.ts",
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
        // Exclude React hooks that require Remix context / browser (covered by E2E)
        "app/lib/hooks/**",
        "app/lib/useNip07Readiness.ts",
        // remix-utils: only safeRedirect/validateEmail are unit-tested; hooks (useMatchesData, useOptionalUser, useUser) covered by E2E
        "app/lib/remix-utils.ts",
        // Exclude re-export/index files that only export types
        "app/lib/validation/index.ts",
        // Exclude auth signer barrel (re-exports only; no executable logic)
        "app/features/auth/signer/index.ts",
      ],
      // Coverage thresholds - target 80%+ lines/statements
      thresholds: {
        lines: 80,
        functions: 87,
        branches: 72,
        statements: 80,
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
