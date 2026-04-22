/**
 * Empty slot UI: create menu and placeholder content for future slots.
 */

import { useNavigate } from "@remix-run/react";
import { FileText, MessageSquare, Plus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { nowInTimezone, parseDateTimeLocal } from "~/lib/temporal";

import { EMPTY_SLOT_ICON_CLASS } from "./weekly-view-constants";

function emptySlotHandleActivate(
  e: React.MouseEvent,
  opts: {
    isFutureSlot: boolean;
    isActive: boolean;
    slotKey: string;
    setActiveEmptySlotKey: (key: string | null) => void;
    onClearSelection?: () => void;
    /** Called when user taps/clicks empty cell; use to collapse any expanded post block (e.g. on mobile). */
    onClearExpandedPost?: () => void;
  }
) {
  const {
    isFutureSlot,
    isActive,
    slotKey,
    setActiveEmptySlotKey,
    onClearSelection,
    onClearExpandedPost,
  } = opts;
  onClearExpandedPost?.();
  if (isFutureSlot) {
    if (isActive && e.target === e.currentTarget) {
      setActiveEmptySlotKey(null);
    } else if (!isActive) {
      e.stopPropagation();
      onClearSelection?.();
      setActiveEmptySlotKey(slotKey);
    }
  } else {
    onClearSelection?.();
    setActiveEmptySlotKey(null);
  }
}

function emptySlotHandleKeyDown(
  e: React.KeyboardEvent,
  opts: {
    isFutureSlot: boolean;
    slotKey: string;
    setActiveEmptySlotKey: (key: string | null) => void;
  }
) {
  const { isFutureSlot, slotKey, setActiveEmptySlotKey } = opts;
  if (!isFutureSlot) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    setActiveEmptySlotKey(slotKey);
  }
}

export function EmptySlotCreateMenu({
  dateKey,
  time,
  onClose,
}: {
  dateKey: string;
  time: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const scheduledAt = `${dateKey}T${time}`;
  const q = (path: string) =>
    `${path}${path.includes("?") ? "&" : "?"}scheduledAt=${encodeURIComponent(scheduledAt)}`;

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DropdownMenuTrigger
        className="text-text-secondary hover:text-text hover:bg-surface-hover/50 motion-fast inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--calendar-radius-sm)]"
        onClick={(e) => e.stopPropagation()}
        aria-label="Create in this slot"
      >
        <Plus
          className={EMPTY_SLOT_ICON_CLASS}
          strokeWidth={2.25}
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" sideOffset={4}>
        <DropdownMenuItem
          onSelect={() => navigate(q("/dashboard/compose?type=post"))}
          className="cluster"
        >
          <MessageSquare className={EMPTY_SLOT_ICON_CLASS} strokeWidth={2.25} />
          Composer (Post)
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => navigate(q("/dashboard/compose?type=article"))}
          className="cluster"
        >
          <FileText className={EMPTY_SLOT_ICON_CLASS} strokeWidth={2.25} />
          Composer (Article)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EmptySlotCellContent({
  dateKey,
  time,
  slotKey,
  userTimezone,
  activeEmptySlotKey,
  setActiveEmptySlotKey,
  onClearSelection,
  onClearExpandedPost,
}: {
  dateKey: string;
  time: string;
  slotKey: string;
  userTimezone: string;
  activeEmptySlotKey: string | null;
  setActiveEmptySlotKey: (key: string | null) => void;
  onClearSelection?: () => void;
  /** Called when user taps empty cell; use to collapse any expanded post block. */
  onClearExpandedPost?: () => void;
}) {
  const slotZoned = parseDateTimeLocal(`${dateKey}T${time}`, userTimezone);
  const nowZoned = nowInTimezone(userTimezone);
  const isFutureSlot = slotZoned.epochNanoseconds > nowZoned.epochNanoseconds;
  const isActive = activeEmptySlotKey === slotKey;
  return (
    <button
      type="button"
      className={`relative flex h-full w-full min-w-0 items-center justify-center border-0 bg-transparent p-0 ${isFutureSlot ? "cursor-pointer" : "cursor-default"}`}
      onClick={(e) =>
        emptySlotHandleActivate(e, {
          isFutureSlot,
          isActive,
          slotKey,
          setActiveEmptySlotKey,
          onClearSelection,
          onClearExpandedPost,
        })
      }
      onKeyDown={(e) =>
        emptySlotHandleKeyDown(e, {
          isFutureSlot,
          slotKey,
          setActiveEmptySlotKey,
        })
      }
      tabIndex={isFutureSlot ? 0 : -1}
      aria-label={isFutureSlot ? "Open composer in this slot" : undefined}
    >
      {isFutureSlot && isActive ? (
        <EmptySlotCreateMenu
          dateKey={dateKey}
          time={time}
          onClose={() => setActiveEmptySlotKey(null)}
        />
      ) : null}
    </button>
  );
}

export function DayViewEmptyColumnArea({
  dateKey,
  time,
  slotKey,
  blockHeightPx,
  userTimezone,
  activeEmptySlotKey,
  setActiveEmptySlotKey,
  onClearSelection,
  onClearExpandedPost,
  pointerEventsNone = false,
}: {
  dateKey: string;
  time: string;
  slotKey: string;
  blockHeightPx: number;
  userTimezone: string;
  activeEmptySlotKey: string | null;
  setActiveEmptySlotKey: (key: string | null) => void;
  onClearSelection?: () => void;
  /** Called when user taps empty cell; use to collapse any expanded post block. */
  onClearExpandedPost?: () => void;
  /** When true, pass pointer events through so the block from above (extending into this row) is clickable. */
  pointerEventsNone?: boolean;
}) {
  const slotZoned = parseDateTimeLocal(`${dateKey}T${time}`, userTimezone);
  const nowZoned = nowInTimezone(userTimezone);
  const isFutureSlot = slotZoned.epochNanoseconds > nowZoned.epochNanoseconds;
  const isActive = activeEmptySlotKey === slotKey;
  return (
    <div
      className={`relative flex min-h-0 flex-1 items-center justify-center ${isFutureSlot && !isActive ? "cursor-pointer" : ""}`}
      style={{
        minHeight: blockHeightPx,
        ...(pointerEventsNone ? { pointerEvents: "none" as const } : {}),
      }}
      onClick={(e) =>
        emptySlotHandleActivate(e, {
          isFutureSlot,
          isActive,
          slotKey,
          setActiveEmptySlotKey,
          onClearSelection,
          onClearExpandedPost,
        })
      }
      onKeyDown={(e) =>
        emptySlotHandleKeyDown(e, {
          isFutureSlot,
          slotKey,
          setActiveEmptySlotKey,
        })
      }
      role="button"
      tabIndex={isFutureSlot ? 0 : -1}
      aria-label={isFutureSlot ? "Open composer in this slot" : undefined}
    >
      {isFutureSlot && isActive ? (
        <EmptySlotCreateMenu
          dateKey={dateKey}
          time={time}
          onClose={() => setActiveEmptySlotKey(null)}
        />
      ) : null}
    </div>
  );
}
