import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Settings — shell navigation, deep links, and basic visibility.
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
      cy.get('a[href*="settings"]')
        .first()
        .should("exist")
        .click({ force: true });
      cy.location("pathname", { timeout: 10000 }).should("include", "settings");
    });

    it("should load settings page directly", () => {
      cy.visitAndCheck("/dashboard/settings");
      cy.location("pathname").should("include", "settings");
      cy.get('[data-testid="settings-page"]').should("be.visible");
    });
  });

  describe("Settings shell", () => {
    it("shows settings page and active panel", () => {
      cy.visitAndCheck("/dashboard/settings");
      cy.get('[data-testid="settings-page"]').should("be.visible");
      cy.get('[data-testid="settings-active-panel"]').should("be.visible");
    });

    it("syncs tab query when selecting a section (desktop rail)", () => {
      cy.visitAndCheck("/dashboard/settings?tab=general");
      cy.viewport(1280, 800);
      cy.get('[data-testid="settings-section-rail"]').should("be.visible");
      cy.get('[data-testid="settings-nav-item-network"]').click();
      cy.location("search").should("include", "tab=network");
      cy.get('[data-testid="settings-active-panel"]').should("be.visible");
    });

    it("supports deep link to subscription when available", () => {
      cy.visitAndCheck("/dashboard/settings?tab=subscription");
      cy.location("search").should("include", "tab=subscription");
      cy.get('[data-testid="settings-active-panel"]').should("be.visible");
    });
  });

  describe("Settings content", () => {
    it("should display settings forms or sections", () => {
      cy.visitAndCheck("/dashboard/settings");
      cy.get("body").then(($body) => {
        const hasContent =
          $body.find("form").length > 0 ||
          $body.find('[data-testid="settings-section"]').length > 0 ||
          $body.find("h1, h2").length > 0;
        expect(hasContent).to.be.true;
      });
    });
  });
});
