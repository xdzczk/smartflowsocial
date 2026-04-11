import { TEST_NPUB } from "../support/nostr-test-keys";

describe("Extended: Subscription", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser({ npub: TEST_NPUB });
  });

  it("loads plans page for authenticated users", () => {
    cy.visitAndCheck("/plans");
    cy.assertPathname("/plans");
    cy.get("body").should("be.visible");
  });
});
