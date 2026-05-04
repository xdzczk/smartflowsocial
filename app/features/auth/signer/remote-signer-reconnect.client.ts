/**
 * Remote signer reconnect events and dialog control.
 *
 * Probe error taxonomy: REMOTE_SIGNER_TIMEOUT_EVENT / RemoteSignerTimeoutError means "signer
 * offline or timeout". Do not auto-open the reconnect dialog on this event alone (e.g. when
 * Primal is closed and probe fails). The reconnect dialog is opened only via
 * emitOpenRemoteSignerReconnectDialogEvent()  -  e.g. explicit "Reconnect" in composer/Settings,
 * primary signer failover having run and failed, or future unauthorized/malformed bunker handling.
 */
export const REMOTE_SIGNER_TIMEOUT_EVENT = "smartflow:remote-signer-timeout";
export const OPEN_REMOTE_SIGNER_RECONNECT_DIALOG_EVENT =
  "smartflow:open-remote-signer-reconnect-dialog";

export interface RemoteSignerTimeoutEventDetail {
  message?: string;
}

export type ReconnectDialogOpenMode = "default" | "new_session";

export interface OpenRemoteSignerReconnectDialogEventDetail {
  mode?: ReconnectDialogOpenMode;
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

export function emitOpenRemoteSignerReconnectDialogEvent(
  detail: OpenRemoteSignerReconnectDialogEventDetail = {}
): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent<OpenRemoteSignerReconnectDialogEventDetail>(
        OPEN_REMOTE_SIGNER_RECONNECT_DIALOG_EVENT,
        { detail }
      )
    );
  } catch {
    // ignore
  }
}
