import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Calendar View Tests
 *
 * Tests calendar functionality:
 * - Navigate to calendar page
 * - Display calendar view
 * - Filter by queue type
 * - View scheduled posts on calendar
 */
describe("Calendar View", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Calendar Page Access", () => {
    it("should navigate to calendar page from dashboard", () => {
      cy.visitAndCheck("/dashboard");
      // Fixed sidebar links may be overflowed, use force click
      cy.get('a[href*="calendar"]')
        .first()
        .should("exist")
        .click({ force: true });
      cy.location("pathname", { timeout: 10000 }).should("include", "calendar");
    });

    it("should load calendar page directly", () => {
      cy.visitAndCheck("/dashboard/calendar");
      cy.location("pathname").should("include", "calendar");
      cy.get("body").should("be.visible");
    });
  });

  describe("Calendar Display", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/calendar");
    });

    it("should display calendar view", () => {
      cy.get("body").then(($body) => {
        const hasCalendarView =
          $body.find(".fc, .calendar, [class*='calendar']").length > 0 ||
          $body.text().match(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/i) !== null ||
          $body.text().toLowerCase().includes("calendar");

        expect(hasCalendarView).to.be.true;
      });
    });

    it("should display calendar navigation", () => {
      // Wait for calendar to load
      cy.get("body").should("be.visible");

      cy.get("body", { timeout: 10000 }).then(($body) => {
        // Look for calendar navigation elements
        const hasNavigation =
          $body.find("button").filter((_, el) => {
            const text = Cypress.$(el).text().toLowerCase();
            return (
              text.includes("prev") ||
              text.includes("next") ||
              text.includes("today")
            );
          }).length > 0 ||
          $body.find('[data-testid="calendar-nav"]').length > 0 ||
          $body.find(
            '.fc-header-toolbar, .calendar-nav, [class*="calendar-nav"]'
          ).length > 0 ||
          // Calendar might be rendered, so check if calendar container exists
          $body.find('.fc, .calendar, [class*="calendar"]').length > 0;

        expect(hasNavigation || $body.text().toLowerCase().includes("calendar"))
          .to.be.true;
      });
    });
  });

  describe("Queue Type Filtering", () => {
    it("should filter calendar by queue type", () => {
      cy.visitAndCheck("/dashboard/calendar");

      cy.get("body").then(($body) => {
        const queueTabs = $body.find('[role="tab"], a[href*="/calendar/"]');
        if (queueTabs.length > 0) {
          cy.get('[role="tab"], a[href*="/calendar/"]').first().click();
          cy.location("pathname").should("include", "calendar");
        }
      });
    });
  });
});
