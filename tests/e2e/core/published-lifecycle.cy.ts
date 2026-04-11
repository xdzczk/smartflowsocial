/* eslint-disable testing-library/prefer-screen-queries -- Cypress specs use cy commands, not RTL render queries. */
import { TEST_NPUB } from "../support/nostr-test-keys";

function seedPostedPost(caption: string): Cypress.Chainable<string> {
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
      `npx tsx ./tests/e2e/support/create-posted-post.ts "${TEST_NPUB}" "${caption}"`,
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
      expect(postId, "seeded posted postId").to.be.a("string").and.not.empty;
      return postId as string;
    });
}

describe("Core: Published lifecycle", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser({ npub: TEST_NPUB });
  });

  it("loads published page and shows seeded posted row", () => {
    const caption = `e2e-pub-${Date.now().toString().slice(-6)}`;
    seedPostedPost(caption).then(() => {
      cy.visitAndCheck("/dashboard/published");
      cy.assertPathname("/dashboard/published");
      cy.getByTestId("published-type-segments").should("be.visible");
      cy.contains(caption, { timeout: 20000 }).should("be.visible");
    });
  });

  it("deletes posted row via published action endpoint", () => {
    const caption = `e2e-del-pub-${Date.now().toString().slice(-6)}`;
    seedPostedPost(caption).then((postId) => {
      cy.request({
        method: "POST",
        url: "/dashboard/published",
        form: true,
        body: {
          _action: "delete",
          postId,
        },
      })
        .its("status")
        .should("be.oneOf", [200, 302]);

      cy.visitAndCheck("/dashboard/published");
      cy.contains(caption).should("not.exist");
    });
  });
});
/* eslint-enable testing-library/prefer-screen-queries */
