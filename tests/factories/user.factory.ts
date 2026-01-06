/**
 * User factory for creating test users
 * Uses builder pattern for flexible test data creation
 */

import type { Prisma, UploadProvider, User } from "@prisma/client";

import { TEST_USER_ID } from "../utils/test-helpers";

export interface UserFactoryOptions {
  id?: string;
  npub?: string;
  isEnabled?: boolean;
  timezone?: string;
  userRelays?: string[];
  giveawayBlackListed?: string[];
  uploadProvider?: UploadProvider;
  showHashTagsinPosts?: boolean;
  scheduleInterval?: string[];
  nostrProfile?: string | Record<string, unknown> | null;
  enableMirrorBlossom?: boolean;
  mirrorUploadUrls?: string[];
  encryptedNwc?: string | null;
  nwcEnabled?: boolean;
  mutedList?: Record<string, unknown> | null;
  filterMuted?: boolean;
  hidePostsFromLowTrustUsers?: boolean;
  isChild?: boolean;
  parentNpub?: string | null;
  pendingParentRequests?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class UserFactory {
  private readonly options: UserFactoryOptions;

  constructor(options: UserFactoryOptions = {}) {
    this.options = {
      id: TEST_USER_ID,
      npub: `npub${Math.random().toString(36).substring(2, 15)}`,
      isEnabled: true,
      timezone: "America/New_York",
      userRelays: ["wss://relay.bullishbounty.com", "wss://relay.snort.social"],
      giveawayBlackListed: [],
      uploadProvider: "S3",
      showHashTagsinPosts: false,
      scheduleInterval: ["2", "4", "6", "12", "24"],
      nostrProfile: null,
      enableMirrorBlossom: false,
      mirrorUploadUrls: [],
      encryptedNwc: null,
      nwcEnabled: false,
      mutedList: { npubs: [] },
      filterMuted: false,
      hidePostsFromLowTrustUsers: false,
      isChild: false,
      parentNpub: null,
      pendingParentRequests: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...options,
    };
  }

  withId(id: string): this {
    this.options.id = id;
    return this;
  }

  withNpub(npub: string): this {
    this.options.npub = npub;
    return this;
  }

  asDisabled(): this {
    this.options.isEnabled = false;
    return this;
  }

  withTimezone(timezone: string): this {
    this.options.timezone = timezone;
    return this;
  }

  withRelays(relays: string[]): this {
    this.options.userRelays = relays;
    return this;
  }

  withBlacklist(blacklisted: string[]): this {
    this.options.giveawayBlackListed = blacklisted;
    return this;
  }

  withUploadProvider(provider: UploadProvider): this {
    this.options.uploadProvider = provider;
    return this;
  }

  withHashTagsInPosts(enabled = true): this {
    this.options.showHashTagsinPosts = enabled;
    return this;
  }

  withScheduleInterval(intervals: string[]): this {
    this.options.scheduleInterval = intervals;
    return this;
  }

  withNostrProfile(profile: string | Record<string, unknown> | null): this {
    this.options.nostrProfile = profile;
    return this;
  }

  withMutedUsers(npubs: string[]): this {
    this.options.mutedList = { npubs };
    this.options.filterMuted = true;
    return this;
  }

  withTrustFilter(enabled = true): this {
    this.options.hidePostsFromLowTrustUsers = enabled;
    return this;
  }

  asChild(parentNpub: string): this {
    this.options.isChild = true;
    this.options.parentNpub = parentNpub;
    return this;
  }

  asParent(): this {
    this.options.isChild = false;
    this.options.parentNpub = null;
    return this;
  }

  withNwc(enabled = true, encryptedNwc?: string): this {
    this.options.nwcEnabled = enabled;
    this.options.encryptedNwc = encryptedNwc ?? null;
    return this;
  }

  build(): User {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Factory pattern requires type assertion for partial data
    return {
      id: this.options.id!,
      npub: this.options.npub!,
      isEnabled: this.options.isEnabled ?? true,
      timezone: this.options.timezone ?? null,
      userRelays: this.options.userRelays ?? [],
      giveawayBlackListed: this.options.giveawayBlackListed ?? [],
      uploadProvider: this.options.uploadProvider ?? "S3",
      showHashTagsinPosts: this.options.showHashTagsinPosts ?? false,
      scheduleInterval: this.options.scheduleInterval ?? [],
      nostrProfile: (this.options.nostrProfile ??
        null) as unknown as Prisma.JsonValue,
      enableMirrorBlossom: this.options.enableMirrorBlossom ?? false,
      mirrorUploadUrls: this.options.mirrorUploadUrls ?? [],
      encryptedNwc: this.options.encryptedNwc ?? null,
      nwcEnabled: this.options.nwcEnabled ?? false,
      nwcLastUsed: null,
      mutedList: (this.options.mutedList ?? {
        npubs: [],
      }) as unknown as Prisma.JsonValue,
      filterMuted: this.options.filterMuted ?? false,
      hidePostsFromLowTrustUsers:
        this.options.hidePostsFromLowTrustUsers ?? false,
      isChild: this.options.isChild ?? false,
      parentNpub: this.options.parentNpub ?? null,
      pendingParentRequests: this.options.pendingParentRequests ?? [],
      createdAt: this.options.createdAt ?? new Date(),
      updatedAt: this.options.updatedAt ?? new Date(),
    } as User;
  }
}

/**
 * Convenience functions for common user types
 */
export const userFactory = {
  /**
   * Create a basic enabled user
   */
  basic: (overrides?: UserFactoryOptions) => {
    return new UserFactory(overrides).build();
  },

  /**
   * Create a disabled user
   */
  disabled: (overrides?: UserFactoryOptions) => {
    return new UserFactory(overrides).asDisabled().build();
  },

  /**
   * Create a child account
   */
  child: (parentNpub: string, overrides?: UserFactoryOptions) => {
    return new UserFactory(overrides).asChild(parentNpub).build();
  },

  /**
   * Create a parent account
   */
  parent: (overrides?: UserFactoryOptions) => {
    return new UserFactory(overrides).asParent().build();
  },

  /**
   * Create a user with muted users
   */
  withMutedUsers: (npubs: string[], overrides?: UserFactoryOptions) => {
    return new UserFactory(overrides).withMutedUsers(npubs).build();
  },

  /**
   * Create multiple users
   */
  many: (count: number, overrides?: UserFactoryOptions) => {
    return Array.from({ length: count }, (_, i) =>
      new UserFactory({ ...overrides, id: `user-${i + 1}` }).build()
    );
  },
};
