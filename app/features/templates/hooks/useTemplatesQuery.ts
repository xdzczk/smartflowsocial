/**
 * TanStack Query hooks for templates
 * Provides caching and background refetching for templates page
 */

import { useFetcher, useLoaderData, useSearchParams } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";

import type { Asset } from "~/features/assets/types";
import type { User as _User } from "~/features/user";
import { useInfiniteRemixQuery } from "~/lib/query/hooks/useInfiniteRemixQuery";
import { safeValidateLoaderResponse } from "~/lib/validation/loader-responses";
import {
  templatesLoaderDataSchema,
  type TemplatesLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

import type { Template } from "../types";

// TemplatesLoaderData is now exported from schemas

/**
 * Query key factory for templates
 */
export const templatesKeys = {
  all: ["templates"] as const,
  lists: () => [...templatesKeys.all, "list"] as const,
  list: (searchTerm?: string, page?: number) =>
    [...templatesKeys.lists(), searchTerm, page] as const,
  detail: (id: string) => [...templatesKeys.all, "detail", id] as const,
};

/**
 * Hook to fetch templates with TanStack Query
 * Uses Remix loader data as initial data and enables client-side refetching
 */
export function useTemplatesQuery() {
  const [searchParams] = useSearchParams();
  const searchTerm = searchParams.get("search") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1", 10);

  const loaderDataRaw = useLoaderData();
  const fetcher = useFetcher();

  // Validate initial loader data
  const validatedLoaderData = safeValidateLoaderResponse(
    loaderDataRaw,
    templatesLoaderDataSchema
  );

  return useQuery({
    queryKey: templatesKeys.list(searchTerm, page),
    queryFn: async () => {
      // Use fetcher to refetch data
      const url = `/dashboard/templates?search=${encodeURIComponent(searchTerm)}&page=${page}`;
      fetcher.load(url);

      // Wait for fetcher to complete
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
 * Hook to fetch templates with infinite scroll support
 */
export function useTemplatesInfiniteQuery() {
  const [searchParams] = useSearchParams();
  const searchTerm = searchParams.get("search") ?? "";

  const loaderDataRaw = useLoaderData();

  // Validate initial loader data
  const validatedLoaderData = safeValidateLoaderResponse(
    loaderDataRaw,
    templatesLoaderDataSchema
  );

  if (!validatedLoaderData) {
    throw new Error("Invalid loader data");
  }

  return useInfiniteRemixQuery<TemplatesLoaderData>({
    queryKey: templatesKeys.list(searchTerm),
    initialData: validatedLoaderData,
    getNextPageParam: (lastPage) => {
      if (lastPage.currentPage < lastPage.totalPages) {
        return lastPage.currentPage + 1;
      }
      return;
    },
    buildUrl: (pageParam) =>
      `/dashboard/templates?search=${encodeURIComponent(searchTerm)}&page=${pageParam}`,
    staleTime: 30 * 1000, // 30 seconds
    maxPages: 10, // Limit to 200 items (10 pages × 20 items per page)
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
      assets: [] as Asset[],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
      searchTerm: "",
      isLoading: query.isLoading,
      rawData: null,
    };
  }

  return {
    templates: Array.isArray(rawData.templates) ? rawData.templates : [],
    user: rawData.user,
    assets: Array.isArray(rawData.assets)
      ? rawData.assets.map((asset) => ({
          ...asset,
          createdAt:
            asset.createdAt instanceof Date
              ? asset.createdAt
              : typeof asset.createdAt === "string"
                ? new Date(asset.createdAt)
                : new Date(),
          updatedAt:
            asset.updatedAt instanceof Date
              ? asset.updatedAt
              : typeof asset.updatedAt === "string"
                ? new Date(asset.updatedAt)
                : new Date(),
        }))
      : [],
    totalCount: typeof rawData.totalCount === "number" ? rawData.totalCount : 0,
    totalPages: typeof rawData.totalPages === "number" ? rawData.totalPages : 0,
    currentPage:
      typeof rawData.currentPage === "number" ? rawData.currentPage : 1,
    searchTerm:
      typeof rawData.searchTerm === "string" ? rawData.searchTerm : "",
    isLoading: query.isLoading,
    rawData,
  };
}

/**
 * Processed templates data from infinite query
 * Flattens assets across all pages
 */
export function useTemplatesInfiniteData() {
  const query = useTemplatesInfiniteQuery();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    query;

  if (data.pages.length === 0) {
    return {
      templates: [] as Template[],
      user: null,
      assets: [] as Asset[],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
      searchTerm: "",
      isLoading,
      isFetchingNextPage,
      hasNextPage: false,
      fetchNextPage,
      rawData: null,
    };
  }

  // Flatten assets across all pages
  const allPages = data.pages;
  const allAssets: Asset[] = [];

  for (const pageData of allPages) {
    const pageAssets = Array.isArray(pageData.assets)
      ? pageData.assets.map((asset) => ({
          ...asset,
          createdAt:
            asset.createdAt instanceof Date
              ? asset.createdAt
              : typeof asset.createdAt === "string"
                ? new Date(asset.createdAt)
                : new Date(),
          updatedAt:
            asset.updatedAt instanceof Date
              ? asset.updatedAt
              : typeof asset.updatedAt === "string"
                ? new Date(asset.updatedAt)
                : new Date(),
        }))
      : [];
    allAssets.push(...pageAssets);
  }

  // Get other data from last page
  const lastPage = allPages[allPages.length - 1];
  if (!lastPage) {
    return {
      templates: [],
      user: null,
      assets: allAssets,
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
      searchTerm: "",
      isLoading,
      isFetchingNextPage,
      hasNextPage: false,
      fetchNextPage,
      rawData: null,
    };
  }

  return {
    templates: Array.isArray(lastPage.templates) ? lastPage.templates : [],
    user: lastPage.user ?? null,
    assets: allAssets,
    totalCount:
      typeof lastPage.totalCount === "number" ? lastPage.totalCount : 0,
    totalPages:
      typeof lastPage.totalPages === "number" ? lastPage.totalPages : 0,
    currentPage:
      typeof lastPage.currentPage === "number" ? lastPage.currentPage : 1,
    searchTerm:
      typeof lastPage.searchTerm === "string" ? lastPage.searchTerm : "",
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    rawData: lastPage,
  };
}
