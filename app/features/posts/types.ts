/**
 * Post Types
 * Shared TypeScript interfaces for post and queue features
 */

/**
 * Queue type with scheduling configuration
 */
export interface QueueType {
    id?: string;
    name: string;
    color?: string | null;
    scheduleType?: "INTERVAL" | "FIXED_SLOTS";
    scheduleConfig?: {
        useGlobalInterval?: boolean;
        intervalHours?: number;
        slots?: string[];
    };
}

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
    scheduledFor?: string;
    publishedAt?: Date;
    postedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    isScheduled?: boolean;
    isPosted?: boolean;
    isPublished?: boolean;
    draft?: boolean;
    status: string;
    queueType?: {
        id: string;
        name: string;
        color?: string;
    };
    queueTypeId?: string;
    userId: string;
    tags?: string[];
    signedEvent?: any;
    nostrEvent?: any;
    nostrEventId?: string;
    manual_override?: boolean;
    postType?: string;
    repost?: boolean;
    isQuotedPost?: boolean;
    isRecyclable?: boolean;
    templateId?: string;
    originalData: any;
}

/**
 * Post job data for BullMQ workers
 */
export interface PostJobData {
    postId: string;
    userId: string;
    signedEvent: any;
}

/**
 * Longform post job data for BullMQ workers
 */
export interface LongFormPostJobData {
    postId: string;
    userId: string;
    signedEvent: any;
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
    hashtags: string[];
    createdAt: Date;
    updatedAt: Date;
}

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
    queueTypes: (QueueType | string)[];
    previewData: Map<number, { url: string; isVideo: boolean; file: File }>;
    onCaptionChange: (index: number, value: string) => void;
    onDateChange: (index: number, value: string) => void;
    onQueueTypeChange: (index: number, value: string) => void;
    onIsRecyclableChange: (index: number, checked: boolean) => void;
    onRemove: (index: number) => void;
    onMediaClick: (src: string) => void;
}
