/**
 * Shared Recharts defaults for admin analytics — theme-aligned strokes and tooltips.
 */

import { useCallback } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "~/lib/utils";

export function formatChartDayLabel(isoDay: string): string {
  try {
    const d = new Date(`${isoDay}T12:00:00.000Z`);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return isoDay;
  }
}

interface AdminTooltipPayloadItem {
  name?: string;
  dataKey?: string | number;
  value?: number;
}

function AdminTooltipContent({
  active,
  payload,
  label,
  formatDay,
}: {
  active?: boolean;
  payload?: AdminTooltipPayloadItem[];
  label?: string | number;
  formatDay: (isoDay: string) => string;
}) {
  const items = payload;
  if (!active || !items?.length) return null;
  const day =
    typeof label === "string" ? formatDay(label) : String(label ?? "");
  return (
    <div className="border-border bg-surface-overlay text-text shadow-2 rounded-lg border px-3 py-2 text-xs">
      <p className="text-text-secondary mb-1 font-medium">{day}</p>
      <ul className="space-y-0.5">
        {items.map((p) => (
          <li
            key={String(p.dataKey)}
            className="flex justify-between gap-4 tabular-nums"
          >
            <span className="text-text-secondary">{p.name ?? p.dataKey}</span>
            <span className="font-medium">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface AdminLineSeries {
  dataKey: string;
  name: string;
  stroke: string;
  strokeWidth?: number;
}

export function AdminLineChart({
  data,
  xKey = "day",
  series,
  className,
  formatDayLabel = formatChartDayLabel,
}: {
  data: Array<Record<string, string | number>>;
  xKey?: string;
  series: AdminLineSeries[];
  className?: string;
  /** Use `useFormattedDate` so axis + tooltip match account date prefs. */
  formatDayLabel?: (isoDay: string) => string;
}) {
  const renderTooltip = useCallback(
    (props: { active?: boolean; payload?: unknown; label?: unknown }) => (
      <AdminTooltipContent
        active={props.active}
        payload={props.payload as AdminTooltipPayloadItem[] | undefined}
        label={props.label as string | number | undefined}
        formatDay={formatDayLabel}
      />
    ),
    [formatDayLabel]
  );

  return (
    <div className={cn("h-[260px] w-full sm:h-[280px]", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-border opacity-60"
            vertical={false}
          />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 10 }}
            tickFormatter={(v) =>
              typeof v === "string" ? formatDayLabel(v) : String(v)
            }
            stroke="hsl(var(--text-secondary) / 0.5)"
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            width={36}
            stroke="hsl(var(--text-secondary) / 0.5)"
            tickLine={false}
          />
          <Tooltip content={renderTooltip} />
          {series.map((s) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.stroke}
              strokeWidth={s.strokeWidth ?? 2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
