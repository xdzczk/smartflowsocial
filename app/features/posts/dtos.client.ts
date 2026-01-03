/**
 * Client-side DTO deserialization utilities
 *
 * Use these functions in React components to deserialize DTOs received from loaders
 */

import type { PostDTO, LongFormPostDTO } from "./dtos";
import type { PostData, LongFormPostData } from "./types";

/**
 * Deserializes a PostDTO (with string dates) to PostData (with Date objects)
 */
export function deserializePostDTO(dto: PostDTO): PostData {
  const result: PostData = {
    ...dto,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
    postedAt: dto.postedAt ? new Date(dto.postedAt) : null,
    scheduledFor: dto.scheduledFor ?? null,
  };
  return result;
}

/**
 * Deserializes an array of PostDTOs
 */
export function deserializePostDTOArray(dtos: PostDTO[]): PostData[] {
  return dtos.map(deserializePostDTO);
}

/**
 * Deserializes a LongFormPostDTO (with string dates) to LongFormPostData (with Date objects)
 */
export function deserializeLongFormPostDTO(
  dto: LongFormPostDTO,
): LongFormPostData {
  const result: LongFormPostData = {
    ...dto,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
    publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
    scheduledFor: dto.scheduledFor ?? null,
  };
  return result;
}

/**
 * Deserializes an array of LongFormPostDTOs
 */
export function deserializeLongFormPostDTOArray(
  dtos: LongFormPostDTO[],
): LongFormPostData[] {
  return dtos.map(deserializeLongFormPostDTO);
}

