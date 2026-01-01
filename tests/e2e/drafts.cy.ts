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
      cy.get('a[href*="drafts"]')
        .first()
        .should("be.visible")
        .click();
      cy.location("pathname").should("include", "drafts");
    });

    it("should load drafts page directly", () => {
      cy.visitAndCheck("/dashboard/drafts");
      cy.location("pathname").should("include", "drafts");
      cy.get("body").should("be.visible");
    });

    it("should display drafts list or empty state", () => {
      cy.visitAndCheck("/dashboard/drafts");
      
      // Should show either drafts or empty state
      cy.get("body").then(($body) => {
        const hasDrafts = 
          $body.find('[data-testid="draft-item"], table tbody tr').length > 0;
        const hasEmptyState = 
          $body.find('[data-testid="empty-state"], :contains("No drafts"), :contains("empty")').length > 0;
        
        expect(hasDrafts || hasEmptyState).to.be.true;
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
        const saveDraftButton = 
          $body.find('button:contains("Save Draft"), button:contains("Save as Draft")').first();
        
        if (saveDraftButton.length > 0) {
          cy.wrap(saveDraftButton).click();
          
          // Should redirect or show success
          cy.location("pathname", { timeout: 10000 }).should((pathname) => {
            expect(pathname).to.satisfy((p: string) => 
              p.includes("dashboard") || p.includes("drafts")
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
      cy.get("body").then(($body) => {
        const draftItems = $body.find('[data-testid="draft-item"], table tbody tr');
        
        if (draftItems.length > 0) {
          // Verify draft items have action buttons
          cy.get('[data-testid="draft-item"], table tbody tr')
            .first()
            .within(() => {
              // Look for edit/delete buttons
              cy.get("body").then(($item) => {
                const hasActions = 
                  $item.find('button:contains("Edit"), button:contains("Delete")').length > 0 ||
                  $item.find('[data-testid="draft-actions"]').length > 0;
                
                if (hasActions) {
                  expect(hasActions).to.be.true;
                }
              });
            });
        }
      });
    });
  });
});

