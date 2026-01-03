import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import {
  SearchForm,
  SearchResult,
  SearchToast,
  useSearchState,
  handleSearchAction,
  loadSearchData,
} from "~/features/search";
import { withCSRFProtection } from "~/lib/csrf.server";
export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const data = await loadSearchData(userId);
  return json(data);
}

export const action = withCSRFProtection(async ({ request }: ActionFunctionArgs) => {
  try {
    const formData = await request.formData();
    const _action = formData.get("_action");

    if (_action === "searchEvent") {
      const eventInput = formData.get("eventInput") as string;
      const result = await handleSearchAction(eventInput);
      return json(result);
    }

    const { ValidationError } = await import("~/lib/errors");
    throw new ValidationError("Invalid action", { action: _action });
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
});

export default function SearchPosts() {
  const { user } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const {
    eventInput,
    toast,
    isSearching,
    searchResult,
    searchStats,
    setEventInput,
    setToast,
    handleSearch,
    handleScheduleQuote,
    handleScheduleRepost,
    clearSearch,
  } = useSearchState({
    user,
    fetcherData:
      fetcher.data && typeof fetcher.data === "object"
        ? (fetcher.data as unknown as {
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
          })
        : null,
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-bold">Search Posts</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Search for any Nostr post by event ID, note1, or nevent1 format
        </p>
      </div>

      <SearchForm
        eventInput={eventInput}
        onInputChange={setEventInput}
        onSubmit={handleSearch}
        isSearching={isSearching}
      />

      {searchResult ? (
        <SearchResult
          result={
            searchResult && typeof searchResult === "object"
              ? (searchResult as unknown as {
                  id: string;
                  pubkey: string;
                  created_at: number;
                  kind: number;
                  content: string;
                  tags: string[][];
                  authorName: string;
                  authorImage: string | null;
                  mediaUrls: string[];
                })
              : ({
                  id: "",
                  pubkey: "",
                  created_at: 0,
                  kind: 0,
                  content: "",
                  tags: [],
                  authorName: "",
                  authorImage: null,
                  mediaUrls: [],
                } satisfies {
                  id: string;
                  pubkey: string;
                  created_at: number;
                  kind: number;
                  content: string;
                  tags: string[][];
                  authorName: string;
                  authorImage: string | null;
                  mediaUrls: string[];
                } as {
                  id: string;
                  pubkey: string;
                  created_at: number;
                  kind: number;
                  content: string;
                  tags: string[][];
                  authorName: string;
                  authorImage: string | null;
                  mediaUrls: string[];
                })
          }
          stats={
            searchStats && typeof searchStats === "object"
              ? (searchStats as unknown as {
                  likes: number;
                  replies: number;
                  mentions: number;
                  reposts: number;
                  zaps: number;
                  satszapped: number;
                })
              : null
          }
          onClear={clearSearch}
          onScheduleQuote={handleScheduleQuote}
          onScheduleRepost={handleScheduleRepost}
        />
      ) : null}

      <SearchToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
