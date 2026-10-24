import { describe, expect, it } from "vitest";

import { signedFollowUpPersistence } from "~/features/posts/scheduling/signed-follow-up";

describe("signedFollowUpPersistence", () => {
  it("marks a signed follow-up event as signed", () => {
    expect(
      signedFollowUpPersistence({
        id: "event-repost-1",
        sig: "sig",
        kind: 6,
      })
    ).toEqual({
      signingState: "signed",
      signedChildEventId: "event-repost-1",
    });
  });

  it("returns null when the event has no id", () => {
    expect(signedFollowUpPersistence({ sig: "sig" })).toBeNull();
    expect(signedFollowUpPersistence(null)).toBeNull();
    expect(signedFollowUpPersistence("event-repost-1")).toBeNull();
  });
});
