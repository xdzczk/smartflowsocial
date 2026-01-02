import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Settings Tests
 * 
 * Tests user settings functionality:
 * - Accessing settings page
 * - Viewing settings sections
 * - Updating settings (if applicable)
 */
describe("User Settings", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Settings Page Access", () => {
    it("should navigate to settings page from dashboard", () => {
      cy.visitAndCheck("/dashboard");
      // Use force:true for fixed sidebar links
      cy.get('a[href*="settings"]')
        .first()
        .should("exist")
        .click({ force: true });
      cy.location("pathname", { timeout: 10000 }).should("include", "settings");
    });

    it("should load settings page directly", () => {
      cy.visitAndCheck("/dashboard/settings");
      cy.location("pathname").should("include", "settings");
      cy.get("body").should("be.visible");
    });
  });

  describe("Settings Display", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/settings");
    });

    it("should display settings page content", () => {
      cy.get("body").should("be.visible");
      // Should have some form of settings content
      cy.get("body").then(($body) => {
        const hasContent = 
          $body.find("form").length > 0 ||
          $body.find('[data-testid="settings-section"]').length > 0 ||
          $body.find("h1, h2").length > 0;
        
        expect(hasContent).to.be.true;
      });
    });

    it("should display settings sections or tabs", () => {
      cy.get("body").then(($body) => {
        const hasSections = 
          $body.find('[data-testid="settings-section"]').length > 0 ||
          $body.find('[role="tablist"]').length > 0 ||
          $body.find(".settings-section, .card").length > 0;
        
        expect(hasSections).to.be.true;
      });
    });
  });

  describe("Settings Tabs", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/settings");
    });

    it("should display queue settings tab", () => {
      cy.get("body").then(($body) => {
        // Check for queue tab or queue settings
        const hasQueueTab = 
          $body.find('[role="tab"]:contains("Queue"), a[href*="queue"]').length > 0 ||
          $body.find('button:contains("Queue")').length > 0;
        
        // Or check if queue settings are visible
        const hasQueueSettings = 
          $body.find('[data-testid="queue-settings"]').length > 0 ||
          $body.text().toLowerCase().includes("queue");
        
        expect(hasQueueTab || hasQueueSettings).to.be.true;
      });
    });
  });
});


