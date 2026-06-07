import { GiftWrap, PrivateDirectMessage, Seal } from "nostr-tools/kinds";
import { encrypt, getConversationKey } from "nostr-tools/nip44";
import {
  finalizeEvent,
  generateSecretKey,
  getEventHash,
} from "nostr-tools/pure";

import { getActiveSignerConfig } from "~/features/auth/signer";
import type { SignedEvent } from "~/features/nostr/types";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import {
  encryptNip04WithActiveSigner,
  encryptNip44WithActiveSigner,
} from "~/lib/nostr-signer-encrypt.client";

const TWO_DAYS = 2 * 24 * 60 * 60;

function randomGiftWrapCreatedAt(): number {
  return Math.round(Date.now() / 1000 - Math.random() * TWO_DAYS);
}

/**
 * True when the app wants NIP-17 and the inbox has kind:10050 relays; caller should still verify NIP-44 at runtime.
 */
export function feedbackClientNip17Eligible(params: {
  nostrDmNip17Enabled: boolean;
  feedbackInboxKind10050Relays: string[];
}): boolean {
  return (
    params.nostrDmNip17Enabled && params.feedbackInboxKind10050Relays.length > 0
  );
}

/**
 * Whether we should try building NIP-17 seals (NIP-44): remote signers use bunker RPC; NIP-07 needs extension nip44.
 */
export function feedbackClientMayAttemptNip17Seals(): boolean {
  if (typeof window === "undefined") return false;
  const cfg = getActiveSignerConfig();
  if (cfg?.type === "nip46") return true;
  return Boolean(window.nostr?.nip44?.encrypt);
}

function createNip17PrivateDmTemplate(
  recipient: { publicKey: string; relayUrl?: string },
  message: string
): {
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
} {
  const tags: string[][] = [];
  if (recipient.relayUrl) {
    tags.push(["p", recipient.publicKey, recipient.relayUrl]);
  } else {
    tags.push(["p", recipient.publicKey]);
  }
  return {
    created_at: Math.ceil(Date.now() / 1000),
    kind: PrivateDirectMessage,
    tags,
    content: message,
  };
}

function rumorWithId(
  template: ReturnType<typeof createNip17PrivateDmTemplate>,
  senderPubkeyHex: string
): {
  id: string;
  pubkey: string;
  kind: number;
  tags: string[][];
  content: string;
  created_at: number;
} {
  const rumor = {
    kind: template.kind,
    content: template.content,
    created_at: template.created_at,
    tags: template.tags,
    pubkey: senderPubkeyHex,
  };
  const id = getEventHash(rumor);
  return { ...rumor, id };
}

/**
 * Build two user-signed gift wraps (kind 1059): copy for sender + copy for inbox,
 * matching nostr-tools `wrapManyEvents` for one DM recipient with a preferred relay hint.
 */
export async function buildUserSignedFeedbackNip17GiftWraps(params: {
  plaintext: string;
  senderPubkeyHex: string;
  inboxPubkeyHex: string;
  preferredInboxRelayUrl: string;
}): Promise<SignedEvent[]> {
  const sender = params.senderPubkeyHex.toLowerCase();
  const inbox = params.inboxPubkeyHex.toLowerCase();
  const relay = params.preferredInboxRelayUrl.trim();

  const recipients: Array<{ publicKey: string; relayUrl?: string }> = [
    { publicKey: sender },
    { publicKey: inbox, relayUrl: relay },
  ];

  const out: SignedEvent[] = [];

  for (const recipient of recipients) {
    const template = createNip17PrivateDmTemplate(recipient, params.plaintext);
    const rumor = rumorWithId(template, sender);
    const sealContent = await encryptNip44WithActiveSigner(
      recipient.publicKey,
      JSON.stringify(rumor)
    );

    const { signedEvent: signedSeal } = await nostrAdapter.signEvent(
      {
        kind: Seal,
        content: sealContent,
        tags: [],
        created_at: randomGiftWrapCreatedAt(),
      },
      // Surfaceable recoverable errors so the caller's
      // `startRecoverableSign` boundary can park the attempt.
      { clearCacheOnError: false }
    );

    const randomKey = generateSecretKey();
    const conversationKey = getConversationKey(randomKey, recipient.publicKey);
    const wrapContent = encrypt(JSON.stringify(signedSeal), conversationKey);

    const giftWrap = finalizeEvent(
      {
        kind: GiftWrap,
        content: wrapContent,
        created_at: randomGiftWrapCreatedAt(),
        tags: [["p", recipient.publicKey]],
      },
      randomKey
    );

    out.push(giftWrap);
  }

  return out;
}

/**
 * Encrypt with NIP-04 (active signer or extension), then sign kind 4 with the active Nostr signer.
 */
export async function buildAndSignFeedbackKind4(params: {
  recipientPubkeyHex: string;
  plaintext: string;
}): Promise<SignedEvent> {
  const peer = params.recipientPubkeyHex.toLowerCase();
  const encrypted = await encryptNip04WithActiveSigner(peer, params.plaintext);

  const { signedEvent } = await nostrAdapter.signEvent(
    {
      kind: 4,
      tags: [["p", peer]],
      content: encrypted,
      created_at: Math.floor(Date.now() / 1000),
    },
    { clearCacheOnError: false }
  );

  return signedEvent;
}
