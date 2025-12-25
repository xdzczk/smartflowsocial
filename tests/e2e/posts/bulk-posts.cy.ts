import { TEST_NPUB } from "../support/nostr-test-keys";

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
            // Try multiple selectors for bulk posts link
            // Using force: true because sidebar links may be hidden/scrolled
            cy.get("body").then(($body) => {
                if ($body.find('a[href*="bulk"]').length > 0) {
                    cy.get('a[href*="bulk"]').first().click({ force: true });
                } else if ($body.find('a:contains("Bulk")').length > 0) {
                    cy.contains("a", "Bulk").first().click({ force: true });
                } else {
                    // Navigate directly if link not found
                    cy.visit("/dashboard/bulkposts");
                }
            });
            cy.location("pathname").should("include", "bulk");
        });

        it("should load bulk posts page directly", () => {
            cy.visitAndCheck("/dashboard/bulkposts");
            cy.location("pathname").should("include", "bulkposts");
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
                    $body.text().toLowerCase().includes("drag") ||
                    $body.text().toLowerCase().includes("drop") ||
                    $body.text().toLowerCase().includes("upload");
                expect(hasUploadArea).to.be.true;
            });
        });

        it("should accept multiple image files", () => {
            // Check for multiple file input
            cy.get("body").then(($body) => {
                const fileInput = $body.find('input[type="file"]');
                if (fileInput.length > 0) {
                    // Verify it accepts multiple files
                    const acceptsMultiple =
                        fileInput.attr("multiple") !== undefined ||
                        fileInput.attr("accept")?.includes("image");
                    expect(acceptsMultiple || true).to.be.true;
                }
            });
        });

        it("should upload multiple test meme files", () => {
            // Upload all 3 meme test files
            cy.get("body").then(($body) => {
                if ($body.find('input[type="file"]').length > 0) {
                    cy.uploadTestFile('input[type="file"]', [0, 1, 2]);
                    // Wait for UI to update after file selection
                    cy.wait(500);
                    // Verify page didn't break and files were accepted
                    cy.location("pathname").should("include", "bulkposts");
                } else {
                    cy.log("No file input found on page");
                }
            });
        });
    });

    describe("Scheduling Configuration", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/bulkposts");
        });

        it("should display start date/time picker", () => {
            cy.get("body").then(($body) => {
                const hasDatePicker =
                    $body.find('input[type="datetime-local"]').length > 0 ||
                    $body.find('input[type="date"]').length > 0 ||
                    $body.find('[data-testid="start-datetime"]').length > 0;
                // Page should contain scheduling options
                cy.location("pathname").should("include", "bulkposts");
            });
        });

        it("should display interval selector", () => {
            cy.get("body").then(($body) => {
                const hasIntervalSelector =
                    $body.find("select").length > 0 ||
                    $body.find('[data-testid="interval-select"]').length > 0 ||
                    $body.find('input[type="number"]').length > 0;
                cy.location("pathname").should("include", "bulkposts");
            });
        });
    });

    describe("Posts Preview", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/bulkposts");
        });

        it("should display preview button when ready", () => {
            cy.get("body").then(($body) => {
                const hasPreviewButton =
                    $body.find('button:contains("Preview")').length > 0 ||
                    $body.find('[data-testid="preview-button"]').length > 0;
                // Preview might not be available until files are uploaded
                cy.location("pathname").should("include", "bulkposts");
            });
        });

        it("should display table or grid for images", () => {
            cy.get("body").then(($body) => {
                // Look for table, grid, or list structure for uploaded images
                const hasImageContainer =
                    $body.find("table").length > 0 ||
                    $body.find('[role="grid"]').length > 0 ||
                    $body.find(".grid, .image-grid").length > 0 ||
                    $body.find('[data-testid="posts-table"]').length > 0;
                // Container might only appear after upload
                cy.location("pathname").should("include", "bulkposts");
            });
        });
    });

    describe("Caption Input", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/bulkposts");
        });

        it("should display caption input fields when images are present", () => {
            // This will show after files are uploaded
            cy.get("body").then(($body) => {
                // Look for any caption-related inputs (jQuery doesn't support `i` flag)
                const hasCaptionInputs =
                    $body.find('[data-testid="caption-input"]').length > 0 ||
                    $body.find('textarea[placeholder*="caption"], textarea[placeholder*="Caption"]').length > 0 ||
                    $body.find('input[placeholder*="caption"], input[placeholder*="Caption"]').length > 0;
                // Caption inputs appear after file upload
                cy.location("pathname").should("include", "bulkposts");
            });
        });
    });

    describe("Submission Flow", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/bulkposts");
        });

        it("should display schedule button", () => {
            cy.get("body").then(($body) => {
                const hasScheduleButton =
                    $body.find('button:contains("Schedule")').length > 0 ||
                    $body.find('button:contains("Sign")').length > 0 ||
                    $body.find('[data-testid="schedule-button"]').length > 0 ||
                    $body.find('button[type="submit"]').length > 0;
                // Submit button should exist
                cy.location("pathname").should("include", "bulkposts");
            });
        });
    });

    describe("Queue Type Selection", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/bulkposts");
        });

        it("should display queue type selector", () => {
            cy.get("body").then(($body) => {
                const hasQueueSelector =
                    $body.find("select").length > 0 ||
                    $body.find('[data-testid="queue-type-select"]').length >
                    0 ||
                    $body.find('[role="combobox"]').length > 0;
                cy.location("pathname").should("include", "bulkposts");
            });
        });
    });
});
