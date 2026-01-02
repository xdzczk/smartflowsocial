import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Performance Benchmark Tests
 *
 * Tests performance metrics:
 * - Page load times
 * - API response times
 * - Interaction response times
 * - Large data handling
 */
describe("Performance Benchmarks", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Page Load Performance", () => {
    it("should load dashboard within acceptable time", () => {
      const startTime = Date.now();

      cy.visitAndCheck("/dashboard");

      cy.then(() => {
        const loadTime = Date.now() - startTime;
        // Dashboard should load within 5 seconds
        expect(loadTime).to.be.lessThan(5000);
      });
    });

    it("should load new post page within acceptable time", () => {
      const startTime = Date.now();

      cy.visitAndCheck("/dashboard/newpost");

      cy.then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(5000);
      });
    });

    it("should load drafts page within acceptable time", () => {
      const startTime = Date.now();

      cy.visitAndCheck("/dashboard/drafts");

      cy.then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(5000);
      });
    });
  });

  describe("API Response Performance", () => {
    it("should respond to effective hashtags API quickly", () => {
      const startTime = Date.now();

      cy.request({
        method: "POST",
        url: "/api/effective-hashtags",
        body: { queueTypeName: "Unassigned" },
        headers: { "Content-Type": "application/json" },
        failOnStatusCode: false,
      }).then(() => {
        const responseTime = Date.now() - startTime;
        // API should respond within 2 seconds
        expect(responseTime).to.be.lessThan(2000);
      });
    });
  });

  describe("Interaction Performance", () => {
    it("should respond to form input quickly", () => {
      cy.visitAndCheck("/dashboard/newpost");

      const startTime = Date.now();
      cy.get("textarea").first().type("Test content");

      cy.then(() => {
        const responseTime = Date.now() - startTime;
        // Typing should be responsive (less than 100ms per character)
        expect(responseTime).to.be.lessThan(2000);
      });
    });

    it("should respond to button clicks quickly", () => {
      cy.visitAndCheck("/dashboard");

      const startTime = Date.now();
      // Use force:true for fixed sidebar links
      cy.get('a[href*="newpost"]')
        .first()
        .should("exist")
        .click({ force: true });

      cy.then(() => {
        const responseTime = Date.now() - startTime;
        // Navigation should be quick
        expect(responseTime).to.be.lessThan(2000);
      });
    });
  });

  describe("Large Data Handling", () => {
    it("should handle large text input", () => {
      cy.visitAndCheck("/dashboard/newpost");

      const largeText = "A".repeat(1000);
      const startTime = Date.now();

      cy.get("textarea").first().type(largeText);

      cy.then(() => {
        const responseTime = Date.now() - startTime;
        // Should handle large input within reasonable time (increased threshold for typing 1000 chars)
        expect(responseTime).to.be.lessThan(15000);
        cy.get("textarea").first().should("have.value", largeText);
      });
    });
  });
});
