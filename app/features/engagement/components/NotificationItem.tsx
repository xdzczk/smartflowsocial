import type {
    Notification,
} from "~/features/engagement/engagement.server";
import { getTrustLevel, getTrustScoreBadgeColor } from "~/features/engagement/trustScore";
import { formatDate } from "~/lib/helpers";

import { useNotificationActions } from "../hooks/useNotificationActions";

import { ChildRepliesPanel } from "./ChildRepliesPanel";
import { NotificationActionButtons, type NotificationStats } from "./NotificationActionButtons";
import { QuoteInputPanel, ReplyInputPanel } from "./NotificationInputPanels";

interface NotificationItemProps {
    notification: Notification;
    userTimezone?: string;
    userRelays?: string[];
    trustScores?: Record<string, number>;
}

// Type badge configuration for each notification type
const TYPE_BADGES = {
    reply: {
        label: "replied",
        bgClass: "bg-blue-100 dark:bg-blue-900",
        textClass: "text-blue-800 dark:text-blue-200",
        icon: (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
            </svg>
        ),
    },
    mention: {
        label: "mentioned",
        bgClass: "bg-purple-100 dark:bg-purple-900",
        textClass: "text-purple-800 dark:text-purple-200",
        icon: (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M14.243 5.757a6 6 0 10-.986 9.284 1 1 0 111.087 1.678A8 8 0 1118 10a3 3 0 01-4.8 2.401A4 4 0 1114 10a1 1 0 102 0c0-1.537-.586-3.07-1.757-4.243zM12 10a2 2 0 10-4 0 2 2 0 004 0z" clipRule="evenodd" />
            </svg>
        ),
    },
    quote: {
        label: "quoted",
        bgClass: "bg-green-100 dark:bg-green-900",
        textClass: "text-green-800 dark:text-green-200",
        icon: (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
        ),
    },
};

export function NotificationItem({
    notification,
    userTimezone: _userTimezone,
    userRelays = ["wss://relay.primal.net"],
    trustScores = {},
}: NotificationItemProps) {
    const actions = useNotificationActions({
        notification: {
            eventId: notification.eventId,
            pubkey: notification.pubkey,
            content: notification.content,
        },
        userRelays,
    });

    const displayName =
        notification.authorName ||
        notification.pubkey.substring(0, 8) + "..." + notification.pubkey.slice(-4);

    // Get trust score for this user
    const trustScore = trustScores[notification.pubkey];
    const trustInfo = trustScore !== undefined ? getTrustLevel(trustScore) : null;
    const trustBadgeColor = trustScore !== undefined ? getTrustScoreBadgeColor(trustScore) : null;

    // Get type-specific badge configuration
    const typeBadge = TYPE_BADGES[notification.type as keyof typeof TYPE_BADGES] || TYPE_BADGES.reply;

    // Get stats (available on all notification types)
    const stats: NotificationStats | undefined = notification.stats;

    return (
        <div className="p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30">
            <div className="flex gap-2">
                {/* Author Avatar */}
                <div className="flex-shrink-0">
                    {notification.authorPicture ? (
                        <img
                            src={notification.authorPicture}
                            alt={displayName}
                            className="h-10 w-10 rounded-full"
                        />
                    ) : (
                        <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {/* Header */}
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {displayName}
                        </span>
                        {notification.authorNip05 ? (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                @{notification.authorNip05.split("@")[0]}
                            </span>
                        ) : null}
                        {trustInfo && trustBadgeColor ? (
                            <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${trustBadgeColor}`}
                                title={`Trust Score: ${trustScore} - ${trustInfo.description}`}
                            >
                                {trustInfo.level}
                            </span>
                        ) : null}
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium ${typeBadge.bgClass} ${typeBadge.textClass}`}>
                            {typeBadge.icon}
                            {typeBadge.label}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(new Date(notification.createdAt * 1000).toISOString())}
                        </span>
                    </div>

                    {/* Notification Content */}
                    <p className="mb-2 whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300">
                        {notification.content}
                    </p>

                    {/* Action Buttons */}
                    <NotificationActionButtons
                        eventId={notification.eventId}
                        stats={stats}
                        isReposting={actions.isReposting}
                        showChildReplies={actions.showChildReplies}
                        onLike={() => {
                            void actions.handleLike();
                        }}
                        onToggleReply={() => actions.setShowReplyInput(!actions.showReplyInput)}
                        onRepost={() => {
                            void actions.handleRepost();
                        }}
                        onToggleQuote={() => actions.setShowQuoteInput(!actions.showQuoteInput)}
                        onCopyNevent={() => {
                            void actions.copyNevent();
                        }}
                        onToggleChildReplies={() => actions.setShowChildReplies(!actions.showChildReplies)}
                    />

                    {/* Reply Input */}
                    {actions.showReplyInput ? (
                        <ReplyInputPanel
                            replyContent={actions.replyContent}
                            isReplying={actions.isReplying}
                            onContentChange={actions.setReplyContent}
                            onSubmit={() => {
                                void actions.handleReply();
                            }}
                            onCancel={() => {
                                actions.setShowReplyInput(false);
                                actions.setReplyContent("");
                            }}
                        />
                    ) : null}

                    {/* Quote Input */}
                    {actions.showQuoteInput ? (
                        <QuoteInputPanel
                            quoteContent={actions.quoteContent}
                            originalContent={notification.content ?? ""}
                            isQuoting={actions.isQuoting}
                            onContentChange={actions.setQuoteContent}
                            onSubmit={() => {
                                void actions.handleQuote();
                            }}
                            onCancel={() => {
                                actions.setShowQuoteInput(false);
                                actions.setQuoteContent("");
                            }}
                        />
                    ) : null}

                    {/* Child Replies */}
                    {actions.showChildReplies ? (
                        <ChildRepliesPanel
                            isLoading={actions.isLoadingReplies}
                            replies={actions.childReplies}
                            metadata={actions.childMetadata}
                        />
                    ) : null}

                    {/* Toast Notification */}
                    {actions.toast ? (
                        <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${actions.toast.type === "success" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}`}>
                            {actions.toast.message}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
