/** Extra characters appended to each broadcast DM (footer + unsubscribe URL). */
export const BROADCAST_UNSUBSCRIBE_FOOTER_RESERVE_CHARS = 280;

/** Max plaintext length for kind 4 + footer (matches broadcast messageBody budget). */
export const BROADCAST_PLAINTEXT_MAX_CHARS = 8000;

export function formatBroadcastUnsubscribeFooter(
  unsubscribeUrl: string
): string {
  return `Unsubscribe from this sender's broadcasts: ${unsubscribeUrl}`;
}

export function buildBroadcastPlaintextWithUnsubscribeFooter(
  messageBody: string,
  unsubscribeUrl: string
): string {
  return `${messageBody}\n\n${formatBroadcastUnsubscribeFooter(unsubscribeUrl)}`;
}
