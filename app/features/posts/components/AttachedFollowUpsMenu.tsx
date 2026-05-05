import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { cn } from "~/lib/utils";

import type { CombinedContent } from "../types";
import {
  attachedFollowUpMenuTitle,
  effectiveScheduledOrPublishedAtForAttachedMenuItem,
  postKindForAttachedMenuItem,
} from "../utils/attached-follow-up-rows";
import { formatDate } from "../utils/content-helpers";

interface AttachedFollowUpsMenuProps {
  /** Queue follow-ups (`dependencyMode` attached), excluding the root row. */
  items: CombinedContent[];
  listType: "scheduled" | "published";
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
  onSelectFollowUp: (item: CombinedContent) => void;
  triggerClassName?: string;
}

/**
 * Inline dropdown for scheduled queue follow-ups (parent/offset), same affordance as
 * {@link ThreadSegmentsMenu} for Nostr thread segments.
 */
export function AttachedFollowUpsMenu({
  items,
  listType,
  userTimezone,
  userTimeFormat = "12h",
  onSelectFollowUp,
  triggerClassName,
}: AttachedFollowUpsMenuProps) {
  const { dateLocale } = useFormattedDate();

  if (items.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "text-text-secondary hover:text-text focus-ring mt-1 inline-flex items-center gap-1 rounded-md text-xs font-medium",
            triggerClassName
          )}
          aria-label={`${items.length} scheduled follow-up${items.length === 1 ? "" : "s"}`}
        >
          <ChevronDown className="size-3.5 shrink-0 opacity-80" aria-hidden />
          {items.length} follow-up{items.length === 1 ? "" : "s"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[14rem]"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {items.map((item, idx) => {
          const at = effectiveScheduledOrPublishedAtForAttachedMenuItem(
            item,
            listType
          );
          const when = formatDate(
            at,
            false,
            userTimezone,
            userTimeFormat,
            dateLocale
          );
          const preview = item.caption?.trim().slice(0, 48) ?? "Follow-up";
          const title = attachedFollowUpMenuTitle(
            postKindForAttachedMenuItem(item),
            idx + 1
          );
          return (
            <DropdownMenuItem
              key={`follow-up-${item.type}-${item.id}`}
              onSelect={() => {
                window.setTimeout(() => onSelectFollowUp(item), 0);
              }}
              className="flex flex-col items-start gap-0.5 py-2"
            >
              <span className="text-text font-medium">
                {title}
                <span className="text-text-secondary font-normal">
                  {" "}
                  · {when}
                </span>
              </span>
              <span className="text-text-secondary line-clamp-2 text-xs">
                {preview}
                {(item.caption?.length ?? 0) > 48 ? "…" : ""}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
