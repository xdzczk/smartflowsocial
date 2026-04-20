/**
 * Signing-attempts core (client-side, in-memory).
 *
 * One source of truth for any in-flight Nostr signing operation that the
 * UI needs to keep visible: composer publish, reschedule, reply, reaction,
 * DM send, etc. PR 2 of the unified-signing-recovery plan widens the store
 * to a multi-slot Map keyed by `attemptId`, with bounded LRU eviction of
 * stale non-foreground attempts; this lets the same store back both the
 * foreground recovery banner (durable intents) and the per-row compact
 * statuses introduced in PR 3/4.
 *
 * Responsibilities:
 *   - Single observable representation of "are we currently signing /
 *     awaiting a stalled signer / resuming after reconnect / expired?".
 *   - Stable per-attempt `attemptId` (uuid) that doubles as the server-side
 *     `submissionId` so creation idempotency keys collapse a resumed retry
 *     onto the same Post row.
 *   - Bounded recovery via a single explicit timer (`RECOVERY_WINDOW_MS`).
 *     A reconnect after expiry never silently autocompletes an attempt.
 *   - Multi-slot semantics gated by `clientFeatureFlags.signingMultiSlot`.
 *     When the flag is OFF (default), every `start()` cancels prior
 *     attempts — exactly the pre-PR-2 single-slot composer behavior. When
 *     ON, attempts coexist up to `MAX_ATTEMPTS` and the oldest
 *     non-foreground is evicted on overflow.
 *
 * Module scope (intentional): every consumer — composer hook, the
 * `nostr-connection-healthy` listener, an unmount/remount of any host
 * component — sees the same set of attempts.
 *
 * History: this module was previously located at
 * `app/features/posts/composer/state/pending-publish.client.ts` and only
 * held a single attempt slot.
 */

import { clientFeatureFlags } from "~/lib/feature-flags.client";
import {
  isConnectionLikeError,
  isSignTimeoutError,
} from "~/lib/signer-error-classification";

import {
  classifyTelemetryError,
  emitSigningTelemetry,
} from "./signing-telemetry.client";

export type PendingPublishState =
  | "idle"
  | "signing"
  | "awaiting_signer"
  | "resuming"
  | "submitting"
  | "completed"
  | "expired"
  | "failed";

/** Forward-looking alias of {@link PendingPublishState}. */
export type SigningAttemptState = PendingPublishState;

/**
 * Durable intents represent a user action whose outcome MUST be replayable
 * across signer reconnect: missing the publish silently is unacceptable.
 * Every durable intent carries an `idempotencyKey` so the server-side dedupe
 * (`/api/publish` `attemptId`, `creationIdempotencyKey`, etc.) can collapse
 * resumed retries onto a single side-effect run.
 */
export type DurableIntentName =
  | "composer_publish"
  | "publish_reply"
  | "publish_quote"
  | "reschedule_post"
  | "publish_dm"
  | "nip65_publish"
  | "long_form_publish"
  | "schedule_repost_quote"
  | "publish_poll_vote";

/**
 * Ephemeral intents represent micro-interactions where a missed sign is
 * recoverable by simply tapping the action again. They have no
 * idempotency key and surface only the subtle/compact UI in PR 4.
 */
export type EphemeralIntentName = "reaction" | "search_engagement_lookup";

/**
 * Tagged-union describing the high-level user intent behind a signing
 * attempt. PR 1 used a flat string union; PR 2 switches to this richer
 * shape so the foreground banner / compact status / subtle pending
 * presentations can dispatch on `kind` and so durable retries get the
 * idempotency key they need.
 */
export type SigningIntent =
  | {
      kind: "durable";
      name: DurableIntentName;
      /**
       * Stable key used by the server-side once-only guard (e.g. the
       * `attemptId` body field on `/api/publish`). MUST be unique per
       * user-intended action; reused across resumes of the same attempt.
       */
      idempotencyKey: string;
      /** Short user-facing label, e.g. "Reschedule post". */
      label: string;
    }
  | {
      kind: "ephemeral";
      name: EphemeralIntentName;
      /** Short user-facing label, e.g. "Like". */
      label: string;
    };

const DEFAULT_INTENT_NAME: DurableIntentName = "composer_publish";
const DEFAULT_INTENT_LABEL = "Publish";
const DEFAULT_SURFACE = "composer";

/**
 * Maximum number of concurrent attempts the store will hold when
 * multi-slot mode is enabled. Above this cap, the oldest non-foreground
 * attempt is evicted (and a `attempt:evicted` telemetry event is emitted).
 *
 * Three slots is enough for a user to: have a reschedule modal pending in
 * the background (slot A), open the composer and submit (slot B,
 * foreground), then click a reaction on a notification (slot C). Anything
 * past that is overflow and the oldest non-foreground is the safest
 * candidate to drop.
 */
export const MAX_ATTEMPTS = 3;

export interface PendingPublishAttempt {
  /**
   * Stable client-generated uuid; used as the server-side `submissionId`.
   *
   * Kept as `id` for backwards compatibility with existing call sites.
   * New code should prefer the {@link PendingPublishAttempt.attemptId}
   * alias, which will become the canonical name once `id` is removed in a
   * later PR.
   */
  id: string;
  /** Forward-looking alias of {@link PendingPublishAttempt.id}. */
  attemptId: string;
  state: PendingPublishState;
  /** Epoch millis when the attempt was started (first sign call). */
  createdAt: number;
  /**
   * Epoch millis after which the attempt is no longer eligible to
   * autocomplete via {@link maybeResume}. Set the first time the attempt
   * enters `awaiting_signer`.
   */
  resumeUntil: number | null;
  /**
   * Epoch millis when the attempt most recently entered `awaiting_signer`.
   * Used by ephemeral-intent UI (PR 4) to flip from a subtle inline
   * spinner to a compact "Resume now" status after
   * {@link EPHEMERAL_ESCALATION_MS}. `null` whenever the attempt is in
   * any other state.
   */
  awaitingSince: number | null;
  /** Last error message surfaced to the UI, when relevant. */
  lastError: string | null;
  /** Tagged-union describing the user intent behind this attempt. */
  intent: SigningIntent;
  /** Free-form label for telemetry / per-row UI selection (e.g. `"composer"`). */
  surface: string;
}

/** Forward-looking alias of {@link PendingPublishAttempt}. */
export type SigningAttempt = PendingPublishAttempt;

interface PendingAttemptInternal extends PendingPublishAttempt {
  /**
   * Generation counter so a late sign rejection from a previous run cannot
   * mutate state belonging to a fresher attempt.
   */
  generation: number;
  /** Active expiry timeout, if any. */
  expiryTimer: ReturnType<typeof setTimeout> | null;
  /** Re-sign callback supplied by the caller; null when the attempt is dormant. */
  resumeSign: ((submissionId: string) => Promise<void>) | null;
  /**
   * Optional liveness check: if returns false on resume, the attempt is
   * silently cancelled instead of re-signed. Used by callers whose
   * underlying resource (deleted post, logged-out user, closed modal) may
   * disappear between sign attempts.
   */
  isResourceAlive: (() => boolean) | null;
}

export interface StartAttemptInput {
  /**
   * Performs the sign + submit. Implementations should call
   * `nostrAdapter.signEvent(..., { clearCacheOnError: false })` followed
   * by the actual publish (fetcher.submit, /api/publish POST, etc.).
   * Throwing a sign timeout / connection error places the attempt in
   * `awaiting_signer`; throwing anything else marks it `failed`.
   *
   * The `submissionId` argument MUST be appended to the FormData/payload
   * (or sent as `attemptId` on `/api/publish`) so the server can dedupe
   * resumed retries.
   */
  performSignAndSubmit: (submissionId: string) => Promise<void>;
  /**
   * Tagged-union describing the user intent behind this attempt. Defaults
   * to a generic durable composer-publish intent so legacy callers that
   * pre-date PR 2 keep working unchanged.
   */
  intent?: SigningIntent;
  /**
   * Free-form label for the surface owning this attempt
   * (e.g. `"composer"`, `"notifications:reply"`). Defaults to
   * `"composer"`.
   */
  surface?: string;
  /**
   * Optional liveness check invoked before {@link maybeResume} re-runs
   * the sign callback. If it returns `false`, the attempt is silently
   * cancelled (and a `attempt:cancelled` telemetry event is emitted with
   * `reason: "resource_gone"`). Use for attempts whose underlying resource
   * may disappear between sign attempts.
   */
  isResourceAlive?: () => boolean;
}

/** 5 minutes — matches the user's chosen recovery scope. */
export const RECOVERY_WINDOW_MS = 5 * 60 * 1000;

/**
 * Threshold after which an ephemeral attempt parked in `awaiting_signer`
 * should escalate from a subtle inline spinner to a compact status pill
 * with explicit Resume / Cancel affordances. Stays well below
 * {@link RECOVERY_WINDOW_MS} so the user gets a chance to act before the
 * window expires, but high enough that a brief signer hiccup never flips
 * the UI tier (today's measured median sign-rpc latency is ~250 ms with
 * a long tail under 4 s).
 *
 * 8 s is the value suggested by the unified-signing-recovery plan; tune
 * via the PR 2 telemetry pipe before locking it in.
 */
export const EPHEMERAL_ESCALATION_MS = 8000;

type Listener = () => void;

const listeners = new Set<Listener>();

const attempts = new Map<string, PendingAttemptInternal>();
let foregroundAttemptId: string | null = null;
let generationCounter = 0;

function emit(): void {
  for (const listener of listeners) listener();
}

function clearExpiryTimer(attempt: PendingAttemptInternal | null): void {
  if (!attempt) return;
  if (attempt.expiryTimer != null) {
    clearTimeout(attempt.expiryTimer);
    attempt.expiryTimer = null;
  }
}

function snapshotOf(
  attempt: PendingAttemptInternal | null
): PendingPublishAttempt | null {
  if (!attempt) return null;
  return {
    id: attempt.id,
    attemptId: attempt.attemptId,
    state: attempt.state,
    createdAt: attempt.createdAt,
    resumeUntil: attempt.resumeUntil,
    awaitingSince: attempt.awaitingSince,
    lastError: attempt.lastError,
    intent: attempt.intent,
    surface: attempt.surface,
  };
}

function buildIntentDefault(): SigningIntent {
  // Legacy callers that don't pass an intent are presumed to be the
  // composer publish flow. Mint a fresh idempotency key so the resulting
  // attempt is still durable-by-default for the server-side guard.
  return {
    kind: "durable",
    name: DEFAULT_INTENT_NAME,
    idempotencyKey: createSubmissionId(),
    label: DEFAULT_INTENT_LABEL,
  };
}

function isTerminalState(state: PendingPublishState): boolean {
  return state === "completed" || state === "failed" || state === "expired";
}

function pickForegroundAttemptId(): string | null {
  // Foreground = most-recently-started attempt currently in the map,
  // regardless of state. Terminal attempts (expired/failed/completed)
  // stay foregrounded so the host UI can keep rendering its banner until
  // the user explicitly dismisses (`cancel()`) or a fresh `start()` pushes
  // the slot out. This matches the pre-PR-2 single-slot behavior.
  //
  // Active (non-terminal) attempts always win over terminal ones so that
  // a fresh sign in flight isn't shadowed by a stale completed snapshot
  // sitting in the map.
  let activeId: string | null = null;
  let activeCreatedAt = -Infinity;
  let terminalId: string | null = null;
  let terminalCreatedAt = -Infinity;
  // Map iteration is insertion order, so `>=` makes ties resolve to the
  // most-recently inserted attempt — important when several attempts are
  // started inside the same Date.now() tick (e.g. fake-timer tests, or
  // a synchronous batch of producers).
  for (const [id, attempt] of attempts) {
    if (isTerminalState(attempt.state)) {
      if (attempt.createdAt >= terminalCreatedAt) {
        terminalCreatedAt = attempt.createdAt;
        terminalId = id;
      }
    } else if (attempt.createdAt >= activeCreatedAt) {
      activeCreatedAt = attempt.createdAt;
      activeId = id;
    }
  }
  return activeId ?? terminalId;
}

function refreshForegroundAttemptId(): void {
  foregroundAttemptId = pickForegroundAttemptId();
}

function pickEvictionVictim(): PendingAttemptInternal | null {
  // Evict the oldest attempt that is NOT the current foreground. Among
  // ties, prefer terminal-state attempts so we drop the cheapest-to-lose
  // slot first.
  let victim: PendingAttemptInternal | null = null;
  for (const [id, attempt] of attempts) {
    if (id === foregroundAttemptId) continue;
    if (!victim) {
      victim = attempt;
      continue;
    }
    const victimIsTerminal = isTerminalState(victim.state);
    const candidateIsTerminal = isTerminalState(attempt.state);
    if (candidateIsTerminal && !victimIsTerminal) {
      victim = attempt;
      continue;
    }
    if (victimIsTerminal && !candidateIsTerminal) continue;
    if (attempt.createdAt < victim.createdAt) victim = attempt;
  }
  return victim;
}

const TELEMETRY_EVENT_EXPIRED = "attempt:expired";
const TELEMETRY_EVENT_CANCELLED = "attempt:cancelled";

type TelemetryEventName =
  | "attempt:started"
  | "attempt:signed"
  | "attempt:submit_ok"
  | "attempt:submit_fail"
  | "attempt:awaiting_signer"
  | "attempt:resumed"
  | typeof TELEMETRY_EVENT_EXPIRED
  | "attempt:evicted"
  | typeof TELEMETRY_EVENT_CANCELLED
  | "attempt:fatal";

function emitTelemetry(
  attempt: PendingAttemptInternal,
  name: TelemetryEventName,
  extra: Record<string, unknown> = {}
): void {
  const at = Date.now();
  emitSigningTelemetry(name, {
    attemptId: attempt.attemptId,
    intentName: attempt.intent.name,
    intentKind: attempt.intent.kind,
    surface: attempt.surface,
    at,
    elapsed_ms: at - attempt.createdAt,
    ...extra,
  });
}

let lastSnapshotKey = "";
let lastSnapshot: PendingPublishAttempt | null = null;

function snapshotKeyFor(attempt: PendingAttemptInternal | null): string {
  if (!attempt) return "";
  return `${attempt.id}:${attempt.state}:${attempt.createdAt}:${attempt.resumeUntil ?? "x"}:${attempt.awaitingSince ?? "x"}:${attempt.lastError ?? ""}:${attempt.intent.kind}:${attempt.intent.name}:${attempt.surface}`;
}

export function getSnapshot(): PendingPublishAttempt | null {
  // Stable snapshot: useSyncExternalStore relies on referential equality
  // when nothing observable has changed. We always render the foreground
  // attempt; per-row consumers should use getAttemptsForSurface() instead.
  const fg = foregroundAttemptId
    ? (attempts.get(foregroundAttemptId) ?? null)
    : null;
  const key = snapshotKeyFor(fg);
  if (key !== lastSnapshotKey) {
    lastSnapshotKey = key;
    lastSnapshot = snapshotOf(fg);
  }
  return lastSnapshot;
}

/** Forward-looking alias of {@link getSnapshot}. */
export function getForegroundAttempt(): PendingPublishAttempt | null {
  return getSnapshot();
}

/**
 * Read all attempts currently registered for `surface`, oldest first.
 * Used by per-row UI (e.g. notifications list) to render compact status
 * indicators alongside individual targets.
 */
export function getAttemptsForSurface(
  surface: string
): PendingPublishAttempt[] {
  const out: PendingPublishAttempt[] = [];
  for (const attempt of attempts.values()) {
    if (attempt.surface !== surface) continue;
    const snap = snapshotOf(attempt);
    if (snap) out.push(snap);
  }
  out.sort((a, b) => a.createdAt - b.createdAt);
  return out;
}

/**
 * Read all attempts currently registered, oldest first. Primarily for
 * tests and dev-tools panels.
 */
export function getAllAttempts(): PendingPublishAttempt[] {
  const out: PendingPublishAttempt[] = [];
  for (const attempt of attempts.values()) {
    const snap = snapshotOf(attempt);
    if (snap) out.push(snap);
  }
  out.sort((a, b) => a.createdAt - b.createdAt);
  return out;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Generate a fresh client submissionId. Exported for callers that want
 * the id before they actually start an attempt (e.g. building an
 * optimistic UI tag).
 */
export function createSubmissionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without WebCrypto (older Safari, jsdom).
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

function classifySignError(error: unknown): "signer_unavailable" | "fatal" {
  if (isSignTimeoutError(error) || isConnectionLikeError(error)) {
    return "signer_unavailable";
  }
  return "fatal";
}

function scheduleExpiryTimer(attempt: PendingAttemptInternal): void {
  clearExpiryTimer(attempt);
  if (attempt.resumeUntil == null) return;
  const remaining = Math.max(0, attempt.resumeUntil - Date.now());
  attempt.expiryTimer = setTimeout(() => {
    const stored = attempts.get(attempt.attemptId);
    if (stored !== attempt) return;
    if (attempt.state !== "awaiting_signer") return;
    attempt.state = "expired";
    attempt.awaitingSince = null;
    attempt.expiryTimer = null;
    emitTelemetry(attempt, TELEMETRY_EVENT_EXPIRED);
    refreshForegroundAttemptId();
    emit();
  }, remaining);
}

async function runAttempt(
  attempt: PendingAttemptInternal,
  performSignAndSubmit: (submissionId: string) => Promise<void>
): Promise<void> {
  const wasIdle = attempt.state === "idle";
  attempt.state = wasIdle ? "signing" : "resuming";
  attempt.lastError = null;
  // Leaving `awaiting_signer` (either by user-driven resume or by the
  // healthy-event listener) — clear the escalation anchor so the
  // ephemeral UI tier reverts to the subtle spinner for the resume.
  attempt.awaitingSince = null;
  if (!wasIdle) emitTelemetry(attempt, "attempt:resumed");
  refreshForegroundAttemptId();
  emit();
  try {
    await performSignAndSubmit(attempt.id);
    if (attempts.get(attempt.attemptId) !== attempt) return;
    attempt.state = "submitting";
    clearExpiryTimer(attempt);
    emitTelemetry(attempt, "attempt:signed");
    refreshForegroundAttemptId();
    emit();
  } catch (error) {
    if (attempts.get(attempt.attemptId) !== attempt) return;
    const kind = classifySignError(error);
    attempt.lastError = error instanceof Error ? error.message : String(error);
    if (kind === "signer_unavailable") {
      attempt.resumeUntil ??= Date.now() + RECOVERY_WINDOW_MS;
      if (Date.now() >= attempt.resumeUntil) {
        attempt.state = "expired";
        attempt.awaitingSince = null;
        clearExpiryTimer(attempt);
        emitTelemetry(attempt, TELEMETRY_EVENT_EXPIRED);
      } else {
        attempt.state = "awaiting_signer";
        attempt.awaitingSince = Date.now();
        scheduleExpiryTimer(attempt);
        emitTelemetry(attempt, "attempt:awaiting_signer", {
          error_class: classifyTelemetryError(error),
        });
      }
    } else {
      attempt.state = "failed";
      attempt.awaitingSince = null;
      clearExpiryTimer(attempt);
      emitTelemetry(attempt, "attempt:fatal", {
        error_class: classifyTelemetryError(error),
      });
    }
    refreshForegroundAttemptId();
    emit();
  }
}

function evictIfOverCap(): void {
  while (attempts.size > MAX_ATTEMPTS) {
    const victim = pickEvictionVictim();
    if (!victim) return;
    clearExpiryTimer(victim);
    attempts.delete(victim.attemptId);
    emitTelemetry(victim, "attempt:evicted", { reason: "over_cap" });
  }
}

function cancelAllExisting(reason: string): void {
  for (const attempt of Array.from(attempts.values())) {
    clearExpiryTimer(attempt);
    attempt.generation = ++generationCounter;
    emitTelemetry(attempt, TELEMETRY_EVENT_CANCELLED, { reason });
  }
  attempts.clear();
  foregroundAttemptId = null;
}

function cancelExistingDurables(reason: string): void {
  for (const attempt of Array.from(attempts.values())) {
    if (attempt.intent.kind !== "durable") continue;
    clearExpiryTimer(attempt);
    attempt.generation = ++generationCounter;
    emitTelemetry(attempt, TELEMETRY_EVENT_CANCELLED, { reason });
    attempts.delete(attempt.attemptId);
  }
  refreshForegroundAttemptId();
}

/**
 * Start a fresh signing attempt.
 *
 * Behavior depends on `clientFeatureFlags.signingMultiSlot` AND the
 * incoming intent kind:
 *   - **Multi-slot ON:** the new attempt is added to the multi-slot map.
 *     If the cap is exceeded, the oldest non-foreground attempt is
 *     evicted.
 *   - **Multi-slot OFF, durable intent:** every prior DURABLE attempt is
 *     cancelled (generations bumped so late callbacks become no-ops)
 *     before the new attempt is registered. Existing ephemeral attempts
 *     are left in place. This preserves the pre-PR-2 single-slot
 *     composer behavior for the durable foreground while still letting
 *     ephemeral micro-actions (PR 4 reactions/likes) coexist with an
 *     in-flight composer publish — clicking "Like" must not cancel a
 *     foreground reschedule or compose.
 *   - **Multi-slot OFF, ephemeral intent:** the new attempt is added
 *     additively. Multi-slot eviction (LRU over `MAX_ATTEMPTS`) still
 *     applies as a defensive backstop.
 *
 * Returns the attempt's `attemptId` (also the server-side `submissionId`)
 * so the caller can also embed it directly in the payload if it builds
 * one before the resume callback runs.
 */
export function start(input: StartAttemptInput): string {
  const intent = input.intent ?? buildIntentDefault();
  if (!clientFeatureFlags.signingMultiSlot && intent.kind === "durable") {
    cancelExistingDurables("replaced_single_slot");
  }
  const id = createSubmissionId();
  const surface = input.surface ?? DEFAULT_SURFACE;
  const attempt: PendingAttemptInternal = {
    id,
    attemptId: id,
    state: "idle",
    createdAt: Date.now(),
    resumeUntil: null,
    awaitingSince: null,
    lastError: null,
    intent,
    surface,
    generation: ++generationCounter,
    expiryTimer: null,
    resumeSign: input.performSignAndSubmit,
    isResourceAlive: input.isResourceAlive ?? null,
  };
  attempts.set(id, attempt);
  evictIfOverCap();
  refreshForegroundAttemptId();
  emitTelemetry(attempt, "attempt:started");
  void runAttempt(attempt, input.performSignAndSubmit);
  return attempt.id;
}

function maybeResumeAttempt(attempt: PendingAttemptInternal): boolean {
  if (attempt.state !== "awaiting_signer") return false;
  if (attempt.resumeUntil != null && Date.now() >= attempt.resumeUntil) {
    attempt.state = "expired";
    attempt.awaitingSince = null;
    clearExpiryTimer(attempt);
    emitTelemetry(attempt, TELEMETRY_EVENT_EXPIRED);
    refreshForegroundAttemptId();
    emit();
    return false;
  }
  if (attempt.isResourceAlive && !attempt.isResourceAlive()) {
    clearExpiryTimer(attempt);
    attempt.generation = ++generationCounter;
    emitTelemetry(attempt, TELEMETRY_EVENT_CANCELLED, {
      reason: "resource_gone",
    });
    attempts.delete(attempt.attemptId);
    refreshForegroundAttemptId();
    emit();
    return false;
  }
  const sign = attempt.resumeSign;
  if (!sign) return false;
  void runAttempt(attempt, sign);
  return true;
}

/**
 * Triggered from the `nostr-connection-healthy` listener.
 *
 *   - Single-slot mode: re-runs the foreground attempt's sign callback if
 *     it is parked in `awaiting_signer` and still inside its window.
 *   - Multi-slot mode: re-runs every parked attempt in `createdAt` order,
 *     so a backgrounded reschedule and a foreground composer publish both
 *     resume on the same healthy event.
 *
 * Returns true when at least one resume actually started.
 */
export function maybeResume(): boolean {
  const ordered = Array.from(attempts.values()).sort(
    (a, b) => a.createdAt - b.createdAt
  );
  let resumedAny = false;
  for (const attempt of ordered) {
    if (maybeResumeAttempt(attempt)) resumedAny = true;
  }
  return resumedAny;
}

/**
 * Cancel the foreground attempt and bump its generation so any late sign
 * completion can no longer mutate the store. Safe to call multiple times.
 *
 * In multi-slot mode this only affects the foreground attempt; use
 * {@link cancelAttempt} to cancel a specific attempt by id, or
 * {@link cancelAll} to wipe everything.
 */
export function cancel(): void {
  const fgId = foregroundAttemptId;
  if (!fgId) return;
  const attempt = attempts.get(fgId);
  if (!attempt) return;
  clearExpiryTimer(attempt);
  attempt.generation = ++generationCounter;
  emitTelemetry(attempt, TELEMETRY_EVENT_CANCELLED, { reason: "user_cancel" });
  attempts.delete(fgId);
  refreshForegroundAttemptId();
  emit();
}

/** Cancel a specific attempt by id. Idempotent. */
export function cancelAttempt(attemptId: string): void {
  const attempt = attempts.get(attemptId);
  if (!attempt) return;
  clearExpiryTimer(attempt);
  attempt.generation = ++generationCounter;
  emitTelemetry(attempt, TELEMETRY_EVENT_CANCELLED, { reason: "user_cancel" });
  attempts.delete(attemptId);
  refreshForegroundAttemptId();
  emit();
}

/** Cancel every attempt in the store. */
export function cancelAll(): void {
  cancelAllExisting("cancel_all");
  emit();
}

/**
 * Mark an attempt as completed once the server submission has succeeded
 * (status 2xx). Idempotent. Identifies the attempt by its `submissionId`,
 * so a stale callback from a generation we already replaced is ignored.
 */
export function markCompleted(submissionId: string): void {
  const attempt = attempts.get(submissionId);
  if (!attempt) return;
  clearExpiryTimer(attempt);
  attempt.state = "completed";
  attempt.awaitingSince = null;
  attempt.lastError = null;
  emitTelemetry(attempt, "attempt:submit_ok");
  refreshForegroundAttemptId();
  emit();
}

/**
 * Mark an attempt as failed when the server returns a non-recoverable
 * error (4xx/5xx other than the signer-unavailable family). Idempotent.
 */
export function markFailed(submissionId: string, message: string): void {
  const attempt = attempts.get(submissionId);
  if (!attempt) return;
  clearExpiryTimer(attempt);
  attempt.state = "failed";
  attempt.awaitingSince = null;
  attempt.lastError = message;
  emitTelemetry(attempt, "attempt:submit_fail", {
    error_class: "submit_fail",
  });
  refreshForegroundAttemptId();
  emit();
}

/**
 * True when ANY attempt in the store is in an "in flight" state — still
 * signing, parked awaiting reconnect, resuming, or already handed off to
 * the server. Reconnect / "looks-idle" code paths MUST consult this
 * before they tear down host UI state, otherwise the user is tempted to
 * click again and race a new submission against the original (the
 * duplicate-publish bug PR 1 fixed).
 */
export function isActiveAttempt(): boolean {
  for (const attempt of attempts.values()) {
    const state = attempt.state;
    if (
      state === "signing" ||
      state === "awaiting_signer" ||
      state === "resuming" ||
      state === "submitting"
    ) {
      return true;
    }
  }
  return false;
}

/** Convenience helpers for tests and consumers that prefer namespaced access. */
export const pendingPublish = {
  start,
  cancel,
  cancelAttempt,
  cancelAll,
  maybeResume,
  markCompleted,
  markFailed,
  getSnapshot,
  getForegroundAttempt,
  getAttemptsForSurface,
  getAllAttempts,
  subscribe,
  createSubmissionId,
  isActiveAttempt,
};

/**
 * Forward-looking alias for the consolidated namespace. Callers added in
 * PR 2 onward should prefer `signingAttempts.*` over `pendingPublish.*`.
 */
export const signingAttempts = pendingPublish;

/**
 * Test-only helper to wipe the store between cases. Not exported through
 * the default object so production callers cannot accidentally reset
 * state.
 */
export function _resetForTests(): void {
  for (const attempt of attempts.values()) clearExpiryTimer(attempt);
  attempts.clear();
  foregroundAttemptId = null;
  listeners.clear();
  lastSnapshotKey = "";
  lastSnapshot = null;
  generationCounter = 0;
}
