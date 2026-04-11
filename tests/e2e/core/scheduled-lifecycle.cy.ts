import { TEST_NPUB } from "../support/nostr-test-keys";

function seedScheduledPost(caption: string): Cypress.Chainable<string> {
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

  return cy
    .exec(
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
    )
    .then(({ stdout }) => {
      const postId = stdout
        .match(/<postId>\s*([^<]+)\s*<\/postId>/s)?.[1]
        ?.trim();
      expect(postId, "seeded scheduled postId").to.be.a("string").and.not.empty;
      return postId as string;
    });
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

    seedScheduledPost(caption).then((postId) => {
      cy.visitAndCheck(
        `/dashboard/compose?type=post&mode=edit_scheduled&id=${encodeURIComponent(postId)}`
      );
      cy.assertPathname("/dashboard/compose");
      cy.location("search").should("include", "mode=edit_scheduled");
      cy.location("search").should("include", `id=${postId}`);
    });
  });

  it("shows reschedule action entry point for scheduled post", () => {
    const caption = `e2e-res-${Date.now().toString().slice(-6)}`;

    seedScheduledPost(caption).then(() => {
      cy.visitAndCheck("/dashboard/scheduled");
      cy.contains("tr", caption, { timeout: 20000 }).within(() => {
        cy.get('button[aria-label="Actions"]').should("be.visible");
      });
    });
  });

  it("moves scheduled post to drafts", () => {
    const caption = `e2e-draft-${Date.now().toString().slice(-6)}`;

    seedScheduledPost(caption).then((postId) => {
      cy.request({
        method: "POST",
        url: "/dashboard/scheduled",
        form: true,
        body: {
          _action: "moveToDraft",
          postId,
          type: "post",
        },
      })
        .its("status")
        .should("be.oneOf", [200, 302]);

      cy.visitAndCheck("/dashboard/drafts");
      cy.contains(caption, { timeout: 20000 }).should("be.visible");
    });
  });

  it("deletes scheduled post from actions", () => {
    const caption = `e2e-del-${Date.now().toString().slice(-6)}`;

    seedScheduledPost(caption).then((postId) => {
      cy.request({
        method: "POST",
        url: "/dashboard/scheduled",
        form: true,
        body: {
          _action: "delete",
          postId,
        },
      })
        .its("status")
        .should("be.oneOf", [200, 302]);

      cy.visitAndCheck("/dashboard/scheduled");
      cy.contains("tr", caption, { timeout: 20000 }).should("not.exist");
    });
  });
});
