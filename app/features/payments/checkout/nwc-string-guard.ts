/**
 * Client-side NWC connection string shape check (non-authoritative).
 * Server still validates on submit.
 */

export function isLikelyNwcConnectionString(value: string): boolean {
  const t = value.trim();
  if (t.length < 12) return false;
  return (
    t.startsWith("nostr+walletconnect://") ||
    t.startsWith("nostr+walletconnect:")
  );
}

export function canSubmitAutoRenewCheckout(params: {
  nwcEnabled: boolean;
  nwcString: string;
}): boolean {
  if (params.nwcEnabled) return true;
  return isLikelyNwcConnectionString(params.nwcString);
}
