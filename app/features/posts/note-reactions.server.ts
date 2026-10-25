import {
  SimplePool,
  useWebSocketImplementation as setPoolWebSocket,
} from "nostr-tools/pool";
import WebSocket from "ws";

import { logError } from "~/lib/error-logger.server";

import { countKind7Reactions } from "./repost-conditions";

const REACTION_QUERY_FLOOR = 500;
const REACTION_QUERY_CAP = 1000;
const REACTION_QUERY_WAIT_MS = 8_000;

/**
 * Count kind 7 reactions on a note, including emoji and custom emoji.
 * Returns null when the relay query fails. Zero is a real count.
 */
export async function countNoteReactionsOnRelays(
  eventId: string,
  relays: string[],
  atLeast: number
): Promise<number | null> {
  if (relays.length === 0) return null;
  const limit = Math.min(
    REACTION_QUERY_CAP,
    Math.max(REACTION_QUERY_FLOOR, atLeast)
  );
  setPoolWebSocket(WebSocket);
  const pool = new SimplePool();
  try {
    const events = await pool.querySync(
      relays,
      { kinds: [7], "#e": [eventId], limit },
      { maxWait: REACTION_QUERY_WAIT_MS }
    );
    return countKind7Reactions(events, eventId);
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Failed to count note reactions",
      eventId,
      relayCount: relays.length,
    });
    return null;
  } finally {
    try {
      pool.close(relays);
    } catch {
      /* ignore */
    }
  }
}
