/**
 * Submission id helper for the new-post action handlers.
 *
 * The composer attaches a stable client-generated uuid as `submissionId` on
 * every publish form submission. The same id is reused across signer-reconnect
 * resumes of the same user attempt, so the server uses it as the basis for
 * `creationIdempotencyKey` to dedupe correctly across cold restarts and
 * autocomplete retries — see {@link generateSubmissionIdempotencyKey} in
 * `app/lib/idempotency.server.ts` and the rationale in
 * `app/features/posts/publishing/use-cases/publish-now.use-case.server.ts`.
 *
 * Returns the trimmed submissionId when present and well-formed; returns
 * `undefined` for legacy clients that haven't been redeployed yet (the use
 * case will fall back to the legacy content-hash idempotency key).
 */
export function readSubmissionId(formData: FormData): string | undefined {
  const raw = formData.get("submissionId");
  if (raw == null) return undefined;
  const value = String(raw).trim();
  if (value.length === 0) return undefined;
  // Defensive bound: real uuids are 36 chars; reject anything wildly off so
  // a malformed field can't poison the idempotency table with huge keys.
  if (value.length > 128) return undefined;
  return value;
}
