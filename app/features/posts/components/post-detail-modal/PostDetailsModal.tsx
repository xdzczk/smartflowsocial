import { useFetcher, useRouteLoaderData } from "@remix-run/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import MediaModal from "~/components/ui/MediaModal";
import type { ChildReply } from "~/features/engagement/hooks/useNotificationActions";
import type { SignedEvent } from "~/features/nostr/types";
import { parsePollFromSignedEvent } from "~/features/polls";
import { formatDate } from "~/features/posts/utils/content-helpers";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { getNostrClientUrlsFromUser } from "~/lib/nostr-client-urls";
import { useThreadView } from "~/lib/query/hooks/useApiQuery";
import { cn } from "~/lib/utils";

import type { Post } from "../../data/posts-prisma-types.server";
import type { CombinedContent, PostData } from "../../types";

import {
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
  getHeaderTypeLabel,
  isPostPoll,
  resolvePostDetailVariant,
} from "./resolve-post-detail-variant";
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
}: PostDetailsModalProps) {
  const deleteFetcher = useFetcher();
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
    if (deleteFetcher.state !== "idle" || !deleteFetcher.data) return;
    const data = deleteFetcher.data as { success?: boolean; error?: unknown };
    if (data.error || !data.success) return;
    const formData = deleteFetcher.formData as FormData | undefined;
    const submittedPostId = formData?.get("postId");
    const isOurDelete =
      formData?.get("_action") === "delete" &&
      (submittedPostId === post.id ||
        String(submittedPostId) === String(post.id));
    if (isOurDelete) {
      onDeleted?.(post.id);
      onClose();
    }
  }, [
    deleteFetcher.state,
    deleteFetcher.data,
    deleteFetcher.formData,
    post.id,
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

  const threadMetadata = threadData?.metadata ?? {};
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

  const headerTypeLabel = getHeaderTypeLabel({ variant, innerVariant });
  const railTypeLabel = headerTypeLabel;

  const statusLabel =
    type === "published"
      ? "Posted"
      : type === "scheduled"
        ? "Scheduled"
        : "Draft";

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

  const onImageClick = useCallback((url: string) => {
    setActiveMediaSrc(url);
    setIsMediaOpen(true);
  }, []);

  const leftBody = (() => {
    if (variant === "thread") {
      return (
        <ThreadPostPreview
          post={post}
          type={type}
          nip88PollsEnabled={nip88PollsEnabled}
          innerVariant={innerVariant}
          heightMode={heightMode}
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
        compact={heightMode === "compact"}
      />
    );
  })();

  const deleteForm = (
    <deleteFetcher.Form method="post" onClick={(e) => e.stopPropagation()}>
      <input type="hidden" name="postId" value={post.id} />
      <input type="hidden" name="_action" value="delete" />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={deleteFetcher.state !== "idle"}
        className="border-destructive text-destructive hover:bg-destructive/10"
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
            "bg-card text-card-foreground border-border flex max-h-[90dvh] w-full max-w-[min(1040px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden rounded-xl p-0 shadow-2xl"
          )}
        >
          <PostDetailHeader typeLabel={headerTypeLabel} statusType={type} />

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row md:items-stretch">
            <div
              className={cn(
                "border-border min-h-0 min-w-0 flex-1 overflow-y-auto md:w-[70%] md:max-w-[72%] md:border-r",
                heightMode === "compact" ? "px-5 py-4" : "px-5 py-5 md:px-6"
              )}
            >
              {leftBody}
            </div>

            <PostDetailRail
              type={type}
              post={post}
              queueType={queueType}
              showStats={showStats}
              stats={stats}
              eventId={eventId}
              viewThreadUrl={viewThreadUrl}
              openOnNostrUrl={openOnNostrUrl}
              directReplies={directReplies}
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
              typeLabel={railTypeLabel}
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
            onEdit={onEdit != null ? () => onEdit(post) : undefined}
            onReschedule={
              onReschedule != null ? () => onReschedule(post) : undefined
            }
            deleteForm={deleteForm}
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
