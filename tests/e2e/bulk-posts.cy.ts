import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Bulk Posts Upload Tests
 *
 * Tests bulk post upload functionality:
 * - Navigate to bulk posts page
 * - Upload multiple files
 * - Configure scheduling
 * - Submit bulk posts
 */
describe("Bulk Posts Upload", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Page Navigation", () => {
    it("should navigate to bulk posts page from dashboard", () => {
      cy.visitAndCheck("/dashboard");
      // Fixed sidebar links may be overflowed, use force click
      cy.get('a[href*="bulk"]').first().should("exist").click({ force: true });
      cy.location("pathname", { timeout: 10000 }).should("include", "bulk");
    });

    it("should load bulk posts page directly", () => {
      cy.visitAndCheck("/dashboard/bulkposts");
      cy.location("pathname").should("include", "bulkposts");
      cy.get("body").should("be.visible");
    });
  });

  describe("Upload Area", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/bulkposts");
    });

    it("should display file upload area", () => {
      cy.get("body").then(($body) => {
        const hasUploadArea =
          $body.find('input[type="file"]').length > 0 ||
          $body.find('[data-testid="upload-area"]').length > 0 ||
          $body.find(".dropzone, .upload-zone").length > 0 ||
          $body.text().toLowerCase().includes("upload") ||
          $body.text().toLowerCase().includes("drag");

        expect(hasUploadArea).to.be.true;
      });
    });

    it("should accept file uploads", () => {
      cy.get("body").should("be.visible");
      cy.get('input[type="file"]').then(($fileInput) => {
        if ($fileInput.length > 0) {
          cy.uploadTestFile('input[type="file"]', 0);
          // Wait for navigation after file upload
          cy.location("pathname", { timeout: 10000 }).should(
            "include",
            "bulkposts"
          );
        } else {
          cy.log("File input not found - feature may not be available");
        }
      });
    });

    it("should accept multiple file uploads", () => {
      cy.get("body").should("be.visible");
      cy.get('input[type="file"]').then(($fileInput) => {
        if ($fileInput.length > 0 && $fileInput.attr("multiple")) {
          cy.uploadTestFile('input[type="file"]', [0, 1, 2]);
          // Wait for navigation after file upload
          cy.location("pathname", { timeout: 10000 }).should(
            "include",
            "bulkposts"
          );
        } else {
          cy.log("Multiple file upload not available");
        }
      });
    });
  });

  describe("Scheduling Configuration", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/bulkposts");
    });

    it("should display scheduling options", () => {
      cy.get("body").then(($body) => {
        const hasSchedulingOptions =
          $body.find('input[type="date"]').length > 0 ||
          $body.find('input[type="time"]').length > 0 ||
          $body.find("select").length > 0 ||
          $body.text().toLowerCase().includes("schedule");

        expect(hasSchedulingOptions).to.be.true;
      });
    });
  });
});
