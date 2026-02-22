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
    `${path}?scheduledAt=${encodeURIComponent(scheduledAt)}`;

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DropdownMenuTrigger
        className="text-muted-foreground hover:text-foreground hover:bg-muted/50 inline-flex size-8 shrink-0 items-center justify-center rounded transition-colors"
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
          onSelect={() => navigate(q("/dashboard/newpost"))}
          className="flex items-center gap-2"
        >
          <MessageSquare className={EMPTY_SLOT_ICON_CLASS} strokeWidth={2.25} />
          New Post
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => navigate(q("/dashboard/newlongformpost"))}
          className="flex items-center gap-2"
        >
          <FileText className={EMPTY_SLOT_ICON_CLASS} strokeWidth={2.25} />
          New Article
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
}: {
  dateKey: string;
  time: string;
  slotKey: string;
  userTimezone: string;
  activeEmptySlotKey: string | null;
  setActiveEmptySlotKey: (key: string | null) => void;
  onClearSelection?: () => void;
}) {
  const slotZoned = parseDateTimeLocal(`${dateKey}T${time}`, userTimezone);
  const nowZoned = nowInTimezone(userTimezone);
  const isFutureSlot = slotZoned.epochNanoseconds > nowZoned.epochNanoseconds;
  const isActive = activeEmptySlotKey === slotKey;
  const handleActivate = (e: React.MouseEvent) => {
    if (!isFutureSlot) return;
    e.stopPropagation();
    onClearSelection?.();
    setActiveEmptySlotKey(slotKey);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isFutureSlot) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setActiveEmptySlotKey(slotKey);
    }
  };
  return (
    <button
      type="button"
      className={`relative flex h-full w-full min-w-0 items-center justify-center border-0 bg-transparent p-0 ${isFutureSlot ? "cursor-pointer" : "cursor-default"}`}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      tabIndex={isFutureSlot ? 0 : -1}
      aria-label={isFutureSlot ? "Create post in this slot" : undefined}
      disabled={!isFutureSlot}
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
  /** When true, pass pointer events through so the block from above (extending into this row) is clickable. */
  pointerEventsNone?: boolean;
}) {
  const slotZoned = parseDateTimeLocal(`${dateKey}T${time}`, userTimezone);
  const nowZoned = nowInTimezone(userTimezone);
  const isFutureSlot = slotZoned.epochNanoseconds > nowZoned.epochNanoseconds;
  const isActive = activeEmptySlotKey === slotKey;
  const handleActivate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClearSelection?.();
    setActiveEmptySlotKey(slotKey);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setActiveEmptySlotKey(slotKey);
    }
  };
  if (!isFutureSlot) return null;
  return (
    <div
      className={`relative flex min-h-0 flex-1 items-center justify-center ${isActive ? "" : "cursor-pointer"}`}
      style={{
        minHeight: blockHeightPx,
        ...(pointerEventsNone ? { pointerEvents: "none" as const } : {}),
      }}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Create post in this slot"
    >
      {isActive ? (
        <EmptySlotCreateMenu
          dateKey={dateKey}
          time={time}
          onClose={() => setActiveEmptySlotKey(null)}
        />
      ) : null}
    </div>
  );
}
