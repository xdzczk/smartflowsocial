/* eslint-disable testing-library/prefer-screen-queries -- Cypress specs use cy commands, not React Testing Library render queries. */
import { TEST_NPUB } from "../support/nostr-test-keys";

describe("Core: Drafts", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser({ npub: TEST_NPUB });
  });

  it("loads drafts queue", () => {
    cy.visitAndCheck("/dashboard/drafts");
    cy.assertPathname("/dashboard/drafts");
    cy.getByTestId("drafts-type-segments").should("exist");
  });

  it("shows drafts list or empty state", () => {
    cy.visitAndCheck("/dashboard/drafts");
    cy.get("body", { timeout: 20000 }).should(($body) => {
      const hasDraftRows = $body.find("table tbody tr").length > 0;
      const hasEmptyState =
        $body.find('[data-testid="drafts-empty-state"]').length > 0 ||
        $body.text().toLowerCase().includes("no drafts") ||
        $body.text().toLowerCase().includes("no drafts yet");
      expect(hasDraftRows || hasEmptyState).to.be.true;
    });
  });
});
/* eslint-enable testing-library/prefer-screen-queries */
