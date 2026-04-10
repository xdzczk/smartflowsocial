import { describe, expect, it } from "vitest";

import { pollQuestionForSignedEvent } from "~/features/posts/composer/components/poll-composer/poll-composer-utils";

describe("pollQuestionForSignedEvent", () => {
  it("prefixes tags with # when appending to poll question body", () => {
    expect(
      pollQuestionForSignedEvent("How do you post?", "nostr asknostr", true)
    ).toBe("How do you post?\n#nostr #asknostr");
  });

  it("normalizes mixed # inputs when appending tags to body", () => {
    expect(pollQuestionForSignedEvent("Q", "#nostr asknostr #zap", true)).toBe(
      "Q\n#nostr #asknostr #zap"
    );
  });

  it("does not append tags when hidden tags is enabled", () => {
    expect(pollQuestionForSignedEvent("Q", "nostr asknostr", false)).toBe("Q");
  });
});
