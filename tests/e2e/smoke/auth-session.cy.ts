import { TEST_NPUB } from "../support/nostr-test-keys";

describe("Smoke: Auth Session", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser({ npub: TEST_NPUB });
  });

  it("opens dashboard for authenticated user", () => {
    cy.visitAndCheck("/dashboard");
    cy.assertPathname("/dashboard");
    cy.get("body").should("be.visible");
  });

  it("keeps session while navigating between protected routes", () => {
    cy.visitAndCheck("/dashboard");
    cy.visitAndCheck("/dashboard/compose");
    cy.assertPathname("/dashboard/compose");
    cy.visitAndCheck("/dashboard");
    cy.assertPathname("/dashboard");
  });
});
