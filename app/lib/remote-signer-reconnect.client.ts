export const REMOTE_SIGNER_TIMEOUT_EVENT = "smartflow:remote-signer-timeout";

export interface RemoteSignerTimeoutEventDetail {
  message?: string;
}

export function emitRemoteSignerTimeoutEvent(
  detail: RemoteSignerTimeoutEventDetail = {}
): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent<RemoteSignerTimeoutEventDetail>(
        REMOTE_SIGNER_TIMEOUT_EVENT,
        { detail }
      )
    );
  } catch {
    // ignore
  }
}
