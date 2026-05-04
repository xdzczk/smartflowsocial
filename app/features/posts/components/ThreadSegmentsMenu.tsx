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
import { formatDate } from "../utils/content-helpers";

interface ThreadSegmentsMenuProps {
  segments: CombinedContent[];
  listType: "scheduled" | "published";
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
  onSelectSegment: (item: CombinedContent) => void;
  triggerClassName?: string;
}

/**
 * Dropdown listing follow-up thread segments (parts 2+); root row stays visible separately.
 */
export function ThreadSegmentsMenu({
  segments,
  listType,
  userTimezone,
  userTimeFormat = "12h",
  onSelectSegment,
  triggerClassName,
}: ThreadSegmentsMenuProps) {
  const { dateLocale } = useFormattedDate();

  if (segments.length === 0) return null;

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
          aria-label={`${segments.length} more thread part${segments.length === 1 ? "" : "s"}`}
        >
          <ChevronDown className="size-3.5 shrink-0 opacity-80" aria-hidden />
          {segments.length} more part{segments.length === 1 ? "" : "s"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[14rem]"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {segments.map((seg, idx) => {
          const partLabel = `Part ${idx + 2}`;
          const when =
            listType === "scheduled"
              ? formatDate(
                  seg.scheduledAtUtc ?? undefined,
                  false,
                  userTimezone,
                  userTimeFormat,
                  dateLocale
                )
              : formatDate(
                  seg.publishedAt ?? undefined,
                  false,
                  userTimezone,
                  userTimeFormat,
                  dateLocale
                );
          const preview =
            seg.caption?.trim().slice(0, 48) ??
            seg.title?.trim().slice(0, 48) ??
            "Segment";
          return (
            <DropdownMenuItem
              key={`${seg.type}-${seg.id}`}
              onSelect={() => {
                // When the menu closes, Radix can retarget a click to the list row/card
                // under the cursor; that handler opens the root segment and would run in the
                // same turn. Defer so the chosen segment wins.
                window.setTimeout(() => onSelectSegment(seg), 0);
              }}
              className="flex flex-col items-start gap-0.5 py-2"
            >
              <span className="text-text font-medium">
                {partLabel}
                <span className="text-text-secondary font-normal">
                  {" "}
                  · {when}
                </span>
              </span>
              <span className="text-text-secondary line-clamp-2 text-xs">
                {preview}
                {(seg.caption?.length ?? 0) > 48 ? "…" : ""}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
