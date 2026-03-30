/**
 * Integration tests for GET /api/posts/thread-group
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/features/auth", () => ({
  requireUserId: vi.fn(() => Promise.resolve("user-1")),
}));

const mockGetSegments = vi.fn();
vi.mock("~/features/posts/server", () => ({
  getThreadGroupSegmentsForUser: (...args: unknown[]) =>
    mockGetSegments(...args),
}));

import { requireUserId } from "~/features/auth";
import { loader } from "~/routes/api.posts.thread-group";

const loaderArgs = {
  params: {},
  context: {},
} as const;

describe("API: posts thread-group", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when groupId missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/posts/thread-group?postId=p1"
    );
    const response = await loader({ request, ...loaderArgs });
    expect(response.status).toBe(400);
  });

  it("returns 400 when postId missing", async () => {
    const request = new Request(
      "http://localhost:3000/api/posts/thread-group?groupId=g1"
    );
    const response = await loader({ request, ...loaderArgs });
    expect(response.status).toBe(400);
  });

  it("returns segments JSON when loader succeeds", async () => {
    mockGetSegments.mockResolvedValue({
      segments: [
        {
          id: "p1",
          position: 1,
          previewText: "Hello",
          hasMedia: false,
        },
      ],
      currentIndex: 0,
    });

    const request = new Request(
      "http://localhost:3000/api/posts/thread-group?groupId=g1&postId=p1"
    );
    const response = await loader({ request, ...loaderArgs });
    expect(requireUserId).toHaveBeenCalled();
    expect(mockGetSegments).toHaveBeenCalledWith("user-1", "g1", "p1");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      segments: unknown[];
      currentIndex: number;
      total: number;
    };
    expect(body.segments).toHaveLength(1);
    expect(body.currentIndex).toBe(0);
    expect(body.total).toBe(1);
  });
});
