import { useFetcher, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";

import {
  addHours,
  formatForDateTimeLocal,
  nowInTimezone,
} from "~/lib/temporal";
import { searchFormClientSchema } from "~/lib/validation";
import { useZodForm, formDataToFormData } from "~/lib/validation/utils.client";
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
  /** Result from loader when page was opened with ?q= (post viewer mode) */
  loaderSearchResult?: SearchResultData | null;
}

/**
 * Custom hook for managing search state and operations.
 * When loaderSearchResult is provided (e.g. from ?q= in URL), it is used as the
 * current result when there is no fetcher data (post viewer mode).
 */
export function useSearchState({
  user,
  fetcherData,
  loaderSearchResult = null,
}: UseSearchStateProps) {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const form = useZodForm(searchFormClientSchema, {
    defaultValues: {
      eventInput: "",
    },
  });

  const isSearching = fetcher.state !== "idle";
  const dataSource = fetcherData ?? loaderSearchResult;
  const searchResult = dataSource?.event;
  const searchStats = dataSource?.stats;
  const searchError = dataSource?.error;

  useEffect(() => {
    if (searchError) {
      // Defer to avoid cascading renders
      setTimeout(() => {
        setToast({
          type: "error",
          message: searchError,
        });
        setTimeout(() => setToast(null), 5000);
      }, 0);
    }
  }, [searchError]);

  const handleSearch = form.handleSubmit((data) => {
    const formData = formDataToFormData(data, "searchEvent");
    fetcher.submit(formData, { method: "post" });
  });

  const handleScheduleQuote = () => {
    if (!searchResult) return;

    // Prepare quote post data
    const quotePostData = [
      {
        caption: "", // Empty caption - user can add content
        fileUrl: searchResult.mediaUrls?.[0] ?? "",
        queueType: "unassigned",
        scheduledFor: "",
        originalPostId: null, // No local post ID for external events
        originalEventId: searchResult.id,
        originalEventPubkey: searchResult.pubkey,
        isQuotePost: true,
        originalCaption: searchResult.content,
        isRecyclable: false,
      },
    ];

    // Store in sessionStorage
    sessionStorage.setItem("quotePostData", JSON.stringify(quotePostData));

    // Navigate to bulk posts page with quote mode
    navigate("/dashboard/bulkposts?mode=quote", { replace: true });
  };

  const handleScheduleRepost = () => {
    if (!searchResult) return;

    // Prepare scheduled repost data (kind 6)
    const userTimezone = user?.timezone ?? "UTC";
    const now = nowInTimezone(userTimezone);
    const scheduleDateTime = addHours(now, 1);

    const scheduledRepostData = [
      {
        caption: "", // Empty content for kind 6 reposts
        fileUrl: "", // No file URL for kind 6 reposts
        queueType: "unassigned",
        scheduledFor: formatForDateTimeLocal(scheduleDateTime, userTimezone),
        originalPostId: null, // No local post ID for external events
        originalEventId: searchResult.id,
        originalEventPubkey: searchResult.pubkey,
        isKind6Repost: true,
        originalFileUrl: searchResult.mediaUrls,
        originalCaption: searchResult.content,
        isRecyclable: false,
      },
    ];

    // Store in sessionStorage
    sessionStorage.setItem(
      "scheduledRepostData",
      JSON.stringify(scheduledRepostData)
    );

    // Navigate to bulk posts page with repost mode
    navigate("/dashboard/bulkposts?mode=repost", { replace: true });
  };

  const clearSearch = () => {
    form.reset({ eventInput: "" });
    // Navigate to same page without q so loader returns no result (post viewer → empty state)
    navigate("/dashboard/search/posts", { replace: true });
  };

  return {
    form,
    eventInput: form.watch("eventInput"),
    toast,
    isSearching,
    searchResult,
    searchStats,
    fetcher,
    setToast,
    handleSearch,
    handleScheduleQuote,
    handleScheduleRepost,
    clearSearch,
  };
}
