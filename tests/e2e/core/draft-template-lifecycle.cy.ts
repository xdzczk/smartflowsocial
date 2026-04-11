import { TEST_NPUB } from "../support/nostr-test-keys";

function seedDraftPost(caption: string): Cypress.Chainable<string> {
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
      `npx tsx ./tests/e2e/support/create-draft-post.ts "${TEST_NPUB}" "${caption}"`,
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
      expect(postId, "seeded draft postId").to.be.a("string").and.not.empty;
      return postId as string;
    });
}

function openDraftsPageAndAssertRow(caption: string) {
  cy.visitAndCheck("/dashboard/drafts");
  cy.assertPathname("/dashboard/drafts");
  cy.contains(caption, { timeout: 20000 }).should("be.visible");
}

describe("Core: Draft + Template lifecycle", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser({ npub: TEST_NPUB });
  });

  it("shows seeded draft on drafts page and opens edit route", () => {
    const caption = `e2e-draft-${Date.now().toString().slice(-6)}`;
    seedDraftPost(caption).then((draftId) => {
      openDraftsPageAndAssertRow(caption);
      cy.visitAndCheck(
        `/dashboard/compose?type=post&draftId=${encodeURIComponent(draftId)}`
      );
      cy.assertPathname("/dashboard/compose");
      cy.location("search").should("include", `draftId=${draftId}`);
      cy.get("main", { timeout: 20000 }).should("be.visible");
    });
  });

  it("deletes draft via drafts action endpoint", () => {
    const caption = `e2e-del-draft-${Date.now().toString().slice(-6)}`;
    seedDraftPost(caption).then((draftId) => {
      cy.request({
        method: "POST",
        url: "/dashboard/drafts",
        form: true,
        body: {
          _action: "delete",
          postId: draftId,
        },
      })
        .its("status")
        .should("be.oneOf", [200, 302]);

      cy.visitAndCheck("/dashboard/drafts");
      cy.contains(caption).should("not.exist");
    });
  });

  it("converts draft to template via drafts action endpoint", () => {
    const caption = `e2e-tmpl-src-${Date.now().toString().slice(-6)}`;
    const templateName = `E2E Template ${Date.now().toString().slice(-6)}`;

    seedDraftPost(caption).then((draftId) => {
      cy.request({
        method: "POST",
        url: "/dashboard/drafts",
        form: true,
        body: {
          _action: "convertDraftToTemplate",
          postId: draftId,
          templateName,
        },
      })
        .its("status")
        .should("be.oneOf", [200, 302]);

      cy.visitAndCheck("/dashboard/templates");
      cy.assertPathname("/dashboard/templates");
      cy.contains(templateName, { timeout: 20000 }).should("be.visible");
    });
  });
});
