import { describe, expect, it } from "vitest";

import {
  buildLongFormKind5DeleteDraft,
  buildPostKind5DeleteDraft,
} from "~/features/nostr/delete-event.server";

describe("nostr delete event builder", () => {
  it("builds kind5 post delete draft with e-tag", () => {
    const draft = buildPostKind5DeleteDraft(
      {
        postId: "post-1",
        userId: "user-1",
        originalEventId: "event-abc",
        originalEventPubkey: "pubkey-abc",
        schemaVersion: "1.0",
      },
      123
    );

    expect(draft).not.toBeNull();
    expect(draft?.expectedPubkey).toBe("pubkey-abc");
    expect(draft?.unsignedEvent).toEqual({
      kind: 5,
      created_at: 123,
      tags: [["e", "event-abc"]],
      content: "Deleted via SmartFlow",
    });
  });

  it("builds kind5 longform delete draft with a-tag and optional e-tag", () => {
    const draft = buildLongFormKind5DeleteDraft(
      {
        postId: "longform-1",
        userId: "user-1",
        aCoordinate: "30023:pubkey-1:article",
        originalEventId: "event-xyz",
        originalEventPubkey: "pubkey-1",
        schemaVersion: "1.0",
      },
      456
    );

    expect(draft).not.toBeNull();
    expect(draft?.expectedPubkey).toBe("pubkey-1");
    expect(draft?.unsignedEvent).toEqual({
      kind: 5,
      created_at: 456,
      tags: [
        ["a", "30023:pubkey-1:article"],
        ["e", "event-xyz"],
      ],
      content: "Deleted via SmartFlow",
    });
  });

  it("returns null when required identifiers are missing", () => {
    const postDraft = buildPostKind5DeleteDraft({
      postId: "post-1",
      userId: "user-1",
      originalEventId: "",
      originalEventPubkey: "pubkey-abc",
      schemaVersion: "1.0",
    });
    const longformDraft = buildLongFormKind5DeleteDraft({
      postId: "longform-1",
      userId: "user-1",
      aCoordinate: "",
      originalEventPubkey: "pubkey-1",
      schemaVersion: "1.0",
    });

    expect(postDraft).toBeNull();
    expect(longformDraft).toBeNull();
  });
});
