import { cn } from "~/lib/utils";

/** Horizontal inset aligned with rail body zones */
export const RAIL_PAD_X = "px-3";

/** Vertical padding for each major scroll zone */
export const RAIL_ZONE_PY = "py-4";

/** Divider between major rail sections */
export const RAIL_MAJOR_DIVIDE = "divide-y divide-border-subtle/55";

/** Spacing between header and first row in a zone */
export const RAIL_HEADER_TO_BODY = "mb-2.5";

/** Tight stack inside summary / metadata */
export const RAIL_STACK_TIGHT = "space-y-1";

/** Related rows (settings, summary lines) */
export const RAIL_STACK_ROWS = "space-y-1.5";

/** Between mode block and thread block inside first zone */
export const RAIL_MODE_THREAD_GAP = "space-y-3";

/** Gap between summary block and outcome / feedback */
export const RAIL_SUMMARY_TO_FEEDBACK = "pt-2";

/** Primary field: datetime-local and queue select (shared grammar) */
export const railFieldClassNames = cn(
  "border-border bg-surface text-text placeholder:text-text-tertiary",
  "h-9 w-full rounded-md border px-3 text-xs font-normal shadow-none",
  "motion-fast focus-ring",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

/** Select trigger: same field shell + flex for chevron */
export const railSelectTriggerClassNames = cn(
  railFieldClassNames,
  "flex items-center justify-between gap-2 [&>span]:line-clamp-1"
);

/** Settings row: min-height and vertical rhythm */
export const RAIL_SETTINGS_ROW =
  "flex min-h-10 w-full items-center gap-3 py-2.5";

/** Sticky secondary action (Save draft) */
export const RAIL_SECONDARY_ACTION =
  "text-text-secondary hover:bg-surface-hover hover:text-text border-border-subtle/45 h-9 w-full rounded-none border-0 border-b bg-transparent text-[11px] font-semibold shadow-none";
