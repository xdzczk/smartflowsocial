/**
 * TanStack Query hooks for calendar queue route
 * Provides caching and background refetching for calendar queue page
 */

import {
  useFetcher,
  useLoaderData,
  useParams,
  useSearchParams,
} from "@remix-run/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { UserWithHashTagPresets as _UserWithHashTagPresets } from "~/features/user";
import { safeValidateLoaderResponse } from "~/lib/validation/loader-responses";
import {
  calendarQueueLoaderDataSchema,
  type CalendarQueueLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

import type { PostDTO } from "../dtos";
import { fromPostDTOArray } from "../dtos";
import type { PostData, QueueType } from "../types";

/**
 * Type for calendar queue loader data
 */
// CalendarQueueLoaderData is now exported from schemas

/**
 * Query key factory for calendar queue
 */
export const calendarQueueKeys = {
  all: ["calendar-queue"] as const,
  lists: () => [...calendarQueueKeys.all, "list"] as const,
  list: (queueType?: string) =>
    [...calendarQueueKeys.lists(), queueType] as const,
  detail: (id: string) => [...calendarQueueKeys.all, "detail", id] as const,
};

/**
 * Hook to fetch calendar queue data with TanStack Query
 */
export function useCalendarQueueQuery() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const queueType =
    params["queueType"] ?? searchParams.get("queueType") ?? "all";
  const queryKey = calendarQueueKeys.list(queueType);

  const loaderDataRaw = useLoaderData();
  const fetcher = useFetcher();

  // Validate initial loader data
  const validatedLoaderData = safeValidateLoaderResponse(
    loaderDataRaw,
    calendarQueueLoaderDataSchema
  );

  // Keep TanStack cache in sync when Remix loader data changes after actions.
  useEffect(() => {
    if (!validatedLoaderData) return;
    queryClient.setQueryData(queryKey, validatedLoaderData);
  }, [queryClient, queryKey, validatedLoaderData]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      // Use fetcher to refetch data
      const url =
        queueType !== "all"
          ? params["queueType"]
            ? `/dashboard/calendar/${queueType}`
            : `/dashboard/calendar?queueType=${queueType}`
          : `/dashboard/calendar`;
      fetcher.load(url);

      return new Promise<CalendarQueueLoaderData>((resolve, reject) => {
        const checkFetcher = () => {
          if (fetcher.state === "idle") {
            if (fetcher.data) {
              const validated = safeValidateLoaderResponse(
                fetcher.data,
                calendarQueueLoaderDataSchema
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
          } else {
            setTimeout(checkFetcher, 50);
          }
        };
        checkFetcher();
      });
    },
    initialData: validatedLoaderData ?? undefined,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnMount: false,
  });
}

/**
 * Processed calendar queue data with deserialized DTOs
 */
export function useCalendarQueueData() {
  const query = useCalendarQueueQuery();
  const rawData = query.data;

  if (!rawData) {
    return {
      scheduledPosts: [] as PostData[],
      user: null,
      queueTypes: [] as QueueType[],
      selectedQueueType: "all",
      scheduleIntervals: [] as number[],
      isLoading: query.isLoading,
      rawData: null,
    };
  }

  // Deserialize DTOs (with string dates) back to PostData (with Date objects)
  const scheduledPosts: PostData[] = Array.isArray(rawData.scheduledPosts)
    ? fromPostDTOArray(rawData.scheduledPosts as unknown as PostDTO[])
    : [];

  return {
    scheduledPosts,
    user: rawData.user,
    queueTypes: Array.isArray(rawData.queueTypes) ? rawData.queueTypes : [],
    selectedQueueType: rawData.selectedQueueType,
    scheduleIntervals: Array.isArray(rawData.scheduleIntervals)
      ? rawData.scheduleIntervals
      : [],
    isLoading: query.isLoading,
    rawData,
  };
}
