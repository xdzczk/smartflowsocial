import {
  signBatchWithRecovery,
  type SignBatchResult,
} from "~/features/auth/signing/sign-batch-with-recovery.client";
import { signingAttempts } from "~/features/auth/signing/signing-attempts.client";
import { durableIntent } from "~/features/auth/signing/use-recoverable-sign.client";
import { buildAndSignBroadcastKind4 } from "~/features/broadcast/broadcast-dm.client";
import {
  BROADCAST_PLAINTEXT_MAX_CHARS,
  buildBroadcastPlaintextWithUnsubscribeFooter,
} from "~/features/broadcast/broadcast-unsubscribe-copy";
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
  unsubscribeUrl: string;
}

interface SignedBroadcastRecipient {
  recipientId: string;
  signedEvent: Record<string, unknown>;
  giftWraps?: Array<Record<string, unknown>>;
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
  for (const r of pendingRecipients) {
    const plaintext = buildBroadcastPlaintextWithUnsubscribeFooter(
      campaign.messageBody,
      r.unsubscribeUrl
    );
    if (plaintext.length > BROADCAST_PLAINTEXT_MAX_CHARS) {
      return {
        ok: false,
        error: `Message with unsubscribe footer exceeds ${String(BROADCAST_PLAINTEXT_MAX_CHARS)} characters. Shorten your message.`,
      };
    }
  }

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

  // Stable per-attempt key so a resumed retry collapses onto the same
  // server dedupe slot. Includes campaign id + recipient id list so a
  // user re-opening the modal with a different recipient set starts a
  // fresh attempt.
  const idempotencyKey = `broadcast:${campaign.id}:${pendingRecipients
    .map((r) => r.id)
    .sort((a, b) => a.localeCompare(b))
    .join(",")}`;

  let result: SignBatchResult<SignedBroadcastRecipient>;
  try {
    result = await signBatchWithRecovery<
      BroadcastPendingRecipient,
      SignedBroadcastRecipient
    >({
      items: pendingRecipients,
      intent: durableIntent("publish_dm", idempotencyKey, "Send broadcast"),
      surface: `broadcast:${campaign.id}`,
      onProgress: (current, total) => {
        onSigningProgress(current, total);
      },
      signItem: async (r) => {
        const peer = r.recipientPubkey.toLowerCase();
        const plaintext = buildBroadcastPlaintextWithUnsubscribeFooter(
          campaign.messageBody,
          r.unsubscribeUrl
        );
        const signedEvent = await buildAndSignBroadcastKind4({
          recipientPubkeyHex: peer,
          plaintext,
        });

        let giftWraps: Array<Record<string, unknown>> | undefined;
        if (tryNip17) {
          const relay = hints[peer];
          if (relay) {
            try {
              const wraps = await buildUserSignedFeedbackNip17GiftWraps({
                plaintext,
                senderPubkeyHex: signedEvent.pubkey.toLowerCase(),
                inboxPubkeyHex: peer,
                preferredInboxRelayUrl: relay,
              });
              giftWraps = wraps as unknown as Array<Record<string, unknown>>;
            } catch {
              // Gift-wrap failures are non-fatal: the recipient still gets
              // the kind-4 fallback. We deliberately do not park the batch
              // here — only kind-4 sign failures (which propagate above)
              // are recoverable.
              giftWraps = undefined;
            }
          }
        }

        return {
          recipientId: r.id,
          signedEvent: signedEvent as unknown as Record<string, unknown>,
          giftWraps,
        };
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Signing failed",
    };
  }

  if (!result.ok) {
    return {
      ok: false,
      error:
        result.lastError ??
        (result.reason === "expired"
          ? "Recovery window expired before your signer reconnected."
          : result.reason === "partial"
            ? `Signed ${String(result.signed.length)} / ${String(pendingRecipients.length)} recipients before failing.`
            : "Signing failed"),
    };
  }

  const recipientsPayload = result.signed.map((entry) => entry.signed);
  const res = await fetch("/api/broadcast-finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      campaignId: campaign.id,
      recipients: recipientsPayload,
      attemptId: result.attemptId,
    }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) {
    signingAttempts.markFailed(
      result.attemptId,
      data.error ?? "Finalize failed"
    );
    return { ok: false, error: data.error ?? "Finalize failed" };
  }
  signingAttempts.markCompleted(result.attemptId);
  window.location.href = `/dashboard/broadcasts/${campaign.id}`;
  return { ok: true };
}
