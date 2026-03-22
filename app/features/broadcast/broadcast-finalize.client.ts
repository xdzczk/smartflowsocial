import { buildAndSignBroadcastKind4 } from "~/features/broadcast/broadcast-dm.client";
import {
  buildUserSignedFeedbackNip17GiftWraps,
  feedbackClientMayAttemptNip17Seals,
} from "~/lib/product-feedback-dm.client";

export interface BroadcastFinalizeCampaign {
  id: string;
  messageBody: string;
  deliveryMode: string;
}

export interface BroadcastPendingRecipient {
  id: string;
  recipientPubkey: string;
}

function deliveryModeUsesNip17GiftWraps(mode: string): boolean {
  return (
    mode === "BEST_COMPATIBILITY" ||
    mode === "NIP17_ONLY" ||
    mode === "NIP17_FALLBACK_NIP04" ||
    mode === "BOTH"
  );
}

export async function runBroadcastFinalizeFlow(
  campaign: BroadcastFinalizeCampaign,
  pendingRecipients: BroadcastPendingRecipient[],
  onSigningProgress: (index: number, total: number) => void
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tryNip17 =
    deliveryModeUsesNip17GiftWraps(campaign.deliveryMode) &&
    feedbackClientMayAttemptNip17Seals();

  let hints: Record<string, string> = {};
  if (tryNip17 && pendingRecipients.length > 0) {
    try {
      const res = await fetch("/api/broadcast-inbox-hints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          pubkeys: pendingRecipients.map((r) => r.recipientPubkey),
        }),
      });
      const data = (await res.json()) as { hints?: Record<string, string> };
      if (res.ok && data.hints) hints = data.hints;
    } catch {
      hints = {};
    }
  }

  const recipientsPayload: Array<{
    recipientId: string;
    signedEvent: Record<string, unknown>;
    giftWraps?: Array<Record<string, unknown>>;
  }> = [];

  let i = 0;
  for (const r of pendingRecipients) {
    i += 1;
    onSigningProgress(i, pendingRecipients.length);
    const peer = r.recipientPubkey.toLowerCase();
    const signedEvent = await buildAndSignBroadcastKind4({
      recipientPubkeyHex: peer,
      plaintext: campaign.messageBody,
    });

    let giftWraps: Array<Record<string, unknown>> | undefined;
    if (tryNip17) {
      const relay = hints[peer];
      if (relay) {
        try {
          const wraps = await buildUserSignedFeedbackNip17GiftWraps({
            plaintext: campaign.messageBody,
            senderPubkeyHex: signedEvent.pubkey.toLowerCase(),
            inboxPubkeyHex: peer,
            preferredInboxRelayUrl: relay,
          });
          giftWraps = wraps as unknown as Array<Record<string, unknown>>;
        } catch {
          giftWraps = undefined;
        }
      }
    }

    recipientsPayload.push({
      recipientId: r.id,
      signedEvent: signedEvent as unknown as Record<string, unknown>,
      giftWraps,
    });
  }

  const res = await fetch("/api/broadcast-finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      campaignId: campaign.id,
      recipients: recipientsPayload,
    }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: data.error ?? "Finalize failed" };
  }
  window.location.href = `/dashboard/broadcasts/${campaign.id}`;
  return { ok: true };
}
