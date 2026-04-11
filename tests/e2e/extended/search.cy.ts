import { TEST_NPUB } from "../support/nostr-test-keys";

describe("Extended: Search", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser({ npub: TEST_NPUB });
  });

  it("loads global post search route", () => {
    cy.visitAndCheck("/dashboard/search/posts?q=nostr");
    cy.assertPathname("/dashboard/search/posts");
    cy.get("main", { timeout: 20000 }).should("exist");
    cy.get("body").should("be.visible");
  });
});
