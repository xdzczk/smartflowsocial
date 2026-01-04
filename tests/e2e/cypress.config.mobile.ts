/**
 * Cypress Configuration for Mobile Testing
 *
 * This configuration can be used for mobile-specific test runs
 * Usage: cypress run --config-file cypress.config.mobile.ts
 */

import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    viewportWidth: 375,
    viewportHeight: 667,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
    specPattern: "tests/e2e/mobile-viewport.cy.ts",
  },
});




