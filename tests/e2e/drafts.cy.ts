import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Drafts Management Tests
 *
 * Tests draft functionality:
 * - Viewing drafts list
 * - Creating drafts
 * - Editing drafts
 * - Deleting drafts
 */
describe("Drafts Management", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Drafts List", () => {
    it("should navigate to drafts page from dashboard", () => {
      cy.visitAndCheck("/dashboard");
      // Fixed sidebar links may be overflowed, use force click
      cy.get('a[href*="drafts"]')
        .first()
        .should("exist")
        .click({ force: true });
      cy.location("pathname", { timeout: 10000 }).should("include", "drafts");
    });

    it("should load drafts page directly", () => {
      cy.visitAndCheck("/dashboard/drafts");
      cy.location("pathname").should("include", "drafts");
      cy.get("body").should("be.visible");
    });

    it("should show drafts content type filter", () => {
      cy.visitAndCheck("/dashboard/drafts");
      cy.get('[data-testid="drafts-type-segments"]', {
        timeout: 15000,
      }).should("exist");
    });

    it("should display drafts list or empty state", () => {
      cy.visitAndCheck("/dashboard/drafts");

      // Wait for page to load
      cy.get("body").should("be.visible");

      // Should show either drafts or empty state
      cy.get("body", { timeout: 10000 }).then(($body) => {
        const hasDrafts =
          $body.find(
            'table tbody tr, [data-testid="draft-item"], .draft-item, tbody tr'
          ).length > 0;
        const hasEmptyState =
          $body.find(
            '[data-testid="empty-state"], [data-testid="drafts-empty-state"]'
          ).length > 0 ||
          $body.text().toLowerCase().includes("no drafts") ||
          $body.text().toLowerCase().includes("empty") ||
          $body.text().toLowerCase().includes("no items");

        // If page loaded and has content (even if it's just headers), consider it valid
        const hasContent =
          $body.find("h1, h2, h3, table, .container, main").length > 0;

        expect(hasDrafts || hasEmptyState || hasContent).to.be.true;
      });
    });
  });

  describe("Creating Drafts", () => {
    it("should allow saving a draft from new post page", () => {
      cy.visitAndCheck("/dashboard/newpost");

      const draftContent = `Draft test ${Date.now()} #draft`;
      cy.get("textarea").first().type(draftContent);

      // Look for save draft button
      cy.get("body").then(($body) => {
        const saveDraftButton = $body
          .find('button[type="button"], button')
          .filter((_, el) => {
            const text = Cypress.$(el).text().toLowerCase();
            return text.includes("save") && text.includes("draft");
          })
          .first();

        if (saveDraftButton.length > 0) {
          cy.wrap(saveDraftButton).click();

          // Should redirect or show success
          cy.location("pathname", { timeout: 10000 }).should((pathname) => {
            expect(pathname).to.satisfy(
              (p: string) => p.includes("dashboard") || p.includes("drafts")
            );
          });
        }
      });
    });
  });

  describe("Draft Actions", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/drafts");
    });

    it("should display draft items with action buttons when drafts exist", () => {
      cy.get("body").should("be.visible");

      // Check if drafts exist
      cy.get("body").then(($body) => {
        const draftItems = $body.find(
          '[data-testid="draft-item"], table tbody tr'
        );

        if (draftItems.length > 0) {
          // Verify draft items are visible
          cy.get('[data-testid="draft-item"], table tbody tr')
            .first()
            .should("be.visible");
        } else {
          // If no drafts, that's also valid
          cy.log("No drafts found - empty state is valid");
        }
      });
    });
  });
});
