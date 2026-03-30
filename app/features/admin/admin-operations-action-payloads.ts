export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function readActionError(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const e = data["error"];
  return typeof e === "string" ? e : null;
}

export function readCleanFailedPayload(
  data: unknown
): { total: number; byQueue: Record<string, number> } | null {
  if (!isRecord(data)) return null;
  const cf = data["cleanFailed"];
  if (!isRecord(cf)) return null;
  const total = cf["total"];
  const byQueueRaw = cf["byQueue"];
  if (typeof total !== "number" || !isRecord(byQueueRaw)) return null;
  const byQueue: Record<string, number> = {};
  for (const [k, v] of Object.entries(byQueueRaw)) {
    if (typeof v !== "number") return null;
    byQueue[k] = v;
  }
  return { total, byQueue };
}

export function readPurgeRelayAckPayload(data: unknown): {
  deletedCount: number;
  cutoffIso: string;
  olderThanDays: number;
} | null {
  if (!isRecord(data)) return null;
  const pr = data["purgeRelayAcks"];
  if (!isRecord(pr)) return null;
  const deletedCount = pr["deletedCount"];
  const cutoffIso = pr["cutoffIso"];
  const olderThanDays = pr["olderThanDays"];
  if (
    typeof deletedCount !== "number" ||
    typeof cutoffIso !== "string" ||
    typeof olderThanDays !== "number"
  ) {
    return null;
  }
  return { deletedCount, cutoffIso, olderThanDays };
}
