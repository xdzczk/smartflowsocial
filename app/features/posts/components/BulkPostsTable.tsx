import MediaThumbnail from "~/components/ui/MediaThumbnail";
import type { BulkPost, QueueType } from "~/features/posts/components/BulkPostCard";
import { getDynamicQueueStyle } from "~/features/posts/queueColors";

interface BulkPostsTableProps {
    posts: BulkPost[];
    queueTypes: QueueType[];
    previewData: Map<number, { url: string; isVideo: boolean; file: File }>;
    handleCaptionChange: (index: number, value: string) => void;
    handleDateChange: (index: number, value: string) => void;
    handleIsRecyclableChange: (index: number, checked: boolean) => void;
    handleRemovePost: (index: number) => void;
    handleQueueTypeChange: (index: number, value: string) => void;
    handleMediaClick: (mediaSrc: string) => void;
}

export default function BulkPostsTable({
    posts,
    queueTypes,
    previewData,
    handleCaptionChange,
    handleDateChange,
    handleIsRecyclableChange,
    handleRemovePost,
    handleQueueTypeChange,
    handleMediaClick,
}: BulkPostsTableProps) {
    if (posts.length === 0) return null;

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b">
                        <th className="p-4 text-left">Media</th>
                        <th className="p-4 text-left">Caption</th>
                        <th className="p-4 text-left">Queue</th>
                        <th className="p-4 text-left">Schedule</th>
                        <th className="p-4 text-left">Recyclable</th>
                        <th className="p-4 text-left">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {posts.map((post, index) => (
                        <tr key={index} className="border-b">
                            <td className="p-4">
                                {(() => {
                                    let imageUrl = "";

                                    if (post.isKind6Repost) {
                                        // For kind 6 reposts, check if original post has images
                                        if (
                                            post.originalFileUrl &&
                                            post.originalFileUrl.length > 0
                                        ) {
                                            // Try to get the first image URL from the original post
                                            let originalImageUrl = "";

                                            if (Array.isArray(post.originalFileUrl)) {
                                                originalImageUrl = post.originalFileUrl[0];
                                            } else {
                                                originalImageUrl = post.originalFileUrl;
                                            }

                                            // Handle case where fileUrl might be a JSON string array
                                            if (
                                                typeof originalImageUrl === "string" &&
                                                originalImageUrl.startsWith("[")
                                            ) {
                                                try {
                                                    const parsed = JSON.parse(originalImageUrl) as string[];
                                                    if (
                                                        Array.isArray(parsed) &&
                                                        parsed.length > 0
                                                    ) {
                                                        originalImageUrl = parsed[0];
                                                    }
                                                } catch (_e) {
                                                    // If parsing fails, use as is
                                                }
                                            }

                                            return (
                                                <div className="relative">
                                                    <MediaThumbnail
                                                        src={originalImageUrl}
                                                        alt="Original post preview"
                                                        className="h-24 w-24 rounded object-cover"
                                                        onClick={() =>
                                                            handleMediaClick(originalImageUrl)
                                                        }
                                                    />
                                                    <div className="absolute -right-1 -top-1 rounded-full bg-purple-500 p-1">
                                                        <svg
                                                            className="h-3 w-3 text-white"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                                                            />
                                                        </svg>
                                                    </div>
                                                </div>
                                            );
                                        } else {
                                            // Show REPOST placeholder for text-only reposts
                                            return (
                                                <div className="flex h-24 w-24 items-center justify-center rounded bg-purple-200 text-xs font-medium text-purple-800 dark:bg-purple-800 dark:text-purple-200">
                                                    REPOST
                                                </div>
                                            );
                                        }
                                    } else if (post.isQuotePost) {
                                        // Handle quote posts - always show image if available
                                        if (post.fileUrl && post.fileUrl.trim() !== "") {
                                            let fileUrl = "";
                                            if (Array.isArray(post.fileUrl)) {
                                                fileUrl = typeof post.fileUrl[0] === "string" ? post.fileUrl[0] : "";
                                            } else {
                                                fileUrl = typeof post.fileUrl === "string" ? post.fileUrl : "";
                                            }

                                            return (
                                                <div className="relative">
                                                    <MediaThumbnail
                                                        src={fileUrl}
                                                        alt="Quote post preview"
                                                        className="h-24 w-24 rounded object-cover"
                                                        onClick={() =>
                                                            handleMediaClick(fileUrl)
                                                        }
                                                    />
                                                    <div className="absolute -right-1 -top-1 rounded-full bg-green-500 p-1">
                                                        <svg
                                                            className="h-3 w-3 text-white"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                                                            />
                                                        </svg>
                                                    </div>
                                                </div>
                                            );
                                        } else {
                                            // Show QUOTE placeholder for text-only quote posts
                                            return (
                                                <div className="flex h-24 w-24 items-center justify-center rounded bg-green-200 text-xs font-medium text-green-800 dark:bg-green-800 dark:text-green-200">
                                                    QUOTE
                                                </div>
                                            );
                                        }
                                    } else if (post.isRepost && post.fileUrl) {
                                        // Handle repost fileUrl which should now be a single URL string
                                        if (Array.isArray(post.fileUrl)) {
                                            imageUrl = typeof post.fileUrl[0] === "string" ? post.fileUrl[0] : "";
                                        } else {
                                            imageUrl = typeof post.fileUrl === "string" ? post.fileUrl : "";
                                        }
                                    } else if (post.file) {
                                        // Handle regular file uploads - use previewData which includes type info
                                        const previewInfo = previewData.get(index);
                                        if (previewInfo) {
                                            return (
                                                <MediaThumbnail
                                                    src={previewInfo.url}
                                                    alt="Preview"
                                                    className="h-24 w-24 rounded object-cover"
                                                    onClick={() =>
                                                        handleMediaClick(previewInfo.url)
                                                    }
                                                    forceType={
                                                        previewInfo.isVideo ? "video" : "image"
                                                    }
                                                />
                                            );
                                        }
                                    }

                                    // Fallback for repost with fileUrl
                                    if (imageUrl && imageUrl.trim() !== "") {
                                        return (
                                            <MediaThumbnail
                                                src={imageUrl}
                                                alt="Preview"
                                                className="h-24 w-24 rounded object-cover"
                                                onClick={() => handleMediaClick(imageUrl)}
                                            />
                                        );
                                    } else {
                                        // Show TEXT placeholder for text-only posts
                                        return (
                                            <div className="flex h-24 w-24 items-center justify-center rounded bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                                TEXT
                                            </div>
                                        );
                                    }
                                })()}
                                <input type="file" name="files" hidden />
                            </td>
                            <td className="p-4">
                                <div className="space-y-2">
                                    <textarea
                                        name="captions"
                                        value={post.caption}
                                        onChange={(e) =>
                                            handleCaptionChange(index, e.target.value)
                                        }
                                        disabled={post.isKind6Repost}
                                        className={`w-full rounded-lg border p-2 text-gray-900 dark:bg-gray-800 dark:text-gray-100 ${post.isKind6Repost ? "cursor-not-allowed bg-gray-100 dark:bg-gray-700" : ""}`}
                                        rows={3}
                                        placeholder={
                                            post.isKind6Repost
                                                ? "Kind 6 reposts have no content..."
                                                : post.isQuotePost
                                                    ? "Add your comment to this quote post..."
                                                    : "Write your caption..."
                                        }
                                    />
                                    {(post.isKind6Repost || post.isQuotePost) &&
                                        post.originalCaption ? (
                                        <div className="rounded border bg-gray-50 p-2 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                            <strong>Original:</strong>{" "}
                                            {post.originalCaption.length > 100
                                                ? post.originalCaption.substring(0, 100) + "..."
                                                : post.originalCaption}
                                        </div>
                                    ) : null}
                                </div>
                            </td>
                            <td className="p-4">
                                <div className="flex flex-wrap gap-1">
                                    {queueTypes.map((queue) => {
                                        const queueName =
                                            typeof queue === "string" ? queue : (queue.name || "");
                                        const queueColor =
                                            typeof queue === "object" ? queue.color : null;
                                        return (
                                            <button
                                                key={queueName}
                                                type="button"
                                                onClick={() => {
                                                    handleQueueTypeChange(index, queueName ?? "");
                                                }}
                                                className={`rounded-full px-3 py-1 text-xs ${getDynamicQueueStyle(queueColor ?? null, post.queueType === queueName)}`}
                                                style={{
                                                    backgroundColor: queueColor || undefined,
                                                    borderColor: queueColor || undefined,
                                                }}
                                            >
                                                {queueName}
                                            </button>
                                        );
                                    })}
                                </div>
                            </td>
                            <td className="p-4">
                                <input
                                    type="datetime-local"
                                    name="scheduledDates"
                                    value={post.scheduledFor}
                                    onChange={(e) =>
                                        handleDateChange(index, e.target.value)
                                    }
                                    className="rounded-lg border p-2 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                                />
                            </td>
                            <td className="p-4">
                                <div className="flex items-center">
                                    <input
                                        id={`bulk-recyclable-${index}`}
                                        type="checkbox"
                                        checked={post.isRecyclable || false}
                                        onChange={(e) =>
                                            handleIsRecyclableChange(index, e.target.checked)
                                        }
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <label htmlFor={`bulk-recyclable-${index}`} className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                        Recyclable
                                    </label>
                                </div>
                            </td>
                            <td className="p-4">
                                <button
                                    type="button"
                                    onClick={() => handleRemovePost(index)}
                                    className="rounded bg-red-500 px-3 py-1 text-white hover:bg-red-600"
                                >
                                    Remove
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
