/* eslint-disable testing-library/prefer-screen-queries -- Cypress specs use cy commands, not React Testing Library render queries. */
import { TEST_NPUB } from "../support/nostr-test-keys";

describe("Core: Scheduling", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser({ npub: TEST_NPUB });
  });

  it("loads scheduled queue", () => {
    cy.visitAndCheck("/dashboard/scheduled");
    cy.assertPathname("/dashboard/scheduled");
    cy.getByTestId("scheduled-type-segments").should("exist");
  });

  it("loads calendar view", () => {
    cy.visitAndCheck("/dashboard/calendar");
    cy.assertPathname("/dashboard/calendar");
    cy.getByTestId("calendar-view-switcher").should("exist");
    cy.getByTestId("calendar-filter-type").should("exist");
  });

  it("shows premium reschedule modal hierarchy when available", () => {
    cy.visitAndCheck("/dashboard/scheduled");
    cy.assertPathname("/dashboard/scheduled");

    cy.get("body").then(($body) => {
      const rescheduleButtons = $body.find("button:contains('Reschedule')");
      if (rescheduleButtons.length === 0) {
        cy.log("No scheduled rows available for reschedule modal check");
        return;
      }

      cy.wrap(rescheduleButtons[0]).click({ force: true });
      cy.getByTestId("reschedule-modal").should("be.visible");
      cy.getByTestId("reschedule-modal-layout").should("be.visible");
      cy.getByTestId("reschedule-identity-pane").should("be.visible");
      cy.contains("Quick shortcuts").should("be.visible");
      cy.contains("Advanced actions").click();
      cy.contains("Schedule repost").should("be.visible");
      cy.contains("Confirm reschedule").should("be.visible");
    });
  });
});
/* eslint-enable testing-library/prefer-screen-queries */
