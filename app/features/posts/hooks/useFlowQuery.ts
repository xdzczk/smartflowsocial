/**
 * Flow data hook for dashboard Flow view
 * Reads loader data, converts flow items to CombinedContent, and supports
 * scroll-triggered load more (fetchMorePast / fetchMoreFuture) with merge.
 */

import { useFetcher, useLoaderData, useSearchParams } from "@remix-run/react";
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

  const loaderDataRaw = useLoaderData();
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

  useEffect(() => {
    pastFetcherRef.current = pastFetcher;
    futureFetcherRef.current = futureFetcher;
  });

  // Sync from loader data (initial load or queueType change)
  useEffect(() => {
    if (!validatedLoaderData) return;
    startTransition(() => {
      setFlowItems(flowItemsToCombinedContent(validatedLoaderData.flowItems));
      setHasMorePast(validatedLoaderData.hasMorePast);
      setHasMoreFuture(validatedLoaderData.hasMoreFuture);
      setPastCursor(validatedLoaderData.pastCursor);
      setFutureCursor(validatedLoaderData.futureCursor);
      setUser(validatedLoaderData.user);
      setQueueTypes(validatedLoaderData.queueTypes);
      setHashTagPresets(validatedLoaderData.hashTagPresets);
    });
  }, [validatedLoaderData]);

  // Merge past fetcher result when load more past completes
  useEffect(() => {
    if (pastFetcher.state !== "idle" || !pastFetcher.data) return;
    const data = safeValidateLoaderResponse(
      pastFetcher.data,
      flowLoaderDataSchema
    );
    if (!data || data.flowItems.length === 0) return;
    const newItems = flowItemsToCombinedContent(data.flowItems);
    startTransition(() => {
      setFlowItems((prev) => [...newItems, ...prev]);
      setHasMorePast(data.hasMorePast);
      if (data.pastCursor != null) setPastCursor(data.pastCursor);
    });
  }, [pastFetcher.state, pastFetcher.data]);

  // Merge future fetcher result when load more future completes
  useEffect(() => {
    if (futureFetcher.state !== "idle" || !futureFetcher.data) return;
    const data = safeValidateLoaderResponse(
      futureFetcher.data,
      flowLoaderDataSchema
    );
    if (!data || data.flowItems.length === 0) return;
    const newItems = flowItemsToCombinedContent(data.flowItems);
    startTransition(() => {
      setFlowItems((prev) => [...prev, ...newItems]);
      setHasMoreFuture(data.hasMoreFuture);
      if (data.futureCursor != null) setFutureCursor(data.futureCursor);
    });
  }, [futureFetcher.state, futureFetcher.data]);

  const fetchMorePast = useCallback(() => {
    if (pastFetcherRef.current.state !== "idle" || !pastCursor) return;
    const params = new URLSearchParams();
    if (queueType !== "all") params.set("queueType", queueType);
    params.set("before", pastCursor);
    pastFetcherRef.current.load(`/dashboard?${params.toString()}`);
  }, [pastCursor, queueType]);

  const fetchMoreFuture = useCallback(() => {
    if (futureFetcherRef.current.state !== "idle" || !futureCursor) return;
    const params = new URLSearchParams();
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
