/**
 * Global mount of the foreground sign-recovery banner.
 *
 * Lives in `app/root.tsx` so a stalled durable signing attempt (reschedule,
 * edit, NIP-65 publish, DM, repost/quote schedule, bulk publish, etc.) keeps
 * a visible "we'll resume automatically" affordance even after the modal or
 * rail that originated the attempt has been unmounted.
 *
 * This wrapper deliberately suppresses itself for the composer
 * (`composer_publish` intent): `UnifiedComposer` mounts its own copy of the
 * banner inside the publishing rail, with a per-composer `Retry` callback
 * that re-fires the most recent submit. Rendering both at once would double
 * the visual noise during a composer publish  -  the composer mount wins
 * because it has surface-specific retry semantics that this generic mount
 * cannot.
 *
 * For any other durable intent, the global mount renders the banner without
 * a `Retry` button: a stale durable intent that expired requires the user to
 * re-trigger the action from the original surface (the click intent may no
 * longer be valid  -  e.g. the post they were rescheduling has since moved).
 *
 * Ephemeral intents (reactions, search engagement) are also suppressed: those
 * have a dedicated subtle/compact tier (`SubtleSignPending` /
 * `CompactSignStatus`) that lives next to the originating action.
 */

import { usePendingPublishAttempt } from "../use-pending-publish-attempt";

import { ForegroundSignRecoveryBanner } from "./ForegroundSignRecoveryBanner";

export function GlobalSignRecoveryBanner() {
  const attempt = usePendingPublishAttempt();
  if (!attempt) return null;
  if (attempt.intent.kind === "ephemeral") return null;
  if (attempt.intent.name === "composer_publish") return null;
  if (
    attempt.state !== "awaiting_signer" &&
    attempt.state !== "resuming" &&
    attempt.state !== "expired"
  ) {
    return null;
  }
  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-50 flex justify-center px-2 sm:top-4">
      <div className="pointer-events-auto w-full max-w-xl">
        <ForegroundSignRecoveryBanner attempt={attempt} />
      </div>
    </div>
  );
}
