import type { QueueType } from "~/features/posts/types";

export interface BulkPostsLoaderData {
  tags: string[];
  queueTypes: QueueType[];
  hashTagPresets: Array<{ id: string; name: string; tags: string }>;
  mode: string | null;
  groupId: string | null;
  bulkDraftGroupPosts: Array<{
    id: string;
    caption: string;
    fileUrl: string[];
    queueTypeId: string | null;
    queueType: { name: string } | null;
    scheduledAtUtc: Date | string | null;
    isRecyclable: boolean;
  }>;
}

export function extractLoaderData(data: unknown): BulkPostsLoaderData {
  const tags =
    data &&
    typeof data === "object" &&
    "tags" in data &&
    Array.isArray(data.tags)
      ? data.tags
      : [];
  const queueTypes =
    data &&
    typeof data === "object" &&
    "queueTypes" in data &&
    Array.isArray(data.queueTypes)
      ? data.queueTypes
      : [];
  const hashTagPresets =
    data &&
    typeof data === "object" &&
    "hashTagPresets" in data &&
    Array.isArray(data.hashTagPresets)
      ? data.hashTagPresets
      : [];
  const mode =
    data && typeof data === "object" && "mode" in data
      ? (data as { mode?: unknown }).mode
      : null;
  const groupId =
    data && typeof data === "object" && "groupId" in data
      ? (data as { groupId?: unknown }).groupId
      : null;
  const bulkDraftGroupPosts =
    data &&
    typeof data === "object" &&
    "bulkDraftGroupPosts" in data &&
    Array.isArray(
      (data as { bulkDraftGroupPosts?: unknown }).bulkDraftGroupPosts
    )
      ? (data as { bulkDraftGroupPosts: unknown[] }).bulkDraftGroupPosts
      : [];

  return {
    tags: tags as string[],
    queueTypes: queueTypes as QueueType[],
    hashTagPresets: hashTagPresets as Array<{
      id: string;
      name: string;
      tags: string;
    }>,
    mode: typeof mode === "string" ? mode : null,
    groupId: typeof groupId === "string" ? groupId : null,
    bulkDraftGroupPosts:
      bulkDraftGroupPosts as BulkPostsLoaderData["bulkDraftGroupPosts"],
  };
}
