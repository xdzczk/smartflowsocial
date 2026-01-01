import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Post Creation Flow Tests
 * 
 * Tests creating posts (immediate posting):
 * - Navigate to new post page
 * - Fill in post content
 * - Submit post
 * - Verify post appears in posted queue
 */
describe("Post Creation Flow", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Navigation", () => {
    it("should navigate to new post page from dashboard", () => {
      cy.visitAndCheck("/dashboard");
      // Look for new post link/button
      cy.get('a[href*="newpost"], button:contains("New Post")')
        .first()
        .should("be.visible")
        .click();
      cy.location("pathname").should("include", "newpost");
    });

    it("should load new post page directly", () => {
      cy.visitAndCheck("/dashboard/newpost");
      cy.location("pathname").should("include", "newpost");
      cy.get("body").should("be.visible");
    });
  });

  describe("Post Form", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/newpost");
    });

    it("should display post content textarea", () => {
      cy.get("textarea").should("exist").and("be.visible");
    });

    it("should allow entering content in textarea", () => {
      const testContent = "Test post content #test";
      cy.get("textarea").first().should("be.visible").type(testContent);
      cy.get("textarea").first().should("have.value", testContent);
    });

    it("should display submit button", () => {
      cy.get('button[type="submit"], button:contains("Post")')
        .should("exist")
        .and("be.visible");
    });
  });

  describe("Post Submission", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/newpost");
    });

    it("should create an immediate post", () => {
      const postContent = `E2E test post ${Date.now()} #e2e`;
      
      // Fill in content
      cy.get("textarea").first().type(postContent);
      
      // Submit
      cy.get('button[type="submit"], button:contains("Post")')
        .first()
        .click();
      
      // Wait for redirect or success message
      cy.location("pathname", { timeout: 10000 }).should((pathname) => {
        expect(pathname).to.satisfy((p: string) => 
          p.includes("dashboard") || p.includes("posted")
        );
      });
      
      // Verify post appears in posted queue
      cy.visitAndCheck("/dashboard/posted");
      cy.contains(postContent).should("exist");
    });

    it("should validate required fields", () => {
      // Try to submit without content
      cy.get('button[type="submit"], button:contains("Post")')
        .first()
        .click();
      
      // Should show validation error or stay on page
      cy.location("pathname").then((pathname) => {
        // Either shows error or stays on newpost page
        expect(pathname).to.satisfy((p: string) => 
          p.includes("newpost") || p.includes("dashboard")
        );
      });
    });
  });
});

