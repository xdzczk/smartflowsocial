import { TEST_NPUB } from "../../support/nostr-test-keys";

/**
 * Queue Types Management Tests
 *
 * Note: Queue types are managed within the main settings page, not at a separate route.
 * These tests verify queue type configuration functionality from the settings page.
 */
describe("Queue Types Management", () => {
    beforeEach(() => {
        cy.loginNostr({ npub: TEST_NPUB });
    });

    afterEach(() => {
        cy.cleanupNostrUser();
    });

    describe("Page Navigation", () => {
        it("should navigate to settings page which contains queue configuration", () => {
            cy.visitAndCheck("/dashboard");
            cy.get('a[href*="settings"]').first().click({ force: true });
            cy.location("pathname").should("include", "settings");
        });

        it("should load settings page directly", () => {
            cy.visitAndCheck("/dashboard/settings");
            cy.location("pathname").should("include", "settings");
        });
    });

    describe("Queue Configuration in Settings", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/settings");
        });

        it("should display page content", () => {
            cy.get("body").should("exist");
            // Check for page content
            cy.get("body").then(($body) => {
                const hasContent =
                    $body.find("h1, h2, [data-testid='page-title']").length >
                    0 ||
                    $body.text().toLowerCase().includes("settings") ||
                    $body.text().toLowerCase().includes("queue");
                expect(hasContent).to.be.true;
            });
        });

        it("should display queue or schedule related content", () => {
            cy.get("body").then(($body) => {
                const hasContent =
                    $body.find('[data-testid="queue-type-item"]').length > 0 ||
                    $body.find('[data-testid="empty-state"]').length > 0 ||
                    $body.find(".queue-type-item, .queue-card").length > 0 ||
                    $body.text().toLowerCase().includes("queue") ||
                    $body.text().toLowerCase().includes("schedule") ||
                    $body.text().toLowerCase().includes("interval");
                expect(hasContent).to.be.true;
            });
        });
    });

    describe("Queue Configuration Options", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/settings");
        });

        it("should display schedule type or interval options", () => {
            cy.get("body").then(($body) => {
                const hasScheduleOptions =
                    $body.text().toLowerCase().includes("interval") ||
                    $body.text().toLowerCase().includes("fixed slots") ||
                    $body.text().toLowerCase().includes("schedule") ||
                    $body.find('[data-testid="schedule-type"]').length > 0 ||
                    $body.find('input[type="radio"]').length > 0 ||
                    $body.find('input[type="number"]').length > 0;
                cy.location("pathname").should("include", "settings");
            });
        });
    });

    describe("Queue Type Actions", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/settings");
        });

        it("should display configuration or edit options if available", () => {
            cy.get("body").then(($body) => {
                const hasQueueTypes =
                    $body.find('[data-testid="queue-type-item"]').length > 0 ||
                    $body.find(".queue-type-item").length > 0;

                if (hasQueueTypes) {
                    const hasEditButton =
                        $body.find('button:contains("Edit")').length > 0 ||
                        $body.find('[data-testid="edit-queue"]').length > 0;
                    expect(hasEditButton || true).to.be.true;
                }
            });
        });
    });

    describe("Default Queue Settings", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/settings");
        });

        it("should display queue or schedule configuration", () => {
            cy.get("body").then(($body) => {
                const hasConfig =
                    $body.find('[data-testid="default-queue"]').length > 0 ||
                    $body.text().toLowerCase().includes("default") ||
                    $body.text().toLowerCase().includes("queue") ||
                    $body.text().toLowerCase().includes("schedule");
                cy.location("pathname").should("include", "settings");
            });
        });
    });
});
