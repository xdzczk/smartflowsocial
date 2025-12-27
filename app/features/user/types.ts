/**
 * User Types
 * Shared TypeScript interfaces for user features
 */

/**
 * Parameters for updating user profile
 */
export interface UpdateUserProfileParams {
    userId: string;
    data: {
        npub?: string;
        pubKey?: string;
        name?: string;
        picture?: string;
        isEnabled?: boolean;
        timezone?: string;
        scheduleInterval?: number[];
        userRelays?: string[];
        hashtagPresets?: unknown;
        nwcUri?: string;
        autoRenewalEnabled?: boolean;
        receivePostNotifications?: boolean;
        receiveZapReminders?: boolean;
        blossomEndpoint?: string;
        blossomMediaMirrors?: string[];
    };
}

/**
 * Child account data for account switching
 */
export interface ChildAccount {
    id: string;
    npub: string;
    name?: string | null;
    picture?: string | null;
    pubKey: string;
}

/**
 * Account info for settings display
 */
export interface AccountInfo {
    id: string;
    npub: string;
    name?: string | null;
    picture?: string | null;
}

/**
 * Search result for user lookup
 */
export interface SearchResult {
    pubkey: string;
    name?: string;
    picture?: string;
    nip05?: string;
}
