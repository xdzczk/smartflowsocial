/* eslint-disable testing-library/prefer-screen-queries -- Cypress specs use cy commands, not React Testing Library render queries. */
import { TEST_NPUB } from "../support/nostr-test-keys";

describe("Core: Templates", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser({ npub: TEST_NPUB });
  });

  it("loads templates page", () => {
    cy.visitAndCheck("/dashboard/templates");
    cy.assertPathname("/dashboard/templates");
    cy.getByTestId("templates-type-segments").should("exist");
    cy.contains("h1", "Templates").should("be.visible");
  });

  it("shows templates list or empty state", () => {
    cy.visitAndCheck("/dashboard/templates");
    cy.get("body", { timeout: 20000 }).should(($body) => {
      const hasTemplateRows = $body.find("table tbody tr").length > 0;
      const hasEmptyState =
        $body.find('[data-testid="empty-state"]').length > 0 ||
        $body.find('[data-testid="templates-filtered-empty"]').length > 0 ||
        $body.text().toLowerCase().includes("no templates") ||
        $body.text().toLowerCase().includes("no templates yet");
      expect(hasTemplateRows || hasEmptyState).to.be.true;
    });
  });
});
/* eslint-enable testing-library/prefer-screen-queries */
