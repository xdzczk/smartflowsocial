/**
 * Custom hooks for API mutations using TanStack Query
 * Provides type-safe mutations with optimistic updates support
 */

import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

/**
 * Generic API mutation hook
 * Handles POST/PUT/DELETE requests with automatic cache invalidation
 */
export function useApiMutation<TData = unknown, TVariables = unknown>(
  endpoint: string,
  options?: {
    method?: "POST" | "PUT" | "DELETE" | "PATCH";
    invalidateQueries?: string[][];
    onSuccess?: (data: TData) => void;
    onError?: (error: Error) => void;
  } & Omit<UseMutationOptions<TData, Error, TVariables>, "mutationFn">,
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables: TVariables) => {
      const response = await fetch(endpoint, {
        method: options?.method ?? "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(variables),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      return response.json() as Promise<TData>;
    },
    onSuccess: (data) => {
      // Invalidate specified queries
      if (options?.invalidateQueries) {
        options.invalidateQueries.forEach((queryKey) => {
          void queryClient.invalidateQueries({ queryKey });
        });
      }
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
    ...options,
  });
}

/**
 * Hook for form submissions using FormData
 * Useful for file uploads and multipart form data
 */
export function useFormDataMutation<TData = unknown>(
  endpoint: string,
  options?: {
    method?: "POST" | "PUT" | "PATCH";
    invalidateQueries?: string[][];
    onSuccess?: (data: TData) => void;
    onError?: (error: Error) => void;
  },
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, FormData>({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(endpoint, {
        method: options?.method ?? "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      return response.json() as Promise<TData>;
    },
    onSuccess: (data) => {
      if (options?.invalidateQueries) {
        options.invalidateQueries.forEach((queryKey) => {
          void queryClient.invalidateQueries({ queryKey });
        });
      }
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
}

