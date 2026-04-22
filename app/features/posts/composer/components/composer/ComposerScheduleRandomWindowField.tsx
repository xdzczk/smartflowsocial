/**
 * Random ± window around a nominal schedule time (queue slot or picked time).
 */

import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import {
  RailSettingsRow,
  railSelectTriggerClassNames,
} from "~/features/posts/components/publishing-rail";
import { cn } from "~/lib/utils";

const DEFAULT_WINDOW_OPTIONS = [5, 10, 15, 30, 60] as const;

export interface ComposerScheduleRandomWindowFieldProps {
  scheduleRandomWindowMinutes: number;
  onScheduleRandomWindowMinutesChange: (v: number) => void;
  disabled?: boolean;
  /** Minute half-widths shown when randomization is on (e.g. queue-only: 5,10,15). */
  windowOptions?: readonly number[];
  /** Row label next to the switch */
  label?: string;
  idPrefix?: string;
  /** Optional helper under the row */
  description?: string;
}

export function ComposerScheduleRandomWindowField({
  scheduleRandomWindowMinutes,
  onScheduleRandomWindowMinutesChange,
  disabled = false,
  windowOptions = DEFAULT_WINDOW_OPTIONS,
  label = "Randomize publish time",
  idPrefix = "schedule-randomize",
  description,
}: ComposerScheduleRandomWindowFieldProps) {
  const switchId = `${idPrefix}-switch`;
  const selectId = `${idPrefix}-minutes`;

  return (
    <div className="flex flex-col gap-2">
      <RailSettingsRow
        labelFor={switchId}
        label={label}
        control={
          <Switch
            id={switchId}
            checked={scheduleRandomWindowMinutes > 0}
            onCheckedChange={(on) => {
              if (!on) {
                onScheduleRandomWindowMinutesChange(0);
              } else {
                onScheduleRandomWindowMinutesChange(
                  scheduleRandomWindowMinutes > 0
                    ? scheduleRandomWindowMinutes
                    : (windowOptions[0] ?? 5)
                );
              }
            }}
            disabled={disabled}
          />
        }
      />
      {description ? (
        <p className="text-text-secondary text-xs leading-snug">
          {description}
        </p>
      ) : null}
      {scheduleRandomWindowMinutes > 0 ? (
        <div className="space-y-1.5">
          <Label
            htmlFor={selectId}
            className="text-text-secondary text-xs font-medium"
          >
            Window
          </Label>
          <Select
            value={String(scheduleRandomWindowMinutes)}
            onValueChange={(v) =>
              onScheduleRandomWindowMinutesChange(Number(v))
            }
          >
            <SelectTrigger
              id={selectId}
              className={cn(railSelectTriggerClassNames)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {windowOptions.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m === 60 ? "±1 hour" : `±${m} minutes`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
