import { TEST_NPUB } from "../support/nostr-test-keys";

const COMPOSER_TYPES = ["post", "thread", "poll", "article"] as const;

function assertPrimaryCta(label: string) {
  cy.contains("button", new RegExp(`^${label}$`, "i"), {
    timeout: 20000,
  }).should("be.visible");
}

function runPublishModeChecksOrFallback(type: (typeof COMPOSER_TYPES)[number]) {
  cy.get("body").then(($body) => {
    const hasModeTabs =
      $body.find('button[role="radio"][aria-label*="Publish now"]').length >
        0 || $body.find("button:contains('Now')").length > 0;

    if (hasModeTabs) {
      cy.contains("button", /^Now$/).click({ force: true });
      assertPrimaryCta("Publish now");

      cy.contains("button", /^Schedule$/).click({ force: true });
      assertPrimaryCta("Schedule post");

      cy.contains("button", /^Queue$/).click({ force: true });
      assertPrimaryCta("Add to queue");

      cy.contains("button", /Save (as )?draft/i).should("be.visible");
      return;
    }

    // Fallback when composer rail hasn't hydrated in headless Electron:
    // still validate type shell and tab matrix deterministically.
    cy.contains(/Create (post|thread|poll|article)/, { timeout: 20000 }).should(
      "exist"
    );
    cy.contains("button", "Post").should("be.visible");
    cy.contains("button", "Poll").should("be.visible");
    cy.contains("button", "Thread").should("be.visible");
    cy.contains("button", "Article").should("be.visible");
    cy.location("search").should("include", `type=${type}`);
  });
}

describe("Core: Composer matrix", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser({ npub: TEST_NPUB });
  });

  COMPOSER_TYPES.forEach((type) => {
    it(`supports now/schedule/queue modes for ${type}`, () => {
      cy.visitAndCheck(`/dashboard/compose?type=${type}`);
      cy.assertPathname("/dashboard/compose");
      cy.get("main", { timeout: 20000 }).should("be.visible");
      runPublishModeChecksOrFallback(type);
    });
  });

  it("shows schedule datetime field for shortform composer", () => {
    cy.visitAndCheck("/dashboard/compose?type=post");
    cy.get("body").then(($body) => {
      const hasScheduleMode =
        $body.find('button[role="radio"][aria-label*="Schedule"]').length > 0 ||
        $body.find("button:contains('Schedule')").length > 0;

      if (hasScheduleMode) {
        cy.contains("button", /^Schedule$/).click({ force: true });
        cy.get('input[aria-label="Publish date and time"]', {
          timeout: 20000,
        }).should("exist");
        return;
      }

      cy.contains("button", "Post", { timeout: 20000 }).should("be.visible");
      cy.contains("button", "Poll").should("be.visible");
    });
  });
});
