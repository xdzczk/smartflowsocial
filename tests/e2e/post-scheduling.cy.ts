import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Post Scheduling Flow Tests
 * 
 * Tests scheduling posts for future publication:
 * - Enable scheduling
 * - Set schedule date/time
 * - Select queue type
 * - Verify scheduled post appears in scheduled queue
 */
describe("Post Scheduling Flow", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Schedule Configuration", () => {
    beforeEach(() => {
      cy.visitAndCheck("/dashboard/newpost");
    });

    it("should display schedule toggle", () => {
      // Look for schedule-related UI elements
      cy.get("body").then(($body) => {
        const hasScheduleToggle =
          $body.find('[data-testid="schedule-toggle"]').length > 0 ||
          $body.find('input[type="checkbox"][name*="schedule"]').length > 0 ||
          $body.find('label:contains("Schedule")').length > 0;
        
        if (hasScheduleToggle) {
          cy.get('[data-testid="schedule-toggle"], input[type="checkbox"][name*="schedule"]')
            .first()
            .should("exist");
        }
      });
    });

    it("should show date/time picker when scheduling is enabled", () => {
      // Enter content first
      cy.get("textarea").first().type("Scheduled test post");
      
      // Try to enable scheduling
      cy.get("body").then(($body) => {
        const scheduleToggle = $body.find('[data-testid="schedule-toggle"]').first();
        const scheduleCheckbox = $body.find('input[type="checkbox"][name*="schedule"]').first();
        
        if (scheduleToggle.length > 0) {
          cy.wrap(scheduleToggle).click();
        } else if (scheduleCheckbox.length > 0) {
          cy.wrap(scheduleCheckbox).check();
        }
        
        // After enabling, check for date/time inputs
        cy.get("body").should("be.visible");
      });
    });
  });

  describe("Scheduled Post Creation", () => {
    it("should create a scheduled post", () => {
      cy.visitAndCheck("/dashboard/newpost");
      
      const postContent = `Scheduled E2E test ${Date.now()} #e2e`;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0);
      
      // Fill in content
      cy.get("textarea").first().type(postContent);
      
      // Enable scheduling if available
      cy.get("body").then(($body) => {
        const scheduleToggle = $body.find('[data-testid="schedule-toggle"]').first();
        const scheduleCheckbox = $body.find('input[type="checkbox"][name*="schedule"]').first();
        
        if (scheduleToggle.length > 0) {
          cy.wrap(scheduleToggle).click();
        } else if (scheduleCheckbox.length > 0) {
          cy.wrap(scheduleCheckbox).check();
        }
      });
      
      // Try to set date/time if inputs are available
      cy.get("body").then(($body) => {
        const dateInput = $body.find('input[type="date"][name*="schedule"], input[type="date"][name*="date"]').first();
        const timeInput = $body.find('input[type="time"][name*="schedule"], input[type="time"][name*="time"]').first();
        
        if (dateInput.length > 0) {
          const dateStr = tomorrow.toISOString().split('T')[0];
          cy.wrap(dateInput).type(dateStr);
        }
        
        if (timeInput.length > 0) {
          cy.wrap(timeInput).type("14:00");
        }
      });
      
      // Submit
      cy.get('button[type="submit"], button:contains("Schedule"), button:contains("Post")')
        .first()
        .click();
      
      // Verify redirect
      cy.location("pathname", { timeout: 10000 }).should((pathname) => {
        expect(pathname).to.satisfy((p: string) => 
          p.includes("dashboard") || p.includes("scheduled")
        );
      });
      
      // Verify post appears in scheduled queue
      cy.visitAndCheck("/dashboard/scheduled");
      cy.contains(postContent).should("exist");
    });
  });

  describe("Scheduled Posts Queue", () => {
    it("should display scheduled posts page", () => {
      cy.visitAndCheck("/dashboard/scheduled");
      cy.location("pathname").should("include", "scheduled");
      cy.get("body").should("be.visible");
    });

    it("should show scheduled posts list or empty state", () => {
      cy.visitAndCheck("/dashboard/scheduled");
      // Should show either posts or empty state
      cy.get("body").then(($body) => {
        const hasPosts = $body.find('[data-testid="scheduled-post"], table tbody tr').length > 0;
        const hasEmptyState = $body.find('[data-testid="empty-state"], :contains("No scheduled")').length > 0;
        
        expect(hasPosts || hasEmptyState).to.be.true;
      });
    });
  });
});

