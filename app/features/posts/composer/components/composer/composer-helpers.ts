/**
 * Composer UI helpers: schedule time label, relative time, summary line.
 */

export function getScheduleTimeLabel(scheduledForStr: string): string | null {
  const s = scheduledForStr.trim();
  if (!s) return null;
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    const [, timePart] = s.split("T");
    if (!timePart) return null;
    const [h, m] = timePart.split(":");
    const timeStr = `${h ?? "00"}:${m ?? "00"}`;
    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
    return isToday ? `Today ${timeStr}` : timeStr;
  } catch {
    return null;
  }
}

export function getRelativeTime(scheduledForStr: string): string | undefined {
  const s = scheduledForStr.trim();
  if (!s) return;
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return;
    const diffMs = d.getTime() - Date.now();
    if (diffMs < 0) return;
    const diffM = Math.round(diffMs / 60_000);
    const diffH = Math.floor(diffM / 60);
    const m = diffM % 60;
    if (diffH >= 1) return `in ${diffH}h${m > 0 ? ` ${m}m` : ""}`;
    return `in ${diffM} min`;
  } catch {
    return;
  }
}

export function getSummaryLine(
  selectedQueue: string,
  scheduledForStr: string,
  isThreadMode: boolean,
  segmentCount: number,
  threadDelayMinutes: number
): string {
  const queueLabel =
    selectedQueue === "unassigned" ? "No queue" : selectedQueue;
  const s = scheduledForStr.trim();
  const isScheduling = !!s;
  if (isThreadMode) {
    const delay = `${threadDelayMinutes} min`;
    if (isScheduling) {
      return `Will schedule ${segmentCount} segment${segmentCount !== 1 ? "s" : ""} to ${queueLabel}, first at ${s}, then every ${delay}.`;
    }
    return `Will post ${segmentCount} segment${segmentCount !== 1 ? "s" : ""} now to ${queueLabel}, every ${delay}.`;
  }
  if (isScheduling) {
    return `Will schedule to ${queueLabel} at ${s}.`;
  }
  return `Will publish now to ${queueLabel}.`;
}

/** Format scheduled datetime for queue next-slot display (e.g. "Today 14:00" or "Sat 18:00"). */
export function getQueueNextSlotLabel(
  scheduledForStr: string
): string | undefined {
  const s = scheduledForStr.trim();
  if (!s) return;
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return;
    const [, timePart] = s.split("T");
    if (!timePart) return;
    const [h, m] = timePart.split(":");
    const timeStr = `${h ?? ""}:${m ?? "00"}`;
    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
    return isToday
      ? `Today ${timeStr}`
      : `${d.toLocaleDateString(undefined, { weekday: "short" })} ${timeStr}`;
  } catch {
    return;
  }
}
