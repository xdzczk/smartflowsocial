/**
 * Posted Posts Service
 * 
 * Handles posted posts data loading
 */

import { combineContent } from "~/features/posts/combined.server";
import { getPostStats } from "~/features/posts/stats.server";
import type { PostData, LongFormPostData } from "~/features/posts/types";
import { convertPrismaQueueTypeToQueueType } from "~/features/posts/types";
import { getPublishedLongFormPosts } from "~/models/longformpost.server";
import { getPostedPosts } from "~/models/post.queries.server";
import { getUserById, getQueueTypes } from "~/models/user.server";
/**
 * Get posted posts dashboard data
 */
export async function getPostedDashboardData({
  userId,
  params,
  url,
}: {
  userId: string;
  params: { queueType?: string };
  url: URL;
}) {
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = 50;
  const queueType = params.queueType ?? "all";

  const [{ posts, pagination }, allLongformResultRaw, user, queueTypesRaw] =
    await Promise.all([
      getPostedPosts({
        userId,
        page,
        limit,
        queueType,
      }),
      getPublishedLongFormPosts({ userId, page, limit }),
      getUserById(userId),
      getQueueTypes(userId),
    ]);
  
  const allLongformResult = typeof allLongformResultRaw === "object" && allLongformResultRaw !== null && "posts" in allLongformResultRaw && "pagination" in allLongformResultRaw
    ? allLongformResultRaw as { posts: unknown[]; pagination: unknown }
    : { posts: [], pagination: { total: 0, pages: 0, currentPage: 1 } };
  const queueTypes = Array.isArray(queueTypesRaw) ? queueTypesRaw : [];

  const allLongformPosts = Array.isArray(allLongformResult.posts) ? allLongformResult.posts : [];
  const longformResult = {
    ...allLongformResult,
    posts:
      queueType === "all"
        ? allLongformPosts
        : allLongformPosts.filter(
            (post: unknown) => {
              if (typeof post === "object" && post !== null && "queueType" in post && post.queueType && typeof post.queueType === "object" && post.queueType !== null && "name" in post.queueType && typeof post.queueType.name === "string") {
                return post.queueType.name === queueType;
              }
              return false;
            },
          ),
  };

  // Convert PostWithQueueType[] to PostData[] for combineContent
  const postsData: PostData[] = posts.map((post) => {
    const { queueType, ...rest } = post;
    const signedEvent = post.signedEvent;
    const nostrEvent = post.nostrEvent;
    const signedEventValue: PostData["signedEvent"] | undefined = (signedEvent && typeof signedEvent === "object") ? signedEvent as unknown as PostData["signedEvent"] : undefined;
    const nostrEventValue: PostData["nostrEvent"] | undefined = (nostrEvent && typeof nostrEvent === "object") ? nostrEvent as unknown as PostData["nostrEvent"] : undefined;
    const result: PostData = {
      ...rest,
      queueType: convertPrismaQueueTypeToQueueType("queueType" in post ? post.queueType : undefined),
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    };
    return result;
  });

  // Convert LongFormPost[] to LongFormPostData[] for combineContent
  const longformPostsData: LongFormPostData[] = longformResult.posts.map((post: unknown) => {
    const postObj = typeof post === "object" && post !== null ? post as Record<string, unknown> : {};
    const signedEvent = "signedEvent" in postObj ? postObj.signedEvent : undefined;
    const nostrEvent = "nostrEvent" in postObj ? postObj.nostrEvent : undefined;
    const signedEventValue: LongFormPostData["signedEvent"] | undefined = (signedEvent && typeof signedEvent === "object") ? signedEvent as unknown as LongFormPostData["signedEvent"] : undefined;
    const nostrEventValue: LongFormPostData["nostrEvent"] | undefined = (nostrEvent && typeof nostrEvent === "object") ? nostrEvent as unknown as LongFormPostData["nostrEvent"] : undefined;
    const queueTypeValue = ("queueType" in postObj && postObj.queueType && typeof postObj.queueType === "object" && postObj.queueType !== null && "id" in postObj.queueType && "name" in postObj.queueType && typeof (postObj.queueType as { id: unknown; name: unknown }).id === "string" && typeof (postObj.queueType as { id: unknown; name: unknown }).name === "string") ? postObj.queueType as { id: string; name: string; scheduleConfig?: unknown; color?: string | null; description?: string | null; scheduleType?: string | null; isEnabled?: boolean | null; userId: string; [key: string]: unknown } : undefined;
    const result: LongFormPostData = {
      ...postObj,
      queueType: convertPrismaQueueTypeToQueueType(queueTypeValue as unknown as Parameters<typeof convertPrismaQueueTypeToQueueType>[0]),
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    } as LongFormPostData;
    return result;
  });

  const allContent = combineContent(
    postsData,
    longformPostsData,
    "postedAt",
    "desc",
  );

  const eventIds = posts.map((post) => {
    const signedEvent = post.signedEvent;
    if (signedEvent && typeof signedEvent === "object" && "id" in signedEvent && typeof signedEvent.id === "string") {
      return signedEvent.id;
    }
    return "";
  }).filter((id) => id !== "");
  const stats = await getPostStats(eventIds);

  return {
    posts,
    longformPosts: longformResult.posts,
    allContent,
    longformPagination: longformResult.pagination,
    pagination,
    stats,
    user,
    queueTypes: queueTypes.filter((qt: unknown) => 
      typeof qt === "object" && qt !== null && "isEnabled" in qt && qt.isEnabled !== false
    ),
    selectedQueueType: queueType,
  };
}

