import { getActiveSigner } from "~/lib/nostr-signer-manager.client";

export interface ConnectionHealthResult {
  healthy: boolean;
  error?: string;
  pubkey?: string;
  duration?: number;
}

/**
 * Test the current active signer connection.
 * Returns health status with optional pubkey and duration.
 */
export async function testConnection(
  timeoutMs = 5000
): Promise<ConnectionHealthResult> {
  const startTime = Date.now();

  try {
    const signer = await getActiveSigner();
    if (!signer) {
      return {
        healthy: false,
        error: "No active signer found",
      };
    }

    // Test by getting public key with timeout
    const pubkeyPromise = signer.getPublicKey();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Connection check timeout")), timeoutMs)
    );

    const pubkey = await Promise.race([pubkeyPromise, timeoutPromise]);
    const duration = Date.now() - startTime;

    return {
      healthy: true,
      pubkey,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      healthy: false,
      error: errorMessage,
      duration,
    };
  }
}
