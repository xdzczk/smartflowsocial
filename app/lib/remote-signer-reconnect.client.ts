export const REMOTE_SIGNER_TIMEOUT_EVENT = "smartflow:remote-signer-timeout";
export const OPEN_REMOTE_SIGNER_RECONNECT_DIALOG_EVENT =
  "smartflow:open-remote-signer-reconnect-dialog";

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

export function emitOpenRemoteSignerReconnectDialogEvent(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(OPEN_REMOTE_SIGNER_RECONNECT_DIALOG_EVENT)
    );
  } catch {
    // ignore
  }
}
