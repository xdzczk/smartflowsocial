import { useFetcher, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";

import type { SignedEvent } from "~/features/nostr/types";
import type { PostData } from "~/features/posts/types";
import type {
  LookupLoaderErrorPayload,
  SearchLookupResolution,
} from "~/features/search";
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

function buildLookupSignedEventFromSearchEvent(e: {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
  tags: string[][];
}): SignedEvent {
  return {
    id: e.id,
    pubkey: e.pubkey,
    created_at: e.created_at,
    kind: e.kind,
    content: e.content,
    tags: e.tags,
    sig: "",
  };
}

interface UseSearchStateProps {
  /** Reserved for future (timezone-aware actions); currently unused. */
  user: User | null;
  /** Typically `validateSearchResultData(fetcher.data)` (may include `scheduleSourcePost`). */
  fetcherData: unknown;
  /** Result from loader when page was opened with ?q= (post viewer mode). */
  loaderSearchResult?: unknown;
}

/**
 * Custom hook for managing search state and operations.
 * When loaderSearchResult is provided (e.g. from ?q= in URL), it is used as the
 * current result when there is no fetcher data (post viewer mode).
 */
export function useSearchState({
  user: _user,
  fetcherData,
  loaderSearchResult = null,
}: UseSearchStateProps) {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [scheduleRepostQuote, setScheduleRepostQuote] = useState<{
    mode: "repost" | "quote";
    post: PostData | null;
    lookupSourceSignedEvent: SignedEvent | null;
  } | null>(null);

  const form = useZodForm(searchFormClientSchema, {
    defaultValues: {
      eventInput: "",
    },
  });

  const isSearching = fetcher.state !== "idle";
  const dataSource = (fetcherData ?? loaderSearchResult) as
    | SearchResultData
    | null
    | undefined;
  const searchResult = dataSource?.event;
  const searchStats = dataSource?.stats;
  const searchReplies = dataSource?.replies ?? [];
  const searchResolution = dataSource?.resolution ?? null;
  const searchLookupError = normalizeLookupError(dataSource?.error);
  const scheduleSourcePost: PostData | null = (() => {
    if (!dataSource || typeof dataSource !== "object") return null;
    const raw = (dataSource as Record<string, unknown>)["scheduleSourcePost"];
    if (raw == null) return null;
    return raw as PostData;
  })();

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
    const post = scheduleSourcePost;
    const lookupSourceSignedEvent = post
      ? null
      : buildLookupSignedEventFromSearchEvent(searchResult);
    setScheduleRepostQuote({ mode: "quote", post, lookupSourceSignedEvent });
  };

  const handleScheduleRepost = () => {
    if (!searchResult) return;
    const post = scheduleSourcePost;
    const lookupSourceSignedEvent = post
      ? null
      : buildLookupSignedEventFromSearchEvent(searchResult);
    setScheduleRepostQuote({ mode: "repost", post, lookupSourceSignedEvent });
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
    scheduleRepostQuote,
    dismissScheduleRepostQuote: () => setScheduleRepostQuote(null),
  };
}
