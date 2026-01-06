/**
 * Typed wrapper for useFieldArray that works properly with Zod schemas
 * This solves the type inference issues between Zod and React Hook Form
 *
 * This hook is SSR-safe and provides a fallback during server-side rendering.
 */

import {
  useFieldArray,
  type Control,
  type FieldArrayPath,
  type UseFieldArrayReturn,
  type UseFormReturn,
} from "react-hook-form";

/**
 * Create a mock field array for SSR
 */
function createSSRFieldArray<
  TFormValues extends Record<string, unknown>,
  TFieldArrayName extends string,
>(
  form: UseFormReturn<TFormValues>,
  name: TFieldArrayName
): UseFieldArrayReturn<
  TFormValues,
  TFieldArrayName & FieldArrayPath<TFormValues>
> {
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
  }) as UseFieldArrayReturn<
    TFormValues,
    TFieldArrayName & FieldArrayPath<TFormValues>
  >["fields"];

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
  } as unknown as UseFieldArrayReturn<
    TFormValues,
    TFieldArrayName & FieldArrayPath<TFormValues>
  >;
}

/**
 * Create a minimal control object for SSR that won't cause useFieldArray to fail
 */
function createSSRControl<
  TFormValues extends Record<string, unknown>,
>(): Control<TFormValues> {
  // Create a more robust Proxy that handles all property access patterns
  const defaultFieldValue = { array: [] };

  const emptyRecord: Record<string, { array: unknown[] }> = {};
  const fieldsProxy = new Proxy(emptyRecord, {
    get: (_target, _prop) => {
      // Return an object with an array property for any field name access
      return defaultFieldValue;
    },
    has: () => true, // Handle 'in' operator checks
    ownKeys: () => [], // Handle Object.keys() and similar
    getOwnPropertyDescriptor: (_target, _prop) => ({
      enumerable: true,
      configurable: true,
      value: defaultFieldValue,
    }),
    defineProperty: () => true,
    deleteProperty: () => true,
  });

  // Create mock subjects/observables that useFieldArray might subscribe to
  // These need to be synchronous and not cause any blocking operations
  const mockSubject = {
    next: () => {},
    subscribe: () => ({ unsubscribe: () => {} }),
    complete: () => {},
    error: () => {},
  };

  // Create a more complete control object with all possible internal properties
  // that useFieldArray might access during initialization
  return {
    _getFieldArray: () => [],
    _fields: fieldsProxy,
    _formValues: {},
    _defaultValues: {},
    _stateFlags: {
      action: false,
      mount: false,
      watch: false,
    },
    _subjects: {
      values: mockSubject,
      array: mockSubject,
      state: mockSubject,
    },
    _options: {
      mode: "onChange",
      reValidateMode: "onChange",
      defaultValues: {},
    },
    _names: {
      mount: new Set(),
      unMount: new Set(),
      array: new Set(),
      values: new Set(),
      state: new Set(),
    },
    _formState: {
      isDirty: false,
      isValidating: false,
      isValid: true,
      isSubmitted: false,
      isSubmitSuccessful: false,
      submitCount: 0,
      dirtyFields: {},
      touchedFields: {},
      validatingFields: {},
      errors: {},
    },
    register: () => ({
      name: "",
      onChange: () => {},
      onBlur: () => {},
      ref: () => {},
    }),
    unregister: () => {},
    getFieldState: () => ({
      invalid: false,
      isDirty: false,
      isTouched: false,
      isValidating: false,
    }),
    _updateValid: () => {},
    _updateFieldArray: () => {},
    _getDirty: () => ({}),
    _proxyFormState: {
      isDirty: false,
      isValidating: false,
      isValid: true,
      isSubmitted: false,
      isSubmitSuccessful: false,
      submitCount: 0,
      dirtyFields: {},
      touchedFields: {},
      validatingFields: {},
      errors: {},
    },
  } as unknown as Control<TFormValues>;
}

export function useZodFieldArray<
  TFormValues extends Record<string, unknown>,
  TFieldArrayName extends string,
>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- React Hook Form type is complex and requires any
  form: any,
  name: TFieldArrayName
): UseFieldArrayReturn<
  TFormValues,
  TFieldArrayName & FieldArrayPath<TFormValues>
> {
  // Type assertion is necessary here due to the mismatch between
  // Zod's inferred types and React Hook Form's Control type expectations.
  // The types are correct at runtime, but TypeScript can't verify this statically.
  // We assert the form to the expected type, then extract the control.
  const typedForm = form as unknown as UseFormReturn<TFormValues>;
  const originalControl = typedForm.control as unknown as Control<TFormValues>;

  // Check if we're on the server
  const isServer = typeof window === "undefined";

  // During SSR, use a minimal control object that won't cause useFieldArray to fail
  // On the client, use the real control
  const control = isServer ? createSSRControl<TFormValues>() : originalControl;

  // Always call useFieldArray to satisfy React hooks rules
  // The enhanced control object should prevent it from hanging during SSR
  const fieldArrayResult = useFieldArray({
    control,
    name: name as FieldArrayPath<TFormValues>,
  });

  // During SSR, return the mock field array instead of the result from useFieldArray
  // This ensures components can render during SSR without errors
  if (isServer) {
    return createSSRFieldArray(typedForm, name);
  }

  return fieldArrayResult;
}
