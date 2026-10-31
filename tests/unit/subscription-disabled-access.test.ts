import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/features/payments/data", () => ({
  ensureUserHasFreePlan: vi.fn(),
  getUserSubscription: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
}));

import {
  ensureUserHasFreePlan,
  getUserSubscription,
} from "~/features/payments/data";
import {
  requireAnySubscription,
  requireDashboardSubscriptionContext,
} from "~/features/payments/subscriptions.server";
import { getUserById } from "~/features/user";

describe("disabled accounts can open the dashboard", () => {
  beforeEach(() => {
    vi.mocked(ensureUserHasFreePlan).mockReset();
    vi.mocked(ensureUserHasFreePlan).mockResolvedValue(undefined);
    vi.mocked(getUserSubscription).mockReset();
    vi.mocked(getUserSubscription).mockResolvedValue(null);
    vi.mocked(getUserById).mockReset();
    vi.mocked(getUserById).mockResolvedValue({
      id: "user-1",
      isEnabled: false,
      npub: "npub1example",
      nwcEnabled: false,
      encryptedNwc: null,
    } as unknown as Awaited<ReturnType<typeof getUserById>>);
  });

  it("does not redirect a disabled user away from the dashboard", async () => {
    await expect(
      requireDashboardSubscriptionContext("user-1")
    ).resolves.toMatchObject({
      user: { id: "user-1", isEnabled: false },
    });
  });

  it("does not redirect a disabled user who only needs a subscription record", async () => {
    await expect(requireAnySubscription("user-1")).resolves.toBeUndefined();
    expect(ensureUserHasFreePlan).toHaveBeenCalledWith("user-1");
  });
});
