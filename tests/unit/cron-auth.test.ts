import { describe, expect, it } from "vitest";

import { cronRequestAuthorized } from "~/lib/cron-auth.server";

function requestWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/cron/checksubscription", { headers });
}

describe("cron request auth", () => {
  it("allows the call when no secret is configured", () => {
    expect(cronRequestAuthorized(undefined, undefined)).toBe(true);
  });

  it("rejects a missing request when a secret is configured", () => {
    expect(cronRequestAuthorized(undefined, "secret")).toBe(false);
  });

  it("accepts the secret in either header", () => {
    expect(
      cronRequestAuthorized(
        requestWith({ "x-cron-secret": "secret" }),
        "secret"
      )
    ).toBe(true);
    expect(
      cronRequestAuthorized(
        requestWith({ authorization: "Bearer secret" }),
        "secret"
      )
    ).toBe(true);
  });

  it("rejects a wrong secret", () => {
    expect(
      cronRequestAuthorized(requestWith({ "x-cron-secret": "nope" }), "secret")
    ).toBe(false);
  });
});
