import type { CombinedContent } from "~/features/posts/types";
import {
  getContentTypeBadge,
  getQueueTypeDisplay,
  getStatusColor,
  getStatusText,
} from "~/features/posts/utils/content-helpers";

import { PUBLISHING_CONTENT_KIND_BADGE_CLASS } from "./constants";

export function ContentTypeChip({ item }: { item: CombinedContent }) {
  const badge = getContentTypeBadge(item);
  return <span className={badge.className}>{badge.text}</span>;
}

const NO_QUEUE_NEUTRAL_CLASS =
  "inline-flex max-w-full truncate rounded-full border border-border/60 bg-muted/25 px-2 py-1 text-xs font-medium text-muted-foreground";

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
      <span className={NO_QUEUE_NEUTRAL_CLASS} title={noQueueLabel}>
        {noQueueLabel}
      </span>
    );
  }

  const queueDisplay = getQueueTypeDisplay(queueType);
  const label =
    queueDisplay.name === "unassigned" ? noQueueLabel : queueDisplay.name;

  return (
    <span
      className={queueDisplay.className}
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

/** Scheduled / published / draft row status from combined content. */
export function ContentStatusChip({ item }: { item: CombinedContent }) {
  return (
    <span
      className={`inline-flex rounded-full border border-transparent px-2 py-1 text-xs leading-4 font-semibold ${getStatusColor(item)}`}
    >
      {getStatusText(item)}
    </span>
  );
}

const META_CHIP_CLASS =
  "text-muted-foreground inline-flex items-center rounded-full border border-border/60 bg-muted/20 px-2 py-0.5 text-xs font-medium";

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
