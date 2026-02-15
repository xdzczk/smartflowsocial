/**
 * Unified composer: one surface for text + optional attachments.
 * Replaces Text/Media tabs with a single note editor and attachments strip.
 */

import { useFetcher, Link, useNavigate } from "@remix-run/react";
import { ChevronDown, Clock, FolderOpen, Pencil, Send } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Controller } from "react-hook-form";

import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";
import type { SignedEvent } from "~/features/nostr/types";
import { uploadMultipleFiles } from "~/features/upload/upload.client";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { useOptionalUser } from "~/lib/remix-utils";
import { nowMillis, parseDateTimeLocal, toUnixTimestamp } from "~/lib/temporal";
import { textPostClientSchema } from "~/lib/validation";
import { useZodForm } from "~/lib/validation/utils.client-safe";

import {
  useComposerLocalDraft,
  type ComposerLocalSnapshot,
} from "../hooks/useComposerLocalDraft";
import { useComposerState } from "../hooks/useComposerState";
import { usePostScheduling } from "../hooks/usePostScheduling";
import type { QueueType, ComposerAttachment } from "../types";
import {
  delayAfterMainToSeconds,
  isValidDelayAfterMain,
  type DelayAfterMain,
} from "../utils/delay-after-main";
import {
  appendToken,
  removeToken,
  resolveContentForSigning,
} from "../utils/inline-tokens.client";
import {
  buildKind6RepostEvent,
  buildQuoteEvent,
  getThreadReplyTags,
} from "../utils/repost-quote-events.client";

import { AlsoScheduleBlock } from "./AlsoScheduleBlock";
import { AttachmentsStrip } from "./AttachmentsStrip";
import { ConfidencePanel } from "./ConfidencePanel";
import { DraftPickerModal } from "./DraftPickerModal";
import type { ComposerStatus } from "./NewPostHeader";
import { QueueSelector } from "./QueueSelector";
import { SchedulingSection } from "./SchedulingSection";
import { TagsChipRow } from "./TagsChipRow";

const ACTION_POST_TEXT = "post-text";
const ACTION_SCHEDULE_TEXT = "schedule-text";

const ACCEPTED_MEDIA_TYPES = /^image\/|^video\//;
function filterMediaFiles(files: File[]): File[] {
  return files.filter((f) => ACCEPTED_MEDIA_TYPES.test(f.type));
}

async function getEffectiveHashtagsForSubmit(
  useHashtagPresets: boolean,
  selectedHashtags: string,
  selectedQueue: string,
  queueTypes: Array<string | QueueType>,
  userId: string | undefined,
  defaultTags: string[]
): Promise<string> {
  if (useHashtagPresets) return selectedHashtags;
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
      component: "UnifiedComposer",
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

export interface UnifiedComposerProps {
  queueTypes?: Array<string | QueueType>;
  hashTagPresets?: Array<{ id: string; name: string; tags: string }>;
  onQueueTypeChange?: (queueType: string) => void;
  selectedHashTagPresetId?: string | null | undefined;
  onHashtagPresetChange?: (presetId: string | null, hashtags: string) => void;
  /** Optional relay override (from composer relay selector). When non-empty, sent with submit. */
  relayOverride?: string[];
  /** Relay count to show in confidence panel (default list or override). */
  relayCount?: number;
  /** Called when composer status changes (for header status pill). */
  onComposerStatusChange?: (status: ComposerStatus) => void;
  /** When opening an existing draft from URL, pass its id so "Save as Draft" updates this draft. */
  initialDraftId?: string | null;
  /** Draft data to prefill the composer (when opening from drafts). Requires initialDraftId. */
  /** When "template", only "Save as template" and Cancel are shown; no Schedule/Publish/Save as draft. */
  mode?: "default" | "template";
  /** When set with mode="template", submit uses updateTemplatePost instead of createTemplate. */
  editTemplateContext?: { templateId: string; postId: string } | null;
  /** When editing a template, pass the current template name to prefill the composer field. */
  initialTemplateName?: string | null;
  initialDraft?: {
    content: string;
    caption: string;
    fileUrl: string[];
    queueType: string;
    queueTypeId: string | null;
    tags: string;
    draftMeta: {
      attachmentMeta?: Array<{ localId: string; url: string; alt?: string }>;
    } | null;
    hashTagPresetId: string | null;
  } | null;
}

/* eslint-disable-next-line sonarjs/cognitive-complexity -- composer has many branches by design */
export function UnifiedComposer({
  queueTypes = [],
  hashTagPresets = [],
  onQueueTypeChange,
  selectedHashTagPresetId,
  onHashtagPresetChange,
  relayOverride,
  relayCount: relayCountProp = 0,
  onComposerStatusChange,
  initialDraftId = null,
  initialDraft = null,
  mode = "default",
  editTemplateContext = null,
  initialTemplateName = null,
}: UnifiedComposerProps) {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [draftPickerOpen, setDraftPickerOpen] = React.useState(false);
  const user = useOptionalUser();
  const [isSigning, setIsSigning] = React.useState(false);
  const [signingError, setSigningError] = React.useState<string | null>(null);
  const [publishSubmitInFlight, setPublishSubmitInFlight] =
    React.useState(false);
  const [lastPublishFailed, setLastPublishFailed] = React.useState(false);
  const [signerLabel, setSignerLabel] = useState<string | null>(null);
  const [signerReady, setSignerReady] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      const { getActiveSignerConfig } =
        await import("~/lib/nostr-signer-manager.client");
      const config = getActiveSignerConfig();
      setSignerReady(!!config);
      setSignerLabel(
        config?.type === "nip46"
          ? "NIP-46 (Bunker)"
          : config?.type === "nip07"
            ? "NIP-07 extension"
            : null
      );
    })();
  }, []);
  const tags: string[] = [];
  const [selectedHashtags, setSelectedHashtags] = React.useState(
    () => initialDraft?.tags ?? ""
  );
  const [templateName, setTemplateName] = React.useState(
    () => initialTemplateName ?? ""
  );
  const isTemplateMode = mode === "template";
  const initialAttachmentsFromDraft = React.useMemo(() => {
    if (!initialDraft?.draftMeta?.attachmentMeta?.length) return [];
    return initialDraft.draftMeta.attachmentMeta.map((a) => ({
      localId: a.localId,
      url: a.url,
      status: "done" as const,
      alt: a.alt,
    }));
  }, [initialDraft?.draftMeta?.attachmentMeta]);

  const [attachments, setAttachments] = React.useState<ComposerAttachment[]>(
    () => initialAttachmentsFromDraft
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const [postOptionsOpen, setPostOptionsOpen] = React.useState(false);
  const [isThreadMode, setIsThreadMode] = React.useState(false);
  const [threadSegments, setThreadSegments] = React.useState<
    Array<{ id: string; content: string; attachments: ComposerAttachment[] }>
  >([{ id: crypto.randomUUID(), content: "", attachments: [] }]);
  const [threadDelayMinutes, setThreadDelayMinutes] = React.useState(1);

  const form = useZodForm(textPostClientSchema, {
    defaultValues: {
      content: initialDraft?.content ?? "",
      scheduledFor: "",
      queueType: initialDraft?.queueType ?? "unassigned",
      isRecyclable: false,
      useHashtagPresets: !!initialDraft?.hashTagPresetId,
      hashTagPresetId:
        initialDraft?.hashTagPresetId ?? selectedHashTagPresetId ?? undefined,
    },
  });

  const content = form.watch("content");
  const formSelectedHashtagPresetId = form.watch("hashTagPresetId");

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
    initialQueue: initialDraft?.queueType ?? "unassigned",
    onQueueTypeChange,
  });

  const {
    restored: localRestored,
    saveSnapshot: saveLocalSnapshot,
    flushSnapshot: flushLocalSnapshot,
    clearSnapshot: clearLocalSnapshot,
  } = useComposerLocalDraft("composer-newpost-draft", !!initialDraftId);

  const lastLocalSnapshotRef = useRef<Omit<
    ComposerLocalSnapshot,
    "savedAt"
  > | null>(null);

  const appliedLocalRestoredRef = useRef(false);
  React.useEffect(() => {
    if (!localRestored || initialDraftId || appliedLocalRestoredRef.current)
      return;
    appliedLocalRestoredRef.current = true;
    form.reset({
      content: localRestored.content,
      scheduledFor: localRestored.scheduledFor,
      queueType: localRestored.queueType,
      isRecyclable: false,
      useHashtagPresets: !!localRestored.hashTagPresetId,
      hashTagPresetId: localRestored.hashTagPresetId ?? undefined,
    });
    setSelectedHashtags(localRestored.tags);
    setAttachments(
      localRestored.attachmentMeta.map((a) => ({
        localId: a.localId,
        url: a.url,
        status: "done" as const,
        alt: a.alt,
      }))
    );
    setSelectedQueue(localRestored.queueType);
  }, [localRestored, initialDraftId, form, setSelectedQueue]);

  React.useEffect(() => {
    form.setValue("queueType", selectedQueue);
  }, [selectedQueue, form]);

  React.useEffect(() => {
    if (schedulingScheduledFor) {
      form.setValue("scheduledFor", schedulingScheduledFor);
    }
  }, [schedulingScheduledFor, form]);

  const formScheduledFor = form.watch("scheduledFor");
  const selectedQueueType = queueTypes.find(
    (q) => (typeof q === "string" ? q : q.name) === selectedQueue
  );
  const queueTypeId =
    typeof selectedQueueType === "object" ? selectedQueueType.id : null;

  // Persist to localStorage when not editing a server draft
  React.useEffect(() => {
    if (initialDraftId) return;
    const snapshot: Omit<ComposerLocalSnapshot, "savedAt"> = {
      content: content ?? "", // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- form state can be undefined
      queueType: selectedQueue,
      queueTypeId,

      scheduledFor: formScheduledFor ?? "",
      tags: selectedHashtags,
      hashTagPresetId: formSelectedHashtagPresetId ?? null,
      attachmentMeta: attachments
        .filter((a): a is typeof a & { url: string } => Boolean(a.url))
        .map((a) => ({ localId: a.localId, url: a.url, alt: a.alt })),
    };
    lastLocalSnapshotRef.current = snapshot;
    saveLocalSnapshot(snapshot);
  }, [
    initialDraftId,
    content,
    selectedQueue,
    queueTypeId,
    formScheduledFor,
    selectedHashtags,
    formSelectedHashtagPresetId,
    attachments,
    saveLocalSnapshot,
  ]);

  // Flush localStorage on unmount and when page is hidden so content is not lost when navigating away
  React.useEffect(() => {
    if (initialDraftId) return;
    const flush = () => {
      const snap = lastLocalSnapshotRef.current;
      if (snap) flushLocalSnapshot(snap);
    };
    const onHide = () => flush();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [initialDraftId, flushLocalSnapshot]);

  const hasContent = isThreadMode
    ? threadSegments.some(
        (s) => s.content.trim() !== "" || s.attachments.length > 0
      )
    : (content?.trim() ?? "") !== "" || attachments.length > 0; // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- content from form.watch can be undefined
  const canSubmit = isThreadMode
    ? threadSegments.every(
        (s) =>
          !s.attachments.some(
            (a) => a.status === "uploading" || a.status === "failed"
          )
      )
    : !attachments.some(
        (a) => a.status === "uploading" || a.status === "failed"
      );
  const scheduleVal = formScheduledFor ?? schedulingScheduledFor;
  const hasScheduleTime =
    typeof scheduleVal === "string" ? scheduleVal.trim() !== "" : false;
  const composerStatus = useComposerState({
    hasContent,
    canSubmit,
    hasScheduleTime,
    isSigning,
    isSubmitting: fetcher.state !== "idle",
    publishSubmitInFlight,
    lastPublishFailed,
  });

  React.useEffect(() => {
    onComposerStatusChange?.(composerStatus);
  }, [composerStatus, onComposerStatusChange]);

  React.useEffect(() => {
    if (fetcher.state === "idle") {
      const data = fetcher.data as { error?: string } | undefined;
      if (publishSubmitInFlight && data?.error) {
        setLastPublishFailed(true);
        setSigningError(data.error);
      }
      setPublishSubmitInFlight(false);
    }
  }, [fetcher.state, fetcher.data, publishSubmitInFlight]);

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
        const { fromISOString, toUnixTimestamp: toTs } =
          await import("~/lib/temporal");
        const zoned = fromISOString(scheduledForStr + "Z", "UTC");
        return toTs(zoned) * 1000;
      } catch {
        const dateObj = new Date(scheduledForStr + "Z");
        return dateObj.getTime();
      }
    }
  }

  /* eslint-disable-next-line sonarjs/cognitive-complexity -- submit handler branches by action type */
  const handleSubmit = form.handleSubmit(async (data, event) => {
    const submitter = event?.nativeEvent
      ? ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement)
      : undefined;
    const submitType = submitter?.value ?? "";

    if (isTemplateMode && submitType === "save-as-template") {
      if (!templateName.trim()) {
        return;
      }
      clearLocalSnapshot();
      const formData = new FormData();
      if (editTemplateContext?.templateId && editTemplateContext.postId) {
        formData.set("_action", "updateTemplatePost");
        formData.set("templateId", editTemplateContext.templateId);
        formData.set("postId", editTemplateContext.postId);
        formData.set("name", templateName.trim());
      } else {
        formData.set("_action", "createTemplate");
        formData.set("templateName", templateName.trim());
      }
      formData.set("content", data.content);
      formData.set("queueType", "unassigned");
      formData.set("tags", selectedHashtags);
      if (data.hashTagPresetId)
        formData.set("hashTagPresetId", data.hashTagPresetId);
      formData.set(
        "useHashtagPresets",
        String(Boolean(data.useHashtagPresets))
      );
      const draftAttachmentMeta = attachments
        .filter((a) => a.url)
        .map((a) => ({ localId: a.localId, url: a.url, alt: a.alt }));
      if (draftAttachmentMeta.length > 0) {
        formData.set("attachmentMeta", JSON.stringify(draftAttachmentMeta));
      }
      fetcher.submit(formData, { method: "post" });
      return;
    }

    if (submitType === "draft-text") {
      clearLocalSnapshot();
      const formData = new FormData();
      formData.set("_action", "save-draft");
      formData.set("content", data.content);
      formData.set("queueType", data.queueType);
      if (queueTypeId) formData.set("queueTypeId", queueTypeId);
      if (data.scheduledFor) formData.set("scheduledFor", data.scheduledFor);
      formData.set("tags", selectedHashtags);
      if (data.hashTagPresetId)
        formData.set("hashTagPresetId", data.hashTagPresetId);
      if (initialDraftId) formData.set("draftId", initialDraftId);
      if (relayOverride && relayOverride.length > 0) {
        formData.set("relays", JSON.stringify(relayOverride));
      }
      const draftAttachmentMeta = attachments
        .filter((a) => a.url)
        .map((a) => ({ localId: a.localId, url: a.url, alt: a.alt }));
      if (draftAttachmentMeta.length > 0) {
        formData.set("attachmentMeta", JSON.stringify(draftAttachmentMeta));
      }
      fetcher.submit(formData, { method: "post" });
      return;
    }

    if (
      isThreadMode &&
      (submitType === ACTION_POST_TEXT || submitType === ACTION_SCHEDULE_TEXT)
    ) {
      try {
        setSigningError(null);
        const hasUploading = threadSegments.some((s) =>
          s.attachments.some(
            (a) => a.status === "uploading" || a.status === "failed"
          )
        );
        if (hasUploading) {
          setSigningError(
            "Wait for uploads or remove failed attachments in each segment."
          );
          return;
        }
        const userTimezone = user?.timezone ?? "UTC";
        const baseTime =
          submitType === ACTION_POST_TEXT
            ? Math.floor(Date.now() / 1000)
            : Math.floor(
                (await parseScheduledTime(
                  data.scheduledFor ?? "",
                  userTimezone
                )) / 1000
              );
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

        setIsSigning(true);
        const signedEvents: SignedEvent[] = [];
        let rootEventId: string | null = null;
        let previousEventId: string | null = null;
        for (let i = 0; i < threadSegments.length; i++) {
          const seg = threadSegments[i];
          if (!seg) continue;
          const withUrl = seg.attachments.filter((a) => a.url);
          const contentToSign = resolveContentForSigning(seg.content, withUrl);
          const contentWithTags = user?.showHashTagsinPosts
            ? `${contentToSign}\n${effectiveHashtags}`
            : contentToSign;
          const created_at = baseTime + i * threadDelayMinutes * 60;
          const tags =
            i === 0
              ? tagArray
              : [
                  ...getThreadReplyTags(previousEventId!, rootEventId!),
                  ...tagArray,
                ];
          const { signedEvent } = await nostrAdapter.signEvent({
            content: contentWithTags,
            created_at,
            kind: 1,
            tags,
          });
          signedEvents.push(signedEvent);
          if (i === 0) rootEventId = signedEvent.id;
          previousEventId = signedEvent.id;
        }
        setIsSigning(false);

        const threadPayload: FormData = new FormData();
        threadPayload.set(
          "_action",
          submitType === ACTION_POST_TEXT ? "post-thread" : "schedule-thread"
        );
        threadPayload.set(
          "threadSegments",
          JSON.stringify(
            threadSegments.map((s) => ({
              content: s.content,
              attachmentMeta: s.attachments
                .filter((a) => a.url)
                .map((a) => ({ localId: a.localId, url: a.url, alt: a.alt })),
            }))
          )
        );
        threadPayload.set("threadSignedEvents", JSON.stringify(signedEvents));
        threadPayload.set(
          "threadDelaySeconds",
          String(threadDelayMinutes * 60)
        );
        threadPayload.set("queueType", data.queueType);
        if (queueTypeId) threadPayload.set("queueTypeId", queueTypeId);
        if (data.hashTagPresetId)
          threadPayload.set("hashTagPresetId", data.hashTagPresetId);
        if (submitType === ACTION_SCHEDULE_TEXT && data.scheduledFor) {
          const unix = Math.floor(
            (await parseScheduledTime(
              data.scheduledFor,
              user?.timezone ?? "UTC"
            )) / 1000
          );
          if (unix < Math.floor(Date.now() / 1000)) {
            setSigningError("Schedule time must be in the future.");
            return;
          }
          threadPayload.set("scheduledFor", String(unix));
        }
        if (relayOverride && relayOverride.length > 0)
          threadPayload.set("relays", JSON.stringify(relayOverride));

        setLastPublishFailed(false);
        setPublishSubmitInFlight(true);
        fetcher.submit(threadPayload, { method: "post" });
      } catch (err) {
        setIsSigning(false);
        const { handleAsyncError } = await import("~/lib/error-handler.client");
        handleAsyncError(
          err,
          { component: "UnifiedComposer", action: "handleSubmitThread" },
          false
        );
        setSigningError(
          err instanceof Error ? err.message : "Failed to sign thread."
        );
      }
      return;
    }

    try {
      setSigningError(null);
      if (!data.content.trim()) {
        form.setError("content", {
          type: "manual",
          message: "Post content cannot be empty",
        });
        return;
      }
      if (attachments.some((a) => a.status === "uploading")) {
        setSigningError("Please wait for uploads to finish.");
        return;
      }
      if (attachments.some((a) => a.status === "failed")) {
        setSigningError(
          "Remove or retry failed attachments before publishing."
        );
        return;
      }
      const userTimezone = user?.timezone ?? "UTC";
      const scheduledTime =
        submitType === ACTION_POST_TEXT
          ? nowMillis()
          : await parseScheduledTime(data.scheduledFor ?? "", userTimezone);
      const scheduledForUnix = Math.floor(scheduledTime / 1000);
      if (
        submitType === ACTION_SCHEDULE_TEXT &&
        scheduledForUnix * 1000 < Date.now()
      ) {
        setSigningError("Schedule time must be in the future.");
        return;
      }

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

      const attachmentsWithUrl = attachments.filter((a) => a.url);
      const contentResolvedForSign = resolveContentForSigning(
        data.content,
        attachmentsWithUrl
      );
      const contentToSign = user?.showHashTagsinPosts
        ? `${contentResolvedForSign}\n${effectiveHashtags}`
        : contentResolvedForSign;

      setIsSigning(true);
      const { nostrEvent, signedEvent } = await nostrAdapter.signEvent({
        content: contentToSign,
        created_at: scheduledForUnix,
        kind: 1,
        tags: tagArray,
      });

      const payload: Record<string, string> = {
        _action: submitType,
        content: data.content,
        queueType: data.queueType,
        nostrEvent: JSON.stringify(nostrEvent),
        signedEvent: JSON.stringify(signedEvent),
        scheduledFor: scheduledForUnix.toString(),
      };
      if (data["isRecyclable"]) payload["isRecyclable"] = "on";
      if (data["useHashtagPresets"] && data["hashTagPresetId"]) {
        payload["hashTagPresetId"] = data["hashTagPresetId"];
        payload["useHashtagPresets"] = "on";
      }
      if (relayOverride && relayOverride.length > 0) {
        payload["relays"] = JSON.stringify(relayOverride);
      }
      const attachmentMeta = attachments
        .filter((a) => a.url)
        .map((a) => ({ localId: a.localId, url: a.url, alt: a.alt }));
      if (attachmentMeta.length > 0) {
        payload["attachmentMeta"] = JSON.stringify(attachmentMeta);
      }

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

      setLastPublishFailed(false);
      setPublishSubmitInFlight(true);
      fetcher.submit(payload, { method: "post" });
    } catch (error) {
      const { handleAsyncError } = await import("~/lib/error-handler.client");
      handleAsyncError(
        error,
        {
          component: "UnifiedComposer",
          action: "handleSubmit",
        },
        false
      );
      setSigningError(
        error instanceof Error
          ? error.message
          : "Failed to sign post. Please try again."
      );
    } finally {
      setIsSigning(false);
    }
  });

  const _handleHashtagPresetSelect = (
    presetId: string | null,
    hashtags: string
  ) => {
    form.setValue("hashTagPresetId", presetId ?? undefined);
    setSelectedHashtags(hashtags);
    onHashtagPresetChange?.(presetId, hashtags);
  };

  const processNewFilesForSingleNote = React.useCallback(
    (files: File[]) => {
      const accepted = filterMediaFiles(files);
      if (accepted.length === 0) return;
      const newAttachments: ComposerAttachment[] = accepted.map((file) => ({
        localId: crypto.randomUUID(),
        status: "uploading",
        file,
        mime: file.type,
      }));
      let newContent = content;
      for (const a of newAttachments) {
        newContent = appendToken(newContent, a.localId);
      }
      form.setValue("content", newContent);
      setAttachments((prev) => [...prev, ...newAttachments]);
      void (async () => {
        try {
          const results = await uploadMultipleFiles(accepted);
          setAttachments((prev) =>
            prev.map((a) => {
              const idx = newAttachments.findIndex(
                (n) => n.localId === a.localId
              );
              if (idx < 0) return a;
              const r = results[idx];
              if (r?.success && r.file?.url) {
                return { ...a, status: "done" as const, url: r.file.url };
              }
              if (r && !r.success) {
                return { ...a, status: "failed" as const };
              }
              return a;
            })
          );
        } catch {
          setAttachments((prev) =>
            prev.map((a) => {
              const idx = newAttachments.findIndex(
                (n) => n.localId === a.localId
              );
              if (idx >= 0) return { ...a, status: "failed" as const };
              return a;
            })
          );
        }
      })();
    },
    [content, form]
  );

  const processNewFilesForSegment = React.useCallback(
    (segmentId: string, files: File[]) => {
      const accepted = filterMediaFiles(files);
      if (accepted.length === 0) return;
      const newAttachments: ComposerAttachment[] = accepted.map((file) => ({
        localId: crypto.randomUUID(),
        status: "uploading" as const,
        file,
        mime: file.type,
      }));
      setThreadSegments((prev) =>
        prev.map((p) => {
          if (p.id !== segmentId) return p;
          let newContent = p.content;
          for (const a of newAttachments) {
            newContent = appendToken(newContent, a.localId);
          }
          return {
            ...p,
            content: newContent,
            attachments: [...p.attachments, ...newAttachments],
          };
        })
      );
      void (async () => {
        try {
          const results = await uploadMultipleFiles(accepted);
          setThreadSegments((prev) =>
            prev.map((p) => {
              if (p.id !== segmentId) return p;
              return {
                ...p,
                attachments: p.attachments.map((a) => {
                  const idx = newAttachments.findIndex(
                    (n) => n.localId === a.localId
                  );
                  if (idx < 0) return a;
                  const r = results[idx];
                  if (r?.success && r.file?.url)
                    return {
                      ...a,
                      status: "done" as const,
                      url: r.file.url,
                    };
                  if (r && !r.success)
                    return { ...a, status: "failed" as const };
                  return a;
                }),
              };
            })
          );
        } catch {
          setThreadSegments((prev) =>
            prev.map((p) => {
              if (p.id !== segmentId) return p;
              return {
                ...p,
                attachments: p.attachments.map((a) => {
                  const idx = newAttachments.findIndex(
                    (n) => n.localId === a.localId
                  );
                  return idx >= 0 ? { ...a, status: "failed" as const } : a;
                }),
              };
            })
          );
        }
      })();
    },
    []
  );

  const handleAddAttachment = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (files.length === 0) return;
    processNewFilesForSingleNote(files);
  };

  const [isDraggingOver, setIsDraggingOver] = React.useState(false);
  const [draggingOverSegmentId, setDraggingOverSegmentId] = React.useState<
    string | null
  >(null);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item?.kind === "file") {
          const file = item.getAsFile();
          if (file && ACCEPTED_MEDIA_TYPES.test(file.type)) files.push(file);
        }
      }
      if (files.length === 0) return;
      e.preventDefault();
      const firstSegment = threadSegments[0];
      if (isThreadMode && firstSegment) {
        processNewFilesForSegment(firstSegment.id, files);
      } else {
        processNewFilesForSingleNote(files);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [
    isThreadMode,
    threadSegments,
    processNewFilesForSingleNote,
    processNewFilesForSegment,
  ]);

  const handleRemoveAttachment = (localId: string) => {
    form.setValue("content", removeToken(content, localId));
    setAttachments((prev) => prev.filter((a) => a.localId !== localId));
  };

  const disabled = fetcher.state !== "idle" || isSigning;
  const primarySubmitRef = useRef<HTMLButtonElement>(null);
  const draftSubmitRef = useRef<HTMLButtonElement>(null);
  const hasScheduleTimeForSubmit = !!(
    typeof (formScheduledFor ?? schedulingScheduledFor) === "string" &&
    (formScheduledFor ?? schedulingScheduledFor).trim()
  );

  const scheduleTimeLabel = (() => {
    const s = (formScheduledFor ?? schedulingScheduledFor).trim();
    if (!s) return null;
    try {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return null;
      const [, timePart] = s.split("T");
      if (!timePart) return null;
      const [h, m] = timePart.split(":");
      const timeStr = `${h ?? "00"}:${m ?? "00"}`;
      const today = new Date();
      const isToday =
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();
      return isToday ? `Today ${timeStr}` : timeStr;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (!disabled) draftSubmitRef.current?.click();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (disabled || signerReady === false) return;
        primarySubmitRef.current?.click();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, signerReady]);

  const relayCount =
    relayCountProp > 0
      ? relayCountProp
      : relayOverride && relayOverride.length > 0
        ? relayOverride.length
        : relayCountProp;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <fetcher.Form
        method="post"
        className="min-w-0 flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(e);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          aria-hidden
          onChange={onFileChange}
        />
        {isSigning ? (
          <div className="dark:bg-card/30 dark:text-foreground text-muted-foreground mb-3 rounded-md border bg-white/50 p-3 text-sm">
            Waiting for signer approval… If you’re using a remote signer, open
            it to approve the request.
          </div>
        ) : null}
        {signingError ? (
          <Alert
            variant="destructive"
            className="mb-3 flex flex-row items-center justify-between gap-2"
          >
            <AlertDescription className="flex-1">
              {signingError}
            </AlertDescription>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setSigningError(null);
                setLastPublishFailed(false);
              }}
            >
              Try again
            </Button>
          </Alert>
        ) : null}
        <div className="my-8">
          {isThreadMode ? (
            <div className="space-y-4">
              {threadSegments.map((seg, idx) => (
                <div
                  key={seg.id}
                  role="button"
                  tabIndex={-1}
                  aria-label={`Segment ${idx + 1}. Drop media here or press Enter to add files.`}
                  className={`group relative rounded-lg border p-3 ${
                    idx === 0
                      ? "border-border bg-card shadow-sm"
                      : "animate-in fade-in slide-in-from-bottom-2 border-border border-l-primary/30 bg-muted/20 dark:bg-muted/10 border-l-2 duration-200"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDraggingOverSegmentId(seg.id);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    const related = e.relatedTarget;
                    if (
                      related == null ||
                      !e.currentTarget.contains(related as Node)
                    ) {
                      setDraggingOverSegmentId(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDraggingOverSegmentId(null);
                    const files = Array.from(e.dataTransfer.files);
                    if (files.length > 0)
                      processNewFilesForSegment(seg.id, files);
                  }}
                  onKeyDown={(e) => {
                    // Only open file picker when the segment container itself is focused (e.g. Enter/Space on drop zone).
                    // Ignore keydown from textarea/input so typing space in segment content doesn't open upload.
                    const target = e.target as HTMLElement;
                    if (target.closest("textarea") || target.closest("input")) {
                      return;
                    }
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      (
                        window as unknown as { __threadSegmentId?: string }
                      ).__threadSegmentId = seg.id;
                      const input = document.getElementById(
                        "thread-segment-file-input"
                      ) as HTMLInputElement | null;
                      input?.click();
                    }
                  }}
                >
                  {draggingOverSegmentId === seg.id ? (
                    <div className="border-primary bg-primary/5 pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed">
                      <span className="text-muted-foreground text-xs">
                        Drop to add media
                      </span>
                    </div>
                  ) : null}
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
                      {idx > 0 ? (
                        <span
                          className="bg-muted flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs"
                          aria-hidden
                        >
                          {idx + 1}
                        </span>
                      ) : null}
                      Segment {idx + 1}
                    </span>
                    {threadSegments.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                        onClick={() =>
                          setThreadSegments((prev) =>
                            prev.filter((p) => p.id !== seg.id)
                          )
                        }
                        disabled={disabled}
                        aria-label={`Remove segment ${idx + 1}`}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  <Textarea
                    value={seg.content}
                    onChange={(e) =>
                      setThreadSegments((prev) =>
                        prev.map((p) =>
                          p.id === seg.id
                            ? { ...p, content: e.target.value }
                            : p
                        )
                      )
                    }
                    placeholder="Segment content…"
                    rows={3}
                    disabled={disabled}
                    className="text-foreground focus-visible:ring-primary/20 mb-2 min-h-[80px] focus-visible:ring-2"
                  />
                  <AttachmentsStrip
                    attachments={seg.attachments}
                    onRemove={(localId) =>
                      setThreadSegments((prev) =>
                        prev.map((p) =>
                          p.id === seg.id
                            ? {
                                ...p,
                                content: removeToken(p.content, localId),
                                attachments: p.attachments.filter(
                                  (a) => a.localId !== localId
                                ),
                              }
                            : p
                        )
                      )
                    }
                    onAdd={() => {
                      (
                        window as unknown as { __threadSegmentId?: string }
                      ).__threadSegmentId = seg.id;
                      const input = document.getElementById(
                        "thread-segment-file-input"
                      ) as HTMLInputElement | null;
                      input?.click();
                    }}
                    disabled={disabled}
                  />
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setThreadSegments((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        content: "",
                        attachments: [],
                      },
                    ])
                  }
                  disabled={disabled}
                >
                  Add segment
                </Button>
                <Label className="text-muted-foreground flex items-center gap-1 text-sm">
                  Delay between posts:
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={threadDelayMinutes}
                    onChange={(e) =>
                      setThreadDelayMinutes(
                        Math.max(
                          1,
                          Math.min(120, parseInt(e.target.value, 10) || 1)
                        )
                      )
                    }
                    className="h-8 w-16"
                  />
                  min
                </Label>
              </div>
            </div>
          ) : (
            <>
              <div
                role="button"
                tabIndex={-1}
                aria-label="Drop zone for images and videos. Press Enter to add files."
                className="relative"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  const related = e.relatedTarget;
                  if (
                    related == null ||
                    !e.currentTarget.contains(related as Node)
                  ) {
                    setIsDraggingOver(false);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  const files = Array.from(e.dataTransfer.files);
                  if (files.length > 0) processNewFilesForSingleNote(files);
                }}
                onKeyDown={(e) => {
                  // Only open file picker when the drop zone itself is focused, not when typing in the textarea
                  const target = e.target as HTMLElement;
                  if (target.closest("textarea") || target.closest("input")) {
                    return;
                  }
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleAddAttachment();
                  }
                }}
              >
                {isDraggingOver ? (
                  <div className="border-primary bg-primary/5 pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed">
                    <span className="text-muted-foreground text-sm">
                      Drop to add images or videos
                    </span>
                  </div>
                ) : null}
                <div className="border-border bg-card focus-within:ring-primary/25 relative rounded-lg border p-4 shadow-sm transition-shadow duration-200 focus-within:ring-2">
                  <Textarea
                    id="content"
                    {...form.register("content")}
                    className={
                      "text-foreground min-h-[160px] border-0 bg-transparent shadow-none focus-visible:ring-0 " +
                      (form.formState.errors.content
                        ? "focus-visible:ring-destructive"
                        : "")
                    }
                    placeholder="Write a note…"
                    rows={6}
                    disabled={disabled}
                  />
                  {!isTemplateMode ? (
                    <div className="absolute top-4 right-4 flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDraftPickerOpen(true)}
                        disabled={disabled}
                        aria-label="Open draft"
                      >
                        <FolderOpen
                          className={`mr-1 ${INLINE_ICON_SIZE_CLASS}`}
                          strokeWidth={INLINE_ICON_STROKE}
                          aria-hidden
                        />
                        Open draft
                      </Button>
                    </div>
                  ) : null}
                </div>
                <AttachmentsStrip
                  attachments={attachments}
                  onRemove={handleRemoveAttachment}
                  onAdd={handleAddAttachment}
                  disabled={disabled}
                />
                {attachments.length === 0 && !isDraggingOver ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Drag files here or paste images
                  </p>
                ) : null}
                {form.formState.errors.content ? (
                  <div className="text-destructive mt-1 text-sm">
                    {form.formState.errors.content.message}
                  </div>
                ) : null}
                <div className="text-muted-foreground mt-2 flex items-center justify-between text-sm">
                  <span>{content.length}/5000</span>
                </div>
              </div>
            </>
          )}
        </div>
        <input
          id="thread-segment-file-input"
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          aria-hidden
          onChange={(e) => {
            const segmentId = (
              window as unknown as { __threadSegmentId?: string }
            ).__threadSegmentId;
            const files = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = "";
            if (!segmentId || files.length === 0) return;
            processNewFilesForSegment(segmentId, files);
          }}
        />
        {isTemplateMode ? (
          <div className="mt-4 space-y-2">
            <Label htmlFor="template-name">Template name</Label>
            <Input
              id="template-name"
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Weekly tip"
              className="max-w-xs"
              required
            />
          </div>
        ) : null}
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            {!isTemplateMode ? (
              <QueueSelector
                queueTypes={queueTypes}
                selectedQueue={selectedQueue}
                onQueueChange={setSelectedQueue}
                disabled={disabled}
                className="mb-2"
                nextSlot={
                  selectedQueueType &&
                  typeof selectedQueueType === "object" &&
                  (selectedQueueType.scheduleType === "FIXED_SLOTS" ||
                    selectedQueueType.scheduleType === "WEEKLY_SLOTS")
                    ? (() => {
                        const s = formScheduledFor ?? schedulingScheduledFor;
                        if (typeof s !== "string" || !s.trim()) return;
                        try {
                          const [datePart, timePart] = s.split("T");
                          if (!datePart || !timePart) return s;
                          const d = new Date(s);
                          const today = new Date();
                          const isToday =
                            d.getDate() === today.getDate() &&
                            d.getMonth() === today.getMonth() &&
                            d.getFullYear() === today.getFullYear();
                          const shortDate = isToday
                            ? "Today"
                            : d.toLocaleDateString(undefined, {
                                weekday: "short",
                              });
                          const [h, m] = timePart.split(":");
                          return `${shortDate} ${h ?? ""}:${m ?? "00"}`;
                        } catch {
                          return s;
                        }
                      })()
                    : undefined
                }
              />
            ) : null}
            <TagsChipRow
              tags={selectedHashtags}
              onTagsChange={(newTags) => {
                setSelectedHashtags(newTags);
                if (!newTags.trim()) {
                  form.setValue("useHashtagPresets", false);
                  form.setValue("hashTagPresetId", undefined);
                  onHashtagPresetChange?.(null, "");
                }
              }}
              presets={hashTagPresets}
              selectedPresetId={formSelectedHashtagPresetId}
              onPresetSelect={(presetId, mergedTags) => {
                setSelectedHashtags(mergedTags);
                form.setValue("useHashtagPresets", true);
                form.setValue("hashTagPresetId", presetId ?? undefined);
                onHashtagPresetChange?.(presetId, mergedTags);
              }}
              disabled={fetcher.state !== "idle"}
              queuePresetName={
                selectedQueue !== "unassigned"
                  ? ((
                      queueTypes.find(
                        (q) =>
                          (typeof q === "string" ? q : q.name) === selectedQueue
                      ) as
                        | (QueueType & {
                            hashTagPreset?: { name: string } | null;
                          })
                        | undefined
                    )?.hashTagPreset?.name ?? undefined)
                  : undefined
              }
            />
            {!isTemplateMode ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="scheduledFor">Schedule for later</Label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Input
                    type="datetime-local"
                    id="scheduledFor"
                    {...form.register("scheduledFor")}
                    disabled={disabled}
                  />
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
                  disabled={disabled}
                  showTimeInput={false}
                />
                <div className="border-border rounded-lg border">
                  <button
                    type="button"
                    onClick={() => setPostOptionsOpen((o) => !o)}
                    aria-expanded={postOptionsOpen}
                    className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors"
                  >
                    <span>Post options</span>
                    {!postOptionsOpen &&
                    (isThreadMode ||
                      form.watch("isRecyclable") ||
                      alsoScheduleRepost ||
                      alsoScheduleQuote) ? (
                      <span className="truncate text-xs">
                        {[
                          isThreadMode &&
                            `Thread · ${threadSegments.length} segment${threadSegments.length !== 1 ? "s" : ""}`,
                          form.watch("isRecyclable") && "Recyclable",
                          (alsoScheduleRepost || alsoScheduleQuote) &&
                            [
                              alsoScheduleRepost &&
                                `${repostDelayList.length} repost${repostDelayList.length !== 1 ? "s" : ""}`,
                              alsoScheduleQuote &&
                                `${quoteEntries.length} quote${quoteEntries.length !== 1 ? "s" : ""}`,
                            ]
                              .filter(Boolean)
                              .join(" · "),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform ${postOptionsOpen ? "rotate-180" : ""}`}
                      strokeWidth={INLINE_ICON_STROKE}
                      aria-hidden
                    />
                  </button>
                  {postOptionsOpen ? (
                    <>
                      <Separator className="my-2" />
                      <div className="border-border space-y-3 px-3 pb-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="thread-mode"
                            checked={isThreadMode}
                            onCheckedChange={(c) => setIsThreadMode(c === true)}
                            disabled={disabled}
                          />
                          <Label htmlFor="thread-mode" className="text-sm">
                            Thread (multiple posts in sequence)
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Controller
                            name="isRecyclable"
                            control={form.control}
                            render={({ field }) => (
                              <Checkbox
                                id="isRecyclable"
                                checked={!!field.value}
                                onCheckedChange={field.onChange}
                                disabled={disabled}
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
                        <AlsoScheduleBlock
                          alsoScheduleRepost={alsoScheduleRepost}
                          onAlsoScheduleRepostChange={setAlsoScheduleRepost}
                          repostDelayList={repostDelayList}
                          onRepostDelayListChange={setRepostDelayList}
                          alsoScheduleQuote={alsoScheduleQuote}
                          onAlsoScheduleQuoteChange={setAlsoScheduleQuote}
                          quoteEntries={quoteEntries}
                          onQuoteEntriesChange={setQuoteEntries}
                          disabled={disabled}
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          <div className="max-sm:bg-background/95 flex flex-col gap-2 max-sm:sticky max-sm:right-0 max-sm:bottom-0 max-sm:left-0 max-sm:z-10 max-sm:mt-4 max-sm:border-t max-sm:py-3 max-sm:backdrop-blur sm:flex-row sm:items-center">
            {isTemplateMode ? (
              <>
                <Button
                  ref={primarySubmitRef}
                  type="submit"
                  value="save-as-template"
                  name="_action"
                  disabled={disabled || !templateName.trim()}
                >
                  {fetcher.state !== "idle"
                    ? "Saving..."
                    : editTemplateContext
                      ? "Save"
                      : "Save as template"}
                </Button>
                <Button type="button" variant="ghost" asChild>
                  <Link to="/dashboard/templates">Cancel</Link>
                </Button>
              </>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                {signerReady === false ? (
                  <Button variant="default" asChild>
                    <Link to="/dashboard/settings">Connect signer</Link>
                  </Button>
                ) : (
                  <Button
                    ref={primarySubmitRef}
                    type="submit"
                    value={
                      hasScheduleTimeForSubmit
                        ? ACTION_SCHEDULE_TEXT
                        : ACTION_POST_TEXT
                    }
                    name="_action"
                    className="bg-success hover:bg-success/90 text-white"
                    disabled={disabled}
                  >
                    {hasScheduleTimeForSubmit ? (
                      <Clock
                        className="mr-1.5 h-5 w-5"
                        strokeWidth={INLINE_ICON_STROKE}
                        aria-hidden
                      />
                    ) : (
                      <Send
                        className="mr-1.5 h-5 w-5"
                        strokeWidth={INLINE_ICON_STROKE}
                        aria-hidden
                      />
                    )}
                    {isSigning
                      ? "Waiting for signer…"
                      : fetcher.state !== "idle"
                        ? hasScheduleTimeForSubmit
                          ? isThreadMode
                            ? "Scheduling thread…"
                            : "Scheduling..."
                          : isThreadMode
                            ? "Posting thread…"
                            : "Posting..."
                        : hasScheduleTimeForSubmit
                          ? scheduleTimeLabel
                            ? isThreadMode
                              ? `Schedule thread for ${scheduleTimeLabel}`
                              : `Schedule for ${scheduleTimeLabel}`
                            : isThreadMode
                              ? "Schedule thread"
                              : "Schedule"
                          : isThreadMode
                            ? "Post thread"
                            : "Post Now"}
                  </Button>
                )}
                <Button
                  ref={draftSubmitRef}
                  type="submit"
                  value="draft-text"
                  name="_action"
                  variant="outline"
                  disabled={disabled}
                >
                  <Pencil
                    className="mr-1.5 h-5 w-5"
                    strokeWidth={INLINE_ICON_STROKE}
                    aria-hidden
                  />
                  {fetcher.state !== "idle" ? "Saving..." : "Save as Draft"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </fetcher.Form>
      <ConfidencePanel
        queueName={selectedQueue}
        nextSlot={
          selectedQueueType &&
          typeof selectedQueueType === "object" &&
          (selectedQueueType.scheduleType === "FIXED_SLOTS" ||
            selectedQueueType.scheduleType === "WEEKLY_SLOTS")
            ? (formScheduledFor ?? schedulingScheduledFor).trim() || undefined
            : undefined
        }
        scheduledFor={
          (formScheduledFor ?? schedulingScheduledFor).trim() || undefined
        }
        timezone={user?.timezone ?? undefined}
        relativeTime={(() => {
          const s = (formScheduledFor ?? schedulingScheduledFor).trim();
          if (!s) return;
          try {
            const d = new Date(s);
            if (Number.isNaN(d.getTime())) return;
            const diffMs = d.getTime() - Date.now();
            if (diffMs < 0) return;
            const diffM = Math.round(diffMs / 60_000);
            const diffH = Math.floor(diffM / 60);
            const m = diffM % 60;
            if (diffH >= 1) return `in ${diffH}h${m > 0 ? ` ${m}m` : ""}`;
            return `in ${diffM} min`;
          } catch {
            return;
          }
        })()}
        charCount={
          isThreadMode
            ? threadSegments.reduce((acc, s) => acc + s.content.length, 0)
            : content.length
        }
        attachmentCount={
          isThreadMode
            ? threadSegments.reduce((acc, s) => acc + s.attachments.length, 0)
            : attachments.length
        }
        signerType={signerLabel ?? undefined}
        relayCount={relayCount}
        summaryLine={(() => {
          const queueLabel =
            selectedQueue === "unassigned" ? "No queue" : selectedQueue;
          const s = (formScheduledFor ?? schedulingScheduledFor).trim();
          const isScheduling = !!s;
          if (isThreadMode) {
            const segCount = threadSegments.length;
            const delay = `${threadDelayMinutes} min`;
            if (isScheduling) {
              return `Will schedule ${segCount} segment${segCount !== 1 ? "s" : ""} to ${queueLabel}, first at ${s}, then every ${delay}.`;
            }
            return `Will post ${segCount} segment${segCount !== 1 ? "s" : ""} now to ${queueLabel}, every ${delay}.`;
          }
          if (isScheduling) {
            return `Will schedule to ${queueLabel} at ${s}.`;
          }
          return `Will publish now to ${queueLabel}.`;
        })()}
        threadSummary={
          isThreadMode
            ? `${threadSegments.length} segments · every ${threadDelayMinutes} min`
            : undefined
        }
        warnings={undefined}
        usesQueueSlot={
          !!(
            selectedQueueType &&
            typeof selectedQueueType === "object" &&
            (selectedQueueType.scheduleType === "FIXED_SLOTS" ||
              selectedQueueType.scheduleType === "WEEKLY_SLOTS") &&
            (formScheduledFor ?? schedulingScheduledFor).trim()
          )
        }
      />
      <DraftPickerModal
        open={draftPickerOpen}
        onClose={() => setDraftPickerOpen(false)}
        type="short"
        onSelect={(id) => navigate(`/dashboard/newpost?draftId=${id}`)}
      />
    </div>
  );
}
