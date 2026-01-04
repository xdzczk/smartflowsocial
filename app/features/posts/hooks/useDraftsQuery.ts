/**
 * TanStack Query hooks for drafts
 * Provides caching and background refetching for drafts page
 */

import { useFetcher, useLoaderData } from "@remix-run/react";
import { useParams } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";

import { safeValidateLoaderResponse } from "~/lib/validation/loader-responses.server";
import {
  draftsLoaderDataSchema,
  type DraftsLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

import type { PostDTO, LongFormPostDTO } from "../dtos";
import {
  fromPostDTOArray,
  fromLongFormPostDTOArray,
} from "../dtos";
import { combineContent } from "../combined.client";
import type {
  PostData,
  LongFormPostData,
  CombinedContent,
  QueueType,
  UserData,
} from "../types";
import { convertJsonValueToScheduleConfig } from "../types";

/**
 * Query key factory for drafts
 */
export const draftsKeys = {
  all: ["drafts"] as const,
  lists: () => [...draftsKeys.all, "list"] as const,
  list: (queueType?: string) =>
    [...draftsKeys.lists(), queueType] as const,
};

// DraftsLoaderData is now exported from schemas

/**
 * Hook to fetch drafts data with TanStack Query
 */
export function useDraftsQuery() {
  const params = useParams();
  const queueType = params.queueType ?? "all";
  
  const loaderDataRaw = useLoaderData();
  const fetcher = useFetcher();

  // Validate initial loader data
  const validatedLoaderData = safeValidateLoaderResponse(
    loaderDataRaw,
    draftsLoaderDataSchema,
  );

  return useQuery({
    queryKey: draftsKeys.list(queueType),
    queryFn: async () => {
      const url = `/dashboard/drafts${queueType !== "all" ? `/${queueType}` : ""}`;
      fetcher.load(url);
      
      return new Promise<DraftsLoaderData>((resolve, reject) => {
        const checkFetcher = () => {
          if (fetcher.state === "idle") {
            if (fetcher.data) {
              const validated = safeValidateLoaderResponse(
                fetcher.data,
                draftsLoaderDataSchema,
              );
              if (validated) {
                resolve(validated as DraftsLoaderData);
              } else {
                reject(new Error("Invalid data received from fetcher"));
              }
            } else if (validatedLoaderData) {
              resolve(validatedLoaderData as DraftsLoaderData);
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
 * Hook to get processed drafts data from query
 */
export function useDraftsData() {
  const { data, isLoading, error } = useDraftsQuery();
  
  if (!data) {
    return {
      posts: [] as PostData[],
      longformPosts: [] as LongFormPostData[],
      allContent: [] as CombinedContent[],
      user: null as UserData | null,
      queueTypes: [] as QueueType[],
      selectedQueueType: "all",
      isLoading,
      error,
    };
  }

  const typedData = data;
  const postsRaw =
    "posts" in typedData && Array.isArray(typedData.posts) ? typedData.posts : [];
  const longformPostsRaw =
    "longformPosts" in typedData && Array.isArray(typedData.longformPosts)
      ? typedData.longformPosts
      : [];
  const userRaw = "user" in typedData ? typedData.user : null;
  const queueTypesRaw =
    "queueTypes" in typedData && Array.isArray(typedData.queueTypes)
      ? typedData.queueTypes
      : [];
  const selectedQueueTypeRaw = "selectedQueueType" in typedData ? typedData.selectedQueueType : "all";

  const posts: PostData[] = Array.isArray(postsRaw)
    ? fromPostDTOArray(postsRaw as PostDTO[])
    : [];
  const longformPosts: LongFormPostData[] = Array.isArray(longformPostsRaw)
    ? fromLongFormPostDTOArray(longformPostsRaw as LongFormPostDTO[])
    : [];
  // Reconstruct allContent on client from deserialized posts/longformPosts
  const allContent: CombinedContent[] = combineContent(
    posts,
    longformPosts,
    "createdAt",
    "desc",
  );
  const queueTypes: QueueType[] = Array.isArray(queueTypesRaw)
    ? queueTypesRaw
        .map((qt: unknown) => {
          if (
            qt &&
            typeof qt === "object" &&
            qt !== null &&
            "id" in qt &&
            "name" in qt
          ) {
            const q = qt as {
              id?: unknown;
              name?: unknown;
              color?: unknown;
              scheduleType?: unknown;
              scheduleConfig?: unknown;
              isEnabled?: unknown;
              userId?: unknown;
            };
            const id = typeof q.id === "string" ? q.id : String(q.id ?? "");
            const name =
              typeof q.name === "string" ? q.name : String(q.name ?? "");
            const color =
              q.color !== null && q.color !== undefined
                ? typeof q.color === "string"
                  ? q.color
                  : String(q.color)
                : null;
            const scheduleType =
              typeof q.scheduleType === "string" &&
              (q.scheduleType === "INTERVAL" || q.scheduleType === "FIXED_SLOTS")
                ? q.scheduleType
                : undefined;
            const scheduleConfig = convertJsonValueToScheduleConfig(
              q.scheduleConfig,
            );
            const isEnabled =
              typeof q.isEnabled === "boolean"
                ? q.isEnabled
                : q.isEnabled !== false;
            const userId = typeof q.userId === "string" ? q.userId : "";
            const queueType: QueueType = {
              id,
              name,
              color,
              description: undefined,
              scheduleType,
              scheduleConfig,
              isEnabled,
              userId,
            };
            return queueType;
          }
          return null;
        })
        .filter((qt): qt is QueueType => qt !== null)
    : [];
  const selectedQueueType = typeof selectedQueueTypeRaw === "string" ? selectedQueueTypeRaw : "all";

  return {
    posts,
    longformPosts,
    allContent,
    user: userRaw,
    queueTypes,
    selectedQueueType,
    isLoading,
    error,
  };
}

