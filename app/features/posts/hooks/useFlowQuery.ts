/**
 * Flow data hook for dashboard Flow view
 * Reads loader data, converts flow items to CombinedContent, and supports
 * scroll-triggered load more (fetchMorePast / fetchMoreFuture) with merge.
 */

import {
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
  /** Latest scheduled date (ms) for runway KPI; null when no future scheduled. From server so runway is correct on first load. */
  lastScheduledAtUtc: number | null;
  user: FlowLoaderData["user"];
  queueTypes: FlowLoaderData["queueTypes"];
  hashTagPresets: FlowLoaderData["hashTagPresets"];
  /** Runway settings (which queues, mode); from dashboard index loader for modal. */
  runwaySettings: FlowLoaderData["runwaySettings"];
  isLoading: boolean;
  isLoadingMorePast: boolean;
  isLoadingMoreFuture: boolean;
  error: Error | null;
  /** Number of items just prepended (older posts); FlowView uses this to compensate scroll position. Cleared after compensation. */
  lastPrependedPastCount: number;
  clearPrependedPastCount: () => void;
  fetchMorePast: () => void;
  fetchMoreFuture: () => void;
  /** Total counts for full flow window (from server on initial load; stable after load-more). */
  flowTotalCount: number | undefined;
  flowPostsCount: number | undefined;
  flowRepostsCount: number | undefined;
  flowLongformCount: number | undefined;
}

export function useFlowData(): UseFlowDataResult {
  const [searchParams] = useSearchParams();
  const queueType = searchParams.get("queueType") ?? "all";
  const contentTab = searchParams.get("tab") ?? "all";

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
  const [lastScheduledAtUtc, setLastScheduledAtUtc] = useState<number | null>(
    null
  );
  const [runwaySettings, setRunwaySettings] =
    useState<FlowLoaderData["runwaySettings"]>();
  const [pastLoadMoreLoading, setPastLoadMoreLoading] = useState(false);
  const [futureLoadMoreLoading, setFutureLoadMoreLoading] = useState(false);
  const [lastPrependedPastCount, setLastPrependedPastCount] = useState(0);
  const [flowTotalCount, setFlowTotalCount] = useState<number | undefined>();
  const [flowPostsCount, setFlowPostsCount] = useState<number | undefined>();
  const [flowRepostsCount, setFlowRepostsCount] = useState<
    number | undefined
  >();
  const [flowLongformCount, setFlowLongformCount] = useState<
    number | undefined
  >();

  /** Cursor we've sent for past; clear when response is processed to avoid duplicate requests */
  const pastSentinelInFlightRef = useRef<string | null>(null);
  const futureSentinelInFlightRef = useRef<string | null>(null);
  const flowItemsLengthRef = useRef(0);
  const lastSyncedQueueTypeRef = useRef(queueType);
  const lastSyncedContentTabRef = useRef(contentTab);
  /** True after we've merged any load-more response; prevents revalidation from overwriting cursors (refs update sync, state in startTransition is deferred). */
  const hasMergedLoadMoreRef = useRef(false);

  useEffect(() => {
    flowItemsLengthRef.current = flowItems.length;
  }, [flowItems.length]);

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
    const tabUnchanged = lastSyncedContentTabRef.current === contentTab;
    // Use runway value when dashboard set it (including null = 0 days); only fall back to flow's lastScheduledAtUtc when runway is undefined (e.g. other routes).
    const runwayMs =
      validated.runwayLastScheduledAtUtc !== undefined
        ? validated.runwayLastScheduledAtUtc
        : (validated.lastScheduledAtUtc ?? null);
    if (queueUnchanged && tabUnchanged && hasMergedLoadMoreRef.current) {
      startTransition(() => {
        setUser(validated.user);
        setQueueTypes(validated.queueTypes);
        setHashTagPresets(validated.hashTagPresets);
        setLastScheduledAtUtc(runwayMs);
        setRunwaySettings(validated.runwaySettings);
      });
      return;
    }
    lastSyncedQueueTypeRef.current = queueType;
    lastSyncedContentTabRef.current = contentTab;
    hasMergedLoadMoreRef.current = false;
    startTransition(() => {
      setFlowItems(flowItemsToCombinedContent(validated.flowItems));
      setHasMorePast(validated.hasMorePast);
      setHasMoreFuture(validated.hasMoreFuture);
      setPastCursor(validated.pastCursor);
      setFutureCursor(validated.futureCursor);
      setLastScheduledAtUtc(runwayMs);
      setUser(validated.user);
      setQueueTypes(validated.queueTypes);
      setHashTagPresets(validated.hashTagPresets);
      setRunwaySettings(validated.runwaySettings);
      if (validated.flowTotalCount !== undefined)
        setFlowTotalCount(validated.flowTotalCount);
      if (validated.flowPostsCount !== undefined)
        setFlowPostsCount(validated.flowPostsCount);
      if (validated.flowRepostsCount !== undefined)
        setFlowRepostsCount(validated.flowRepostsCount);
      if (validated.flowLongformCount !== undefined)
        setFlowLongformCount(validated.flowLongformCount);
    });
  }, [loaderDataRaw, queueType, contentTab]);

  /** Build URL for dashboard index loader so we get flow JSON; use raw fetch() so Remix cannot overwrite _data */
  const buildFlowLoadMoreUrl = useCallback(
    (params: { before?: string; after?: string }) => {
      const search = new URLSearchParams();
      search.set("_data", "routes/dashboard._index");
      if (queueType !== "all") search.set("queueType", queueType);
      if (contentTab !== "all") search.set("tab", contentTab);
      if (params.before != null) search.set("before", params.before);
      if (params.after != null) search.set("after", params.after);
      return `/dashboard?${search.toString()}`;
    },
    [queueType, contentTab]
  );

  const fetchMorePast = useCallback(() => {
    if (pastLoadMoreLoading || !pastCursor) return;
    if (pastSentinelInFlightRef.current === pastCursor) return;
    pastSentinelInFlightRef.current = pastCursor;
    hasMergedLoadMoreRef.current = true;
    setPastLoadMoreLoading(true);
    const url = buildFlowLoadMoreUrl({ before: pastCursor });

    const run = async () => {
      try {
        const r = await fetch(url, { credentials: "same-origin" });
        if (!r.ok) throw new Error(String(r.status));
        const raw: unknown = await r.json();
        const data = safeValidateLoaderResponse(raw, flowLoaderDataSchema);
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
        const newItems = flowItemsToCombinedContent(data.flowItems);
        startTransition(() => {
          setFlowItems((prev) => [...newItems, ...prev]);
          setLastPrependedPastCount(newItems.length);
          setHasMorePast(data.hasMorePast);
          if (data.pastCursor != null) setPastCursor(data.pastCursor);
        });
      } catch {
        pastSentinelInFlightRef.current = null;
      } finally {
        setPastLoadMoreLoading(false);
      }
    };
    void run();
  }, [pastCursor, pastLoadMoreLoading, buildFlowLoadMoreUrl]);

  const fetchMoreFuture = useCallback(() => {
    if (futureLoadMoreLoading || !futureCursor) return;
    if (futureSentinelInFlightRef.current === futureCursor) return;
    futureSentinelInFlightRef.current = futureCursor;
    hasMergedLoadMoreRef.current = true;
    setFutureLoadMoreLoading(true);
    const url = buildFlowLoadMoreUrl({ after: futureCursor });

    const run = async () => {
      try {
        const r = await fetch(url, { credentials: "same-origin" });
        if (!r.ok) throw new Error(String(r.status));
        const raw: unknown = await r.json();
        const data = safeValidateLoaderResponse(raw, flowLoaderDataSchema);
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
        const newItems = flowItemsToCombinedContent(data.flowItems);
        startTransition(() => {
          setFlowItems((prev) => [...prev, ...newItems]);
          setHasMoreFuture(data.hasMoreFuture);
          if (data.futureCursor != null) setFutureCursor(data.futureCursor);
        });
      } catch {
        futureSentinelInFlightRef.current = null;
      } finally {
        setFutureLoadMoreLoading(false);
      }
    };
    void run();
  }, [futureCursor, futureLoadMoreLoading, buildFlowLoadMoreUrl]);

  const isLoading = pastLoadMoreLoading || futureLoadMoreLoading;
  const isLoadingMorePast = pastLoadMoreLoading;
  const isLoadingMoreFuture = futureLoadMoreLoading;
  const error = validatedLoaderData
    ? null
    : new Error("Invalid flow loader data");

  return {
    flowItems,
    hasMorePast,
    hasMoreFuture,
    pastCursor,
    futureCursor,
    lastScheduledAtUtc,
    user,
    queueTypes,
    hashTagPresets,
    runwaySettings,
    isLoading,
    isLoadingMorePast,
    isLoadingMoreFuture,
    error,
    lastPrependedPastCount,
    clearPrependedPastCount: () => setLastPrependedPastCount(0),
    fetchMorePast,
    fetchMoreFuture,
    flowTotalCount,
    flowPostsCount,
    flowRepostsCount,
    flowLongformCount,
  };
}
