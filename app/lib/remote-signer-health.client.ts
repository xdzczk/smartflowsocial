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

/** When no signer is cached, try to reconnect once (e.g. after both apps were closed and reopened). */
const RECONNECT_TIMEOUT_MS = 30_000;

/**
 * Test the current active signer connection.
 * If no signer is cached (e.g. after reopen), attempts one reconnect before failing.
 * Returns health status with optional pubkey and duration.
 */
export async function testConnection(
  timeoutMs = 3000,
  options?: { tryReconnectIfDisconnected?: boolean }
): Promise<ConnectionHealthResult> {
  const tryReconnect = options?.tryReconnectIfDisconnected ?? true;
  const startTime = Date.now();

  try {
    let signer = await getActiveSigner({ allowReconnect: false });
    if (!signer && tryReconnect) {
      const activeConfig = getActiveSignerConfig();
      if (activeConfig?.type === "nip46") {
        const reconnectPromise = getActiveSigner({ allowReconnect: true });
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "Reconnect is taking too long. Ensure your signer app (e.g. Primal) is open and try again."
                )
              ),
            RECONNECT_TIMEOUT_MS
          )
        );
        signer =
          (await Promise.race([reconnectPromise, timeoutPromise])) ?? null;
      }
    }
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
