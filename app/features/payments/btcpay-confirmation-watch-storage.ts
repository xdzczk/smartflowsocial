export const BTCPAY_CONFIRMATION_WATCH_STORAGE_KEY =
  "smartflow_btcpay_confirmation_watch";

const STORAGE_KEY = BTCPAY_CONFIRMATION_WATCH_STORAGE_KEY;

function notifyWatchChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("smartflow:btcpay-confirmation-watch"));
}

export interface BtcpayConfirmationWatchEntry {
  paymentId: string;
  expiresAt: string;
}

export function readBtcpayConfirmationWatch(): BtcpayConfirmationWatchEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    const paymentId =
      typeof o["paymentId"] === "string" ? o["paymentId"] : null;
    const expiresAt =
      typeof o["expiresAt"] === "string" ? o["expiresAt"] : null;
    if (!paymentId || !expiresAt) return null;
    return { paymentId, expiresAt };
  } catch {
    return null;
  }
}

export function writeBtcpayConfirmationWatch(
  entry: BtcpayConfirmationWatchEntry
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    notifyWatchChanged();
  } catch {
    /* quota / private mode */
  }
}

export function clearBtcpayConfirmationWatch(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    notifyWatchChanged();
  } catch {
    /* ignore */
  }
}

export function clearBtcpayConfirmationWatchIfMatches(paymentId: string): void {
  const cur = readBtcpayConfirmationWatch();
  if (cur?.paymentId === paymentId) {
    clearBtcpayConfirmationWatch();
  }
}
