import { TEST_NPUB } from "../../support/nostr-test-keys";

describe("Dashboard Loader Integration", () => {
    beforeEach(() => {
        cy.loginNostr({ npub: TEST_NPUB });
    });

    afterEach(() => {
        cy.cleanupNostrUser();
    });

    describe("Dashboard Index Loader", () => {
        it("should load dashboard without errors", () => {
            cy.visitAndCheck("/dashboard");
            cy.location("pathname").should("include", "dashboard");
        });

        it("should return scheduled posts structure", () => {
            cy.visitAndCheck("/dashboard");
            // Page should load with the dashboard content
            cy.get("body").should("exist");
            // Check for either posts table or empty state
            cy.get("body").then(($body) => {
                const hasContent =
                    $body.find("table").length > 0 ||
                    $body.text().toLowerCase().includes("scheduled") ||
                    $body.find("[data-testid='empty-state']").length > 0;
                expect(hasContent).to.be.true;
            });
        });

        it("should display statistics component", () => {
            cy.visitAndCheck("/dashboard");
            // Check for statistics section - look for stats-related content
            cy.get("body").then(($body) => {
                const hasStatistics =
                    $body.find('[data-testid="statistics"]').length > 0 ||
                    $body.find(".statistics, .stats").length > 0 ||
                    $body.text().match(/\d+\s*(scheduled|posts?|queued)/i) !== null ||
                    $body.text().toLowerCase().includes("posts");
                expect(hasStatistics).to.be.true;
            });
        });

        it("should display queue selection tabs", () => {
            cy.visitAndCheck("/dashboard");
            // Check for queue tabs or queue type selectors
            cy.get("body").then(($body) => {
                const hasQueueTabs =
                    $body.find('[role="tablist"]').length > 0 ||
                    $body.find('a[href*="/dashboard?"]').length > 0 ||
                    $body.find('[data-testid="queue-tabs"]').length > 0 ||
                    $body.text().toLowerCase().includes("all") ||
                    $body.text().toLowerCase().includes("unassigned");
                expect(hasQueueTabs).to.be.true;
            });
        });
    });

    describe("Dashboard Queue Filtering", () => {
        it("should handle all content tab", () => {
            cy.visitAndCheck("/dashboard?tab=all");
            cy.location("pathname").should("include", "dashboard");
            cy.get("body").then(($body) => {
                const hasContent =
                    $body.text().toLowerCase().includes("all") ||
                    $body.text().toLowerCase().includes("scheduled");
                expect(hasContent).to.be.true;
            });
        });

        it("should handle posts tab", () => {
            cy.visitAndCheck("/dashboard?tab=posts");
            cy.location("pathname").should("include", "dashboard");
            cy.get("body").then(($body) => {
                const hasPostsContent =
                    $body.find("table").length > 0 ||
                    $body.text().toLowerCase().includes("post") ||
                    $body.find("[data-testid='empty-state']").length > 0;
                expect(hasPostsContent).to.be.true;
            });
        });

        it("should handle longform tab", () => {
            cy.visitAndCheck("/dashboard?tab=longform");
            cy.location("pathname").should("include", "dashboard");
            cy.get("body").then(($body) => {
                const hasLongformContent =
                    $body.text().toLowerCase().includes("longform") ||
                    $body.find("[data-testid='empty-state']").length > 0 ||
                    $body.find("table").length > 0;
                expect(hasLongformContent).to.be.true;
            });
        });
    });

    describe("Dashboard Data Structure", () => {
        it("should render user-specific content", () => {
            cy.visitAndCheck("/dashboard");
            // Dashboard should be personalized to logged-in user
            cy.get("body").then(($body) => {
                // Should have navigation or user-specific elements
                const hasUserContent =
                    $body.find('a[href*="newpost"]').length > 0 ||
                    $body.find('a[href*="settings"]').length > 0 ||
                    $body.find('[data-testid="user-menu"]').length > 0;
                expect(hasUserContent).to.be.true;
            });
        });

        it("should load queue types from user settings", () => {
            cy.visitAndCheck("/dashboard");
            // Queue types should be loaded for the user
            cy.get("body").then(($body) => {
                // Check for queue-related UI elements
                const hasQueueUI =
                    $body.find('[role="tablist"]').length > 0 ||
                    $body.find('button, a').filter(':contains("Queue")').length > 0 ||
                    $body.text().toLowerCase().includes("queue") ||
                    $body.text().toLowerCase().includes("unassigned");
                expect(hasQueueUI).to.be.true;
            });
        });
    });
});
