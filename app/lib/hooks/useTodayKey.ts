/**
 * Returns `{ year, month, day }` in the given IANA timezone on the client,
 * or `null` during SSR and the first client render.
 *
 * Subscribed via `useSyncExternalStore` so server-rendered and first-client
 * HTML match (preventing React hydration errors #418/#423). After hydration,
 * the hook polls every 5 minutes so any UI that depends on "what day is it
 * now" silently rolls over at midnight without a manual refresh.
 *
 * Usage:
 *   const today = useTodayKey(user.timezone);
 *   const isToday = today
 *     ? d.year === today.year && d.month === today.month && d.day === today.day
 *     : false;
 */

import { useSyncExternalStore } from "react";

import { nowInTimezone } from "~/lib/temporal";

export interface TodayKey {
  year: number;
  month: number;
  day: number;
}

const TODAY_POLL_INTERVAL_MS = 5 * 60 * 1000;

function subscribeToday(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const id = window.setInterval(() => {
    onStoreChange();
  }, TODAY_POLL_INTERVAL_MS);
  return () => window.clearInterval(id);
}

function getTodayKeyString(tz: string): string {
  const z = nowInTimezone(tz);
  return `${z.year}|${z.month}|${z.day}`;
}

export function useTodayKey(timezone: string): TodayKey | null {
  const key = useSyncExternalStore(
    subscribeToday,
    () => getTodayKeyString(timezone),
    () => null
  );
  if (!key) return null;
  const parts = key.split("|").map((n) => Number(n));
  if (parts.length < 3) return null;
  const [y, m, d] = parts as [number, number, number];
  return { year: y, month: m, day: d };
}
