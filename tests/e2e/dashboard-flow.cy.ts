import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Dashboard Flow View E2E Tests
 *
 * Asserts the dashboard index shows the Flow timeline (past and scheduled posts):
 * - Flow region is present
 * - Empty state or timeline content is visible
 * - Header copy reflects Flow ("Your flow")
 */
describe("Dashboard Flow View", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  it("should show Flow timeline region on dashboard index", () => {
    cy.visitAndCheck("/dashboard");
    cy.location("pathname").should("include", "dashboard");

    // Flow view is either empty state (region "Post timeline") or timeline (region "Post timeline: past and scheduled")
    cy.get(
      '[role="region"][aria-label="Post timeline"], [role="region"][aria-label="Post timeline: past and scheduled"]'
    ).should("exist");
  });

  it("should show Your flow header on dashboard index", () => {
    cy.visitAndCheck("/dashboard");
    cy.contains("h3", "Your flow").should("be.visible");
  });

  it("should show empty state or timeline content", () => {
    cy.visitAndCheck("/dashboard");

    // Either empty state (no posts) or timeline with content
    cy.get("body").then(($body) => {
      const hasEmpty =
        $body.text().includes("No posts yet") &&
        $body.find('a[href*="newpost"]').length > 0;
      const hasTimeline =
        $body.find(
          '[role="region"][aria-label="Post timeline: past and scheduled"]'
        ).length > 0;
      expect(hasEmpty || hasTimeline).to.be.true;
    });
  });
});
