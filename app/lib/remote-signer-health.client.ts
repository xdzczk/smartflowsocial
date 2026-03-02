import {
  getActiveSigner,
  getActiveSignerConfig,
} from "~/lib/nostr-signer-manager.client";

export interface ConnectionHealthResult {
  healthy: boolean;
  error?: string;
  pubkey?: string;
  duration?: number;
  method?: "ping" | "get_public_key";
}

/**
 * Test the current active signer connection.
 * Returns health status with optional pubkey and duration.
 */
export async function testConnection(
  timeoutMs = 3000
): Promise<ConnectionHealthResult> {
  const startTime = Date.now();

  try {
    const signer = await getActiveSigner({ allowReconnect: false });
    if (!signer) {
      const activeConfig = getActiveSignerConfig();
      const staleMessage =
        activeConfig?.type === "nip46"
          ? "Remote signer is not currently connected. Reconnect required."
          : "No active signer found";
      return {
        healthy: false,
        error: staleMessage,
      };
    }

    const runProbe = async (): Promise<{
      method: "ping" | "get_public_key";
      pubkey?: string;
    }> => {
      if (signer.type === "nip46" && typeof signer.ping === "function") {
        await signer.ping();
        return { method: "ping" };
      }
      const pubkey = await signer.getPublicKey();
      return { method: "get_public_key", pubkey };
    };

    // Test with timeout.
    const probePromise = runProbe();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Connection check timeout")), timeoutMs)
    );

    const probe = await Promise.race([probePromise, timeoutPromise]);
    const duration = Date.now() - startTime;
    console.info("[remote-signer-sign] Health check success", {
      method: probe.method,
      duration,
    });

    return {
      healthy: true,
      method: probe.method,
      pubkey: probe.pubkey,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.info("[remote-signer-sign] Health check failed", {
      error: errorMessage,
      duration,
    });

    return {
      healthy: false,
      error: errorMessage,
      duration,
    };
  }
}
