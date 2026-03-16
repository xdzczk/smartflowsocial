import { isMobile } from "~/lib/is-mobile";
import { convertHexToNpub } from "~/lib/nostr-conversion";

export type LoginState =
  | "signer_selection"
  | "signer_initializing"
  | "awaiting_profile_selection"
  | "requesting_signature"
  | "verifying_signature"
  | "authenticated"
  | "failed";

export type ActiveSignerFlow = "nip07" | "nip46" | null;

export type RelayCheckStatus = "checking" | "connected" | "failed";

export interface RelayStatus {
  url: string;
  status: RelayCheckStatus;
  checkedAt: number;
  error?: string;
}

export type LoginError =
  | "SIGNER_NOT_FOUND"
  | "SIGNER_CONNECTION_DROPPED"
  | "PERMISSION_DENIED"
  | "PROFILE_NOT_APPROVED"
  | "SIGNER_TIMEOUT"
  | "SIGNATURE_INVALID"
  | "CHALLENGE_EXPIRED"
  | "PROFILE_MISMATCH"
  | "UNKNOWN";

export const PROFILE_MISMATCH_MESSAGE =
  "Different signer profile detected — re-authentication required";

/** Delay before resuming NIP-46 after visibility return; longer on mobile to let WebSockets stabilize. */
export function getResumeDelayMs(): number {
  return isMobile() ? 800 : 500;
}

export function formatNpubShort(pubkeyHex?: string | null): string {
  if (!pubkeyHex) return "";
  const npub = pubkeyHex.startsWith("npub")
    ? pubkeyHex
    : convertHexToNpub(pubkeyHex);
  if (npub.length <= 20) return npub;
  return `${npub.slice(0, 12)}...${npub.slice(-8)}`;
}

export function getErrorTitle(code: LoginError): string {
  switch (code) {
    case "SIGNER_NOT_FOUND":
      return "No signer detected";
    case "SIGNER_CONNECTION_DROPPED":
      return "Couldn't connect to remote signer";
    case "SIGNER_TIMEOUT":
      return "Approval timed out";
    case "PERMISSION_DENIED":
      return "Permission denied";
    case "PROFILE_MISMATCH":
      return "Wrong signer profile";
    case "CHALLENGE_EXPIRED":
      return "Login expired";
    case "SIGNATURE_INVALID":
      return "Signature invalid";
    default:
      return "Sign-in failed";
  }
}

export function getErrorSuggestions(
  code: LoginError,
  context?: {
    relayStatuses?: Record<string, RelayStatus>;
    retryCount?: number;
    lastFailureOrigin?: "nip07_init" | "nip46_init" | "verify" | null;
  }
): string[] {
  const suggestions: string[] = [];

  switch (code) {
    case "SIGNER_NOT_FOUND":
      suggestions.push(
        "Install/enable a NIP-07 browser extension, or use Remote Signer (NIP-46)."
      );
      break;
    case "SIGNER_CONNECTION_DROPPED":
      suggestions.push("Try again.");
      if (
        typeof navigator !== "undefined" &&
        /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        )
      ) {
        suggestions.push(
          "On mobile, after approving in the signer app, return here and tap Try again — the same connection string is reused."
        );
      }

      if (context?.relayStatuses) {
        const failedRelays = Object.values(context.relayStatuses).filter(
          (s) => s.status === "failed"
        );
        if (failedRelays.length > 0) {
          suggestions.push(
            `Remove ${failedRelays.length} unreachable relay${failedRelays.length > 1 ? "s" : ""} or add alternatives in the relay list.`
          );
        }
      }

      if (context?.retryCount && context.retryCount >= 2) {
        suggestions.push(
          "If your signer supports it, try the bunker input method instead."
        );
      } else {
        suggestions.push(
          "Remove unreachable relays or add alternatives in the relay list."
        );
        suggestions.push(
          "If your signer supports it, try the bunker input method instead."
        );
      }
      break;
    case "SIGNER_TIMEOUT":
      suggestions.push(
        "Approve the request in your remote signer, then try again."
      );
      if (context?.relayStatuses) {
        const failedRelays = Object.values(context.relayStatuses).filter(
          (s) => s.status === "failed"
        );
        if (failedRelays.length > 0) {
          suggestions.push(
            "Update your relay list to remove unreachable relays and retry."
          );
        } else {
          suggestions.push(
            "If approval gets stuck, update your relay list and retry."
          );
        }
      } else {
        suggestions.push(
          "If approval gets stuck, update your relay list and retry."
        );
      }
      break;
    case "PERMISSION_DENIED":
      suggestions.push(
        "Approve the permission request in your signer/extension, then try again."
      );
      break;
    case "PROFILE_MISMATCH":
      suggestions.push(
        "Switch to the expected signer profile in your signer, then try again."
      );
      break;
    case "CHALLENGE_EXPIRED":
      suggestions.push("Try again to fetch a new login challenge.");
      break;
    case "SIGNATURE_INVALID":
      suggestions.push(
        "Make sure you approved the signature request in the correct signer profile, then try again."
      );
      break;
    default:
      suggestions.push(
        "Try again, or go back and select a different sign-in method."
      );
  }

  return suggestions;
}

const SUBSCRIPTION_CLOSED_ERROR = "subscription closed";

/** Classify error for intelligent retry strategy */
export function classifyErrorForRetry(error: {
  code: LoginError;
  message: string;
  details?: string;
}): {
  shouldRetry: boolean;
  retryStrategy: "exponential_backoff" | "progressive_timeout" | "none";
  isNetworkError: boolean;
  isTimeoutError: boolean;
  isPermissionError: boolean;
} {
  const code = error.code;
  const message = error.message.toLowerCase();
  const details = error.details?.toLowerCase() ?? "";

  const isNetworkError =
    code === "SIGNER_CONNECTION_DROPPED" ||
    message.includes("network") ||
    message.includes("connection") ||
    message.includes("websocket") ||
    details.includes(SUBSCRIPTION_CLOSED_ERROR);

  const isTimeoutError =
    code === "SIGNER_TIMEOUT" || message.includes("timeout");

  const isPermissionError =
    code === "PERMISSION_DENIED" || message.includes("denied");

  const shouldRetry =
    isNetworkError || isTimeoutError || code === "CHALLENGE_EXPIRED";

  const retryStrategy = isNetworkError
    ? "exponential_backoff"
    : isTimeoutError
      ? "progressive_timeout"
      : "none";

  return {
    shouldRetry,
    retryStrategy,
    isNetworkError,
    isTimeoutError,
    isPermissionError,
  };
}

export function getRelayStatusLabel(status: RelayCheckStatus): string {
  switch (status) {
    case "checking":
      return "Checking…";
    case "connected":
      return "Connected";
    case "failed":
      return "Failed";
  }
}

export function normalizeError(err: unknown): {
  code: LoginError;
  message: string;
  details?: string;
} {
  const fallback = {
    code: "UNKNOWN" as const,
    message: "Login failed",
    details: undefined,
  };
  if (err instanceof Error) {
    const msg = err.message || fallback.message;
    const msgLower = msg.toLowerCase();
    if (
      msgLower.includes("subscription closed") ||
      msgLower.includes("websocket") ||
      msgLower.includes("closing") ||
      msgLower.includes("closed state") ||
      msgLower.includes("signer is not open") ||
      msgLower.includes("not open anymore") ||
      msgLower.includes("create a new one")
    ) {
      return {
        code: "SIGNER_CONNECTION_DROPPED",
        message:
          "Connection to the remote signer was closed before approval completed. Try again, or update your relay list.",
        details: msg,
      };
    }
    if (msg.includes("SIGNER_NOT_FOUND")) {
      return {
        code: "SIGNER_NOT_FOUND",
        message: "No Nostr signer detected",
        details: msg,
      };
    }
    if (msg.includes("SIGNER_TIMEOUT")) {
      return {
        code: "SIGNER_TIMEOUT",
        message: "No approval received in time",
        details: msg,
      };
    }
    if (msgLower.includes("denied")) {
      return {
        code: "PERMISSION_DENIED",
        message: "Access denied",
        details: msg,
      };
    }
    return { code: "UNKNOWN", message: msg, details: msg };
  }
  return fallback;
}
