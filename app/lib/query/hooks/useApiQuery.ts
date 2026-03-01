/**
 * Custom hooks for API queries using TanStack Query
 * Provides type-safe, cached API calls
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

/**
 * Generic API query hook
 * Fetches data from API routes with automatic caching and error handling
 */
export function useApiQuery<TData = unknown>(
  endpoint: string,
  options?: {
    queryKey?: string[];
    enabled?: boolean;
    staleTime?: number;
    refetchInterval?: number;
  } & Omit<UseQueryOptions<TData>, "queryKey" | "queryFn">
) {
  const queryKey = options?.queryKey ?? [endpoint];

  return useQuery<TData>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }
      return response.json() as Promise<TData>;
    },
    staleTime: options?.staleTime,
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled,
    ...options,
  });
}

/**
 * Hook to fetch user upload provider settings
 * Cached for 5 minutes
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useUploadProvider();
 * const provider = data?.provider;
 * ```
 */
export function useUploadProvider() {
  return useApiQuery<{
    provider?: string;
    customBlossomUrl?: string | null;
    enableMirrorBlossom?: boolean;
    mirrorUploadUrls?: string[];
  }>("/api/user-upload-provider", {
    queryKey: ["upload-provider"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

interface UploadProviderData {
  provider?: string;
  customBlossomUrl?: string | null;
  enableMirrorBlossom?: boolean;
  mirrorUploadUrls?: string[];
}

/**
 * Get upload provider data (for use in non-React contexts)
 * This is a utility function that can be used outside of React components
 * Note: This doesn't use caching, use the hook in components instead
 */
let _uploadProviderCache: UploadProviderData | null = null;
let _uploadProviderPromise: Promise<UploadProviderData> | null = null;

export async function getUploadProvider(options?: {
  forceRefresh?: boolean;
}): Promise<UploadProviderData> {
  if (options?.forceRefresh) {
    clearUploadProviderCache();
  }
  if (_uploadProviderCache) {
    return _uploadProviderCache;
  }
  if (_uploadProviderPromise) {
    return _uploadProviderPromise;
  }
  _uploadProviderPromise = (async () => {
    try {
      const response = await fetch("/api/user-upload-provider");
      if (!response.ok) {
        throw new Error("Failed to get upload provider");
      }
      const result = (await response.json()) as UploadProviderData;
      _uploadProviderCache = result;
      return result;
    } finally {
      _uploadProviderPromise = null;
    }
  })();
  return _uploadProviderPromise;
}

/**
 * Clear the upload provider cache (e.g. after user changes provider in Settings).
 * Call this so the next getUploadProvider() fetches fresh data.
 */
export function clearUploadProviderCache(): void {
  _uploadProviderCache = null;
  _uploadProviderPromise = null;
}

/**
 * Hook to fetch thread view data
 * Cached for 2 minutes
 */
export function useThreadView(eventId: string | null) {
  const endpoint = eventId
    ? `/api/thread-view?event_id=${encodeURIComponent(eventId)}`
    : "/api/thread-view";

  return useApiQuery<{
    events: unknown[];
    metadata: Record<string, unknown>;
  }>(endpoint, {
    queryKey: ["thread-view", eventId ?? "none"],
    enabled: !!eventId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
