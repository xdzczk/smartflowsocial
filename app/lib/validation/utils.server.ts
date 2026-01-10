/**
 * Server-side validation utilities
 * Helper functions for parsing FormData and validating with Zod schemas
 */

import { json } from "@remix-run/node";
import { z } from "zod";

import { ValidationError } from "~/lib/errors";

const VALIDATION_FAILED_MESSAGE = "Validation failed";

/**
 * Parse FormData and validate with Zod schema
 * Returns validated data or throws ValidationError
 *
 * Handles:
 * - Single values: formData.get(key)
 * - Multiple values: formData.getAll(key) - automatically converts to arrays
 * - Checkboxes: "on"/"true" -> boolean true
 */
// ============================================================================
// Helper Functions
// ============================================================================

function convertFormDataToObject(formData: FormData): {
  data: Record<string, unknown>;
  originalArrays: Record<string, FormDataEntryValue[]>;
} {
  const data: Record<string, unknown> = {};
  const originalArrays: Record<string, FormDataEntryValue[]> = {};
  const keys = new Set<string>();

  for (const key of formData.keys()) {
    keys.add(key);
  }

  for (const key of keys) {
    const allValues = formData.getAll(key);

    if (allValues.length === 0) {
      continue;
    }

    originalArrays[key] = allValues;

    if (allValues.length === 1) {
      const value = allValues[0];
      if (value === "on" || value === "true") {
        data[key] = true;
      } else if (value === "off" || value === "false") {
        data[key] = false;
      } else {
        data[key] = value;
      }
    } else {
      data[key] = allValues;
    }
  }

  return { data, originalArrays };
}

function findArrayTypeErrors(
  error: z.ZodError,
  data: Record<string, unknown>
): z.ZodIssue[] {
  return error.issues.filter((issue) => {
    if (issue.code === "invalid_type") {
      const invalidTypeIssue = issue as unknown as {
        code: "invalid_type";
        expected: string;
        received?: string;
      };
      if (invalidTypeIssue.expected === "array") {
        const pathParts = issue.path;
        if (pathParts.length > 0) {
          const fieldName = pathParts[0] as string;
          const actualValue = data[fieldName];
          return (
            actualValue !== undefined &&
            actualValue !== null &&
            !Array.isArray(actualValue)
          );
        }
      }
    }
    return false;
  });
}

function retryWithArrayConversion(
  data: Record<string, unknown>,
  originalArrays: Record<string, FormDataEntryValue[]>,
  arrayErrors: z.ZodIssue[],
  schema: z.ZodTypeAny
): z.infer<typeof schema> {
  const retryData = { ...data };
  let madeChanges = false;

  for (const arrayError of arrayErrors) {
    const pathParts = arrayError.path;
    if (pathParts.length > 0) {
      const fieldName = pathParts[0] as string;

      if (
        fieldName in originalArrays &&
        originalArrays[fieldName] &&
        originalArrays[fieldName].length > 0
      ) {
        retryData[fieldName] = originalArrays[fieldName];
        madeChanges = true;
      } else if (
        retryData[fieldName] !== undefined &&
        retryData[fieldName] !== null &&
        !Array.isArray(retryData[fieldName])
      ) {
        retryData[fieldName] = [retryData[fieldName]];
        madeChanges = true;
      }
    }
  }

  if (madeChanges) {
    try {
      return schema.parse(retryData);
    } catch (retryError) {
      if (retryError instanceof z.ZodError) {
        const errorDetails = retryError.issues.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));
        throw new ValidationError(VALIDATION_FAILED_MESSAGE, {
          errors: errorDetails,
        });
      }
      throw retryError;
    }
  }

  throw new Error("No changes made in retry");
}

function formatZodError(error: z.ZodError): ValidationError {
  const errorDetails = error.issues.map((err) => ({
    path: err.path.join("."),
    message: err.message,
  }));
  return new ValidationError(VALIDATION_FAILED_MESSAGE, {
    errors: errorDetails,
  });
}

export function validateFormData<T extends z.ZodTypeAny>(
  formData: FormData,
  schema: T
): z.infer<T> {
  const { data, originalArrays } = convertFormDataToObject(formData);

  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const arrayErrors = findArrayTypeErrors(error, data);

      if (arrayErrors.length > 0) {
        try {
          return retryWithArrayConversion(
            data,
            originalArrays,
            arrayErrors,
            schema
          ) as z.infer<typeof schema>;
        } catch (retryError) {
          if (retryError instanceof ValidationError) {
            throw retryError;
          }
          throw formatZodError(error);
        }
      }

      throw formatZodError(error);
    }
    throw error;
  }
}

/**
 * Parse FormData and validate with Zod schema
 * Returns JSON response with error if validation fails
 */
export function validateFormDataOrRespond<T extends z.ZodTypeAny>(
  formData: FormData,
  schema: T
):
  | { success: true; data: z.infer<T> }
  | { success: false; response: Response } {
  try {
    const data = validateFormData(formData, schema);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ValidationError) {
      // Extract first error message from context
      const errorContext = error.context?.["errors"] as
        | Array<{ path: string; message: string }>
        | undefined;
      const errorMessage = errorContext?.[0]
        ? `${errorContext[0].path}: ${errorContext[0].message}`
        : error.message;
      return {
        success: false,
        response: json({ error: errorMessage }, { status: 400 }),
      };
    }
    return {
      success: false,
      response: json({ error: VALIDATION_FAILED_MESSAGE }, { status: 400 }),
    };
  }
}

/**
 * Parse a string value from FormData
 */
export function getFormDataString(
  formData: FormData,
  key: string
): string | null {
  const value = formData.get(key);
  return value ? String(value) : null;
}

/**
 * Parse a boolean value from FormData (handles "on", "true", etc.)
 */
export function getFormDataBoolean(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true";
}

/**
 * Parse an array from FormData (handles newline-separated strings)
 */
export function getFormDataArray(formData: FormData, key: string): string[] {
  const value = formData.get(key);
  if (!value) return [];
  return String(value)
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
