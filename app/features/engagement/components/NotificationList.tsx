import { Link } from "@remix-run/react";
import { Bell, MessageCircle, Zap } from "lucide-react";

import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";

import type { Notification } from "../engagement.server";
import type {
  NotificationReply,
  NotificationZap,
  NotificationMention,
} from "../types";

interface NotificationListProps {
  notifications: Notification[];
  userTimezone?: string;
}

export default function NotificationList({
  notifications,
  userTimezone: _userTimezone,
}: NotificationListProps) {
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-foreground mb-4">
          <Bell
            className="h-16 w-16"
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
        </div>
        <p className="dark:text-foreground text-muted-foreground text-lg font-medium">
          No notifications yet
        </p>
        <p className="dark:text-muted-foreground text-muted-foreground text-sm">
          When you get replies, mentions, or zaps, they&apos;ll show up here
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {notifications.map((notification) => {
        if (notification.type === "reply") {
          return (
            <ReplyNotification
              key={notification.id}
              notification={notification}
              userTimezone={_userTimezone}
            />
          );
        } else if (notification.type === "zap") {
          return (
            <ZapNotification
              key={notification.id}
              notification={notification}
              userTimezone={_userTimezone}
            />
          );
        } else if (notification.type === "mention") {
          return (
            <MentionNotification
              key={notification.id}
              notification={notification}
              userTimezone={_userTimezone}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

function ReplyNotification({
  notification,
  userTimezone: _userTimezone,
}: {
  notification: NotificationReply;
  userTimezone?: string;
}) {
  const { formatDate } = useFormattedDate();
  const displayName =
    notification.authorName ??
    notification.pubkey.substring(0, 8) + "..." + notification.pubkey.slice(-4);

  return (
    <div className="hover:bg-muted dark:bg-card dark:hover:bg-muted/50 bg-white p-4 transition-colors">
      <div className="flex gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className="bg-muted dark:bg-muted flex h-8 w-8 items-center justify-center rounded-full">
            <MessageCircle
              className={`text-muted-foreground ${INLINE_ICON_SIZE_CLASS}`}
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="mb-1 flex items-center gap-2">
            {notification.authorPicture ? (
              <img
                src={notification.authorPicture}
                alt={displayName}
                className="h-6 w-6 rounded-full"
              />
            ) : (
              <div className="dark:bg-muted bg-muted h-6 w-6 rounded-full" />
            )}
            <span className="text-foreground font-semibold">{displayName}</span>
            {notification.authorNip05 ? (
              <span className="text-muted-foreground dark:text-foreground text-xs">
                @{notification.authorNip05.split("@")[0]}
              </span>
            ) : null}
            <span className="dark:text-muted-foreground text-muted-foreground text-sm">
              replied
            </span>
          </div>

          <p className="dark:text-foreground text-muted-foreground mb-2 text-sm break-words whitespace-pre-wrap">
            {notification.content}
          </p>

          <div className="dark:text-muted-foreground text-muted-foreground flex items-center gap-4 text-xs">
            <span>
              {formatDate(notification.createdAt * 1000, {
                isUnixTimestamp: false,
              })}
            </span>
            <Link
              to={`https://primal.net/e/${String(notification.eventId)}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary dark:text-muted-foreground hover:underline"
            >
              View on Primal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ZapNotification({
  notification,
  userTimezone: _userTimezone,
}: {
  notification: NotificationZap;
  userTimezone?: string;
}) {
  const { formatDate } = useFormattedDate();
  const displayName =
    notification.senderName ??
    notification.senderPubkey.substring(0, 8) +
      "..." +
      notification.senderPubkey.slice(-4);

  return (
    <div className="hover:bg-muted dark:bg-card dark:hover:bg-muted/50 bg-white p-4 transition-colors">
      <div className="flex gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
            <Zap
              className={`dark:text-foreground ${INLINE_ICON_SIZE_CLASS} text-yellow-600`}
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="mb-1 flex items-center gap-2">
            {notification.senderPicture ? (
              <img
                src={notification.senderPicture}
                alt={displayName}
                className="h-6 w-6 rounded-full"
              />
            ) : (
              <div className="dark:bg-muted bg-muted h-6 w-6 rounded-full" />
            )}
            <span className="text-foreground font-semibold">{displayName}</span>
            {notification.senderNip05 ? (
              <span className="text-muted-foreground dark:text-foreground text-xs">
                @{notification.senderNip05.split("@")[0]}
              </span>
            ) : null}
            <span className="dark:text-muted-foreground text-muted-foreground text-sm">
              zapped you
            </span>
            <span className="dark:text-foreground rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800 dark:bg-yellow-900">
              ⚡ {notification.amountSats.toLocaleString()} sats
            </span>
          </div>

          {notification.content ? (
            <p className="dark:text-foreground text-muted-foreground mb-2 text-sm break-words whitespace-pre-wrap">
              {notification.content}
            </p>
          ) : null}

          <div className="dark:text-muted-foreground text-muted-foreground flex items-center gap-4 text-xs">
            <span>
              {formatDate(notification.createdAt * 1000, {
                isUnixTimestamp: false,
              })}
            </span>
            <Link
              to={`https://primal.net/e/${String(notification.originalEventId)}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary dark:text-muted-foreground hover:underline"
            >
              View original post
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function MentionNotification({
  notification,
  userTimezone: _userTimezone,
}: {
  notification: NotificationMention;
  userTimezone?: string;
}) {
  const { formatDate } = useFormattedDate();
  const displayName =
    notification.authorName ??
    notification.pubkey.substring(0, 8) + "..." + notification.pubkey.slice(-4);

  return (
    <div className="hover:bg-muted dark:bg-card dark:hover:bg-muted/50 bg-white p-4 transition-colors">
      <div className="flex gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
            <MessageCircle
              className={`text-foreground ${INLINE_ICON_SIZE_CLASS}`}
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="mb-1 flex items-center gap-2">
            {notification.authorPicture ? (
              <img
                src={notification.authorPicture}
                alt={displayName}
                className="h-6 w-6 rounded-full"
              />
            ) : (
              <div className="dark:bg-muted bg-muted h-6 w-6 rounded-full" />
            )}
            <span className="text-foreground font-semibold">{displayName}</span>
            {notification.authorNip05 ? (
              <span className="text-muted-foreground dark:text-foreground text-xs">
                @{notification.authorNip05.split("@")[0]}
              </span>
            ) : null}
            <span className="dark:text-muted-foreground text-muted-foreground text-sm">
              mentioned you
            </span>
          </div>

          <p className="dark:text-foreground text-muted-foreground mb-2 text-sm break-words whitespace-pre-wrap">
            {notification.content}
          </p>

          <div className="dark:text-muted-foreground text-muted-foreground flex items-center gap-4 text-xs">
            <span>
              {formatDate(notification.createdAt * 1000, {
                isUnixTimestamp: false,
              })}
            </span>
            <Link
              to={`https://primal.net/e/${String(notification.eventId)}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary dark:text-muted-foreground hover:underline"
            >
              View on Primal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
