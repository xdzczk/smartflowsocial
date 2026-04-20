/**
 * React adapter for the module-scoped pending-publish state machine.
 *
 * Wraps `pendingPublish.subscribe` + `pendingPublish.getSnapshot` in
 * `useSyncExternalStore` so any composer surface can render banners that
 * stay perfectly in sync with the in-flight attempt across tabs / reconnect
 * events / unmount-remount.
 *
 * Returning the snapshot directly (instead of selecting fields) keeps the
 * adapter trivially equivalent to the store and lets each consumer pick the
 * fields it cares about — the snapshot itself is referentially stable across
 * unrelated emits, so React will skip renders when the visible state hasn't
 * changed.
 */

import { useSyncExternalStore } from "react";

import {
  getSnapshot,
  subscribe,
  type PendingPublishAttempt,
} from "./pending-publish.client";

export function usePendingPublishAttempt(): PendingPublishAttempt | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
