/**
 * Factory for CombinedContent test data
 * Used by content-helpers and combined-content unit tests to avoid inline minimal objects and "as unknown as".
 */

import type { CombinedContent } from "~/features/posts/types";

const defaultDate = new Date();

export interface CombinedContentOverrides {
  id?: string;
  type?: "post" | "longform";
  title?: string;
  caption?: string;
  content?: string;
  summary?: string;
  image?: string;
  fileUrl?: string[];
  scheduledAtUtc?: Date | null;
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  status?: string;
  currentState?: string;
  userId?: string;
  queueType?: {
    id: string;
    name: string;
    color?: string;
    colorToken?: string | null;
  };
  queueTypeId?: string;
  tags?: string[];
  postKind?: string;
  postType?: string;
  repost?: boolean;
  isQuotedPost?: boolean;
  isRecyclable?: boolean;
  signedEvent?: { kind: number };
  nostrEvent?: unknown;
  originalData?: Record<string, unknown>;
  [key: string]: unknown;
}

function createBase(overrides: CombinedContentOverrides = {}): CombinedContent {
  const id = overrides.id ?? "1";
  const type = overrides.type ?? "post";
  const createdAt = overrides.createdAt ?? defaultDate;
  const updatedAt = overrides.updatedAt ?? defaultDate;
  const status = overrides.status ?? "ACTIVE";
  const userId = overrides.userId ?? "user-123";

  const baseOriginal: CombinedContent["originalData"] =
    (overrides.originalData ?? {
      id,
      currentState: overrides.currentState,
    }) as unknown as CombinedContent["originalData"];

  const out = {
    id,
    type,
    createdAt,
    updatedAt,
    status,
    userId,
    originalData: baseOriginal,
    ...overrides,
  };

  return out as CombinedContent;
}

/**
 * Create a CombinedContent item of type "post" with optional overrides.
 */
export function combinedContentPost(
  overrides: CombinedContentOverrides = {}
): CombinedContent {
  return createBase({ type: "post", ...overrides });
}

/**
 * Create a CombinedContent item of type "longform" with optional overrides.
 */
export function combinedContentLongform(
  overrides: CombinedContentOverrides = {}
): CombinedContent {
  return createBase({ type: "longform", ...overrides });
}

export const combinedContentFactory = {
  post: combinedContentPost,
  longform: combinedContentLongform,
};
