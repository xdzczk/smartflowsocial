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
 * `app/features/posts/composer/state/use-pending-publish-attempt.ts`  -
 * that path now re-exports from here so existing composer code keeps
 * working unchanged.
 */

import { useSyncExternalStore } from "react";

import {
  getSnapshot,
  subscribe,
  type PendingPublishAttempt,
} from "./signing-attempts.client";

// `signing-attempts.client.ts` is stripped from the server bundle by
// Remix's `.client.ts` convention, which means `subscribe` and
// `getSnapshot` are `undefined` during SSR. Calling
// `useSyncExternalStore` with undefined args throws
// "Missing getServerSnapshot, which is required for server-rendered
// content."  -  so we provide stable no-op fallbacks for the SSR pass and
// only wire the real client store after hydration.
const noopSubscribe = (): (() => void) => () => {
  /* server-side: store has no events */
};
const serverSnapshot = (): PendingPublishAttempt | null => null;

export function usePendingPublishAttempt(): PendingPublishAttempt | null {
  const isClient = typeof window !== "undefined";
  return useSyncExternalStore(
    isClient ? subscribe : noopSubscribe,
    isClient ? getSnapshot : serverSnapshot,
    serverSnapshot
  );
}
