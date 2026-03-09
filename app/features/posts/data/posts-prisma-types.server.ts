/**
 * Posts feature Prisma type re-exports. All @prisma/client type usage for posts stays here.
 */

export type {
  Post,
  LongFormPost,
  PostType,
  PostKind,
  QueueType,
  QueueType as PrismaQueueType,
  HashTagPreset as PrismaHashTagPreset,
} from "@prisma/client";
export { Prisma } from "@prisma/client";
