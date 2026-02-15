import { useState } from "react";

import { formatIntervalLabel } from "~/lib/schedule-intervals";
import {
  addHours,
  formatForDateTimeLocal,
  getNowForDateTimeLocal,
  nowInTimezone,
  parseDateTimeLocal,
} from "~/lib/temporal";

import type { BulkPost } from "./BulkPostCard";

interface BulkPostsSchedulingPanelProps {
  posts: BulkPost[];
  setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>;
  scheduleIntervals: number[] | undefined;
  userTimezone: string;
  disabled?: boolean;
}

export default function BulkPostsSchedulingPanel({
  posts,
  setPosts,
  scheduleIntervals,
  userTimezone,
  disabled = false,
}: BulkPostsSchedulingPanelProps) {
  const defaultStart = formatForDateTimeLocal(
    addHours(nowInTimezone(userTimezone), 1),
    userTimezone
  );
  const firstScheduled =
    posts.length > 0 && posts[0] ? posts[0].scheduledFor.trim() : "";
  const [startTime, setStartTime] = useState(
    firstScheduled ? firstScheduled : defaultStart
  );

  const displayStart = firstScheduled
    ? firstScheduled
    : startTime
      ? startTime
      : defaultStart;

  if (posts.length === 0) return null;

  const handleApplyToAll = () => {
    const intervalSelect = document.getElementById(
      "bulk-schedule-interval"
    ) as HTMLSelectElement | null;
    const startStr = displayStart.trim() || defaultStart;
    const interval = intervalSelect
      ? Number(intervalSelect.value)
      : defaultInterval;

    const base = parseDateTimeLocal(startStr, userTimezone);
    const updated = posts.map((post, index) => ({
      ...post,
      scheduledFor: formatForDateTimeLocal(
        addHours(base, index * interval),
        userTimezone
      ),
    }));
    setPosts(updated);
  };

  const handleClearSchedules = () => {
    setPosts((prev) => prev.map((p) => ({ ...p, scheduledFor: "" })));
    setStartTime("");
  };

  const baseIntervals = scheduleIntervals ?? [1, 2, 4, 12, 24];
  const intervals = [0, ...baseIntervals].filter(
    (h, i, arr) => arr.indexOf(h) === i
  );
  const defaultInterval = intervals.includes(1) ? 1 : (intervals[1] ?? 0);

  return (
    <div className="bg-muted/50 border-border mb-4 flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="bulk-schedule-start-time"
          className="text-muted-foreground text-xs font-medium"
        >
          Start time
        </label>
        <input
          id="bulk-schedule-start-time"
          type="datetime-local"
          value={displayStart}
          onChange={(e) => setStartTime(e.target.value)}
          min={getNowForDateTimeLocal(userTimezone)}
          className="dark:bg-card text-foreground dark:text-foreground border-input rounded border px-3 py-2 text-sm"
          aria-label="Start time for first post"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="bulk-schedule-interval"
          className="text-muted-foreground text-xs font-medium"
        >
          Interval
        </label>
        <select
          id="bulk-schedule-interval"
          className="dark:bg-card text-foreground dark:text-foreground border-input rounded border px-3 py-2 text-sm"
          aria-label="Interval between posts"
          defaultValue={String(defaultInterval)}
        >
          {intervals.map((h) => (
            <option key={h} value={h}>
              {formatIntervalLabel(h)}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={handleApplyToAll}
        disabled={disabled}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
      >
        Apply to all
      </button>
      <button
        type="button"
        onClick={handleClearSchedules}
        disabled={disabled}
        className="bg-muted text-foreground hover:bg-muted/80 rounded px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
      >
        Clear schedules
      </button>
    </div>
  );
}
