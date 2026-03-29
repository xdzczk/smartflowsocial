import { useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  RailChip,
  RailChipGroup,
  railFieldClassNames,
  railSelectTriggerClassNames,
} from "~/features/posts/components/publishing-rail";
import { ComposerScheduleRandomWindowField } from "~/features/posts/composer/components/composer/ComposerScheduleRandomWindowField";
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
  /** Quick interval chips apply spacing to all posts (same as composer rail chips). */
  onScheduleIntervalChipClick?: (intervalHours: number) => void;
}

export default function BulkPostsSchedulingPanel({
  posts,
  setPosts,
  scheduleIntervals,
  userTimezone,
  disabled = false,
  scheduleRandomWindowMinutes,
  onScheduleRandomWindowMinutesChange,
  onScheduleIntervalChipClick,
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

  const { intervals, defaultInterval } = useMemo(() => {
    const base = scheduleIntervals ?? [1, 2, 4, 12, 24];
    const ints = [0, ...base].filter((h, i, arr) => arr.indexOf(h) === i);
    const def = ints.includes(1) ? 1 : (ints[1] ?? 0);
    return { intervals: ints, defaultInterval: def };
  }, [scheduleIntervals]);
  const [intervalHours, setIntervalHours] = useState(defaultInterval);

  const minDatetime = getNowForDateTimeLocal(userTimezone);

  if (posts.length === 0) return null;

  const handleApplyToAll = () => {
    const startStr = displayStart.trim() || defaultStart;
    const base = parseDateTimeLocal(startStr, userTimezone);
    const updated = posts.map((post, index) => ({
      ...post,
      scheduledFor: formatForDateTimeLocal(
        addHours(base, index * intervalHours),
        userTimezone
      ),
    }));
    setPosts(updated);
  };

  const handleClearSchedules = () => {
    setPosts((prev) => prev.map((p) => ({ ...p, scheduledFor: "" })));
    setStartTime("");
  };

  const chipIntervals = intervals.filter((h) => h > 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label
            htmlFor="bulk-schedule-start-time"
            className="text-muted-foreground text-xs font-medium"
          >
            Start time
          </Label>
          <Input
            id="bulk-schedule-start-time"
            type="datetime-local"
            className={railFieldClassNames}
            value={displayStart}
            onChange={(e) => {
              const v = e.target.value;
              const clamped = v && v < minDatetime ? minDatetime : v;
              setStartTime(clamped);
            }}
            min={minDatetime}
            disabled={disabled}
            aria-label="Start time for first post"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label
            htmlFor="bulk-schedule-interval"
            className="text-muted-foreground text-xs font-medium"
          >
            Interval
          </Label>
          <Select
            value={String(intervalHours)}
            onValueChange={(v) => setIntervalHours(Number(v))}
            disabled={disabled}
          >
            <SelectTrigger
              id="bulk-schedule-interval"
              className={railSelectTriggerClassNames}
              aria-label="Interval between posts"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {intervals.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {formatIntervalLabel(h)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ComposerScheduleRandomWindowField
        scheduleRandomWindowMinutes={scheduleRandomWindowMinutes}
        onScheduleRandomWindowMinutesChange={(v) =>
          onScheduleRandomWindowMinutesChange(v as ScheduleRandomWindow)
        }
        disabled={disabled}
        windowOptions={[5, 10, 15]}
        label="Randomize publish time"
        idPrefix="bulk-batch"
      />

      {onScheduleIntervalChipClick != null && chipIntervals.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium">
            Quick spacing
          </span>
          <RailChipGroup>
            {chipIntervals.map((h) => (
              <RailChip
                key={h}
                type="button"
                disabled={disabled}
                selected={intervalHours === h}
                onClick={() => {
                  setIntervalHours(h);
                  onScheduleIntervalChipClick(h);
                }}
              >
                {formatIntervalLabel(h, { compact: true })}
              </RailChip>
            ))}
          </RailChipGroup>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-0.5">
        <Button
          type="button"
          size="sm"
          className="text-xs"
          disabled={disabled}
          onClick={handleApplyToAll}
        >
          Apply to all
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs"
          disabled={disabled}
          onClick={handleClearSchedules}
        >
          Clear schedules
        </Button>
      </div>
    </div>
  );
}
