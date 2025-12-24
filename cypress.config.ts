import { defineConfig } from "cypress";

export default defineConfig({
    e2e: {
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