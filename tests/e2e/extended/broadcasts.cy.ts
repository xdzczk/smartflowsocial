import { TEST_NPUB } from "../support/nostr-test-keys";

describe("Extended: Broadcasts", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser({ npub: TEST_NPUB });
  });

  it("loads broadcasts index", () => {
    cy.visitAndCheck("/dashboard/broadcasts");
    cy.assertPathname("/dashboard/broadcasts");
    cy.get("body").should("be.visible");
  });
});
