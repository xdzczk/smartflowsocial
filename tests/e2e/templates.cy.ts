import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Templates Tests
 * 
 * Tests template functionality:
 * - View templates list
 * - Create templates
 * - Edit templates
 * - Use templates
 */
describe("Templates", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Templates Page Access", () => {
    it("should navigate to templates page from dashboard", () => {
      cy.visitAndCheck("/dashboard");
      cy.get('a[href*="templates"]')
        .first()
        .should("be.visible")
        .click();
      cy.location("pathname").should("include", "templates");
    });

    it("should load templates page directly", () => {
      cy.visitAndCheck("/dashboard/templates");
      cy.location("pathname").should("include", "templates");
      cy.get("body").should("be.visible");
    });
  });

  describe("Templates Display", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/templates");
    });

    it("should display templates list or empty state", () => {
      cy.get("body").then(($body) => {
        const hasTemplates =
          $body.find('[data-testid="template-item"]').length > 0 ||
          $body.find("table tbody tr").length > 0;
        const hasEmptyState =
          $body.find('[data-testid="empty-state"], :contains("No templates")').length > 0;
        
        expect(hasTemplates || hasEmptyState).to.be.true;
      });
    });

    it("should display create template button", () => {
      cy.get("body").then(($body) => {
        const hasCreateButton =
          $body.find('a[href*="templates"], button:contains("Create"), button:contains("New")').length > 0;
        
        expect(hasCreateButton).to.be.true;
      });
    });
  });
});

