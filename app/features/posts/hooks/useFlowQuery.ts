/**
 * Flow data hook for dashboard Flow view
 * Reads loader data, converts flow items to CombinedContent, and supports
 * scroll-triggered load more (fetchMorePast / fetchMoreFuture) with merge.
 */

import {
  useFetcher,
  useLoaderData,
  useRouteLoaderData,
  useSearchParams,
} from "@remix-run/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";

import { safeValidateLoaderResponse } from "~/lib/validation/loader-responses";
import {
  flowLoaderDataSchema,
  type FlowLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

import {
  postToCombinedContent,
  longFormPostToCombinedContent,
} from "../combined";
import { deserializePostDTO, deserializeLongFormPostDTO } from "../dtos.client";
import type { CombinedContent } from "../types";

function flowItemsToCombinedContent(
  items: FlowLoaderData["flowItems"]
): CombinedContent[] {
  return items.map((item) => {
    if (item.type === "post") {
      const postData = deserializePostDTO(
        item.data as unknown as Parameters<typeof deserializePostDTO>[0]
      );
      return postToCombinedContent(postData);
    }
    const longFormData = deserializeLongFormPostDTO(
      item.data as unknown as Parameters<typeof deserializeLongFormPostDTO>[0]
    );
    return longFormPostToCombinedContent(longFormData);
  });
}

export const flowKeys = {
  all: ["flow"] as const,
  list: (queueType?: string) => [...flowKeys.all, "list", queueType] as const,
};

/** Remix route ID for dashboard index (flow data); useRouteLoaderData(id) returns this route's loader data. */
const DASHBOARD_INDEX_ROUTE_ID = "routes/dashboard._index";

export interface UseFlowDataResult {
  flowItems: CombinedContent[];
  hasMorePast: boolean;
  hasMoreFuture: boolean;
  pastCursor: string | null;
  futureCursor: string | null;
  user: FlowLoaderData["user"];
  queueTypes: FlowLoaderData["queueTypes"];
  hashTagPresets: FlowLoaderData["hashTagPresets"];
  isLoading: boolean;
  isLoadingMorePast: boolean;
  isLoadingMoreFuture: boolean;
  error: Error | null;
  fetchMorePast: () => void;
  fetchMoreFuture: () => void;
}

export function useFlowData(): UseFlowDataResult {
  const [searchParams] = useSearchParams();
  const queueType = searchParams.get("queueType") ?? "all";

  // Prefer index route loader data so we get flowItems/pastCursor/hasMorePast (layout may not expose them)
  const indexLoaderData = useRouteLoaderData(DASHBOARD_INDEX_ROUTE_ID);
  const fallbackLoaderData = useLoaderData();
  const loaderDataRaw = indexLoaderData ?? fallbackLoaderData;
  const validatedLoaderData = safeValidateLoaderResponse(
    loaderDataRaw,
    flowLoaderDataSchema
  );

  const [flowItems, setFlowItems] = useState<CombinedContent[]>([]);
  const [hasMorePast, setHasMorePast] = useState(false);
  const [hasMoreFuture, setHasMoreFuture] = useState(false);
  const [pastCursor, setPastCursor] = useState<string | null>(null);
  const [futureCursor, setFutureCursor] = useState<string | null>(null);
  const [user, setUser] = useState<FlowLoaderData["user"]>(null);
  const [queueTypes, setQueueTypes] = useState<FlowLoaderData["queueTypes"]>(
    []
  );
  const [hashTagPresets, setHashTagPresets] = useState<
    FlowLoaderData["hashTagPresets"]
  >([]);

  const pastFetcher = useFetcher<FlowLoaderData>();
  const futureFetcher = useFetcher<FlowLoaderData>();
  const pastFetcherRef = useRef(pastFetcher);
  const futureFetcherRef = useRef(futureFetcher);
  /** Cursor we've sent for past; clear when response is processed to avoid duplicate requests */
  const pastSentinelInFlightRef = useRef<string | null>(null);
  const futureSentinelInFlightRef = useRef<string | null>(null);
  const flowItemsLengthRef = useRef(0);
  const lastSyncedQueueTypeRef = useRef(queueType);
  /** True after we've merged any load-more response; prevents revalidation from overwriting cursors (refs update sync, state in startTransition is deferred). */
  const hasMergedLoadMoreRef = useRef(false);

  useEffect(() => {
    flowItemsLengthRef.current = flowItems.length;
  }, [flowItems.length]);

  useEffect(() => {
    pastFetcherRef.current = pastFetcher;
    futureFetcherRef.current = futureFetcher;
  });

  // Sync from loader data (initial load or queueType change).
  // When revalidate() runs (e.g. every 60s), loader returns the initial window (no before/after) and would
  // overwrite our merged load-more state and reset pastCursor, causing the same before= request to repeat.
  // Skip overwriting flow items and cursors when we've already merged load-more and queue is unchanged.
  // Depend on loaderDataRaw (stable until loader revalidates), not validatedLoaderData, to avoid infinite
  // loop: safeValidateLoaderResponse returns a new object every render, so [validatedLoaderData] would
  // re-run this effect every time and cause "Maximum update depth exceeded".
  useEffect(() => {
    const validated = safeValidateLoaderResponse(
      loaderDataRaw,
      flowLoaderDataSchema
    );
    if (!validated) return;
    const queueUnchanged = lastSyncedQueueTypeRef.current === queueType;
    if (queueUnchanged && hasMergedLoadMoreRef.current) {
      startTransition(() => {
        setUser(validated.user);
        setQueueTypes(validated.queueTypes);
        setHashTagPresets(validated.hashTagPresets);
      });
      return;
    }
    lastSyncedQueueTypeRef.current = queueType;
    hasMergedLoadMoreRef.current = false;
    startTransition(() => {
      setFlowItems(flowItemsToCombinedContent(validated.flowItems));
      setHasMorePast(validated.hasMorePast);
      setHasMoreFuture(validated.hasMoreFuture);
      setPastCursor(validated.pastCursor);
      setFutureCursor(validated.futureCursor);
      setUser(validated.user);
      setQueueTypes(validated.queueTypes);
      setHashTagPresets(validated.hashTagPresets);
    });
  }, [loaderDataRaw, queueType]);

  // Merge past fetcher result when load more past completes.
  // Do not clear pastSentinelInFlightRef here: setPastCursor runs in startTransition
  // (deferred), so another effect can run with stale pastCursor and re-request the
  // same cursor. Keeping the ref blocks duplicate requests until state has updated.
  useEffect(() => {
    if (pastFetcher.state !== "idle" || !pastFetcher.data) return;
    const data = safeValidateLoaderResponse(
      pastFetcher.data,
      flowLoaderDataSchema
    );
    if (!data) {
      pastSentinelInFlightRef.current = null;
      return;
    }
    const sentCursor = pastSentinelInFlightRef.current;
    if (data.pastCursor !== null && data.pastCursor === sentCursor) {
      startTransition(() => setHasMorePast(false));
      pastSentinelInFlightRef.current = null;
      return;
    }
    if (data.flowItems.length === 0) {
      startTransition(() => setHasMorePast(false));
      return;
    }
    hasMergedLoadMoreRef.current = true;
    const newItems = flowItemsToCombinedContent(data.flowItems);
    startTransition(() => {
      setFlowItems((prev) => [...newItems, ...prev]);
      setHasMorePast(data.hasMorePast);
      if (data.pastCursor != null) setPastCursor(data.pastCursor);
    });
  }, [pastFetcher.state, pastFetcher.data]);

  // Merge future fetcher result when load more future completes.
  // Do not clear futureSentinelInFlightRef here (same reason as past).
  useEffect(() => {
    if (futureFetcher.state !== "idle" || !futureFetcher.data) return;
    const data = safeValidateLoaderResponse(
      futureFetcher.data,
      flowLoaderDataSchema
    );
    if (!data) {
      futureSentinelInFlightRef.current = null;
      return;
    }
    const sentCursor = futureSentinelInFlightRef.current;
    if (data.futureCursor !== null && data.futureCursor === sentCursor) {
      startTransition(() => setHasMoreFuture(false));
      futureSentinelInFlightRef.current = null;
      return;
    }
    if (data.flowItems.length === 0) {
      startTransition(() => setHasMoreFuture(false));
      return;
    }
    hasMergedLoadMoreRef.current = true;
    const newItems = flowItemsToCombinedContent(data.flowItems);
    startTransition(() => {
      setFlowItems((prev) => [...prev, ...newItems]);
      setHasMoreFuture(data.hasMoreFuture);
      if (data.futureCursor != null) setFutureCursor(data.futureCursor);
    });
  }, [futureFetcher.state, futureFetcher.data]);

  const fetchMorePast = useCallback(() => {
    if (pastFetcherRef.current.state !== "idle" || !pastCursor) return;
    if (pastSentinelInFlightRef.current === pastCursor) return;
    pastSentinelInFlightRef.current = pastCursor;
    hasMergedLoadMoreRef.current = true;
    const params = new URLSearchParams();
    params.set("_data", "routes/dashboard._index");
    if (queueType !== "all") params.set("queueType", queueType);
    params.set("before", pastCursor);
    pastFetcherRef.current.load(`/dashboard?${params.toString()}`);
  }, [pastCursor, queueType]);

  const fetchMoreFuture = useCallback(() => {
    if (futureFetcherRef.current.state !== "idle" || !futureCursor) return;
    if (futureSentinelInFlightRef.current === futureCursor) return;
    futureSentinelInFlightRef.current = futureCursor;
    hasMergedLoadMoreRef.current = true;
    const params = new URLSearchParams();
    params.set("_data", "routes/dashboard._index");
    if (queueType !== "all") params.set("queueType", queueType);
    params.set("after", futureCursor);
    futureFetcherRef.current.load(`/dashboard?${params.toString()}`);
  }, [futureCursor, queueType]);

  const isLoading =
    pastFetcher.state === "loading" || futureFetcher.state === "loading";
  const isLoadingMorePast = pastFetcher.state === "loading";
  const isLoadingMoreFuture = futureFetcher.state === "loading";
  const error = validatedLoaderData
    ? null
    : new Error("Invalid flow loader data");

  return {
    flowItems,
    hasMorePast,
    hasMoreFuture,
    pastCursor,
    futureCursor,
    user,
    queueTypes,
    hashTagPresets,
    isLoading,
    isLoadingMorePast,
    isLoadingMoreFuture,
    error,
    fetchMorePast,
    fetchMoreFuture,
  };
}
