import { useFetcher, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";

import type {
  LookupLoaderErrorPayload,
  SearchLookupResolution,
} from "~/features/search";
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

interface SearchReplyItem {
  id: string;
  pubkey: string;
  created_at: number;
  content: string;
  authorName: string;
  authorImage: string | null;
  mediaUrls?: string[];
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
    authorName: string;
    authorImage: string | null;
  };
  stats?: {
    likes: number;
    replies: number;
    mentions: number;
    reposts: number;
    zaps: number;
    satszapped: number;
  };
  replies?: SearchReplyItem[];
  resolution?: SearchLookupResolution;
  error?: string | LookupLoaderErrorPayload;
}

function normalizeLookupError(
  raw: string | LookupLoaderErrorPayload | undefined
): LookupLoaderErrorPayload | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    return { code: "UNKNOWN", message: raw };
  }
  return raw;
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
  const searchReplies = dataSource?.replies ?? [];
  const searchResolution = dataSource?.resolution ?? null;
  const searchLookupError = normalizeLookupError(dataSource?.error);

  useEffect(() => {
    const err = dataSource?.error;
    if (err == null) return;
    if (typeof err === "object" && "code" in err) {
      return;
    }
    const message = typeof err === "string" ? err : String(err);
    setTimeout(() => {
      setToast({
        type: "error",
        message,
      });
      setTimeout(() => setToast(null), 5000);
    }, 0);
  }, [dataSource?.error]);

  const handleSearch = form.handleSubmit((data) => {
    const formData = formDataToFormData(data, "searchEvent");
    fetcher.submit(formData, { method: "post" });
  });

  const handleScheduleQuote = () => {
    if (!searchResult) return;

    const quotePostData = [
      {
        caption: "",
        fileUrl: searchResult.mediaUrls?.[0] ?? "",
        queueType: "unassigned",
        scheduledFor: "",
        originalPostId: null,
        originalEventId: searchResult.id,
        originalEventPubkey: searchResult.pubkey,
        isQuotePost: true,
        originalCaption: searchResult.content,
        isRecyclable: false,
      },
    ];

    sessionStorage.setItem("quotePostData", JSON.stringify(quotePostData));

    navigate("/dashboard/bulkposts?mode=quote", { replace: true });
  };

  const handleScheduleRepost = () => {
    if (!searchResult) return;

    const userTimezone = user?.timezone ?? "UTC";
    const now = nowInTimezone(userTimezone);
    const scheduleDateTime = addHours(now, 1);

    const scheduledRepostData = [
      {
        caption: "",
        fileUrl: "",
        queueType: "unassigned",
        scheduledFor: formatForDateTimeLocal(scheduleDateTime, userTimezone),
        originalPostId: null,
        originalEventId: searchResult.id,
        originalEventPubkey: searchResult.pubkey,
        isKind6Repost: true,
        originalFileUrl: searchResult.mediaUrls,
        originalCaption: searchResult.content,
        isRecyclable: false,
      },
    ];

    sessionStorage.setItem(
      "scheduledRepostData",
      JSON.stringify(scheduledRepostData)
    );

    navigate("/dashboard/bulkposts?mode=repost", { replace: true });
  };

  const clearSearch = () => {
    form.reset({ eventInput: "" });
    navigate("/dashboard/search/posts", { replace: true });
  };

  return {
    form,
    eventInput: form.watch("eventInput"),
    toast,
    isSearching,
    searchResult,
    searchStats,
    searchReplies,
    searchResolution,
    searchLookupError,
    fetcher,
    setToast,
    handleSearch,
    handleScheduleQuote,
    handleScheduleRepost,
    clearSearch,
  };
}
