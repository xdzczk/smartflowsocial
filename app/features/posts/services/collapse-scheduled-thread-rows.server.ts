/**
 * Scheduled thread segments share `threadGroupId`. Dashboard aggregates should count
 * each thread once (the earliest scheduled segment), matching calendar behavior.
 */

export interface ScheduledRowForThreadCollapse {
  id: string;
  scheduledAtUtc: Date | null;
  threadGroupId: string | null;
}

/**
 * Returns one row per thread group (earliest `scheduledAtUtc`, tie-break by id) plus
 * every row with no `threadGroupId`.
 */
export function pickRepresentativeScheduledRows<
  T extends ScheduledRowForThreadCollapse,
>(rows: T[]): T[] {
  const byGroup = new Map<string, T[]>();
  const standalone: T[] = [];

  for (const row of rows) {
    const gid = row.threadGroupId;
    if (typeof gid === "string" && gid.length > 0) {
      const arr = byGroup.get(gid) ?? [];
      arr.push(row);
      byGroup.set(gid, arr);
    } else {
      standalone.push(row);
    }
  }

  const out: T[] = [...standalone];

  for (const [, group] of byGroup) {
    if (group.length === 1) {
      out.push(group[0]!);
      continue;
    }
    let best: T | null = null;
    let bestMs = Infinity;
    for (const r of group) {
      const t = r.scheduledAtUtc?.getTime();
      if (t == null || Number.isNaN(t)) continue;
      if (best === null || t < bestMs || (t === bestMs && r.id < best.id)) {
        bestMs = t;
        best = r;
      }
    }
    out.push(best ?? [...group].sort((a, b) => a.id.localeCompare(b.id))[0]!);
  }

  return out;
}
