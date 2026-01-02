import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Smoke Tests - Critical Path Sanity Checks
 * 
 * These tests verify that the most critical paths work:
 * - Landing page loads
 * - Authentication works
 * - Dashboard is accessible
 * 
 * These should be fast and reliable.
 */
describe("Smoke Tests - Critical Paths", () => {
  afterEach(() => {
    cy.cleanupNostrUser();
  });

  it("should load the landing page", () => {
    cy.visit("/");
    cy.get("body").should("be.visible");
    // Verify we're on the landing page (not redirected)
    cy.location("pathname").should("eq", "/");
  });

  it("should redirect unauthenticated users from dashboard", () => {
    cy.visit("/dashboard");
    // Should redirect to login or landing page
    cy.location("pathname").should("not.include", "dashboard");
  });

  it("should allow authenticated user to access dashboard", () => {
    cy.loginNostr({ npub: TEST_NPUB });
    cy.visitAndCheck("/dashboard");
    cy.location("pathname").should("include", "dashboard");
    // Verify dashboard content is visible
    cy.get("body").should("be.visible");
  });
});


