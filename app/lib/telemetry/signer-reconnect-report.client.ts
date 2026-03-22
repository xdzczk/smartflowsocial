/**
 * Best-effort server logging for NIP-46 background reconnect outcomes.
 */

export type SignerReconnectFailureBucketClient =
  | "TIMEOUT"
  | "NETWORK"
  | "SESSION_DROPPED"
  | "UNKNOWN";

const SUCCESS_BEACON_MIN_MS = 10 * 60 * 1000;
const SUCCESS_TS_KEY = "__sfs_signer_reconnect_ok_ts";
const SIGNER_RECONNECT_API = "/api/signer-reconnect";

function allowSuccessBeacon(): boolean {
  try {
    const last = Number(sessionStorage.getItem(SUCCESS_TS_KEY) ?? "0");
    if (Date.now() - last < SUCCESS_BEACON_MIN_MS) return false;
    sessionStorage.setItem(SUCCESS_TS_KEY, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

function postJson(path: string, body: unknown): void {
  if (typeof window === "undefined") return;
  void (async () => {
    try {
      await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      /* ignore */
    }
  })();
}

export function reportSignerReconnectOutcome(input: {
  success: boolean;
  failureBucket?: SignerReconnectFailureBucketClient;
}): void {
  if (input.success && !allowSuccessBeacon()) return;
  postJson(SIGNER_RECONNECT_API, {
    success: input.success,
    ...(input.success
      ? {}
      : { failureBucket: input.failureBucket ?? "UNKNOWN" }),
  });
}

export function mapReconnectErrorToBucket(
  err: unknown
): SignerReconnectFailureBucketClient {
  const msg =
    err instanceof Error
      ? err.message.toLowerCase()
      : String(err).toLowerCase();
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return "TIMEOUT";
  }
  if (
    msg.includes("network") ||
    msg.includes("websocket") ||
    msg.includes("connection")
  ) {
    return "NETWORK";
  }
  if (
    msg.includes("session") ||
    msg.includes("closed") ||
    msg.includes("dropped")
  ) {
    return "SESSION_DROPPED";
  }
  return "UNKNOWN";
}
