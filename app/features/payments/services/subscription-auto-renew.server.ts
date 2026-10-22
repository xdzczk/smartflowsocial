/**
 * A saved wallet string is not permission to charge. Only an explicit
 * auto-renew subscription, with the wallet still connected, is billed again.
 */
export function isAutoRenewChargeEligible(input: {
  nwcEnabled: boolean;
  encryptedNwc: string | null;
  paymentMethod?: string | null;
  renewalMode?: string | null;
}): boolean {
  return (
    input.paymentMethod === "nwc_auto_renew" &&
    input.renewalMode === "auto_renew" &&
    input.nwcEnabled === true &&
    typeof input.encryptedNwc === "string" &&
    input.encryptedNwc.length > 0
  );
}

export function isFreePlanPrice(price: unknown): boolean {
  if (price == null || price === "") return false;
  const amount = Number(price);
  return Number.isFinite(amount) && amount === 0;
}
