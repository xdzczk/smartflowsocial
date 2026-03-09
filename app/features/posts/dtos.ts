/**
 * Data Transfer Objects (DTOs) for Posts
 *
 * DTOs represent the serialized form of data that can be safely passed
 * from Remix loaders to components. Date objects are converted to ISO strings.
 */

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import { serializeDates } from "~/lib/serialization.server";
import { fromISOString, toDate } from "~/lib/temporal";

import type { LongFormPost, Post } from "./data/posts-prisma-types.server";
import type {
  PostData,
  LongFormPostData,
  QueueType,
  HashTagPreset,
} from "./types";

/**
 * PostDTO - Serialized version of PostData for Remix loaders
 * Date fields are ISO strings instead of Date objects
 */
export interface PostDTO extends Omit<
  Post,
  | "createdAt"
  | "updatedAt"
  | "publishedAt"
  | "scheduledAtUtc"
  | "publishingLockExpiresAt"
  | "publishingStartedAt"
  | "signedEvent"
  | "nostrEvent"
> {
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  scheduledAtUtc: string | null;
  publishingLockExpiresAt: string | null;
  publishingStartedAt: string | null;
  signedEvent?: SignedEvent | null;
  nostrEvent?: NostrEvent | null;
  queueType?: QueueType | null;
  hashTagPreset?: HashTagPreset | null;
  hashtags?: string;
}

/**
 * LongFormPostDTO - Serialized version of LongFormPostData for Remix loaders
 * Date fields are ISO strings instead of Date objects
 */
export interface LongFormPostDTO extends Omit<
  LongFormPost,
  | "createdAt"
  | "updatedAt"
  | "publishedAt"
  | "scheduledAtUtc"
  | "publishingLockExpiresAt"
  | "publishingStartedAt"
  | "signedEvent"
  | "nostrEvent"
> {
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  scheduledAtUtc: string | null;
  publishingLockExpiresAt: string | null;
  publishingStartedAt: string | null;
  signedEvent?: SignedEvent | null;
  nostrEvent?: NostrEvent | null;
  queueType?: QueueType | null;
}

/**
 * Converts PostData to PostDTO (serializes Date objects to strings)
 */
export function toPostDTO(post: PostData): PostDTO {
  return serializeDates(
    post as unknown as Record<string, unknown>
  ) as unknown as PostDTO;
}

/**
 * Converts array of PostData to array of PostDTO
 */
export function toPostDTOArray(posts: PostData[]): PostDTO[] {
  return posts.map((post) => toPostDTO(post));
}

/**
 * Converts PostDTO back to PostData (deserializes date strings to Date objects)
 * Use this in components when receiving data from loaders
 *
 * Note: This function manually deserializes dates to work on both client and server
 */
export function fromPostDTO(dto: PostDTO): PostData {
  const {
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    publishedAt: _publishedAt,
    scheduledAtUtc: _scheduledAtUtc,
    publishingLockExpiresAt: _publishingLockExpiresAt,
    publishingStartedAt: _publishingStartedAt,
    ...rest
  } = dto;
  // Use Temporal for 100% consistency, convert to Date at boundary
  const result: PostData = {
    ...rest,
    createdAt: toDate(fromISOString(dto.createdAt, "UTC")),
    updatedAt: toDate(fromISOString(dto.updatedAt, "UTC")),
    publishedAt: dto.publishedAt
      ? toDate(fromISOString(dto.publishedAt, "UTC"))
      : null,
    scheduledAtUtc: dto.scheduledAtUtc
      ? toDate(fromISOString(dto.scheduledAtUtc, "UTC"))
      : null,
    publishingLockExpiresAt: dto.publishingLockExpiresAt
      ? toDate(fromISOString(dto.publishingLockExpiresAt, "UTC"))
      : null,
    publishingStartedAt: dto.publishingStartedAt
      ? toDate(fromISOString(dto.publishingStartedAt, "UTC"))
      : null,
    repostOfPostId: dto.repostOfPostId ?? null,
    quoteOfPostId: dto.quoteOfPostId ?? null,
  };
  return result;
}

/**
 * Converts array of PostDTO back to array of PostData
 */
export function fromPostDTOArray(dtos: PostDTO[]): PostData[] {
  return dtos.map((dto) => fromPostDTO(dto));
}

/**
 * Converts LongFormPostData to LongFormPostDTO (serializes Date objects to strings)
 */
export function toLongFormPostDTO(post: LongFormPostData): LongFormPostDTO {
  return serializeDates(
    post as unknown as Record<string, unknown>
  ) as unknown as LongFormPostDTO;
}

/**
 * Converts array of LongFormPostData to array of LongFormPostDTO
 */
export function toLongFormPostDTOArray(
  posts: LongFormPostData[]
): LongFormPostDTO[] {
  return posts.map((post) => toLongFormPostDTO(post));
}

/**
 * Converts LongFormPostDTO back to LongFormPostData (deserializes date strings to Date objects)
 * Use this in components when receiving data from loaders
 *
 * Note: This function manually deserializes dates to work on both client and server
 */
export function fromLongFormPostDTO(dto: LongFormPostDTO): LongFormPostData {
  const {
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    publishedAt: _publishedAt,
    scheduledAtUtc: _scheduledAtUtc,
    publishingLockExpiresAt: _publishingLockExpiresAt,
    publishingStartedAt: _publishingStartedAt,
    ...rest
  } = dto;
  // Use Temporal for 100% consistency, convert to Date at boundary
  const result: LongFormPostData = {
    ...rest,
    createdAt: toDate(fromISOString(dto.createdAt, "UTC")),
    updatedAt: toDate(fromISOString(dto.updatedAt, "UTC")),
    publishedAt: dto.publishedAt
      ? toDate(fromISOString(dto.publishedAt, "UTC"))
      : null,
    scheduledAtUtc: dto.scheduledAtUtc
      ? toDate(fromISOString(dto.scheduledAtUtc, "UTC"))
      : null,
    publishingLockExpiresAt: dto.publishingLockExpiresAt
      ? toDate(fromISOString(dto.publishingLockExpiresAt, "UTC"))
      : null,
    publishingStartedAt: dto.publishingStartedAt
      ? toDate(fromISOString(dto.publishingStartedAt, "UTC"))
      : null,
  };
  return result;
}

/**
 * Converts array of LongFormPostDTO back to array of LongFormPostData
 */
export function fromLongFormPostDTOArray(
  dtos: LongFormPostDTO[]
): LongFormPostData[] {
  return dtos.map((dto) => fromLongFormPostDTO(dto));
}
