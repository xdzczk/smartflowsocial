import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Mobile Viewport Tests
 *
 * Tests mobile responsiveness:
 * - Mobile viewport rendering
 * - Touch interactions
 * - Mobile navigation
 * - Responsive layouts
 */
describe("Mobile Viewport", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
    // Set mobile viewport
    cy.viewport("iphone-x");
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Mobile Layout", () => {
    it("should render dashboard on mobile viewport", () => {
      cy.visitAndCheck("/dashboard");
      cy.get("body").should("be.visible");
      cy.viewport("iphone-x");
      cy.get("body").should("be.visible");
    });

    it("should render new post page on mobile viewport", () => {
      cy.viewport("iphone-x");
      cy.visitAndCheck("/dashboard/newpost");
      cy.get("body").should("be.visible");
      cy.get("textarea").first().should("be.visible");
    });

    it("should render settings page on mobile viewport", () => {
      cy.viewport("iphone-x");
      cy.visitAndCheck("/dashboard/settings");
      cy.get("body").should("be.visible");
    });
  });

  describe("Mobile Navigation", () => {
    it("should handle mobile menu/navigation", () => {
      cy.viewport("iphone-x");
      cy.visitAndCheck("/dashboard");

      cy.get("body").then(($body) => {
        const hasMobileMenu =
          $body.find('[data-testid="mobile-menu"]').length > 0 ||
          $body.find('button:contains("Menu")').length > 0 ||
          $body.find('[aria-label*="menu"]').length > 0;

        if (hasMobileMenu) {
          cy.get('[data-testid="mobile-menu"], button:contains("Menu")')
            .first()
            .click();
          cy.get("body").should("be.visible");
        }
      });
    });
  });

  describe("Mobile Interactions", () => {
    it("should handle touch interactions on mobile", () => {
      cy.viewport("iphone-x");
      cy.visitAndCheck("/dashboard/newpost");

      cy.get("textarea").first().should("be.visible").type("Mobile test");
      cy.get("textarea").first().should("have.value", "Mobile test");
    });

    it("should handle scrolling on mobile", () => {
      cy.viewport("iphone-x");
      cy.visitAndCheck("/dashboard/drafts");

      // Scroll the body or main content area instead of window
      cy.get("body").scrollTo("bottom", { ensureScrollable: false });
      cy.get("body").should("be.visible");
    });
  });

  describe("Responsive Breakpoints", () => {
    const viewports = [
      { name: "iPhone SE", width: 375, height: 667 },
      { name: "iPhone 12 Pro", width: 390, height: 844 },
      { name: "iPhone 14 Pro Max", width: 430, height: 932 },
      { name: "iPad", width: 768, height: 1024 },
    ];

    viewports.forEach((viewport) => {
      it(`should render correctly on ${viewport.name}`, () => {
        cy.viewport(viewport.width, viewport.height);
        cy.visitAndCheck("/dashboard");
        cy.get("body").should("be.visible");
      });
    });
  });
});
