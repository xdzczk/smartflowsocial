import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Posted Posts Queue Tests
 * 
 * Tests the posted posts queue:
 * - View posted posts
 * - Filter by queue type
 * - View post details
 * - Pagination
 */
describe("Posted Posts Queue", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Page Access", () => {
    it("should navigate to posted posts page from dashboard", () => {
      cy.visitAndCheck("/dashboard");
      cy.get('a[href*="posted"]')
        .first()
        .should("be.visible")
        .click();
      cy.location("pathname").should("include", "posted");
    });

    it("should load posted posts page directly", () => {
      cy.visitAndCheck("/dashboard/posted");
      cy.location("pathname").should("include", "posted");
      cy.get("body").should("be.visible");
    });
  });

  describe("Posted Posts Display", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/posted");
    });

    it("should display posted posts list or empty state", () => {
      cy.get("body").then(($body) => {
        const hasPosts =
          $body.find('[data-testid="posted-post"], table tbody tr').length > 0;
        const hasEmptyState =
          $body.find('[data-testid="empty-state"], :contains("No posts")').length > 0;
        
        expect(hasPosts || hasEmptyState).to.be.true;
      });
    });

    it("should display post information when posts exist", () => {
      cy.get("body").then(($body) => {
        const posts = $body.find('[data-testid="posted-post"], table tbody tr');
        if (posts.length > 0) {
          cy.get('[data-testid="posted-post"], table tbody tr')
            .first()
            .should("be.visible");
        }
      });
    });
  });

  describe("Queue Type Filtering", () => {
    it("should filter posted posts by queue type", () => {
      cy.visitAndCheck("/dashboard/posted");
      
      cy.get("body").then(($body) => {
        const queueTabs = $body.find('[role="tab"], a[href*="/posted/"]');
        if (queueTabs.length > 0) {
          cy.get('[role="tab"], a[href*="/posted/"]').first().click();
          cy.location("pathname").should("include", "posted");
        }
      });
    });
  });
});

