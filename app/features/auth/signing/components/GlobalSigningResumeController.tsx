/**
 * App-wide auto-resume of parked signing attempts.
 *
 * Subscribes to `nostr-connection-healthy` (dispatched by the signer
 * adapter when a NIP-46/NIP-07 connection is restored) and asks the
 * `signingAttempts` store to resume every attempt parked in
 * `awaiting_signer` that is still inside its recovery window.
 *
 * Why a global controller exists:
 *
 * Before this, only `useComposerSignerReconnect` (mounted by the
 * composer + draft bulk + reschedule modal) called
 * `signingAttempts.maybeResume()` on the healthy event. That meant a
 * Like, NIP-65 publish, DM, or feedback DM left in `awaiting_signer`
 * on a non-composer page (e.g. notifications, settings, search) would
 * never auto-resume — the user had to navigate to a composer host or
 * manually re-trigger the action. Acceptance criterion #1 of the
 * unified-signing-recovery plan ("reopening Primal auto-completes the
 * like") explicitly requires the resume to happen regardless of which
 * route is mounted, so the listener belongs at the application root.
 *
 * The controller renders nothing. It is mounted from `app/root.tsx`
 * alongside `GlobalSignRecoveryBanner`. SSR-safe (no-op during render;
 * the effect runs on mount in the browser).
 *
 * Idempotent with `useComposerSignerReconnect`: the composer hook
 * still runs first when its host is mounted (its handler bails out
 * on `pendingPublish.maybeResume() === true`), and `maybeResume`
 * itself is a no-op for attempts that are not in `awaiting_signer`,
 * so a redundant second call from this controller has no observable
 * effect beyond an extra map iteration.
 */

import { useEffect } from "react";

import { NOSTR_CONNECTION_HEALTHY_EVENT } from "~/features/auth/signer/connection-constants";

import { pendingPublish } from "../signing-attempts.client";

export function GlobalSigningResumeController(): null {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      pendingPublish.maybeResume();
    };
    window.addEventListener(NOSTR_CONNECTION_HEALTHY_EVENT, handler);
    return () => {
      window.removeEventListener(NOSTR_CONNECTION_HEALTHY_EVENT, handler);
    };
  }, []);

  return null;
}
