/**
 * Post Types
 * Shared TypeScript interfaces for post and queue features
 */

import type {
  Post,
  LongFormPost,
  QueueType as PrismaQueueType,
  HashTagPreset as PrismaHashTagPreset,
} from "@prisma/client";
import type { FetcherWithComponents } from "@remix-run/react";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
/**
 * Schedule configuration for INTERVAL schedule type
 */
export interface IntervalScheduleConfig {
  useGlobalInterval?: boolean;
  intervalHours?: number;
}

/**
 * Schedule configuration for FIXED_SLOTS schedule type
 */
export interface FixedSlotsScheduleConfig {
  slots: string[];
}

/**
 * Union type for schedule configurations
 */
export type ScheduleConfig = IntervalScheduleConfig | FixedSlotsScheduleConfig;

/**
 * Type guard to check if config is IntervalScheduleConfig
 * Accepts unknown to handle serialized data from Remix loaders
 */
export function isIntervalScheduleConfig(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- unknown is necessary for runtime type checking of serialized data
  config: ScheduleConfig | unknown
): config is IntervalScheduleConfig {
  if (typeof config !== "object" || config === null) {
    return false;
  }

  const cfg = config as Record<string, unknown>;

  // Check if it's NOT a FixedSlotsScheduleConfig (doesn't have slots array)
  const hasSlotsArray = Array.isArray(cfg["slots"]);

  // Must have either useGlobalInterval or intervalHours, but not slots array
  return (
    !hasSlotsArray && ("useGlobalInterval" in cfg || "intervalHours" in cfg)
  );
}

/**
 * Type guard to check if config is FixedSlotsScheduleConfig
 * Accepts unknown to handle serialized data from Remix loaders
 */
export function isFixedSlotsScheduleConfig(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- unknown is necessary for runtime type checking of serialized data
  config: ScheduleConfig | unknown
): config is FixedSlotsScheduleConfig {
  if (typeof config !== "object" || config === null) {
    return false;
  }

  const cfg = config as Record<string, unknown>;

  // Must have slots array
  return Array.isArray(cfg["slots"]);
}

/**
 * Converts JsonValue to ScheduleConfig
 */
export function convertJsonValueToScheduleConfig(
  config: unknown
): ScheduleConfig | undefined {
  if (config === null || config === undefined) {
    return undefined;
  }

  if (typeof config !== "object") {
    return undefined;
  }

  const cfg = config as Record<string, unknown>;

  // Check if it's a FixedSlotsScheduleConfig
  if (Array.isArray(cfg["slots"])) {
    return { slots: cfg["slots"] as string[] };
  }

  // Check if it's an IntervalScheduleConfig
  if ("useGlobalInterval" in cfg || "intervalHours" in cfg) {
    return {
      useGlobalInterval: cfg["useGlobalInterval"] as boolean | undefined,
      intervalHours: cfg["intervalHours"] as number | undefined,
    };
  }

  return undefined;
}

/**
 * Convert Prisma QueueType (with JsonValue scheduleConfig) to features QueueType (with ScheduleConfig)
 */
export function convertPrismaQueueTypeToQueueType(
  prismaQueueType:
    | ({ scheduleConfig: unknown } & {
        id: string;
        name: string;
        color?: string | null;
        description?: string | null;
        scheduleType?: string | null;
        isEnabled?: boolean | null;
        userId: string;
      })
    | null
    | undefined
): QueueType | undefined {
  if (!prismaQueueType) {
    return undefined;
  }
  return {
    id: prismaQueueType.id,
    name: prismaQueueType.name,
    color: prismaQueueType.color,
    description: prismaQueueType.description,
    scheduleType: prismaQueueType.scheduleType as
      | "INTERVAL"
      | "FIXED_SLOTS"
      | undefined,
    scheduleConfig: convertJsonValueToScheduleConfig(
      prismaQueueType.scheduleConfig
    ),
    isEnabled: prismaQueueType.isEnabled ?? undefined,
    userId: prismaQueueType.userId,
  };
}

/**
 * Queue type with scheduling configuration
 */
export interface QueueType {
  id: string;
  name: string;
  color?: string | null;
  description?: string | null;
  scheduleType?: "INTERVAL" | "FIXED_SLOTS";
  scheduleConfig?: ScheduleConfig;
  isEnabled?: boolean;
  userId?: string;
}

/**
 * Extended queue type with relations
 */
export type QueueTypeWithRelations = PrismaQueueType & {
  hashTagPreset?: HashTagPreset | null;
};

/**
 * Bulk post data for scheduling
 */
export interface BulkPost {
  file: File | null;
  caption: string;
  queueType: string;
  scheduledFor: string;
  isRecyclable: boolean;
  fileUrl?: string;
  isRepost?: boolean;
  isKind6Repost?: boolean;
  isQuotePost?: boolean;
  isLongformQuote?: boolean;
  originalPostId?: string;
  originalEventId?: string;
  originalEventPubkey?: string;
  originalCaption?: string;
  originalTitle?: string;
  originalFileUrl?: string | string[];
  naddr?: string;
}

/**
 * Dependencies for bulk posts handlers
 */
export interface BulkPostsHandlerDeps {
  posts: BulkPost[];
  setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>;
  queueTypes: QueueType[];
  tags: string[];
  user: { id?: string; timezone?: string; scheduleInterval?: number[] } | null;
  setDisplayedHashtags: (hashtags: string | string[]) => void;
  setSelectedQueueType: (type: string) => void;
  setIsProcessing: (processing: boolean) => void;
  setProcessingProgress: (progress: { current: number; total: number }) => void;
  scheduleIntervals: number[] | undefined;
  firstItemTimeManuallyChanged: boolean;
  setFirstItemTimeManuallyChanged: (changed: boolean) => void;
}

/**
 * Post data structure for editing/displaying
 */
export interface PostData extends Omit<Post, "signedEvent" | "nostrEvent"> {
  signedEvent?: SignedEvent | null;
  nostrEvent?: NostrEvent | null;
  queueType?: QueueType | null;
  hashTagPreset?: HashTagPreset | null;
  hashtags?: string; // Space-separated hashtags string
}

/**
 * Longform post data structure for editing/displaying
 */
export interface LongFormPostData extends Omit<
  LongFormPost,
  "signedEvent" | "nostrEvent"
> {
  signedEvent?: SignedEvent | null;
  nostrEvent?: NostrEvent | null;
  queueType?: QueueType | null;
}

/**
 * Combined content for displaying posts and longform posts together
 */
export interface CombinedContent {
  id: string;
  type: "post" | "longform";
  title?: string;
  caption?: string;
  content?: string;
  summary?: string;
  image?: string;
  fileUrl?: string[];
  scheduledAtUtc?: Date | null;
  publishedAt?: Date;
  postedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  status: string;
  currentState?: string; // State machine state (single source of truth)
  queueType?: {
    id: string;
    name: string;
    color?: string;
  };
  queueTypeId?: string;
  userId: string;
  tags?: string[];
  signedEvent?: SignedEvent;
  nostrEvent?: NostrEvent;
  nostrEventId?: string;
  manual_override?: boolean;
  postType?: string;
  repost?: boolean;
  isQuotedPost?: boolean;
  isRecyclable?: boolean;
  templateId?: string;
  originalData: PostData | LongFormPostData;
}

/**
 * Post job data for BullMQ workers
 */
export interface PostJobData {
  postId: string;
  userId: string;
  signedEvent: SignedEvent;
}

/**
 * Longform post job data for BullMQ workers
 */
export interface LongFormPostJobData {
  postId: string;
  userId: string;
  signedEvent: SignedEvent;
}

/**
 * Prepared event for bulk posting operations
 */
export interface PreparedEvent {
  fileUrl: string;
  scheduledFor: number;
  caption: string;
  queueType: string;
  isRecyclable: boolean;
  originalPostId?: string;
  originalEventId?: string;
  originalEventPubkey?: string;
  events: {
    content: string;
    created_at: number;
    kind: number;
    tags: string[][];
    isQuotePost?: boolean;
  };
}

/**
 * Hashtag preset configuration
 */
export interface HashTagPreset {
  id: string;
  name: string;
  tags: string; // Stored as space-separated string
  description?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  userId?: string;
}

/**
 * Extended hashtag preset with relations
 */
export type HashTagPresetWithRelations = PrismaHashTagPreset;

/**
 * Props for HashtagPresetToggle component
 */
export interface HashtagPresetToggleProps {
  presets: HashTagPreset[];
  queueTypes: QueueType[];
  selectedQueueType: QueueType | null;
  onPresetChange: (presetId: string | null) => void;
}

/**
 * Props for HashtagPresetSelector component
 */
export interface HashtagPresetSelectorProps {
  presets: HashTagPreset[];
  selectedPresetId: string | null;
  onPresetChange: (presetId: string | null) => void;
}

/**
 * Props for BulkPostCard component
 */
export interface BulkPostCardProps {
  post: BulkPost;
  index: number;
  queueTypes: Array<QueueType | string>;
  previewData: Map<number, { url: string; isVideo: boolean; file: File }>;
  onCaptionChange: (index: number, value: string) => void;
  onDateChange: (index: number, value: string) => void;
  onQueueTypeChange: (index: number, value: string) => void;
  onIsRecyclableChange: (index: number, checked: boolean) => void;
  onRemove: (index: number) => void;
  onMediaClick: (src: string) => void;
}

/**
 * User data structure for components
 */
export interface UserData {
  id: string;
  npub?: string;
  pubKey?: string;
  name?: string | null;
  picture?: string | null;
  timezone?: string | null;
  scheduleInterval?: number[];
  userRelays?: string[];
  showHashTagsinPosts?: boolean;
  isEnabled?: boolean;
}

/**
 * Remix Fetcher type for form submissions
 */
export type PostFetcher = FetcherWithComponents<{
  success?: boolean;
  error?: string;
  needsSigning?: boolean;
  post?: PostData | LongFormPostData;
}>;

/**
 * EditorJS block data structure
 */
export interface EditorJSBlock {
  id?: string;
  type: string;
  data: Record<string, unknown>;
}

/**
 * EditorJS output data structure
 */
export interface EditorJSOutput {
  blocks: EditorJSBlock[];
  time?: number;
  version?: string;
}

/**
 * EditorJS API interface
 */
export interface EditorJSAPI {
  saver: {
    save: () => Promise<EditorJSOutput>;
  };
  blocks: {
    getCurrentBlockIndex: () => number;
    insert: (type: string, data: Record<string, unknown>) => void;
  };
  focus: () => void;
  isReady: Promise<void>;
  render: (data: EditorJSOutput) => Promise<void>;
  destroy: () => void;
}
