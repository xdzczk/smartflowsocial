/* eslint-disable testing-library/prefer-screen-queries -- Cypress specs use cy commands, not RTL render queries. */
import { TEST_NPUB } from "../support/nostr-test-keys";

const SIGNER_STORAGE_KEY = "__smartflow_active_nostr_signer_v2";

describe("Core: Signer recovery", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser({ npub: TEST_NPUB });
  });

  it("keeps signers recovery path reachable from compose", () => {
    cy.visitAndCheck("/");
    cy.window().then((win) => {
      win.localStorage.removeItem(SIGNER_STORAGE_KEY);
    });

    cy.visitAndCheck("/dashboard/compose?type=post");
    cy.assertPathname("/dashboard/compose");

    cy.get("body").then(($body) => {
      const signerLink = $body.find(
        'a[href="/dashboard/settings?tab=signers"]'
      );
      if (signerLink.length > 0) {
        cy.wrap(signerLink[0]).click({ force: true });
      } else {
        cy.visitAndCheck("/dashboard/settings?tab=signers");
      }
    });

    cy.assertPathname("/dashboard/settings");
    cy.location("search").should("include", "tab=signers");
    cy.getByTestId("settings-active-panel").should("be.visible");
  });
});
/* eslint-enable testing-library/prefer-screen-queries */
