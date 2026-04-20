/**
 * Re-export shim: the canonical hook now lives at
 * `~/features/auth/signing/use-pending-publish-attempt`.
 *
 * Kept here so legacy composer imports continue to resolve while we migrate
 * call sites; safe to delete in a follow-up cleanup PR.
 */

export { usePendingPublishAttempt } from "~/features/auth/signing/use-pending-publish-attempt";
