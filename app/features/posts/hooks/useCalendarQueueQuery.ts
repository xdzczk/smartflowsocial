/**
 * TanStack Query hooks for calendar queue route
 * Provides caching and background refetching for calendar queue page
 */

import { useFetcher, useLoaderData } from "@remix-run/react";
import { useParams } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";

import type { UserWithHashTagPresets } from "~/features/user";

import type { PostDTO } from "../dtos";
import { fromPostDTOArray } from "../dtos";
import type { PostData, QueueType } from "../types";

/**
 * Type for calendar queue loader data
 */
export type CalendarQueueLoaderData = {
  scheduledPosts: PostDTO[];
  user: UserWithHashTagPresets;
  queueTypes: QueueType[];
  selectedQueueType: string;
  scheduleIntervals: number[];
};

/**
 * Query key factory for calendar queue
 */
export const calendarQueueKeys = {
  all: ["calendar-queue"] as const,
  lists: () => [...calendarQueueKeys.all, "list"] as const,
  list: (queueType?: string) => [...calendarQueueKeys.lists(), queueType] as const,
  detail: (id: string) => [...calendarQueueKeys.all, "detail", id] as const,
};

/**
 * Hook to fetch calendar queue data with TanStack Query
 */
export function useCalendarQueueQuery() {
  const params = useParams();
  const queueType = params.queueType ?? "all";
  
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const loaderData = useLoaderData() as unknown as CalendarQueueLoaderData;
  const fetcher = useFetcher();

  return useQuery({
    queryKey: calendarQueueKeys.list(queueType),
    queryFn: async () => {
      // Use fetcher to refetch data
      const url = `/dashboard/calendar${queueType !== "all" ? `/${queueType}` : ""}`;
      fetcher.load(url);
      
      return new Promise<CalendarQueueLoaderData>((resolve) => {
        const checkFetcher = () => {
          if (fetcher.state === "idle") {
            if (fetcher.data) {
              resolve(fetcher.data as unknown as CalendarQueueLoaderData);
            } else {
              resolve(loaderData);
            }
          } else {
            setTimeout(checkFetcher, 50);
          }
        };
        checkFetcher();
      });
    },
    initialData: loaderData,
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

  // Deserialize DTOs (with string dates) back to PostData (with Date objects)
  const scheduledPosts: PostData[] = Array.isArray(rawData.scheduledPosts)
    ? fromPostDTOArray(rawData.scheduledPosts)
    : [];

  return {
    scheduledPosts,
    user: rawData.user,
    queueTypes: Array.isArray(rawData.queueTypes) ? rawData.queueTypes : [],
    selectedQueueType: rawData.selectedQueueType ?? "all",
    scheduleIntervals: Array.isArray(rawData.scheduleIntervals)
      ? rawData.scheduleIntervals
      : [],
    isLoading: query.isLoading,
    rawData,
  };
}

