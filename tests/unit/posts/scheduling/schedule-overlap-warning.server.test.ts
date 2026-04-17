import { describe, expect, it } from "vitest";

import { buildScheduleOverlapWarning } from "~/features/posts/scheduling/services/schedule-overlap-warning.server";

describe("buildScheduleOverlapWarning", () => {
  it("returns exact-time warning for same queue", () => {
    const target = new Date("2026-04-16T10:00:00.000Z");
    const warning = buildScheduleOverlapWarning({
      targetScheduledAtUtc: target,
      queueTypeId: "queue-a",
      candidates: [
        {
          id: "p-1",
          scheduledAtUtc: new Date("2026-04-16T10:00:20.000Z"),
          queueTypeId: "queue-a",
        },
      ],
    });

    expect(warning).not.toBeNull();
    expect(warning?.overlapsExactly).toBe(true);
    expect(warning?.sameQueue).toBe(true);
    expect(warning?.message).toContain("in this queue");
  });

  it("prefers same-queue near warning when multiple items exist", () => {
    const target = new Date("2026-04-16T10:00:00.000Z");
    const warning = buildScheduleOverlapWarning({
      targetScheduledAtUtc: target,
      queueTypeId: "queue-a",
      proximityMinutes: 15,
      candidates: [
        {
          id: "p-1",
          scheduledAtUtc: new Date("2026-04-16T10:01:00.000Z"),
          queueTypeId: "queue-b",
        },
        {
          id: "p-2",
          scheduledAtUtc: new Date("2026-04-16T10:06:00.000Z"),
          queueTypeId: "queue-a",
        },
      ],
    });

    expect(warning).not.toBeNull();
    expect(warning?.sameQueue).toBe(true);
    expect(warning?.minutesApart).toBe(6);
    expect(warning?.message).toContain("6 min");
    expect(warning?.message).toContain("in this queue");
  });

  it("returns null when no nearby candidates exist", () => {
    const target = new Date("2026-04-16T10:00:00.000Z");
    const warning = buildScheduleOverlapWarning({
      targetScheduledAtUtc: target,
      queueTypeId: "queue-a",
      candidates: [
        {
          id: "p-1",
          scheduledAtUtc: new Date("2026-04-16T12:00:00.000Z"),
          queueTypeId: "queue-a",
        },
      ],
    });

    expect(warning).toBeNull();
  });
});
