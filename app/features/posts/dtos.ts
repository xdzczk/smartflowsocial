/**
 * Data Transfer Objects (DTOs) for Posts
 *
 * DTOs represent the serialized form of data that can be safely passed
 * from Remix loaders to components. Date objects are converted to ISO strings.
 */

import type { Post, LongFormPost } from "@prisma/client";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import { serializeDates, deserializeDates } from "~/lib/serialization.server";

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
export interface PostDTO
  extends Omit<
    Post,
    "createdAt" | "updatedAt" | "postedAt" | "scheduledFor" | "signedEvent" | "nostrEvent"
  > {
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
  scheduledFor: string | null;
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
export interface LongFormPostDTO
  extends Omit<
    LongFormPost,
    | "createdAt"
    | "updatedAt"
    | "publishedAt"
    | "scheduledFor"
    | "signedEvent"
    | "nostrEvent"
  > {
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  scheduledFor: string | null;
  signedEvent?: SignedEvent | null;
  nostrEvent?: NostrEvent | null;
  queueType?: QueueType | null;
}

/**
 * Converts PostData to PostDTO (serializes Date objects to strings)
 */
export function toPostDTO(post: PostData): PostDTO {
  return serializeDates(post as unknown as Record<string, unknown>) as unknown as PostDTO;
}

/**
 * Converts array of PostData to array of PostDTO
 */
export function toPostDTOArray(posts: PostData[]): PostDTO[] {
  return posts.map(toPostDTO);
}

/**
 * Converts PostDTO back to PostData (deserializes date strings to Date objects)
 * Use this in components when receiving data from loaders
 */
export function fromPostDTO(dto: PostDTO): PostData {
  return deserializeDates(dto as unknown as Record<string, unknown>) as unknown as PostData;
}

/**
 * Converts array of PostDTO back to array of PostData
 */
export function fromPostDTOArray(dtos: PostDTO[]): PostData[] {
  return dtos.map(fromPostDTO);
}

/**
 * Converts LongFormPostData to LongFormPostDTO (serializes Date objects to strings)
 */
export function toLongFormPostDTO(post: LongFormPostData): LongFormPostDTO {
  return serializeDates(post as unknown as Record<string, unknown>) as unknown as LongFormPostDTO;
}

/**
 * Converts array of LongFormPostData to array of LongFormPostDTO
 */
export function toLongFormPostDTOArray(
  posts: LongFormPostData[],
): LongFormPostDTO[] {
  return posts.map(toLongFormPostDTO);
}

/**
 * Converts LongFormPostDTO back to LongFormPostData (deserializes date strings to Date objects)
 * Use this in components when receiving data from loaders
 */
export function fromLongFormPostDTO(dto: LongFormPostDTO): LongFormPostData {
  return deserializeDates(dto as unknown as Record<string, unknown>) as unknown as LongFormPostData;
}

/**
 * Converts array of LongFormPostDTO back to array of LongFormPostData
 */
export function fromLongFormPostDTOArray(
  dtos: LongFormPostDTO[],
): LongFormPostData[] {
  return dtos.map(fromLongFormPostDTO);
}

