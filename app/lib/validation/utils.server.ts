/**
 * Server-side validation utilities
 * Helper functions for parsing FormData and validating with Zod schemas
 */

import { json } from "@remix-run/node";
import { z } from "zod";

import { ValidationError } from "~/lib/errors";

/**
 * Parse FormData and validate with Zod schema
 * Returns validated data or throws ValidationError
 * 
 * Handles:
 * - Single values: formData.get(key)
 * - Multiple values: formData.getAll(key) - automatically converts to arrays
 * - Checkboxes: "on"/"true" -> boolean true
 */
export function validateFormData<T extends z.ZodTypeAny>(
  formData: FormData,
  schema: T,
): z.infer<T> {
  // Convert FormData to object
  const data: Record<string, unknown> = {};
  
  // Store original FormData.getAll results to preserve array structure
  const originalArrays: Record<string, FormDataEntryValue[]> = {};
  
  // Get all unique keys from FormData
  const keys = new Set<string>();
  for (const key of formData.keys()) {
    keys.add(key);
  }
  
  // Process FormData - always use formData.getAll() which returns arrays
  for (const key of keys) {
    const allValues = formData.getAll(key);
    
    if (allValues.length === 0) {
      continue;
    }
    
    // Store original array for retry logic (always store, even for single values)
    originalArrays[key] = allValues;
    
    // Handle checkbox values first
    if (allValues.length === 1) {
      const value = allValues[0];
      if (value === "on" || value === "true") {
        data[key] = true;
      } else if (value === "off" || value === "false") {
        data[key] = false;
      } else {
        // For single values, store as-is initially
        // Retry logic will convert to array if schema expects array
        // Note: We store the raw value here, but originalArrays[key] contains the array
        data[key] = value;
      }
    } else {
      // Multiple values - always an array
      data[key] = allValues;
    }
  }
  
  // After initial parsing, check if validation fails due to array type mismatch
  // If so, retry with single values converted to arrays for fields that expect arrays
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Check if any errors are about expecting arrays but getting non-arrays
      // Note: Zod's invalid_type errors don't always have a 'received' property,
      // so we check the expected type and verify the actual value isn't an array
      const arrayErrors = error.issues.filter(
        (issue) => {
          if (issue.code === "invalid_type") {
            // Type guard: check if this is an invalid_type issue with expected array
            const invalidTypeIssue = issue as unknown as {
              code: "invalid_type";
              expected: string;
              received?: string;
            };
            // Check if schema expects an array
            if (invalidTypeIssue.expected === "array") {
              // Verify the actual value in data is not an array
              const pathParts = issue.path;
              if (pathParts.length > 0) {
                const fieldName = pathParts[0] as string;
                const actualValue = data[fieldName];
                // If the value exists and is not an array, this is an array error
                return actualValue !== undefined && actualValue !== null && !Array.isArray(actualValue);
              }
            }
            return false;
          }
          return false;
        }
      );
      
      if (arrayErrors.length > 0) {
        // Retry with single values converted to arrays for those fields
        const retryData = { ...data };
        let madeChanges = false;
        
        for (const arrayError of arrayErrors) {
          // Get the field name from the path (first element)
          const pathParts = arrayError.path;
          if (pathParts.length > 0) {
            const fieldName = pathParts[0] as string;
            
            // Always prefer original FormData array if available
            // formData.getAll() always returns an array, even for single values
            // This is the key: originalArrays always contains arrays from FormData.getAll()
            if (fieldName in originalArrays && originalArrays[fieldName] && originalArrays[fieldName].length > 0) {
              // Use the original array from FormData (always use the array, even if it has one element)
              retryData[fieldName] = originalArrays[fieldName];
              madeChanges = true;
            } else if (retryData[fieldName] !== undefined && retryData[fieldName] !== null && !Array.isArray(retryData[fieldName])) {
              // Fallback: convert single value to array
              // This handles cases where the field wasn't in originalArrays (shouldn't happen, but safety check)
              retryData[fieldName] = [retryData[fieldName]];
              madeChanges = true;
            }
          }
        }
        
        if (madeChanges) {
          try {
            return schema.parse(retryData);
          } catch (retryError) {
            // If retry also fails, format and throw the retry error (it might have more info)
            if (retryError instanceof z.ZodError) {
              const errorDetails = retryError.issues.map((err) => ({
                path: err.path.join("."),
                message: err.message,
              }));
              throw new ValidationError("Validation failed", { errors: errorDetails });
            }
            // If retry also fails, format and throw the original error
            const errorDetails = error.issues.map((err) => ({
              path: err.path.join("."),
              message: err.message,
            }));
            throw new ValidationError("Validation failed", { errors: errorDetails });
          }
        }
      }
      
      // Format Zod errors for ValidationError context
      const errorDetails = error.issues.map((err) => ({
        path: err.path.join("."),
        message: err.message,
      }));
      throw new ValidationError("Validation failed", { errors: errorDetails });
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
  schema: T,
): { success: true; data: z.infer<T> } | { success: false; response: Response } {
  try {
    const data = validateFormData(formData, schema);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ValidationError) {
      // Extract first error message from context
      const errorContext = error.context?.errors as
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
      response: json({ error: "Validation failed" }, { status: 400 }),
    };
  }
}

/**
 * Parse a string value from FormData
 */
export function getFormDataString(formData: FormData, key: string): string | null {
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

