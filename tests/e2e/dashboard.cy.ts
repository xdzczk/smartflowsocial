import { TEST_NPUB } from "./support/nostr-test-keys";
describe("Dashboard", () => {
    beforeEach(() => {
        cy.loginNostr({ npub: TEST_NPUB });
    });

    afterEach(() => {
        cy.cleanupNostrUser();
    });

    it("should display dashboard overview", () => {
        cy.visitAndCheck("/dashboard");
        // Verify we're on the dashboard
        cy.location("pathname").should("include", "dashboard");
    });

    it("should navigate to new post page", () => {
        cy.visitAndCheck("/dashboard");
        // Click on new post link/button with force to handle hidden elements
        cy.get('a[href*="newpost"]').first().click({ force: true });
        cy.location("pathname").should("include", "newpost");
    });

    it("should navigate to drafts page", () => {
        cy.visitAndCheck("/dashboard");
        cy.get('a[href*="drafts"]').first().click({ force: true });
        cy.location("pathname").should("include", "drafts");
    });

    it("should navigate to engagement feed", () => {
        cy.visitAndCheck("/dashboard/engagement/feed");
        cy.location("pathname").should("include", "engagement");
    });

    it("should navigate to settings", () => {
        cy.visitAndCheck("/dashboard");
        cy.get('a[href*="settings"]').first().click({ force: true });
        cy.location("pathname").should("include", "settings");
    });
});

