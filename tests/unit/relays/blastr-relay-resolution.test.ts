/**
 * Unit tests for Blastr relay resolution: isBlastrEnabledForUserFromDb
 * and resolveExecutionRelays when blastrRelayEnabled is false.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  user: { findUnique: vi.fn() },
  subscription: { findUnique: vi.fn() },
};

vi.mock("~/lib/prisma.server", () => ({ prisma: mockPrisma }));

describe("isBlastrEnabledForUserFromDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when user has blastrRelayEnabled false even with ACTIVE subscription and enableRelayBlast", async () => {
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      blastrRelayEnabled: false,
    });
    (
      mockPrisma.subscription.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      status: "ACTIVE",
      Plan: { enableRelayBlast: true },
    });

    const { isBlastrEnabledForUserFromDb } =
      await import("~/features/relays/repositories/relay-resolution-data.server");
    const result = await isBlastrEnabledForUserFromDb("user-1");
    expect(result).toBe(false);
  });

  it("returns true when user has blastrRelayEnabled true with ACTIVE subscription and enableRelayBlast", async () => {
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      blastrRelayEnabled: true,
    });
    (
      mockPrisma.subscription.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      status: "ACTIVE",
      Plan: { enableRelayBlast: true },
    });

    const { isBlastrEnabledForUserFromDb } =
      await import("~/features/relays/repositories/relay-resolution-data.server");
    const result = await isBlastrEnabledForUserFromDb("user-1");
    expect(result).toBe(true);
  });

  it("returns false when subscription is not ACTIVE", async () => {
    (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      blastrRelayEnabled: true,
    });
    (
      mockPrisma.subscription.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      status: "CANCELED",
      Plan: { enableRelayBlast: true },
    });

    const { isBlastrEnabledForUserFromDb } =
      await import("~/features/relays/repositories/relay-resolution-data.server");
    const result = await isBlastrEnabledForUserFromDb("user-1");
    expect(result).toBe(false);
  });
});
