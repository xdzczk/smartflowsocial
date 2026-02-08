import { Link } from "@remix-run/react";
import { Bell, Copy, Heart, MessageCircle, Repeat, Zap } from "lucide-react";
import { nip19 } from "nostr-tools";
import { useState } from "react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { Separator } from "~/components/ui/separator";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";

import type { Notification } from "../engagement.server";
import type { GroupedNotification } from "../types";

import { NotificationItem } from "./NotificationItem";
interface GroupedNotificationListProps {
  groupedNotifications: GroupedNotification[];
  userTimezone?: string;
  userRelays?: string[];
  trustScores?: Record<string, number>;
}

export default function GroupedNotificationList({
  groupedNotifications,
  userTimezone: _userTimezone,
  userRelays = ["wss://relay.primal.net"],
  trustScores = {},
}: GroupedNotificationListProps) {
  const { userTimezone } = useFormattedDate();

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

  return (
    <div className="space-y-6">
      {groupedNotifications.map((group) => (
        <GroupedNotificationCard
          key={group.parentPost.eventId}
          group={group}
          userTimezone={userTimezone}
          userRelays={userRelays}
          trustScores={trustScores}
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
}: {
  group: GroupedNotification;
  userTimezone?: string;
  userRelays?: string[];
  trustScores?: Record<string, number>;
}) {
  const { formatDate, userTimezone } = useFormattedDate();
  const { parentPost, notifications } = group;
  const [parentToast, setParentToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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
        false // Don't show toast, we set parentToast instead
      );
      setParentToast({ type: "error", message: "Failed to copy" });
      setTimeout(() => setParentToast(null), 2000);
    }
  };

  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
      {/* Forum-style layout: Parent post on left, replies on right */}
      <div className="flex flex-col lg:flex-row">
        {/* Parent Post - Left Side */}
        <div className="border-border bg-secondary/30 flex-shrink-0 border-b p-4 lg:w-2/5 lg:border-r lg:border-b-0">
          <div className="text-muted-foreground mb-2 flex items-center gap-2 text-xs">
            <MessageCircle
              className="h-5 w-5"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
            <span className="font-medium">Your post</span>
            {parentPost.publishedAt ? (
              <span>· {formatDate(parentPost.publishedAt)}</span>
            ) : null}
          </div>

          <div className="flex gap-3">
            {/* Media Preview */}
            {parentPost.fileUrl ? (
              <div className="flex-shrink-0">
                <MediaThumbnail
                  src={
                    Array.isArray(parentPost.fileUrl)
                      ? parentPost.fileUrl[0]
                      : parentPost.fileUrl
                  }
                  alt="Post media"
                  className="h-20 w-20 rounded object-cover"
                />
              </div>
            ) : null}

            {/* Content Preview */}
            <div className="flex-1 overflow-hidden">
              {parentPost.isLongform ? (
                <>
                  {parentPost.title ? (
                    <h4 className="text-foreground mb-1 font-semibold">
                      {parentPost.title.length > 100
                        ? parentPost.title.substring(0, 100) + "..."
                        : parentPost.title}
                    </h4>
                  ) : null}
                  {parentPost.content ? (
                    <p className="text-muted-foreground text-sm">
                      {parentPost.content.length > 150
                        ? parentPost.content.substring(0, 150) + "..."
                        : parentPost.content}
                    </p>
                  ) : null}
                </>
              ) : (
                parentPost.caption && (
                  <p className="text-foreground text-sm whitespace-pre-wrap">
                    {parentPost.caption.length > 200
                      ? parentPost.caption.substring(0, 200) + "..."
                      : parentPost.caption}
                  </p>
                )
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Link
                  to={`https://primal.net/e/${parentPost.eventId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary text-xs hover:underline"
                >
                  View original post →
                </Link>
                <button
                  onClick={() => {
                    void copyParentNevent();
                  }}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
                >
                  <Copy
                    className={INLINE_ICON_SIZE_CLASS}
                    strokeWidth={INLINE_ICON_STROKE}
                    aria-hidden
                  />
                  Copy NEvent
                </button>
              </div>
            </div>
          </div>

          {/* Toast for parent post */}
          {parentToast ? (
            <div
              className={`mt-2 rounded-lg px-3 py-2 text-xs ${parentToast.type === "success" ? "bg-success/20 text-success dark:text-success" : "bg-destructive/20 text-destructive"}`}
            >
              {parentToast.message}
            </div>
          ) : null}

          {/* Parent Post Stats */}
          {parentPost.stats ? (
            <>
              <Separator className="my-3" />
              <div className="flex flex-wrap gap-4">
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <MessageCircle
                    className={INLINE_ICON_SIZE_CLASS}
                    strokeWidth={INLINE_ICON_STROKE}
                    aria-hidden
                  />
                  <span>{parentPost.stats.replies}</span>
                </div>
                <div className="dark:text-muted-foreground text-foreground flex items-center gap-1.5 text-xs">
                  <Zap
                    className={INLINE_ICON_SIZE_CLASS}
                    strokeWidth={INLINE_ICON_STROKE}
                    aria-hidden
                  />
                  <span>
                    {parentPost.stats.zaps > 0
                      ? `${parentPost.stats.satszapped.toLocaleString()}`
                      : "0"}
                  </span>
                </div>
                <div className="dark:text-muted-foreground text-foreground flex items-center gap-1.5 text-xs">
                  <Heart
                    className={INLINE_ICON_SIZE_CLASS}
                    strokeWidth={INLINE_ICON_STROKE}
                    aria-hidden
                  />
                  <span>{parentPost.stats.likes}</span>
                </div>
                <div className="dark:text-muted-foreground text-foreground flex items-center gap-1.5 text-xs">
                  <Repeat
                    className={INLINE_ICON_SIZE_CLASS}
                    strokeWidth={INLINE_ICON_STROKE}
                    aria-hidden
                  />
                  <span>{parentPost.stats.reposts}</span>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Notifications - Right Side */}
        <div className="flex-1 lg:w-3/5">
          <div className="bg-muted px-4 py-2">
            <span className="text-foreground text-sm font-medium">
              {notifications.length}{" "}
              {notifications.length === 1 ? "reply" : "replies"} / mentions
            </span>
          </div>

          <div className="divide-border max-h-[500px] divide-y overflow-y-auto">
            {notifications.map((notification: Notification) => {
              return (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  userTimezone={userTimezone}
                  userRelays={userRelays}
                  trustScores={trustScores}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
