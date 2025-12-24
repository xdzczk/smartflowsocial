import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { nip19 } from "nostr-tools";
import { useState, useEffect } from "react";

import { requireUserId } from "~/features/auth/session.server";
import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import { formatDate, getImageUrls } from "~/lib/helpers";
import { getUserById } from "~/models/user.server";

export async function loader({ request }) {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);

  return json({ user });
}

export async function action({ request }) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const _action = formData.get("_action");

  if (_action === "searchEvent") {
    const eventInput = formData.get("eventInput");

    if (!eventInput || eventInput.trim() === "") {
      return json({ error: "Please enter an event ID or nevent1" }, { status: 400 });
    }

    try {
      let eventId = eventInput.trim();

      // Check if input is in nevent1 format
      if (eventId.startsWith("nevent1")) {
        try {
          const decoded = nip19.decode(eventId);
          if (decoded.type === "nevent" && decoded.data) {
            eventId = decoded.data.id;
          }
        } catch (e) {
          return json({ error: "Invalid nevent1 format" }, { status: 400 });
        }
      } else if (eventId.startsWith("nostr:nevent1")) {
        try {
          const decoded = nip19.decode(eventId.replace("nostr:", ""));
          if (decoded.type === "nevent" && decoded.data) {
            eventId = decoded.data.id;
          }
        } catch (e) {
          return json({ error: "Invalid nevent1 format" }, { status: 400 });
        }
      } else if (eventId.startsWith("note1")) {
        try {
          const decoded = nip19.decode(eventId);
          if (decoded.type === "note") {
            eventId = decoded.data;
          }
        } catch (e) {
          return json({ error: "Invalid note1 format" }, { status: 400 });
        }
      }

      // Validate hex format (64 character hex string)
      if (!/^[a-f0-9]{64}$/i.test(eventId)) {
        return json(
          { error: "Invalid event ID format. Must be a 64-character hex string, note1, or nevent1" },
          { status: 400 }
        );
      }

      // Fetch event from Primal cache
      const responses = await connectToPrimalCache("events", {
        event_ids: [eventId],
      });

      // Find the EVENT response
      const eventResponse = responses?.find(
        (res) => Array.isArray(res) && res[0] === "EVENT" && res[2]
      );

      if (!eventResponse || !eventResponse[2]) {
        return json(
          { error: "Event not found. Please check the event ID and try again." },
          { status: 404 }
        );
      }

      const event = eventResponse[2];

      // Fetch author profile info
      let authorName = event.pubkey.substring(0, 8) + "...";
      let authorImage = null;

      try {
        const userInfoResponses = await connectToPrimalCache("user_infos", {
          pubkeys: [event.pubkey],
        });

        const userMetadataEvent = userInfoResponses?.find(
          (res) =>
            Array.isArray(res) &&
            res[0] === "EVENT" &&
            res[2] &&
            res[2].kind === 0 &&
            res[2].pubkey === event.pubkey
        );

        if (userMetadataEvent && userMetadataEvent[2]) {
          const metadata = JSON.parse(userMetadataEvent[2].content);
          authorName = metadata.name || metadata.display_name || authorName;
          authorImage = metadata.picture || null;
        }
      } catch (error) {
        console.error("[Search] Error fetching author info:", error);
      }

      // Fetch engagement stats
      let stats = {
        likes: 0,
        replies: 0,
        mentions: 0,
        reposts: 0,
        zaps: 0,
        satszapped: 0,
      };

      try {
        const threadResponses = await connectToPrimalCache("thread_view", {
          event_id: eventId,
        });

        const statsEvent = threadResponses?.find(
          (res) =>
            Array.isArray(res) &&
            res[0] === "EVENT" &&
            res[2] &&
            res[2].kind === 10000100 &&
            res[2].content &&
            res[2].content.includes(eventId)
        );

        if (statsEvent && statsEvent[2]) {
          const content = JSON.parse(statsEvent[2].content);
          stats = {
            likes: content.likes || 0,
            replies: content.replies || 0,
            mentions: content.mentions || 0,
            reposts: content.reposts || 0,
            zaps: content.zaps || 0,
            satszapped: content.satszapped || 0,
          };
        }
      } catch (error) {
        console.error("[Search] Error fetching stats:", error);
      }

      // Extract media URLs from content
      const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|mp4|webm|mov))/gi;
      const mediaUrls = event.content.match(urlRegex) || [];

      return json({
        success: true,
        event: {
          id: event.id,
          pubkey: event.pubkey,
          created_at: event.created_at,
          kind: event.kind,
          content: event.content,
          tags: event.tags,
          authorName,
          authorImage,
          mediaUrls,
        },
        stats,
      });
    } catch (error) {
      console.error("[Search] Error:", error);
      return json(
        { error: `Failed to fetch event: ${error.message}` },
        { status: 500 }
      );
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

export default function SearchPosts() {
  const { user } = useLoaderData();
  const fetcher = useFetcher();
  const [eventInput, setEventInput] = useState("");
  const [toast, setToast] = useState(null);

  const isSearching = fetcher.state !== "idle";
  const searchResult = fetcher.data?.event;
  const searchStats = fetcher.data?.stats;
  const searchError = fetcher.data?.error;

  useEffect(() => {
    if (searchError) {
      setToast({
        type: "error",
        message: searchError,
      });
      setTimeout(() => setToast(null), 5000);
    }
  }, [searchError]);

  const handleSearch = (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("_action", "searchEvent");
    formData.append("eventInput", eventInput);
    fetcher.submit(formData, { method: "post" });
  };

  const handleScheduleQuote = () => {
    if (!searchResult) return;

    // Prepare quote post data
    const quotePostData = [
      {
        caption: "", // Empty caption - user can add content
        fileUrl: searchResult.mediaUrls?.[0] || "",
        queueType: "unassigned",
        scheduledFor: "",
        originalPostId: null, // No local post ID for external events
        originalEventId: searchResult.id,
        originalEventPubkey: searchResult.pubkey,
        isQuotePost: true,
        originalCaption: searchResult.content || "",
        isRecyclable: false,
      },
    ];

    // Store in sessionStorage
    sessionStorage.setItem("quotePostData", JSON.stringify(quotePostData));

    // Navigate to bulk posts page with quote mode
    window.location.href = "/dashboard/bulkposts?mode=quote";
  };

  const handleScheduleRepost = () => {
    if (!searchResult) return;

    // Prepare scheduled repost data (kind 6)
    const now = new Date();
    const userTimezone = user?.timezone || "UTC";
    const localDate = new Date(
      now.toLocaleString("en-US", { timeZone: userTimezone })
    );
    localDate.setHours(localDate.getHours() + 1);

    const scheduledRepostData = [
      {
        caption: "", // Empty content for kind 6 reposts
        fileUrl: "", // No file URL for kind 6 reposts
        queueType: "unassigned",
        scheduledFor: localDate
          .toLocaleString("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
          .replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+)/, "$3-$1-$2T$4:$5"),
        originalPostId: null, // No local post ID for external events
        originalEventId: searchResult.id,
        originalEventPubkey: searchResult.pubkey,
        isKind6Repost: true,
        originalFileUrl: searchResult.mediaUrls || [],
        originalCaption: searchResult.content || "",
        isRecyclable: false,
      },
    ];

    // Store in sessionStorage
    sessionStorage.setItem(
      "scheduledRepostData",
      JSON.stringify(scheduledRepostData)
    );

    // Navigate to bulk posts page with repost mode
    window.location.href = "/dashboard/bulkposts?mode=repost";
  };

  const clearSearch = () => {
    setEventInput("");
    fetcher.data = null;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-bold">Search Posts</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Search for any Nostr post by event ID, note1, or nevent1 format
        </p>
      </div>

      {/* Search Form */}
      <div className="mb-6">
        <fetcher.Form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1">
            <input
              type="text"
              value={eventInput}
              onChange={(e) => setEventInput(e.target.value)}
              placeholder="Enter event ID (hex), note1, or nevent1..."
              className="block w-full rounded-lg border border-gray-200 px-4 py-3 text-sm leading-6 placeholder-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-500/50 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
              disabled={isSearching}
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !eventInput.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-700 bg-blue-700 px-6 py-3 text-sm font-semibold leading-5 text-white hover:border-blue-600 hover:bg-blue-600 hover:text-white focus:ring focus:ring-blue-400/50 active:border-blue-700 active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSearching ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Searching...
              </>
            ) : (
              <>
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
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                Search
              </>
            )}
          </button>
        </fetcher.Form>

        {/* Format hints */}
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          <p className="mb-1">Supported formats:</p>
          <ul className="ml-4 list-disc space-y-0.5">
            <li>Hex event ID: 64-character hex string</li>
            <li>note1: Bech32-encoded note ID</li>
            <li>nevent1: Bech32-encoded event with relay hints</li>
          </ul>
        </div>
      </div>

      {/* Search Result */}
      {searchResult ? <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        {/* Clear button */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Search Result</h2>
          <button
            onClick={clearSearch}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Clear
          </button>
        </div>

        {/* Author Info */}
        <div className="mb-4 flex items-center gap-3">
          {searchResult.authorImage ? (
            <img
              src={searchResult.authorImage}
              alt={searchResult.authorName}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-300">
              <svg
                className="h-6 w-6"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
          <div>
            <p className="font-semibold">{searchResult.authorName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatDate(searchResult.created_at * 1000)} " Kind{" "}
              {searchResult.kind}
            </p>
          </div>
        </div>

        {/* Media Preview */}
        {searchResult.mediaUrls && searchResult.mediaUrls.length > 0 ? <div className="mb-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {searchResult.mediaUrls.slice(0, 6).map((url, index) => (
              <img
                key={index}
                src={url}
                alt={`Media ${index + 1}`}
                className="h-32 w-full rounded object-cover"
              />
            ))}
          </div>
          {searchResult.mediaUrls.length > 6 ? <p className="mt-2 text-xs text-gray-500">
            +{searchResult.mediaUrls.length - 6} more media files
          </p> : null}
        </div> : null}

        {/* Content */}
        <div className="mb-4">
          <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
            {searchResult.content}
          </p>
        </div>

        {/* Engagement Stats */}
        {searchStats ? <div className="mb-4 grid grid-cols-3 gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-900 md:grid-cols-6">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Likes
            </p>
            <p className="text-lg font-semibold">{searchStats.likes}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Replies
            </p>
            <p className="text-lg font-semibold">{searchStats.replies}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Reposts
            </p>
            <p className="text-lg font-semibold">{searchStats.reposts}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Zaps
            </p>
            <p className="text-lg font-semibold">{searchStats.zaps}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Mentions
            </p>
            <p className="text-lg font-semibold">{searchStats.mentions}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Sats
            </p>
            <p className="text-lg font-semibold">
              {searchStats.satszapped}
            </p>
          </div>
        </div> : null}

        {/* Event ID */}
        <div className="mb-4">
          <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
            Event ID:
          </p>
          <code className="block rounded bg-gray-100 p-2 text-xs dark:bg-gray-900">
            {searchResult.id}
          </code>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleScheduleQuote}
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
            onClick={handleScheduleRepost}
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
            href={`https://primal.net/e/${searchResult.id}`}
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
      </div> : null}

      {/* Toast Notification */}
      {toast ? <div className="fixed bottom-4 right-4 z-50">
        <div
          className={`rounded-lg px-4 py-3 text-white shadow-lg ${toast.type === "success" ? "bg-green-500" : "bg-red-500"
            }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === "success" ? (
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-white/80 hover:text-white"
            >
              <svg
                className="h-4 w-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </div> : null}
    </div>
  );
}
