import { Link } from "@remix-run/react";

import { formatDate } from "~/lib/helpers";

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
          <svg
            className="h-16 w-16"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
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
  const displayName =
    notification.authorName ??
    notification.pubkey.substring(0, 8) + "..." + notification.pubkey.slice(-4);

  return (
    <div className="hover:bg-muted dark:bg-card dark:hover:bg-muted/50 bg-white p-4 transition-colors">
      <div className="flex gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className="bg-muted dark:bg-muted flex h-8 w-8 items-center justify-center rounded-full">
            <svg
              className="text-muted-foreground h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
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
              {formatDate(
                new Date(notification.createdAt * 1000).toISOString()
              )}
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
            <svg
              className="dark:text-foreground h-4 w-4 text-yellow-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
            </svg>
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
              {formatDate(
                new Date(notification.createdAt * 1000).toISOString()
              )}
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
  const displayName =
    notification.authorName ??
    notification.pubkey.substring(0, 8) + "..." + notification.pubkey.slice(-4);

  return (
    <div className="hover:bg-muted dark:bg-card dark:hover:bg-muted/50 bg-white p-4 transition-colors">
      <div className="flex gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
            <svg
              className="text-foreground h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
              />
            </svg>
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
              {formatDate(
                new Date(notification.createdAt * 1000).toISOString()
              )}
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
