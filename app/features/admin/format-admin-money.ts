/**
 * Display-only conversion: canonical amounts are always satoshis in loaders/DB.
 */

export type AdminDisplayUnit = "SATS" | "BTC" | "USD" | "EUR";

const STORAGE_KEY = "sfs-admin-display-unit";

export const ADMIN_DISPLAY_UNITS: readonly AdminDisplayUnit[] = [
  "SATS",
  "BTC",
  "USD",
  "EUR",
];

export function isAdminDisplayUnit(v: string): v is AdminDisplayUnit {
  return (ADMIN_DISPLAY_UNITS as readonly string[]).includes(v);
}

export function readStoredAdminDisplayUnit(): AdminDisplayUnit {
  if (typeof window === "undefined") return "SATS";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && isAdminDisplayUnit(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "SATS";
}

export function persistAdminDisplayUnit(unit: AdminDisplayUnit): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    /* ignore */
  }
}

function toBigIntSats(sats: number | bigint | string): bigint {
  if (typeof sats === "bigint") return sats;
  if (typeof sats === "number") {
    if (!Number.isFinite(sats)) return 0n;
    return BigInt(Math.trunc(sats));
  }
  const t = sats.trim();
  if (!t) return 0n;
  return BigInt(t);
}

export interface AdminFxSpot {
  btcUsd: number;
  btcEur: number;
}

/** Format a satoshi amount for the selected display unit. */
export function formatSatsForAdminUnit(
  sats: number | bigint | string,
  unit: AdminDisplayUnit,
  spot: AdminFxSpot | null,
  locale?: string
): string {
  const bi = toBigIntSats(sats);

  if (unit === "SATS") {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
      bi
    );
  }

  if (unit === "BTC") {
    const whole = bi / 100_000_000n;
    const frac = bi % 100_000_000n;
    const fracStr = frac.toString().padStart(8, "0").replace(/0+$/, "");
    if (fracStr.length === 0) {
      return `${whole.toString()} BTC`;
    }
    return `${whole.toString()}.${fracStr} BTC`;
  }

  if (!spot) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(bi)} sats`;
  }

  const n = Number(bi);
  if (unit === "USD") {
    const fiat = (n * spot.btcUsd) / 100_000_000;
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(fiat);
  }

  const fiatEur = (n * spot.btcEur) / 100_000_000;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(fiatEur);
}

/** Metric titles: keep base label; unit is implied by the toggle or footnote. */
export function adminMoneyColumnLabel(unit: AdminDisplayUnit): string {
  switch (unit) {
    case "SATS":
      return "Sats";
    case "BTC":
      return "BTC";
    case "USD":
      return "USD";
    case "EUR":
      return "EUR";
    default:
      return "Sats";
  }
}
