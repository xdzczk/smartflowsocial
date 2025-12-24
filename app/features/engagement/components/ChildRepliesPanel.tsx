import { formatDate } from "~/lib/helpers";
import type { ChildReply } from "../hooks/useNotificationActions";

interface ChildRepliesPanelProps {
    isLoading: boolean;
    replies: ChildReply[];
    metadata: Record<string, any>;
}

export function ChildRepliesPanel({
    isLoading,
    replies,
    metadata,
}: ChildRepliesPanelProps) {
    if (isLoading) {
        return (
            <div className="mt-3 border-l-2 border-indigo-200 pl-3 dark:border-indigo-800">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading replies...
                </div>
            </div>
        );
    }

    if (replies.length === 0) {
        return (
            <div className="mt-3 border-l-2 border-indigo-200 pl-3 dark:border-indigo-800">
                <div className="text-xs text-gray-500 dark:text-gray-400">No replies yet</div>
            </div>
        );
    }

    return (
        <div className="mt-3 space-y-2 border-l-2 border-indigo-200 pl-3 dark:border-indigo-800">
            {replies.map((reply) => {
                const replyMetadata = metadata[reply.pubkey];
                let replyAuthorName = reply.pubkey.substring(0, 8) + "..." + reply.pubkey.slice(-4);
                let replyAuthorPicture = null;

                if (replyMetadata) {
                    try {
                        const profile = typeof replyMetadata.content === "string"
                            ? JSON.parse(replyMetadata.content)
                            : replyMetadata.content;
                        replyAuthorName = profile?.display_name || profile?.name || replyAuthorName;
                        replyAuthorPicture = profile?.picture;
                    } catch (e) {
                        // Ignore parsing errors
                    }
                }

                return (
                    <div key={reply.id} className="rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800/50">
                        <div className="mb-1 flex items-center gap-2">
                            {replyAuthorPicture ? (
                                <img src={replyAuthorPicture} alt={replyAuthorName} className="h-6 w-6 rounded-full" />
                            ) : (
                                <div className="h-6 w-6 rounded-full bg-gray-300 dark:bg-gray-600" />
                            )}
                            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{replyAuthorName}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDate(new Date(reply.created_at * 1000).toISOString())}
                            </span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-xs text-gray-700 dark:text-gray-300">
                            {reply.content}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}
