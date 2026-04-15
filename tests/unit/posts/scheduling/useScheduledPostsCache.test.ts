import { describe, expect, it } from "vitest";

import { pruneScheduledQueryData } from "~/features/posts/scheduling/hooks/useScheduledPostsCache";

describe("pruneScheduledQueryData", () => {
  it("removes deleted rows from regular query shape", () => {
    const oldData = {
      posts: [
        { id: "keep-post", caption: "keep" },
        { id: "delete-post", caption: "delete" },
      ],
      longformPosts: [{ id: "delete-longform" }, { id: "keep-longform" }],
      allContent: [{ id: "delete-post" }, { id: "keep-content" }],
    };

    const next = pruneScheduledQueryData(
      oldData,
      new Set(["delete-post", "delete-longform"])
    ) as typeof oldData;

    expect(next.posts.map((row) => row.id)).toEqual(["keep-post"]);
    expect(next.longformPosts.map((row) => row.id)).toEqual(["keep-longform"]);
    expect(next.allContent.map((row) => row.id)).toEqual(["keep-content"]);
  });

  it("removes deleted rows from every page in infinite query shape", () => {
    const oldData = {
      pages: [
        {
          posts: [{ id: "delete-post" }, { id: "keep-post-1" }],
          longformPosts: [{ id: "delete-longform" }, { id: "keep-longform-1" }],
          allContent: [{ id: "delete-post" }, { id: "keep-content-1" }],
        },
        {
          posts: [{ id: "keep-post-2" }, { id: "delete-post" }],
          longformPosts: [{ id: "keep-longform-2" }],
          allContent: [{ id: "keep-content-2" }, { id: "delete-longform" }],
        },
      ],
      pageParams: [1, 2],
    };

    const next = pruneScheduledQueryData(
      oldData,
      new Set(["delete-post", "delete-longform"])
    ) as typeof oldData;

    expect(next.pages[0]?.posts.map((row) => row.id)).toEqual(["keep-post-1"]);
    expect(next.pages[1]?.posts.map((row) => row.id)).toEqual(["keep-post-2"]);
    expect(next.pages[0]?.longformPosts.map((row) => row.id)).toEqual([
      "keep-longform-1",
    ]);
    expect(next.pages[1]?.allContent.map((row) => row.id)).toEqual([
      "keep-content-2",
    ]);
  });

  it("returns non-object values unchanged", () => {
    expect(pruneScheduledQueryData(null, new Set(["id"]))).toBeNull();
    expect(pruneScheduledQueryData("value", new Set(["id"]))).toBe("value");
  });
});
