import { describe, expect, it } from "vitest";

import {
  normalizeEvent,
  normalizeLoaderResponseData,
} from "~/lib/validation/normalize-loader-response-data";

describe("normalize-loader-response-data", () => {
  it("normalizes event tags from object maps and primitive values", () => {
    expect(normalizeEvent(null)).toBeNull();
    expect(normalizeEvent([])).toEqual([]);

    const normalized = normalizeEvent({
      id: "e1",
      tags: {
        0: { 0: "p", 1: "pubkey" },
        1: ["e", 123],
        other: "x",
      },
    }) as { tags: string[][] };

    expect(normalized.tags).toEqual([
      ["p", "pubkey"],
      ["e", "123"],
    ]);
  });

  it("normalizes known loader event containers and preserves dates", () => {
    const created = new Date("2026-01-01T00:00:00.000Z");
    const input = {
      signedEvent: { tags: { 0: { 0: "p", 1: "a" } }, createdAt: created },
      posts: [
        {
          signedEvent: { tags: [{ 0: "e", 1: "b" }] },
          createdAt: created,
        },
      ],
      flowItems: [
        {
          id: "f1",
          data: {
            nostrEvent: { tags: { 0: ["t", "x"] } },
            createdAt: created,
          },
        },
      ],
    };

    const out = normalizeLoaderResponseData(input) as {
      signedEvent: { tags: string[][]; createdAt: Date };
      posts: Array<{ signedEvent: { tags: string[][] }; createdAt: Date }>;
      flowItems: Array<{
        data: { nostrEvent: { tags: string[][] }; createdAt: Date };
      }>;
    };

    expect(out.signedEvent.tags).toEqual([["p", "a"]]);
    expect(out.posts[0]?.signedEvent.tags).toEqual([["e", "b"]]);
    expect(out.flowItems[0]?.data.nostrEvent.tags).toEqual([["t", "x"]]);
    expect(out.signedEvent.createdAt).toBe(created);
    expect(out.posts[0]?.createdAt).toBe(created);
  });

  it("recurses objects only when they directly include known event keys", () => {
    const out = normalizeLoaderResponseData({
      wrapper: {
        signedEvent: { tags: { 0: { 0: "p", 1: "z" } } },
      },
      untouched: { a: 1 },
    }) as {
      wrapper: { signedEvent: { tags: string[][] } };
      untouched: { a: number };
    };

    expect(out.wrapper.signedEvent.tags).toEqual([["p", "z"]]);
    expect(out.untouched).toEqual({ a: 1 });
  });
});
