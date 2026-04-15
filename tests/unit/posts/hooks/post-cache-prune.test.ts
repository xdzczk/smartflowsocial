import { describe, expect, it } from "vitest";

import { prunePostListQueryData } from "~/features/posts/hooks/post-cache-prune";

describe("prunePostListQueryData", () => {
  it("prunes deleted ids from regular query payload arrays", () => {
    const oldData = {
      posts: [{ id: "remove-1" }, { id: "keep-1" }],
      longformPosts: [{ id: "keep-2" }, { id: "remove-2" }],
      allContent: [{ id: "remove-1" }, { id: "keep-3" }],
      scheduledPosts: [{ id: "remove-2" }, { id: "keep-4" }],
    };

    const next = prunePostListQueryData(
      oldData,
      new Set(["remove-1", "remove-2"])
    ) as typeof oldData;

    expect(next.posts.map((row) => row.id)).toEqual(["keep-1"]);
    expect(next.longformPosts.map((row) => row.id)).toEqual(["keep-2"]);
    expect(next.allContent.map((row) => row.id)).toEqual(["keep-3"]);
    expect(next.scheduledPosts.map((row) => row.id)).toEqual(["keep-4"]);
  });

  it("prunes deleted ids across paginated payload pages", () => {
    const oldData = {
      pages: [
        {
          posts: [{ id: "remove-1" }, { id: "keep-1" }],
          longformPosts: [{ id: "keep-2" }],
          allContent: [{ id: "remove-1" }, { id: "keep-3" }],
        },
        {
          scheduledPosts: [{ id: "remove-2" }, { id: "keep-4" }],
          posts: [{ id: "keep-5" }],
          longformPosts: [{ id: "remove-2" }],
          allContent: [{ id: "keep-6" }],
        },
      ],
      pageParams: [1, 2],
    };

    const next = prunePostListQueryData(
      oldData,
      new Set(["remove-1", "remove-2"])
    ) as typeof oldData;

    expect(next.pages[0]?.posts.map((row) => row.id)).toEqual(["keep-1"]);
    expect(next.pages[1]?.scheduledPosts?.map((row) => row.id)).toEqual([
      "keep-4",
    ]);
    expect(next.pages[1]?.longformPosts).toEqual([]);
  });
});
