import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { useCallback, useMemo, useState } from "react";

import { requireUserId } from "~/features/auth";
import {
  formatBroadcastAudienceLabel,
  formatBroadcastCampaignStatus,
  formatBroadcastDeliveryMode,
  getBroadcastCampaignForUser,
} from "~/features/broadcast";
import { broadcastCompatibilityForecastNote } from "~/features/broadcast/broadcast-delivery-copy";
import { runBroadcastFinalizeFlow } from "~/features/broadcast/broadcast-finalize.client";
import { getBroadcastMessageLintWarnings } from "~/features/broadcast/broadcast-message-lint";
import { getBroadcastReviewWarnings } from "~/features/broadcast/broadcast-review-warnings.server";
import {
  getBroadcastPlanLimits,
  getUserPlanType,
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import { getSubscriptionData } from "~/features/payments/subscriptions.server";
import { getUserById } from "~/features/user";
import { cn } from "~/lib/utils";

export const meta: MetaFunction = () => [{ title: "Review broadcast — Vibe" }];

function invalidCustomFromLogs(
  logs: Array<{ eventType: string; metadataJson: unknown }>
): number {
  const resolveLog = logs.find((l) => l.eventType === "audience_resolved");
  const m = resolveLog?.metadataJson;
  if (!m || typeof m !== "object" || !("invalidCustom" in m)) return 0;
  const v = (m as { invalidCustom?: unknown }).invalidCustom;
  return typeof v === "number" ? v : 0;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "broadcasts");

  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId");
  if (!campaignId) {
    return redirect("/dashboard/broadcasts/new");
  }

  const campaign = await getBroadcastCampaignForUser(campaignId, userId);
  if (!campaign) {
    return redirect("/dashboard/broadcasts/new");
  }

  if (campaign.status !== "DRAFT" && campaign.status !== "AWAITING_SIGNATURE") {
    return redirect(`/dashboard/broadcasts/${campaign.id}`);
  }

  if (campaign.totalRecipients === 0) {
    return redirect(
      `/dashboard/broadcasts/new?campaignId=${encodeURIComponent(campaign.id)}&notice=${encodeURIComponent("Resolve your audience before review.")}`
    );
  }

  const pending = campaign.recipients.filter((r) => r.status === "PENDING");
  if (pending.length === 0) {
    return redirect(`/dashboard/broadcasts/${campaign.id}`);
  }

  const { currentSubscription } = await getSubscriptionData(userId);
  const planType = getUserPlanType(currentSubscription);
  const limits = getBroadcastPlanLimits(planType);
  const user = await getUserById(userId);

  const invalidCustom = invalidCustomFromLogs(campaign.eventLogs);
  const reviewWarnings = await getBroadcastReviewWarnings({
    userId,
    campaignId: campaign.id,
    messageBody: campaign.messageBody,
    audienceType: campaign.audienceType,
    totalRecipients: campaign.totalRecipients,
    suppressedCount: campaign.suppressedCount,
    invalidCustomEstimate: invalidCustom,
    planType,
  });
  const lintWarnings = getBroadcastMessageLintWarnings(
    campaign.messageBody
  ).map((w) => ({ level: w.level as "info" | "warning", message: w.message }));
  const warnings = [...lintWarnings, ...reviewWarnings];

  const scheduledIsFuture =
    campaign.scheduledFor != null &&
    new Date(campaign.scheduledFor).getTime() > Date.now();

  return json({
    campaign,
    pendingRecipients: pending.map((r) => ({
      id: r.id,
      recipientPubkey: r.recipientPubkey,
    })),
    limits,
    planType,
    signerNpub: user?.npub ?? null,
    userTimezone: user?.timezone ?? "Etc/UTC",
    warnings,
    invalidCustom,
    scheduledIsFuture,
  });
}

export default function BroadcastNewReviewRoute() {
  const {
    campaign,
    pendingRecipients,
    limits,
    planType,
    signerNpub,
    userTimezone,
    warnings,
    invalidCustom,
    scheduledIsFuture,
  } = useLoaderData<typeof loader>();

  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [finalizeProgress, setFinalizeProgress] = useState<string | null>(null);

  const scheduleSentence = useMemo(() => {
    if (!campaign.scheduledFor) {
      return "This broadcast will start sending as soon as you sign and confirm (send now).";
    }
    const d = new Date(campaign.scheduledFor);
    const formatted = d.toLocaleString(undefined, {
      timeZone: userTimezone,
      dateStyle: "medium",
      timeStyle: "short",
    });
    return `This broadcast will begin sending on ${formatted} (${userTimezone}).`;
  }, [campaign.scheduledFor, userTimezone]);

  const runFinalize = useCallback(async () => {
    setFinalizeError(null);
    setFinalizeProgress("Signing…");
    try {
      const result = await runBroadcastFinalizeFlow(
        {
          id: campaign.id,
          messageBody: campaign.messageBody,
          deliveryMode: campaign.deliveryMode,
        },
        pendingRecipients,
        (index, total) => {
          setFinalizeProgress(`Signing ${String(index)}/${String(total)}…`);
        }
      );
      if (!result.ok) {
        setFinalizeError(result.error);
        setFinalizeProgress(null);
      }
    } catch (e) {
      setFinalizeError(e instanceof Error ? e.message : "Finalize failed");
      setFinalizeProgress(null);
    }
  }, [
    campaign.id,
    campaign.messageBody,
    campaign.deliveryMode,
    pendingRecipients,
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link
          to={`/dashboard/broadcasts/new?campaignId=${encodeURIComponent(campaign.id)}`}
          className="text-muted-foreground text-sm hover:underline"
        >
          ← Back to edit
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Review broadcast
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          You are about to enqueue delivery to{" "}
          <strong className="text-foreground">
            {String(pendingRecipients.length)}
          </strong>{" "}
          recipients. Review audience, compatibility, and schedule carefully
          before signing. This action creates signed DM events and publishes
          them through background workers.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="border-border rounded-lg border p-4">
            <h2 className="font-medium">Campaign summary</h2>
            <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
              <li>
                <span className="text-foreground font-medium">Name:</span>{" "}
                {campaign.name}{" "}
                <span className="text-xs">
                  (internal only; recipients will not see this)
                </span>
              </li>
              <li>
                <span className="text-foreground font-medium">Status:</span>{" "}
                {formatBroadcastCampaignStatus(campaign.status)}
              </li>
              <li>
                <span className="text-foreground font-medium">Audience:</span>{" "}
                {formatBroadcastAudienceLabel(
                  campaign.audienceType,
                  campaign.totalRecipients
                )}
              </li>
              <li>
                <span className="text-foreground font-medium">Delivery:</span>{" "}
                {formatBroadcastDeliveryMode(campaign.deliveryMode)}
              </li>
              <li>
                <span className="text-foreground font-medium">Strategy:</span>{" "}
                {campaign.sendStrategy === "STAGGERED"
                  ? "Staggered pacing (slight delay between jobs)"
                  : "Standard concurrency"}
              </li>
              <li>
                <span className="text-foreground font-medium">Schedule:</span>{" "}
                {scheduleSentence}
              </li>
              <li>
                <span className="text-foreground font-medium">Signer:</span>{" "}
                <span className="font-mono text-xs break-all">
                  {signerNpub ?? "Connect your Nostr signer to finalize"}
                </span>
              </li>
            </ul>
            <div className="border-border mt-4 border-t pt-4">
              <h3 className="text-sm font-medium">Message preview</h3>
              <p className="text-muted-foreground mt-2 max-h-48 overflow-y-auto text-sm whitespace-pre-wrap">
                {campaign.messageBody}
              </p>
            </div>
          </section>

          <section className="border-border rounded-lg border p-4">
            <h2 className="font-medium">Recipient resolution</h2>
            <ul className="text-muted-foreground mt-3 space-y-1 text-sm">
              <li>Final send count: {campaign.totalRecipients}</li>
              <li>
                Suppressed (pre-send): {campaign.suppressedCount}
                {campaign.suppressedCount > 0 ? (
                  <>
                    {" "}
                    <Link
                      to="/dashboard/broadcasts/suppression"
                      className="text-primary font-medium hover:underline"
                    >
                      View suppression list
                    </Link>
                  </>
                ) : null}
              </li>
              <li>Invalid custom lines skipped: {invalidCustom}</li>
              <li>Pending signatures: {pendingRecipients.length}</li>
            </ul>
            <p className="text-muted-foreground mt-3 text-xs">
              Suppressed recipients are excluded from delivery based on your
              list and self-send rules. You can add or remove entries anytime
              before signing.
            </p>
          </section>
        </div>

        <div className="space-y-6">
          <section className="border-border rounded-lg border p-4">
            <h2 className="font-medium">Compatibility forecast</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              {broadcastCompatibilityForecastNote(campaign.deliveryMode)}
            </p>
          </section>

          <section className="border-border rounded-lg border p-4">
            <h2 className="font-medium">Plan limits</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Plan: {planType} · up to {limits.maxRecipientsPerCampaign}{" "}
              recipients per broadcast
              {limits.maxDailyBroadcastRecipients > 0
                ? ` · ${String(limits.maxDailyBroadcastRecipients)} recipients / day`
                : null}
              .
            </p>
          </section>

          {warnings.length > 0 ? (
            <section className="border-border rounded-lg border p-4">
              <h2 className="font-medium">Risk &amp; quality</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {warnings.map((w) => (
                  <li
                    key={`${w.level}:${w.message}`}
                    className={cn(
                      "rounded-md px-3 py-2",
                      w.level === "warning"
                        ? "bg-amber-500/10 text-amber-950 dark:text-amber-100"
                        : "bg-muted/50 text-muted-foreground"
                    )}
                  >
                    {w.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="border-border bg-muted/20 rounded-lg border p-4">
            <p className="text-muted-foreground text-xs">
              Use broadcasts for relevant updates. Repeated unsolicited DMs can
              damage sender reputation on the network.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link
                to={`/dashboard/broadcasts/new?campaignId=${encodeURIComponent(campaign.id)}`}
                className="border-input bg-background hover:bg-muted inline-flex justify-center rounded-md border px-4 py-2 text-sm font-medium"
              >
                Back to edit
              </Link>
              <button
                type="button"
                onClick={() => {
                  void runFinalize();
                }}
                disabled={!!finalizeProgress}
                className="bg-primary text-primary-foreground inline-flex justify-center rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {scheduledIsFuture ? "Sign and schedule" : "Sign and send now"}
              </button>
            </div>
            {finalizeProgress ? (
              <p className="text-muted-foreground mt-2 text-sm">
                {finalizeProgress}
              </p>
            ) : null}
            {finalizeError ? (
              <p className="text-destructive mt-2 text-sm">{finalizeError}</p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
