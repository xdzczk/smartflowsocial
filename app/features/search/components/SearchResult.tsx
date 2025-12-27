/**
 * Search result component
 */

import { formatDate } from "~/lib/helpers";
interface SearchResultData {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
  tags: string[][];
  authorName: string;
  authorImage: string | null;
  mediaUrls: string[];
}

interface SearchStats {
  likes: number;
  replies: number;
  mentions: number;
  reposts: number;
  zaps: number;
  satszapped: number;
}

interface SearchResultProps {
  result: SearchResultData;
  stats: SearchStats | null;
  onClear: () => void;
  onScheduleQuote: () => void;
  onScheduleRepost: () => void;
}

export function SearchResult({
  result,
  stats,
  onClear,
  onScheduleQuote,
  onScheduleRepost,
}: SearchResultProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      {/* Clear button */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Search Result</h2>
        <button
          onClick={onClear}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          Clear
        </button>
      </div>

      {/* Author Info */}
      <div className="mb-4 flex items-center gap-3">
        {result.authorImage ? (
          <img
            src={result.authorImage}
            alt={result.authorName}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-300">
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
        <div>
          <p className="font-semibold">{result.authorName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatDate(new Date(result.created_at * 1000))} • Kind {result.kind}
          </p>
        </div>
      </div>

      {/* Media Preview */}
      {result.mediaUrls && result.mediaUrls.length > 0 ? (
        <div className="mb-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {result.mediaUrls.slice(0, 6).map((url, index) => (
              <img
                key={index}
                src={url}
                alt={`Media ${index + 1}`}
                className="h-32 w-full rounded object-cover"
              />
            ))}
          </div>
          {result.mediaUrls.length > 6 ? (
            <p className="mt-2 text-xs text-gray-500">
              +{result.mediaUrls.length - 6} more media files
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Content */}
      <div className="mb-4">
        <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
          {result.content}
        </p>
      </div>

      {/* Engagement Stats */}
      {stats ? (
        <div className="mb-4 grid grid-cols-3 gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-900 md:grid-cols-6">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Likes</p>
            <p className="text-lg font-semibold">{stats.likes}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Replies</p>
            <p className="text-lg font-semibold">{stats.replies}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Reposts</p>
            <p className="text-lg font-semibold">{stats.reposts}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Zaps</p>
            <p className="text-lg font-semibold">{stats.zaps}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Mentions</p>
            <p className="text-lg font-semibold">{stats.mentions}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Sats</p>
            <p className="text-lg font-semibold">{stats.satszapped}</p>
          </div>
        </div>
      ) : null}

      {/* Event ID */}
      <div className="mb-4">
        <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
          Event ID:
        </p>
        <code className="block rounded bg-gray-100 p-2 text-xs dark:bg-gray-900">
          {result.id}
        </code>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onScheduleQuote}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-4 py-2 text-sm font-semibold leading-5 text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
        >
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
              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
            />
          </svg>
          Schedule Quote Post
        </button>

        <button
          onClick={onScheduleRepost}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-4 py-2 text-sm font-semibold leading-5 text-purple-800 hover:border-purple-300 hover:text-purple-900 hover:shadow-sm focus:ring focus:ring-purple-300/25 active:border-purple-200 active:shadow-none dark:border-purple-700 dark:bg-gray-800 dark:text-purple-300 dark:hover:border-purple-600 dark:hover:text-purple-200 dark:focus:ring-purple-600/40 dark:active:border-purple-700"
        >
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
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          Schedule Repost (Kind 6)
        </button>

        <a
          href={`https://primal.net/e/${result.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold leading-5 text-gray-800 hover:border-gray-300 hover:text-gray-900 hover:shadow-sm focus:ring focus:ring-gray-300/25 active:border-gray-200 active:shadow-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-200 dark:focus:ring-gray-600/40 dark:active:border-gray-700"
        >
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
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
          View on Primal
        </a>
      </div>
    </div>
  );
}

