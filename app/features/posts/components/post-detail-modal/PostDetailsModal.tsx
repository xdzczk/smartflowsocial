import { useFetcher, useRouteLoaderData } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import MediaModal from "~/components/ui/MediaModal";
import type { ChildReply } from "~/features/engagement/hooks/useNotificationActions";
import type { SignedEvent } from "~/features/nostr/types";
import { parsePollFromSignedEvent } from "~/features/polls";
import type { ScheduledPostCapabilities } from "~/features/posts/scheduled";
import { inferScheduledCapabilitiesFromModalPost } from "~/features/posts/scheduled";
import { formatDate } from "~/features/posts/utils/content-helpers";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { getNostrClientUrlsFromUser } from "~/lib/nostr-client-urls";
import { useThreadView } from "~/lib/query/hooks/useApiQuery";
import { cn } from "~/lib/utils";

import type { Post } from "../../data/posts-prisma-types.server";
import { optimisticallyRemovePostIdsFromViews } from "../../hooks/post-cache-prune";
import type { CombinedContent, PostData } from "../../types";

import { getPubkeyDisplayName } from "./author-metadata";
import {
  derivePostDetailSemantics,
  getPrimaryContentTypeLabel,
  partitionTags,
  shouldUseUltraCompactLayout,
} from "./derive-post-detail-semantics";
import {
  didDeleteActionSucceed,
  filterRepliesExcludingThreadSegments,
  formatScheduledDate,
  getDeleteButtonLabel,
  getPostContextLine,
  getPostEventId,
  getThreadGroupId,
  hasOpenOnNostrLink,
} from "./post-detail-helpers";
import { PostDetailFooterBar } from "./PostDetailFooter";
import { PostDetailHeader } from "./PostDetailHeader";
import { MediaPostPreview } from "./previews/MediaPostPreview";
import { PollPostPreview } from "./previews/PollPostPreview";
import { TextPostPreview } from "./previews/TextPostPreview";
import { ThreadPostPreview } from "./previews/ThreadPostPreview";
import { PostDetailRail } from "./rail/PostDetailRail";
import {
  isPostPoll,
  resolvePostDetailVariant,
} from "./resolve-post-detail-variant";
import type { PostDetailHeightMode } from "./resolve-post-detail-variant";
import { getPostDetailStateConfig } from "./state-config";
import { usePostThreadGroup } from "./usePostThreadGroup";

export interface PostDetailsModalProps {
  post: Post | PostData | CombinedContent;
  stats?: {
    likes: number;
    replies: number;
    mentions: number;
    reposts: number;
    zaps: number;
    satszapped: number;
  };
  onClose: () => void;
  onEdit?: (post: Post | PostData | CombinedContent) => void;
  onReschedule?: (post: Post | PostData | CombinedContent) => void;
  showStats?: boolean;
  showSignedEvent?: boolean;
  type?: "draft" | "published" | "scheduled";
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
  onDeleted?: (postId: string) => void;
  /** When set, overrides inferred scheduled footer capabilities (Edit disabled, etc.). */
  scheduledCapabilities?: ScheduledPostCapabilities | null;
  /** Optional link shown in scheduled details footer (e.g. full composer / article editor). */
  scheduledOpenFullEditorHref?: string | null;
}

export default function PostDetailsModal({
  post,
  stats,
  onClose,
  onEdit,
  onReschedule,
  showStats = false,
  showSignedEvent = false,
  type = "published",
  userTimezone,
  userTimeFormat = "12h",
  onDeleted,
  scheduledCapabilities: scheduledCapabilitiesProp,
  scheduledOpenFullEditorHref,
}: PostDetailsModalProps) {
  const deleteFetcher = useFetcher();
  const queryClient = useQueryClient();
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [activeMediaSrc, setActiveMediaSrc] = useState<string | null>(null);
  const [showEventData, setShowEventData] = useState(false);
  const rootData = useRouteLoaderData("root") as
    | {
        user?: {
          preferredNostrClient?: string;
          customNostrClientBaseUrl?: string | null;
        } | null;
      }
    | undefined;
  const dashboardRouteData = useRouteLoaderData("routes/dashboard") as
    | { nip88PollsEnabled?: boolean }
    | undefined;
  const nip88PollsEnabled = Boolean(dashboardRouteData?.nip88PollsEnabled);
  const nostrUrls = useMemo(
    () => getNostrClientUrlsFromUser(rootData?.user),
    [rootData?.user]
  );

  useEffect(() => {
    if (deleteFetcher.state !== "idle") return;
    const formData = deleteFetcher.formData as FormData | undefined;
    if (formData?.get("_action") !== "delete") return;
    if (deleteFetcher.data) {
      const data = deleteFetcher.data as { success?: boolean; error?: unknown };
      if (!didDeleteActionSucceed(data)) return;
    }
    const submittedPostId = formData.get("postId");
    const deletedPostId =
      typeof submittedPostId === "string" && submittedPostId.length > 0
        ? submittedPostId
        : String(post.id);
    optimisticallyRemovePostIdsFromViews(queryClient, [deletedPostId]);
    onDeleted?.(deletedPostId);
    onClose();
  }, [
    deleteFetcher.state,
    deleteFetcher.data,
    deleteFetcher.formData,
    post.id,
    queryClient,
    onDeleted,
    onClose,
  ]);

  const hasQueueType = (
    p: Post | PostData | CombinedContent
  ): p is PostData | CombinedContent => "queueType" in p;
  const queueType = hasQueueType(post) ? post.queueType : null;
  const eventId = getPostEventId(post, type);

  const { data: threadData, isPending: isThreadLoading } =
    useThreadView(eventId);

  const directReplies = useMemo((): ChildReply[] => {
    if (!eventId || !threadData?.events || !Array.isArray(threadData.events))
      return [];
    const events = threadData.events as Array<{
      id?: string;
      pubkey?: string;
      content?: string;
      created_at?: number;
      tags?: string[][];
    }>;
    return events
      .filter((event) => {
        const eTags = Array.isArray(event.tags)
          ? event.tags.filter((t) => Array.isArray(t) && t[0] === "e")
          : [];
        return eTags.some((t) => t[1] === eventId);
      })
      .map(
        (event): ChildReply => ({
          id: event.id ?? "",
          pubkey: event.pubkey ?? "",
          content: event.content ?? "",
          created_at: event.created_at ?? 0,
          tags: event.tags,
        })
      );
  }, [eventId, threadData?.events]);

  const threadMetadata = useMemo(
    () => threadData?.metadata ?? {},
    [threadData?.metadata]
  );
  const showOpenOnNostr = type === "published" && hasOpenOnNostrLink(post);
  const openOnNostrUrl = showOpenOnNostr
    ? nostrUrls.eventUrl(post.signedEvent.id)
    : null;
  const viewThreadUrl = eventId ? nostrUrls.eventUrl(eventId) : "";

  const groupId = getThreadGroupId(post);
  const threadGroupQuery = usePostThreadGroup(groupId, post.id);

  const { variant, heightMode, innerVariant } = useMemo(
    () =>
      resolvePostDetailVariant({
        nip88PollsEnabled,
        post,
        type,
      }),
    [nip88PollsEnabled, post, type]
  );

  const semantics = useMemo(
    () =>
      derivePostDetailSemantics({
        post,
        type,
        nip88PollsEnabled,
        layoutVariant: variant,
      }),
    [post, type, nip88PollsEnabled, variant]
  );

  const useUltra = shouldUseUltraCompactLayout({
    relationshipType: semantics.relationshipType,
    innerVariant,
    layoutVariant: variant,
    post,
    nip88PollsEnabled,
    type,
  });

  const effectiveHeightMode: PostDetailHeightMode = useUltra
    ? "ultraCompact"
    : heightMode;

  const headerTypeLabel = "Post";
  const contentLabel = getPrimaryContentTypeLabel({ innerVariant });

  const statusLabel =
    type === "published"
      ? "Posted"
      : type === "scheduled"
        ? "Scheduled"
        : "Draft";
  const stateConfig = getPostDetailStateConfig(type);

  const scheduledCapabilities = useMemo(() => {
    if (type !== "scheduled") return null;
    return (
      scheduledCapabilitiesProp ?? inferScheduledCapabilitiesFromModalPost(post)
    );
  }, [type, scheduledCapabilitiesProp, post]);

  const pollOptionCount = useMemo(() => {
    if (!isPostPoll({ nip88PollsEnabled, post, type })) return null;
    const se = post.signedEvent as SignedEvent | null | undefined;
    if (!se) return null;
    try {
      const def = parsePollFromSignedEvent(se);
      return def?.options.length ?? null;
    } catch {
      return null;
    }
  }, [nip88PollsEnabled, post, type]);

  const mediaCount = post.fileUrl?.length ?? 0;

  const { dateLocale } = useFormattedDate();
  const formatDateWithLocale = useCallback(
    (date: Date | string, short: boolean, tz?: string, fmt?: "12h" | "24h") =>
      formatDate(
        date,
        short,
        tz ?? userTimezone,
        fmt ?? userTimeFormat,
        dateLocale
      ),
    [dateLocale, userTimezone, userTimeFormat]
  );
  const formatScheduledDateWithLocale = useCallback(
    (d: Date | null | undefined, tz: string | undefined, fmt: "12h" | "24h") =>
      formatScheduledDate(d, tz, fmt, dateLocale),
    [dateLocale]
  );

  const contextLine = useMemo(
    () =>
      getPostContextLine(
        type,
        post,
        queueType,
        formatDateWithLocale,
        formatScheduledDateWithLocale,
        userTimezone,
        userTimeFormat
      ),
    [
      type,
      post,
      queueType,
      formatDateWithLocale,
      formatScheduledDateWithLocale,
      userTimezone,
      userTimeFormat,
    ]
  );

  const headerSubtitle = useMemo(() => {
    if (
      type === "scheduled" &&
      "scheduledAtUtc" in post &&
      post.scheduledAtUtc
    ) {
      return `${stateConfig.headerPrefix} ${formatScheduledDateWithLocale(
        post.scheduledAtUtc,
        userTimezone,
        userTimeFormat
      )}`;
    }
    if (type === "published" && post.publishedAt) {
      return `${stateConfig.headerPrefix} ${formatDateWithLocale(
        post.publishedAt,
        false,
        userTimezone,
        userTimeFormat
      )}`;
    }
    if (type === "draft") {
      return `${stateConfig.headerPrefix} ${formatDateWithLocale(
        post.createdAt,
        false,
        userTimezone,
        userTimeFormat
      )}`;
    }
    return null;
  }, [
    type,
    post,
    formatScheduledDateWithLocale,
    formatDateWithLocale,
    userTimezone,
    userTimeFormat,
    stateConfig.headerPrefix,
  ]);

  const onImageClick = useCallback((url: string) => {
    setActiveMediaSrc(url);
    setIsMediaOpen(true);
  }, []);

  const threadSegmentIds = useMemo(() => {
    const segs = threadGroupQuery.data?.segments;
    if (!segs?.length) return null;
    return new Set(segs.map((s) => s.id).filter(Boolean));
  }, [threadGroupQuery.data?.segments]);

  const railDirectReplies = useMemo(() => {
    if (variant !== "thread" || !threadSegmentIds?.size) return directReplies;
    return filterRepliesExcludingThreadSegments(
      directReplies,
      threadSegmentIds
    );
  }, [variant, threadSegmentIds, directReplies]);

  const threadEvents = useMemo((): Array<{
    id?: string;
    pubkey?: string;
    content?: string;
    tags?: string[][];
  }> => {
    if (!threadData?.events || !Array.isArray(threadData.events)) return [];
    return threadData.events as Array<{
      id?: string;
      pubkey?: string;
      content?: string;
      tags?: string[][];
    }>;
  }, [threadData?.events]);

  const { userTags, technicalTags } = useMemo(
    () => partitionTags(post.tags),
    [post.tags]
  );

  const inReplyToRail = useMemo(() => {
    if (semantics.relationshipType !== "reply") return null;
    const pid = semantics.parentEventId;
    const ev = pid ? (threadEvents.find((e) => e.id === pid) ?? null) : null;
    let snippet: string | null = null;
    if (ev?.content?.trim()) {
      const t = ev.content.trim();
      snippet = t.length > 140 ? `${t.slice(0, 137)}…` : t;
    }
    let authorLine: string | null = null;
    if (ev?.pubkey) {
      authorLine = getPubkeyDisplayName(ev.pubkey, threadMetadata);
    } else if (semantics.relatedPubkeyHex) {
      authorLine = getPubkeyDisplayName(
        semantics.relatedPubkeyHex,
        threadMetadata
      );
    }
    return {
      authorLine,
      snippet,
      viewThreadUrl: viewThreadUrl || "",
    };
  }, [
    semantics.relationshipType,
    semantics.parentEventId,
    semantics.relatedPubkeyHex,
    threadEvents,
    threadMetadata,
    viewThreadUrl,
  ]);

  const quotedPostRail = useMemo(() => {
    if (semantics.relationshipType !== "quote") return null;
    const qid = semantics.quotedEventId;
    const ev = qid ? (threadEvents.find((e) => e.id === qid) ?? null) : null;
    let snippet: string | null = null;
    if (ev?.content?.trim()) {
      const t = ev.content.trim();
      snippet = t.length > 140 ? `${t.slice(0, 137)}…` : t;
    }
    let authorLine: string | null = null;
    if (ev?.pubkey) {
      authorLine = getPubkeyDisplayName(ev.pubkey, threadMetadata);
    } else if (semantics.relatedPubkeyHex) {
      authorLine = getPubkeyDisplayName(
        semantics.relatedPubkeyHex,
        threadMetadata
      );
    }
    const openUrl = qid ? nostrUrls.eventUrl(qid) : null;
    const hasImetaTag = Boolean(ev?.tags?.some((t) => t[0] === "imeta"));
    const hasInlineImageUrl = Boolean(
      ev?.content && /https?:\/\/[^\s]+\.(png|jpe?g|gif|webp)/i.test(ev.content)
    );
    const hasMediaHint = hasImetaTag || hasInlineImageUrl;
    return { authorLine, snippet, openUrl, hasMediaHint };
  }, [
    semantics.relationshipType,
    semantics.quotedEventId,
    semantics.relatedPubkeyHex,
    threadEvents,
    threadMetadata,
    nostrUrls,
  ]);

  const repostedPostRail = useMemo(() => {
    if (semantics.relationshipType !== "repost") return null;
    const rid = semantics.repostedEventId;
    const ev = rid ? (threadEvents.find((e) => e.id === rid) ?? null) : null;
    let snippet: string | null = null;
    if (ev?.content?.trim()) {
      const t = ev.content.trim();
      snippet = t.length > 140 ? `${t.slice(0, 137)}…` : t;
    }
    let authorLine: string | null = null;
    if (ev?.pubkey) {
      authorLine = getPubkeyDisplayName(ev.pubkey, threadMetadata);
    } else if (semantics.relatedPubkeyHex) {
      authorLine = getPubkeyDisplayName(
        semantics.relatedPubkeyHex,
        threadMetadata
      );
    }
    const openUrl = rid ? nostrUrls.eventUrl(rid) : null;
    return { authorLine, snippet, openUrl };
  }, [
    semantics.relationshipType,
    semantics.repostedEventId,
    semantics.relatedPubkeyHex,
    threadEvents,
    threadMetadata,
    nostrUrls,
  ]);

  const threadContextPosition = useMemo(() => {
    if (semantics.relationshipType !== "thread_item") return null;
    const d = threadGroupQuery.data;
    if (d && d.currentIndex >= 0 && d.total > 0) {
      return `Post ${d.currentIndex + 1} of ${d.total}`;
    }
    return "Thread segment";
  }, [semantics.relationshipType, threadGroupQuery.data]);

  const leftBody = (() => {
    if (variant === "thread") {
      return (
        <ThreadPostPreview
          post={post}
          type={type}
          nip88PollsEnabled={nip88PollsEnabled}
          innerVariant={innerVariant}
          heightMode={effectiveHeightMode}
          formatDateFn={formatDateWithLocale}
          formatScheduledDateFn={formatScheduledDateWithLocale}
          userTimezone={userTimezone}
          userTimeFormat={userTimeFormat}
          queueType={queueType}
          onImageClick={onImageClick}
          threadGroupData={threadGroupQuery.data}
          threadGroupLoading={threadGroupQuery.isPending}
        />
      );
    }
    if (variant === "poll") {
      return (
        <PollPostPreview
          post={post}
          type={type}
          nip88PollsEnabled={nip88PollsEnabled}
          contextLine={contextLine}
        />
      );
    }
    if (variant === "media") {
      return (
        <MediaPostPreview
          post={post}
          contextLine={contextLine}
          onImageClick={onImageClick}
        />
      );
    }
    return (
      <TextPostPreview
        post={post}
        contextLine={contextLine}
        compact={
          effectiveHeightMode === "compact" ||
          effectiveHeightMode === "ultraCompact"
        }
        ultraCompact={effectiveHeightMode === "ultraCompact"}
        relationshipType={semantics.relationshipType}
        detailType={type}
        replyParentHint={inReplyToRail?.authorLine ?? null}
        quotedSnippet={quotedPostRail?.snippet ?? null}
        quotedAuthorHint={quotedPostRail?.authorLine ?? null}
        quotedOpenUrl={quotedPostRail?.openUrl ?? null}
        repostSourcePreview={repostedPostRail}
      />
    );
  })();

  const deleteForm = (
    <deleteFetcher.Form method="post" onClick={(e) => e.stopPropagation()}>
      <input type="hidden" name="postId" value={post.id} />
      <input type="hidden" name="_action" value="delete" />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={deleteFetcher.state !== "idle"}
        className="text-destructive/85 hover:bg-destructive/10 hover:text-destructive"
      >
        {deleteFetcher.state !== "idle" &&
        deleteFetcher.formData?.get("postId") === post.id
          ? "Deleting..."
          : getDeleteButtonLabel(type)}
      </Button>
    </deleteFetcher.Form>
  );

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          hideCloseButton
          className={cn(
            "bg-card text-card-foreground border-border/80 flex max-h-[86dvh] w-full flex-col gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl",
            useUltra
              ? "max-w-[min(980px,calc(100vw-2rem))]"
              : "max-w-[min(1200px,calc(100vw-2rem))]"
          )}
        >
          <PostDetailHeader
            typeLabel={headerTypeLabel}
            statusType={type}
            relationshipChipLabel={semantics.relationshipChipLabel}
            subtitle={headerSubtitle}
          />

          <div className="flex min-h-0 shrink flex-col overflow-hidden md:flex-row md:items-stretch">
            <div
              className={cn(
                "border-border/70 min-h-0 min-w-0 grow overflow-y-auto md:w-[66%] md:max-w-[68%] md:border-r",
                effectiveHeightMode === "ultraCompact"
                  ? "px-5 py-4 md:px-6"
                  : effectiveHeightMode === "compact"
                    ? "px-5 py-5 md:px-6"
                    : "px-6 py-6"
              )}
            >
              {leftBody}
            </div>

            <PostDetailRail
              variant={variant}
              type={type}
              post={post}
              queueType={queueType}
              showStats={showStats}
              stats={stats}
              eventId={eventId}
              viewThreadUrl={viewThreadUrl}
              openOnNostrUrl={openOnNostrUrl}
              directReplies={railDirectReplies}
              isThreadLoading={isThreadLoading}
              threadMetadata={threadMetadata}
              showSignedEvent={showSignedEvent}
              showEventData={showEventData}
              onToggleEventData={() => setShowEventData((v) => !v)}
              formatDateFn={formatDateWithLocale}
              formatScheduledDateFn={formatScheduledDateWithLocale}
              userTimezone={userTimezone}
              userTimeFormat={userTimeFormat}
              threadGroupSummary={threadGroupQuery.data}
              mediaCount={mediaCount}
              pollOptionCount={pollOptionCount}
              statusLabel={statusLabel}
              contentLabel={contentLabel}
              relationshipType={semantics.relationshipType}
              inReplyTo={inReplyToRail}
              quotedPost={quotedPostRail}
              repostedPost={repostedPostRail}
              threadContextPosition={threadContextPosition}
              userTags={userTags}
              technicalTags={technicalTags}
              stateSectionMode={stateConfig.sectionMode}
            />
          </div>

          <PostDetailFooterBar
            type={type}
            showOpenOnNostr={showOpenOnNostr}
            openOnNostrUrl={openOnNostrUrl}
            showViewThread={Boolean(
              type === "published" && eventId && eventId.length > 0
            )}
            viewThreadUrl={viewThreadUrl}
            viewThreadLabel={
              semantics.relationshipType === "reply"
                ? "View conversation"
                : "View thread"
            }
            secondaryNostrLink={
              semantics.relationshipType === "quote" && quotedPostRail?.openUrl
                ? {
                    label: "Open quoted post",
                    href: quotedPostRail.openUrl,
                  }
                : semantics.relationshipType === "repost" &&
                    repostedPostRail?.openUrl
                  ? {
                      label: "Open reposted post",
                      href: repostedPostRail.openUrl,
                    }
                  : null
            }
            onEdit={onEdit != null ? () => onEdit(post) : undefined}
            onReschedule={
              onReschedule != null ? () => onReschedule(post) : undefined
            }
            deleteForm={deleteForm}
            scheduledEditDisabled={
              type === "scheduled"
                ? Boolean(
                    scheduledCapabilities &&
                    !scheduledCapabilities.canEditContent &&
                    onEdit != null
                  )
                : undefined
            }
            scheduledEditDisabledReason="This scheduled repost cannot be edited as a full post."
            scheduledOpenFullEditorHref={
              scheduledOpenFullEditorHref ?? undefined
            }
          />

          <MediaModal
            src={activeMediaSrc ?? ""}
            isOpen={Boolean(isMediaOpen && activeMediaSrc)}
            onClose={() => setIsMediaOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
