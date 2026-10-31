export type NotePerformanceStatus =
  | "not_collected"
  | "missing"
  | "zero"
  | "counts";

export interface LatestCounts {
  missingFromIndex: boolean;
  reactionCount: number | null;
  replyCount: number | null;
  repostCount: number | null;
  zapCount: number | null;
  zapMsats: bigint | null;
}

export function notePerformanceStatus(
  latest: LatestCounts | null
): NotePerformanceStatus {
  if (!latest) return "not_collected";
  if (latest.missingFromIndex) return "missing";
  if (
    latest.reactionCount === null ||
    latest.replyCount === null ||
    latest.repostCount === null ||
    latest.zapCount === null ||
    latest.zapMsats === null
  ) {
    return "not_collected";
  }
  if (
    latest.reactionCount === 0 &&
    latest.replyCount === 0 &&
    latest.repostCount === 0 &&
    latest.zapCount === 0 &&
    latest.zapMsats === 0n
  ) {
    return "zero";
  }
  return "counts";
}
