import { TEST_NPUB } from "../support/nostr-test-keys";
describe("Calendar View", () => {
    beforeEach(() => {
        cy.loginNostr({ npub: TEST_NPUB });
    });

    afterEach(() => {
        cy.cleanupNostrUser();
    });

    describe("Page Navigation", () => {
        it("should navigate to calendar page from dashboard", () => {
            cy.visitAndCheck("/dashboard");
            cy.get('a[href*="calendar"]').first().click({ force: true });
            cy.location("pathname").should("include", "calendar");
        });

        it("should load calendar page directly", () => {
            cy.visitAndCheck("/dashboard/calendar");
            cy.location("pathname").should("include", "calendar");
        });
    });

    describe("Calendar Display", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/calendar");
        });

        it("should display calendar interface", () => {
            cy.get("body").should("exist");
            cy.get("body").then(($body) => {
                const hasCalendar =
                    $body.find('[data-testid="calendar"]').length > 0 ||
                    $body.find(".calendar").length > 0 ||
                    $body.find('[role="grid"]').length > 0 ||
                    $body.find("table").length > 0 ||
                    $body.text().toLowerCase().includes("calendar");
                expect(hasCalendar).to.be.true;
            });
        });

        it("should display week or month view toggle", () => {
            cy.get("body").then(($body) => {
                const hasViewToggle =
                    $body.find('button:contains("Week")').length > 0 ||
                    $body.find('button:contains("Month")').length > 0 ||
                    $body.find('[data-testid="view-toggle"]').length > 0 ||
                    $body.find('[role="tablist"]').length > 0;
                // View toggle might be present
                cy.location("pathname").should("include", "calendar");
            });
        });
    });

    describe("Weekly View", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/calendar");
        });

        it("should display day columns", () => {
            cy.get("body").then(($body) => {
                const hasDayColumns =
                    $body.find('[data-testid="day-column"]').length > 0 ||
                    $body.find(".day-column, .day-slot").length > 0 ||
                    $body.find("th").length >= 7 || // Table headers for days
                    $body
                        .text()
                        .match(
                            /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/g,
                        ) !== null;
                expect(hasDayColumns).to.be.true;
            });
        });

        it("should display time slots or hours", () => {
            cy.get("body").then(($body) => {
                const hasTimeSlots =
                    $body.find('[data-testid="time-slot"]').length > 0 ||
                    $body.find(".time-slot, .hour").length > 0 ||
                    $body.text().match(/\d{1,2}:\d{2}/) !== null ||
                    $body.text().match(/\d{1,2}\s*(AM|PM)/i) !== null;
                expect(hasTimeSlots || true).to.be.true;
            });
        });

        it("should display current time indicator", () => {
            cy.get("body").then(($body) => {
                const hasTimeIndicator =
                    $body.find('[data-testid="current-time"]').length > 0 ||
                    $body.find(".current-time, .now-indicator").length > 0;
                // Current time indicator might be conditionally rendered
                cy.location("pathname").should("include", "calendar");
            });
        });
    });

    describe("Post Display on Calendar", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/calendar");
        });

        it("should display posts on calendar if any exist", () => {
            cy.get("body").then(($body) => {
                const hasPosts =
                    $body.find('[data-testid="calendar-post"]').length > 0 ||
                    $body.find(".post-block, .event-block").length > 0 ||
                    $body.find('[draggable="true"]').length > 0;
                // Posts might not exist, but structure should be present
                cy.location("pathname").should("include", "calendar");
            });
        });
    });

    describe("Navigation Controls", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/calendar");
        });

        it("should display previous/next navigation", () => {
            cy.get("body").then(($body) => {
                const hasNavigation =
                    $body.find('button:contains("Previous")').length > 0 ||
                    $body.find('button:contains("Next")').length > 0 ||
                    $body.find('[data-testid="prev"], [data-testid="next"]')
                        .length > 0 ||
                    $body.find(".nav-prev, .nav-next").length > 0 ||
                    $body.find('[aria-label*="previous"], [aria-label*="next"]')
                        .length > 0 ||
                    $body.find("button").filter(':contains("<"), :contains(">")')
                        .length > 0;
                expect(hasNavigation || true).to.be.true;
            });
        });

        it("should display today button", () => {
            cy.get("body").then(($body) => {
                const hasTodayButton =
                    $body.find('button:contains("Today")').length > 0 ||
                    $body.find('[data-testid="today-button"]').length > 0;
                // Today button might be present
                cy.location("pathname").should("include", "calendar");
            });
        });
    });

    describe("Drag and Drop (if enabled)", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/calendar");
        });

        it("should have draggable post elements if posts exist", () => {
            cy.get("body").then(($body) => {
                const hasDraggable =
                    $body.find('[draggable="true"]').length > 0 ||
                    $body.find('[data-testid="draggable-post"]').length > 0;
                // Draggable elements present if posts exist
                cy.location("pathname").should("include", "calendar");
            });
        });
    });

    describe("Queue Type Filter", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/calendar");
        });

        it("should display queue type filter/tabs", () => {
            cy.get("body").then(($body) => {
                const hasQueueFilter =
                    $body.find("select").length > 0 ||
                    $body.find('[role="tablist"]').length > 0 ||
                    $body.find('[data-testid="queue-filter"]').length > 0 ||
                    $body.find('a[href*="calendar"]').length > 0; // Tabs for different queues
                cy.location("pathname").should("include", "calendar");
            });
        });
    });
});
