/* eslint-disable testing-library/prefer-screen-queries -- Cypress specs use cy commands, not RTL render queries. */
import { TEST_NPUB } from "../support/nostr-test-keys";

function seedScheduledPost(caption: string) {
  const databaseUrl =
    (Cypress.env("DATABASE_URL") as string | undefined) ??
    process.env["DATABASE_URL"];
  const sessionSecret =
    (Cypress.env("SESSION_SECRET") as string | undefined) ??
    process.env["SESSION_SECRET"];
  const nostrPublisherUrl =
    (Cypress.env("NOSTR_PUBLISHER_URL") as string | undefined) ??
    process.env["NOSTR_PUBLISHER_URL"];
  const redisUrl =
    (Cypress.env("REDIS_URL") as string | undefined) ??
    process.env["REDIS_URL"];

  const nodeEnv =
    typeof process.env["NODE_ENV"] === "string" &&
    process.env["NODE_ENV"].trim() !== ""
      ? process.env["NODE_ENV"]
      : "test";

  return cy.exec(
    `npx tsx ./tests/e2e/support/create-scheduled-post.ts "${TEST_NPUB}" "${caption}"`,
    {
      failOnNonZeroExit: false,
      env: {
        DATABASE_URL: databaseUrl,
        SESSION_SECRET: sessionSecret,
        NOSTR_PUBLISHER_URL: nostrPublisherUrl,
        REDIS_URL: redisUrl,
        ...process.env,
        E2E_TEST: "true",
        NODE_ENV: nodeEnv,
      },
    }
  );
}

function openActionsMenuForCaption(caption: string) {
  cy.contains("tr", caption, { timeout: 20000 }).as("scheduledRow");
  cy.get("@scheduledRow").within(() => {
    cy.get('button[aria-label="Actions"]').click({ force: true });
  });
}

function clickVisibleMenuItem(label: string | RegExp) {
  cy.contains('[role="menuitem"]', label, { timeout: 10000 })
    .should("be.visible")
    .click();
}

describe("Core: Scheduled lifecycle", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser({ npub: TEST_NPUB });
  });

  it("opens edit flow from scheduled actions", () => {
    const caption = `e2e-edit-${Date.now().toString().slice(-6)}`;

    seedScheduledPost(caption);
    cy.visitAndCheck("/dashboard/scheduled");

    openActionsMenuForCaption(caption);
    clickVisibleMenuItem(/^Edit$/);

    cy.assertPathname("/dashboard/compose");
    cy.location("search").should("include", "mode=edit_scheduled");
  });

  it("opens reschedule modal from scheduled actions", () => {
    const caption = `e2e-res-${Date.now().toString().slice(-6)}`;

    seedScheduledPost(caption);
    cy.visitAndCheck("/dashboard/scheduled");

    openActionsMenuForCaption(caption);
    clickVisibleMenuItem(/^Reschedule$/);

    cy.getByTestId("reschedule-modal", { timeout: 20000 }).should("be.visible");
    cy.getByTestId("reschedule-time-section").should("be.visible");
    cy.contains("button", "Confirm reschedule").should("be.visible");
  });

  it("moves scheduled post to drafts", () => {
    const caption = `e2e-draft-${Date.now().toString().slice(-6)}`;

    seedScheduledPost(caption);
    cy.visitAndCheck("/dashboard/scheduled");

    openActionsMenuForCaption(caption);
    clickVisibleMenuItem(/^Move to drafts$/);

    cy.visitAndCheck("/dashboard/drafts");
    cy.contains(caption, { timeout: 20000 }).should("be.visible");
  });

  it("deletes scheduled post from actions", () => {
    const caption = `e2e-del-${Date.now().toString().slice(-6)}`;

    seedScheduledPost(caption);
    cy.visitAndCheck("/dashboard/scheduled");

    openActionsMenuForCaption(caption);
    clickVisibleMenuItem(/^Delete$/);

    cy.reload();
    cy.contains("tr", caption, { timeout: 20000 }).should("not.exist");
  });
});
/* eslint-enable testing-library/prefer-screen-queries */
