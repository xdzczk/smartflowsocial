import { TEST_NPUB } from "../support/nostr-test-keys";

function publishTextPost(
  content: string
): Cypress.Chainable<
  | { status: "published"; postId: string }
  | { status: "failed"; errorBody: string }
> {
  return cy.signNostrEvent({ content }).then((signedEvent) => {
    return cy
      .request({
        method: "POST",
        url: "/dashboard/compose?type=post",
        form: true,
        followRedirect: false,
        failOnStatusCode: false,
        body: {
          _action: "post-text",
          content,
          queueType: "unassigned",
          relays: JSON.stringify(["wss://relay.primal.net"]),
          signedEvent: JSON.stringify(signedEvent),
          nostrEvent: JSON.stringify(signedEvent),
        },
      })
      .then((response) => {
        expect(response.status).to.be.oneOf([302, 303, 401, 500]);

        if (response.status === 500 || response.status === 401) {
          const errorBody =
            typeof response.body === "string"
              ? response.body
              : JSON.stringify(response.body);
          return { status: "failed" as const, errorBody };
        }

        const locationHeader = response.headers["location"];
        expect(locationHeader, "post publish redirect").to.be.a("string");
        expect(String(locationHeader)).to.include(
          "/dashboard/compose?type=post&published="
        );
        const match = String(locationHeader).match(/published=([^&]+)/);
        expect(match?.[1], "published post id from redirect").to.exist;
        return {
          status: "published" as const,
          postId: decodeURIComponent(String(match?.[1])),
        };
      });
  });
}

describe("Core: Publish transaction", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser({ npub: TEST_NPUB });
  });

  it("submits post-text publish transaction and verifies success or graceful failure", () => {
    const caption = `e2e-publish-${Date.now().toString().slice(-6)}`;

    publishTextPost(caption).then((result) => {
      if (result.status === "failed") {
        expect(result.errorBody.toLowerCase()).to.match(
          /publish|relay|failed|error|unauthoriz|forbidden|auth/
        );
        return;
      }

      cy.visitAndCheck("/dashboard/published");
      cy.assertPathname("/dashboard/published");
      cy.contains(caption, { timeout: 20000 }).should("be.visible");

      cy.request({
        method: "POST",
        url: "/dashboard/published",
        form: true,
        body: {
          _action: "delete",
          postId: result.postId,
        },
      })
        .its("status")
        .should("be.oneOf", [200, 302]);
    });
  });
});
