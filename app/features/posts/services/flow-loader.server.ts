/**
 * Flow loader data preparation
 * Time-ordered stream of posts: past (posted) + future (scheduled)
 * Supports cursor-based load more in both directions.
 */

import {
  getScheduledLongFormPosts,
  getPastLongFormPosts,
  getLatestScheduledLongFormAtUtc,
  getScheduledPosts,
  getPastPosts,
  getLatestScheduledAtUtc,
} from "~/features/posts/server";
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
  postToCombinedContent,
  longFormPostToCombinedContent,
} from "../combined.server";
import {
  toPostDTOArray,
  toLongFormPostDTOArray,
  type PostDTO,
  type LongFormPostDTO,
} from "../dtos";
import { getFlowGoLiveAtMs } from "../flow-go-live-at";
import { shouldShowQueueInUi } from "../queue-status";
import { convertPrismaQueueTypeToQueueType } from "../types";
import type {
  CombinedContent,
  PostData,
  LongFormPostData,
  QueueType,
} from "../types";
import { dedupeFlowItemsByThreadGroup } from "../utils/flow-thread-dedupe";

import { filterPostsByQueueType } from "./post-filtering.server";

/** Convert Prisma queue types to app QueueType (with derived color from colorToken) for client. */
function toAppQueueTypes(
  prismaQueueTypes: Awaited<ReturnType<typeof getQueueTypesCached>>
): QueueType[] {
  return prismaQueueTypes
    .map((qt) =>
      convertPrismaQueueTypeToQueueType(
        qt as Parameters<typeof convertPrismaQueueTypeToQueueType>[0]
      )
    )
    .filter((qt): qt is QueueType => qt != null);
}

const PAST_DAYS_WINDOW = 30;
const DEFAULT_PAST_LIMIT = 20;
const DEFAULT_FUTURE_LIMIT = 30;

function getGoLiveAt(item: CombinedContent): number {
  return getFlowGoLiveAtMs(item);
}

const FUTURE_CURSOR_SEPARATOR = "|";
const FUTURE_CURSOR_DUPLICATE_BUFFER = 120;

interface FutureCursor {
  goLiveAtMs: number;
  type?: CombinedContent["type"];
  id?: string;
}

function compareFlowItems(a: CombinedContent, b: CombinedContent): number {
  const timeDiff = getGoLiveAt(a) - getGoLiveAt(b);
  if (timeDiff !== 0) return timeDiff;
  const typeDiff = a.type.localeCompare(b.type);
  if (typeDiff !== 0) return typeDiff;
  return a.id.localeCompare(b.id);
}

function makeFutureCursor(item: CombinedContent): string {
  return [
    String(getGoLiveAt(item)),
    item.type,
    encodeURIComponent(item.id),
  ].join(FUTURE_CURSOR_SEPARATOR);
}

function parseFutureCursor(raw: string): FutureCursor {
  const [timePart, typePart, idPart] = raw.split(FUTURE_CURSOR_SEPARATOR);
  const goLiveAtMs = Number(timePart);
  if (!Number.isFinite(goLiveAtMs)) {
    return { goLiveAtMs: 0 };
  }
  if (
    (typePart === "post" || typePart === "longform") &&
    idPart !== undefined
  ) {
    return {
      goLiveAtMs,
      type: typePart,
      id: decodeURIComponent(idPart),
    };
  }
  return { goLiveAtMs };
}

function isAfterFutureCursor(
  item: CombinedContent,
  cursor: FutureCursor
): boolean {
  const goLiveAt = getGoLiveAt(item);
  if (goLiveAt > cursor.goLiveAtMs) return true;
  if (goLiveAt < cursor.goLiveAtMs) return false;
  if (!cursor.type || !cursor.id) return false;
  const typeDiff = item.type.localeCompare(cursor.type);
  if (typeDiff !== 0) return typeDiff > 0;
  return item.id.localeCompare(cursor.id) > 0;
}

/** Latest scheduled date (ms) across posts and longform for runway KPI. */
async function getLastScheduledAtUtcMs(
  userId: string,
  queueType: string,
  now: Date
): Promise<number | null> {
  const [postDate, longFormDate] = await Promise.all([
    getLatestScheduledAtUtc({
      userId,
      queueType,
      now,
      excludePausedQueueContent: true,
    }),
    getLatestScheduledLongFormAtUtc({
      userId,
      queueType,
      now,
      excludePausedQueueContent: true,
    }),
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
  repostOf?: { fileUrl: string[]; postType: string | null } | null;
  fileUrl?: string[];
  postType?: string | null;
  repost?: boolean;
  postKind?: string | null;
  [key: string]: unknown;
}): PostData {
  const { queueType, repostOf, ...rest } = post;
  const isRepostWithNoMedia =
    (post.repost ?? post.postKind === "REPOST") &&
    repostOf &&
    (!post.fileUrl || post.fileUrl.length === 0);
  const fileUrl = isRepostWithNoMedia ? repostOf.fileUrl : (post.fileUrl ?? []);
  const postType = isRepostWithNoMedia
    ? repostOf.postType
    : (post.postType ?? rest.postType);
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
    fileUrl,
    postType: postType ?? undefined,
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

/** Content type filter for flow: all, posts only, reposts only, polls, or longform (articles) only. */
export type FlowContentTab = "all" | "posts" | "longform" | "reposts" | "polls";

export interface LoadFlowDataParams {
  userId: string;
  queueType?: string;
  /** When set, flow returns only items of this type (posts, reposts, longform). */
  contentTab?: FlowContentTab;
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
  /** App QueueType[] with color derived from colorToken for client display */
  queueTypes: QueueType[];
  hashTagPresets: Awaited<ReturnType<typeof getHashTagPresetsCached>>;
  /** Total counts for the full flow window (only on initial load, not on load-more). */
  flowTotalCount?: number;
  flowPostsCount?: number;
  flowRepostsCount?: number;
  flowLongformCount?: number;
  flowPollsCount?: number;
}

/**
 * Load Flow data: time-ordered window of past (posted) + future (scheduled) items.
 * Initial load: no before/after. Load more past: pass before. Load more future: pass after.
 */
export async function loadFlowData({
  userId,
  queueType = "all",
  contentTab = "all",
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

  const enabledQueueTypes = queueTypes.filter((qt) => shouldShowQueueInUi(qt));
  const queueTypesForClient = toAppQueueTypes(enabledQueueTypes);

  const fetchPosts =
    contentTab === "all" ||
    contentTab === "posts" ||
    contentTab === "reposts" ||
    contentTab === "polls";
  const postsContentTab =
    contentTab === "posts"
      ? "posts"
      : contentTab === "reposts"
        ? "reposts"
        : contentTab === "polls"
          ? "polls"
          : undefined;
  const fetchLongform = contentTab === "all" || contentTab === "longform";

  // Load more past only
  if (before !== undefined && before !== "") {
    const beforeDate = new Date(Number(before));
    const [pastPostsRaw, pastLongFormRaw] = await Promise.all([
      fetchPosts
        ? getPastPosts({
            userId,
            startDate: thirtyDaysAgo,
            endDate: beforeDate,
            queueType,
            beforeDate,
            limit: pastLimit + 1,
            contentTab: postsContentTab,
          })
        : Promise.resolve([] as Awaited<ReturnType<typeof getPastPosts>>),
      fetchLongform
        ? getPastLongFormPosts({
            userId,
            startDate: thirtyDaysAgo,
            endDate: beforeDate,
            queueType,
            beforeDate,
            limit: pastLimit + 1,
          })
        : Promise.resolve(
            [] as Awaited<ReturnType<typeof getPastLongFormPosts>>
          ),
    ]);

    const pastPostsData: PostData[] = pastPostsRaw.map((p) =>
      toPostData(p as Parameters<typeof toPostData>[0])
    );
    const pastLongFormData: LongFormPostData[] = pastLongFormRaw.map((p) =>
      toLongFormPostData(
        p as unknown as Parameters<typeof toLongFormPostData>[0]
      )
    );

    const combined = dedupeFlowItemsByThreadGroup(
      [
        ...pastPostsData.map((p) => postToCombinedContent(p)),
        ...pastLongFormData.map((p) => longFormPostToCombinedContent(p)),
      ].sort((a, b) => getGoLiveAt(a) - getGoLiveAt(b))
    );

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
      queueTypes: queueTypesForClient,
      hashTagPresets,
    };
  }

  // Load more future only
  if (after !== undefined && after !== "") {
    const futureCursor = parseFutureCursor(after);
    const afterDate = new Date(futureCursor.goLiveAtMs);
    const futureFetchLimit = futureLimit + FUTURE_CURSOR_DUPLICATE_BUFFER + 1;
    const [scheduledResult, scheduledLongFormResult] = await Promise.all([
      fetchPosts
        ? getScheduledPosts({
            userId,
            queueType,
            page: 1,
            limit: futureFetchLimit,
            afterScheduledAtUtc: afterDate,
            afterScheduledAtUtcInclusive: true,
            contentTab: postsContentTab,
            excludePausedQueueContent: true,
          })
        : Promise.resolve({
            posts: [],
            pagination: {
              total: 0,
              pages: 0,
              currentPage: 1,
              limit: futureLimit + 1,
            },
          }),
      fetchLongform
        ? getScheduledLongFormPosts({
            userId,
            queueType,
            page: 1,
            limit: futureFetchLimit,
            afterScheduledAtUtc: afterDate,
            afterScheduledAtUtcInclusive: true,
            excludePausedQueueContent: true,
          })
        : Promise.resolve({
            posts: [],
            pagination: {
              total: 0,
              pages: 0,
              currentPage: 1,
              limit: futureLimit + 1,
            },
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

    const combined = dedupeFlowItemsByThreadGroup(
      [
        ...scheduledPostsData.map((p) => postToCombinedContent(p)),
        ...scheduledLongFormData.map((p) => longFormPostToCombinedContent(p)),
      ]
        .filter((item) => isAfterFutureCursor(item, futureCursor))
        .sort(compareFlowItems)
    );

    const hasMoreFuture = combined.length > futureLimit;
    const slice = combined.slice(0, futureLimit);
    const nextFutureCursor =
      slice.length > 0 ? makeFutureCursor(slice[slice.length - 1]!) : null;

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
      futureCursor: nextFutureCursor,
      lastScheduledAtUtc,
      user,
      queueTypes: queueTypesForClient,
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
    fetchPosts
      ? getPastPosts({
          userId,
          startDate: thirtyDaysAgo,
          endDate: now,
          queueType,
          limit: pastLimit + 1,
          contentTab: postsContentTab,
        })
      : Promise.resolve([] as Awaited<ReturnType<typeof getPastPosts>>),
    fetchLongform
      ? getPastLongFormPosts({
          userId,
          startDate: thirtyDaysAgo,
          endDate: now,
          queueType,
          limit: pastLimit + 1,
        })
      : Promise.resolve([] as Awaited<ReturnType<typeof getPastLongFormPosts>>),
    fetchPosts
      ? getScheduledPosts({
          userId,
          queueType,
          page: 1,
          limit: futureLimit + 1,
          afterScheduledAtUtc: now,
          afterScheduledAtUtcInclusive: true,
          contentTab: postsContentTab,
          excludePausedQueueContent: true,
        })
      : Promise.resolve({
          posts: [] as Awaited<ReturnType<typeof getScheduledPosts>>["posts"],
          pagination: {
            total: 0,
            pages: 0,
            currentPage: 1,
            limit: futureLimit + 1,
          },
        }),
    fetchLongform
      ? getScheduledLongFormPosts({
          userId,
          queueType,
          page: 1,
          limit: futureLimit + 1,
          afterScheduledAtUtc: now,
          afterScheduledAtUtcInclusive: true,
          excludePausedQueueContent: true,
        })
      : Promise.resolve({
          posts: [] as Awaited<
            ReturnType<typeof getScheduledLongFormPosts>
          >["posts"],
          pagination: {
            total: 0,
            pages: 0,
            currentPage: 1,
            limit: futureLimit + 1,
          },
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
  const allCombined = dedupeFlowItemsByThreadGroup(
    [
      ...pastPostsData.map((p) => postToCombinedContent(p)),
      ...pastLongFormData.map((p) => longFormPostToCombinedContent(p)),
      ...scheduledPostsData.map((p) => postToCombinedContent(p)),
      ...scheduledLongFormData.map((p) => longFormPostToCombinedContent(p)),
    ].sort(compareFlowItems)
  );

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
    futureSlice.length > 0
      ? makeFutureCursor(futureSlice[futureSlice.length - 1]!)
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

  // Total counts for the full flow window (so tab counts are complete before load-more)
  const fullWindow = [...pastItems, ...futureItems];
  const flowTotalCount = fullWindow.length;
  const flowPostsCount = fullWindow.filter(
    (i) =>
      i.type === "post" &&
      (i as CombinedContent & { postKind?: string }).postKind !== "REPOST"
  ).length;
  const flowRepostsCount = fullWindow.filter(
    (i) =>
      i.type === "post" &&
      (i as CombinedContent & { postKind?: string }).postKind === "REPOST"
  ).length;
  const flowLongformCount = fullWindow.filter(
    (i) => i.type === "longform"
  ).length;
  const flowPollsCount = fullWindow.filter((i) =>
    i.type === "post"
      ? (i as CombinedContent & { postType?: string }).postType === "POLL"
      : false
  ).length;

  return {
    flowItems,
    hasMorePast,
    hasMoreFuture,
    pastCursor,
    futureCursor,
    lastScheduledAtUtc,
    user,
    queueTypes: queueTypesForClient,
    hashTagPresets,
    flowTotalCount,
    flowPostsCount,
    flowRepostsCount,
    flowLongformCount,
    flowPollsCount,
  };
}
