/**
 * Pure normalization for loader payloads (signedEvent / nostrEvent tags).
 * Shared by server validation and client `safeValidateLoaderResponse` so both
 * see the same shape after Prisma JSON quirks.
 */

/**
 * Normalize a single tag element - converts object to array
 */
function normalizeTagElement(tag: unknown): string[] {
  if (Array.isArray(tag)) {
    return tag.map((item) => String(item));
  }

  if (typeof tag === "object" && tag !== null && !Array.isArray(tag)) {
    const tagObj = tag as Record<string, unknown>;
    const keys = Object.keys(tagObj);

    const numericKeys = keys
      .map((k) => Number.parseInt(k, 10))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);

    if (numericKeys.length > 0 && numericKeys[0] === 0) {
      const lastKey = numericKeys[numericKeys.length - 1];
      if (lastKey !== undefined) {
        const isSequential =
          numericKeys.length === lastKey + 1 &&
          numericKeys.every((n, i) => n === i);
        if (isSequential) {
          return numericKeys.map((n) => String(tagObj[String(n)] ?? ""));
        }
      }
    }

    return Object.values(tagObj).map((item) => String(item ?? ""));
  }

  return [String(tag ?? "")];
}

function normalizeTags(tags: unknown): string[][] {
  if (!tags) {
    return [];
  }

  if (Array.isArray(tags)) {
    return tags.map((tag) => normalizeTagElement(tag));
  }

  if (typeof tags === "object" && !Array.isArray(tags)) {
    const tagsObj = tags as Record<string, unknown>;
    const keys = Object.keys(tagsObj);

    const numericKeys = keys
      .map((k) => Number.parseInt(k, 10))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);

    if (numericKeys.length > 0 && numericKeys[0] === 0) {
      const lastKey = numericKeys[numericKeys.length - 1];
      if (lastKey !== undefined) {
        const isSequential =
          numericKeys.length === lastKey + 1 &&
          numericKeys.every((n, i) => n === i);
        if (isSequential) {
          return numericKeys.map((n) =>
            normalizeTagElement(tagsObj[String(n)])
          );
        }
      }
    }

    return Object.values(tagsObj).map((tag) => normalizeTagElement(tag));
  }

  return [];
}

/** Normalize event object - ensures tags are properly formatted as arrays */
export function normalizeEvent(event: unknown): unknown {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return event;
  }

  const eventObj = event as Record<string, unknown>;
  const normalized = { ...eventObj };

  if ("tags" in normalized) {
    normalized["tags"] = normalizeTags(normalized["tags"]);
  }

  return normalized;
}

/**
 * Recursively normalize all events in a data structure.
 * Preserves Date objects and other non-event data.
 */
export function normalizeLoaderResponseData(data: unknown): unknown {
  if (!data || typeof data !== "object") {
    return data;
  }

  if (data instanceof Date) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => normalizeLoaderResponseData(item));
  }

  const obj = data as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value instanceof Date) {
      normalized[key] = value;
    } else if (key === "signedEvent" || key === "nostrEvent") {
      normalized[key] = normalizeEvent(value);
    } else if (
      key === "scheduledPosts" ||
      key === "posts" ||
      key === "longformPosts" ||
      key === "pastPosts" ||
      key === "scheduledLongFormPosts" ||
      key === "pastLongFormPosts"
    ) {
      if (Array.isArray(value)) {
        normalized[key] = value.map((post) => {
          if (
            post &&
            typeof post === "object" &&
            !Array.isArray(post) &&
            !(post instanceof Date)
          ) {
            const postObj = post as Record<string, unknown>;
            const normalizedPost: Record<string, unknown> = {};
            for (const [postKey, postValue] of Object.entries(postObj)) {
              if (postValue instanceof Date) {
                normalizedPost[postKey] = postValue;
              } else if (
                postKey === "signedEvent" ||
                postKey === "nostrEvent"
              ) {
                normalizedPost[postKey] = normalizeEvent(postValue);
              } else {
                normalizedPost[postKey] = postValue;
              }
            }
            return normalizedPost;
          }
          return post;
        });
      } else {
        normalized[key] = value;
      }
    } else if (key === "flowItems") {
      if (Array.isArray(value)) {
        normalized[key] = value.map((item) => {
          if (
            item &&
            typeof item === "object" &&
            !Array.isArray(item) &&
            "data" in item &&
            (item as Record<string, unknown>)["data"] &&
            typeof (item as Record<string, unknown>)["data"] === "object"
          ) {
            const itemObj = item as Record<string, unknown>;
            const dataObj = itemObj["data"] as Record<string, unknown>;
            const normalizedData: Record<string, unknown> = {};
            for (const [dataKey, dataValue] of Object.entries(dataObj)) {
              if (dataValue instanceof Date) {
                normalizedData[dataKey] = dataValue;
              } else if (
                dataKey === "signedEvent" ||
                dataKey === "nostrEvent"
              ) {
                normalizedData[dataKey] = normalizeEvent(dataValue);
              } else {
                normalizedData[dataKey] = dataValue;
              }
            }
            return { ...itemObj, data: normalizedData };
          }
          return item;
        });
      } else {
        normalized[key] = value;
      }
    } else {
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        const valueObj = value as Record<string, unknown>;
        if (
          "signedEvent" in valueObj ||
          "nostrEvent" in valueObj ||
          "pastPosts" in valueObj ||
          "scheduledPosts" in valueObj ||
          "posts" in valueObj ||
          "longformPosts" in valueObj ||
          "scheduledLongFormPosts" in valueObj ||
          "pastLongFormPosts" in valueObj
        ) {
          normalized[key] = normalizeLoaderResponseData(value);
        } else {
          normalized[key] = value;
        }
      } else {
        normalized[key] = value;
      }
    }
  }

  return normalized;
}
