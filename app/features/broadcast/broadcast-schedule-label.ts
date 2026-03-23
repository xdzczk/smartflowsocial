/**
 * Schedule chip label aligned with post composer (`getScheduleTimeLabel`).
 * Used for primary CTA text like "Schedule for Today 08:31".
 */
export function getBroadcastScheduleTimeLabel(
  scheduledForStr: string
): string | null {
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
