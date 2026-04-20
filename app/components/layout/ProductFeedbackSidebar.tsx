import { useLocation, useRouteLoaderData } from "@remix-run/react";
import { Bug } from "lucide-react";
import { useId, useRef, useState } from "react";
import toast from "react-hot-toast";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { signingAttempts } from "~/features/auth/signing/signing-attempts.client";
import {
  durableIntent,
  startRecoverableSign,
} from "~/features/auth/signing/use-recoverable-sign.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import {
  buildAndSignFeedbackKind4,
  buildUserSignedFeedbackNip17GiftWraps,
  feedbackClientMayAttemptNip17Seals,
  feedbackClientNip17Eligible,
} from "~/lib/product-feedback-dm.client";
import type { loader as dashboardLoader } from "~/routes/dashboard";

/** Slightly smaller than main nav (`DashboardHeader` uses 18px + `text-sm`) so this row reads as the same pattern at a smaller scale. */
const FEEDBACK_NAV_ICON_CLASS = "inline-block size-4 shrink-0";
const NAV_ICON_STROKE = 2.25;

const FEEDBACK_SEND_FALLBACK_ERROR = "Could not send feedback.";

interface ProductFeedbackSidebarProps {
  collapsed: boolean;
  onOpenMobileSidebarClose?: () => void;
}

function formatFeedbackPlaintext(input: {
  category: string;
  message: string;
  pagePath: string;
  userNpub: string;
  userId: string;
}): string {
  const typeLabel =
    input.category === "feature" ? "Feature suggestion" : "Bug report";
  const lines = [
    typeLabel,
    "",
    `User npub: ${input.userNpub}`,
    `User id: ${input.userId}`,
    `Page: ${input.pagePath}`,
    "",
    input.message.trim(),
  ];
  return lines.join("\n");
}

export function ProductFeedbackSidebar({
  collapsed,
  onOpenMobileSidebarClose,
}: ProductFeedbackSidebarProps) {
  const [open, setOpen] = useState(false);
  const [formNonce, setFormNonce] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const location = useLocation();
  const categoryId = useId();
  const messageId = useId();

  const dashLoader =
    useRouteLoaderData<typeof dashboardLoader>("routes/dashboard");
  const inboxHex = dashLoader?.feedbackInboxPubkeyHex ?? null;
  const userNpub = dashLoader?.user.npub ?? "";
  const userId = dashLoader?.userId ?? "";
  const nostrDmNip17Enabled = Boolean(dashLoader?.nostrDmNip17Enabled);
  const feedbackInboxKind10050Relays =
    dashLoader?.feedbackInboxKind10050Relays ?? [];

  // Match inactive `NavigationItem` / `OperatorAdminNavItem` in DashboardHeader; `text-xs` scales the row down.
  const triggerClass = `group flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 text-xs font-medium relative text-muted-foreground hover:bg-muted hover:text-foreground active:border-border focus:outline-none focus:ring-2 focus:ring-ring ${
    collapsed ? "justify-center px-0 py-2" : ""
  }`;
  const iconSpanClass =
    "text-foreground/70 group-hover:text-foreground flex flex-none items-center";

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    void runSubmit();
  }

  async function runSubmit() {
    const form = formRef.current;
    if (!form || submitting || !inboxHex) return;

    const fd = new FormData(form);
    const category = String(fd.get("category") ?? "bug");
    const message = String(fd.get("message") ?? "").trim();
    const pagePath = location.pathname;

    if (!message) {
      toast.error("Please enter a message.");
      return;
    }

    setSubmitting(true);
    try {
      const plaintext = formatFeedbackPlaintext({
        category,
        message,
        pagePath,
        userNpub,
        userId,
      });

      // Per-attempt key so a resumed retry collapses onto the same
      // server dedupe slot. Includes a fresh submission id so reopening
      // the dialog after a successful send is a fresh intent.
      const idempotencyKey = `feedback:${userId}:${signingAttempts.createSubmissionId()}`;

      const result = await startRecoverableSign({
        intent: durableIntent("publish_dm", idempotencyKey, "Send feedback"),
        surface: "product-feedback",
        performSignAndSubmit: async (submissionId) => {
          const signedEvent = await buildAndSignFeedbackKind4({
            recipientPubkeyHex: inboxHex,
            plaintext,
          });

          const nip17Eligible = feedbackClientNip17Eligible({
            nostrDmNip17Enabled,
            feedbackInboxKind10050Relays,
          });

          let giftWraps: Awaited<
            ReturnType<typeof buildUserSignedFeedbackNip17GiftWraps>
          > | null = null;
          if (nip17Eligible && feedbackClientMayAttemptNip17Seals()) {
            const preferredRelay = feedbackInboxKind10050Relays[0]?.trim();
            const senderHex = nostrAdapter.decodeNpub(userNpub);
            if (
              preferredRelay &&
              senderHex &&
              /^[0-9a-f]{64}$/i.test(senderHex)
            ) {
              try {
                giftWraps = await buildUserSignedFeedbackNip17GiftWraps({
                  plaintext,
                  senderPubkeyHex: senderHex.toLowerCase(),
                  inboxPubkeyHex: inboxHex,
                  preferredInboxRelayUrl: preferredRelay,
                });
              } catch {
                // Gift-wrap signing is best-effort; falling back to the
                // kind-4 keeps the user's feedback flowing even when the
                // signer can't produce NIP-44 seals.
                giftWraps = null;
              }
            }
          }

          const response = await fetch("/api/feedback-dm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              giftWraps?.length === 2
                ? { event: signedEvent, giftWraps, attemptId: submissionId }
                : { event: signedEvent, attemptId: submissionId }
            ),
          });

          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
            success?: boolean;
          };

          if (!response.ok) {
            const msg = payload.error ?? FEEDBACK_SEND_FALLBACK_ERROR;
            signingAttempts.markFailed(submissionId, msg);
            throw new Error(msg);
          }
          signingAttempts.markCompleted(submissionId);
        },
      });

      if (!result.ok) {
        const fallback =
          result.reason === "expired"
            ? "Recovery window expired before your signer reconnected."
            : FEEDBACK_SEND_FALLBACK_ERROR;
        toast.error(result.lastError ?? fallback);
        return;
      }

      toast.success("Thanks — your feedback was sent.");
      setOpen(false);
      setFormNonce((n) => n + 1);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : FEEDBACK_SEND_FALLBACK_ERROR;
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        className={triggerClass}
        title="Report a bug or suggest a feature"
        onClick={() => {
          setOpen(true);
          onOpenMobileSidebarClose?.();
        }}
      >
        <span className={iconSpanClass}>
          <Bug
            className={FEEDBACK_NAV_ICON_CLASS}
            strokeWidth={NAV_ICON_STROKE}
            aria-hidden
          />
        </span>
        {!collapsed ? (
          <span className="grow py-2">Report bug · Suggest feature</span>
        ) : null}
      </button>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report a bug or suggest a feature</DialogTitle>
          {inboxHex ? (
            <>
              <DialogDescription>
                Your message is sent privately to the team, encrypted and signed
                with your Nostr account. When you continue, your extension or
                remote signer will ask you to approve.
              </DialogDescription>
              <details className="text-muted-foreground mt-2 text-xs">
                <summary className="cursor-pointer underline-offset-2 select-none hover:underline">
                  Technical details (remote signers)
                </summary>
                <p className="border-border mt-2 border-l-2 pl-3">
                  Remote signers must expose NIP-46{" "}
                  <code className="bg-muted rounded px-1 py-0.5 text-[0.8rem]">
                    nip04_encrypt
                  </code>{" "}
                  for the DM. Optional NIP-17 gift wraps need NIP-44 (e.g.{" "}
                  <code className="bg-muted rounded px-1 py-0.5 text-[0.8rem]">
                    nip44_encrypt
                  </code>
                  ) when the inbox publishes kind 10050 and the server enables
                  NIP-17.
                </p>
              </details>
            </>
          ) : (
            <DialogDescription>
              Product feedback is not enabled on this deployment yet. If you run
              your own instance, ask the operator to configure the feedback
              inbox.
            </DialogDescription>
          )}
        </DialogHeader>

        {!inboxHex ? (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        ) : null}

        <form
          ref={formRef}
          key={formNonce}
          onSubmit={handleFormSubmit}
          className={`grid gap-4 ${!inboxHex ? "hidden" : ""}`}
        >
          <input type="hidden" name="pagePath" value={location.pathname} />

          <div className="grid gap-2">
            <Label htmlFor={categoryId}>Type</Label>
            <select
              id={categoryId}
              name="category"
              required
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none"
              defaultValue="bug"
            >
              <option value="bug">Bug report</option>
              <option value="feature">Feature suggestion</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={messageId}>Message</Label>
            <Textarea
              id={messageId}
              name="message"
              required
              rows={5}
              maxLength={4000}
              placeholder="What happened, or what would help you?"
              className="min-h-[120px] resize-y"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Signing…" : "Sign and send"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
