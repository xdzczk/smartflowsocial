import { Link } from "@remix-run/react";
import { nip19 } from "nostr-tools";
import { useState } from "react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { formatDate } from "~/lib/helpers";

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
  userTimezone,
  userRelays = ["wss://relay.primal.net"],
  trustScores = {},
}: GroupedNotificationListProps) {
  if (groupedNotifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="mb-4 text-gray-400">
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
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
          No notifications yet
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
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
  userTimezone,
  userRelays,
  trustScores = {},
}: {
  group: GroupedNotification;
  userTimezone?: string;
  userRelays?: string[];
  trustScores?: Record<string, number>;
}) {
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
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Forum-style layout: Parent post on left, replies on right */}
      <div className="flex flex-col lg:flex-row">
        {/* Parent Post - Left Side */}
        <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50 p-4 lg:w-2/5 lg:border-r lg:border-b-0 dark:border-gray-700 dark:bg-gray-900/50">
          <div className="mb-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span className="font-medium">Your post</span>
            {parentPost.postedAt ? (
              <span>· {formatDate(parentPost.postedAt)}</span>
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
                    <h4 className="mb-1 font-semibold text-gray-900 dark:text-gray-100">
                      {parentPost.title.length > 100
                        ? parentPost.title.substring(0, 100) + "..."
                        : parentPost.title}
                    </h4>
                  ) : null}
                  {parentPost.content ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {parentPost.content.length > 150
                        ? parentPost.content.substring(0, 150) + "..."
                        : parentPost.content}
                    </p>
                  ) : null}
                </>
              ) : (
                parentPost.caption && (
                  <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">
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
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  View original post →
                </Link>
                <button
                  onClick={() => {
                    void copyParentNevent();
                  }}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Copy NEvent
                </button>
              </div>
            </div>
          </div>

          {/* Toast for parent post */}
          {parentToast ? (
            <div
              className={`mt-2 rounded-lg px-3 py-2 text-xs ${parentToast.type === "success" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}`}
            >
              {parentToast.message}
            </div>
          ) : null}

          {/* Parent Post Stats */}
          {parentPost.stats ? (
            <div className="mt-4 flex flex-wrap gap-4 border-t border-gray-200 pt-3 dark:border-gray-700">
              <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                </svg>
                <span>{parentPost.stats.replies}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  {parentPost.stats.zaps > 0
                    ? `${parentPost.stats.satszapped.toLocaleString()}`
                    : "0"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{parentPost.stats.likes}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>{parentPost.stats.reposts}</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Notifications - Right Side */}
        <div className="flex-1 lg:w-3/5">
          <div className="bg-blue-50 px-4 py-2 dark:bg-blue-900/20">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
              {notifications.length}{" "}
              {notifications.length === 1 ? "reply" : "replies"} / mentions
            </span>
          </div>

          <div className="max-h-[500px] divide-y divide-gray-200 overflow-y-auto dark:divide-gray-700">
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
