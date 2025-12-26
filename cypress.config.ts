import { resolve } from "path";

import { defineConfig } from "cypress";
import { config } from "dotenv";

// Load environment variables from .env file
config({ path: resolve(__dirname, ".env") });

export default defineConfig({
    e2e: {
        specPattern: 'tests/e2e/**/*.cy.ts',
        supportFile: 'tests/e2e/support/e2e.ts',
        fixturesFolder: 'tests/e2e/fixtures',
        screenshotsFolder: 'tests/e2e/screenshots',
        setupNodeEvents: (on, config) => {
            // Use PORT env var, or default to 3000 for dev
            // Only use 8811 if explicitly in CI environment
            const port = process.env.PORT ?? (process.env.CI ? "8811" : "3000");
            const configOverrides: Partial<Cypress.PluginConfigOptions> = {
                baseUrl: `http://localhost:${port}`,
                screenshotOnRunFailure: !process.env.CI,
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