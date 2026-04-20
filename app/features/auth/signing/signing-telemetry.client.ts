/**
 * Signing-attempts telemetry pipe.
 *
 * Emits structured lifecycle events for every signing attempt so PR 2's
 * recovery story can be measured in production:
 *   - what fraction of attempts hit awaiting_signer?
 *   - how long do they sit there before they resume / expire?
 *   - is the ephemeral escalation threshold (PR 4) right?
 *   - did dedupe ever trigger (`/api/publish` `deduped: true`)?
 *
 * PRIVACY (must stay true; no exception):
 *   - No event content. No recipient pubkeys. No zap amounts. No DM
 *     ciphertext. No relay URLs. No signed event payloads.
 *   - Identifiers we DO emit: a per-attempt UUID (client-only), the intent
 *     name, the surface label, and bounded categorical error classes.
 *   - Anything that could carry user content or recipient identity must
 *     be reduced to a category before it crosses this boundary.
 *
 * Transport: a `CustomEvent` on `window` (mirrors the existing
 * `smartflow:composer-analytics` pattern). Downstream sinks (logger,
 * analytics SDK) can subscribe without coupling to this module. SSR-safe:
 * a missing `window` is a no-op.
 */

import type { SigningIntent } from "./signing-attempts.client";

const SIGNING_TELEMETRY_EVENT = "smartflow:signing-telemetry";

export type SigningTelemetryEventName =
  | "attempt:started"
  | "attempt:signed"
  | "attempt:submit_ok"
  | "attempt:submit_fail"
  | "attempt:awaiting_signer"
  | "attempt:resumed"
  | "attempt:expired"
  | "attempt:evicted"
  | "attempt:cancelled"
  | "attempt:fatal";

export interface SigningTelemetryPayloadBase {
  attemptId: string;
  intentName: string;
  intentKind: SigningIntent["kind"];
  surface: string;
  /** Epoch millis at the moment the event is emitted. */
  at: number;
}

export interface SigningTelemetryPayloadWithTiming extends SigningTelemetryPayloadBase {
  /** Milliseconds since the attempt was started. */
  elapsed_ms: number;
}

export interface SigningTelemetryEventDetail {
  name: SigningTelemetryEventName;
  payload: Record<string, unknown> & SigningTelemetryPayloadBase;
}

/**
 * Emit a single telemetry event. Safe to call from any signing-attempt
 * lifecycle transition. SSR / non-DOM environments are a no-op.
 */
export function emitSigningTelemetry(
  name: SigningTelemetryEventName,
  payload: Record<string, unknown> & SigningTelemetryPayloadBase
): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent<SigningTelemetryEventDetail>(SIGNING_TELEMETRY_EVENT, {
        detail: { name, payload },
      })
    );
  } catch {
    // Telemetry must never throw into the signing path. If a custom-event
    // dispatch fails (e.g. exotic test polyfill), silently drop the event.
  }
}

export { SIGNING_TELEMETRY_EVENT };

/**
 * Subscribe to signing telemetry events from the host page (logger sink,
 * analytics SDK adapter, dev tools panel, etc.). Returns an unsubscribe
 * thunk. SSR-safe: returns a no-op unsubscriber when `window` is missing.
 */
export function onSigningTelemetry(
  listener: (detail: SigningTelemetryEventDetail) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {
      /* no-op */
    };
  }
  const handler = (event: Event): void => {
    const customEvent = event as CustomEvent<SigningTelemetryEventDetail>;
    try {
      listener(customEvent.detail);
    } catch {
      // Sink errors must never bubble back into the dispatcher.
    }
  };
  window.addEventListener(SIGNING_TELEMETRY_EVENT, handler);
  return () => window.removeEventListener(SIGNING_TELEMETRY_EVENT, handler);
}

/**
 * Reduce an arbitrary thrown value to a bounded categorical error class so
 * it can be safely emitted as telemetry without leaking message text.
 */
export function classifyTelemetryError(error: unknown): string {
  if (error == null) return "unknown";
  if (typeof error !== "object") return "non_error_throw";
  const ctor = (error as { constructor?: { name?: string } }).constructor;
  return typeof ctor?.name === "string" && ctor.name.length > 0
    ? ctor.name
    : "Error";
}
