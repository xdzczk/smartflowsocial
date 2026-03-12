import { nip19 } from "nostr-tools";

import { type ToastMessage } from "~/components/types";
import type { User } from "~/features/user";
import { logClientError } from "~/lib/error-handler.client";
import {
  fromISOString,
  fromDate,
  nowMillis,
  parseDateTimeLocal,
  toUnixTimestamp,
} from "~/lib/temporal";

import type { BulkPost, PreparedEvent } from "../types";

export const DEFAULT_RELAY_URL = "wss://relay.primal.net";

/** Fetcher response shape for bulk post file URLs (used by useBulkPostEvents). */
export interface FetcherData {
  fileUrls?: Array<{ fileUrl: string; scheduledFor: string }>;
}

/**
 * Parse fetcher data and return fileUrl array and scheduledFor for the given index.
 * Accepts raw fetcher.data so the util stays free of Remix types.
 */
export function getFileUrlFromFetcher(
  fetcherDataRaw: unknown,
  index: number
): { fileUrl: string[]; scheduledFor: string } {
  const fetcherData =
    fetcherDataRaw &&
    typeof fetcherDataRaw === "object" &&
    !Array.isArray(fetcherDataRaw)
      ? (fetcherDataRaw as { fileUrls?: unknown })
      : null;
  const fileUrlsArray =
    fetcherData &&
    "fileUrls" in fetcherData &&
    Array.isArray(fetcherData.fileUrls)
      ? fetcherData.fileUrls
      : null;
  const fileUrlItem =
    fileUrlsArray?.[index] &&
    typeof fileUrlsArray[index] === "object" &&
    fileUrlsArray[index] !== null &&
    !Array.isArray(fileUrlsArray[index])
      ? (fileUrlsArray[index] as {
          fileUrl?: unknown;
          scheduledFor?: unknown;
        })
      : null;
  let fileUrl: string[] = [];
  if (fileUrlItem && "fileUrl" in fileUrlItem) {
    const raw = fileUrlItem.fileUrl;
    if (Array.isArray(raw)) {
      fileUrl = raw.filter((u): u is string => typeof u === "string");
    } else if (typeof raw === "string" && raw.trim() !== "") {
      fileUrl = [raw];
    }
  }
  const scheduledFor =
    fileUrlItem &&
    "scheduledFor" in fileUrlItem &&
    typeof fileUrlItem.scheduledFor === "string"
      ? fileUrlItem.scheduledFor
      : "";

  return { fileUrl, scheduledFor };
}

export function buildContent(
  fileUrls: string[],
  caption: string,
  tagsString: string,
  user: User | null
): string {
  const addTags =
    user &&
    typeof user === "object" &&
    "showHashTagsinPosts" in user &&
    user.showHashTagsinPosts
      ? `${tagsString}`
      : "";

  const mediaPart = fileUrls.length > 0 ? fileUrls.join("\n") : "";
  const contentParts = [mediaPart, caption, addTags].filter(
    (part) => part !== ""
  );
  return contentParts.join("\n");
}

export function convertTagsToArray(tagsString: string | undefined): string[][] {
  if (!tagsString) {
    return [];
  }
  return tagsString
    .split(" ")
    .filter((tag: string) => tag.length > 0)
    .map((tag: string) => ["t", tag.replace("#", "")]);
}

export function convertScheduledTime(
  scheduledForValue: string,
  userTimezone: string
): number {
  try {
    const zonedDateTime = parseDateTimeLocal(scheduledForValue, userTimezone);
    const utcZoned = zonedDateTime.withTimeZone("UTC");
    return toUnixTimestamp(utcZoned) * 1000;
  } catch {
    try {
      const zoned = fromISOString(scheduledForValue + "Z", "UTC");
      return toUnixTimestamp(zoned) * 1000;
    } catch {
      try {
        const dateObj = new Date(scheduledForValue + "Z");
        const zoned = fromDate(dateObj, "UTC");
        return toUnixTimestamp(zoned) * 1000;
      } catch {
        const dateObj = new Date(scheduledForValue + "Z");
        return dateObj.getTime();
      }
    }
  }
}

export function parseOriginalFileUrl(
  originalFileUrl: string | string[]
): string {
  if (Array.isArray(originalFileUrl)) {
    return originalFileUrl[0] ?? "";
  }
  if (typeof originalFileUrl === "string" && originalFileUrl.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(originalFileUrl);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return typeof (parsed as unknown[])[0] === "string"
          ? ((parsed as string[])[0] ?? "")
          : "";
      }
    } catch {
      return originalFileUrl;
    }
  }
  return typeof originalFileUrl === "string" ? originalFileUrl : "";
}

/** All media URLs for this post (from fileUrl or originalFileUrl for kind6). */
export function getFileUrlArray(post: BulkPost): string[] {
  if (
    post.isKind6Repost &&
    post.originalFileUrl &&
    post.originalFileUrl.length > 0
  ) {
    const one = parseOriginalFileUrl(post.originalFileUrl);
    return one ? [one] : [];
  }
  if (Array.isArray(post.fileUrl)) {
    return post.fileUrl.filter((u): u is string => typeof u === "string");
  }
  if (typeof post.fileUrl === "string" && post.fileUrl.trim() !== "") {
    return [post.fileUrl];
  }
  return [];
}

/** Build fake fileUrl payload for repost/quote preparation (server expects this shape). */
export function createFakeFileUrlData(posts: BulkPost[]): Array<{
  fileUrl: string[];
  scheduledFor: string;
  queueType: string;
  isRecyclable: boolean;
}> {
  return posts.map((post) => ({
    fileUrl: getFileUrlArray(post),
    scheduledFor: post.scheduledFor,
    queueType: post.queueType,
    isRecyclable: post.isRecyclable,
  }));
}

export function getUserTimezone(user: User | null): string {
  return user &&
    typeof user === "object" &&
    "timezone" in user &&
    typeof user.timezone === "string"
    ? user.timezone
    : "UTC";
}

export function getDisplayFileUrl(post: BulkPost): string {
  if (!post.originalFileUrl || post.originalFileUrl.length === 0) {
    return "";
  }

  if (
    typeof post.originalFileUrl === "string" &&
    post.originalFileUrl.startsWith("[")
  ) {
    try {
      const parsed = JSON.parse(post.originalFileUrl) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0] ?? "";
      }
    } catch (_e) {
      return post.originalFileUrl ?? "";
    }
  }

  if (Array.isArray(post.originalFileUrl) && post.originalFileUrl.length > 0) {
    return post.originalFileUrl[0] ?? "";
  }

  return post.originalFileUrl as string;
}

export function createKind6RepostEvent(
  post: BulkPost,
  scheduledTime: number
): PreparedEvent {
  const displayFileUrl = getDisplayFileUrl(post);
  return {
    fileUrl: displayFileUrl ? [displayFileUrl] : [],
    scheduledFor: Math.floor(
      (post.scheduledFor
        ? Number(
            fromISOString(String(post.scheduledFor), "UTC").epochMilliseconds
          )
        : nowMillis()) / 1000
    ),
    caption: "",
    queueType: post.queueType,
    isRecyclable: post.isRecyclable,
    originalPostId: post.originalPostId,
    originalEventId: post.originalEventId,
    originalEventPubkey: post.originalEventPubkey,
    events: {
      content: "",
      created_at: Math.floor(scheduledTime / 1000),
      kind: 6,
      tags: [
        ["e", post.originalEventId ?? "", DEFAULT_RELAY_URL],
        ["p", post.originalEventPubkey ?? ""],
      ],
    },
  };
}

export function createLongformQuoteEvent(
  post: BulkPost,
  addTags: string,
  tagArray: string[][],
  scheduledTime: number,
  fileUrl: string
): PreparedEvent {
  const quoteContent = [post.caption, addTags.length > 10 ? "" : addTags]
    .filter(Boolean)
    .join("\n");

  let aTag: string[] | null = null;
  if (post.naddr) {
    try {
      const decoded = nip19.decode(post.naddr.replace("nostr:", ""));
      if (decoded.type === "naddr") {
        const { identifier, pubkey, kind } = decoded.data;
        aTag = [
          "a",
          `${kind}:${pubkey}:${identifier}`,
          DEFAULT_RELAY_URL,
          "mention",
        ];
      }
    } catch (e) {
      logClientError(
        e instanceof Error ? e : new Error(String(e)),
        {
          component: "useBulkPostEvents",
          action: "decodeNaddr",
          message: "Failed to decode naddr for longform quote",
        },
        "warning"
      );
    }
  }

  const quoteTags = [
    ...tagArray,
    ...(aTag ? [aTag] : []),
    ["p", post.originalEventPubkey ?? "", "", "mention"],
  ];

  return {
    fileUrl: fileUrl ? [fileUrl] : [],
    scheduledFor: Math.floor(scheduledTime / 1000),
    caption: post.caption,
    queueType: post.queueType,
    isRecyclable: post.isRecyclable,
    originalPostId: post.originalPostId,
    originalEventId: post.originalEventId,
    originalEventPubkey: post.originalEventPubkey,
    events: {
      content: quoteContent,
      created_at: Math.floor(scheduledTime / 1000),
      kind: 1,
      tags: quoteTags,
      isQuotePost: true,
    },
  };
}

export function createRegularQuoteEvent(
  post: BulkPost,
  addTags: string,
  tagArray: string[][],
  scheduledTime: number,
  fileUrl: string
): PreparedEvent {
  const neventEncoded = nip19.neventEncode({
    id: post.originalEventId ?? "",
    relays: [DEFAULT_RELAY_URL],
    author: post.originalEventPubkey,
  });

  const quoteContent = [
    post.caption,
    `nostr:${neventEncoded}`,
    addTags.length > 10 ? "" : addTags,
  ]
    .filter(Boolean)
    .join("\n");

  const quoteTags = [
    ...tagArray,
    ["e", post.originalEventId ?? "", DEFAULT_RELAY_URL, "mention"],
    ["p", post.originalEventPubkey ?? "", "", "mention"],
  ];

  return {
    fileUrl: fileUrl ? [fileUrl] : [],
    scheduledFor: Math.floor(scheduledTime / 1000),
    caption: post.caption,
    queueType: post.queueType,
    isRecyclable: post.isRecyclable,
    originalPostId: post.originalPostId,
    originalEventId: post.originalEventId,
    originalEventPubkey: post.originalEventPubkey,
    events: {
      content: quoteContent,
      created_at: Math.floor(scheduledTime / 1000),
      kind: 1,
      tags: quoteTags,
      isQuotePost: true,
    },
  };
}

export function createQuotePostEvent(
  post: BulkPost,
  addTags: string,
  tagArray: string[][],
  scheduledTime: number,
  fileUrl: string
): PreparedEvent {
  if (post.isLongformQuote) {
    return createLongformQuoteEvent(
      post,
      addTags,
      tagArray,
      scheduledTime,
      fileUrl
    );
  }
  return createRegularQuoteEvent(
    post,
    addTags,
    tagArray,
    scheduledTime,
    fileUrl
  );
}

export function showValidationErrorToast(
  errors: string[],
  setToast: (t: ToastMessage | null) => void
): void {
  const message =
    errors.length === 1
      ? (errors[0] ?? "Validation error")
      : `${errors.length} issues found:\n• ${errors.slice(0, 3).join("\n• ")}${errors.length > 3 ? "\n• And more..." : ""}`;
  setToast({ type: "error", message });
  setTimeout(() => setToast(null), 5000);
}

export function buildUploadFormData(
  posts: BulkPost[],
  fileUrlsPerPost: string[][],
  extraFormData?: Record<string, string>
): FormData {
  const formData = new FormData();
  formData.append("fileUrls", JSON.stringify(fileUrlsPerPost));
  posts.forEach((post) => {
    formData.append("scheduledDates", post.scheduledFor);
    formData.append("queueTypes", post.queueType);
    formData.append("isRecyclable", post.isRecyclable.toString());
  });
  formData.append("_action", "_upload_images_preview");
  if (extraFormData) {
    Object.entries(extraFormData).forEach(([k, v]) => formData.append(k, v));
  }
  return formData;
}
