/**
 * Client-side validation utilities
 * Helper functions for using Zod schemas in React components
 */

import { zodResolver } from "@hookform/resolvers/zod";
import type { UseFormProps } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { z } from "zod";

/**
 * Create a React Hook Form instance with Zod validation
 * This is a convenience wrapper that sets up zodResolver automatically
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useZodForm<TSchema extends z.ZodType<any, any, any>>(
  schema: TSchema,
  options?: Omit<UseFormProps<z.infer<TSchema>>, "resolver">,
) {
  return useForm<z.infer<TSchema>>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    resolver: zodResolver(schema) as any,
    mode: "onChange", // Validate on change for better UX
    ...options,
  });
}

/**
 * Convert form data to FormData for Remix submission
 */
export function formDataToFormData<T extends Record<string, unknown>>(
  data: T,
  action?: string,
): FormData {
  const formData = new FormData();

  if (action) {
    formData.set("_action", action);
  }

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

  return formData;
}

