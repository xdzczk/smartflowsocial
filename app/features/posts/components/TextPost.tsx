import { useFetcher } from "@remix-run/react";
import { Clock, FolderOpen, Pencil, Send } from "lucide-react";
import React from "react";
import { Controller } from "react-hook-form";

import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import AssetBrowser from "~/features/assets/components/AssetBrowser";
import type { Asset } from "~/features/assets/types";
import type { SignedEvent } from "~/features/nostr/types";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { useOptionalUser } from "~/lib/remix-utils";
import { nowMillis, parseDateTimeLocal, toUnixTimestamp } from "~/lib/temporal";
import { textPostClientSchema } from "~/lib/validation";
import { useZodForm } from "~/lib/validation/utils.client-safe";

import { usePostScheduling } from "../hooks/usePostScheduling";
import type { QueueType } from "../types";
import {
  delayAfterMainToSeconds,
  isValidDelayAfterMain,
  type DelayAfterMain,
} from "../utils/delay-after-main";
import {
  buildKind6RepostEvent,
  buildQuoteEvent,
} from "../utils/repost-quote-events.client";

import { QueueSelector } from "./QueueSelector";
import { SchedulingSection } from "./SchedulingSection";

/** Resolve effective hashtags for submit: manual preset or queue default from API. */
async function getEffectiveHashtagsForSubmit(
  useHashtagPresets: boolean,
  selectedHashtags: string,
  selectedQueue: string,
  queueTypes: Array<string | QueueType>,
  userId: string | undefined,
  defaultTags: string[]
): Promise<string> {
  if (useHashtagPresets) {
    return selectedHashtags;
  }
  const selectedQueueType = queueTypes.find(
    (qt) => (typeof qt === "string" ? qt : qt.name) === selectedQueue
  );
  const queueTypeId =
    typeof selectedQueueType === "object" ? selectedQueueType.id : null;
  try {
    const response = await fetch("/api/effective-hashtags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        queueTypeId,
        queueTypeName: selectedQueue,
      }),
    });
    if (response.ok) {
      const data = (await response.json()) as { hashtags?: string };
      return data.hashtags ?? "";
    }
    return defaultTags.join(" ");
  } catch (error) {
    const { handleErrorSafely } = await import("~/lib/error-handler.client");
    handleErrorSafely(error, {
      component: "TextPost",
      action: "fetchEffectiveHashtags",
    });
    return defaultTags.join(" ");
  }
}

interface SignedEventLike {
  id?: string;
  pubkey?: string;
  created_at?: number;
  kind?: number;
  tags?: string[][];
  content?: string;
  sig?: string;
}

/** Build multiple repost schedules: sign one repost per delay after main. */
async function buildRepostSchedules(
  mainScheduledUnix: number,
  delayList: DelayAfterMain[],
  mainSignedEvent: SignedEventLike,
  setSigningError: (msg: string | null) => void
): Promise<Array<{
  scheduledFor: number;
  signedEvent: SignedEventLike;
}> | null> {
  const out: Array<{ scheduledFor: number; signedEvent: SignedEventLike }> = [];
  for (const delay of delayList) {
    if (!isValidDelayAfterMain(delay)) {
      setSigningError(
        "Each repost must be at least 1 (hour or minute) after the main post."
      );
      return null;
    }
    const offsetSeconds = delayAfterMainToSeconds(delay);
    const scheduledForUnix = mainScheduledUnix + offsetSeconds;
    if (scheduledForUnix <= mainScheduledUnix) {
      setSigningError("Repost must be scheduled after the main post.");
      return null;
    }
    const repostEvent = buildKind6RepostEvent(
      mainSignedEvent as SignedEvent,
      scheduledForUnix
    );
    const { signedEvent } = await nostrAdapter.signEvent({
      content: repostEvent.content,
      created_at: repostEvent.created_at,
      kind: repostEvent.kind,
      tags: repostEvent.tags,
    });
    out.push({ scheduledFor: scheduledForUnix, signedEvent });
  }
  return out;
}

/** Build multiple quote schedules: sign one quote per entry (delay + caption). */
async function buildQuoteSchedules(
  mainScheduledUnix: number,
  entries: Array<{
    value: number;
    unit: DelayAfterMain["unit"];
    caption: string;
  }>,
  mainSignedEvent: SignedEventLike,
  tagArray: string[][],
  setSigningError: (msg: string | null) => void
): Promise<Array<{
  scheduledFor: number;
  signedEvent: SignedEventLike;
  caption?: string;
}> | null> {
  const out: Array<{
    scheduledFor: number;
    signedEvent: SignedEventLike;
    caption?: string;
  }> = [];
  for (const e of entries) {
    const delay: DelayAfterMain = { value: e.value, unit: e.unit };
    if (!isValidDelayAfterMain(delay)) {
      setSigningError(
        "Each quote must be at least 1 (hour or minute) after the main post."
      );
      return null;
    }
    const offsetSeconds = delayAfterMainToSeconds(delay);
    const scheduledForUnix = mainScheduledUnix + offsetSeconds;
    if (scheduledForUnix <= mainScheduledUnix) {
      setSigningError("Quote must be scheduled after the main post.");
      return null;
    }
    const quoteEvent = buildQuoteEvent(
      mainSignedEvent as SignedEvent,
      e.caption,
      scheduledForUnix,
      tagArray
    );
    const { signedEvent } = await nostrAdapter.signEvent({
      content: quoteEvent.content,
      created_at: quoteEvent.created_at,
      kind: quoteEvent.kind,
      tags: quoteEvent.tags,
    });
    out.push({
      scheduledFor: scheduledForUnix,
      signedEvent,
      caption: e.caption || undefined,
    });
  }
  return out;
}

interface TextPostProps {
  queueTypes?: Array<string | QueueType>;
  assets?: Asset[];
  hashTagPresets?: Array<{ id: string; name: string; tags: string }>;
  onQueueTypeChange?: (queueType: string) => void;
  selectedHashTagPresetId?: string | null | undefined;
  onHashtagPresetChange?: (presetId: string | null, hashtags: string) => void;
}

export default function TextPost({
  queueTypes = [],
  assets = [],
  hashTagPresets = [],
  onQueueTypeChange,
  selectedHashTagPresetId,
  onHashtagPresetChange,
}: TextPostProps) {
  const fetcher = useFetcher();
  const user = useOptionalUser();
  const [isSigning, setIsSigning] = React.useState(false);
  const [signingError, setSigningError] = React.useState<string | null>(null);
  // Note: User doesn't have hashTags property - this would need to come from hashTagPresets relation
  const tags: string[] = [];
  const [showAssetBrowser, setShowAssetBrowser] = React.useState(false);
  const [selectedHashtags, setSelectedHashtags] = React.useState("");
  const [alsoScheduleRepost, setAlsoScheduleRepost] = React.useState(false);
  const [repostDelayList, setRepostDelayList] = React.useState<
    Array<{ id: string; value: number; unit: DelayAfterMain["unit"] }>
  >([{ id: crypto.randomUUID(), value: 2, unit: "hours" }]);
  const [alsoScheduleQuote, setAlsoScheduleQuote] = React.useState(false);
  const [quoteEntries, setQuoteEntries] = React.useState<
    Array<{
      id: string;
      value: number;
      unit: DelayAfterMain["unit"];
      caption: string;
    }>
  >([{ id: crypto.randomUUID(), value: 2, unit: "hours", caption: "" }]);

  // Initialize form with React Hook Form
  const form = useZodForm(textPostClientSchema, {
    defaultValues: {
      content: "",
      scheduledFor: "",
      queueType: "unassigned",
      isRecyclable: false,
      useHashtagPresets: false,
      hashTagPresetId: selectedHashTagPresetId ?? undefined,
    },
  });

  const content = form.watch("content");
  const useHashtagPresets = form.watch("useHashtagPresets");
  const selectedHashtagPresetId = form.watch("hashTagPresetId");

  // Use the shared scheduling hook
  const {
    selectedQueue,
    setSelectedQueue,
    scheduledFor: schedulingScheduledFor,
    setScheduledFor: setSchedulingScheduledFor,
    calculateQueueScheduleTime,
    handleScheduleIntervalClick,
    scheduleIntervals,
  } = usePostScheduling({
    queueTypes,
    scheduleIntervals: user?.scheduleInterval as number[] | undefined,
    userTimezone: user?.timezone ?? undefined,
    initialQueue: "unassigned",
    onQueueTypeChange,
  });

  // Sync form's queueType with scheduling hook
  React.useEffect(() => {
    form.setValue("queueType", selectedQueue);
  }, [selectedQueue, form]);

  // Sync form's scheduledFor with scheduling hook
  React.useEffect(() => {
    if (schedulingScheduledFor) {
      form.setValue("scheduledFor", schedulingScheduledFor);
    }
  }, [schedulingScheduledFor, form]);

  // Sync scheduling hook when form's scheduledFor changes (only when user
  // actually changed the form, not when we just set it from the API response).
  const formScheduledFor = form.watch("scheduledFor");
  const prevFormScheduledForRef = React.useRef(formScheduledFor);
  React.useEffect(() => {
    const formChanged = prevFormScheduledForRef.current !== formScheduledFor;
    prevFormScheduledForRef.current = formScheduledFor;
    if (
      formChanged &&
      formScheduledFor !== undefined &&
      formScheduledFor !== schedulingScheduledFor
    ) {
      setSchedulingScheduledFor(formScheduledFor);
    }
  }, [formScheduledFor, schedulingScheduledFor, setSchedulingScheduledFor]);

  /**
   * Parse scheduled time from datetime-local string with fallbacks
   */
  async function parseScheduledTime(
    scheduledForStr: string,
    userTimezone: string
  ): Promise<number> {
    try {
      const zonedDateTime = parseDateTimeLocal(scheduledForStr, userTimezone);
      const utcZoned = zonedDateTime.withTimeZone("UTC");
      return toUnixTimestamp(utcZoned) * 1000;
    } catch {
      try {
        const { fromISOString, toUnixTimestamp } =
          await import("~/lib/temporal");
        const zoned = fromISOString(scheduledForStr + "Z", "UTC");
        return toUnixTimestamp(zoned) * 1000;
      } catch {
        try {
          const { fromDate, toUnixTimestamp } = await import("~/lib/temporal");
          const dateObj = new Date(scheduledForStr + "Z");
          const zoned = fromDate(dateObj, "UTC");
          return toUnixTimestamp(zoned) * 1000;
        } catch {
          const dateObj = new Date(scheduledForStr + "Z");
          return dateObj.getTime();
        }
      }
    }
  }

  const handleSubmit = form.handleSubmit(async (data, event) => {
    const submitter = event?.nativeEvent
      ? ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement)
      : undefined;
    const submitType = submitter?.value ?? "";

    // For draft saves, we don't need to sign the event
    if (submitType === "draft-text") {
      const formData = new FormData();
      formData.set("_action", submitType);
      formData.set("content", data.content);
      formData.set("queueType", data.queueType);
      if (data.isRecyclable) {
        formData.set("isRecyclable", "on");
      }
      if (data.useHashtagPresets && data.hashTagPresetId) {
        formData.set("hashTagPresetId", data.hashTagPresetId);
        formData.set("useHashtagPresets", "on");
      }
      fetcher.submit(formData, { method: "post" });
      return;
    }

    if (!data.content.trim()) {
      form.setError("content", {
        type: "manual",
        message: "Post content cannot be empty",
      });
      return;
    }

    try {
      setSigningError(null);
      const userTimezone = user?.timezone ?? "UTC";
      const scheduledTime =
        submitType === "post-text"
          ? nowMillis()
          : await parseScheduledTime(data.scheduledFor ?? "", userTimezone);
      const scheduledForUnix = Math.floor(scheduledTime / 1000);

      const effectiveHashtags = await getEffectiveHashtagsForSubmit(
        data.useHashtagPresets,
        selectedHashtags,
        selectedQueue,
        queueTypes,
        user?.id,
        tags
      );
      const tagArray = effectiveHashtags
        .split(" ")
        .filter((tag) => tag.length > 0)
        .map((tag) => ["t", tag.replace("#", "")]);
      const contentToSign = user?.showHashTagsinPosts
        ? `${data.content}\n${effectiveHashtags}`
        : data.content;

      setIsSigning(true);
      const { nostrEvent, signedEvent } = await nostrAdapter.signEvent({
        content: contentToSign,
        created_at: scheduledForUnix,
        kind: 1,
        tags: tagArray,
      });

      // Use plain object so server gets application/x-www-form-urlencoded and
      // preserves all fields (parseMultipartFormData can drop non-file fields).
      const payload: Record<string, string> = {
        _action: submitType,
        content: data.content,
        queueType: data.queueType,
        nostrEvent: JSON.stringify(nostrEvent),
        signedEvent: JSON.stringify(signedEvent),
        scheduledFor: scheduledForUnix.toString(),
      };
      if (data["isRecyclable"]) {
        payload["isRecyclable"] = "on";
      }
      if (data["useHashtagPresets"] && data["hashTagPresetId"]) {
        payload["hashTagPresetId"] = data["hashTagPresetId"];
        payload["useHashtagPresets"] = "on";
      }

      // Repost/quote schedules: use same base time for both "post now" and "schedule"
      // (post-text: base = now; schedule-text: base = user-selected time)
      if (alsoScheduleRepost && repostDelayList.length > 0) {
        const repostSchedules = await buildRepostSchedules(
          scheduledForUnix,
          repostDelayList.map((item) => ({
            value: item.value,
            unit: item.unit,
          })),
          signedEvent,
          setSigningError
        );
        if (repostSchedules == null) return;
        if (repostSchedules.length > 0) {
          payload["repostSchedules"] = JSON.stringify(repostSchedules);
        }
      }
      if (alsoScheduleQuote && quoteEntries.length > 0) {
        const quoteSchedules = await buildQuoteSchedules(
          scheduledForUnix,
          quoteEntries,
          signedEvent,
          tagArray,
          setSigningError
        );
        if (quoteSchedules == null) return;
        if (quoteSchedules.length > 0) {
          payload["quoteSchedules"] = JSON.stringify(quoteSchedules);
        }
      }

      fetcher.submit(payload, { method: "post" });
    } catch (error) {
      const { handleAsyncError } = await import("~/lib/error-handler.client");
      handleAsyncError(
        error,
        {
          component: "TextPost",
          action: "handleSubmit",
        },
        false
      ); // Don't show toast, let component handle it
      setSigningError(
        error instanceof Error
          ? error.message
          : "Failed to sign post. Please try again."
      );
    } finally {
      setIsSigning(false);
    }
  });

  const handleHashtagPresetSelect = (
    presetId: string | null,
    hashtags: string
  ) => {
    form.setValue("hashTagPresetId", presetId ?? undefined);
    setSelectedHashtags(hashtags);
    if (onHashtagPresetChange) {
      onHashtagPresetChange(presetId, hashtags);
    }
  };

  const handleAssetsSelected = (selectedAssets: Asset[]) => {
    // Separate text assets and image assets
    const textAssets: string[] = [];
    const imageAssets: string[] = [];

    selectedAssets.forEach((asset) => {
      if (asset.assetType === "TEXT") {
        const textContent = asset.content ?? asset.title ?? "";
        if (textContent) {
          textAssets.push(textContent);
        }
      } else if (asset.assetType === "IMAGE") {
        const imageUrl = asset.fileUrl ?? "";
        if (imageUrl) {
          imageAssets.push(imageUrl);
        }
      }
    });

    // Combine text assets first, then image URLs
    const allAssets = [...textAssets, ...imageAssets];
    const newContent = allAssets.join("\n");

    // Always append assets below existing content
    const updatedContent = content ? content + "\n" + newContent : newContent;
    form.setValue("content", updatedContent);
  };

  return (
    <fetcher.Form
      method="post"
      className="w-full"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit(e);
      }}
    >
      {isSigning ? (
        <div className="dark:bg-card/30 dark:text-foreground text-muted-foreground mb-3 rounded-md border bg-white/50 p-3 text-sm">
          Waiting for signer approval… If you’re using a remote signer, open it
          to approve the request.
        </div>
      ) : null}
      {signingError ? (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>{signingError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="relative">
        <Textarea
          id="content"
          {...form.register("content")}
          className={form.formState.errors.content ? "border-destructive" : ""}
          placeholder="Start writing your post here..."
          rows={6}
          disabled={fetcher.state !== "idle" || isSigning}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAssetBrowser(true)}
          disabled={fetcher.state !== "idle" || isSigning}
          className="absolute top-2 right-2"
        >
          <FolderOpen
            className={`mr-1 ${INLINE_ICON_SIZE_CLASS}`}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          Assets
        </Button>
      </div>
      {form.formState.errors.content ? (
        <div className="text-destructive mt-1 text-sm">
          {form.formState.errors.content.message}
        </div>
      ) : null}
      <div className="text-muted-foreground mt-2 text-right text-sm">
        {content.length}/5000
      </div>
      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-4">
          <QueueSelector
            queueTypes={queueTypes}
            selectedQueue={selectedQueue}
            onQueueChange={setSelectedQueue}
            disabled={fetcher.state !== "idle" || isSigning}
            className="mb-2"
          />

          {/* Hashtag Preset Toggle */}
          <HashtagPresetToggle
            presets={hashTagPresets}
            selectedPresetId={selectedHashtagPresetId}
            onSelect={handleHashtagPresetSelect}
            disabled={fetcher.state !== "idle"}
            useHashtagPresets={useHashtagPresets}
            onUseHashtagPresetsChange={(enabled) => {
              form.setValue("useHashtagPresets", enabled);
            }}
            showQueuePreset={selectedQueue !== "unassigned"}
            queueType={
              queueTypes.find(
                (q) => (typeof q === "string" ? q : q.name) === selectedQueue
              ) as QueueType | undefined
            }
          />
          <div className="flex items-center gap-2">
            <Controller
              name="isRecyclable"
              control={form.control}
              render={({ field }) => (
                <Checkbox
                  id="isRecyclable"
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                  disabled={fetcher.state !== "idle" || isSigning}
                />
              )}
            />
            <Label
              htmlFor="isRecyclable"
              className="text-muted-foreground dark:text-foreground text-sm"
            >
              Make this post recyclable
            </Label>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="scheduledFor">Schedule for later</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                type="datetime-local"
                id="scheduledFor"
                {...form.register("scheduledFor")}
                disabled={fetcher.state !== "idle" || isSigning}
              />
              <Button
                type="submit"
                value="schedule-text"
                name="_action"
                disabled={fetcher.state !== "idle" || isSigning}
                className="text-white"
              >
                <Clock
                  className="mr-1.5 h-5 w-5"
                  strokeWidth={INLINE_ICON_STROKE}
                  aria-hidden
                />
                {isSigning
                  ? "Waiting for signer…"
                  : fetcher.state !== "idle"
                    ? "Scheduling..."
                    : "Sign and Schedule"}
              </Button>
            </div>
            <SchedulingSection
              scheduledFor={formScheduledFor ?? schedulingScheduledFor}
              onScheduledForChange={(value) => {
                form.setValue("scheduledFor", value);
                setSchedulingScheduledFor(value);
              }}
              scheduleIntervals={scheduleIntervals}
              queueTypes={queueTypes}
              selectedQueue={selectedQueue}
              onScheduleIntervalClick={(intervalHours) => {
                handleScheduleIntervalClick(intervalHours);
              }}
              onCalculateNextSlot={() => {
                void calculateQueueScheduleTime(selectedQueue);
              }}
              disabled={fetcher.state !== "idle" || isSigning}
              showTimeInput={false}
            />
            <div className="border-border mt-4 space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="alsoScheduleRepost"
                  checked={alsoScheduleRepost}
                  onCheckedChange={(c) => setAlsoScheduleRepost(c === true)}
                  disabled={fetcher.state !== "idle" || isSigning}
                />
                <Label
                  htmlFor="alsoScheduleRepost"
                  className="text-muted-foreground dark:text-foreground text-sm"
                >
                  Also schedule a repost
                </Label>
              </div>
              {alsoScheduleRepost ? (
                <div className="ml-6 space-y-2">
                  <Label className="text-muted-foreground text-xs">
                    When after main post (one per repost)
                  </Label>
                  {repostDelayList.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <Input
                        type="number"
                        min={1}
                        value={item.value}
                        onChange={(e) => {
                          const v = Math.max(
                            1,
                            parseInt(e.target.value, 10) || 1
                          );
                          setRepostDelayList((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx]!, value: v };
                            return next;
                          });
                        }}
                        disabled={fetcher.state !== "idle" || isSigning}
                        className="w-20"
                        aria-label="Delay value"
                      />
                      <select
                        value={item.unit}
                        onChange={(e) => {
                          const unit = e.target.value as DelayAfterMain["unit"];
                          setRepostDelayList((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx]!, unit };
                            return next;
                          });
                        }}
                        disabled={fetcher.state !== "idle" || isSigning}
                        className="border-border bg-background text-foreground h-9 w-24 rounded-md border px-2 text-sm"
                        aria-label="Hours or minutes"
                      >
                        <option value="hours">hours</option>
                        <option value="minutes">minutes</option>
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setRepostDelayList((prev) =>
                            prev.length > 1
                              ? prev.filter((_, i) => i !== idx)
                              : prev
                          )
                        }
                        disabled={
                          fetcher.state !== "idle" ||
                          isSigning ||
                          repostDelayList.length <= 1
                        }
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setRepostDelayList((prev) => [
                        ...prev,
                        { id: crypto.randomUUID(), value: 24, unit: "hours" },
                      ])
                    }
                    disabled={fetcher.state !== "idle" || isSigning}
                  >
                    Add another repost
                  </Button>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="alsoScheduleQuote"
                  checked={alsoScheduleQuote}
                  onCheckedChange={(c) => setAlsoScheduleQuote(c === true)}
                  disabled={fetcher.state !== "idle" || isSigning}
                />
                <Label
                  htmlFor="alsoScheduleQuote"
                  className="text-muted-foreground dark:text-foreground text-sm"
                >
                  Also schedule a quote
                </Label>
              </div>
              {alsoScheduleQuote ? (
                <div className="ml-6 space-y-3">
                  <Label className="text-muted-foreground text-xs">
                    Quote times and captions (one per quote)
                  </Label>
                  {quoteEntries.map((entry, idx) => (
                    <div
                      key={entry.id}
                      className="border-border space-y-2 rounded border p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label className="text-muted-foreground text-xs">
                          When after main
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setQuoteEntries((prev) =>
                              prev.length > 1
                                ? prev.filter((_, i) => i !== idx)
                                : prev
                            )
                          }
                          disabled={
                            fetcher.state !== "idle" ||
                            isSigning ||
                            quoteEntries.length <= 1
                          }
                          className="text-muted-foreground hover:text-foreground"
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={entry.value}
                          onChange={(e) => {
                            const v = Math.max(
                              1,
                              parseInt(e.target.value, 10) || 1
                            );
                            setQuoteEntries((prev) => {
                              const next = [...prev];
                              const current = next[idx]!;
                              next[idx] = { ...current, value: v };
                              return next;
                            });
                          }}
                          disabled={fetcher.state !== "idle" || isSigning}
                          className="w-20"
                          aria-label="Delay value"
                        />
                        <select
                          value={entry.unit}
                          onChange={(e) => {
                            const unit = e.target
                              .value as DelayAfterMain["unit"];
                            setQuoteEntries((prev) => {
                              const next = [...prev];
                              const current = next[idx]!;
                              next[idx] = { ...current, unit };
                              return next;
                            });
                          }}
                          disabled={fetcher.state !== "idle" || isSigning}
                          className="border-border bg-background text-foreground h-9 w-24 rounded-md border px-2 text-sm"
                          aria-label="Hours or minutes"
                        >
                          <option value="hours">hours</option>
                          <option value="minutes">minutes</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">
                          Caption (optional)
                        </Label>
                        <Textarea
                          value={entry.caption}
                          onChange={(e) =>
                            setQuoteEntries((prev) => {
                              const next = [...prev];
                              const current = next[idx]!;
                              next[idx] = {
                                ...current,
                                caption: e.target.value,
                              };
                              return next;
                            })
                          }
                          placeholder="Add your comment..."
                          rows={2}
                          disabled={fetcher.state !== "idle" || isSigning}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setQuoteEntries((prev) => [
                        ...prev,
                        {
                          id: crypto.randomUUID(),
                          value: 24,
                          unit: "hours",
                          caption: "",
                        },
                      ])
                    }
                    disabled={fetcher.state !== "idle" || isSigning}
                  >
                    Add another quote
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            value="draft-text"
            name="_action"
            variant="outline"
            disabled={fetcher.state !== "idle" || isSigning}
          >
            <Pencil
              className="mr-1.5 h-5 w-5"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
            {fetcher.state !== "idle" ? "Saving..." : "Save as Draft"}
          </Button>
          <Button
            type="submit"
            value="post-text"
            name="_action"
            className="bg-success hover:bg-success/90 text-white"
            disabled={fetcher.state !== "idle" || isSigning}
          >
            <Send
              className="mr-1.5 h-5 w-5"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
            {isSigning
              ? "Waiting for signer…"
              : fetcher.state !== "idle"
                ? "Posting..."
                : "Post Now"}
          </Button>
        </div>
      </div>

      {showAssetBrowser ? (
        <AssetBrowser
          assets={assets}
          onAssetsSelected={handleAssetsSelected}
          onClose={() => setShowAssetBrowser(false)}
        />
      ) : null}
    </fetcher.Form>
  );
}
