/**
 * Typed wrapper for useFieldArray that works properly with Zod schemas
 * This solves the type inference issues between Zod and React Hook Form
 */

import { useFieldArray, type Control, type FieldArrayPath, type UseFieldArrayReturn, type UseFormReturn } from "react-hook-form";

/**
 * Typed wrapper for useFieldArray that properly handles Zod schema types
 * 
 * This function bridges the gap between Zod's type inference and React Hook Form's
 * type system. The type assertion is necessary because:
 * 1. The form return type from useZodForm is a union type
 * 2. TypeScript can't statically verify the Control type compatibility
 * 3. Runtime behavior is correct - the form and schema match
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
  
  return useFieldArray({
    control,
    name: name as FieldArrayPath<TFormValues>,
  });
}
