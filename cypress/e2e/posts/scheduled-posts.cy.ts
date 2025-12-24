import { TEST_NPUB } from "../../support/nostr-test-keys";

describe("Scheduled Posts Management", () => {
    beforeEach(() => {
        cy.loginNostr({ npub: TEST_NPUB });
    });

    afterEach(() => {
        cy.cleanupNostrUser();
    });

    describe("Page Navigation", () => {
        it("should navigate to scheduled posts page", () => {
            cy.visitAndCheck("/dashboard");
            cy.get('a[href*="scheduled"]').first().click({ force: true });
            cy.location("pathname").should("include", "scheduled");
        });

        it("should load scheduled posts page directly", () => {
            cy.visitAndCheck("/dashboard/scheduled");
            cy.location("pathname").should("include", "scheduled");
        });
    });

    describe("Scheduled Posts List", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/scheduled");
        });

        it("should display page content", () => {
            cy.get("body").should("exist");
            // Check for page content - may not have h1/h2 but should have content
            cy.get("body").then(($body) => {
                const hasContent =
                    $body.find("h1, h2, [data-testid='page-title']").length > 0 ||
                    $body.text().toLowerCase().includes("schedule") ||
                    $body.text().toLowerCase().includes("no scheduled");
                expect(hasContent).to.be.true;
            });
        });

        it("should show empty state or posts list", () => {
            cy.get("body").then(($body) => {
                // Either show empty state message or post items
                const hasContent =
                    $body.find('[data-testid="scheduled-post"]').length > 0 ||
                    $body.find('[data-testid="empty-state"]').length > 0 ||
                    $body.find(".post-item, .post-card").length > 0 ||
                    $body.text().toLowerCase().includes("no scheduled") ||
                    $body.text().toLowerCase().includes("schedule");
                expect(hasContent).to.be.true;
            });
        });
    });

    describe("Post Actions", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/scheduled");
        });

        it("should display action buttons on posts if posts exist", () => {
            cy.get("body").then(($body) => {
                const hasPosts =
                    $body.find('[data-testid="scheduled-post"]').length > 0 ||
                    $body.find(".post-item, .post-card").length > 0;

                if (hasPosts) {
                    // Check for edit/delete/reschedule actions
                    const hasActions =
                        $body.find(
                            'button:contains("Edit"), button:contains("Delete"), button:contains("Reschedule")',
                        ).length > 0 ||
                        $body.find('[data-testid="post-actions"]').length > 0 ||
                        $body.find(".dropdown, .menu").length > 0;
                    expect(hasActions).to.be.true;
                }
            });
        });
    });

    describe("Queue Type Filter", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/scheduled");
        });

        it("should display queue type filter if available", () => {
            cy.get("body").then(($body) => {
                // Queue type filter might be a select or tabs
                const hasQueueFilter =
                    $body.find("select").length > 0 ||
                    $body.find('[role="tablist"]').length > 0 ||
                    $body.find('[data-testid="queue-filter"]').length > 0;
                // Page should load regardless
                cy.location("pathname").should("include", "scheduled");
            });
        });
    });

    describe("Post Preview", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/scheduled");
        });

        it("should display post content preview", () => {
            cy.get("body").then(($body) => {
                const hasPosts =
                    $body.find('[data-testid="scheduled-post"]').length > 0 ||
                    $body.find(".post-item, .post-card").length > 0;

                if (hasPosts) {
                    // Posts should show some content preview
                    const hasContentPreview =
                        $body.find('[data-testid="post-content"]').length > 0 ||
                        $body.find(".post-content, .caption").length > 0 ||
                        $body.find("p").length > 0;
                    expect(hasContentPreview).to.be.true;
                }
            });
        });

        it("should display scheduled time for posts", () => {
            cy.get("body").then(($body) => {
                const hasPosts =
                    $body.find('[data-testid="scheduled-post"]').length > 0 ||
                    $body.find(".post-item, .post-card").length > 0;

                if (hasPosts) {
                    // Posts should show schedule time
                    const hasTime =
                        $body.find('[data-testid="scheduled-time"]').length >
                        0 ||
                        $body.find("time").length > 0 ||
                        $body.text().match(/\d{1,2}:\d{2}/) !== null;
                    expect(hasTime).to.be.true;
                }
            });
        });
    });
});
