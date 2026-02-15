/**
 * TanStack Query hooks for templates
 * Provides caching and background refetching for templates page
 */

import { useFetcher, useLoaderData } from "@remix-run/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useInfiniteRemixQuery } from "~/lib/query/hooks/useInfiniteRemixQuery";
import { safeValidateLoaderResponse } from "~/lib/validation/loader-responses";
import {
  templatesLoaderDataSchema,
  type TemplatesLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

import type { Template } from "../types";

/**
 * Query key factory for templates
 */
export const templatesKeys = {
  all: ["templates"] as const,
  lists: () => [...templatesKeys.all, "list"] as const,
  list: () => [...templatesKeys.lists()] as const,
  detail: (id: string) => [...templatesKeys.all, "detail", id] as const,
};

/**
 * Hook to fetch templates with TanStack Query
 * Uses Remix loader data as initial data and enables client-side refetching
 */
export function useTemplatesQuery() {
  const loaderDataRaw = useLoaderData();
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  const validatedLoaderData = safeValidateLoaderResponse(
    loaderDataRaw,
    templatesLoaderDataSchema
  );

  // Sync fresh loader data into the cache when it changes (e.g. after creating a
  // template and redirecting back to the list), so the new template appears without reload.
  useEffect(() => {
    if (validatedLoaderData) {
      queryClient.setQueryData(templatesKeys.list(), validatedLoaderData);
    }
  }, [queryClient, validatedLoaderData]);

  return useQuery({
    queryKey: templatesKeys.list(),
    queryFn: async () => {
      fetcher.load("/dashboard/templates");

      return new Promise<TemplatesLoaderData>((resolve, reject) => {
        const checkFetcher = () => {
          if (fetcher.state === "idle") {
            if (fetcher.data) {
              const validated = safeValidateLoaderResponse(
                fetcher.data,
                templatesLoaderDataSchema
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
    initialData: validatedLoaderData,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch templates with infinite scroll support (single page for now)
 */
export function useTemplatesInfiniteQuery() {
  const loaderDataRaw = useLoaderData();

  const validatedLoaderData = safeValidateLoaderResponse(
    loaderDataRaw,
    templatesLoaderDataSchema
  );

  if (!validatedLoaderData) {
    throw new Error("Invalid loader data");
  }

  return useInfiniteRemixQuery<TemplatesLoaderData>({
    queryKey: templatesKeys.list(),
    initialData: validatedLoaderData,
    // Return undefined explicitly so getNextPageParam matches (lastPage, allPages) => number | undefined
    // eslint-disable-next-line unicorn/no-useless-undefined -- required for correct return type
    getNextPageParam: () => undefined,
    buildUrl: () => "/dashboard/templates",
    staleTime: 30 * 1000,
    maxPages: 1,
  });
}

/**
 * Processed templates data
 */
export function useTemplatesData() {
  const query = useTemplatesQuery();
  const rawData = query.data;

  if (!rawData) {
    return {
      templates: [] as Template[],
      user: null,
      isLoading: query.isLoading,
      rawData: null,
    };
  }

  return {
    templates: Array.isArray(rawData.templates) ? rawData.templates : [],
    user: rawData.user,
    isLoading: query.isLoading,
    rawData,
  };
}

/**
 * Processed templates data from infinite query
 */
export function useTemplatesInfiniteData() {
  const query = useTemplatesInfiniteQuery();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    query;

  if (data.pages.length === 0) {
    return {
      templates: [] as Template[],
      user: null,
      isLoading,
      isFetchingNextPage,
      hasNextPage: false,
      fetchNextPage,
      rawData: null,
    };
  }

  const lastPage = data.pages[data.pages.length - 1];

  return {
    templates: Array.isArray(lastPage?.templates) ? lastPage.templates : [],
    user: lastPage?.user ?? null,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    rawData: lastPage ?? null,
  };
}
