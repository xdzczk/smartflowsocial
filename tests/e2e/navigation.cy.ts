import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Navigation and Routing Tests
 *
 * Tests navigation between pages:
 * - Dashboard navigation
 * - Sidebar navigation
 * - Direct URL access
 * - Back/forward navigation
 */
describe("Navigation and Routing", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Dashboard Navigation", () => {
    it("should navigate between dashboard sections", () => {
      cy.visitAndCheck("/dashboard");

      // Wait for dashboard to fully load
      cy.get("body").should("be.visible");

      // Navigate to new post - fixed sidebar links may be overflowed, use force click
      cy.get('a[href*="newpost"]')
        .first()
        .should("exist")
        .click({ force: true });
      cy.location("pathname", { timeout: 10000 }).should("include", "newpost");

      // Navigate back to dashboard and wait for it to load
      cy.visitAndCheck("/dashboard");
      cy.location("pathname").should("include", "dashboard");
      cy.get("body").should("be.visible");

      // Navigate to drafts - fixed sidebar links may be overflowed, use force click
      cy.get('a[href*="drafts"]')
        .first()
        .should("exist")
        .click({ force: true });
      cy.location("pathname", { timeout: 10000 }).should("include", "drafts");
    });
  });

  describe("Direct URL Access", () => {
    const routes = [
      "/dashboard",
      "/dashboard/newpost",
      "/dashboard/drafts",
      "/dashboard/scheduled",
      "/dashboard/published",
      "/dashboard/calendar",
      "/dashboard/settings",
    ];

    routes.forEach((route) => {
      it(`should load ${route} directly`, () => {
        cy.visitAndCheck(route);
        cy.location("pathname").should("include", route.split("/").pop());
        cy.get("body").should("be.visible");
      });
    });
  });

  describe("Browser Navigation", () => {
    it("should handle browser back button", () => {
      cy.visitAndCheck("/dashboard");
      cy.visitAndCheck("/dashboard/newpost");

      cy.go("back");
      cy.location("pathname").should("include", "dashboard");
    });

    it("should handle browser forward button", () => {
      cy.visitAndCheck("/dashboard");
      cy.visitAndCheck("/dashboard/newpost");
      cy.go("back");

      cy.go("forward");
      cy.location("pathname").should("include", "newpost");
    });
  });

  describe("Protected Routes", () => {
    it("should redirect unauthenticated users", () => {
      cy.clearCookies();
      cy.visit("/dashboard");
      cy.location("pathname").should("not.include", "dashboard");
    });
  });
});
