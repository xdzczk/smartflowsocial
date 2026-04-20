/**
 * Shared composer publish FormData/payload helpers.
 *
 * Centralizes the small set of fields whose presence/encoding must be
 * byte-identical across:
 *   - fresh single-post submits (`useComposerSubmit.runSinglePostSubmit`)
 *   - thread submits (`buildThreadSubmitFormData`)
 *   - long-form submits (`useLongFormSubmission`)
 *   - poll submits (`PollComposer`)
 *   - resumed submits driven by the pending-publish state machine
 *
 * The user-visible bug we're guarding against is the "Scenario A vs Scenario B"
 * divergence: a resumed publish must hit exactly the same server-side relay
 * resolution branch as the fresh publish that came before it. The simplest way
 * to enforce that is to funnel every "set the `relays` form field" through one
 * helper that always uses the same field name + JSON encoding + non-empty
 * guard, and to funnel every "set the `submissionId` form field" through a
 * second helper so the server can dedupe on a stable client-generated uuid.
 *
 * This module is intentionally framework-free (no React, no Remix imports) so
 * it can be reused by both `FormData` callers and plain `Record<string, string>`
 * payload callers, and so it stays trivial to unit-test.
 */

export type PayloadTarget = FormData | Record<string, string>;

function setFieldOnTarget(
  target: PayloadTarget,
  name: string,
  value: string
): void {
  if (target instanceof FormData) {
    target.set(name, value);
  } else {
    target[name] = value;
  }
}

/**
 * Append the canonical `relays` JSON override to a publish payload.
 *
 * No-op when `relayOverride` is null/undefined or empty: that mirrors the
 * server contract (omitted field → fall back to `resolveExecutionRelays`).
 */
export function appendRelayOverride(
  target: PayloadTarget,
  relayOverride: readonly string[] | null | undefined
): void {
  if (!relayOverride || relayOverride.length === 0) return;
  setFieldOnTarget(target, "relays", JSON.stringify(relayOverride));
}

/**
 * Append the stable client `submissionId` to a publish payload. The server
 * uses it as the basis for `creationIdempotencyKey` so resumed attempts with
 * the same id always collapse onto a single `Post` row, while a fresh attempt
 * with a different id never collides with a historic publish.
 *
 * No-op when `submissionId` is empty.
 */
export function appendSubmissionId(
  target: PayloadTarget,
  submissionId: string | null | undefined
): void {
  if (!submissionId) return;
  setFieldOnTarget(target, "submissionId", submissionId);
}
