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
});
/* eslint-enable testing-library/prefer-screen-queries */
