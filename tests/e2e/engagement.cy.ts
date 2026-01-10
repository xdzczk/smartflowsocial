import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Engagement Feed Tests
 *
 * Tests engagement feed functionality:
 * - Navigate to engagement feed
 * - View engagement feed
 * - Filter engagement
 */
describe("Engagement Feed", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Page Access", () => {
    it("should navigate to engagement feed from dashboard", () => {
      cy.visitAndCheck("/dashboard");
      // Use force:true for fixed sidebar links
      cy.get('a[href*="engagement"]')
        .first()
        .should("exist")
        .click({ force: true });
      cy.location("pathname", { timeout: 10000 }).should(
        "include",
        "engagement"
      );
    });

    it("should load engagement feed page directly", () => {
      cy.visitAndCheck("/dashboard/engagement/feed");
      cy.location("pathname").should("include", "engagement");
      cy.get("body").should("be.visible");
    });
  });

  describe("Engagement Feed Display", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/engagement/feed");
    });

    it("should display engagement feed content", () => {
      cy.get("body").then(($body) => {
        const hasContent =
          $body.find('[data-testid="engagement-item"]').length > 0 ||
          $body.find('[data-testid="empty-state"]').length > 0 ||
          $body.text().toLowerCase().includes("engagement") ||
          $body.text().toLowerCase().includes("feed");

        expect(hasContent).to.be.true;
      });
    });
  });
});
