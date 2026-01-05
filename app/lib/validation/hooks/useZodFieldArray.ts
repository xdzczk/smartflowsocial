/**
 * Typed wrapper for useFieldArray that works properly with Zod schemas
 * This solves the type inference issues between Zod and React Hook Form
 * 
 * This hook is SSR-safe and provides a fallback during server-side rendering.
 */

import { useFieldArray, type Control, type FieldArrayPath, type UseFieldArrayReturn, type UseFormReturn } from "react-hook-form";

/**
 * Create a mock field array for SSR
 */
function createSSRFieldArray<TFormValues extends Record<string, unknown>, TFieldArrayName extends string>(
  form: UseFormReturn<TFormValues>,
  name: TFieldArrayName,
): UseFieldArrayReturn<TFormValues, TFieldArrayName & FieldArrayPath<TFormValues>> {
  // Get default values from the form
  const defaultValues = form.getValues();
  const fieldArrayValue = (defaultValues as Record<string, unknown>)[name];
  const arrayValue = Array.isArray(fieldArrayValue) ? fieldArrayValue : [];
  
  // Create mock fields with unique IDs
  const fields = arrayValue.map((item, index) => {
    const field: { id: string; value?: unknown } = {
      id: `ssr-${name}-${index}`,
    };
    if (typeof item !== "undefined") {
      field.value = item;
    }
    return field;
  }) as UseFieldArrayReturn<TFormValues, TFieldArrayName & FieldArrayPath<TFormValues>>["fields"];
  
  return {
    fields,
    append: () => {},
    prepend: () => {},
    insert: () => {},
    swap: () => {},
    move: () => {},
    update: () => {},
    replace: () => {},
    remove: () => {},
  } as unknown as UseFieldArrayReturn<TFormValues, TFieldArrayName & FieldArrayPath<TFormValues>>;
}

/**
 * Typed wrapper for useFieldArray that properly handles Zod schema types
 * 
 * This function bridges the gap between Zod's type inference and React Hook Form's
 * type system. The type assertion is necessary because:
 * 1. The form return type from useZodForm is a union type
 * 2. TypeScript can't statically verify the Control type compatibility
 * 3. Runtime behavior is correct - the form and schema match
 * 
 * During SSR, this returns a mock field array that allows components to render
 * without errors. The form will be properly initialized on the client during hydration.
 * 
 * @param form - The form instance from useZodForm
 * @param name - The field array name (must be a valid path in the schema)
 * @returns The useFieldArray return value with proper types
 */
export function useZodFieldArray<
  TFormValues extends Record<string, unknown>,
  TFieldArrayName extends string
>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any,
  name: TFieldArrayName
): UseFieldArrayReturn<TFormValues, TFieldArrayName & FieldArrayPath<TFormValues>> {
  // Type assertion is necessary here due to the mismatch between
  // Zod's inferred types and React Hook Form's Control type expectations.
  // The types are correct at runtime, but TypeScript can't verify this statically.
  // We assert the form to the expected type, then extract the control.
  const typedForm = form as unknown as UseFormReturn<TFormValues>;
  const control = typedForm.control as unknown as Control<TFormValues>;
  
  // Check if control has the required method (client-side only)
  // During SSR, the control from useZodForm's SSR form won't have _getFieldArray
  const isServer = typeof window === "undefined";
  const hasValidControl = !isServer && control && typeof (control as { _getFieldArray?: unknown })._getFieldArray === "function";
  
  // Always call useFieldArray to satisfy React hooks rules
  // We'll use the result only if we have a valid control
  const fieldArrayResult = useFieldArray({
    control,
    name: name as FieldArrayPath<TFormValues>,
  });
  
  // During SSR or if control is invalid, return the mock field array
  // This satisfies React's rules because we always call the hook above
  if (!hasValidControl) {
    return createSSRFieldArray(typedForm, name);
  }
  
  return fieldArrayResult;
}
