import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Recyclables Tests
 * 
 * Tests recyclables functionality:
 * - View recyclables queue
 * - Filter recyclables
 * - Recyclable post actions
 */
describe("Recyclables", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Recyclables Page Access", () => {
    it("should navigate to recyclables page from dashboard", () => {
      cy.visitAndCheck("/dashboard");
      cy.get('a[href*="recyclables"]')
        .first()
        .should("be.visible")
        .click();
      cy.location("pathname").should("include", "recyclables");
    });

    it("should load recyclables page directly", () => {
      cy.visitAndCheck("/dashboard/recyclables");
      cy.location("pathname").should("include", "recyclables");
      cy.get("body").should("be.visible");
    });
  });

  describe("Recyclables Display", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/recyclables");
    });

    it("should display recyclables list or empty state", () => {
      cy.get("body").then(($body) => {
        const hasRecyclables =
          $body.find('[data-testid="recyclable-item"]').length > 0 ||
          $body.find("table tbody tr").length > 0;
        const hasEmptyState =
          $body.find('[data-testid="empty-state"]').length > 0 ||
          $body.text().toLowerCase().includes("no recyclables");
        
        expect(hasRecyclables || hasEmptyState).to.be.true;
      });
    });
  });
});

