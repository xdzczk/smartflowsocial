/**
 * Post Types
 * Shared TypeScript interfaces for post and queue features
 */

import type { FetcherWithComponents } from "@remix-run/react";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import type { UploadErrorCode } from "~/features/upload/upload-error-codes";

import type {
  LongFormPost,
  Post,
  PrismaHashTagPreset,
  PrismaQueueType,
} from "./data/posts-prisma-types.server";
import { getQueueAccentHex } from "./queue-colors";
import { normalizeQueueStatus } from "./queue-status";

export type ScheduledDependencyMode = "standalone" | "attached";
export type ScheduledTargetMode = "direct" | "scheduled_parent";
export type FollowUpTimingMode = "offset_from_parent" | "fixed_datetime";
export type ScheduledSigningState =
  | "unsigned"
  | "signed"
  | "stale"
  | "invalidated";
/**
 * Schedule configuration for INTERVAL schedule type
 */
export interface IntervalScheduleConfig {
  useGlobalInterval?: boolean;
  intervalHours?: number;
  /** Post at a random time within ±N minutes (0 = off). Used for queue "next slot" nominal time. */
  scheduleRandomWindowMinutes?: number;
}

/**
 * Schedule configuration for FIXED_SLOTS schedule type
 */
export interface FixedSlotsScheduleConfig {
  slots: string[];
  /** Post at a random time within ±N minutes (0 = off). */
  scheduleRandomWindowMinutes?: number;
}

/**
 * Schedule configuration for WEEKLY_SLOTS schedule type
 * dayOfWeek: 0 = Sunday, 1 = Monday, ... 6 = Saturday
 * time: "HH:mm" in user's timezone
 */
export interface WeeklySlotsScheduleConfig {
  weeklySlots: Array<{ dayOfWeek: number; time: string }>;
  /** Post at a random time within ±N minutes (0 = off). */
  scheduleRandomWindowMinutes?: number;
}

/**
 * Union type for schedule configurations
 */
export type ScheduleConfig =
  | IntervalScheduleConfig
  | FixedSlotsScheduleConfig
  | WeeklySlotsScheduleConfig;

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
  const hasWeeklySlotsArray = Array.isArray(cfg["weeklySlots"]);

  // Must have either useGlobalInterval or intervalHours, but not slots or weeklySlots arrays
  return (
    !hasSlotsArray &&
    !hasWeeklySlotsArray &&
    ("useGlobalInterval" in cfg || "intervalHours" in cfg)
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
 * Type guard to check if config is WeeklySlotsScheduleConfig
 * Accepts unknown to handle serialized data from Remix loaders
 */
export function isWeeklySlotsScheduleConfig(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- unknown is necessary for runtime type checking of serialized data
  config: ScheduleConfig | unknown
): config is WeeklySlotsScheduleConfig {
  if (typeof config !== "object" || config === null) {
    return false;
  }

  const cfg = config as Record<string, unknown>;

  if (!Array.isArray(cfg["weeklySlots"])) {
    return false;
  }

  const weeklySlots = cfg["weeklySlots"] as unknown[];
  return weeklySlots.every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      "dayOfWeek" in entry &&
      "time" in entry &&
      typeof (entry as { dayOfWeek: unknown }).dayOfWeek === "number" &&
      typeof (entry as { time: unknown }).time === "string"
  );
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

  // Check if it's a WeeklySlotsScheduleConfig (check before slots - different array shape)
  if (Array.isArray(cfg["weeklySlots"])) {
    const weeklySlots = cfg["weeklySlots"] as Array<{
      dayOfWeek: number;
      time: string;
    }>;
    return {
      weeklySlots,
      scheduleRandomWindowMinutes:
        typeof cfg["scheduleRandomWindowMinutes"] === "number"
          ? cfg["scheduleRandomWindowMinutes"]
          : undefined,
    };
  }

  // Check if it's a FixedSlotsScheduleConfig
  if (Array.isArray(cfg["slots"])) {
    return {
      slots: cfg["slots"] as string[],
      scheduleRandomWindowMinutes:
        typeof cfg["scheduleRandomWindowMinutes"] === "number"
          ? cfg["scheduleRandomWindowMinutes"]
          : undefined,
    };
  }

  // Check if it's an IntervalScheduleConfig
  if ("useGlobalInterval" in cfg || "intervalHours" in cfg) {
    return {
      useGlobalInterval: cfg["useGlobalInterval"] as boolean | undefined,
      intervalHours: cfg["intervalHours"] as number | undefined,
      scheduleRandomWindowMinutes:
        typeof cfg["scheduleRandomWindowMinutes"] === "number"
          ? cfg["scheduleRandomWindowMinutes"]
          : undefined,
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
        status?: string | null;
        userId: string;
      })
    | null
    | undefined
): QueueType | undefined {
  if (!prismaQueueType) {
    return undefined;
  }
  const prisma = prismaQueueType as typeof prismaQueueType & {
    colorToken?: string | null;
  };
  return {
    id: prisma.id,
    name: prisma.name,
    color: getQueueAccentHex(prisma.colorToken ?? null),
    colorToken: prisma.colorToken ?? undefined,
    description: prisma.description,
    scheduleType: prisma.scheduleType as
      | "INTERVAL"
      | "FIXED_SLOTS"
      | "WEEKLY_SLOTS"
      | undefined,
    scheduleConfig: convertJsonValueToScheduleConfig(prisma.scheduleConfig),
    status: normalizeQueueStatus(prisma.status, prisma.isEnabled),
    isEnabled: prisma.isEnabled ?? undefined,
    userId: prisma.userId,
  };
}

export type QueueStatus = "active" | "paused" | "archived";
export type QueueHoldStatus =
  | "none"
  | "held_by_queue"
  | "needs_resign_after_queue_resume";

/**
 * Queue type with scheduling configuration
 */
export interface QueueType {
  id: string;
  name: string;
  color?: string | null;
  colorToken?: string | null;
  description?: string | null;
  scheduleType?: "INTERVAL" | "FIXED_SLOTS" | "WEEKLY_SLOTS";
  scheduleConfig?: ScheduleConfig;
  cadenceLabel?: string | null;
  waitingCount?: number | null;
  status?: QueueStatus | "full" | "manual" | null;
  isEnabled?: boolean;
  userId?: string;
  /** Queue default for “include hashtags in note body”; unassigned uses true. */
  includeHashtagsInNoteBody?: boolean;
}

/** Default for the per-post “include hashtags in note body” toggle when a queue is selected. */
export function defaultIncludeHashtagsForQueueSelection(
  queueKey: string,
  queueTypes: Array<QueueType | string>
): boolean {
  if (queueKey === "" || queueKey === "unassigned") return true;
  const qt = queueTypes.find((q) => {
    if (typeof q === "string") return q === queueKey;
    return q.id === queueKey || q.name === queueKey;
  });
  if (qt && typeof qt === "object" && qt.includeHashtagsInNoteBody != null) {
    return qt.includeHashtagsInNoteBody !== false;
  }
  return true;
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
  /**
   * Stable per-row id for React keys in bulk UI.
   * Must NOT change when user edits fields like caption/scheduledFor.
   */
  clientId: string;
  /** Multiple files for this row (to be uploaded). */
  files: File[];
  caption: string;
  queueType: string;
  scheduledFor: string;
  isRecyclable: boolean;
  /** Existing URLs (e.g. from draft resume). One or more URLs per row. */
  fileUrl?: string | string[];
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
  /** Optional: schedule repost(s) at delay(s) after this row's scheduled time. */
  repostSchedules?: Array<{ value: number; unit: "hours" | "minutes" }>;
  /** Optional: schedule quote(s) at delay(s) after this row's scheduled time. */
  quoteSchedules?: Array<{
    value: number;
    unit: "hours" | "minutes";
    caption?: string;
  }>;
  /** Per-row: append hashtag line into signed note body (defaults from queue on queue change). */
  includeHashtagsInNoteBody?: boolean;
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
export interface PostData extends Omit<
  Post,
  | "signedEvent"
  | "nostrEvent"
  | "queueHoldStatus"
  | "queueHeldAtUtc"
  | "queueHeldOriginalScheduledAtUtc"
  | "queueHeldByQueueTypeId"
> {
  signedEvent?: SignedEvent | null;
  nostrEvent?: NostrEvent | null;
  queueHoldStatus?: Post["queueHoldStatus"];
  queueHeldAtUtc?: Post["queueHeldAtUtc"];
  queueHeldOriginalScheduledAtUtc?: Post["queueHeldOriginalScheduledAtUtc"];
  queueHeldByQueueTypeId?: Post["queueHeldByQueueTypeId"];
  queueType?: QueueType | null;
  hashTagPreset?: HashTagPreset | null;
  hashtags?: string; // Space-separated hashtags string
}

/**
 * Longform post data structure for editing/displaying
 */
export interface LongFormPostData extends Omit<
  LongFormPost,
  | "signedEvent"
  | "nostrEvent"
  | "queueHoldStatus"
  | "queueHeldAtUtc"
  | "queueHeldOriginalScheduledAtUtc"
  | "queueHeldByQueueTypeId"
> {
  signedEvent?: SignedEvent | null;
  nostrEvent?: NostrEvent | null;
  queueHoldStatus?: LongFormPost["queueHoldStatus"];
  queueHeldAtUtc?: LongFormPost["queueHeldAtUtc"];
  queueHeldOriginalScheduledAtUtc?: LongFormPost["queueHeldOriginalScheduledAtUtc"];
  queueHeldByQueueTypeId?: LongFormPost["queueHeldByQueueTypeId"];
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
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  status: string;
  currentState?: string; // State machine state (single source of truth)
  queueType?: {
    id: string;
    name: string;
    color?: string;
    colorToken?: string | null;
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
  /** What is this post? (POST, THREAD, REPLY, REPOST, QUOTE) */
  postKind?: string;
  /** App thread group (segments from schedule-thread / post-thread). */
  threadGroupId?: string | null;
  replyToEventId?: string | null;
  replyToPostId?: string | null;
  parentScheduledActionId?: string | null;
  rootScheduledActionId?: string | null;
  targetScheduledActionId?: string | null;
  dependencyMode?: ScheduledDependencyMode;
  targetMode?: ScheduledTargetMode;
  followUpTimingMode?: FollowUpTimingMode | null;
  followUpOffsetSeconds?: number | null;
  expectedParentEventId?: string | null;
  signedChildEventId?: string | null;
  signingState?: ScheduledSigningState;
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

/** Attachment upload status (composer strip) */
export type AttachmentStatus = "queued" | "uploading" | "done" | "failed";

/** Single attachment in composer draft (client + persisted in draftMeta) */
export interface ComposerAttachment {
  localId: string;
  status: AttachmentStatus;
  url?: string;
  mime?: string;
  hash?: string;
  alt?: string;
  /** Client-only: File before upload */
  file?: File;
  /** Set when status is failed (normalized upload error). */
  uploadErrorCode?: UploadErrorCode;
  uploadErrorMessage?: string;
  /** Client-only: correlates logs per retry attempt */
  uploadAttemptId?: string;
  /** Hydrated from existing persisted media on edit flows. */
  source?: "existing" | "new";
  /** Explicit removal marker for diff-based updates. */
  markedForRemoval?: boolean;
}

/** Engagement thresholds for conditional repost (only publish if source meets all set minimums) */
export interface RepostConditions {
  minReactions?: number;
  minZaps?: number;
  minComments?: number;
  minReposts?: number;
  minSats?: number;
}

/** Also-schedule repost entry (repost of this post at scheduledFor) */
export interface AlsoScheduleRepostEntry {
  scheduledFor: number;
  /** Optional: only repost if original meets these thresholds */
  minReactions?: number;
  minZaps?: number;
  minComments?: number;
  minReposts?: number;
  minSats?: number;
}

/** Also-schedule quote entry (quote of this post at scheduledFor with optional caption) */
export interface AlsoScheduleQuoteEntry {
  scheduledFor: number;
  caption?: string;
}

/** Persisted draft meta on Post (draftMeta JSON column) */
export interface PostDraftMeta {
  attachmentMeta?: Array<{
    localId: string;
    status: AttachmentStatus;
    url?: string;
    alt?: string;
    position?: number;
  }>;
  /** @deprecated No longer written; may exist on older drafts */
  contentWithTokens?: string;
  threadSegments?: Array<{
    content: string;
    attachments: ComposerAttachment[];
  }>;
  alsoScheduleRepost?: AlsoScheduleRepostEntry[];
  alsoScheduleQuote?: AlsoScheduleQuoteEntry[];
}

/** Composer draft mode */
export type ComposerMode = "now" | "schedule" | "queue" | "thread";

/** Composer draft shape (client state + persisted via Post + draftMeta) */
export interface ComposerDraft {
  content: string;
  attachments: ComposerAttachment[];
  mode: ComposerMode;
  scheduleAt?: string;
  queueId?: string;
  tags: string[];
  alsoScheduleRepost?: AlsoScheduleRepostEntry[];
  alsoScheduleQuote?: AlsoScheduleQuoteEntry[];
  threadSegments?: Array<{
    content: string;
    attachments: ComposerAttachment[];
  }>;
  signerContext?: { type: string; pubkey?: string; lastReadyAt?: number };
}

export type ComposerContentType = "post" | "poll" | "thread" | "article";

export interface ComposerDraftEnvelope<TPayload> {
  version: number;
  contentType: ComposerContentType;
  payload: TPayload;
  savedAt: number;
}

export interface PostDraftPayload {
  content: string;
  attachments: ComposerAttachment[];
  queueType: string;
  scheduledFor?: string;
  tags: string;
}

export interface PollDraftPayload {
  question: string;
  options: string[];
  pollType: "singlechoice" | "multiplechoice";
  endsAtLocal?: string;
  queueType: string;
  scheduledFor?: string;
  tags: string;
}

export interface ThreadDraftPayload {
  segments: Array<{
    id: string;
    content: string;
    attachments: ComposerAttachment[];
  }>;
  delayMinutes: number;
  queueType: string;
  scheduledFor?: string;
  tags: string;
}

export interface ArticleDraftPayload {
  title: string;
  summary: string;
  content: string;
  image?: string;
  customTags?: string;
  queueType?: string;
  scheduledFor?: string;
}

/**
 * Prepared event for bulk posting operations
 */
export interface PreparedEvent {
  fileUrl: string[];
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
  onIncludeHashtagsInNoteBodyChange: (index: number, checked: boolean) => void;
  onIsRecyclableChange: (index: number, checked: boolean) => void;
  onRemove: (index: number) => void;
  onMediaClick: (src: string) => void;
  userTimezone?: string;
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
  timeFormat?: string | null;
  dateFormat?: string | null;
  scheduleInterval?: number[];
  userRelays?: string[];
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
