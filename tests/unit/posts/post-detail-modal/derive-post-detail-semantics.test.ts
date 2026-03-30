import { describe, expect, it } from "vitest";

import {
  derivePostDetailSemantics,
  getPrimaryContentTypeLabel,
  isQuoteLikeKind1,
  partitionTags,
  shouldUseUltraCompactLayout,
} from "~/features/posts/components/post-detail-modal/derive-post-detail-semantics";
import type { PostDetailModalPost } from "~/features/posts/components/post-detail-modal/post-detail-helpers";

const baseArgs = {
  type: "published" as const,
  nip88PollsEnabled: false,
  layoutVariant: "text" as const,
};

describe("derivePostDetailSemantics", () => {
  it("kind 6 → repost", () => {
    const post = {
      id: "x",
      fileUrl: [],
      repost: true,
      signedEvent: {
        id: "a",
        pubkey: "p",
        created_at: 1,
        kind: 6,
        content: "",
        tags: [
          ["e", "sourceeventid", "wss://r.test"],
          ["p", "pk"],
        ],
        sig: "s",
      },
    } as unknown as PostDetailModalPost;
    const r = derivePostDetailSemantics({
      post,
      ...baseArgs,
    });
    expect(r.relationshipType).toBe("repost");
    expect(r.repostedEventId).toBe("sourceeventid");
    expect(r.relationshipChipLabel).toBe("Repost");
  });

  it("postKind REPOST → repost", () => {
    const post = {
      id: "x",
      fileUrl: [],
      postKind: "REPOST",
      repostOfPostId: "orig",
    } as unknown as PostDetailModalPost;
    const r = derivePostDetailSemantics({
      post,
      ...baseArgs,
    });
    expect(r.relationshipType).toBe("repost");
  });

  it("quoteOfPostId → quote", () => {
    const post = {
      id: "x",
      fileUrl: [],
      postKind: "POST",
      quoteOfPostId: "q1",
    } as unknown as PostDetailModalPost;
    const r = derivePostDetailSemantics({
      post,
      ...baseArgs,
    });
    expect(r.relationshipType).toBe("quote");
    expect(r.relationshipChipLabel).toBe("Quote");
  });

  it("kind 1 mention + nostr:nevent in content → quote", () => {
    const post = {
      id: "x",
      fileUrl: [],
      signedEvent: {
        id: "a",
        pubkey: "p",
        created_at: 1,
        kind: 1,
        content: "my take\nnostr:nevent1qabc",
        tags: [
          ["e", "quotedid", "wss://r", "mention"],
          ["p", "authorpk"],
        ],
        sig: "s",
      },
    } as unknown as PostDetailModalPost;
    const r = derivePostDetailSemantics({
      post,
      ...baseArgs,
    });
    expect(r.relationshipType).toBe("quote");
    expect(r.quotedEventId).toBe("quotedid");
  });

  it("replyToEventId → reply", () => {
    const post = {
      id: "x",
      fileUrl: [],
      postKind: "REPLY",
      replyToEventId: "parentid",
    } as unknown as PostDetailModalPost;
    const r = derivePostDetailSemantics({
      post,
      ...baseArgs,
    });
    expect(r.relationshipType).toBe("reply");
    expect(r.parentEventId).toBe("parentid");
  });

  it("threadGroupId → thread_item", () => {
    const post = {
      id: "x",
      fileUrl: [],
      postKind: "POST",
      threadGroupId: "g1",
    } as unknown as PostDetailModalPost;
    const r = derivePostDetailSemantics({
      post,
      ...baseArgs,
    });
    expect(r.relationshipType).toBe("thread_item");
  });

  it("layoutVariant thread → thread_item", () => {
    const post = {
      id: "x",
      fileUrl: [],
      postKind: "POST",
    } as unknown as PostDetailModalPost;
    const r = derivePostDetailSemantics({
      post,
      ...baseArgs,
      layoutVariant: "thread",
    });
    expect(r.relationshipType).toBe("thread_item");
  });

  it("plain post → original", () => {
    const post = {
      id: "x",
      fileUrl: [],
      postKind: "POST",
      content: "hello world",
    } as unknown as PostDetailModalPost;
    const r = derivePostDetailSemantics({
      post,
      ...baseArgs,
    });
    expect(r.relationshipType).toBe("original");
    expect(r.relationshipChipLabel).toBeNull();
  });
});

describe("isQuoteLikeKind1", () => {
  it("requires mention marker and nostr ref in content", () => {
    expect(
      isQuoteLikeKind1({ content: "x nostr:note1abc", tags: [] }, [
        "e",
        "id",
        "",
        "mention",
      ])
    ).toBe(true);
    expect(
      isQuoteLikeKind1({ content: "no ref", tags: [] }, [
        "e",
        "id",
        "",
        "mention",
      ])
    ).toBe(false);
    expect(
      isQuoteLikeKind1({ content: "nostr:note1abc", tags: [] }, [
        "e",
        "id",
        "",
        "reply",
      ])
    ).toBe(false);
  });
});

describe("getPrimaryContentTypeLabel", () => {
  it("returns Poll for poll inner variant", () => {
    expect(getPrimaryContentTypeLabel({ innerVariant: "poll" })).toBe("Poll");
  });
  it("returns Post for text", () => {
    expect(getPrimaryContentTypeLabel({ innerVariant: "text" })).toBe("Post");
  });
});

describe("shouldUseUltraCompactLayout", () => {
  it("true for short original text post", () => {
    const post = {
      id: "x",
      fileUrl: [],
      content: "IKR",
    } as unknown as PostDetailModalPost;
    expect(
      shouldUseUltraCompactLayout({
        relationshipType: "original",
        innerVariant: "text",
        layoutVariant: "text",
        post,
        nip88PollsEnabled: false,
        type: "published",
      })
    ).toBe(true);
  });

  it("false when text too long", () => {
    const post = {
      id: "x",
      fileUrl: [],
      content: "x".repeat(200),
    } as unknown as PostDetailModalPost;
    expect(
      shouldUseUltraCompactLayout({
        relationshipType: "original",
        innerVariant: "text",
        layoutVariant: "text",
        post,
        nip88PollsEnabled: false,
        type: "published",
      })
    ).toBe(false);
  });

  it("false for reply", () => {
    const post = {
      id: "x",
      fileUrl: [],
      content: "hi",
    } as unknown as PostDetailModalPost;
    expect(
      shouldUseUltraCompactLayout({
        relationshipType: "reply",
        innerVariant: "text",
        layoutVariant: "text",
        post,
        nip88PollsEnabled: false,
        type: "published",
      })
    ).toBe(false);
  });
});

describe("partitionTags", () => {
  it("splits technical vs user", () => {
    const { userTags, technicalTags } = partitionTags([
      "nostr",
      "a".repeat(50),
      "client_internal",
    ]);
    expect(userTags).toEqual(["nostr"]);
    expect(technicalTags.length).toBe(2);
  });
});
