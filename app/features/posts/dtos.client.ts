/**
 * Client-side DTO deserialization utilities
 *
 * Use these functions in React components to deserialize DTOs received from loaders
 */

import { fromISOString, toDate } from "~/lib/temporal";

import type { PostDTO, LongFormPostDTO } from "./dtos";
import type { PostData, LongFormPostData } from "./types";

/**
 * Deserializes a PostDTO (with string dates) to PostData (with Date objects)
 */
export function deserializePostDTO(dto: PostDTO): PostData {
  // Use Temporal for 100% consistency, convert to Date at boundary
  const result: PostData = {
    ...dto,
    createdAt: toDate(fromISOString(dto.createdAt, "UTC")),
    updatedAt: toDate(fromISOString(dto.updatedAt, "UTC")),
    postedAt: dto.postedAt ? toDate(fromISOString(dto.postedAt, "UTC")) : null,
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
 * Deserializes an array of PostDTOs
 */
export function deserializePostDTOArray(dtos: PostDTO[]): PostData[] {
  return dtos.map((dto) => deserializePostDTO(dto));
}

/**
 * Deserializes a LongFormPostDTO (with string dates) to LongFormPostData (with Date objects)
 */
export function deserializeLongFormPostDTO(
  dto: LongFormPostDTO
): LongFormPostData {
  // Use Temporal for 100% consistency, convert to Date at boundary
  const result: LongFormPostData = {
    ...dto,
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
 * Deserializes an array of LongFormPostDTOs
 */
export function deserializeLongFormPostDTOArray(
  dtos: LongFormPostDTO[]
): LongFormPostData[] {
  return dtos.map((dto) => deserializeLongFormPostDTO(dto));
}
