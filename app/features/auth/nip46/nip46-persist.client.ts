/**
 * Persist NIP-46 login: matchOrCreateSession, setActiveSession, setActiveSignerConfig, etc.
 * No React. Used by nip46-login hook and optionally by reconnect flows.
 */

import {
  detectSignerAppName,
  matchOrCreateSession,
  recordConnectionEvent,
  setActiveSession,
  setActiveSignerConfig,
  setCurrentUserNpub,
  updateSession,
  type ActiveSignerConfig,
  type ConnectionWithCurrentSession,
} from "~/features/auth/signer";
import { convertHexToNpub } from "~/lib/nostr-conversion";

/**
 * Persist signer config and session after NIP-46 connect. Call after connect succeeds.
 */
export function persistNip46LoginSession(
  config: ActiveSignerConfig,
  pubkey: string
): ConnectionWithCurrentSession {
  setActiveSignerConfig(config);
  setCurrentUserNpub(convertHexToNpub(pubkey));
  const view = matchOrCreateSession(config, { signerPubkey: pubkey });
  const connectionId = view.connection.id;
  setActiveSession(connectionId);
  const detectedAppName = detectSignerAppName(config);
  updateSession(connectionId, {
    metadata: {
      ...view.connection.metadata,
      pubkey,
      signerAppName: detectedAppName,
      status: "active",
      connectedAt: Date.now(),
      lastActivityAt: Date.now(),
    },
  });
  recordConnectionEvent(connectionId, { type: "connected", pubkey });
  return view;
}
