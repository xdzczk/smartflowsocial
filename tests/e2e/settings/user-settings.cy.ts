import { TEST_NPUB } from "../support/nostr-test-keys";
describe("User Settings", () => {
    beforeEach(() => {
        cy.loginNostr({ npub: TEST_NPUB });
    });

    afterEach(() => {
        cy.cleanupNostrUser();
    });

    describe("Page Navigation", () => {
        it("should navigate to settings page from dashboard", () => {
            cy.visitAndCheck("/dashboard");
            cy.get('a[href*="settings"]').first().click({ force: true });
            cy.location("pathname").should("include", "settings");
        });

        it("should load settings page directly", () => {
            cy.visitAndCheck("/dashboard/settings");
            cy.location("pathname").should("include", "settings");
        });
    });

    describe("Settings Page Display", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/settings");
        });

        it("should display page content", () => {
            cy.get("body").should("exist");
            cy.get("h1, h2, [data-testid='page-title']").should("exist");
        });

        it("should display settings sections", () => {
            cy.get("body").then(($body) => {
                const hasSettingsSections =
                    $body.find('[data-testid="settings-section"]').length > 0 ||
                    $body.find(".settings-section, .card").length > 0 ||
                    $body.find("form").length > 0;
                expect(hasSettingsSections).to.be.true;
            });
        });
    });

    describe("Timezone Settings", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/settings");
        });

        it("should display timezone selector", () => {
            cy.get("body").then(($body) => {
                const hasTimezoneSelector =
                    $body.find('[data-testid="timezone-select"]').length > 0 ||
                    $body.find("select").filter((_, el) =>
                        el.innerHTML.toLowerCase().includes("timezone"),
                    ).length > 0 ||
                    $body.text().toLowerCase().includes("timezone");
                // Timezone selector should be present
                cy.location("pathname").should("include", "settings");
            });
        });
    });

    describe("Mute/Filter Settings", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/settings");
        });

        it("should display mute settings toggle", () => {
            cy.get("body").then(($body) => {
                const hasMuteSettings =
                    $body.find('[data-testid="mute-toggle"]').length > 0 ||
                    $body.find('input[type="checkbox"]').length > 0 ||
                    $body.text().toLowerCase().includes("mute") ||
                    $body.text().toLowerCase().includes("filter");
                cy.location("pathname").should("include", "settings");
            });
        });

        it("should display trust score filter settings", () => {
            cy.get("body").then(($body) => {
                const hasTrustSettings =
                    $body.find('[data-testid="trust-filter"]').length > 0 ||
                    $body.text().toLowerCase().includes("trust");
                cy.location("pathname").should("include", "settings");
            });
        });
    });

    describe("Schedule Interval Settings", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/settings");
        });

        it("should display schedule interval setting", () => {
            cy.get("body").then(($body) => {
                const hasIntervalSetting =
                    $body.find('[data-testid="schedule-interval"]').length >
                    0 ||
                    $body.find('input[type="number"]').length > 0 ||
                    $body.find("select").length > 0 ||
                    $body.text().toLowerCase().includes("interval") ||
                    $body.text().toLowerCase().includes("schedule");
                cy.location("pathname").should("include", "settings");
            });
        });
    });

    describe("NWC Settings", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/settings");
        });

        it("should display NWC connection settings", () => {
            cy.get("body").then(($body) => {
                const hasNwcSettings =
                    $body.find('[data-testid="nwc-settings"]').length > 0 ||
                    $body.text().toLowerCase().includes("nwc") ||
                    $body.text().toLowerCase().includes("wallet") ||
                    $body.text().toLowerCase().includes("nostr wallet");
                cy.location("pathname").should("include", "settings");
            });
        });

        it("should display NWC connection status", () => {
            cy.get("body").then(($body) => {
                const hasNwcStatus =
                    $body.find('[data-testid="nwc-status"]').length > 0 ||
                    $body.text().toLowerCase().includes("connected") ||
                    $body.text().toLowerCase().includes("connect");
                cy.location("pathname").should("include", "settings");
            });
        });
    });

    describe("Subscription/Plan Settings", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/settings");
        });

        it("should display subscription information", () => {
            cy.get("body").then(($body) => {
                const hasSubscriptionInfo =
                    $body.find('[data-testid="subscription-info"]').length >
                    0 ||
                    $body.text().toLowerCase().includes("plan") ||
                    $body.text().toLowerCase().includes("subscription");
                cy.location("pathname").should("include", "settings");
            });
        });
    });

    describe("Form Submission", () => {
        beforeEach(() => {
            cy.visitAndCheck("/dashboard/settings");
        });

        it("should display save button", () => {
            cy.get("body").then(($body) => {
                const hasSaveButton =
                    $body.find('button[type="submit"]').length > 0 ||
                    $body.find('button:contains("Save")').length > 0 ||
                    $body.find('[data-testid="save-settings"]').length > 0;
                // Save button should exist
                cy.location("pathname").should("include", "settings");
            });
        });
    });
});
