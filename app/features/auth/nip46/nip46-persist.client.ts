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
  type RemoteSignerSession,
} from "~/features/auth/signer";
import { convertHexToNpub } from "~/lib/nostr-conversion";

/**
 * Persist signer config and session after NIP-46 connect. Call after connect succeeds.
 */
export function persistNip46LoginSession(
  config: ActiveSignerConfig,
  pubkey: string
): RemoteSignerSession {
  setActiveSignerConfig(config);
  setCurrentUserNpub(convertHexToNpub(pubkey));
  const connectionView = matchOrCreateSession(config, { signerPubkey: pubkey });
  setActiveSession(connectionView.id);
  const detectedAppName = detectSignerAppName(config);
  updateSession(connectionView.id, {
    metadata: {
      ...connectionView.metadata,
      pubkey,
      signerAppName: detectedAppName,
      status: "active",
      connectedAt: Date.now(),
      lastActivityAt: Date.now(),
    },
  });
  recordConnectionEvent(connectionView.id, { type: "connected", pubkey });
  return connectionView;
}
