import { TEST_NPUB } from "../support/nostr-test-keys";

describe("Smoke: Dashboard Shell", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
    cy.visitAndCheck("/dashboard");
  });

  afterEach(() => {
    cy.cleanupNostrUser({ npub: TEST_NPUB });
  });

  it("shows core dashboard navigation links", () => {
    cy.get('a[href*="/dashboard/compose"]').should("exist");
    cy.get('a[href*="/dashboard/drafts"]').should("exist");
    cy.get('a[href*="/dashboard/scheduled"]').should("exist");
    cy.get('a[href*="/dashboard/templates"]').should("exist");
    cy.get('a[href*="/dashboard/settings"]').should("exist");
  });

  it("loads dashboard data container", () => {
    cy.get("main").should("be.visible");
    cy.location("pathname").should("include", "/dashboard");
    cy.get("body").should("be.visible");
  });
});
