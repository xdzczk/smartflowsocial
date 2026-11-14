export interface PayoutEarningSlice {
  id: string;
  commissionSats: number;
}

/**
 * Oldest-first earnings whose commissions sum exactly to `amountSats`.
 * A row is never split. Returns null when the amount would over- or under-pay
 * the selected rows.
 */
export function selectExactOldestPrefix(
  rows: PayoutEarningSlice[],
  amountSats: number
): string[] | null {
  if (!Number.isSafeInteger(amountSats) || amountSats < 1) return null;
  let sum = 0;
  const ids: string[] = [];
  for (const row of rows) {
    if (!Number.isSafeInteger(row.commissionSats) || row.commissionSats <= 0) {
      continue;
    }
    if (sum === amountSats) break;
    if (sum + row.commissionSats > amountSats) return null;
    ids.push(row.id);
    sum += row.commissionSats;
  }
  return sum === amountSats ? ids : null;
}
