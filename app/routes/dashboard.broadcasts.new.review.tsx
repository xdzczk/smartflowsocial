import type { LoaderFunctionArgs } from "@remix-run/node";
import { defer, json, redirect } from "@remix-run/node";
import { Await, Form, Link, useLoaderData } from "@remix-run/react";
import { Suspense, useCallback, useMemo, useState } from "react";

import { BroadcastReviewPageSkeleton } from "~/components/broadcast/BroadcastReviewPageSkeleton";
import { DeferredRouteAwaitError } from "~/components/deferred-route/DeferredRouteAwaitError";
import { Button } from "~/components/ui/button";
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
import { formatBroadcastUnsubscribeFooter } from "~/features/broadcast/broadcast-unsubscribe-copy";
import {
  ensureUnsubscribeTokensForCampaign,
  getBroadcastUnsubscribeBaseUrl,
} from "~/features/broadcast/broadcast-unsubscribe.server";
import { campaignFieldClassNames } from "~/features/campaign-ui";
import {
  getBroadcastPlanLimits,
  getUserPlanType,
  requireAnySubscription,
} from "~/features/payments";
import { getSubscriptionData } from "~/features/payments/subscriptions.server";
import { getUserById } from "~/features/user";
import { isRemixResourceRequest } from "~/lib/remix/is-remix-resource-request";
import { cn } from "~/lib/utils";

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

async function getBroadcastReviewData({
  campaignId,
  userId,
  request,
}: {
  campaignId: string;
  userId: string;
  request: Request;
}) {
  const campaign = await getBroadcastCampaignForUser(campaignId, userId);
  if (!campaign) {
    throw redirect("/dashboard/broadcasts/new");
  }

  if (campaign.status !== "DRAFT" && campaign.status !== "AWAITING_SIGNATURE") {
    throw redirect(`/dashboard/broadcasts/${campaign.id}`);
  }

  if (campaign.totalRecipients === 0) {
    throw redirect(
      `/dashboard/broadcasts/new?campaignId=${encodeURIComponent(campaign.id)}&notice=${encodeURIComponent("Resolve your audience before review.")}`
    );
  }

  const pending = campaign.recipients.filter((r) => r.status === "PENDING");
  if (pending.length === 0) {
    throw redirect(`/dashboard/broadcasts/${campaign.id}`);
  }

  const baseUrl = getBroadcastUnsubscribeBaseUrl(request);
  const pendingRecipients = await ensureUnsubscribeTokensForCampaign(
    userId,
    campaign.id,
    baseUrl
  );
  if (pendingRecipients.length === 0) {
    throw redirect(`/dashboard/broadcasts/${campaign.id}`);
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
    level: w.level,
    message: w.message,
  }));
  const warnings = [...lintWarnings, ...reviewWarnings];

  const scheduledIsFuture =
    campaign.scheduledFor != null &&
    new Date(campaign.scheduledFor).getTime() > Date.now();

  return {
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
  };
}

type BroadcastReviewLoaderData = Awaited<
  ReturnType<typeof getBroadcastReviewData>
>;

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId");
  if (!campaignId) {
    return redirect("/dashboard/broadcasts/new");
  }

  const reviewPromise = getBroadcastReviewData({ campaignId, userId, request });

  if (isRemixResourceRequest(request)) {
    return json(await reviewPromise);
  }

  return defer<{ review: Promise<BroadcastReviewLoaderData> }>({
    review: reviewPromise,
  });
}

export default function BroadcastNewReviewRoute() {
  const { review } = useLoaderData<{
    review: Promise<BroadcastReviewLoaderData>;
  }>();
  return (
    <Suspense fallback={<BroadcastReviewPageSkeleton />}>
      <Await
        resolve={review}
        errorElement={
          <DeferredRouteAwaitError retryTo="/dashboard/broadcasts/new" />
        }
      >
        {(loaded) => (
          <BroadcastNewReviewRouteLoaded
            loaded={loaded as BroadcastReviewLoaderData}
          />
        )}
      </Await>
    </Suspense>
  );
}

function BroadcastNewReviewRouteLoaded({
  loaded,
}: {
  loaded: BroadcastReviewLoaderData;
}) {
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
  } = loaded;

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
  const sampleUnsubscribeUrl = pendingRecipients[0]?.unsubscribeUrl ?? null;
  const previewMessage = sampleUnsubscribeUrl
    ? `${campaign.messageBody}\n\n${formatBroadcastUnsubscribeFooter(sampleUnsubscribeUrl)}`
    : campaign.messageBody;

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
    <div className="w-full min-w-0 space-y-8">
      <div>
        <Link
          to={`/dashboard/broadcasts/new?campaignId=${encodeURIComponent(campaign.id)}`}
          className="text-text-secondary text-sm hover:underline"
        >
          ← Back to edit
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Review broadcast
        </h1>
        <p className="text-text-secondary mt-1 text-sm">
          You are about to enqueue delivery to{" "}
          <strong className="text-text">
            {String(pendingRecipients.length)}
          </strong>{" "}
          recipients. Review audience, compatibility, and schedule carefully
          before signing. This action creates signed DM events and publishes
          them through background workers.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="border-border bg-surface shadow-1 rounded-xl border p-4">
            <h2 className="font-medium">Campaign summary</h2>
            <ul className="text-text-secondary mt-3 space-y-2 text-sm">
              <li>
                <span className="text-text font-medium">Name:</span>{" "}
                {campaign.name}{" "}
                <span className="text-xs">
                  (internal only; recipients will not see this)
                </span>
              </li>
              <li>
                <span className="text-text font-medium">Status:</span>{" "}
                {formatBroadcastCampaignStatus(campaign.status)}
              </li>
              <li>
                <span className="text-text font-medium">Audience:</span>{" "}
                {formatBroadcastAudienceLabel(
                  campaign.audienceType,
                  campaign.totalRecipients
                )}
              </li>
              <li>
                <span className="text-text font-medium">Delivery:</span>{" "}
                {formatBroadcastDeliveryMode(campaign.deliveryMode)}
              </li>
              <li>
                <span className="text-text font-medium">Strategy:</span>{" "}
                {campaign.sendStrategy === "STAGGERED"
                  ? "Staggered pacing (slight delay between jobs)"
                  : "Standard concurrency"}
              </li>
              <li>
                <span className="text-text font-medium">Schedule:</span>{" "}
                {scheduleSentence}
              </li>
              <li>
                <span className="text-text font-medium">Signer:</span>{" "}
                <span className="font-mono text-xs break-all">
                  {signerNpub ?? "Connect your Nostr signer to finalize"}
                </span>
              </li>
            </ul>
            <div className="border-border mt-4 border-t pt-4">
              <h3 className="text-sm font-medium">Message preview</h3>
              <p className="text-text-secondary mt-2 max-h-48 overflow-y-auto text-sm whitespace-pre-wrap">
                {previewMessage}
              </p>
              {sampleUnsubscribeUrl ? (
                <p className="text-text-secondary mt-2 text-xs">
                  Preview includes a sample unsubscribe link. Each recipient
                  gets their own unique link.
                </p>
              ) : null}
            </div>
          </section>

          <section className="border-border bg-surface shadow-1 rounded-xl border p-4">
            <h2 className="font-medium">Recipient resolution</h2>
            <ul className="text-text-secondary mt-3 space-y-1 text-sm">
              <li>Final send count: {campaign.totalRecipients}</li>
              <li>
                Suppressed (pre-send): {campaign.suppressedCount}
                {campaign.suppressedCount > 0 ? (
                  <>
                    {" "}
                    <Link
                      to="/dashboard/broadcasts/suppression"
                      className="text-link hover:text-link-hover font-medium hover:underline"
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
            <p className="text-text-secondary mt-3 text-xs">
              Suppressed recipients are excluded from delivery based on your
              list and self-send rules. You can add or remove entries anytime
              before signing.
            </p>
          </section>

          {snapshotSummary || snapshotSourceTab ? (
            <section className="border-border bg-surface shadow-1 rounded-xl border p-4">
              <h2 className="font-medium">Composer snapshot</h2>
              <p className="text-text-secondary mt-2 text-sm">
                {snapshotSourceTab ? (
                  <>
                    Source tab when drafted:{" "}
                    <span className="text-text font-medium">
                      {snapshotSourceTab}
                    </span>
                  </>
                ) : null}
              </p>
              {snapshotSummary ? (
                <ul className="text-text-secondary mt-2 space-y-1 text-sm">
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
              <p className="text-text-secondary mt-2 text-xs">
                Final counts above reflect server resolution (suppression,
                exclusions, graph).
              </p>
            </section>
          ) : null}

          <section className="border-border bg-surface shadow-1 rounded-xl border p-4">
            <h2 className="font-medium">Save audience</h2>
            <p className="text-text-secondary mt-2 text-sm">
              Save this audience definition to your library for reuse (same type
              and recipient lines as this draft).
            </p>
            <Form
              method="post"
              action="/dashboard/broadcasts/audiences"
              className="stack-tight mt-3 sm:flex-row sm:flex-wrap sm:items-end"
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
                  className={campaignFieldClassNames}
                />
              </div>
              <Button type="submit">Save as audience</Button>
            </Form>
          </section>
        </div>

        <div className="space-y-6">
          <section className="border-border bg-surface shadow-1 rounded-xl border p-4">
            <h2 className="font-medium">Compatibility forecast</h2>
            <p className="text-text-secondary mt-2 text-sm">
              {broadcastCompatibilityForecastNote(campaign.deliveryMode)}
            </p>
          </section>

          <section className="border-border bg-surface shadow-1 rounded-xl border p-4">
            <h2 className="font-medium">Plan limits</h2>
            <p className="text-text-secondary mt-2 text-sm">
              Plan: {planType} · up to {limits.maxRecipientsPerCampaign}{" "}
              recipients per broadcast
              {limits.maxDailyBroadcastRecipients > 0
                ? ` · ${String(limits.maxDailyBroadcastRecipients)} recipients / day`
                : null}
              .
            </p>
          </section>

          {warnings.length > 0 ? (
            <section className="border-border bg-surface shadow-1 rounded-xl border p-4">
              <h2 className="font-medium">Risk &amp; quality</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {warnings.map((w) => (
                  <li
                    key={`${w.level}:${w.message}`}
                    className={cn(
                      "rounded-md px-3 py-2",
                      w.level === "warning"
                        ? "bg-warning/10 text-warning-text"
                        : "bg-surface-hover/50 text-text-secondary"
                    )}
                  >
                    {w.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="border-border bg-surface shadow-1 rounded-xl border p-4">
            <p className="text-text-secondary text-xs">
              Use broadcasts for relevant updates. Repeated unsolicited DMs can
              damage sender reputation on the network.
            </p>
            <div className="stack-tight mt-4 sm:flex-row sm:flex-wrap">
              <Button variant="outline" asChild>
                <Link
                  to={`/dashboard/broadcasts/new?campaignId=${encodeURIComponent(campaign.id)}`}
                >
                  Back to edit
                </Link>
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void runFinalize();
                }}
                disabled={!!finalizeProgress}
              >
                {scheduledIsFuture ? "Sign and schedule" : "Sign and send now"}
              </Button>
            </div>
            {finalizeProgress ? (
              <p className="text-text-secondary mt-2 text-sm">
                {finalizeProgress}
              </p>
            ) : null}
            {finalizeError ? (
              <p className="text-danger mt-2 text-sm">{finalizeError}</p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
