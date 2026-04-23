import {
  useLoaderData,
  useNavigation,
  useSearchParams,
  useNavigate,
} from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";

import { ComposerSkeleton } from "~/components/skeletons/ComposerSkeleton";
import { Button } from "~/components/ui/button";
import { useNewPostPublishModalEffect } from "~/features/posts/composer/hooks/useNewPostPublishModalEffect";
import {
  DraftPickerModal,
  type ShortDraftFilter,
} from "~/features/posts/drafts";
import {
  convertJsonValueToScheduleConfig,
  type HashTagPreset,
  type QueueType,
} from "~/features/posts/types";
import { PublishResultModal, RelaySelectorModal } from "~/features/posts/ui";
import type { AccountPublishRelaySource } from "~/features/relays/composer-relay-lists";

import {
  getPostTypeFromPost,
  getNewPostUrl,
  determineModalAction,
} from "../../utils/publish-result.utils";
import { useNewPostState } from "../hooks/useNewPostState";
import type { ComposerContext } from "../services/compose-route-contract";
import type { InitialPollRestore } from "../types/initial-poll-restore";
import { trackComposerEvent } from "../utils/composer-analytics.client";

import type { ComposerPublishMode } from "./composer";
import { CreateComposerShell } from "./CreateComposerShell";

const LOCAL_DRAFT_KEYS = [
  "composer-newpost-post-draft",
  "composer-newpost-thread-draft",
  "composer-newpost-poll-draft",
] as const;

const LazyUnifiedComposer = lazy(async () => {
  const mod =
    await import("~/features/posts/composer/components/UnifiedComposer");
  return { default: mod.UnifiedComposer };
});

const LazyPollComposer = lazy(async () => {
  const mod = await import("~/features/posts/composer/components/PollComposer");
  return { default: mod.PollComposer };
});

// ============================================================================
// Loader Data Parsing Helpers (route-safe, no server imports)
// ============================================================================

function parseQueueType(qt: unknown): string | QueueType {
  if (typeof qt === "string") return qt;
  if (
    typeof qt === "object" &&
    qt !== null &&
    "id" in qt &&
    "name" in qt &&
    typeof (qt as { id: unknown; name: unknown }).id === "string" &&
    typeof (qt as { id: unknown; name: unknown }).name === "string"
  ) {
    const queueTypeObj = qt as {
      id: string;
      name: string;
      scheduleConfig?: unknown;
      cadenceLabel?: unknown;
      waitingCount?: unknown;
      status?: unknown;
      [key: string]: unknown;
    };
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Type assertion needed for Remix loader data structure
    return {
      id: queueTypeObj.id,
      name: queueTypeObj.name,
      color:
        typeof queueTypeObj["color"] === "string"
          ? queueTypeObj["color"]
          : undefined,
      description:
        typeof queueTypeObj["description"] === "string"
          ? queueTypeObj["description"]
          : undefined,
      scheduleType:
        typeof queueTypeObj["scheduleType"] === "string" &&
        (queueTypeObj["scheduleType"] === "INTERVAL" ||
          queueTypeObj["scheduleType"] === "FIXED_SLOTS" ||
          queueTypeObj["scheduleType"] === "WEEKLY_SLOTS")
          ? queueTypeObj["scheduleType"]
          : undefined,
      scheduleConfig: convertJsonValueToScheduleConfig(
        queueTypeObj.scheduleConfig
      ),
      cadenceLabel:
        typeof queueTypeObj.cadenceLabel === "string"
          ? queueTypeObj.cadenceLabel
          : undefined,
      waitingCount:
        typeof queueTypeObj.waitingCount === "number"
          ? queueTypeObj.waitingCount
          : undefined,
      status:
        typeof queueTypeObj.status === "string" &&
        ["active", "paused", "full", "manual"].includes(queueTypeObj.status)
          ? (queueTypeObj.status as "active" | "paused" | "full" | "manual")
          : undefined,
      isEnabled:
        typeof queueTypeObj["isEnabled"] === "boolean"
          ? queueTypeObj["isEnabled"]
          : undefined,
      userId:
        typeof queueTypeObj["userId"] === "string"
          ? queueTypeObj["userId"]
          : undefined,
    } as QueueType;
  }
  return qt as string | QueueType;
}

function parseDateValue(dateValue: unknown): Date | undefined {
  if (dateValue === null || dateValue === undefined) return;
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === "string") return new Date(dateValue);
  return;
}

function parseHashTagPreset(preset: unknown): HashTagPreset | null {
  if (
    typeof preset === "object" &&
    preset !== null &&
    "id" in preset &&
    "name" in preset &&
    "tags" in preset &&
    typeof (preset as { id: unknown; name: unknown; tags: unknown }).id ===
      "string" &&
    typeof (preset as { id: unknown; name: unknown; tags: unknown }).name ===
      "string" &&
    typeof (preset as { id: unknown; name: unknown; tags: unknown }).tags ===
      "string"
  ) {
    const typedPreset = preset as {
      id: string;
      name: string;
      tags: string;
      description?: unknown;
      createdAt?: unknown;
      updatedAt?: unknown;
      userId?: unknown;
    };
    return {
      id: typedPreset.id,
      name: typedPreset.name,
      tags: typedPreset.tags,
      description:
        typedPreset.description === null
          ? null
          : typeof typedPreset.description === "string"
            ? typedPreset.description
            : undefined,
      userId:
        typeof typedPreset.userId === "string" ? typedPreset.userId : undefined,
      createdAt: parseDateValue(typedPreset.createdAt),
      updatedAt: parseDateValue(typedPreset.updatedAt),
    };
  }
  return null;
}

interface InitialDraftShape {
  content: string;
  caption: string;
  fileUrl: string[];
  queueType: string;
  queueTypeId: string | null;
  tags: string;
  draftMeta: {
    attachmentMeta?: Array<{
      localId: string;
      url: string;
      alt?: string;
    }>;
  } | null;
  hashTagPresetId: string | null;
}

function parseInitialPollRestore(raw: unknown): InitialPollRestore | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o["question"] !== "string") return null;
  if (!Array.isArray(o["options"])) return null;
  let options = o["options"].filter((x): x is string => typeof x === "string");
  if (options.length < 2) options = ["", ""];
  const pt = o["pollType"];
  const pollType = pt === "multiplechoice" ? "multiplechoice" : "singlechoice";
  const endsAtUnix =
    typeof o["endsAtUnix"] === "number" && Number.isFinite(o["endsAtUnix"])
      ? Math.floor(o["endsAtUnix"])
      : undefined;
  const selectedHashtags =
    typeof o["selectedHashtags"] === "string" ? o["selectedHashtags"] : "";
  const hashTagPresetId =
    o["hashTagPresetId"] === null
      ? null
      : typeof o["hashTagPresetId"] === "string"
        ? o["hashTagPresetId"]
        : null;
  const queueType =
    typeof o["queueType"] === "string" ? o["queueType"] : "unassigned";
  return {
    question: o["question"],
    options,
    pollType,
    endsAtUnix,
    selectedHashtags,
    hashTagPresetId,
    queueType,
    includeHashtagsInNoteBody:
      typeof o["includeHashtagsInNoteBody"] === "boolean"
        ? o["includeHashtagsInNoteBody"]
        : undefined,
    isRecyclable:
      typeof o["isRecyclable"] === "boolean" ? o["isRecyclable"] : undefined,
  };
}

export interface NewPostLoaderParsed {
  typedQueueTypes: Array<string | QueueType>;
  typedHashTagPresets: HashTagPreset[];
  scheduleIntervals: number[];
  defaultRelays: string[];
  relaysApp: string[];
  relaysNip65Profile: string[];
  accountPublishRelaySource: AccountPublishRelaySource;
  initialDraft: InitialDraftShape | null;
  initialDraftId: string | null;
  initialPollRestore: InitialPollRestore | null;
  templates: Array<{ id: string; name: string | null }>;
  nip88PollsEnabled: boolean;
  composerContext: ComposerContext;
  hydrationStatus: "ready" | "error";
  hydrationError: string | null;
  initialScheduledFor: string | null;
  editingMeta: {
    modeLabel: string;
    accountLabel: string;
    scheduledForLabel?: string;
    statusLabel?: string;
    queueLabel?: string;
    parentActionId?: string;
  } | null;
}

function parseComposerContextUnknown(raw: unknown): ComposerContext {
  if (!raw || typeof raw !== "object") return { mode: "create" };
  const obj = raw as Record<string, unknown>;
  const mode = obj["mode"];
  if (mode === "edit_draft" && typeof obj["draftId"] === "string") {
    return { mode, draftId: obj["draftId"] };
  }
  if (
    mode === "edit_scheduled" &&
    typeof obj["scheduledActionId"] === "string"
  ) {
    return { mode, scheduledActionId: obj["scheduledActionId"] };
  }
  if (
    mode === "edit_follow_up" &&
    typeof obj["followUpActionId"] === "string"
  ) {
    const parentActionId =
      typeof obj["parentActionId"] === "string"
        ? obj["parentActionId"]
        : undefined;
    return { mode, followUpActionId: obj["followUpActionId"], parentActionId };
  }
  return { mode: "create" };
}

/* eslint-disable-next-line sonarjs/cognitive-complexity -- parser normalizes many optional loader fields defensively */
export function parseNewPostLoaderData(
  loaderDataRaw: unknown
): NewPostLoaderParsed {
  const loaderData =
    loaderDataRaw && typeof loaderDataRaw === "object"
      ? (loaderDataRaw as Record<string, unknown>)
      : {};

  const queueTypes =
    "queueTypes" in loaderData && Array.isArray(loaderData["queueTypes"])
      ? loaderData["queueTypes"]
      : [];
  const hashTagPresets =
    "hashTagPresets" in loaderData &&
    Array.isArray(loaderData["hashTagPresets"])
      ? loaderData["hashTagPresets"]
      : [];

  const typedQueueTypes: Array<string | QueueType> = Array.isArray(queueTypes)
    ? queueTypes.map((qt) => parseQueueType(qt))
    : [];
  const typedHashTagPresets: HashTagPreset[] = Array.isArray(hashTagPresets)
    ? hashTagPresets
        .map((p) => parseHashTagPreset(p))
        .filter((p): p is HashTagPreset => p !== null)
    : [];

  const scheduleIntervalsRaw =
    "scheduleIntervals" in loaderData &&
    Array.isArray(loaderData["scheduleIntervals"])
      ? loaderData["scheduleIntervals"]
      : [];
  const scheduleIntervals: number[] = scheduleIntervalsRaw
    .map((s: unknown) => {
      if (typeof s === "number" && !Number.isNaN(s)) return s;
      if (typeof s === "string") {
        const n = parseFloat(s);
        return Number.isNaN(n) ? null : n;
      }
      return null;
    })
    .filter((n): n is number => n !== null);

  const defaultRelays =
    "relays" in loaderData && Array.isArray(loaderData["relays"])
      ? (loaderData["relays"] as unknown[]).filter(
          (r): r is string => typeof r === "string"
        )
      : [];

  const relaysApp =
    "relaysApp" in loaderData && Array.isArray(loaderData["relaysApp"])
      ? (loaderData["relaysApp"] as unknown[]).filter(
          (r): r is string => typeof r === "string"
        )
      : [];

  const relaysNip65Profile =
    "relaysNip65Profile" in loaderData &&
    Array.isArray(loaderData["relaysNip65Profile"])
      ? (loaderData["relaysNip65Profile"] as unknown[]).filter(
          (r): r is string => typeof r === "string"
        )
      : [];

  const accountPublishRelaySource: AccountPublishRelaySource =
    loaderData["publishRelaySource"] === "nip65_profile"
      ? "nip65_profile"
      : "app";

  const initialDraft =
    "initialDraft" in loaderData &&
    loaderData["initialDraft"] !== null &&
    typeof loaderData["initialDraft"] === "object"
      ? (loaderData["initialDraft"] as InitialDraftShape)
      : null;

  const initialDraftId =
    "initialDraftId" in loaderData &&
    typeof loaderData["initialDraftId"] === "string"
      ? loaderData["initialDraftId"]
      : null;

  const initialPollRestoreRaw = loaderData["initialPollRestore"];
  const initialPollRestore =
    initialPollRestoreRaw !== null &&
    initialPollRestoreRaw !== undefined &&
    typeof initialPollRestoreRaw === "object"
      ? parseInitialPollRestore(initialPollRestoreRaw)
      : null;

  const templates =
    "templates" in loaderData && Array.isArray(loaderData["templates"])
      ? (loaderData["templates"] as Array<{ id: string; name: string | null }>)
      : [];

  const nip88PollsEnabled = Boolean(
    "nip88PollsEnabled" in loaderData &&
    loaderData["nip88PollsEnabled"] === true
  );
  const composerContext = parseComposerContextUnknown(
    loaderData["composerContext"]
  );
  const hydrationStatus =
    loaderData["hydrationStatus"] === "error" ? "error" : "ready";
  const hydrationError =
    typeof loaderData["hydrationError"] === "string"
      ? loaderData["hydrationError"]
      : null;
  const initialScheduledFor =
    typeof loaderData["initialScheduledFor"] === "string"
      ? loaderData["initialScheduledFor"]
      : null;
  const editingMetaRaw = loaderData["editingMeta"];
  const editingMeta =
    editingMetaRaw && typeof editingMetaRaw === "object"
      ? (editingMetaRaw as NewPostLoaderParsed["editingMeta"])
      : null;

  return {
    typedQueueTypes,
    typedHashTagPresets,
    scheduleIntervals,
    defaultRelays,
    relaysApp,
    relaysNip65Profile,
    accountPublishRelaySource,
    initialDraft,
    initialDraftId,
    initialPollRestore,
    templates,
    nip88PollsEnabled,
    composerContext,
    hydrationStatus,
    hydrationError,
    initialScheduledFor,
    editingMeta,
  };
}

/* eslint-disable-next-line sonarjs/cognitive-complexity -- Page orchestrator intentionally coordinates tabs, route params, modals, and publish state in one place. */
export default function NewPostPage() {
  const {
    typedQueueTypes,
    typedHashTagPresets,
    scheduleIntervals,
    defaultRelays,
    relaysApp,
    relaysNip65Profile,
    accountPublishRelaySource,
    initialDraft,
    initialDraftId,
    initialPollRestore,
    templates,
    composerContext,
    hydrationStatus,
    hydrationError,
    initialScheduledFor: loaderInitialScheduledFor,
    editingMeta,
  } = parseNewPostLoaderData(useLoaderData<unknown>());

  const {
    selectedHashTagPresetId,
    handleQueueTypeChange,
    handleHashtagPresetSelect,
  } = useNewPostState();

  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const scheduledAt = searchParams.get("scheduledAt");
  const composedScheduledAt = scheduledAt ?? loaderInitialScheduledFor;
  const publishResultToken =
    searchParams.get("published") ?? searchParams.get("scheduled");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPublishModal, setShowPublishModal] = useState(false);
  // When the user clicks "Publish now", this fires immediately so the modal
  // can open before any signing or server round-trip completes.
  const [publishIntentActive, setPublishIntentActive] = useState(false);
  const [publishIntentStartedAt, setPublishIntentStartedAt] = useState<
    number | null
  >(null);
  const [modalPostId, setModalPostId] = useState<string | null>(null);
  const [modalPost, setModalPost] = useState<{
    id: string;
    publishAttemptId: string | null;
    currentState?: string | null;
    scheduledAtUtc?: string | Date | null;
  } | null>(null);
  const [modalLongFormPost, setModalLongFormPost] = useState<{
    id: string;
    publishAttemptId: string | null;
    currentState?: string | null;
    scheduledAtUtc?: string | Date | null;
  } | null>(null);
  const [relaySelectorOpen, setRelaySelectorOpen] = useState(false);
  const [selectedRelayUrls, setSelectedRelayUrls] = useState<string[] | null>(
    null
  );
  const [saveStateLabel, setSaveStateLabel] = useState<string | null>(null);
  const [shortDraftPicker, setShortDraftPicker] = useState<{
    open: boolean;
    mode: "drafts" | "templates";
  }>({ open: false, mode: "drafts" });

  const initialComposerType = searchParams.get("type");
  const [composerTab, setComposerTab] = useState<"post" | "poll" | "thread">(
    () =>
      initialComposerType === "poll" || initialComposerType === "thread"
        ? initialComposerType
        : "post"
  );
  /** Bumped on success modal "Create new post" so composers remount (poll has no localStorage draft like UnifiedComposer). */
  const [composerSessionKey, setComposerSessionKey] = useState(0);
  const [publishMode, setPublishMode] = useState<ComposerPublishMode>("now");
  useEffect(() => {
    trackComposerEvent("composer_content_type_selected", {
      contentType: composerTab,
    });
  }, [composerTab]);
  useEffect(() => {
    const currentType = searchParams.get("type");
    if (currentType === composerTab) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("type", composerTab);
    setSearchParams(nextParams, { replace: true });
  }, [composerTab, searchParams, setSearchParams]);

  useEffect(() => {
    trackComposerEvent("composer_publish_mode_selected", {
      publishMode,
    });
  }, [publishMode]);

  const relayCount =
    selectedRelayUrls !== null
      ? selectedRelayUrls.length
      : defaultRelays.length;

  const title =
    composerContext.mode === "edit_scheduled"
      ? "Edit scheduled post"
      : composerContext.mode === "edit_follow_up"
        ? "Edit follow-up"
        : composerContext.mode === "edit_draft"
          ? "Edit draft"
          : initialDraftId != null
            ? "Edit draft"
            : composerTab === "poll"
              ? "Create poll"
              : composerTab === "thread"
                ? "Create thread"
                : "Create post";
  const isEditMode = composerContext.mode !== "create";
  const showHydrationHardError = isEditMode && hydrationStatus === "error";

  const shortComposeDraftPickerBase =
    composerTab === "thread"
      ? "/dashboard/compose?type=thread"
      : composerTab === "poll"
        ? "/dashboard/compose?type=poll"
        : "/dashboard/compose?type=post";

  const shortDraftFilter: ShortDraftFilter =
    composerTab === "poll"
      ? "poll"
      : composerTab === "thread"
        ? "thread"
        : "all";

  // Opens the publish progress modal immediately on publish-now click, before
  // signing or server round-trip completes. The modal then hydrates with real
  // post data when the URL param arrives via useNewPostPublishModalEffect.
  const handlePublishIntent = useCallback(() => {
    setPublishIntentActive(true);
    setPublishIntentStartedAt(Date.now());
    setShowPublishModal(true);
  }, []);

  const resetPublishModalState = useCallback(() => {
    setShowPublishModal(false);
    setModalPostId(null);
    setModalPost(null);
    setModalLongFormPost(null);
    setPublishIntentActive(false);
    setPublishIntentStartedAt(null);
  }, []);

  useNewPostPublishModalEffect({
    searchParams,
    setSearchParams,
    modalPostId,
    setModalPostId,
    setModalPost,
    setModalLongFormPost,
    setShowPublishModal,
    queryClient,
  });

  useEffect(() => {
    if (!publishResultToken) return;
    try {
      for (const key of LOCAL_DRAFT_KEYS) {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
  }, [publishResultToken]);

  return (
    <CreateComposerShell
      contentType={composerTab}
      onContentTypeChange={(next) => {
        if (navigation.state !== "idle") return;
        if (next === "article") {
          navigate("/dashboard/compose?type=article");
          return;
        }
        setComposerTab(next);
      }}
      title={title}
      composerHeaderActions={
        <div className="flex items-center gap-0.5 sm:gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShortDraftPicker({ open: true, mode: "drafts" })}
            className="text-text-secondary hover:text-text h-8 px-2 text-xs"
            aria-label="Open drafts"
          >
            Drafts
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setShortDraftPicker({ open: true, mode: "templates" })
            }
            className="text-text-secondary hover:text-text h-8 px-2 text-xs"
            aria-label="Open templates"
          >
            Templates
          </Button>
        </div>
      }
      saveStateLabel={saveStateLabel}
    >
      <div>
        {isEditMode && editingMeta ? (
          <div className="bg-surface-hover/60 border-border mb-4 rounded-md border px-3 py-2 text-sm">
            <p className="font-medium">{editingMeta.modeLabel}</p>
            <p className="text-text-secondary mt-1 text-xs">
              Changes update the existing item. A new post will not be created.
            </p>
            <p className="text-text-secondary mt-1">
              Account: {editingMeta.accountLabel}
              {editingMeta.scheduledForLabel
                ? ` · Scheduled for: ${editingMeta.scheduledForLabel}`
                : ""}
              {editingMeta.queueLabel
                ? ` · Queue: ${editingMeta.queueLabel}`
                : ""}
              {editingMeta.statusLabel
                ? ` · Status: ${editingMeta.statusLabel}`
                : ""}
            </p>
            {editingMeta.parentActionId ? (
              <p className="text-text-secondary mt-1">
                Parent action: {editingMeta.parentActionId}
              </p>
            ) : null}
          </div>
        ) : null}
        {showHydrationHardError ? (
          <div className="bg-danger/10 border-danger/40 text-danger-text mb-4 rounded-md border px-3 py-2 text-sm">
            {hydrationError ??
              "This item is no longer editable. Open the parent or return to scheduled posts."}
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate("/dashboard/scheduled")}
              >
                Go back
              </Button>
            </div>
          </div>
        ) : null}
        {showHydrationHardError ? null : (
          <>
            {relaySelectorOpen ? (
              <RelaySelectorModal
                relayLists={{
                  default: defaultRelays,
                  app: relaysApp,
                  nip65Profile: relaysNip65Profile,
                }}
                accountPublishRelaySource={accountPublishRelaySource}
                inheritRelays={selectedRelayUrls === null}
                selectedRelays={selectedRelayUrls ?? defaultRelays}
                onClose={() => setRelaySelectorOpen(false)}
                onSave={(urls) => {
                  setSelectedRelayUrls(urls);
                  setRelaySelectorOpen(false);
                }}
              />
            ) : null}

            <Suspense fallback={<ComposerSkeleton />}>
              {composerTab === "poll" ? (
                <LazyPollComposer
                  key={`poll-composer-${composerSessionKey}-${publishResultToken ?? "default"}-${initialDraftId ?? "new"}`}
                  queueTypes={typedQueueTypes}
                  hashTagPresets={typedHashTagPresets}
                  scheduleIntervals={
                    scheduleIntervals.length > 0 ? scheduleIntervals : undefined
                  }
                  onQueueTypeChange={handleQueueTypeChange}
                  selectedHashTagPresetId={selectedHashTagPresetId}
                  onHashtagPresetChange={(
                    presetId: string | null,
                    _hashtags: string
                  ) => handleHashtagPresetSelect(presetId ?? "", _hashtags)}
                  relayOverride={selectedRelayUrls ?? undefined}
                  relayCount={relayCount}
                  onRelayClick={() => setRelaySelectorOpen(true)}
                  defaultRelays={defaultRelays}
                  initialScheduledFor={composedScheduledAt ?? undefined}
                  publishMode={publishMode}
                  onPublishModeChange={setPublishMode}
                  skipLocalDraftRestore={
                    Boolean(publishResultToken) ||
                    Boolean(initialDraftId) ||
                    isEditMode
                  }
                  initialQueue={initialDraft?.queueType ?? "unassigned"}
                  initialPollRestore={initialPollRestore}
                  initialDraftId={initialDraftId}
                  onDraftStateLabelChange={setSaveStateLabel}
                  onPublishIntent={handlePublishIntent}
                />
              ) : (
                <LazyUnifiedComposer
                  key={`newpost-composer-${composerSessionKey}-${publishResultToken ?? "default"}-${initialDraftId ?? "new"}`}
                  queueTypes={typedQueueTypes}
                  hashTagPresets={typedHashTagPresets}
                  scheduleIntervals={
                    scheduleIntervals.length > 0 ? scheduleIntervals : undefined
                  }
                  onQueueTypeChange={handleQueueTypeChange}
                  selectedHashTagPresetId={selectedHashTagPresetId}
                  onHashtagPresetChange={(
                    presetId: string | null,
                    _hashtags: string
                  ) => handleHashtagPresetSelect(presetId ?? "", _hashtags)}
                  relayOverride={selectedRelayUrls ?? undefined}
                  relayCount={relayCount}
                  onRelayClick={() => setRelaySelectorOpen(true)}
                  initialDraft={initialDraft}
                  initialDraftId={initialDraftId}
                  initialScheduledFor={composedScheduledAt ?? undefined}
                  composerContext={composerContext}
                  skipLocalDraftRestore={
                    Boolean(publishResultToken) || isEditMode
                  }
                  localDraftStorageKey={
                    composerTab === "thread"
                      ? "composer-newpost-thread-draft"
                      : "composer-newpost-post-draft"
                  }
                  draftPickerNavigateBase={`/dashboard/compose?type=${composerTab === "thread" ? "thread" : "post"}`}
                  newPostContentTab={
                    composerTab === "thread" ? "thread" : "post"
                  }
                  publishMode={publishMode}
                  onPublishModeChange={setPublishMode}
                  composerTemplates={templates}
                  suppressBuiltInDraftPicker
                  onDraftStateLabelChange={setSaveStateLabel}
                  onPublishIntent={handlePublishIntent}
                />
              )}
            </Suspense>

            <DraftPickerModal
              key={`${composerTab}-${shortDraftPicker.mode}`}
              open={shortDraftPicker.open}
              onClose={() =>
                setShortDraftPicker((s) => ({ ...s, open: false }))
              }
              type="short"
              shortDraftFilter={shortDraftFilter}
              onSelect={
                shortDraftPicker.mode === "drafts"
                  ? (id) => {
                      const separator = shortComposeDraftPickerBase.includes(
                        "?"
                      )
                        ? "&"
                        : "?";
                      navigate(
                        `${shortComposeDraftPickerBase}${separator}draftId=${encodeURIComponent(id)}`
                      );
                    }
                  : undefined
              }
              draftsAndTemplates={
                shortDraftPicker.mode === "templates"
                  ? {
                      templates,
                      templatesOnly: true,
                      onSelectTemplate: (templateId) => {
                        const separator = shortComposeDraftPickerBase.includes(
                          "?"
                        )
                          ? "&"
                          : "?";
                        navigate(
                          `${shortComposeDraftPickerBase}${separator}templateId=${encodeURIComponent(templateId)}`
                        );
                      },
                    }
                  : undefined
              }
            />

            {showPublishModal ? (
              <PublishResultModal
                isOpen={showPublishModal}
                postId={modalPostId ?? ""}
                publishAttemptId={
                  modalPost?.publishAttemptId ??
                  modalLongFormPost?.publishAttemptId ??
                  null
                }
                action={
                  publishIntentActive && !modalPost && !modalLongFormPost
                    ? "publish"
                    : determineModalAction(modalPost, modalLongFormPost)
                }
                postType={getPostTypeFromPost(modalPost, modalLongFormPost)}
                scheduledFor={
                  modalPost?.scheduledAtUtc ??
                  modalLongFormPost?.scheduledAtUtc ??
                  null
                }
                immediateProgress={Boolean(publishIntentActive && !modalPostId)}
                intentStartedAt={publishIntentStartedAt}
                onCreateNew={() => {
                  const postType = getPostTypeFromPost(
                    modalPost,
                    modalLongFormPost
                  );
                  resetPublishModalState();
                  setComposerSessionKey((k) => k + 1);
                  // Clear composer localStorage so the new post page shows an empty composer
                  try {
                    for (const key of LOCAL_DRAFT_KEYS) {
                      localStorage.removeItem(key);
                    }
                  } catch {
                    // ignore
                  }
                  // Client-side navigation preserves in-memory NIP-46 signer cache so the next post can sign without reconnecting
                  navigate(getNewPostUrl(postType), { replace: true });
                }}
                onGoToDashboard={() => {
                  resetPublishModalState();
                  navigate("/dashboard");
                }}
                onViewPage={() => {
                  const postType = getPostTypeFromPost(
                    modalPost,
                    modalLongFormPost
                  );
                  const action = determineModalAction(
                    modalPost,
                    modalLongFormPost
                  );

                  resetPublishModalState();

                  if (action === "schedule") {
                    if (postType === "longform") {
                      navigate("/dashboard/scheduled?tab=longform");
                    } else {
                      navigate("/dashboard/scheduled");
                    }
                  } else if (postType === "longform") {
                    navigate("/dashboard/published?tab=longform");
                  } else {
                    navigate("/dashboard/published");
                  }
                }}
              />
            ) : null}
          </>
        )}
      </div>
    </CreateComposerShell>
  );
}
