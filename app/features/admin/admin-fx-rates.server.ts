/**
 * BTC/USD and BTC/EUR spot for admin display (Kraken first, CoinGecko fallback).
 * In-memory TTL cache to avoid hammering public APIs.
 */

import { logError } from "~/lib/error-logger.server";

const KRAKEN_TICKER =
  "https://api.kraken.com/0/public/Ticker?pair=XBTUSDC,XBTEUR";
const COINGECKO_SIMPLE =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,eur";

export interface AdminBtcSpotRates {
  /** Approximate USD per 1 BTC (USDC last trade or CoinGecko). */
  btcUsd: number;
  /** EUR per 1 BTC (XBTEUR / XXBTZEUR or CoinGecko). */
  btcEur: number;
  fetchedAt: string;
  source: "kraken" | "coingecko";
}

type KrakenTickerResult = Record<
  string,
  { c: [string, ...string[]] } | undefined
>;

let cache: { value: AdminBtcSpotRates; expiresAt: number } | null = null;
const TTL_MS = 60_000;
const FETCH_MS = 12_000;

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

function parseLastPrice(row: { c: [string, ...string[]] } | undefined): number {
  if (!row?.c[0]) return NaN;
  return parseFloat(row.c[0]);
}

async function fetchKraken(now: number): Promise<AdminBtcSpotRates> {
  const data = await fetchJson<{ error: string[]; result: KrakenTickerResult }>(
    KRAKEN_TICKER,
    FETCH_MS
  );
  if (data.error.length > 0) {
    throw new Error(data.error.join("; "));
  }
  const usd = parseLastPrice(data.result["XBTUSDC"]);
  const eur = parseLastPrice(data.result["XXBTZEUR"]);
  if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(eur) || eur <= 0) {
    throw new Error("Invalid Kraken ticker parse");
  }
  return {
    btcUsd: usd,
    btcEur: eur,
    fetchedAt: new Date(now).toISOString(),
    source: "kraken",
  };
}

async function fetchCoinGecko(now: number): Promise<AdminBtcSpotRates> {
  const data = await fetchJson<{
    bitcoin?: { usd?: number; eur?: number };
  }>(COINGECKO_SIMPLE, FETCH_MS);
  const usd = data.bitcoin?.usd;
  const eur = data.bitcoin?.eur;
  if (
    typeof usd !== "number" ||
    !Number.isFinite(usd) ||
    usd <= 0 ||
    typeof eur !== "number" ||
    !Number.isFinite(eur) ||
    eur <= 0
  ) {
    throw new Error("Invalid CoinGecko price parse");
  }
  return {
    btcUsd: usd,
    btcEur: eur,
    fetchedAt: new Date(now).toISOString(),
    source: "coingecko",
  };
}

export async function getAdminBtcSpotRates(
  now: number = Date.now()
): Promise<AdminBtcSpotRates> {
  if (cache && cache.expiresAt > now) {
    return cache.value;
  }

  try {
    const value = await fetchKraken(now);
    cache = { value, expiresAt: now + TTL_MS };
    return value;
  } catch (primary) {
    logError(primary instanceof Error ? primary : new Error(String(primary)), {
      message: "Admin Kraken FX fetch failed; trying CoinGecko",
    });
    try {
      const value = await fetchCoinGecko(now);
      cache = { value, expiresAt: now + TTL_MS };
      return value;
    } catch (fallback) {
      logError(
        fallback instanceof Error ? fallback : new Error(String(fallback)),
        { message: "Admin CoinGecko FX fallback failed" }
      );
      throw fallback;
    }
  }
}
