import type { BroadcastDeliveryMode } from "@prisma/client";
import { Form } from "@remix-run/react";
import { ArrowRight, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

import { AudienceGraphPanel } from "~/components/broadcast/audience/AudienceGraphPanel";
import {
  AudienceSourceCards,
  type AudienceMode,
} from "~/components/broadcast/audience/AudienceSourceCards";
import { AudienceSummaryCard } from "~/components/broadcast/audience/AudienceSummaryCard";
import { RecipientPicker } from "~/components/broadcast/audience/RecipientPicker";
import { Button } from "~/components/ui/button";
import {
  broadcastDeliveryModeComposerHelper,
  broadcastSendStrategyComposerHelper,
} from "~/features/broadcast/broadcast-delivery-copy";
import { getBroadcastMessageLintWarnings } from "~/features/broadcast/broadcast-message-lint";
import { getBroadcastScheduleTimeLabel } from "~/features/broadcast/broadcast-schedule-label";
import { formatBroadcastUnsubscribeFooter } from "~/features/broadcast/broadcast-unsubscribe-copy";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { formatIntervalLabel } from "~/lib/schedule-intervals";
import {
  addHours,
  formatForDateTimeLocal,
  getNowForDateTimeLocal,
  nowInTimezone,
} from "~/lib/temporal";

const BROADCAST_QUICK_SCHEDULE_INTERVALS_HOURS = [
  0.25, 0.5, 1, 12, 24,
] as const;
const UNSUBSCRIBE_PREVIEW_TOKEN = "your_unique_token";

function normalizeHexLines(lines: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const p = line.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/i.test(p)) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

function broadcastReviewPrimaryLabel(
  busy: boolean,
  scheduleLater: boolean,
  hasValidSchedule: boolean,
  scheduleTimeLabel: string | null
): string {
  if (busy) return scheduleLater ? "Scheduling…" : "Continuing…";
  if (scheduleLater) {
    if (hasValidSchedule && scheduleTimeLabel) {
      return `Review broadcast · ${scheduleTimeLabel}`;
    }
    return "Review broadcast";
  }
  return "Review broadcast";
}

function FormSection(props: {
  step: string;
  title: string;
  purpose: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          <span className="text-muted-foreground mr-2 font-mono text-base tabular-nums">
            {props.step}
          </span>
          {props.title}
        </h2>
        <p className="text-muted-foreground mt-1.5 text-sm">{props.purpose}</p>
      </div>
      <div className="border-border bg-card/40 rounded-xl border p-5 shadow-sm">
        {props.children}
      </div>
    </section>
  );
}

export interface BroadcastNewDraftFormProps {
  limits: {
    allowSchedule: boolean;
    allowAdvancedDelivery: boolean;
    allowStaggered: boolean;
    allowedAudienceTypes: string[];
    maxRecipientsPerCampaign: number;
    maxDailyBroadcastRecipients: number;
  };
  planType: string;
  busy: boolean;
  actionError: string | null;
  savedAudiences: Array<{
    id: string;
    name: string;
    audienceType: string;
    customNpubLines: string[];
    ruleSummary: string | null;
    lastResolvedSize: number | null;
    updatedAt: string;
  }>;
  savedForNew: {
    id: string;
    name: string;
    audienceType: string;
    customNpubLines: string[];
  } | null;
  userTimezone: string;
  recentBroadcastMessageSnippet?: string | null;
  unsubscribePreviewBaseUrl: string;
}

/* eslint-disable sonarjs/cognitive-complexity -- guided composer coordinates audience, message, delivery */
export function BroadcastNewDraftForm({
  limits,
  planType,
  busy,
  actionError,
  savedAudiences,
  savedForNew,
  userTimezone,
  recentBroadcastMessageSnippet = null,
  unsubscribePreviewBaseUrl,
}: BroadcastNewDraftFormProps) {
  const savedFiltered = useMemo(
    () =>
      savedAudiences.filter(
        (s) => s.audienceType !== "FOLLOWING" && s.audienceType !== "FOLLOWERS"
      ),
    [savedAudiences]
  );

  const allowMutuals = limits.allowedAudienceTypes.includes("MUTUALS");

  const [audienceMode, setAudienceMode] = useState<AudienceMode>(() => {
    if (savedForNew?.audienceType === "MUTUALS") return "mutuals";
    if (savedForNew?.audienceType === "CUSTOM") return "selected";
    if (allowMutuals) return "mutuals";
    return "selected";
  });

  const [selectedPubkeys, setSelectedPubkeys] = useState<string[]>(() =>
    savedForNew?.audienceType === "CUSTOM"
      ? normalizeHexLines(savedForNew.customNpubLines)
      : []
  );

  const [trayStats, setTrayStats] = useState({
    selected: 0,
    suppressed: 0,
    sendable: 0,
  });

  const onSelectionStats = useCallback(
    (s: { selected: number; suppressed: number; sendable: number }) => {
      setTrayStats(s);
    },
    []
  );

  const [excludeMessagedDays, setExcludeMessagedDays] = useState(0);
  const [excludePriorBroadcastRecipients, setExcludePriorBroadcastRecipients] =
    useState(false);

  const [messageLen, setMessageLen] = useState(0);
  const [messageBody, setMessageBody] = useState("");
  const [showMessagePreview, setShowMessagePreview] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState("BEST_COMPATIBILITY");
  const [sendStrategy, setSendStrategy] = useState("STANDARD");
  const [scheduleLater, setScheduleLater] = useState(false);
  const [scheduledForLocal, setScheduledForLocal] = useState("");

  const resolvedSendStrategy = limits.allowStaggered
    ? sendStrategy
    : "STANDARD";

  const minDatetime = getNowForDateTimeLocal(userTimezone);
  const hasValidScheduleTime =
    scheduledForLocal.trim() !== "" &&
    !Number.isNaN(new Date(scheduledForLocal).getTime());
  const hasScheduleTimeForSubmit =
    limits.allowSchedule && scheduleLater && hasValidScheduleTime;
  const scheduleTimeLabel = hasScheduleTimeForSubmit
    ? getBroadcastScheduleTimeLabel(scheduledForLocal)
    : null;

  const applyQuickSchedule = (hours: number) => {
    const min = getNowForDateTimeLocal(userTimezone);
    const now = nowInTimezone(userTimezone);
    const hoursLater = addHours(now, hours);
    const formatted = formatForDateTimeLocal(hoursLater, userTimezone);
    setScheduledForLocal(formatted < min ? min : formatted);
  };

  const effectiveAudienceType =
    audienceMode === "mutuals" ? ("MUTUALS" as const) : ("CUSTOM" as const);

  const hiddenCustomNpubs =
    audienceMode === "selected" ? selectedPubkeys.join("\n") : "";

  const parseSnapshotJson = useMemo(
    () =>
      JSON.stringify({
        version: 2,
        audienceMode,
        selectedCount: selectedPubkeys.length,
      }),
    [audienceMode, selectedPubkeys.length]
  );

  const exclusionRulesJson = useMemo(() => {
    const rules: Record<string, unknown> = {};
    if (excludeMessagedDays > 0) {
      rules["excludeMessagedWithinDays"] = excludeMessagedDays;
    }
    if (excludePriorBroadcastRecipients) {
      rules["excludePriorBroadcastRecipients"] = true;
    }
    return Object.keys(rules).length > 0 ? JSON.stringify(rules) : "";
  }, [excludeMessagedDays, excludePriorBroadcastRecipients]);

  const messageLint = useMemo(
    () =>
      getBroadcastMessageLintWarnings(messageBody, {
        recentBroadcastSnippet: recentBroadcastMessageSnippet,
      }),
    [messageBody, recentBroadcastMessageSnippet]
  );

  const [graphEstimateStats, setGraphEstimateStats] = useState<{
    count: number | null;
    fetchFailed: boolean;
  } | null>(null);

  const onGraphEstimateStats = useCallback(
    (s: { count: number | null; fetchFailed: boolean }) => {
      setGraphEstimateStats(s);
    },
    []
  );

  const audienceHeadline =
    audienceMode === "mutuals" ? "Mutuals" : "Selected recipients";

  const riskSource = audienceMode === "mutuals" ? "MUTUALS" : "CUSTOM";

  const scheduleSummary =
    hasScheduleTimeForSubmit && scheduleTimeLabel
      ? scheduleTimeLabel
      : "After review";
  const hasMessage = messageBody.trim().length > 0;
  const unsubscribePreviewUrl = `${unsubscribePreviewBaseUrl.replace(/\/$/, "")}/broadcast/unsubscribe?t=${UNSUBSCRIBE_PREVIEW_TOKEN}`;
  const messagePreviewText = hasMessage
    ? `${messageBody}\n\n${formatBroadcastUnsubscribeFooter(unsubscribePreviewUrl)}`
    : "";

  const canContinue =
    hasMessage && (audienceMode === "mutuals" || selectedPubkeys.length > 0);

  const canSaveAudience =
    audienceMode === "selected" && selectedPubkeys.length > 0 && hasMessage;

  const primaryLabel = broadcastReviewPrimaryLabel(
    busy,
    scheduleLater,
    hasScheduleTimeForSubmit,
    scheduleTimeLabel
  );

  const primaryIntent = hasScheduleTimeForSubmit
    ? "create_schedule"
    : "create_now";

  const deliveryModeHelper = broadcastDeliveryModeComposerHelper(
    deliveryMode as BroadcastDeliveryMode
  );
  const strategyHelper =
    broadcastSendStrategyComposerHelper(resolvedSendStrategy);

  return (
    <Form
      method="post"
      key={savedForNew?.id ?? "new-draft"}
      className="grid gap-10 lg:grid-cols-[1fr_minmax(280px,320px)] lg:items-start"
    >
      <input type="hidden" name="audienceType" value={effectiveAudienceType} />
      <input type="hidden" name="customNpubs" value={hiddenCustomNpubs} />
      <input type="hidden" name="parseSnapshotJson" value={parseSnapshotJson} />
      {exclusionRulesJson ? (
        <input
          type="hidden"
          name="exclusionRulesJson"
          value={exclusionRulesJson}
        />
      ) : null}

      <div className="space-y-12">
        {actionError ? (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
          >
            {actionError}
          </div>
        ) : null}

        <FormSection
          step="1"
          title="Audience"
          purpose="Choose who should receive this direct update."
        >
          <div className="space-y-6">
            <AudienceSourceCards
              value={audienceMode}
              onChange={(m) => {
                setAudienceMode(m);
              }}
              disabled={busy}
              allowMutuals={allowMutuals}
            />

            {audienceMode === "mutuals" && allowMutuals ? (
              <div className="border-border bg-muted/10 space-y-3 rounded-xl border p-4">
                <p className="text-muted-foreground text-sm">
                  Resolved at send time from two-way follow relationships.
                </p>
                <span className="inline-block rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-900 dark:text-emerald-100">
                  Lower spam risk
                </span>
                <AudienceGraphPanel onEstimateStats={onGraphEstimateStats} />
              </div>
            ) : null}

            {audienceMode === "selected" ? (
              <RecipientPicker
                savedAudiences={savedFiltered}
                selectedPubkeys={selectedPubkeys}
                onChangeSelected={setSelectedPubkeys}
                onSelectionStats={onSelectionStats}
                disabled={busy}
              />
            ) : null}

            <div className="border-border space-y-3 rounded-xl border p-4">
              <p className="text-sm font-medium">Audience exclusions</p>
              <p className="text-muted-foreground text-xs">
                Applied when the final audience is resolved.
              </p>
              <p className="text-muted-foreground text-xs">
                Suppressed recipients are always excluded automatically.
              </p>
              <div>
                <label
                  htmlFor="broadcast-exclude-recent-days-global"
                  className="text-muted-foreground text-xs font-medium"
                >
                  Exclude recipients messaged in the last
                </label>
                <select
                  id="broadcast-exclude-recent-days-global"
                  className="border-input bg-background mt-1 block w-full max-w-xs rounded-md border px-3 py-2 text-sm"
                  value={String(excludeMessagedDays)}
                  onChange={(e) => {
                    setExcludeMessagedDays(Number(e.target.value));
                  }}
                >
                  <option value="0">No extra exclusion</option>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                </select>
              </div>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="border-input mt-0.5 rounded"
                  checked={excludePriorBroadcastRecipients}
                  onChange={(e) => {
                    setExcludePriorBroadcastRecipients(e.target.checked);
                  }}
                />
                <span>
                  Exclude anyone who already received a prior completed
                  broadcast from this account.
                </span>
              </label>
            </div>
          </div>
        </FormSection>

        <FormSection
          step="2"
          title="Message"
          purpose="Write what recipients will read in their DMs."
        >
          <div className="space-y-5">
            <div>
              <label
                htmlFor="broadcast-internal-name"
                className="mb-1 block text-sm font-medium"
              >
                Internal name
              </label>
              <input
                id="broadcast-internal-name"
                name="name"
                required
                defaultValue={savedForNew?.name ?? ""}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                placeholder="March update · Beta list · Team note"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                For your workspace only. Recipients won’t see this.
              </p>
            </div>

            <div>
              <label
                htmlFor="broadcast-message-body"
                className="mb-1 block text-sm font-medium"
              >
                Message
              </label>
              <textarea
                id="broadcast-message-body"
                name="messageBody"
                required
                rows={10}
                maxLength={8000}
                value={messageBody}
                onChange={(e) => {
                  setMessageBody(e.target.value);
                  setMessageLen(e.target.value.length);
                }}
                className="border-input bg-background focus-visible:ring-primary min-h-[220px] w-full rounded-md border px-3 py-3 text-sm leading-relaxed shadow-inner focus-visible:ring-2 focus-visible:outline-none"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs tabular-nums">
                  {messageLen} / 8000 characters ·{" "}
                  {messageBody ? messageBody.split(/\r?\n/).length : 0} lines
                </p>
                <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="border-input rounded"
                    checked={showMessagePreview}
                    onChange={(e) => {
                      setShowMessagePreview(e.target.checked);
                    }}
                  />
                  Preview message
                </label>
              </div>
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                Recipients should understand why they are receiving this
                message. Low-context or overly promotional messages are more
                likely to be treated as spam.
              </p>
              {showMessagePreview && hasMessage ? (
                <div
                  className="border-border bg-muted/30 mt-3 rounded-lg border p-4 text-sm whitespace-pre-wrap"
                  aria-live="polite"
                >
                  {messagePreviewText}
                </div>
              ) : null}
              {showMessagePreview && hasMessage ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  Preview uses a sample unsubscribe link. Final send uses a
                  unique per-recipient link.
                </p>
              ) : null}
              {messageLint.length > 0 ? (
                <ul className="mt-3 space-y-1 text-xs text-amber-800 dark:text-amber-200">
                  {messageLint.map((w) => (
                    <li key={`${w.level}:${w.message}`}>{w.message}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </FormSection>

        <FormSection
          step="3"
          title="Delivery"
          purpose="Choose how and when to send after you review and sign."
        >
          <div className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="broadcast-delivery-mode"
                  className="mb-1 block text-sm font-medium"
                >
                  Delivery mode
                </label>
                <select
                  id="broadcast-delivery-mode"
                  name="deliveryMode"
                  value={deliveryMode}
                  onChange={(e) => setDeliveryMode(e.target.value)}
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="BEST_COMPATIBILITY">Best compatibility</option>
                  {limits.allowAdvancedDelivery ? (
                    <>
                      <option value="NIP04_ONLY">NIP-04 only (legacy)</option>
                      <option value="NIP17_ONLY">NIP-17 only</option>
                      <option value="NIP17_FALLBACK_NIP04">
                        NIP-17 with NIP-04 fallback
                      </option>
                      <option value="BOTH">Both (expert)</option>
                    </>
                  ) : null}
                </select>
                <p className="text-muted-foreground mt-1.5 text-xs leading-snug">
                  {deliveryModeHelper}
                </p>
              </div>
              <div>
                <label
                  htmlFor="broadcast-send-strategy"
                  className="mb-1 block text-sm font-medium"
                >
                  Strategy
                </label>
                <select
                  id="broadcast-send-strategy"
                  name="sendStrategy"
                  value={resolvedSendStrategy}
                  onChange={(e) => setSendStrategy(e.target.value)}
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="STANDARD">Standard</option>
                  {limits.allowStaggered ? (
                    <option value="STAGGERED">Conservative</option>
                  ) : null}
                </select>
                <p className="text-muted-foreground mt-1.5 text-xs leading-snug">
                  {strategyHelper}
                </p>
              </div>
            </div>

            {limits.allowSchedule ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">Send time</p>
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      className="border-input"
                      checked={!scheduleLater}
                      onChange={() => {
                        setScheduleLater(false);
                        setScheduledForLocal("");
                      }}
                    />
                    Send after review
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      className="border-input"
                      checked={scheduleLater}
                      onChange={() => {
                        setScheduleLater(true);
                      }}
                    />
                    Schedule for later
                  </label>
                </div>
                {scheduleLater ? (
                  <div className="space-y-2">
                    <input
                      id="broadcast-scheduled-for"
                      type="datetime-local"
                      name="scheduledFor"
                      value={scheduledForLocal}
                      min={minDatetime}
                      onChange={(e) => {
                        const v = e.target.value;
                        const min = getNowForDateTimeLocal(userTimezone);
                        setScheduledForLocal(v && v < min ? min : v);
                      }}
                      className="border-input bg-background w-full max-w-md rounded-md border px-3 py-2 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      {BROADCAST_QUICK_SCHEDULE_INTERVALS_HOURS.map((h) => (
                        <Button
                          key={h}
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            applyQuickSchedule(h);
                          }}
                          className="border-primary text-foreground hover:bg-muted transition-transform duration-150 active:scale-95"
                        >
                          {formatIntervalLabel(h, { compact: true })}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <p className="text-muted-foreground text-xs leading-relaxed">
              Signed direct messages are queued after review. The next step is
              review and signing—not an instant blast.
            </p>

            <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap">
              <button
                type="submit"
                name="intent"
                value={primaryIntent}
                disabled={
                  busy ||
                  !canContinue ||
                  (scheduleLater &&
                    limits.allowSchedule &&
                    !hasValidScheduleTime)
                }
                className="bg-success hover:bg-success/90 inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {hasScheduleTimeForSubmit ? (
                  <Clock
                    className="h-5 w-5 shrink-0"
                    strokeWidth={INLINE_ICON_STROKE}
                    aria-hidden
                  />
                ) : (
                  <ArrowRight
                    className="h-5 w-5 shrink-0"
                    strokeWidth={INLINE_ICON_STROKE}
                    aria-hidden
                  />
                )}
                {primaryLabel}
              </button>
              <button
                type="submit"
                name="intent"
                value="create_draft"
                disabled={busy || !canContinue}
                className="border-input bg-background hover:bg-muted rounded-md border px-4 py-2.5 text-sm font-medium disabled:opacity-50"
              >
                Save draft
              </button>
              {canSaveAudience ? (
                <button
                  type="submit"
                  name="intent"
                  value="save_audience"
                  disabled={busy}
                  className="border-input bg-background hover:bg-muted rounded-md border px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                >
                  Save audience
                </button>
              ) : null}
            </div>
          </div>
        </FormSection>
      </div>

      <AudienceSummaryCard
        planType={planType}
        limits={{
          maxRecipientsPerCampaign: limits.maxRecipientsPerCampaign,
          maxDailyBroadcastRecipients: limits.maxDailyBroadcastRecipients,
        }}
        riskSource={riskSource}
        audienceHeadline={audienceHeadline}
        estimatedGraphCount={
          audienceMode === "mutuals"
            ? (graphEstimateStats?.count ?? null)
            : undefined
        }
        graphFetchFailed={
          audienceMode === "mutuals"
            ? (graphEstimateStats?.fetchFailed ?? false)
            : false
        }
        selectedCount={
          audienceMode === "selected" ? trayStats.selected : undefined
        }
        selectedSuppressed={
          audienceMode === "selected" ? trayStats.suppressed : undefined
        }
        selectedSendable={
          audienceMode === "selected" ? trayStats.sendable : undefined
        }
        deliveryMode={deliveryMode as BroadcastDeliveryMode}
        sendStrategy={resolvedSendStrategy}
        scheduleSummary={scheduleSummary}
        excludeRecentDays={excludeMessagedDays}
        overlapWarning={null}
      />
    </Form>
  );
}
/* eslint-enable sonarjs/cognitive-complexity */
