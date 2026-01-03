/**
 * Serialization utilities for Remix loaders
 *
 * Remix serializes Date objects to strings when passing data from loaders to components.
 * This module provides utilities to serialize Date objects to ISO strings in loaders,
 * and deserialize them back to Date objects in components.
 */

/**
 * Recursively converts Date objects to ISO strings in an object
 */
export function serializeDates<T extends Record<string, unknown>>(
  obj: T,
): T {
  const serialized = { ...obj };

  for (const [key, value] of Object.entries(serialized)) {
    if (value instanceof Date) {
      (serialized as Record<string, unknown>)[key] = value.toISOString();
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      (serialized as Record<string, unknown>)[key] = serializeDates(
        value as Record<string, unknown>,
      );
    } else if (Array.isArray(value)) {
      (serialized as Record<string, unknown>)[key] = value.map((item) =>
        item instanceof Date
          ? item.toISOString()
          : item && typeof item === "object"
          ? serializeDates(item as Record<string, unknown>)
          : item,
      );
    }
  }

  return serialized;
}

/**
 * Recursively converts ISO strings back to Date objects
 */
export function deserializeDates<T extends Record<string, unknown>>(
  obj: T,
): T {
  const deserialized = { ...obj };

  for (const [key, value] of Object.entries(deserialized)) {
    // Check if it's a date string (ISO format)
    if (typeof value === "string" && isDateString(value)) {
      (deserialized as Record<string, unknown>)[key] = new Date(value);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      (deserialized as Record<string, unknown>)[key] = deserializeDates(
        value as Record<string, unknown>,
      );
    } else if (Array.isArray(value)) {
      (deserialized as Record<string, unknown>)[key] = value.map((item) =>
        typeof item === "string" && isDateString(item)
          ? new Date(item)
          : item && typeof item === "object"
          ? deserializeDates(item as Record<string, unknown>)
          : item,
      );
    }
  }

  return deserialized;
}

/**
 * Checks if a string is a valid ISO date string
 */
function isDateString(str: string): boolean {
  // ISO 8601 date format: YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DD
  const isoDateRegex =
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  if (!isoDateRegex.test(str)) {
    return false;
  }

  // Try to parse it as a date
  const date = new Date(str);
  return !isNaN(date.getTime());
}

/**
 * Serializes an array of objects with Date fields
 */
export function serializeDatesArray<T extends Record<string, unknown>>(
  arr: T[],
): T[] {
  return arr.map((item) => serializeDates(item));
}

/**
 * Deserializes an array of objects with date strings back to Date objects
 */
export function deserializeDatesArray<T extends Record<string, unknown>>(
  arr: T[],
): T[] {
  return arr.map((item) => deserializeDates(item));
}

