import { TEST_NPUB } from "../support/nostr-test-keys";

describe("Smoke: Compose and Publish", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
    cy.visitAndCheck("/dashboard/compose?type=post");
  });

  afterEach(() => {
    cy.cleanupNostrUser({ npub: TEST_NPUB });
  });

  it("renders the compose shell", () => {
    cy.assertPathname("/dashboard/compose");
    cy.get("main", { timeout: 20000 }).should("be.visible");
    cy.contains(/Create (post|thread|poll|article)/, { timeout: 20000 }).should(
      "exist"
    );
  });

  it("shows composer mode tabs", () => {
    cy.contains("button", "Post", { timeout: 20000 }).should("be.visible");
    cy.contains("button", "Poll").should("be.visible");
    cy.contains("button", "Thread").should("be.visible");
    cy.contains("button", "Article").should("be.visible");
  });
});
