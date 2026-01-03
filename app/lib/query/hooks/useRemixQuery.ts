/**
 * TanStack Query integration with Remix loaders
 * Allows using Remix loader data with React Query for client-side refetching
 * 
 * Note: This is a simplified version. For complex use cases, use useFetcher directly
 * or create custom hooks that combine Remix loaders with TanStack Query.
 */

import { useFetcher } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to use Remix loader data with TanStack Query
 * Useful when you want to refetch loader data on the client side
 * 
 * @example
 * ```tsx
 * const loaderData = useLoaderData();
 * const { data, refetch } = useRemixQuery({
 *   queryKey: ['dashboard-data'],
 *   initialData: loaderData,
 * });
 * ```
 */
export function useRemixQuery<TData = unknown>({
  queryKey,
  initialData,
  enabled = true,
  staleTime,
}: {
  queryKey: string[];
  initialData: TData;
  enabled?: boolean;
  staleTime?: number;
}) {
  const fetcher = useFetcher<TData>();

  return useQuery<TData>({
    queryKey,
    queryFn: async () => {
      // Use fetcher to refetch data
      const url = window.location.pathname + window.location.search;
      fetcher.load(url);
      // Wait for fetcher to complete
      return new Promise<TData>((resolve) => {
        const checkFetcher = () => {
          if (fetcher.state === "idle") {
            resolve((fetcher.data ?? initialData) as TData);
          } else {
            setTimeout(checkFetcher, 50);
          }
        };
        checkFetcher();
      });
    },
    initialData,
    enabled,
    staleTime,
  });
}

