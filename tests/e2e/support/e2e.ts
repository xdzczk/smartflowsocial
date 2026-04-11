import { registerCommands } from "./commands";

import "@testing-library/cypress/add-commands";
registerCommands();

Cypress.on("uncaught:exception", (err) => {
  const allowHydrationExceptions =
    Cypress.env("ALLOW_HYDRATION_EXCEPTIONS") === true ||
    Cypress.env("ALLOW_HYDRATION_EXCEPTIONS") === "true";
  if (!allowHydrationExceptions) {
    return;
  }

  // Temporary compatibility switch for hydration errors in legacy environments.
  if (
    /hydrat/i.test(err.message) ||
    /Minified React error #418|#423/.test(err.message)
  ) {
    return false;
  }
});
