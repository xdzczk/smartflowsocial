import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/features/user/repositories/parent-child-data.server", () => ({
  findUsersForParentChildSearch: vi.fn(),
  findUserByNpubForParentChild: vi.fn(),
  updateUserPendingParentRequestsPush: vi.fn(),
  updateUserPendingParentRequests: vi.fn(),
  findConfirmedChildrenForParent: vi.fn(),
  findPendingChildrenForParent: vi.fn(),
  findPendingParentRequestsForChild: vi.fn(),
  updateUserAcceptChildLink: vi.fn(),
  updateUserRejectChildLink: vi.fn(),
  updateUserUnlinkChild: vi.fn(),
}));

vi.mock("~/lib/nostr-adapter.server", () => ({
  nostrAdapter: {
    decodeNpub: vi.fn(),
  },
}));

vi.mock("~/lib/error-logger.server", () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
}));

import { findUsersForParentChildSearch } from "~/features/user/repositories/parent-child-data.server";
import { searchUsersByProfileName } from "~/features/user/services/parent-child.server";
import { nostrAdapter } from "~/lib/nostr-adapter.server";

describe("searchUsersByProfileName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nostrAdapter.decodeNpub).mockReturnValue(null);
  });

  it("matches npub input by decoding it to hex", async () => {
    const hex = "a".repeat(64);
    vi.mocked(nostrAdapter.decodeNpub).mockReturnValue(hex);
    vi.mocked(findUsersForParentChildSearch).mockResolvedValue([
      {
        id: "u1",
        npub: hex,
        nostrProfile: null,
        isChild: false,
        parentNpub: null,
        pendingParentRequests: [],
      },
    ]);

    const results = await searchUsersByProfileName("npub1example");

    expect(findUsersForParentChildSearch).toHaveBeenCalledWith(
      undefined,
      hex,
      200
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.npub).toBe(hex);
  });

  it("matches profile name when nostrProfile is a JSON string", async () => {
    vi.mocked(findUsersForParentChildSearch).mockResolvedValue([
      {
        id: "u2",
        npub: "b".repeat(64),
        nostrProfile: JSON.stringify({
          name: "Alice",
          display_name: "Alice Display",
          picture: "https://example.com/alice.png",
        }),
        isChild: false,
        parentNpub: null,
        pendingParentRequests: [],
      },
    ]);

    const results = await searchUsersByProfileName("alice");

    expect(results).toHaveLength(1);
    expect(results[0]?.profileName).toBe("Alice");
    expect(results[0]?.profileDisplayName).toBe("Alice Display");
    expect(results[0]?.profilePicture).toBe("https://example.com/alice.png");
  });
});
