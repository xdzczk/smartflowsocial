import { describe, expect, it } from "vitest";

import { looksSpammyMessage } from "~/features/broadcast/broadcast-guardrails.server";

describe("broadcast-guardrails", () => {
  it("flags heavy word repetition", () => {
    const body =
      "hello world foo bar spam spam spam spam spam spam extra words here";
    expect(looksSpammyMessage(body)).toBe(true);
  });

  it("allows normal prose", () => {
    expect(
      looksSpammyMessage(
        "Quick update: we shipped a fix for the relay picker. Thanks for the feedback."
      )
    ).toBe(false);
  });
});
