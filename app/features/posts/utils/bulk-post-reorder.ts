import type { BulkPost } from "~/features/posts/types";

type ScheduleSlice = Pick<
  BulkPost,
  "clientId" | "queueType" | "scheduledFor" | "includeHashtagsInNoteBody"
>;

function pickScheduleRow(p: BulkPost): ScheduleSlice {
  return {
    clientId: p.clientId,
    queueType: p.queueType,
    scheduledFor: p.scheduledFor,
    includeHashtagsInNoteBody: p.includeHashtagsInNoteBody,
  };
}

/** Merge schedule fields from `schedule` over `content` (content supplies media, captions, etc.). */
function applyScheduleToPost(
  schedule: ScheduleSlice,
  content: BulkPost
): BulkPost {
  return {
    ...content,
    ...schedule,
  };
}

/**
 * Swaps media/caption/recycle metadata between two rows while keeping each row's
 * queue + datetime slot (and stable `clientId` for the row).
 */
export function swapBulkPostContentPreservingSchedule(
  a: BulkPost,
  b: BulkPost
): [BulkPost, BulkPost] {
  const sa = pickScheduleRow(a);
  const sb = pickScheduleRow(b);
  return [applyScheduleToPost(sa, b), applyScheduleToPost(sb, a)];
}

/**
 * Moves row `index` one step in `direction` by swapping content with the neighbor.
 * Schedule fields stay fixed per index position.
 */
export function swapAdjacentBulkPostRowContent(
  posts: BulkPost[],
  index: number,
  direction: "up" | "down"
): BulkPost[] | null {
  const neighbor = direction === "up" ? index - 1 : index + 1;
  if (neighbor < 0 || neighbor >= posts.length) return null;
  const row = posts[index];
  const other = posts[neighbor];
  if (!row || !other) return null;
  const [nextRow, nextOther] = swapBulkPostContentPreservingSchedule(
    row,
    other
  );
  const next = [...posts];
  next[index] = nextRow;
  next[neighbor] = nextOther;
  return next;
}
