import axios from "axios";

// Function to get Bitcoin rate in USD
export async function getBitcoinRate(dollarAmount: number): Promise<number> {
  try {
    const response = await axios.get<{
      result: {
        XBTUSDC: {
          c: [string, ...string[]]; // "c" is an array, first value is the last close price as string
        };
      };
    }>("https://api.kraken.com/0/public/Ticker?pair=XBTUSDC");
    const btcRate = response.data.result.XBTUSDC.c[0];
    const btcAmount = dollarAmount / parseFloat(btcRate);
    // Convert BTC to sats (1 BTC = 100,000,000 sats)
    const satsAmount = Math.round(btcAmount * 100_000_000);
    return satsAmount;
  } catch (error) {
    console.error("Error fetching Bitcoin rate:", error);
    throw error;
  }
}
