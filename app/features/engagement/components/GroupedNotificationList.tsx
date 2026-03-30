import { Link, useRouteLoaderData } from "@remix-run/react";
import {
  Bell,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Repeat,
  Zap,
} from "lucide-react";
import { nip19 } from "nostr-tools";
import { useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import {
  eventUrl,
  getNostrClientConfig,
  getNostrClientDisplayName,
} from "~/lib/nostr-client-urls";
import type { NostrClientConfig } from "~/lib/nostr-client-urls";

import type { Notification } from "../engagement.server";
import type { ReplyTemplate } from "../hooks/useReplyTemplates";
import type { EngagementQueueTypeOption, GroupedNotification } from "../types";
import type { EngagementListVariant } from "../utils/engagement-context-labels";
import { displayParentContextLabel } from "../utils/engagement-context-labels";

import { NotificationItem } from "./NotificationItem";

type EngagementItemStateMap = Record<
  string,
  {
    state:
      | "UNHANDLED"
      | "DRAFTED"
      | "SCHEDULED"
      | "REPLIED"
      | "IGNORED"
      | "SNOOZED"
      | "HANDLED";
    repliedFromApp: boolean;
    snoozedUntil?: string | null;
  }
>;

interface EngagementKeyboardHandlers {
  openReply: () => void;
  openQuote?: () => void;
  openRepost?: () => void;
  like: () => void;
  markDone: () => void;
  ignore?: () => void;
  snooze?: () => void;
  publishNow?: () => void;
  schedule?: () => void;
  expandThread: () => void;
}

interface GroupedNotificationListProps {
  groupedNotifications: GroupedNotification[];
  userTimezone?: string;
  userRelays?: string[];
  trustScores?: Record<string, number>;
  engagementItemStates?: EngagementItemStateMap;
  onMarkDone?: (
    eventId: string,
    repliedFromApp?: boolean,
    state?:
      | "UNHANDLED"
      | "DRAFTED"
      | "SCHEDULED"
      | "REPLIED"
      | "IGNORED"
      | "SNOOZED"
      | "HANDLED",
    snoozedUntil?: string | null
  ) => Promise<void>;
  baseIndex?: number;
  focusedIndex?: number;
  registerKeyboardHandlers?: (
    index: number,
    handlers: EngagementKeyboardHandlers | null
  ) => void;
  replyTemplates?: ReplyTemplate[];
  engagementLinkedActions?: Record<
    string,
    Array<{
      kind: string;
      label?: string | null;
      scheduledFor?: string | null;
      postId?: string | null;
      draftId?: string | null;
    }>
  >;
  groupSummaries?: Record<
    string,
    {
      total: number;
      needResponse: number;
      drafted: number;
      scheduled: number;
      handled: number;
    }
  >;
  listVariant?: EngagementListVariant;
  followedPubkeys?: string[];
  queueTypes?: EngagementQueueTypeOption[];
}

export default function GroupedNotificationList({
  groupedNotifications,
  userTimezone: _userTimezone,
  userRelays = ["wss://relay.primal.net"],
  trustScores = {},
  engagementItemStates = {},
  onMarkDone,
  baseIndex = 0,
  focusedIndex = -1,
  registerKeyboardHandlers,
  replyTemplates = [],
  engagementLinkedActions = {},
  groupSummaries = {},
  listVariant = "all",
  followedPubkeys = [],
  queueTypes = [],
}: GroupedNotificationListProps) {
  const { userTimezone } = useFormattedDate();
  const rootData = useRouteLoaderData("root") as
    | {
        user?: {
          preferredNostrClient?: string;
          customNostrClientBaseUrl?: string | null;
        } | null;
      }
    | undefined;
  const nostrClientConfig = useMemo(
    () =>
      getNostrClientConfig(
        rootData?.user?.preferredNostrClient,
        rootData?.user?.customNostrClientBaseUrl
      ),
    [
      rootData?.user?.preferredNostrClient,
      rootData?.user?.customNostrClientBaseUrl,
    ]
  );
  const viewEventLabel = getNostrClientDisplayName(
    rootData?.user?.preferredNostrClient
  );

  if (groupedNotifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-muted-foreground mb-4">
          <Bell
            className="h-16 w-16"
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
        </div>
        <p className="text-foreground text-lg font-medium">
          No notifications yet
        </p>
        <p className="text-muted-foreground text-sm">
          When you get replies or mentions, they&apos;ll show up here
        </p>
      </div>
    );
  }

  let itemIndex = baseIndex;
  return (
    <div className="space-y-6">
      {groupedNotifications.map((group) => (
        <GroupedNotificationCard
          key={group.parentPost.eventId}
          group={group}
          userTimezone={userTimezone}
          userRelays={userRelays}
          trustScores={trustScores}
          engagementItemStates={engagementItemStates}
          onMarkDone={onMarkDone}
          getNextIndex={() => itemIndex++}
          focusedIndex={focusedIndex}
          registerKeyboardHandlers={registerKeyboardHandlers}
          replyTemplates={replyTemplates}
          engagementLinkedActions={engagementLinkedActions}
          summary={groupSummaries[group.parentPost.eventId]}
          nostrClientConfig={nostrClientConfig}
          viewEventLabel={viewEventLabel}
          listVariant={listVariant}
          followedPubkeys={followedPubkeys}
          queueTypes={queueTypes}
        />
      ))}
    </div>
  );
}

function GroupedNotificationCard({
  group,
  userTimezone: _userTimezone,
  userRelays,
  trustScores = {},
  engagementItemStates = {},
  onMarkDone,
  getNextIndex,
  focusedIndex = -1,
  registerKeyboardHandlers,
  replyTemplates = [],
  engagementLinkedActions,
  summary,
  nostrClientConfig,
  viewEventLabel,
  listVariant,
  followedPubkeys,
  queueTypes,
}: {
  group: GroupedNotification;
  userTimezone?: string;
  userRelays?: string[];
  trustScores?: Record<string, number>;
  engagementItemStates?: EngagementItemStateMap;
  onMarkDone?: (
    eventId: string,
    repliedFromApp?: boolean,
    state?:
      | "UNHANDLED"
      | "DRAFTED"
      | "SCHEDULED"
      | "REPLIED"
      | "IGNORED"
      | "SNOOZED"
      | "HANDLED",
    snoozedUntil?: string | null
  ) => Promise<void>;
  getNextIndex: () => number;
  focusedIndex?: number;
  registerKeyboardHandlers?: (
    index: number,
    handlers: EngagementKeyboardHandlers | null
  ) => void;
  replyTemplates?: ReplyTemplate[];
  engagementLinkedActions: Record<
    string,
    Array<{
      kind: string;
      label?: string | null;
      scheduledFor?: string | null;
      postId?: string | null;
      draftId?: string | null;
    }>
  >;
  summary?: {
    total: number;
    needResponse: number;
    drafted: number;
    scheduled: number;
    handled: number;
  };
  nostrClientConfig: NostrClientConfig;
  viewEventLabel: string;
  listVariant: EngagementListVariant;
  followedPubkeys: string[];
  queueTypes: EngagementQueueTypeOption[];
}) {
  const { formatDate, userTimezone } = useFormattedDate();
  const { parentPost, notifications } = group;
  const [parentToast, setParentToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const contextTitle = displayParentContextLabel(parentPost, listVariant);

  const copyParentNevent = async () => {
    try {
      const neventEncoded = nip19.neventEncode({
        id: parentPost.eventId,
        relays: ["wss://relay.primal.net"],
        author: parentPost.pubkey,
      });

      await navigator.clipboard.writeText(`nostr:${neventEncoded}`);
      setParentToast({
        type: "success",
        message: "NEvent copied to clipboard!",
      });
      setTimeout(() => setParentToast(null), 2000);
    } catch (error) {
      const { handleAsyncErrorWithMessage } =
        await import("~/lib/error-handler.client");
      handleAsyncErrorWithMessage(
        error,
        "Failed to copy",
        {
          component: "GroupedNotificationList",
          action: "handleCopyNEvent",
        },
        false
      );
      setParentToast({ type: "error", message: "Failed to copy" });
      setTimeout(() => setParentToast(null), 2000);
    }
  };

  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
      <div className="flex flex-col lg:flex-row">
        <div className="border-border flex flex-shrink-0 flex-col border-b p-3 lg:w-[40%] lg:border-r lg:border-b-0">
          <div className="text-muted-foreground mb-1.5 flex flex-wrap items-center gap-2 text-xs">
            <MessageCircle
              className="h-4 w-4 shrink-0"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
            <span className="text-foreground/90 font-medium">
              {contextTitle}
            </span>
            {parentPost.publishedAt ? (
              <span>· {formatDate(parentPost.publishedAt)}</span>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground h-7 w-7"
                  aria-label="Post actions"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    void copyParentNevent();
                  }}
                >
                  Copy NEvent
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex gap-2">
            {parentPost.fileUrl ? (
              <div className="flex-shrink-0">
                <MediaThumbnail
                  src={
                    Array.isArray(parentPost.fileUrl)
                      ? parentPost.fileUrl[0]
                      : parentPost.fileUrl
                  }
                  alt="Post media"
                  className="h-16 w-16 rounded object-cover"
                />
              </div>
            ) : null}

            <div className="min-w-0 flex-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-default">
                    {parentPost.isLongform ? (
                      <>
                        {parentPost.title ? (
                          <h4 className="text-foreground mb-0.5 text-sm leading-snug font-semibold">
                            {parentPost.title.length > 100
                              ? parentPost.title.substring(0, 100) + "..."
                              : parentPost.title}
                          </h4>
                        ) : null}
                        {parentPost.content ? (
                          <p className="text-muted-foreground text-xs leading-snug">
                            {parentPost.content.length > 150
                              ? parentPost.content.substring(0, 150) + "..."
                              : parentPost.content}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      parentPost.caption && (
                        <p className="text-foreground text-sm leading-snug whitespace-pre-wrap">
                          {parentPost.caption.length > 200
                            ? parentPost.caption.substring(0, 200) + "..."
                            : parentPost.caption}
                        </p>
                      )
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="max-w-sm p-3 text-left break-words whitespace-pre-wrap"
                >
                  {parentPost.isLongform ? (
                    <>
                      {parentPost.title ? (
                        <div className="font-semibold">{parentPost.title}</div>
                      ) : null}
                      {parentPost.content ?? ""}
                    </>
                  ) : (
                    (parentPost.caption ?? "")
                  )}
                </TooltipContent>
              </Tooltip>

              {parentPost.stats ? (
                <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle
                      className={INLINE_ICON_SIZE_CLASS}
                      strokeWidth={INLINE_ICON_STROKE}
                      aria-hidden
                    />
                    {parentPost.stats.replies}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Zap
                      className={INLINE_ICON_SIZE_CLASS}
                      strokeWidth={INLINE_ICON_STROKE}
                      aria-hidden
                    />
                    {parentPost.stats.zaps > 0
                      ? `${parentPost.stats.satszapped.toLocaleString()}`
                      : "0"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Heart
                      className={INLINE_ICON_SIZE_CLASS}
                      strokeWidth={INLINE_ICON_STROKE}
                      aria-hidden
                    />
                    {parentPost.stats.likes}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Repeat
                      className={INLINE_ICON_SIZE_CLASS}
                      strokeWidth={INLINE_ICON_STROKE}
                      aria-hidden
                    />
                    {parentPost.stats.reposts}
                  </span>
                </div>
              ) : null}

              {summary ? (
                <div className="text-muted-foreground mt-1.5 text-xs font-medium tracking-tight">
                  <span className="text-foreground/80">
                    {summary.total} total
                  </span>
                  <span className="text-border mx-1.5">·</span>
                  <span>{summary.needResponse} need response</span>
                  <span className="text-border mx-1.5">·</span>
                  <span>{summary.scheduled} scheduled</span>
                </div>
              ) : null}

              <Link
                to={eventUrl(parentPost.eventId, nostrClientConfig)}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-primary mt-1.5 inline-block text-xs"
              >
                View original post →
              </Link>
            </div>
          </div>

          {parentToast ? (
            <div
              className={`mt-2 rounded-md border px-2 py-1.5 text-xs ${
                parentToast.type === "success"
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {parentToast.message}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 lg:w-[60%]">
          <div className="divide-border max-h-[500px] divide-y overflow-y-auto">
            {notifications.map((notification: Notification) => {
              const workflowState =
                engagementItemStates[notification.eventId]?.state;
              const itemIndex = getNextIndex();
              return (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  userTimezone={userTimezone}
                  userRelays={userRelays}
                  trustScores={trustScores}
                  workflowState={workflowState}
                  onMarkDone={onMarkDone}
                  keyboardIndex={itemIndex}
                  isKeyboardFocused={itemIndex === focusedIndex}
                  registerKeyboardHandlers={registerKeyboardHandlers}
                  replyTemplates={replyTemplates}
                  linkedActions={
                    engagementLinkedActions[notification.eventId] ?? []
                  }
                  viewEventUrl={eventUrl(
                    notification.eventId,
                    nostrClientConfig
                  )}
                  viewEventLabel={`View on ${viewEventLabel}`}
                  isSelected={notification.eventId === selectedEventId}
                  onSelect={() => setSelectedEventId(notification.eventId)}
                  contentVariant={
                    listVariant === "mentions" ? "mention" : "default"
                  }
                  isFollowingAuthor={followedPubkeys.includes(
                    notification.pubkey
                  )}
                  queueTypes={queueTypes}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
