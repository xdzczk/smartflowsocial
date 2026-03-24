import { BroadcastSuppressionReasonCode } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstMock = vi.fn();
const updateMock = vi.fn();
const addSuppressionMock = vi.fn();

vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    broadcastUnsubscribeToken: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

vi.mock(
  "~/features/broadcast/broadcast-actions.server",
  async (importOriginal) => {
    const mod = await importOriginal();
    return {
      ...(mod as Record<string, unknown>),
      addBroadcastSuppression: (...args: unknown[]) =>
        addSuppressionMock(...args),
    };
  }
);

describe("applyUnsubscribeFromRawToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false for malformed token without calling prisma", async () => {
    const { applyUnsubscribeFromRawToken } =
      await import("~/features/broadcast/broadcast-unsubscribe.server");
    expect(await applyUnsubscribeFromRawToken("short")).toBe(false);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("returns false when token not found", async () => {
    const { applyUnsubscribeFromRawToken } =
      await import("~/features/broadcast/broadcast-unsubscribe.server");
    findFirstMock.mockResolvedValue(null);
    const token = "a".repeat(64);
    expect(await applyUnsubscribeFromRawToken(token)).toBe(false);
    expect(addSuppressionMock).not.toHaveBeenCalled();
  });

  it("calls addBroadcastSuppression and marks usedAt", async () => {
    const { applyUnsubscribeFromRawToken } =
      await import("~/features/broadcast/broadcast-unsubscribe.server");
    findFirstMock.mockResolvedValue({
      id: "tok_row",
      usedAt: null,
      expiresAt: null,
      recipient: {
        recipientPubkey: "abcdef",
        campaign: { id: "camp1", userId: "user_z" },
      },
    });
    updateMock.mockResolvedValue({});
    const token = "b".repeat(64);
    expect(await applyUnsubscribeFromRawToken(token)).toBe(true);
    expect(addSuppressionMock).toHaveBeenCalledWith("user_z", "abcdef", {
      reasonCode: BroadcastSuppressionReasonCode.MANUAL_OPT_OUT,
      createdFromCampaignId: "camp1",
    });
    expect(updateMock).toHaveBeenCalled();
    const updateArg = updateMock.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { usedAt: unknown };
    };
    expect(updateArg.where.id).toBe("tok_row");
    expect(updateArg.data.usedAt).toBeInstanceOf(Date);
  });

  it("is idempotent when already used", async () => {
    const { applyUnsubscribeFromRawToken } =
      await import("~/features/broadcast/broadcast-unsubscribe.server");
    findFirstMock.mockResolvedValue({
      id: "tok_row",
      usedAt: new Date(),
      expiresAt: null,
      recipient: {
        recipientPubkey: "abcdef",
        campaign: { id: "camp1", userId: "user_z" },
      },
    });
    const token = "c".repeat(64);
    expect(await applyUnsubscribeFromRawToken(token)).toBe(true);
    expect(addSuppressionMock).toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
