import { useState } from "react";

import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { formatIntervalLabel } from "~/lib/schedule-intervals";
import {
  addHours,
  formatForDateTimeLocal,
  getNowForDateTimeLocal,
  nowInTimezone,
  parseDateTimeLocal,
} from "~/lib/temporal";

import type { BulkPost } from "./BulkPostCard";

type ScheduleRandomWindow = 0 | 5 | 10 | 15;

interface BulkPostsSchedulingPanelProps {
  posts: BulkPost[];
  setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>;
  scheduleIntervals: number[] | undefined;
  userTimezone: string;
  disabled?: boolean;
  scheduleRandomWindowMinutes: ScheduleRandomWindow;
  onScheduleRandomWindowMinutesChange: (value: ScheduleRandomWindow) => void;
}

export default function BulkPostsSchedulingPanel({
  posts,
  setPosts,
  scheduleIntervals,
  userTimezone,
  disabled = false,
  scheduleRandomWindowMinutes,
  onScheduleRandomWindowMinutesChange,
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
      <div className="flex min-w-[200px] flex-col gap-1">
        <Label
          htmlFor="bulk-schedule-random-window"
          className="text-muted-foreground text-xs font-medium"
        >
          Random time (± minutes)
        </Label>
        <Select
          value={String(scheduleRandomWindowMinutes)}
          onValueChange={(v) =>
            onScheduleRandomWindowMinutesChange(
              Number(v) as ScheduleRandomWindow
            )
          }
          disabled={disabled}
        >
          <SelectTrigger
            id="bulk-schedule-random-window"
            className="dark:bg-card border-input h-9 w-full rounded border px-3 text-sm"
            aria-label="Post at random time within plus or minus minutes"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Off (exact time)</SelectItem>
            <SelectItem value="5">±5 minutes</SelectItem>
            <SelectItem value="10">±10 minutes</SelectItem>
            <SelectItem value="15">±15 minutes</SelectItem>
          </SelectContent>
        </Select>
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
