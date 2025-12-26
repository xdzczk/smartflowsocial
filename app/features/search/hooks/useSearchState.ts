import { useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";

interface User {
  timezone?: string | null;
}

interface SearchResultData {
  event?: {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    content: string;
    tags: string[][];
    mediaUrls?: string[];
  };
  stats?: {
    likes: number;
    replies: number;
    mentions: number;
    reposts: number;
    zaps: number;
    satszapped: number;
  };
  error?: string;
}

interface UseSearchStateProps {
  user: User | null;
  fetcherData: SearchResultData | null;
}

/**
 * Custom hook for managing search state and operations
 */
export function useSearchState({ user, fetcherData }: UseSearchStateProps) {
  const fetcher = useFetcher();
  const [eventInput, setEventInput] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const isSearching = fetcher.state !== "idle";
  const searchResult = fetcherData?.event;
  const searchStats = fetcherData?.stats;
  const searchError = fetcherData?.error;

  useEffect(() => {
    if (searchError) {
      setToast({
        type: "error",
        message: searchError,
      });
      setTimeout(() => setToast(null), 5000);
    }
  }, [searchError]);

  const handleSearch = (e: React.FormEvent) => {
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
    // Clear fetcher data by resetting the form
    fetcher.load("/dashboard/search/posts");
  };

  return {
    eventInput,
    toast,
    isSearching,
    searchResult,
    searchStats,
    fetcher,
    setEventInput,
    setToast,
    handleSearch,
    handleScheduleQuote,
    handleScheduleRepost,
    clearSearch,
  };
}

