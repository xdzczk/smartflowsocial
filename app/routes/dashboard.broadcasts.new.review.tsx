import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
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
  ensureUnsubscribeTokensForCampaign,
  getBroadcastUnsubscribeBaseUrl,
} from "~/features/broadcast/broadcast-unsubscribe.server";
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

function audienceResolvedMetadata(
  logs: Array<{ eventType: string; metadataJson: unknown }>
): {
  invalidCustom: number;
  excludedRecentMessaged: number;
  excludedPriorBroadcast: number;
} {
  const resolveLog = logs.find((l) => l.eventType === "audience_resolved");
  const m = resolveLog?.metadataJson;
  if (!m || typeof m !== "object") {
    return {
      invalidCustom: 0,
      excludedRecentMessaged: 0,
      excludedPriorBroadcast: 0,
    };
  }
  const o = m as Record<string, unknown>;
  const num = (k: string) => {
    const v = o[k];
    return typeof v === "number" ? v : 0;
  };
  return {
    invalidCustom: num("invalidCustom"),
    excludedRecentMessaged: num("excludedRecentMessaged"),
    excludedPriorBroadcast: num("excludedPriorBroadcast"),
  };
}

function parseSnapshotSummary(
  raw: unknown
): { summary?: Record<string, unknown>; sourceTab?: string } | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const version = o["version"];
  if (version !== 1) return { summary: undefined, sourceTab: undefined };
  const summaryRaw = o["summary"];
  const summary =
    summaryRaw && typeof summaryRaw === "object"
      ? (summaryRaw as Record<string, unknown>)
      : undefined;
  const sourceTab =
    typeof o["sourceTab"] === "string" ? o["sourceTab"] : undefined;
  return { summary, sourceTab };
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

  const baseUrl = getBroadcastUnsubscribeBaseUrl(request);
  const pendingRecipients = await ensureUnsubscribeTokensForCampaign(
    userId,
    campaign.id,
    baseUrl
  );
  if (pendingRecipients.length === 0) {
    return redirect(`/dashboard/broadcasts/${campaign.id}`);
  }

  const { currentSubscription } = await getSubscriptionData(userId);
  const planType = getUserPlanType(currentSubscription);
  const limits = getBroadcastPlanLimits(planType);
  const user = await getUserById(userId);

  const resolvedMeta = audienceResolvedMetadata(campaign.eventLogs);
  const invalidCustom = resolvedMeta.invalidCustom;
  const parseSnapshot = parseSnapshotSummary(campaign.parseSnapshotJson);
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
  const lintWarnings = getBroadcastMessageLintWarnings(campaign.messageBody, {
    footerReserveChars: true,
  }).map((w) => ({
    level: w.level as "info" | "warning",
    message: w.message,
  }));
  const warnings = [...lintWarnings, ...reviewWarnings];

  const scheduledIsFuture =
    campaign.scheduledFor != null &&
    new Date(campaign.scheduledFor).getTime() > Date.now();

  return json({
    campaign,
    pendingRecipients,
    limits,
    planType,
    signerNpub: user?.npub ?? null,
    userTimezone: user?.timezone ?? "Etc/UTC",
    warnings,
    invalidCustom,
    excludedRecentMessaged: resolvedMeta.excludedRecentMessaged,
    excludedPriorBroadcast: resolvedMeta.excludedPriorBroadcast,
    parseSnapshot,
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
    excludedRecentMessaged,
    excludedPriorBroadcast,
    parseSnapshot,
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

  const snapshotSummary = parseSnapshot?.summary;
  const snapshotSourceTab = parseSnapshot?.sourceTab;

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
              <li>Excluded (messaged recently): {excludedRecentMessaged}</li>
              <li>
                Excluded (prior broadcast recipients): {excludedPriorBroadcast}
              </li>
              <li>Pending signatures: {pendingRecipients.length}</li>
            </ul>
            <p className="text-muted-foreground mt-3 text-xs">
              Suppressed recipients are excluded from delivery based on your
              list and self-send rules. You can add or remove entries anytime
              before signing.
            </p>
          </section>

          {snapshotSummary || snapshotSourceTab ? (
            <section className="border-border rounded-lg border p-4">
              <h2 className="font-medium">Composer snapshot</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                {snapshotSourceTab ? (
                  <>
                    Source tab when drafted:{" "}
                    <span className="text-foreground font-medium">
                      {snapshotSourceTab}
                    </span>
                  </>
                ) : null}
              </p>
              {snapshotSummary ? (
                <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                  {typeof snapshotSummary["parsed"] === "number" ? (
                    <li>
                      Parsed (from composer):{" "}
                      {String(snapshotSummary["parsed"])}
                    </li>
                  ) : null}
                  {typeof snapshotSummary["valid"] === "number" ? (
                    <li>
                      Valid (from composer): {String(snapshotSummary["valid"])}
                    </li>
                  ) : null}
                  {typeof snapshotSummary["duplicates"] === "number" ? (
                    <li>
                      Duplicates (from composer):{" "}
                      {String(snapshotSummary["duplicates"])}
                    </li>
                  ) : null}
                  {typeof snapshotSummary["invalid"] === "number" ? (
                    <li>
                      Invalid (from composer):{" "}
                      {String(snapshotSummary["invalid"])}
                    </li>
                  ) : null}
                  {typeof snapshotSummary["finalSendable"] === "number" ? (
                    <li>
                      Sendable estimate (from composer):{" "}
                      {String(snapshotSummary["finalSendable"])}
                    </li>
                  ) : null}
                </ul>
              ) : null}
              <p className="text-muted-foreground mt-2 text-xs">
                Final counts above reflect server resolution (suppression,
                exclusions, graph).
              </p>
            </section>
          ) : null}

          <section className="border-border rounded-lg border p-4">
            <h2 className="font-medium">Save audience</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Save this audience definition to your library for reuse (same type
              and recipient lines as this draft).
            </p>
            <Form
              method="post"
              action="/dashboard/broadcasts/audiences"
              className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
            >
              <input type="hidden" name="intent" value="save_from_review" />
              <input type="hidden" name="campaignId" value={campaign.id} />
              <div className="min-w-[200px] flex-1">
                <label
                  htmlFor="save-audience-name"
                  className="mb-1 block text-xs font-medium"
                >
                  Name
                </label>
                <input
                  id="save-audience-name"
                  name="name"
                  defaultValue={`${campaign.name} audience`}
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
              >
                Save as audience
              </button>
            </Form>
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
