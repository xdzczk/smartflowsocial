import type { CombinedContent } from "~/features/posts/types";
import {
  getContentTypeBadge,
  getQueueTypeDisplay,
  getStatusText,
  getStatusTextToneClass,
} from "~/features/posts/utils/content-helpers";
import { cn } from "~/lib/utils";

import {
  PUBLISHING_CONTENT_KIND_BADGE_CLASS,
  PUBLISHING_METADATA_CHIP_GAP_CLASS,
  PUBLISHING_QUEUE_NEUTRAL_CHIP_CLASS,
} from "./constants";

export function ContentTypeChip({ item }: { item: CombinedContent }) {
  const badge = getContentTypeBadge(item);
  return <span className={badge.className}>{badge.text}</span>;
}

export function QueueStatusChip({
  queueType,
  mode = "default",
  noQueueLabel = "No queue",
}: {
  queueType: CombinedContent["queueType"];
  /** Drafts: show neutral label when unassigned. */
  mode?: "default" | "draft";
  noQueueLabel?: string;
}) {
  const isUnassigned = !queueType?.name || queueType.name === "unassigned";
  if (mode === "draft" && isUnassigned) {
    return (
      <span
        className={PUBLISHING_QUEUE_NEUTRAL_CHIP_CLASS}
        title={noQueueLabel}
      >
        {noQueueLabel}
      </span>
    );
  }

  const queueDisplay = getQueueTypeDisplay(queueType);
  const label =
    queueDisplay.name === "unassigned" ? noQueueLabel : queueDisplay.name;

  return (
    <span
      className={cn("max-w-[12rem] truncate", queueDisplay.className)}
      style={queueDisplay.style}
      title={label}
    >
      {label}
    </span>
  );
}

/** Template list / non-`CombinedContent` surfaces (POST / Article). */
export function TemplateKindChip({ label }: { label: string }) {
  return <span className={PUBLISHING_CONTENT_KIND_BADGE_CLASS}>{label}</span>;
}

/** Scheduled / published / draft row status — lifecycle text, not queue-style pills. */
export function ContentStatusChip({ item }: { item: CombinedContent }) {
  return (
    <span
      className={cn(
        "text-xs leading-normal font-medium",
        getStatusTextToneClass(item)
      )}
    >
      {getStatusText(item)}
    </span>
  );
}

const META_CHIP_CLASS =
  "text-text-secondary inline-flex items-center rounded-full border border-border/60 bg-surface-hover/20 px-2 py-1 text-xs font-medium";

export function AttachmentCountChip({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className={META_CHIP_CLASS}>
      {count} {count === 1 ? "attachment" : "attachments"}
    </span>
  );
}

export function TextOnlyIndicatorChip() {
  return <span className={META_CHIP_CLASS}>Text only</span>;
}

/** Re-export for flex rows that group multiple metadata chips. */
export { PUBLISHING_METADATA_CHIP_GAP_CLASS };
