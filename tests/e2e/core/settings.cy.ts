/* eslint-disable testing-library/prefer-screen-queries -- Cypress specs use cy commands, not React Testing Library render queries. */
import { TEST_NPUB } from "../support/nostr-test-keys";

describe("Core: Settings", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser({ npub: TEST_NPUB });
  });

  it("loads settings shell", () => {
    cy.visitAndCheck("/dashboard/settings");
    cy.assertPathname("/dashboard/settings");
    cy.getByTestId("settings-page").should("be.visible");
    cy.getByTestId("settings-active-panel").should("be.visible");
  });

  it("supports billing deep links", () => {
    cy.visitAndCheck("/dashboard/settings?tab=billing");
    cy.location("search").should("include", "tab=billing");
    cy.getByTestId("settings-active-panel").should("be.visible");
  });
});
/* eslint-enable testing-library/prefer-screen-queries */
