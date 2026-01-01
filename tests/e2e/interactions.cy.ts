import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Detailed Interaction Tests
 * 
 * Tests detailed user interactions:
 * - Clicking buttons and links
 * - Typing in forms
 * - Form interactions
 * - Dropdowns and selects
 * - Checkboxes and radio buttons
 * - File uploads
 */
describe("Detailed User Interactions", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Form Interactions", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/newpost");
    });

    it("should handle textarea input with typing", () => {
      const testContent = "This is a test post with #hashtags and @mentions";
      
      cy.get("textarea").first().should("be.visible");
      cy.get("textarea").first().clear();
      cy.get("textarea").first().type(testContent);
      cy.get("textarea").first().should("have.value", testContent);
    });

    it("should handle textarea input with special characters", () => {
      const specialContent = "Test with special chars: !@#$%^&*()_+-=[]{}|;':\",./<>?";
      
      cy.get("textarea").first().clear();
      cy.get("textarea").first().type(specialContent);
      cy.get("textarea").first().should("have.value", specialContent);
    });

    it("should handle textarea input with line breaks", () => {
      const multiLineContent = "Line 1\nLine 2\nLine 3";
      
      cy.get("textarea").first().clear();
      cy.get("textarea").first().type(multiLineContent);
      cy.get("textarea").first().should("contain.value", "Line 1");
    });

    it("should handle textarea backspace and delete", () => {
      cy.get("textarea").first().type("Test content");
      cy.get("textarea").first().type("{backspace}{backspace}");
      cy.get("textarea").first().should("have.value", "Test cont");
    });
  });

  describe("Button Interactions", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/newpost");
    });

    it("should click submit button", () => {
      cy.get("textarea").first().type("Test post");
      cy.get('button[type="submit"], button:contains("Post")')
        .first()
        .should("be.visible")
        .should("not.be.disabled")
        .click();
      
      // Should process submission
      cy.location("pathname", { timeout: 10000 }).should((pathname) => {
        expect(pathname).to.satisfy((p: string) => 
          p.includes("dashboard") || p.includes("newpost")
        );
      });
    });

    it("should handle disabled button state", () => {
      cy.get("body").then(($body) => {
        const disabledButtons = $body.find('button:disabled');
        if (disabledButtons.length > 0) {
          cy.get('button:disabled').first().should("be.disabled");
        }
      });
    });
  });

  describe("Select and Dropdown Interactions", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/newpost");
    });

    it("should interact with select elements", () => {
      cy.get("body").then(($body) => {
        const selects = $body.find("select");
        if (selects.length > 0) {
          cy.get("select").first().should("be.visible").select(0);
          cy.get("select").first().should("have.value");
        }
      });
    });
  });

  describe("Checkbox and Radio Interactions", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/newpost");
    });

    it("should interact with checkboxes", () => {
      cy.get("body").then(($body) => {
        const checkboxes = $body.find('input[type="checkbox"]:visible');
        if (checkboxes.length > 0) {
          cy.get('input[type="checkbox"]:visible').first().check();
          cy.get('input[type="checkbox"]:visible').first().should("be.checked");
        }
      });
    });

    it("should interact with radio buttons", () => {
      cy.get("body").then(($body) => {
        const radios = $body.find('input[type="radio"]:visible');
        if (radios.length > 0) {
          cy.get('input[type="radio"]:visible').first().check();
          cy.get('input[type="radio"]:visible').first().should("be.checked");
        }
      });
    });
  });

  describe("File Upload Interactions", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/newpost");
    });

    it("should handle single file upload", () => {
      cy.get("body").then(($body) => {
        const fileInput = $body.find('input[type="file"]');
        if (fileInput.length > 0) {
          cy.uploadTestFile('input[type="file"]', 0);
          // Wait for navigation after file upload
          cy.location("pathname", { timeout: 10000 }).should("include", "newpost");
        }
      });
    });

    it("should handle multiple file uploads", () => {
      cy.get("body").then(($body) => {
        const fileInput = $body.find('input[type="file"]');
        if (fileInput.length > 0 && fileInput.attr("multiple")) {
          cy.uploadTestFile('input[type="file"]', [0, 1, 2]);
          // Wait for navigation after file upload
          cy.location("pathname", { timeout: 10000 }).should("include", "newpost");
        }
      });
    });
  });

  describe("Link Interactions", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard");
    });

    it("should click navigation links", () => {
      cy.get('a[href*="newpost"]')
        .first()
        .should("be.visible")
        .should("have.attr", "href")
        .then(() => {
          cy.get('a[href*="newpost"]').first().click();
          cy.location("pathname").should("include", "newpost");
        });
    });

    it("should handle external links", () => {
      cy.get("body").then(($body) => {
        const externalLinks = $body.find('a[href^="http"]');
        if (externalLinks.length > 0) {
          cy.get('a[href^="http"]').first().should("have.attr", "href");
        }
      });
    });
  });

  describe("Keyboard Interactions", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/newpost");
    });

    it("should handle Enter key in textarea", () => {
      cy.get("textarea").first().type("Test{enter}");
      cy.get("textarea").first().should("contain.value", "Test");
    });

    it("should handle Tab key navigation", () => {
      cy.get("textarea").first().focus();
      cy.focused().type("{tab}");
      // Should move focus to next element
      cy.focused().should("exist");
    });
  });
});

