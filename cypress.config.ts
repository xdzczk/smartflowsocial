import { resolve } from "path";

import { defineConfig } from "cypress";
import { config } from "dotenv";

// Load environment variables from .env file
config({ path: resolve(__dirname, ".env") });

export default defineConfig({
  retries: {
    runMode: 1,
    openMode: 0,
  },
  e2e: {
    specPattern: [
      "tests/e2e/smoke/**/*.cy.ts",
      "tests/e2e/core/**/*.cy.ts",
      "tests/e2e/extended/**/*.cy.ts",
    ],
    supportFile: "tests/e2e/support/e2e.ts",
    fixturesFolder: "tests/e2e/fixtures",
    screenshotsFolder: "tests/e2e/screenshots",
    setupNodeEvents: (on, config) => {
      // Keep a single default port across local and CI runs.
      const port = process.env["PORT"] ?? "3000";
      const configOverrides: Partial<Cypress.PluginConfigOptions> = {
        baseUrl: `http://localhost:${port}`,
        screenshotOnRunFailure: true,
        env: {
          ...config.env,
          DATABASE_URL:
            process.env["DATABASE_URL"] ?? process.env["TEST_DATABASE_URL"],
          SESSION_SECRET: process.env["SESSION_SECRET"],
          NOSTR_PUBLISHER_URL: process.env["NOSTR_PUBLISHER_URL"],
          REDIS_URL: process.env["REDIS_URL"],
          ALLOW_HYDRATION_EXCEPTIONS:
            process.env["ALLOW_HYDRATION_EXCEPTIONS"] ?? "false",
        },
      };

      // To use this:
      // cy.task('log', whateverYouWantInTheTerminal)
      on("task", {
        log: (message) => {
          console.log(message);

          return null;
        },
      });

      return { ...config, ...configOverrides };
    },
  },
});
