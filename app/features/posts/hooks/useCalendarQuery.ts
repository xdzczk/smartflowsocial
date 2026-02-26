/**
 * TanStack Query hooks for calendar
 * Provides caching and background refetching for calendar page
 */

import { useLoaderData, useParams, useSearchParams } from "@remix-run/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { safeValidateLoaderResponse } from "~/lib/validation/loader-responses";
import { calendarLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";
import { validateUserData } from "~/lib/validation/user-data";

import { combineContent } from "../combined";
import type { PostDTO, LongFormPostDTO } from "../dtos";
import { fromPostDTOArray, fromLongFormPostDTOArray } from "../dtos";
import { getQueueAccentHex } from "../queue-colors";
import type {
  PostData,
  LongFormPostData,
  CombinedContent as _CombinedContent,
  QueueType,
  UserData,
} from "../types";
import { convertJsonValueToScheduleConfig } from "../types";
import { isRepostPost } from "../utils/content-helpers";

/**
 * Query key factory for calendar
 */
export const calendarKeys = {
  all: ["calendar"] as const,
  lists: () => [...calendarKeys.all, "list"] as const,
  list: (queueType?: string) => [...calendarKeys.lists(), queueType] as const,
};

// CalendarLoaderData is now exported from schemas

/**
 * Hook to fetch calendar data with TanStack Query
 */
export function useCalendarQuery() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const queueType =
    params["queueType"] ?? searchParams.get("queueType") ?? "all";
  const queryKey = calendarKeys.list(queueType);

  const loaderDataRaw = useLoaderData();

  // Validate initial loader data
  const validatedLoaderData = safeValidateLoaderResponse(
    loaderDataRaw,
    calendarLoaderDataSchema
  );

  // Keep TanStack cache in sync when Remix loader data changes after actions.
  useEffect(() => {
    if (!validatedLoaderData) return;
    queryClient.setQueryData(queryKey, validatedLoaderData);
  }, [queryClient, queryKey, validatedLoaderData]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const url =
        queueType !== "all"
          ? params["queueType"]
            ? `/dashboard/calendar/${queueType}`
            : `/dashboard/calendar?queueType=${queueType}`
          : `/dashboard/calendar`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch calendar data: ${response.statusText}`
        );
      }

      const data = (await response.json()) as unknown;
      const validated = safeValidateLoaderResponse(
        data,
        calendarLoaderDataSchema
      );

      if (!validated) {
        throw new Error("Invalid data received from server");
      }

      return validated;
    },
    initialData: validatedLoaderData ?? undefined,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: false,
    refetchInterval: 60 * 1000, // Refresh post status every minute (e.g. scheduled → published for today)
  });
}

/**
 * Hook to get processed calendar data from query
 */
export function useCalendarData() {
  const { data, isLoading, error } = useCalendarQuery();

  if (!data) {
    return {
      scheduledPosts: [] as PostData[],
      scheduledLongFormPosts: [] as LongFormPostData[],
      pastPosts: [] as PostData[],
      pastLongFormPosts: [] as LongFormPostData[],
      allContent: [] as Array<{
        type: "post" | "longform";
        [key: string]: unknown;
      }>,
      user: null as UserData | null,
      queueTypes: [] as QueueType[],
      selectedQueueType: "all",
      totalPostsCount: 0,
      totalRepostsCount: 0,
      totalLongformCount: 0,
      totalContentCount: 0,
      isLoading,
      error,
    };
  }

  const typedData = data;
  const scheduledPostsRaw =
    "scheduledPosts" in typedData && Array.isArray(typedData.scheduledPosts)
      ? typedData.scheduledPosts
      : [];
  const scheduledLongFormPostsRaw =
    "scheduledLongFormPosts" in typedData &&
    Array.isArray(typedData.scheduledLongFormPosts)
      ? typedData.scheduledLongFormPosts
      : [];
  const pastPostsRaw =
    "pastPosts" in typedData && Array.isArray(typedData.pastPosts)
      ? typedData.pastPosts
      : [];
  const pastLongFormPostsRaw =
    "pastLongFormPosts" in typedData &&
    Array.isArray(typedData.pastLongFormPosts)
      ? typedData.pastLongFormPosts
      : [];
  const userRaw = "user" in typedData ? typedData.user : null;
  const user: UserData | null = userRaw ? validateUserData(userRaw) : null;
  const queueTypesRaw =
    "queueTypes" in typedData && Array.isArray(typedData.queueTypes)
      ? typedData.queueTypes
      : [];
  const selectedQueueTypeRaw =
    "selectedQueueType" in typedData ? typedData.selectedQueueType : "all";

  const scheduledPosts: PostData[] = Array.isArray(scheduledPostsRaw)
    ? fromPostDTOArray(scheduledPostsRaw as unknown as PostDTO[])
    : [];
  const scheduledLongFormPosts: LongFormPostData[] = Array.isArray(
    scheduledLongFormPostsRaw
  )
    ? fromLongFormPostDTOArray(
        scheduledLongFormPostsRaw as unknown as LongFormPostDTO[]
      )
    : [];
  const pastPosts: PostData[] = Array.isArray(pastPostsRaw)
    ? fromPostDTOArray(pastPostsRaw as unknown as PostDTO[])
    : [];
  const pastLongFormPosts: LongFormPostData[] = Array.isArray(
    pastLongFormPostsRaw
  )
    ? fromLongFormPostDTOArray(
        pastLongFormPostsRaw as unknown as LongFormPostDTO[]
      )
    : [];

  // Reconstruct allContent on client from deserialized posts
  const allContent = combineContent(
    [...scheduledPosts, ...pastPosts],
    [...scheduledLongFormPosts, ...pastLongFormPosts],
    "scheduledFor",
    "asc"
  );

  const queueTypes: QueueType[] = Array.isArray(queueTypesRaw)
    ? queueTypesRaw
        .map((qt: unknown) => {
          if (qt && typeof qt === "object" && "id" in qt && "name" in qt) {
            const q = qt as {
              id: string;
              name: string;
              color?: string | null;
              scheduleType?: string;
              scheduleConfig?: unknown;
              isEnabled?: boolean;
              userId?: string;
            };
            const queueType: QueueType = {
              id: q.id,
              name: q.name,
              color: getQueueAccentHex(
                (q as { colorToken?: string | null }).colorToken ?? null
              ),
              colorToken:
                (q as { colorToken?: string | null }).colorToken ?? undefined,
              description: undefined,
              scheduleType: q.scheduleType as
                | "INTERVAL"
                | "FIXED_SLOTS"
                | "WEEKLY_SLOTS"
                | undefined,
              scheduleConfig: convertJsonValueToScheduleConfig(
                q.scheduleConfig
              ),
              isEnabled: q.isEnabled,
              userId: q.userId,
            };
            return queueType;
          }
          return null;
        })
        .filter((qt): qt is QueueType => qt !== null)
    : [];
  const selectedQueueType =
    typeof selectedQueueTypeRaw === "string" ? selectedQueueTypeRaw : "all";

  // Extract pagination totals for display
  const _scheduledPostsPaginationRaw =
    "scheduledPostsPagination" in typedData
      ? typedData.scheduledPostsPagination
      : undefined;
  const scheduledLongFormPostsPaginationRaw =
    "scheduledLongFormPostsPagination" in typedData
      ? typedData.scheduledLongFormPostsPagination
      : undefined;

  const totalRepostsCount =
    scheduledPosts.filter((p) => isRepostPost(p)).length +
    pastPosts.filter((p) => isRepostPost(p)).length;
  const totalPostsCount =
    scheduledPosts.filter((p) => !isRepostPost(p)).length +
    pastPosts.filter((p) => !isRepostPost(p)).length;
  const totalLongformCount =
    scheduledLongFormPostsPaginationRaw &&
    typeof scheduledLongFormPostsPaginationRaw === "object" &&
    "total" in scheduledLongFormPostsPaginationRaw &&
    typeof scheduledLongFormPostsPaginationRaw.total === "number"
      ? scheduledLongFormPostsPaginationRaw.total
      : scheduledLongFormPosts.length + pastLongFormPosts.length;
  const totalContentCount =
    scheduledPosts.length +
    pastPosts.length +
    scheduledLongFormPosts.length +
    pastLongFormPosts.length;

  return {
    scheduledPosts,
    scheduledLongFormPosts,
    pastPosts,
    pastLongFormPosts,
    allContent,
    user,
    queueTypes,
    selectedQueueType,
    totalPostsCount,
    totalRepostsCount,
    totalLongformCount,
    totalContentCount,
    isLoading,
    error,
  };
}
