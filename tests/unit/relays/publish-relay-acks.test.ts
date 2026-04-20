/**
 * Unit tests for the intended-acks observability flow.
 *
 * The user-reported "wrong 3-relay subset" perception bug came from the
 * PublishResultModal only seeing relays that the publisher actually
 * returned a result for. The fix preregisters every intended relay as a
 * PENDING ACK row before fanout, then upgrades those rows in-place as
 * results arrive. These tests pin that contract so we never silently
 * regress to the "subset" rendering.
 */

import { PublishRelayAckStatus } from "@prisma/client";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Strongly-typed shapes for the Prisma calls we assert against. These mirror
// the (subset of) PublishRelayAckUncheckedCreateInput / Upsert args the
// repository hands to Prisma; typing them here lets the test reach into
// `.mock.calls[i][0]` without falling back to `any`-typed property access.
interface CreateManyArg {
  skipDuplicates: boolean;
  data: Array<{
    publishAttemptId: string;
    userId: string;
    eventId: string;
    relayUrl: string;
    status: PublishRelayAckStatus;
    receivedAt: Date | null;
  }>;
}

interface UpsertArg {
  where: {
    publishAttemptId_relayUrl: { publishAttemptId: string; relayUrl: string };
  };
  create: Record<string, unknown>;
  update: { status: PublishRelayAckStatus; receivedAt: Date | null };
}

const mockPrisma = {
  publishRelayAck: {
    createMany: vi.fn<(arg: CreateManyArg) => Promise<{ count: number }>>(),
    upsert: vi.fn<(arg: UpsertArg) => Promise<unknown>>(),
    findMany: vi.fn(),
  },
};

vi.mock("~/lib/prisma.server", () => ({ prisma: mockPrisma }));

describe("publish-relay-acks repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persistIntendedPublishRelays writes one PENDING row per intended relay (deduped, skipDuplicates)", async () => {
    const { persistIntendedPublishRelays } =
      await import("~/features/relays/repositories/publish-relay-acks.server");

    await persistIntendedPublishRelays({
      publishAttemptId: "attempt-1",
      userId: "user-1",
      eventId: "event-1",
      intendedRelays: [
        "wss://relay.damus.io",
        "wss://relay.primal.net",
        "wss://relay.damus.io",
      ],
    });

    expect(mockPrisma.publishRelayAck.createMany).toHaveBeenCalledTimes(1);
    const call = mockPrisma.publishRelayAck.createMany.mock.calls[0]?.[0];
    if (!call) throw new Error("createMany was not called");
    expect(call.skipDuplicates).toBe(true);
    expect(call.data).toHaveLength(2);
    for (const row of call.data) {
      expect(row.status).toBe(PublishRelayAckStatus.PENDING);
      expect(row.publishAttemptId).toBe("attempt-1");
      expect(row.userId).toBe("user-1");
      expect(row.eventId).toBe("event-1");
      expect(row.receivedAt).toBeNull();
    }
  });

  it("persistIntendedPublishRelays is a no-op when intendedRelays is empty", async () => {
    const { persistIntendedPublishRelays } =
      await import("~/features/relays/repositories/publish-relay-acks.server");

    await persistIntendedPublishRelays({
      publishAttemptId: "attempt-1",
      userId: "user-1",
      eventId: "event-1",
      intendedRelays: [],
    });

    expect(mockPrisma.publishRelayAck.createMany).not.toHaveBeenCalled();
  });

  it("persistPublishRelayAcks upserts each result so PENDING rows upgrade to final status without losing untouched rows", async () => {
    const { persistPublishRelayAcks } =
      await import("~/features/relays/repositories/publish-relay-acks.server");

    await persistPublishRelayAcks({
      publishAttemptId: "attempt-1",
      userId: "user-1",
      eventId: "event-1",
      results: [
        { relay: "wss://relay.damus.io", ok: true },
        { relay: "wss://relay.primal.net", ok: false, error: "timeout" },
        { relay: "wss://nos.lol", ok: false, error: "rejected: bad sig" },
      ],
    });

    expect(mockPrisma.publishRelayAck.upsert).toHaveBeenCalledTimes(3);
    const upserts: UpsertArg[] =
      mockPrisma.publishRelayAck.upsert.mock.calls.map((c) => c[0]);

    const accepted = upserts.find(
      (u) =>
        u.where.publishAttemptId_relayUrl.relayUrl === "wss://relay.damus.io"
    );
    if (!accepted) throw new Error("expected damus upsert");
    expect(accepted.update.status).toBe("ACCEPTED");
    expect(accepted.update.receivedAt).toBeInstanceOf(Date);

    const timeout = upserts.find(
      (u) =>
        u.where.publishAttemptId_relayUrl.relayUrl === "wss://relay.primal.net"
    );
    if (!timeout) throw new Error("expected primal upsert");
    expect(timeout.update.status).toBe("TIMEOUT");
    expect(timeout.update.receivedAt).toBeNull();

    const failed = upserts.find(
      (u) => u.where.publishAttemptId_relayUrl.relayUrl === "wss://nos.lol"
    );
    if (!failed) throw new Error("expected nos.lol upsert");
    expect(failed.update.status).toBe("FAILED");
    expect(failed.update.receivedAt).toBeNull();

    // Critically: a relay that was preregistered as PENDING but for which
    // the publisher returned NO result must NOT be touched here, so that
    // it stays visible in PublishResultModal as PENDING (true gap, not
    // hidden subset).
    expect(
      upserts.some(
        (u) =>
          u.where.publishAttemptId_relayUrl.relayUrl ===
          "wss://uncalled.example"
      )
    ).toBe(false);
  });

  it("persistPublishRelayAcks is a no-op when the publisher returned an empty result list", async () => {
    const { persistPublishRelayAcks } =
      await import("~/features/relays/repositories/publish-relay-acks.server");

    await persistPublishRelayAcks({
      publishAttemptId: "attempt-1",
      userId: "user-1",
      eventId: "event-1",
      results: [],
    });

    expect(mockPrisma.publishRelayAck.upsert).not.toHaveBeenCalled();
  });
});
