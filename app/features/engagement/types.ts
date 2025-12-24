/**
 * Engagement Types
 * Shared TypeScript interfaces for engagement and notification features
 */

/**
 * Statistics for a Nostr event
 */
export interface EventStats {
    likes: number;
    replies: number;
    mentions: number;
    reposts: number;
    zaps: number;
    satszapped: number;
}

/**
 * Reply notification
 */
export interface NotificationReply {
    type: "reply";
    id: string;
    eventId: string;
    content: string;
    createdAt: number;
    pubkey: string;
    authorName?: string;
    authorPicture?: string;
    authorNip05?: string;
    originalEventId: string;
    stats?: EventStats;
}

/**
 * Zap notification
 */
export interface NotificationZap {
    type: "zap";
    id: string;
    eventId: string;
    content: string;
    createdAt: number;
    senderPubkey: string;
    receiverPubkey: string;
    amountSats: number;
    senderName?: string;
    senderPicture?: string;
    senderNip05?: string;
    originalEventId: string;
    stats?: EventStats;
}

/**
 * Mention notification
 */
export interface NotificationMention {
    type: "mention";
    id: string;
    eventId: string;
    content: string;
    createdAt: number;
    pubkey: string;
    authorName?: string;
    authorPicture?: string;
    authorNip05?: string;
    originalEventId: string;
    stats?: EventStats;
}

/**
 * Quote repost notification
 */
export interface NotificationQuoteRepost {
    type: "quote";
    id: string;
    eventId: string;
    content: string;
    createdAt: number;
    pubkey: string;
    authorName?: string;
    authorPicture?: string;
    authorNip05?: string;
    originalEventId: string;
    stats?: EventStats;
}

/**
 * Union type for all notification types
 */
export type Notification =
    | NotificationReply
    | NotificationZap
    | NotificationMention
    | NotificationQuoteRepost;

/**
 * User profile data (internal)
 */
export interface UserProfile {
    name?: string;
    display_name?: string;
    picture?: string;
    nip05?: string;
}

/**
 * Parent post for grouped notifications
 */
export interface ParentPost {
    id: string;
    eventId: string;
    pubkey: string;
    caption?: string;
    title?: string;
    content?: string;
    fileUrl?: string | string[];
    postedAt?: string;
    isLongform?: boolean;
    stats?: EventStats;
}

/**
 * Grouped notifications by parent post
 */
export interface GroupedNotifications {
    parentPost: ParentPost;
    notifications: Notification[];
}

/**
 * User data for trust score calculation
 */
export interface TrustScoreUser {
    pubkey: string;
    name?: string;
    displayName?: string;
    about?: string;
    picture?: string;
    nip05?: string;
    lud16?: string;
    followsCount: number;
    followersCount: number;
    noteCount: number;
    replyCount: number;
    timeJoined: number;
    zapCount: number;
    totalSatsZapped: number;
    mediaCount: number;
}

/**
 * Muted list data
 */
export interface MutedListData {
    npubs: string[];
    lastSynced: string;
}

/**
 * Props for NotificationList component
 */
export interface NotificationListProps {
    notifications: Notification[];
    onReply?: (notification: Notification) => void;
    isLoading?: boolean;
}

/**
 * Props for GroupedNotificationList component
 */
export interface GroupedNotificationListProps {
    groupedNotifications: GroupedNotifications[];
    onReply?: (notification: Notification) => void;
    isLoading?: boolean;
}

/**
 * Props for MutedListSettings component
 */
export interface MutedListSettingsProps {
    mutedList: MutedListData | null;
    onRefresh: () => void;
    isLoading?: boolean;
}
