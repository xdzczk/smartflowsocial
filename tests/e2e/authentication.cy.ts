import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Authentication Flow Tests
 *
 * Tests the complete authentication flow:
 * - Landing page navigation
 * - Login page access
 * - Authentication redirects
 * - Session persistence
 */
describe("Authentication Flow", () => {
  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Unauthenticated Access", () => {
    it("should show login page when accessing dashboard", () => {
      cy.visit("/dashboard");
      // Should redirect away from dashboard
      cy.location("pathname").should("not.include", "dashboard");
    });

    it("should allow access to landing page", () => {
      cy.visit("/");
      cy.location("pathname").should("eq", "/");
      cy.get("body").should("be.visible");
    });

    it("should allow access to login page", () => {
      cy.visit("/login");
      cy.location("pathname").should("include", "login");
      cy.get("body").should("be.visible");
    });
  });

  describe("Authenticated Access", () => {
    beforeEach(() => {
      cy.loginNostr({ npub: TEST_NPUB });
    });

    it("should redirect to dashboard after login", () => {
      cy.visit("/login");
      // Should redirect to dashboard when already logged in
      cy.location("pathname").should("include", "dashboard");
    });

    it("should allow access to dashboard", () => {
      cy.visitAndCheck("/dashboard");
      cy.location("pathname").should("include", "dashboard");
      cy.get("body").should("be.visible");
    });

    it("should maintain session across page navigations", () => {
      cy.visitAndCheck("/dashboard");
      cy.location("pathname").should("include", "dashboard");

      // Navigate to another page
      cy.visitAndCheck("/dashboard/newpost");
      cy.location("pathname").should("include", "newpost");

      // Navigate back to dashboard
      cy.visitAndCheck("/dashboard");
      cy.location("pathname").should("include", "dashboard");
    });
  });
});




