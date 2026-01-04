/**
 * TanStack Query hooks for templates
 * Provides caching and background refetching for templates page
 */

import { useFetcher, useLoaderData } from "@remix-run/react";
import { useSearchParams } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";

import { safeValidateLoaderResponse } from "~/lib/validation/loader-responses.server";
import {
  templatesLoaderDataSchema,
  type TemplatesLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

import type { Asset } from "~/features/assets/types";
import type { User } from "~/features/user";

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
    templatesLoaderDataSchema,
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
                templatesLoaderDataSchema,
              );
              if (validated) {
                resolve(validated as TemplatesLoaderData);
              } else {
                reject(new Error("Invalid data received from fetcher"));
              }
            } else if (validatedLoaderData) {
              resolve(validatedLoaderData as TemplatesLoaderData);
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
    assets: Array.isArray(rawData.assets) ? rawData.assets : [],
    totalCount: typeof rawData.totalCount === "number" ? rawData.totalCount : 0,
    totalPages: typeof rawData.totalPages === "number" ? rawData.totalPages : 0,
    currentPage: typeof rawData.currentPage === "number" ? rawData.currentPage : 1,
    searchTerm: typeof rawData.searchTerm === "string" ? rawData.searchTerm : "",
    isLoading: query.isLoading,
    rawData,
  };
}

