/**
 * Classifiers for signer-related errors.
 *
 * Extracted from `nostr-adapter.client.ts` so the composer pending-publish
 * state machine can share the same definitions of "signer is unavailable
 * (resumable)" vs "transport is broken" vs "the bunker actually rejected the
 * sign request".
 *
 * Keeping the predicates in one place ensures the state machine and the
 * adapter agree about which errors should land an attempt in
 * `awaiting_signer` (resumable) versus `failed` (terminal).
 */

import { RemoteSignerTimeoutError } from "~/lib/errors";

// Keep these strings byte-identical to the ones in `nostr-adapter.client.ts`
// so the two modules classify the same `RemoteSignerTimeoutError` messages.
const SIGN_TIMEOUT_KEY_DID_NOT_RESPOND = "did not respond";
const SIGN_TIMEOUT_KEY_APPROVE_REQUEST = "approve the request";

function isBunkerRpcTimeoutMessage(message: string): boolean {
  const m = message.toLowerCase();
  return m.startsWith("bunker:") && m.endsWith(" timeout");
}

/**
 * True when the error indicates the bunker app received the sign request but
 * never approved it (user dismissed, screen locked, etc). The transport is
 * still healthy; only the human approval path failed.
 */
export function isSignTimeoutError(error: unknown): boolean {
  if (!(error instanceof RemoteSignerTimeoutError)) return false;
  const m = error.message.toLowerCase();
  return (
    m.includes(SIGN_TIMEOUT_KEY_DID_NOT_RESPOND) ||
    m.includes(SIGN_TIMEOUT_KEY_APPROVE_REQUEST) ||
    isBunkerRpcTimeoutMessage(error.message)
  );
}

/**
 * True when the error looks like the underlying NIP-46 transport (websocket,
 * relay subscription, connect handshake) has dropped or is timing out at the
 * connection layer.
 *
 * Sign timeouts (the bunker simply didn't approve) are deliberately NOT
 * connection-like — the transport is still healthy.
 */
export function isConnectionLikeError(error: unknown): boolean {
  if (error instanceof RemoteSignerTimeoutError) {
    return !isSignTimeoutError(error);
  }
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  if (isBunkerRpcTimeoutMessage(message)) return false;
  return (
    message.includes("subscription closed") ||
    message.includes("websocket") ||
    message.includes("closed") ||
    message.includes("connection") ||
    message.includes("connecting") ||
    message.includes("timeout") ||
    message.includes("too long")
  );
}
