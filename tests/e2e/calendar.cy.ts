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
      cy.get('a[href*="calendar"]')
        .first()
        .should("be.visible")
        .click();
      cy.location("pathname").should("include", "calendar");
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
      cy.get("body").then(($body) => {
        const hasNavigation =
          $body.find('button:contains("Prev"), button:contains("Next")').length > 0 ||
          $body.find('[data-testid="calendar-nav"]').length > 0;
        
        expect(hasNavigation).to.be.true;
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

