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
      // Fixed sidebar links may be overflowed, use force click
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

    it("should show needs response tab", () => {
      cy.contains("button", /Needs response/i).should("be.visible");
    });

    it("should show engagement sort control", () => {
      cy.get('[data-testid="engagement-sort"]').should("exist");
    });

    it("should expose Like outside overflow when an item exists", () => {
      cy.get("body").then(($body) => {
        const item = $body.find('[data-testid="engagement-item"]').first();
        if (!item.length) return;
        cy.get('[aria-label="Like"]').should("exist");
      });
    });

    it("should not show Queue control in response tray when reply is open", () => {
      cy.get("body").then(($body) => {
        const item = $body.find('[data-testid="engagement-item"]').first();
        if (!item.length) return;
        cy.wrap(item)
          .contains("button", /^Reply$/i)
          .first()
          .click({ force: true });
        cy.get('[data-testid="engagement-response-tray"]').should("exist");
        cy.contains("button", /^Queue$/i).should("not.exist");
      });
    });
  });
});
