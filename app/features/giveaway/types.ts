/**
 * Giveaway Types
 * Shared TypeScript interfaces for giveaway features
 */

/**
 * Random user selected for giveaway
 */
export interface RandomUser {
    pubkey: string;
    name?: string;
    picture?: string;
}

/**
 * Collection of random users for giveaway
 */
export interface RandomUsers {
    randomUsers: RandomUser[];
    count: number;
    totalParticipants: number;
}

/**
 * Props for GiveawayPost component
 */
export interface GiveawayPostProps {
    eventId: string;
    content: string;
    createdAt: number;
    author?: {
        name?: string;
        picture?: string;
        pubkey: string;
    };
    stats?: {
        likes: number;
        replies: number;
        reposts: number;
        zaps: number;
    };
    isSelected?: boolean;
    onSelect?: () => void;
}

/**
 * Statistics for a Nostr event (Imported or redefined? It was used in GiveawayPostProps stats)
 * The original file had a stats object structure in GiveawayPostProps.
 * Let's double check `giveaway.types.ts` content.
 * It had:
 * stats?: {
 *    likes: number;
 *    replies: number;
 *    reposts: number;
 *    zaps: number;
 * };
 * It did NOT import EventStats.
 */
