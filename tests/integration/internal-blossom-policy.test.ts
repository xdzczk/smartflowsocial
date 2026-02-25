import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/env.server", () => ({
  env: {
    BLOSSOM_INTERNAL_SECRET: "secret",
  },
}));

vi.mock("~/features/user", () => ({
  getUserByNpub: vi.fn(),
}));

vi.mock("~/features/payments", () => ({
  isSubscriptionActiveForGating: vi.fn(),
  getSubscriptionData: vi.fn(),
}));

vi.mock("~/lib/nostr-adapter.server", () => ({
  nostrAdapter: {
    encodeNpub: vi.fn().mockReturnValue(null),
  },
}));

import { isSubscriptionActiveForGating } from "~/features/payments";
import { getSubscriptionData } from "~/features/payments";
import { getUserByNpub } from "~/features/user";
import { loader } from "~/routes/internal.blossom.policy";

describe("GET /internal/blossom/policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getUserByNpub as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "user-1",
      isEnabled: true,
    });
    (
      isSubscriptionActiveForGating as ReturnType<typeof vi.fn>
    ).mockResolvedValue(true);
    (getSubscriptionData as ReturnType<typeof vi.fn>).mockResolvedValue({
      currentSubscription: { planId: "premium" },
    });
  });

  it("returns 401 for invalid secret", async () => {
    const request = new Request("http://localhost/internal/blossom/policy", {
      headers: { "x-internal-secret": "wrong" },
    });
    const response = await loader({ request, params: {}, context: {} });
    expect(response.status).toBe(401);
  });

  it("disables compat for free plan", async () => {
    (getSubscriptionData as ReturnType<typeof vi.fn>).mockResolvedValue({
      currentSubscription: { planId: "free" },
    });
    const request = new Request(
      "http://localhost/internal/blossom/policy?pubkey=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      {
        headers: { "x-internal-secret": "secret" },
      }
    );
    const response = await loader({ request, params: {}, context: {} });
    const data = (await response.json()) as { allowCompatUpload?: boolean };
    expect(response.status).toBe(200);
    expect(data.allowCompatUpload).toBe(false);
  });

  it("allows compat for paid active plan", async () => {
    (getSubscriptionData as ReturnType<typeof vi.fn>).mockResolvedValue({
      currentSubscription: { planId: "pro" },
    });
    const request = new Request(
      "http://localhost/internal/blossom/policy?pubkey=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      {
        headers: { "x-internal-secret": "secret" },
      }
    );
    const response = await loader({ request, params: {}, context: {} });
    const data = (await response.json()) as { allowCompatUpload?: boolean };
    expect(response.status).toBe(200);
    expect(data.allowCompatUpload).toBe(true);
  });
});
