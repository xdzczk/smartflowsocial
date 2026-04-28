/**
 * Shared layout tokens for the dashboard bottom-row pair:
 * ScheduleNext7DaysCard + QueuesPanel (aligned headers, padding, rhythm).
 */

export const DASHBOARD_PAIR_CARD_CLASS =
  "kpi-card border-border-subtle/80 flex min-w-0 flex-1 flex-col overflow-hidden shadow-1 lg:h-full lg:min-h-0";

/** Title left; actions right. Same vertical rhythm as KPI row. */
export const DASHBOARD_PAIR_CARD_HEADER_CLASS =
  "flex min-h-10 flex-row flex-nowrap items-center justify-between gap-2 px-4 py-2.5";

export const DASHBOARD_PAIR_CARD_CONTENT_CLASS =
  "flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-0 pb-3";

/** Secondary / metadata actions in pair cards (Target, soft Create Queue): h-8, low emphasis */
export const DASHBOARD_PAIR_HEADER_ACTION_CLASS =
  "focus-ring inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-text-secondary hover:bg-surface-hover/45 hover:text-text";
