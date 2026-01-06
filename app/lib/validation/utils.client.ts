/**
 * Client-side validation utilities
 * Helper functions for using Zod schemas in React components
 *
 * IMPORTANT: This file uses the .client.ts suffix which tells Remix to exclude it from the server bundle.
 * However, if a component using these utilities is rendered during SSR, you may need to use
 * dynamic imports or client-only wrappers to prevent errors.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import type React from "react";
import type {
  UseFormProps,
  UseFormReturn,
  UseFormRegister,
  FormState,
  UseFormGetValues,
  UseFormHandleSubmit,
  Path,
  Resolver,
  DeepPartial,
} from "react-hook-form";
import { useForm } from "react-hook-form";
import type { z } from "zod";

/**
 * Type helper to ensure Zod schema output satisfies React Hook Form's FieldValues constraint
 */
type ZodFormValues<TSchema extends z.ZodTypeAny> = z.infer<TSchema> &
  Record<string, unknown>;

/**
 * Create a minimal form object for SSR
 */
function createSSRForm<TSchema extends z.ZodTypeAny>(
  options?: Omit<
    UseFormProps<z.infer<TSchema> & Record<string, unknown>>,
    "resolver"
  >
): ReturnType<typeof useForm<z.infer<TSchema> & Record<string, unknown>>> {
  const defaultValues = options?.defaultValues ?? {};
  const watchedValues = new Map<string, unknown>();

  // Initialize watched values from defaultValues
  Object.entries(defaultValues).forEach(([key, value]) => {
    watchedValues.set(key, value);
  });

  type FormValues = ZodFormValues<TSchema>;

  const watch = ((field?: string | string[]) => {
    if (!field) return defaultValues as FormValues;
    if (typeof field === "string") {
      return watchedValues.get(field);
    }
    return defaultValues as FormValues;
  }) as UseFormReturn<FormValues>["watch"];

  const handleSubmit = ((
    onSubmit: (data: FormValues, event?: unknown) => void | Promise<void>
  ) => {
    return (event?: React.FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      void onSubmit(defaultValues as FormValues, event);
    };
  }) as UseFormHandleSubmit<FormValues>;

  const register = ((name: Path<FormValues>) => ({
    name,
    onChange: async () => {},
    onBlur: async () => {},
    ref: () => {},
  })) as UseFormRegister<FormValues>;

  const formState: FormState<FormValues> = {
    errors: {},
    isDirty: false,
    isLoading: false,
    isSubmitted: false,
    isSubmitSuccessful: false,
    isValidating: false,
    isValid: true,
    touchedFields: {},
    dirtyFields: {},
    defaultValues: defaultValues as unknown as
      | Readonly<DeepPartial<FormValues>>
      | undefined,
    submitCount: 0,
    isSubmitting: false,
    disabled: false,
    validatingFields: {},
    isReady: true,
  };

  const getValues = (() =>
    defaultValues as FormValues) as UseFormGetValues<FormValues>;

  return {
    watch,
    setValue: () => {},
    handleSubmit,
    register,
    formState,
    getValues,
    reset: () => {},
    resetField: () => {},
    getFieldState: () => ({
      invalid: false,
      isDirty: false,
      isTouched: false,
      isValidating: false,
    }),
    setError: () => {},
    clearErrors: () => {},
    trigger: async () => true,
    setFocus: () => {},
    unregister: () => {},
    subscribe: () => () => {},
    control: {} as unknown as UseFormReturn<FormValues>["control"],
  } as unknown as UseFormReturn<FormValues>;
}

/**
 * Create a React Hook Form instance with Zod validation
 * This is a convenience wrapper that sets up zodResolver automatically
 *
 * Note: This hook is client-only. During SSR, it returns a minimal form object
 * that allows the component to render without errors. The form will be properly
 * initialized on the client during hydration.
 */
export function useZodForm<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  options?: Omit<UseFormProps<ZodFormValues<TSchema>>, "resolver">
) {
  type FormValues = ZodFormValues<TSchema>;

  // Always call useForm to satisfy React hooks rules
  // During SSR, we'll override the return value
  // The zodResolver returns a resolver for z.input<TSchema>, but we need it for z.output<TSchema>
  // This is safe because Zod's input and output types are compatible for most schemas
  // Type assertion is necessary because zodResolver's type constraints don't align with
  // our generic z.ZodTypeAny constraint, but runtime behavior is correct
  const zodResolverInstance =
    typeof window !== "undefined"
      ? // @ts-expect-error - zodResolver's type constraints are too strict for our generic z.ZodTypeAny.
        // Runtime behavior is correct - the schema validates FormValues at runtime.
        (zodResolver(schema) as unknown as Resolver<FormValues>)
      : undefined;

  const form = useForm<FormValues>({
    resolver: zodResolverInstance,
    mode: "onChange",
    ...(options as Partial<UseFormProps<FormValues>>),
  });

  // During SSR, return a minimal form object
  if (typeof window === "undefined") {
    return createSSRForm<TSchema>(options) as UseFormReturn<FormValues>;
  }

  // On the client, use the real implementation
  return form;
}

/**
 * Convert form data to FormData for Remix submission
 */
export function formDataToFormData<T extends Record<string, unknown>>(
  data: T,
  action?: string
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
