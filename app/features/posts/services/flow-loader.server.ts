/**
 * Flow loader data preparation
 * Time-ordered stream of posts: past (posted) + future (scheduled)
 * Supports cursor-based load more in both directions.
 */

import { getUserById } from "~/features/user";
import {
  getQueueTypesCached,
  getHashTagPresetsCached,
} from "~/features/user/services/user-cache.server";
import { addDays, nowUTC, toPrismaDate } from "~/lib/temporal";
import {
  validateSignedEvent,
  validateNostrEvent,
} from "~/lib/validation/nostr-events.server";
import {
  getScheduledLongFormPosts,
  getPastLongFormPosts,
  getLatestScheduledLongFormAtUtc,
} from "~/models/longformpost.server";
import {
  getScheduledPosts,
  getPastPosts,
  getLatestScheduledAtUtc,
} from "~/models/post.queries.server";

import {
  postToCombinedContent,
  longFormPostToCombinedContent,
} from "../combined.server";
import {
  toPostDTOArray,
  toLongFormPostDTOArray,
  type PostDTO,
  type LongFormPostDTO,
} from "../dtos";
import type { CombinedContent, PostData, LongFormPostData } from "../types";
import { convertPrismaQueueTypeToQueueType } from "../types";

import { filterPostsByQueueType } from "./post-filtering.server";

const PAST_DAYS_WINDOW = 30;
const DEFAULT_PAST_LIMIT = 20;
const DEFAULT_FUTURE_LIMIT = 30;

function getGoLiveAt(item: CombinedContent): number {
  const posted = item.publishedAt ? new Date(item.publishedAt).getTime() : 0;
  const scheduled = item.scheduledAtUtc
    ? new Date(item.scheduledAtUtc).getTime()
    : 0;
  return posted || scheduled || 0;
}

/** Latest scheduled date (ms) across posts and longform for runway KPI. */
async function getLastScheduledAtUtcMs(
  userId: string,
  queueType: string,
  now: Date
): Promise<number | null> {
  const [postDate, longFormDate] = await Promise.all([
    getLatestScheduledAtUtc({ userId, queueType, now }),
    getLatestScheduledLongFormAtUtc({ userId, queueType, now }),
  ]);
  const postMs = postDate?.getTime() ?? 0;
  const longFormMs = longFormDate?.getTime() ?? 0;
  const max = Math.max(postMs, longFormMs);
  return max > 0 ? max : null;
}

function toPostData(post: {
  queueType: unknown;
  signedEvent: unknown;
  nostrEvent: unknown;
  [key: string]: unknown;
}): PostData {
  const { queueType, ...rest } = post;
  const signedEventValue = validateSignedEvent(
    post.signedEvent as Parameters<typeof validateSignedEvent>[0]
  );
  const nostrEventValue = validateNostrEvent(
    post.nostrEvent as Parameters<typeof validateNostrEvent>[0]
  );
  const convertedQueueType = convertPrismaQueueTypeToQueueType(
    queueType as Parameters<typeof convertPrismaQueueTypeToQueueType>[0]
  );
  /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- rest is Prisma post shape, typed at runtime */
  return {
    ...rest,
    queueType: convertedQueueType,
    signedEvent: signedEventValue,
    nostrEvent: nostrEventValue,
  } as PostData;
}

function toLongFormPostData(post: {
  queueType: unknown;
  signedEvent: unknown;
  nostrEvent: unknown;
  [key: string]: unknown;
}): LongFormPostData {
  const { queueType, ...rest } = post;
  const signedEventValue = validateSignedEvent(
    post.signedEvent as Parameters<typeof validateSignedEvent>[0]
  );
  const nostrEventValue = validateNostrEvent(
    post.nostrEvent as Parameters<typeof validateNostrEvent>[0]
  );
  const convertedQueueType = convertPrismaQueueTypeToQueueType(
    queueType as Parameters<typeof convertPrismaQueueTypeToQueueType>[0]
  );
  /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- rest is Prisma longform shape, typed at runtime */
  return {
    ...rest,
    queueType: convertedQueueType,
    signedEvent: signedEventValue,
    nostrEvent: nostrEventValue,
  } as LongFormPostData;
}

export type FlowItemDTO =
  | { type: "post"; data: PostDTO }
  | { type: "longform"; data: LongFormPostDTO };

export interface LoadFlowDataParams {
  userId: string;
  queueType?: string;
  pastLimit?: number;
  futureLimit?: number;
  /** Cursor for load more past (go-live timestamp ms as string). */
  before?: string;
  /** Cursor for load more future (go-live timestamp ms as string). */
  after?: string;
}

export interface LoadFlowDataResult {
  flowItems: FlowItemDTO[];
  hasMorePast: boolean;
  hasMoreFuture: boolean;
  pastCursor: string | null;
  futureCursor: string | null;
  /** Latest scheduled date (ms) for runway KPI; null when no future scheduled. */
  lastScheduledAtUtc: number | null;
  user: Awaited<ReturnType<typeof getUserById>>;
  queueTypes: Awaited<ReturnType<typeof getQueueTypesCached>>;
  hashTagPresets: Awaited<ReturnType<typeof getHashTagPresetsCached>>;
}

/**
 * Load Flow data: time-ordered window of past (posted) + future (scheduled) items.
 * Initial load: no before/after. Load more past: pass before. Load more future: pass after.
 */
export async function loadFlowData({
  userId,
  queueType = "all",
  pastLimit = DEFAULT_PAST_LIMIT,
  futureLimit = DEFAULT_FUTURE_LIMIT,
  before,
  after,
}: LoadFlowDataParams): Promise<LoadFlowDataResult> {
  const nowZoned = nowUTC();
  const thirtyDaysAgoZoned = addDays(nowZoned, -PAST_DAYS_WINDOW);
  const now = toPrismaDate(nowZoned);
  const thirtyDaysAgo = toPrismaDate(thirtyDaysAgoZoned);

  if (!now || !thirtyDaysAgo) {
    throw new Error("Failed to convert Temporal dates to Date");
  }

  const [user, queueTypes, hashTagPresets] = await Promise.all([
    getUserById(userId),
    getQueueTypesCached(userId),
    getHashTagPresetsCached(userId),
  ]);

  const enabledQueueTypes = queueTypes.filter((qt) => qt.isEnabled !== false);

  // Load more past only
  if (before !== undefined && before !== "") {
    const beforeDate = new Date(Number(before));
    const [pastPostsRaw, pastLongFormRaw] = await Promise.all([
      getPastPosts({
        userId,
        startDate: thirtyDaysAgo,
        endDate: beforeDate,
        queueType,
        beforeDate,
        limit: pastLimit + 1,
      }),
      getPastLongFormPosts({
        userId,
        startDate: thirtyDaysAgo,
        endDate: beforeDate,
        queueType,
        beforeDate,
        limit: pastLimit + 1,
      }),
    ]);

    const pastPostsData: PostData[] = pastPostsRaw.map((p) =>
      toPostData(p as Parameters<typeof toPostData>[0])
    );
    const pastLongFormData: LongFormPostData[] = pastLongFormRaw.map((p) =>
      toLongFormPostData(
        p as unknown as Parameters<typeof toLongFormPostData>[0]
      )
    );

    const combined = [
      ...pastPostsData.map((p) => postToCombinedContent(p)),
      ...pastLongFormData.map((p) => longFormPostToCombinedContent(p)),
    ].sort((a, b) => getGoLiveAt(a) - getGoLiveAt(b));

    const hasMorePast = combined.length > pastLimit;
    const slice = combined.slice(0, pastLimit);
    const pastCursor = slice.length > 0 ? String(getGoLiveAt(slice[0]!)) : null;

    const flowItems: FlowItemDTO[] = slice.map((item) => {
      if (item.type === "post") {
        const dto = toPostDTOArray([item.originalData as PostData])[0]!;
        return { type: "post", data: dto };
      }
      const dto = toLongFormPostDTOArray([
        item.originalData as LongFormPostData,
      ])[0]!;
      return { type: "longform", data: dto };
    });

    const lastScheduledAtUtc = await getLastScheduledAtUtcMs(
      userId,
      queueType,
      new Date()
    );

    return {
      flowItems,
      hasMorePast,
      hasMoreFuture: false,
      pastCursor,
      futureCursor: null,
      lastScheduledAtUtc,
      user,
      queueTypes: enabledQueueTypes,
      hashTagPresets,
    };
  }

  // Load more future only
  if (after !== undefined && after !== "") {
    const afterDate = new Date(Number(after));
    const [scheduledResult, scheduledLongFormResult] = await Promise.all([
      getScheduledPosts({
        userId,
        queueType,
        page: 1,
        limit: futureLimit + 1,
        afterScheduledAtUtc: afterDate,
      }),
      getScheduledLongFormPosts({
        userId,
        queueType,
        page: 1,
        limit: futureLimit + 1,
        afterScheduledAtUtc: afterDate,
      }),
    ]);

    const scheduledPosts = scheduledResult.posts;
    const scheduledLongForm = scheduledLongFormResult.posts;
    const filteredLongForm = filterPostsByQueueType(
      scheduledLongForm as Array<{
        queueType?: { name?: string | null } | null;
      }>,
      queueType
    );

    const scheduledPostsData: PostData[] = scheduledPosts.map((p) =>
      toPostData(p as Parameters<typeof toPostData>[0])
    );
    const scheduledLongFormData: LongFormPostData[] = filteredLongForm.map(
      (p) =>
        toLongFormPostData(
          p as unknown as Parameters<typeof toLongFormPostData>[0]
        )
    );

    const combined = [
      ...scheduledPostsData.map((p) => postToCombinedContent(p)),
      ...scheduledLongFormData.map((p) => longFormPostToCombinedContent(p)),
    ].sort((a, b) => getGoLiveAt(a) - getGoLiveAt(b));

    const hasMoreFuture = combined.length > futureLimit;
    const slice = combined.slice(0, futureLimit);
    const futureCursor =
      slice.length > 0 ? String(getGoLiveAt(slice[slice.length - 1]!)) : null;

    const flowItems: FlowItemDTO[] = slice.map((item) => {
      if (item.type === "post") {
        const dto = toPostDTOArray([item.originalData as PostData])[0]!;
        return { type: "post", data: dto };
      }
      const dto = toLongFormPostDTOArray([
        item.originalData as LongFormPostData,
      ])[0]!;
      return { type: "longform", data: dto };
    });

    const lastScheduledAtUtc = await getLastScheduledAtUtcMs(
      userId,
      queueType,
      new Date()
    );

    return {
      flowItems,
      hasMorePast: false,
      hasMoreFuture,
      pastCursor: null,
      futureCursor,
      lastScheduledAtUtc,
      user,
      queueTypes: enabledQueueTypes,
      hashTagPresets,
    };
  }

  // Initial load: past + future. Request futureLimit+1 so we can set hasMoreFuture when there are more.
  const [
    pastPostsRaw,
    pastLongFormRaw,
    scheduledResult,
    scheduledLongFormResult,
  ] = await Promise.all([
    getPastPosts({
      userId,
      startDate: thirtyDaysAgo,
      endDate: now,
      queueType,
      limit: pastLimit + 1,
    }),
    getPastLongFormPosts({
      userId,
      startDate: thirtyDaysAgo,
      endDate: now,
      queueType,
      limit: pastLimit + 1,
    }),
    getScheduledPosts({
      userId,
      queueType,
      page: 1,
      limit: futureLimit + 1,
    }),
    getScheduledLongFormPosts({
      userId,
      queueType,
      page: 1,
      limit: futureLimit + 1,
    }),
  ]);

  const pastPostsData: PostData[] = pastPostsRaw.map((p) =>
    toPostData(p as Parameters<typeof toPostData>[0])
  );
  const pastLongFormData: LongFormPostData[] = pastLongFormRaw.map((p) =>
    toLongFormPostData(p as unknown as Parameters<typeof toLongFormPostData>[0])
  );

  const scheduledPosts = scheduledResult.posts;
  const scheduledLongForm = scheduledLongFormResult.posts;
  const filteredLongForm = filterPostsByQueueType(
    scheduledLongForm as Array<{ queueType?: { name?: string | null } | null }>,
    queueType
  );

  const scheduledPostsData: PostData[] = scheduledPosts.map((p) =>
    toPostData(p as Parameters<typeof toPostData>[0])
  );
  const scheduledLongFormData: LongFormPostData[] = filteredLongForm.map((p) =>
    toLongFormPostData(p as unknown as Parameters<typeof toLongFormPostData>[0])
  );

  const nowMs = now.getTime();
  const allCombined = [
    ...pastPostsData.map((p) => postToCombinedContent(p)),
    ...pastLongFormData.map((p) => longFormPostToCombinedContent(p)),
    ...scheduledPostsData.map((p) => postToCombinedContent(p)),
    ...scheduledLongFormData.map((p) => longFormPostToCombinedContent(p)),
  ].sort((a, b) => getGoLiveAt(a) - getGoLiveAt(b));

  const pastItems = allCombined.filter((i) => getGoLiveAt(i) <= nowMs);
  const futureItems = allCombined.filter((i) => getGoLiveAt(i) > nowMs);
  const pastSlice = pastItems.slice(-pastLimit);
  const futureSlice = futureItems.slice(0, futureLimit);
  const flowCombined = [...pastSlice, ...futureSlice];

  const hasMorePast = pastItems.length > pastLimit;
  const hasMoreFuture = futureItems.length > futureLimit;

  const pastCursor =
    flowCombined.length > 0 ? String(getGoLiveAt(flowCombined[0]!)) : null;
  const futureCursor =
    flowCombined.length > 0
      ? String(getGoLiveAt(flowCombined[flowCombined.length - 1]!))
      : null;

  const flowItems: FlowItemDTO[] = flowCombined.map((item) => {
    if (item.type === "post") {
      const dto = toPostDTOArray([item.originalData as PostData])[0]!;
      return { type: "post", data: dto };
    }
    const dto = toLongFormPostDTOArray([
      item.originalData as LongFormPostData,
    ])[0]!;
    return { type: "longform", data: dto };
  });

  const lastScheduledAtUtc = await getLastScheduledAtUtcMs(
    userId,
    queueType,
    now
  );

  return {
    flowItems,
    hasMorePast,
    hasMoreFuture,
    pastCursor,
    futureCursor,
    lastScheduledAtUtc,
    user,
    queueTypes: enabledQueueTypes,
    hashTagPresets,
  };
}
