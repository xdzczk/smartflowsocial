/**
 * Draft preview component
 */

import { getSelectedQueueStyle } from "../queueColors";
import type { PostData, QueueType } from "../types";
interface DraftPreviewProps {
  post: PostData;
  selectedQueue: string;
  queueTypes: QueueType[];
}

export function DraftPreview({
  post,
  selectedQueue,
  queueTypes,
}: DraftPreviewProps) {
  const getImageUrls = (fileUrl: string[] | null | undefined): string[] => {
    if (!fileUrl || fileUrl.length === 0) return [];

    if (typeof fileUrl[0] === "string" && fileUrl[0].startsWith("[")) {
      try {
        return JSON.parse(fileUrl[0]) as string[];
      } catch (e) {
        console.error("Error parsing fileUrl:", e);
        return [];
      }
    }

    return fileUrl;
  };

  const currentQueueType = queueTypes.find((qt) => {
    const queueName = typeof qt === "string" ? qt : qt.name;
    return queueName === selectedQueue;
  });
  const queueColor =
    typeof currentQueueType === "object" ? currentQueueType.color : null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Preview</h2>

      {/* Images */}
      {post.fileUrl && post.fileUrl.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {getImageUrls(post.fileUrl).map((url, index) => (
            <img
              key={index}
              src={url}
              alt={`Preview ${index + 1}`}
              className="h-32 w-full rounded-lg object-cover"
            />
          ))}
        </div>
      ) : null}

      {/* Post Type */}
      <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Post Type
          </span>
          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-300">
            {post.postType}
          </span>
        </div>
      </div>

      {/* Queue */}
      <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Current Queue
          </span>
          {queueColor ? (
            <div
              className="inline-flex rounded-full border-2 px-3 py-1 text-xs font-semibold leading-4 shadow-sm"
              style={{
                backgroundColor: `${queueColor}20`,
                color: queueColor,
                borderColor: queueColor,
              }}
            >
              {selectedQueue}
            </div>
          ) : (
            <div
              className={`inline-flex rounded-full border-2 px-3 py-1 text-xs font-semibold leading-4 ${getSelectedQueueStyle(selectedQueue, true).replace("hover:scale-105", "")} shadow-sm`}
            >
              {selectedQueue}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
