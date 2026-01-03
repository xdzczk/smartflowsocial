/**
 * TanStack Query hooks for recyclable posts
 * Provides caching and background refetching for recyclables page
 */

import { useFetcher, useLoaderData } from "@remix-run/react";
import { useParams } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";

import type { UserWithHashTagPresets } from "~/features/user";

import type { PostDTO } from "../dtos";
import { fromPostDTOArray } from "../dtos";
import type { PostStats } from "../stats.server";
import type {
  PostData,
  QueueType,
} from "../types";

/**
 * Type for recyclables loader data
 */
export type RecyclablesLoaderData = {
  posts: PostDTO[];
  pagination: {
    total: number;
    pages: number;
    currentPage: number;
    limit: number;
  };
  stats: Record<string, PostStats>;
  user: UserWithHashTagPresets;
  queueTypes: QueueType[];
  selectedQueueType: string;
};

/**
 * Query key factory for recyclables
 */
export const recyclablesKeys = {
  all: ["recyclables"] as const,
  lists: () => [...recyclablesKeys.all, "list"] as const,
  list: (queueType?: string, page?: number) =>
    [...recyclablesKeys.lists(), queueType, page] as const,
  detail: (id: string) => [...recyclablesKeys.all, "detail", id] as const,
};

/**
 * Hook to fetch recyclable posts with TanStack Query
 * Uses Remix loader data as initial data and enables client-side refetching
 */
export function useRecyclablesQuery() {
  const params = useParams();
  const queueType = params.queueType ?? "all";
  const page = 1; // Recyclables doesn't use pagination in URL currently, but we'll support it
  
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const loaderData = useLoaderData() as unknown as RecyclablesLoaderData;
  const fetcher = useFetcher();

  return useQuery({
    queryKey: recyclablesKeys.list(queueType, page),
    queryFn: async () => {
      // Use fetcher to refetch data
      const url = `/dashboard/recyclables${queueType !== "all" ? `/${queueType}` : ""}?page=${page}`;
      fetcher.load(url);
      
      // Wait for fetcher to complete
      return new Promise<RecyclablesLoaderData>((resolve, _reject) => {
        const checkFetcher = () => {
          if (fetcher.state === "idle") {
            if (fetcher.data) {
              resolve(fetcher.data as unknown as RecyclablesLoaderData);
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
  });
}

/**
 * Processed recyclables data with deserialized DTOs
 */
export function useRecyclablesData() {
  const query = useRecyclablesQuery();
  const rawData = query.data;

  // Deserialize DTOs (with string dates) back to PostData (with Date objects)
  const posts: PostData[] = Array.isArray(rawData.posts)
    ? fromPostDTOArray(rawData.posts)
    : [];

  // Type assertions for stats
  const stats: Record<
    string,
    {
      likes?: number;
      replies?: number;
      mentions?: number;
      reposts?: number;
      zaps?: number;
      satszapped?: number;
    }
  > = rawData.stats && typeof rawData.stats === "object" && !Array.isArray(rawData.stats)
    ? rawData.stats
    : {};

  // Type assertion for pagination
  const pagination =
    rawData.pagination &&
    typeof rawData.pagination === "object" &&
    !Array.isArray(rawData.pagination) &&
    "total" in rawData.pagination &&
    "pages" in rawData.pagination &&
    "currentPage" in rawData.pagination &&
    "limit" in rawData.pagination
      ? {
          total: typeof rawData.pagination.total === "number" ? rawData.pagination.total : 0,
          pages: typeof rawData.pagination.pages === "number" ? rawData.pagination.pages : 0,
          currentPage:
            typeof rawData.pagination.currentPage === "number"
              ? rawData.pagination.currentPage
              : 1,
          limit: typeof rawData.pagination.limit === "number" ? rawData.pagination.limit : 50,
        }
      : { total: 0, pages: 0, currentPage: 1, limit: 50 };

  return {
    posts,
    pagination,
    stats,
    user: rawData.user,
    queueTypes: Array.isArray(rawData.queueTypes) ? rawData.queueTypes : [],
    selectedQueueType: rawData.selectedQueueType ?? "all",
    isLoading: query.isLoading,
    rawData,
  };
}

