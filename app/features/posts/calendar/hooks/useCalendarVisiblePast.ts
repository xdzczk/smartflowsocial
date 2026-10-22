/**
 * Loads published posts for the calendar grid on screen.
 * The main calendar payload stays a 30-day seed. This query fills the
 * visible day, week, or month when that seed does not cover it, and
 * prefetches the previous period so Back is already cached.
 */

import { useParams, useSearchParams } from "@remix-run/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";

import type { CalendarPost } from "~/features/posts/calendar/Calendar/PostBlock.types";
import {
  buildCalendarPastRangePath,
  calendarSeedWindowFromIso,
  getCalendarVisibleRange,
  getPreviousCalendarAnchor,
  pastRangeNeedsFetch,
  rangeContainsNow,
  type CalendarInstantRange,
  type CalendarRangeView,
} from "~/features/posts/calendar/calendar-past-range";
import { calendarKeys } from "~/features/posts/calendar/hooks/useCalendarQuery";
import {
  longFormPostsToCalendarPosts,
  mixedPostsToCalendarPosts,
  postsToCalendarPosts,
} from "~/features/posts/calendar/utils/calendar-post-converter";
import {
  fromLongFormPostDTOArray,
  fromPostDTOArray,
  type LongFormPostDTO,
  type PostDTO,
} from "~/features/posts/dtos";
import type { LongFormPostData, PostData } from "~/features/posts/types";
import {
  isAttachedFollowUpPost,
  isStandaloneRepostPost,
} from "~/features/posts/utils/attached-follow-up-rows";
import { isRepostPost } from "~/features/posts/utils/content-helpers";
import { nowMillis } from "~/lib/temporal";
import { safeValidateLoaderResponse } from "~/lib/validation/loader-responses";
import {
  calendarPastRangeLoaderDataSchema,
  type CalendarPastRangeLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

export type CalendarHistoryStatus = "idle" | "loading" | "error";

const HISTORICAL_STALE_MS = 5 * 60 * 1000;
const CURRENT_STALE_MS = 30 * 1000;
const CURRENT_REFETCH_MS = 60 * 1000;
const RANGE_GC_MS = 30 * 60 * 1000;

async function fetchCalendarPastRange(
  queueType: string,
  range: CalendarInstantRange,
  signal?: AbortSignal
): Promise<CalendarPastRangeLoaderData> {
  const response = await fetch(buildCalendarPastRangePath(queueType, range), {
    signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch calendar posts: ${response.status}`);
  }

  const payload: unknown = await response.json();
  const validated = safeValidateLoaderResponse(
    payload,
    calendarPastRangeLoaderDataSchema
  );
  if (!validated) {
    throw new Error("Invalid calendar range response");
  }
  return validated;
}

function postsForTab(
  tab: string,
  posts: PostData[],
  longformPosts: LongFormPostData[]
): CalendarPost[] {
  if (tab === "longform") {
    return longFormPostsToCalendarPosts(longformPosts);
  }
  if (tab === "all") {
    return mixedPostsToCalendarPosts(posts, longformPosts);
  }
  if (tab === "reposts") {
    return postsToCalendarPosts(
      posts.filter((post) => isStandaloneRepostPost(post))
    );
  }
  if (tab === "followups") {
    return postsToCalendarPosts(
      posts.filter((post) => isAttachedFollowUpPost(post))
    );
  }
  return postsToCalendarPosts(
    posts.filter((post) => !isRepostPost(post) && !isAttachedFollowUpPost(post))
  );
}

function mergeCalendarPosts(
  seedPosts: CalendarPost[],
  extraPosts: CalendarPost[]
): CalendarPost[] {
  if (extraPosts.length === 0) return seedPosts;
  const byId = new Map<string, CalendarPost>();
  for (const post of seedPosts) byId.set(post.id, post);
  for (const post of extraPosts) byId.set(post.id, post);
  return [...byId.values()];
}

export function useCalendarVisiblePast({
  enabled,
  anchorReady,
  view,
  anchorDate,
  timeZone,
  seedPosts,
  seedWindow,
  contentTab,
}: {
  enabled: boolean;
  anchorReady: boolean;
  view: CalendarRangeView;
  anchorDate: Date;
  timeZone: string;
  seedPosts: CalendarPost[];
  seedWindow: { start: string; end: string } | null;
  contentTab: string;
}): {
  pastPosts: CalendarPost[];
  historyStatus: CalendarHistoryStatus;
  retryHistory: () => void;
} {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const queueType =
    params["queueType"] ?? searchParams.get("queueType") ?? "all";

  const visibleRange = useMemo(
    () => getCalendarVisibleRange(view, anchorDate, timeZone),
    [view, anchorDate, timeZone]
  );
  const nowMs = nowMillis();
  const seed = calendarSeedWindowFromIso(seedWindow);
  const seedStartMs = seed?.startMs ?? null;
  const seedEndMs = seed?.endMs ?? null;
  const needsFetch = pastRangeNeedsFetch(visibleRange, seed, nowMs);
  const overlapsNow = rangeContainsNow(visibleRange, nowMs);
  const queryEnabled = enabled && anchorReady && needsFetch;

  const rangeQuery = useQuery({
    queryKey: calendarKeys.pastRange(
      queueType,
      visibleRange.start,
      visibleRange.end
    ),
    queryFn: ({ signal }) =>
      fetchCalendarPastRange(queueType, visibleRange, signal),
    enabled: queryEnabled,
    staleTime: overlapsNow ? CURRENT_STALE_MS : HISTORICAL_STALE_MS,
    gcTime: RANGE_GC_MS,
    refetchInterval: queryEnabled && overlapsNow ? CURRENT_REFETCH_MS : false,
    refetchOnMount: (query) =>
      query.state.status === "error" ? "always" : overlapsNow,
    refetchOnWindowFocus: (query) =>
      query.state.status === "error" ? "always" : overlapsNow,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (!enabled || !anchorReady) return;
    const previousAnchor = getPreviousCalendarAnchor(
      view,
      anchorDate,
      timeZone
    );
    const previousRange = getCalendarVisibleRange(
      view,
      previousAnchor,
      timeZone
    );
    const prefetchedAt = nowMillis();
    const seedForPrevious =
      seedStartMs === null || seedEndMs === null
        ? null
        : { startMs: seedStartMs, endMs: seedEndMs };
    if (!pastRangeNeedsFetch(previousRange, seedForPrevious, prefetchedAt)) {
      return;
    }
    const previousOverlapsNow = rangeContainsNow(previousRange, prefetchedAt);
    void queryClient.prefetchQuery({
      queryKey: calendarKeys.pastRange(
        queueType,
        previousRange.start,
        previousRange.end
      ),
      queryFn: ({ signal }) =>
        fetchCalendarPastRange(queueType, previousRange, signal),
      staleTime: previousOverlapsNow ? CURRENT_STALE_MS : HISTORICAL_STALE_MS,
    });
  }, [
    enabled,
    anchorReady,
    view,
    anchorDate,
    timeZone,
    queueType,
    seedStartMs,
    seedEndMs,
    queryClient,
  ]);

  const fetchedPosts = useMemo(() => {
    const payload = rangeQuery.data;
    if (!payload) return [];
    return postsForTab(
      contentTab,
      fromPostDTOArray(payload.pastPosts as unknown as PostDTO[]),
      fromLongFormPostDTOArray(
        payload.pastLongFormPosts as unknown as LongFormPostDTO[]
      )
    );
  }, [rangeQuery.data, contentTab]);

  const pastPosts = useMemo(() => {
    if (!queryEnabled) return seedPosts;
    return mergeCalendarPosts(seedPosts, fetchedPosts);
  }, [queryEnabled, seedPosts, fetchedPosts]);

  const historyStatus: CalendarHistoryStatus = !queryEnabled
    ? "idle"
    : rangeQuery.isError
      ? "error"
      : rangeQuery.data
        ? "idle"
        : "loading";

  const { refetch } = rangeQuery;
  const retryHistory = useCallback(() => {
    void refetch();
  }, [refetch]);

  return { pastPosts, historyStatus, retryHistory };
}
