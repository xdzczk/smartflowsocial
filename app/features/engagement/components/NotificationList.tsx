import { Link } from "@remix-run/react";
import { Bell, MessageCircle, Zap } from "lucide-react";
import { useMemo } from "react";

import { EmptyState } from "~/components/ui/empty-state";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import { eventUrl, getNostrClientUrlsFromUser } from "~/lib/nostr-client-urls";
import { useOptionalUser } from "~/lib/remix-utils";

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
  const user = useOptionalUser();
  const { config: nostrClientConfig } = useMemo(
    () => getNostrClientUrlsFromUser(user),
    [user]
  );

  if (notifications.length === 0) {
    return (
      <EmptyState
        size="lg"
        icon={<Bell strokeWidth={INLINE_ICON_STROKE} />}
        title="No notifications yet"
        description="When you get replies, mentions, or zaps, they'll show up here"
      />
    );
  }

  return (
    <div className="border-border divide-y">
      {notifications.map((notification) => {
        if (notification.type === "reply") {
          return (
            <ReplyNotification
              key={notification.id}
              notification={notification}
              userTimezone={_userTimezone}
              viewEventUrl={eventUrl(notification.eventId, nostrClientConfig)}
            />
          );
        } else if (notification.type === "zap") {
          return (
            <ZapNotification
              key={notification.id}
              notification={notification}
              userTimezone={_userTimezone}
              viewEventUrl={eventUrl(
                notification.originalEventId,
                nostrClientConfig
              )}
            />
          );
        } else if (notification.type === "mention") {
          return (
            <MentionNotification
              key={notification.id}
              notification={notification}
              userTimezone={_userTimezone}
              viewEventUrl={eventUrl(notification.eventId, nostrClientConfig)}
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
  viewEventUrl,
}: {
  notification: NotificationReply;
  userTimezone?: string;
  viewEventUrl?: string;
}) {
  const { formatDate } = useFormattedDate();
  const displayName =
    notification.authorName ??
    notification.pubkey.substring(0, 8) + "..." + notification.pubkey.slice(-4);

  return (
    <div className="bg-surface hover:bg-surface-hover motion-fast p-4">
      <div className="flex gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className="bg-surface-hover dark:bg-surface-hover flex h-8 w-8 items-center justify-center rounded-full">
            <MessageCircle
              className={`text-text-secondary ${INLINE_ICON_SIZE_CLASS}`}
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="cluster mb-1">
            {notification.authorPicture ? (
              <img
                src={notification.authorPicture}
                alt={displayName}
                className="h-6 w-6 rounded-full"
              />
            ) : (
              <div className="dark:bg-surface-hover bg-surface-hover h-6 w-6 rounded-full" />
            )}
            <span className="text-text font-semibold">{displayName}</span>
            {notification.authorNip05 ? (
              <span className="text-text-secondary text-xs">
                @{notification.authorNip05.split("@")[0]}
              </span>
            ) : null}
            <span className="dark:text-text-secondary text-text-secondary text-sm">
              replied
            </span>
          </div>

          <p className="text-text-secondary mb-2 text-sm break-words whitespace-pre-wrap">
            {notification.content}
          </p>

          <div className="dark:text-text-secondary text-text-secondary flex items-center gap-4 text-xs">
            <span>
              {formatDate(notification.createdAt, {
                isUnixTimestamp: true,
              })}
            </span>
            <Link
              to={
                viewEventUrl ??
                `https://primal.net/e/${String(notification.eventId)}`
              }
              target="_blank"
              rel="noreferrer"
              className="text-link hover:text-link-hover hover:underline"
            >
              Open on Nostr
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
  viewEventUrl,
}: {
  notification: NotificationZap;
  userTimezone?: string;
  viewEventUrl?: string;
}) {
  const { formatDate } = useFormattedDate();
  const displayName =
    notification.senderName ??
    notification.senderPubkey.substring(0, 8) +
      "..." +
      notification.senderPubkey.slice(-4);

  return (
    <div className="bg-surface hover:bg-surface-hover motion-fast p-4">
      <div className="flex gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className="bg-warning/12 dark:bg-warning/15 flex h-8 w-8 items-center justify-center rounded-full">
            <Zap
              className={`dark:text-text ${INLINE_ICON_SIZE_CLASS} text-warning-text`}
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="cluster mb-1">
            {notification.senderPicture ? (
              <img
                src={notification.senderPicture}
                alt={displayName}
                className="h-6 w-6 rounded-full"
              />
            ) : (
              <div className="dark:bg-surface-hover bg-surface-hover h-6 w-6 rounded-full" />
            )}
            <span className="text-text font-semibold">{displayName}</span>
            {notification.senderNip05 ? (
              <span className="text-text-secondary text-xs">
                @{notification.senderNip05.split("@")[0]}
              </span>
            ) : null}
            <span className="dark:text-text-secondary text-text-secondary text-sm">
              zapped you
            </span>
            <span className="text-text bg-warning/12 text-warning-text dark:bg-warning/15 rounded-full px-2 py-0.5 text-xs font-semibold">
              ⚡ {notification.amountSats.toLocaleString()} sats
            </span>
          </div>

          {notification.content ? (
            <p className="dark:text-text text-text-secondary mb-2 text-sm break-words whitespace-pre-wrap">
              {notification.content}
            </p>
          ) : null}

          <div className="dark:text-text-secondary text-text-secondary flex items-center gap-4 text-xs">
            <span>
              {formatDate(notification.createdAt, {
                isUnixTimestamp: true,
              })}
            </span>
            <Link
              to={
                viewEventUrl ??
                `https://primal.net/e/${String(notification.originalEventId)}`
              }
              target="_blank"
              rel="noreferrer"
              className="text-link hover:text-link-hover hover:underline"
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
  viewEventUrl,
}: {
  notification: NotificationMention;
  userTimezone?: string;
  viewEventUrl?: string;
}) {
  const { formatDate } = useFormattedDate();
  const displayName =
    notification.authorName ??
    notification.pubkey.substring(0, 8) + "..." + notification.pubkey.slice(-4);

  return (
    <div className="bg-surface hover:bg-surface-hover motion-fast p-4">
      <div className="flex gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className="bg-surface-hover flex h-8 w-8 items-center justify-center rounded-full">
            <MessageCircle
              className={`text-text ${INLINE_ICON_SIZE_CLASS}`}
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="cluster mb-1">
            {notification.authorPicture ? (
              <img
                src={notification.authorPicture}
                alt={displayName}
                className="h-6 w-6 rounded-full"
              />
            ) : (
              <div className="dark:bg-surface-hover bg-surface-hover h-6 w-6 rounded-full" />
            )}
            <span className="text-text font-semibold">{displayName}</span>
            {notification.authorNip05 ? (
              <span className="text-text-secondary text-xs">
                @{notification.authorNip05.split("@")[0]}
              </span>
            ) : null}
            <span className="dark:text-text-secondary text-text-secondary text-sm">
              mentioned you
            </span>
          </div>

          <p className="text-text-secondary mb-2 text-sm break-words whitespace-pre-wrap">
            {notification.content}
          </p>

          <div className="dark:text-text-secondary text-text-secondary flex items-center gap-4 text-xs">
            <span>
              {formatDate(notification.createdAt, {
                isUnixTimestamp: true,
              })}
            </span>
            <Link
              to={
                viewEventUrl ??
                `https://primal.net/e/${String(notification.eventId)}`
              }
              target="_blank"
              rel="noreferrer"
              className="text-link hover:text-link-hover hover:underline"
            >
              Open on Nostr
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
