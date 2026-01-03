/**
 * TanStack Query client configuration
 * Provides a singleton QueryClient instance for the application
 */

import { QueryClient } from "@tanstack/react-query";

/**
 * Default query client configuration
 * Optimized for Remix SSR and client-side data fetching
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Stale time: data is considered fresh for 5 minutes
        staleTime: 1000 * 60 * 5,
        // Cache time: data stays in cache for 10 minutes after it becomes unused
        gcTime: 1000 * 60 * 10,
        // Retry failed requests 1 time
        retry: 1,
        // Refetch on window focus in development, but not in production
        refetchOnWindowFocus: process.env.NODE_ENV === "development",
        // Don't refetch on mount if data is fresh
        refetchOnMount: false,
        // Don't refetch on reconnect if data is fresh
        refetchOnReconnect: false,
      },
      mutations: {
        // Retry failed mutations 1 time
        retry: 1,
      },
    },
  });
}

/**
 * Singleton QueryClient instance
 * Created once and reused across the application
 */
let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return createQueryClient();
  } else {
    // Browser: use singleton pattern to keep the same query client
    browserQueryClient ??= createQueryClient();
    return browserQueryClient;
  }
}


