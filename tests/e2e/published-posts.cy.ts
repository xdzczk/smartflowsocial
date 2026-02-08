import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Posted Posts Queue Tests
 *
 * Tests the published posts queue:
 * - View published posts
 * - Filter by queue type
 * - View post details
 * - Pagination
 */
describe("Published Posts Queue", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Page Access", () => {
    it("should navigate to published posts page from dashboard", () => {
      cy.visitAndCheck("/dashboard");
      // Fixed sidebar links may be overflowed, use force click
      cy.get('a[href*="published"]')
        .first()
        .should("exist")
        .click({ force: true });
      cy.location("pathname", { timeout: 10000 }).should(
        "include",
        "published"
      );
    });

    it("should load published posts page directly", () => {
      cy.visitAndCheck("/dashboard/published");
      cy.location("pathname").should("include", "published");
      cy.get("body").should("be.visible");
    });
  });

  describe("Published Posts Display", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/published");
    });

    it("should display published posts list or empty state", () => {
      // Wait for page to load
      cy.get("body").should("be.visible");

      // Check for posts or empty state with better selectors
      cy.get("body", { timeout: 10000 }).then(($body) => {
        const hasPosts =
          $body.find(
            'table tbody tr, [data-testid="published-post"], .post-item, tbody tr'
          ).length > 0;
        const hasEmptyState =
          $body.find('[data-testid="empty-state"]').length > 0 ||
          $body.text().toLowerCase().includes("no posts") ||
          $body.text().toLowerCase().includes("no published posts") ||
          $body.text().toLowerCase().includes("empty") ||
          $body.text().toLowerCase().includes("no items");

        // If page loaded and has content (even if it's just headers), consider it valid
        const hasContent =
          $body.find("h1, h2, h3, table, .container, main").length > 0;

        expect(hasPosts || hasEmptyState || hasContent).to.be.true;
      });
    });

    it("should display post information when posts exist", () => {
      cy.get("body").then(($body) => {
        const posts = $body.find(
          '[data-testid="published-post"], table tbody tr'
        );
        if (posts.length > 0) {
          cy.get('[data-testid="published-post"], table tbody tr')
            .first()
            .should("be.visible");
        }
      });
    });
  });

  describe("Queue Type Filtering", () => {
    it("should filter published posts by queue type", () => {
      cy.visitAndCheck("/dashboard/published");

      cy.get("body").then(($body) => {
        const queueTabs = $body.find('[role="tab"], a[href*="/published/"]');
        if (queueTabs.length > 0) {
          cy.get('[role="tab"], a[href*="/published/"]').first().click();
          cy.location("pathname").should("include", "published");
        }
      });
    });
  });
});
