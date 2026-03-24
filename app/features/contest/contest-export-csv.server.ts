/**
 * Build CSV for contest entries / winners (for export from dashboard).
 */

import type { ContestDetailPageData } from "./contest-detail.types";

export function buildContestEntriesCsv(data: ContestDetailPageData): string {
  const lines: string[] = [
    "rank,authorPubkey,entryEventId,score,rewardSats,isAlternate,replySnippet",
  ];
  for (const w of data.winners) {
    lines.push(
      [
        String(w.rank),
        w.authorPubkey,
        w.entryEventId,
        String(w.score),
        String(w.rewardSats),
        w.isAlternate ? "yes" : "no",
        `"${(w.replySnippet ?? "").replace(/"/g, '""')}"`,
      ].join(",")
    );
  }
  return lines.join("\n");
}
