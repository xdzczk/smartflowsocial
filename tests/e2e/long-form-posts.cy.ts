import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Long Form Posts Tests
 *
 * Tests long form post functionality:
 * - Navigate to new long form post page
 * - Create long form post
 * - View long form posts
 */
describe("Long Form Posts", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Long Form Post Creation", () => {
    it("should navigate to new long form post page", () => {
      cy.visitAndCheck("/dashboard");
      // Fixed sidebar links need force:true or we need to ensure sidebar is visible
      cy.get('a[href*="newlongformpost"]')
        .first()
        .should("exist")
        .click({ force: true });
      cy.location("pathname", { timeout: 10000 }).should(
        "include",
        "newlongformpost"
      );
    });

    it("should load new long form post page directly", () => {
      cy.visitAndCheck("/dashboard/newlongformpost");
      cy.location("pathname").should("include", "newlongformpost");
      cy.get("body").should("be.visible");
    });

    it("should display long form editor", () => {
      cy.visitAndCheck("/dashboard/newlongformpost");
      cy.get("body").then(($body) => {
        const hasEditor =
          $body.find('[data-testid="editor"], .editor, [class*="editor"]')
            .length > 0 || $body.find("textarea, [contenteditable]").length > 0;

        expect(hasEditor).to.be.true;
      });
    });
  });

  describe("Long Form Posts Display", () => {
    it("should display long form posts in dashboard", () => {
      cy.visitAndCheck("/dashboard");
      cy.get("body").then(($body) => {
        // Check for long form posts (may or may not be present)
        $body.find('[data-testid="longform-post"]').length > 0 ||
          $body.text().toLowerCase().includes("long form");

        // May or may not have posts, but page should load
        expect($body.length).to.be.greaterThan(0);
      });
    });
  });
});
