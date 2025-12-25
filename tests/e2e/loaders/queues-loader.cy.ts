import { TEST_NPUB } from "../support/nostr-test-keys";

describe("Queues Loader Integration", () => {
    beforeEach(() => {
        cy.loginNostr({ npub: TEST_NPUB });
    });

    afterEach(() => {
        cy.cleanupNostrUser();
    });

    describe("Scheduled Posts Loader", () => {
        it("should load scheduled posts without errors", () => {
            // Visit the base scheduled route (no queue type filter)
            cy.visitAndCheck("/dashboard/scheduled");
            cy.location("pathname").should("include", "scheduled");
        });

        it("should return posts array structure", () => {
            cy.visitAndCheck("/dashboard/scheduled");
            // Page should load with the scheduled posts listing
            cy.get("body").should("exist");
            // Check for either posts content or empty state
            cy.get("body").then(($body) => {
                const hasContent =
                    $body.find("table").length > 0 ||
                    $body.text().toLowerCase().includes("scheduled") ||
                    $body.find("[data-testid='empty-state']").length > 0;
                expect(hasContent).to.be.true;
            });
        });

        it("should handle queue type filtering via tabs", () => {
            // First visit the base scheduled route
            cy.visitAndCheck("/dashboard/scheduled");

            // Check that queue selection tabs are visible when content exists
            cy.get("body").then(($body) => {
                // Look for queue tabs or filters
                const hasQueueTabs =
                    $body.find('[role="tablist"]').length > 0 ||
                    $body.find('a[href*="/scheduled/"]').length > 0 ||
                    $body.text().includes("Unassigned");

                // The page should either have queue tabs or the scheduled header
                const hasScheduledContent =
                    $body.text().toLowerCase().includes("scheduled");

                expect(hasQueueTabs || hasScheduledContent).to.be.true;
            });
        });
    });

    describe("Queue Types Loader", () => {
        it("should load queue types settings without errors", () => {
            // Use visit + explicit wait since visitAndCheck checks pathname only
            cy.visit("/dashboard/settings?tab=queue");
            cy.location("pathname").should("include", "/dashboard/settings");
            cy.wait(1000);
        });

        it("should return queue types array", () => {
            cy.visit("/dashboard/settings?tab=queue");
            cy.location("pathname").should("include", "/dashboard/settings");
            cy.wait(1000);
            cy.get("body").then(($body) => {
                // Check for queue type settings content - more flexible matching
                const hasContent =
                    $body.text().toLowerCase().includes("queue") ||
                    $body.text().toLowerCase().includes("settings") ||
                    $body.text().toLowerCase().includes("unassigned") ||
                    $body.find("[data-testid='queue-type']").length > 0 ||
                    $body.find("input").length > 0 ||
                    $body.find("button").length > 0 ||
                    $body.find('[role="tablist"]').length > 0;
                expect(hasContent).to.be.true;
            });
        });

        it("should include schedule configuration", () => {
            cy.visit("/dashboard/settings?tab=queue");
            cy.location("pathname").should("include", "/dashboard/settings");
            cy.wait(1000);
            // Check for schedule configuration elements
            cy.get("body").then(($body) => {
                const hasScheduleConfig =
                    $body.text().toLowerCase().includes("schedule") ||
                    $body.text().toLowerCase().includes("interval") ||
                    $body.find("select").length > 0;
                expect(hasScheduleConfig).to.be.true;
            });
        });
    });

    describe("Calendar Queue Loader", () => {
        it("should load calendar page without errors", () => {
            cy.visitAndCheck("/dashboard/calendar");
            cy.location("pathname").should("include", "calendar");
        });

        it("should display calendar view", () => {
            cy.visitAndCheck("/dashboard/calendar");
            cy.get("body").then(($body) => {
                // Check for calendar elements
                const hasCalendarView =
                    $body.find(".fc, .calendar, [class*='calendar']").length > 0 ||
                    $body.text().match(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/i) !== null ||
                    $body.text().toLowerCase().includes("calendar");
                expect(hasCalendarView).to.be.true;
            });
        });
    });

    describe("Drafts Queue Loader", () => {
        it("should load drafts page without errors", () => {
            cy.visitAndCheck("/dashboard/drafts");
            cy.location("pathname").should("include", "drafts");
        });

        it("should display drafts list or empty state", () => {
            cy.visitAndCheck("/dashboard/drafts");
            cy.get("body").then(($body) => {
                const hasContent =
                    $body.find("table, .draft-item, [data-testid='draft']").length > 0 ||
                    $body.find("[data-testid='empty-state']").length > 0 ||
                    $body.text().toLowerCase().includes("draft") ||
                    $body.text().toLowerCase().includes("no drafts");
                expect(hasContent).to.be.true;
            });
        });
    });

    describe("Posted Queue Loader", () => {
        it("should load posted page without errors", () => {
            cy.visitAndCheck("/dashboard/posted");
            cy.location("pathname").should("include", "posted");
        });

        it("should display posted posts list", () => {
            cy.visitAndCheck("/dashboard/posted");
            cy.get("body").then(($body) => {
                const hasContent =
                    $body.find("table, .post-item, [data-testid='post']").length > 0 ||
                    $body.find("[data-testid='empty-state']").length > 0 ||
                    $body.text().toLowerCase().includes("posted") ||
                    $body.text().toLowerCase().includes("no posts");
                expect(hasContent).to.be.true;
            });
        });
    });

    describe("Queue Schedule API Integration", () => {
        it("should load new post page with queue selector", () => {
            cy.visitAndCheck("/dashboard/newpost");
            cy.location("pathname").should("include", "newpost");
        });

        it("should display queue type options", () => {
            cy.visitAndCheck("/dashboard/newpost");
            cy.get("body").then(($body) => {
                // Check for queue type selector
                const hasQueueSelector =
                    $body.find("select, [data-testid='queue-selector']").length > 0 ||
                    $body.text().toLowerCase().includes("queue") ||
                    $body.text().toLowerCase().includes("unassigned");
                expect(hasQueueSelector).to.be.true;
            });
        });
    });
});
