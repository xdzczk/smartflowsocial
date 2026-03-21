import { useLoaderData, useSearchParams, useNavigate } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { UnifiedComposer } from "~/features/posts/composer";
import { PollComposer } from "~/features/posts/composer/components/PollComposer";
import { useNewPostPublishModalEffect } from "~/features/posts/composer/hooks/useNewPostPublishModalEffect.client";
import {
  convertJsonValueToScheduleConfig,
  type HashTagPreset,
  type QueueType,
} from "~/features/posts/types";
import {
  type ComposerStatus,
  NewPostHeader,
  PublishResultModal,
  RelaySelectorModal,
} from "~/features/posts/ui";

import {
  getPostTypeFromPost,
  getNewPostUrl,
  determineModalAction,
} from "../../utils/publish-result.utils";
import { useNewPostState } from "../hooks/useNewPostState";

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

interface NewPostLoaderParsed {
  typedQueueTypes: Array<string | QueueType>;
  typedHashTagPresets: HashTagPreset[];
  scheduleIntervals: number[];
  defaultRelays: string[];
  initialDraft: InitialDraftShape | null;
  initialDraftId: string | null;
  templates: Array<{ id: string; name: string | null }>;
  nip88PollsEnabled: boolean;
}

function parseNewPostLoaderData(loaderDataRaw: unknown): NewPostLoaderParsed {
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

  const templates =
    "templates" in loaderData && Array.isArray(loaderData["templates"])
      ? (loaderData["templates"] as Array<{ id: string; name: string | null }>)
      : [];

  const nip88PollsEnabled = Boolean(
    "nip88PollsEnabled" in loaderData &&
    loaderData["nip88PollsEnabled"] === true
  );

  return {
    typedQueueTypes,
    typedHashTagPresets,
    scheduleIntervals,
    defaultRelays,
    initialDraft,
    initialDraftId,
    templates,
    nip88PollsEnabled,
  };
}

export default function NewPostPage() {
  const {
    typedQueueTypes,
    typedHashTagPresets,
    scheduleIntervals,
    defaultRelays,
    initialDraft,
    initialDraftId,
    templates,
    nip88PollsEnabled,
  } = parseNewPostLoaderData(useLoaderData<unknown>());

  const {
    selectedHashTagPresetId,
    handleQueueTypeChange,
    handleHashtagPresetSelect,
  } = useNewPostState();

  const [searchParams, setSearchParams] = useSearchParams();
  const scheduledAt = searchParams.get("scheduledAt");
  const publishResultToken =
    searchParams.get("published") ?? searchParams.get("scheduled");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPublishModal, setShowPublishModal] = useState(false);
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
  const [composerStatus, setComposerStatus] = useState<ComposerStatus>("Draft");
  const [relaySelectorOpen, setRelaySelectorOpen] = useState(false);
  const [selectedRelayUrls, setSelectedRelayUrls] = useState<string[]>([]);

  const [composerTab, setComposerTab] = useState<"post" | "poll">("post");

  const relayCount =
    selectedRelayUrls.length > 0
      ? selectedRelayUrls.length
      : defaultRelays.length;

  useNewPostPublishModalEffect({
    searchParams,
    setSearchParams,
    modalPostId,
    showPublishModal,
    setModalPostId,
    setModalPost,
    setModalLongFormPost,
    setShowPublishModal,
    queryClient,
  });

  useEffect(() => {
    if (!publishResultToken) return;
    try {
      localStorage.removeItem("composer-newpost-draft");
    } catch {
      // ignore
    }
  }, [publishResultToken]);

  return (
    <div className="p-6">
      <NewPostHeader
        status={composerStatus}
        relayCount={relayCount}
        onRelayClick={() => setRelaySelectorOpen(true)}
      />
      {nip88PollsEnabled ? (
        <div className="mb-4 flex gap-2 border-b pb-2">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              composerTab === "post"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => setComposerTab("post")}
          >
            Post
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              composerTab === "poll"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => setComposerTab("poll")}
          >
            Poll
          </button>
        </div>
      ) : null}
      {relaySelectorOpen ? (
        <RelaySelectorModal
          defaultRelays={defaultRelays}
          selectedRelays={
            selectedRelayUrls.length > 0 ? selectedRelayUrls : defaultRelays
          }
          onClose={() => setRelaySelectorOpen(false)}
          onSave={(urls) => {
            setSelectedRelayUrls(urls);
            setRelaySelectorOpen(false);
          }}
        />
      ) : null}

      {templates.length > 0 ? (
        <div className="mb-4 flex items-center gap-2">
          <label
            htmlFor="load-template-post"
            className="text-muted-foreground text-sm"
          >
            Load template:
          </label>
          <select
            id="load-template-post"
            className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
            value=""
            onChange={(e) => {
              const id = e.target.value;
              if (id)
                navigate(
                  `/dashboard/newpost?templateId=${encodeURIComponent(id)}`
                );
            }}
          >
            <option value="">— Choose —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name ?? "Unnamed template"}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {composerTab === "post" || !nip88PollsEnabled ? (
        <UnifiedComposer
          key={`newpost-composer-${publishResultToken ?? "default"}-${initialDraftId ?? "new"}`}
          queueTypes={typedQueueTypes}
          hashTagPresets={typedHashTagPresets}
          scheduleIntervals={
            scheduleIntervals.length > 0 ? scheduleIntervals : undefined
          }
          onQueueTypeChange={handleQueueTypeChange}
          selectedHashTagPresetId={selectedHashTagPresetId}
          onHashtagPresetChange={(presetId: string | null, _hashtags: string) =>
            handleHashtagPresetSelect(presetId ?? "", _hashtags)
          }
          relayOverride={
            selectedRelayUrls.length > 0 ? selectedRelayUrls : undefined
          }
          relayCount={relayCount}
          onComposerStatusChange={setComposerStatus}
          initialDraft={initialDraft}
          initialDraftId={initialDraftId}
          initialScheduledFor={scheduledAt ?? undefined}
          skipLocalDraftRestore={Boolean(publishResultToken)}
        />
      ) : (
        <PollComposer
          queueTypes={typedQueueTypes}
          hashTagPresets={typedHashTagPresets}
          scheduleIntervals={
            scheduleIntervals.length > 0 ? scheduleIntervals : undefined
          }
          onQueueTypeChange={handleQueueTypeChange}
          selectedHashTagPresetId={selectedHashTagPresetId}
          onHashtagPresetChange={(presetId: string | null, _hashtags: string) =>
            handleHashtagPresetSelect(presetId ?? "", _hashtags)
          }
          relayOverride={
            selectedRelayUrls.length > 0 ? selectedRelayUrls : undefined
          }
          relayCount={relayCount}
          onComposerStatusChange={setComposerStatus}
          defaultRelays={defaultRelays}
          initialScheduledFor={scheduledAt ?? undefined}
        />
      )}

      {showPublishModal && modalPostId && (modalPost || modalLongFormPost) ? (
        <PublishResultModal
          isOpen={showPublishModal}
          postId={modalPostId}
          publishAttemptId={
            modalPost?.publishAttemptId ??
            modalLongFormPost?.publishAttemptId ??
            null
          }
          action={determineModalAction(modalPost, modalLongFormPost)}
          postType={getPostTypeFromPost(modalPost, modalLongFormPost)}
          scheduledFor={
            modalPost?.scheduledAtUtc ??
            modalLongFormPost?.scheduledAtUtc ??
            null
          }
          onCreateNew={() => {
            const postType = getPostTypeFromPost(modalPost, modalLongFormPost);
            setShowPublishModal(false);
            setModalPostId(null);
            setModalPost(null);
            setModalLongFormPost(null);
            // Clear composer localStorage so the new post page shows an empty composer
            try {
              localStorage.removeItem("composer-newpost-draft");
            } catch {
              // ignore
            }
            // Client-side navigation preserves in-memory NIP-46 signer cache so the next post can sign without reconnecting
            navigate(getNewPostUrl(postType), { replace: true });
          }}
          onGoToDashboard={() => {
            setShowPublishModal(false);
            setModalPostId(null);
            setModalPost(null);
            setModalLongFormPost(null);
            navigate("/dashboard");
          }}
          onViewPage={() => {
            const postType = getPostTypeFromPost(modalPost, modalLongFormPost);
            const action = determineModalAction(modalPost, modalLongFormPost);

            if (action === "schedule") {
              // Navigate to scheduled page
              if (postType === "longform") {
                navigate("/dashboard/scheduled?tab=longform");
              } else {
                navigate("/dashboard/scheduled");
              }
            } else {
              // Navigate to posted page
              if (postType === "longform") {
                navigate("/dashboard/published?tab=longform");
              } else {
                navigate("/dashboard/published");
              }
            }
          }}
        />
      ) : null}
    </div>
  );
}
