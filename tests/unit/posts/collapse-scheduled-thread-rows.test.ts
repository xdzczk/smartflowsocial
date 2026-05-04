import { describe, it, expect } from "vitest";

import { pickRepresentativeScheduledRows } from "~/features/posts/services/collapse-scheduled-thread-rows.server";

describe("pickRepresentativeScheduledRows", () => {
  it("keeps a single row per threadGroupId (earliest scheduledAtUtc)", () => {
    const t0 = new Date("2025-03-10T10:00:00.000Z");
    const t1 = new Date("2025-03-10T11:00:00.000Z");
    const rows = [
      { id: "b", threadGroupId: "g1", scheduledAtUtc: t1 },
      { id: "a", threadGroupId: "g1", scheduledAtUtc: t0 },
    ];
    const out = pickRepresentativeScheduledRows(rows);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("a");
  });

  it("keeps all rows when threadGroupId is null", () => {
    const t = new Date("2025-03-10T10:00:00.000Z");
    const rows = [
      { id: "x", threadGroupId: null, scheduledAtUtc: t },
      { id: "y", threadGroupId: null, scheduledAtUtc: t },
    ];
    expect(pickRepresentativeScheduledRows(rows)).toHaveLength(2);
  });
});
