/**
 * TanStack Query hooks for calendar
 * Provides caching and background refetching for calendar page
 */

import { useFetcher, useLoaderData, useParams } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";

import { safeValidateLoaderResponse } from "~/lib/validation/loader-responses";
import {
  calendarLoaderDataSchema,
  type CalendarLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";
import { validateUserData } from "~/lib/validation/user-data";

import { combineContent } from "../combined";
import type { PostDTO, LongFormPostDTO } from "../dtos";
import { fromPostDTOArray, fromLongFormPostDTOArray } from "../dtos";
import type {
  PostData,
  LongFormPostData,
  CombinedContent as _CombinedContent,
  QueueType,
  UserData,
} from "../types";
import { convertJsonValueToScheduleConfig } from "../types";

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
  const queueType = params["queueType"] ?? "all";

  const loaderDataRaw = useLoaderData();
  const fetcher = useFetcher();

  // Validate initial loader data
  const validatedLoaderData = safeValidateLoaderResponse(
    loaderDataRaw,
    calendarLoaderDataSchema
  );

  return useQuery({
    queryKey: calendarKeys.list(queueType),
    queryFn: async () => {
      const url = `/dashboard/calendar${queueType !== "all" ? `/${queueType}` : ""}`;
      fetcher.load(url);

      return new Promise<CalendarLoaderData>((resolve, reject) => {
        const checkFetcher = () => {
          if (fetcher.state === "idle") {
            if (fetcher.data) {
              const validated = safeValidateLoaderResponse(
                fetcher.data,
                calendarLoaderDataSchema
              );
              if (validated) {
                resolve(validated);
              } else {
                reject(new Error("Invalid data received from fetcher"));
              }
            } else if (validatedLoaderData) {
              resolve(validatedLoaderData);
            } else {
              reject(new Error("Invalid loader data"));
            }
          } else if (fetcher.state === "loading") {
            setTimeout(checkFetcher, 50);
          } else {
            reject(new Error("Failed to fetch data"));
          }
        };
        checkFetcher();
      });
    },
    initialData: validatedLoaderData ?? undefined,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: false,
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
    ? fromPostDTOArray(scheduledPostsRaw as PostDTO[])
    : [];
  const scheduledLongFormPosts: LongFormPostData[] = Array.isArray(
    scheduledLongFormPostsRaw
  )
    ? fromLongFormPostDTOArray(scheduledLongFormPostsRaw as LongFormPostDTO[])
    : [];
  const pastPosts: PostData[] = Array.isArray(pastPostsRaw)
    ? fromPostDTOArray(pastPostsRaw as PostDTO[])
    : [];
  const pastLongFormPosts: LongFormPostData[] = Array.isArray(
    pastLongFormPostsRaw
  )
    ? fromLongFormPostDTOArray(pastLongFormPostsRaw as LongFormPostDTO[])
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
              color: q.color,
              description: undefined,
              scheduleType: q.scheduleType as
                | "INTERVAL"
                | "FIXED_SLOTS"
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

  return {
    scheduledPosts,
    scheduledLongFormPosts,
    pastPosts,
    pastLongFormPosts,
    allContent,
    user,
    queueTypes,
    selectedQueueType,
    isLoading,
    error,
  };
}
