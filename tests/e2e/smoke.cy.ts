import { TEST_NPUB } from "./support/nostr-test-keys";

describe("SmartFlow Smoke Tests", () => {
  afterEach(() => {
    cy.cleanupNostrUser();
  });

  it("should load the landing page", () => {
    cy.visitAndCheck("/");
    // Check that the landing page loads without error
    cy.get("body").should("exist");
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
  });
});
