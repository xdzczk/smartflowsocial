import { describe, it, expect } from "vitest";

import {
  collectCandidatesFromPrimalResponses,
  extractDirectRepliesToParent,
  extractDirectRepliesToRoot,
  getEvId,
  replyEtagReferencesTarget,
  replyHasRootEtag,
} from "~/features/search/services/search-thread-replies.server";

describe("search-thread-replies", () => {
  const rootId =
    "d17048466d168d49a0af46ce7fc054f59a797ad0d05e0f95a0241192cd220bff";

  it("extractDirectRepliesToRoot keeps kind 1 with e tag to root, excludes root", () => {
    const replyId =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const candidates = [
      { kind: 1, id: rootId, pubkey: "p".repeat(64), tags: [["e", rootId]] },
      {
        kind: 1,
        id: replyId,
        pubkey: "q".repeat(64),
        content: "hello",
        created_at: 100,
        tags: [["e", rootId]],
      },
      {
        kind: 1,
        id: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        pubkey: "q".repeat(64),
        content: "nested",
        created_at: 200,
        tags: [["e", replyId]],
      },
    ];
    const out = extractDirectRepliesToRoot(candidates, rootId, { max: 10 });
    expect(out).toHaveLength(1);
    expect(getEvId(out[0]!)).toBe(replyId.toLowerCase());
  });

  it("replyHasRootEtag matches case-insensitive hex", () => {
    expect(
      replyHasRootEtag(
        { kind: 1, tags: [["e", rootId.toUpperCase()]] },
        rootId.toLowerCase()
      )
    ).toBe(true);
  });

  it("replyEtagReferencesTarget matches any e tag to parent", () => {
    expect(
      replyEtagReferencesTarget(
        { kind: 1, tags: [["e", "aa".repeat(32)]] },
        "aa".repeat(32)
      )
    ).toBe(true);
  });

  it("extractDirectRepliesToParent returns replies to intermediate note", () => {
    const mid = "bb".repeat(32);
    const childId = "cc".repeat(32);
    const candidates = [
      { kind: 1, id: mid, tags: [["e", rootId]] },
      {
        kind: 1,
        id: childId,
        content: "nested",
        created_at: 1,
        tags: [["e", mid]],
      },
    ];
    const toRoot = extractDirectRepliesToRoot(candidates, rootId);
    expect(toRoot.map((e) => getEvId(e))).toContain(mid.toLowerCase());

    const toMid = extractDirectRepliesToParent(candidates, mid, { max: 20 });
    expect(toMid).toHaveLength(1);
    expect(getEvId(toMid[0]!)).toBe(childId.toLowerCase());
  });

  it("collectCandidatesFromPrimalResponses flattens EVENT tuples", () => {
    const responses = [
      ["EVENT", "sub", { id: rootId, kind: 1, pubkey: "a".repeat(64) }],
    ];
    const c = collectCandidatesFromPrimalResponses(responses);
    expect(c.length).toBeGreaterThanOrEqual(1);
  });
});
