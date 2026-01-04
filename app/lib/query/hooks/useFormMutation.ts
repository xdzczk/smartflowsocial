/**
 * React Hook Form + TanStack Query integration
 * Combines form validation with mutation handling and optimistic updates
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import { formDataToFormData } from "~/lib/validation/utils.client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface UseFormMutationOptions<TData, TSchema extends z.ZodType<any, any, any> = z.ZodType<any, any, any>> {
  form: UseFormReturn<z.infer<TSchema>>;
  endpoint: string;
  action?: string;
  invalidateQueries?: string[][];
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
  optimisticUpdate?: {
    queryKey: string[];
    updateFn: (oldData: unknown, newData: z.infer<TSchema>) => unknown;
  };
}

/**
 * Hook that combines React Hook Form with TanStack Query mutations
 * Provides optimistic updates and automatic cache invalidation
 * 
 * @example
 * ```tsx
 * const form = useZodForm(schema);
 * const { mutate, isPending } = useFormMutation({
 *   form,
 *   endpoint: "/api/update-settings",
 *   action: "update_settings",
 *   invalidateQueries: [["settings"]],
 * });
 * 
 * const onSubmit = form.handleSubmit((data) => {
 *   mutate(data);
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useFormMutation<TData = unknown, TSchema extends z.ZodType<any, any, any> = z.ZodType<any, any, any>>(
  options: UseFormMutationOptions<TData, TSchema>,
) {
  const queryClient = useQueryClient();
  const { form: _form, endpoint, action, invalidateQueries, onSuccess, onError, optimisticUpdate } = options;

  return useMutation<TData, Error, z.infer<TSchema>>({
    mutationFn: async (data: z.infer<TSchema>) => {
      const formData = formDataToFormData(data as Record<string, unknown>, action);
      
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          errorData.error ?? `Request failed: ${response.statusText}`,
        );
      }

      return response.json() as Promise<TData>;
    },
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      if (optimisticUpdate) {
        await queryClient.cancelQueries({ queryKey: optimisticUpdate.queryKey });

        // Snapshot previous value
        const previousData = queryClient.getQueryData(optimisticUpdate.queryKey);

        // Optimistically update
        queryClient.setQueryData(
          optimisticUpdate.queryKey,
          optimisticUpdate.updateFn(previousData, newData),
        );

        return { previousData };
      }
    },
    onError: (error, _newData, context) => {
      // Rollback optimistic update on error
      if (optimisticUpdate && context && typeof context === "object" && context !== null && "previousData" in context) {
        queryClient.setQueryData(optimisticUpdate.queryKey, context.previousData);
      }
      onError?.(error);
    },
    onSuccess: (data) => {
      // Invalidate queries to refetch fresh data
      if (invalidateQueries) {
        invalidateQueries.forEach((queryKey) => {
          void queryClient.invalidateQueries({ queryKey });
        });
      }
      onSuccess?.(data);
    },
    onSettled: () => {
      // Always refetch after error or success
      if (optimisticUpdate) {
        void queryClient.invalidateQueries({ queryKey: optimisticUpdate.queryKey });
      }
    },
  });
}

