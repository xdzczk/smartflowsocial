import { satsFromMsats } from "~/features/nostrmash/parse";

import {
  listPerformanceLatest,
  listPerformanceObservations,
  listTrackedAuthorEvents,
} from "./data/post-analytics-store.server";
import { notePerformanceStatus, type NotePerformanceStatus } from "./status";

export interface AnalyticsCountView {
  reactions: number;
  replies: number;
  reposts: number;
  zaps: number;
  sats: number;
}

export interface AnalyticsHistoryPoint extends AnalyticsCountView {
  id: string;
  checkedAt: string;
  missingFromIndex: boolean;
}

export interface AnalyticsNoteView {
  nostrEventId: string;
  kind: number;
  eventCreatedAt: string | null;
  contentExcerpt: string;
  publishedInSmartFlow: boolean;
  status: NotePerformanceStatus;
  counts: AnalyticsCountView | null;
}

export interface PostAnalyticsPageData {
  collectionActive: boolean;
  notes: AnalyticsNoteView[];
  history: {
    nostrEventId: string;
    contentExcerpt: string;
    points: AnalyticsHistoryPoint[];
  } | null;
}

function formatUtc(date: Date | null): string | null {
  if (!date) return null;
  return `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

function countsFrom(row: {
  reactionCount: number | null;
  replyCount: number | null;
  repostCount: number | null;
  zapCount: number | null;
  zapMsats: bigint | null;
}): AnalyticsCountView {
  return {
    reactions: row.reactionCount ?? 0,
    replies: row.replyCount ?? 0,
    reposts: row.repostCount ?? 0,
    zaps: row.zapCount ?? 0,
    sats: satsFromMsats(row.zapMsats),
  };
}

export async function loadPostAnalyticsPage(args: {
  userId: string;
  collectionActive: boolean;
  selectedEventId: string | null;
}): Promise<PostAnalyticsPageData> {
  const notes = await listTrackedAuthorEvents(args.userId);
  const latestRows = await listPerformanceLatest(
    args.userId,
    notes.map((note) => note.nostrEventId)
  );
  const latestById = new Map(latestRows.map((row) => [row.nostrEventId, row]));

  const noteViews: AnalyticsNoteView[] = notes.map((note) => {
    const latest = latestById.get(note.nostrEventId) ?? null;
    const status = notePerformanceStatus(latest);
    const showCounts = status === "counts" || status === "zero";
    return {
      nostrEventId: note.nostrEventId,
      kind: note.kind,
      eventCreatedAt: formatUtc(note.eventCreatedAt),
      contentExcerpt: note.contentExcerpt,
      publishedInSmartFlow: note.postId !== null,
      status,
      counts: showCounts && latest ? countsFrom(latest) : null,
    };
  });

  const selected = args.selectedEventId
    ? notes.find((note) => note.nostrEventId === args.selectedEventId)
    : undefined;
  let history: PostAnalyticsPageData["history"] = null;
  if (selected) {
    const points = await listPerformanceObservations(
      args.userId,
      selected.nostrEventId
    );
    history = {
      nostrEventId: selected.nostrEventId,
      contentExcerpt: selected.contentExcerpt,
      points: points.map((point) => ({
        id: point.id,
        checkedAt: formatUtc(point.checkedAt) ?? "",
        missingFromIndex: point.missingFromIndex,
        ...countsFrom(point),
      })),
    };
  }

  return {
    collectionActive: args.collectionActive,
    notes: noteViews,
    history,
  };
}
