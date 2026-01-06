/**
 * React Hook Form integration with Remix useFetcher
 * Provides a seamless way to use React Hook Form with Remix's form submission
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useFetcher } from "@remix-run/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod schema types require any for generic constraints
interface UseRemixFormOptions<TSchema extends z.ZodType<any, any, any>> {
  schema: TSchema;
  action: string;
  onSuccess?: (data: unknown) => void;
  onError?: (error: string) => void;
  defaultValues?: Partial<z.infer<TSchema>>;
  mode?: "onChange" | "onBlur" | "onSubmit" | "onTouched" | "all";
}

/**
 * Hook that combines React Hook Form with Remix's useFetcher
 * Handles form state, validation, and submission automatically
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod schema types require any for generic constraints
export function useRemixForm<TSchema extends z.ZodType<any, any, any>>({
  schema,
  action,
  onSuccess,
  onError,
  defaultValues,
  mode = "onChange",
}: UseRemixFormOptions<TSchema>) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();
  const form = useForm<z.infer<TSchema>>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- React Hook Form resolver requires type assertion
    resolver: zodResolver(schema) as any,
    mode,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- React Hook Form defaultValues requires type assertion
    defaultValues: defaultValues as any,
  });

  const isSubmitting = fetcher.state === "submitting";
  const isSuccess = fetcher.data?.success === true;
  const error = fetcher.data?.error;

  // Handle success callback
  useEffect(() => {
    if (isSuccess && onSuccess) {
      onSuccess(fetcher.data);
    }
  }, [isSuccess, fetcher.data, onSuccess]);

  // Handle error callback
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Reset form on successful submission
  useEffect(() => {
    if (isSuccess && defaultValues) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- React Hook Form reset requires type assertion
      form.reset(defaultValues as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Dependencies are intentionally limited to avoid unnecessary re-renders
  }, [isSuccess, defaultValues]);

  const onSubmit = form.handleSubmit((data) => {
    const formData = new FormData();
    formData.set("_action", action);

    // Convert form data to FormData
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === "boolean") {
        if (value) {
          formData.set(key, "on");
        }
      } else if (Array.isArray(value)) {
        // For arrays, join with newlines (common pattern in this codebase)
        formData.set(key, value.join("\n"));
      } else {
        formData.set(key, String(value));
      }
    }

    fetcher.submit(formData, { method: "post" });
  });

  return {
    ...form,
    onSubmit,
    isSubmitting,
    isSuccess,
    error,
    fetcher,
  };
}
