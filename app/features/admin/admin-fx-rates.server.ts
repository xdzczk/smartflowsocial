/**
 * Kraken spot prices for admin display (USDC ≈ USD, EUR via XBTEUR).
 * In-memory TTL cache to avoid hammering the public API.
 */

import axios from "axios";

import { logError } from "~/lib/error-logger.server";

const KRAKEN_TICKER =
  "https://api.kraken.com/0/public/Ticker?pair=XBTUSDC,XBTEUR";

export interface AdminBtcSpotRates {
  /** Approximate USD per 1 BTC (USDC last trade). */
  btcUsd: number;
  /** EUR per 1 BTC (XBTEUR → XXBTZEUR last trade). */
  btcEur: number;
  fetchedAt: string;
}

type KrakenTickerResult = Record<
  string,
  { c: [string, ...string[]] } | undefined
>;

let cache: { value: AdminBtcSpotRates; expiresAt: number } | null = null;
const TTL_MS = 60_000;

function parseLastPrice(row: { c: [string, ...string[]] } | undefined): number {
  if (!row?.c[0]) return NaN;
  return parseFloat(row.c[0]);
}

export async function getAdminBtcSpotRates(
  now: number = Date.now()
): Promise<AdminBtcSpotRates> {
  if (cache && cache.expiresAt > now) {
    return cache.value;
  }

  try {
    const { data } = await axios.get<{
      error: string[];
      result: KrakenTickerResult;
    }>(KRAKEN_TICKER);
    if (data.error.length > 0) {
      throw new Error(data.error.join("; "));
    }
    const usd = parseLastPrice(data.result["XBTUSDC"]);
    const eur = parseLastPrice(data.result["XXBTZEUR"]);
    if (
      !Number.isFinite(usd) ||
      usd <= 0 ||
      !Number.isFinite(eur) ||
      eur <= 0
    ) {
      throw new Error("Invalid Kraken ticker parse");
    }
    const value: AdminBtcSpotRates = {
      btcUsd: usd,
      btcEur: eur,
      fetchedAt: new Date(now).toISOString(),
    };
    cache = { value, expiresAt: now + TTL_MS };
    return value;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Admin Kraken FX fetch failed",
    });
    throw error;
  }
}
