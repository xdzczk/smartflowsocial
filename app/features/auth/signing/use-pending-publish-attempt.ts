/**
 * React adapter for the foreground signing-attempt slot.
 *
 * Wraps the module-scoped `signing-attempts` store in `useSyncExternalStore`
 * so any component (composer rail, global toast region, modal) can render
 * banners / status pills that stay in sync with the live attempt across
 * tabs, reconnect events, and unmount-remount.
 *
 * Returns the foreground attempt's stable snapshot (referentially stable
 * across unrelated emits) so React skips renders when the visible state
 * hasn't changed.
 *
 * History: this hook used to live at
 * `app/features/posts/composer/state/use-pending-publish-attempt.ts` —
 * that path now re-exports from here so existing composer code keeps
 * working unchanged.
 */

import { useSyncExternalStore } from "react";

import {
  getSnapshot,
  subscribe,
  type PendingPublishAttempt,
} from "./signing-attempts.client";

export function usePendingPublishAttempt(): PendingPublishAttempt | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
