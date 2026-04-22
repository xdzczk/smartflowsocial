import { Heart, MessageCircle, Zap } from "lucide-react";
import { nip19 } from "nostr-tools";
import { useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { CompactSignStatus } from "~/features/auth/signing/components/CompactSignStatus";
import { SubtleSignPending } from "~/features/auth/signing/components/SubtleSignPending";
import { useEphemeralSignTier } from "~/features/auth/signing/use-ephemeral-sign-tier.client";
import { useSigningAttemptById } from "~/features/auth/signing/use-recoverable-sign.client";
import { useLookupNoteEngagement } from "~/features/search/hooks/useLookupNoteEngagement";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

import { LookupReplyComposerDrawer } from "./LookupReplyComposerDrawer";
import { ZapNoteDrawer } from "./ZapNoteDrawer";

/**
 * Two-tier ephemeral sign indicator for the per-row Like attempt:
 *   - subtle (default): tiny inline spinner next to the action
 *   - compact (after EPHEMERAL_ESCALATION_MS): pill with "Resume now /
 *     Cancel" so the user can drive recovery from the lookup row even
 *     when the global recovery banner is suppressed for ephemeral
 *     intents.
 *
 * Mirrors the equivalent helper in `NotificationItem` so both surfaces
 * present the same recovery UX for likes.
 */
function LookupActionRecovery({
  attemptId,
  actionLabel,
}: {
  attemptId: string | null;
  actionLabel: string;
}) {
  const attempt = useSigningAttemptById(attemptId);
  const tier = useEphemeralSignTier(attempt);
  if (tier === "subtle") {
    return <SubtleSignPending attempt={attempt} label={actionLabel} />;
  }
  if (tier === "compact") {
    return <CompactSignStatus attempt={attempt} actionLabel={actionLabel} />;
  }
  return null;
}

export interface LookupEngageNowSectionProps {
  eventId: string;
  authorPubkey: string;
  authorDisplayName: string;
  publishRelays: string[];
  /** Resolved default zap amount (sats) from user settings. */
  defaultZapAmountSats?: number;
  className?: string;
}

export function LookupEngageNowSection({
  eventId,
  authorPubkey,
  authorDisplayName,
  publishRelays,
  defaultZapAmountSats,
  className,
}: LookupEngageNowSectionProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [zapOpen, setZapOpen] = useState(false);

  const engagement = useLookupNoteEngagement({
    eventId,
    authorPubkey,
    publishRelays,
  });

  const authorNpub = useMemo(() => {
    try {
      return nip19.npubEncode(authorPubkey);
    } catch {
      return "";
    }
  }, [authorPubkey]);

  return (
    <div className={cn("space-y-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "h-9 w-full justify-start gap-2 px-3 text-xs font-medium",
          engagement.isLiked &&
            "border-brand/50 bg-brand/10 text-brand hover:bg-brand/15"
        )}
        disabled={engagement.isLikeSending || engagement.isLiked}
        onClick={() => void engagement.likeNote()}
      >
        <Heart
          className="h-3.5 w-3.5 shrink-0"
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
          fill={engagement.isLiked ? "currentColor" : "none"}
        />
        {engagement.isLikeSending
          ? "Liking…"
          : engagement.isLiked
            ? "Liked"
            : "Like"}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-full justify-start gap-2 px-3 text-xs font-medium"
        onClick={() => setReplyOpen(true)}
      >
        <MessageCircle
          className="h-3.5 w-3.5 shrink-0"
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
        Reply
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-warning/35 bg-warning/[0.07] text-warning-text hover:bg-warning/15 dark:text-warning h-9 w-full justify-start gap-2 px-3 text-xs font-medium"
        disabled={!authorNpub}
        onClick={() => setZapOpen(true)}
      >
        <Zap
          className="h-3.5 w-3.5 shrink-0"
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
        Zap
      </Button>

      {engagement.likeAttemptId ? (
        <LookupActionRecovery
          attemptId={engagement.likeAttemptId}
          actionLabel="Like"
        />
      ) : null}

      {engagement.likeError ? (
        <p className="text-danger text-[11px]" role="alert">
          {engagement.likeError}
        </p>
      ) : null}

      <LookupReplyComposerDrawer
        open={replyOpen}
        onOpenChange={setReplyOpen}
        authorDisplayName={authorDisplayName}
        onSend={engagement.sendReply}
        isSending={engagement.isReplySending}
        sendError={engagement.replyError}
        onClearSendError={engagement.clearReplyError}
      />

      {authorNpub ? (
        <ZapNoteDrawer
          open={zapOpen}
          onOpenChange={setZapOpen}
          authorNpub={authorNpub}
          eventIdHex={eventId}
          publishRelays={publishRelays}
          defaultAmountSats={defaultZapAmountSats}
        />
      ) : null}
    </div>
  );
}
