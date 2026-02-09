/**
 * Post factory for creating test posts
 * Uses builder pattern for flexible test data creation
 */

import type { Post, PostKind, PostType, Prisma, Status } from "@prisma/client";

import { TEST_USER_ID } from "../utils/test-helpers";

import type { NostrEvent, SignedEvent } from "~/features/nostr/types";

export interface PostFactoryOptions {
  id?: string;
  userId?: string;
  caption?: string;
  content?: string;
  fileUrl?: string[];
  scheduledFor?: string | null;
  publishedAt?: Date | null;
  currentState?: string; // State machine state - single source of truth
  postType?: PostType;
  repost?: boolean;
  isQuotedPost?: boolean;
  isRecyclable?: boolean;
  status?: Status;
  signedEvent?: SignedEvent;
  nostrEvent?: NostrEvent;
  queueTypeId?: string | null;
  tags?: string[];
  hashTagPresetId?: string | null;
  templateId?: string | null;
  nostrEventId?: string | null;
  manual_override?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  publishAttemptId?: string | null;
  creationIdempotencyKey?: string | null;
  enqueueIdempotencyKey?: string | null;
  publishingLockId?: string | null;
  publishingLockExpiresAt?: Date | null;
  publishingStartedAt?: Date | null;
  repostOfPostId?: string | null;
  quoteOfPostId?: string | null;
  quoteOfLongFormPostId?: string | null;
  draftMeta?: Prisma.JsonValue | null;
  draftGroupId?: string | null;
  threadGroupId?: string | null;
  postKind?: PostKind;
  replyToEventId?: string | null;
  replyToPostId?: string | null;
}

export class PostFactory {
  private readonly options: PostFactoryOptions;

  constructor(options: PostFactoryOptions = {}) {
    this.options = {
      id: `post-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      userId: TEST_USER_ID,
      caption: "Test post caption",
      content: "Test post content",
      fileUrl: [],
      scheduledFor: null,
      publishedAt: null,
      currentState: "DRAFT",
      postType: "IMAGE",
      repost: false,
      isQuotedPost: false,
      isRecyclable: false,
      status: "ACTIVE",
      signedEvent: undefined,
      nostrEvent: undefined,
      queueTypeId: null,
      tags: [],
      hashTagPresetId: null,
      templateId: null,
      nostrEventId: null,
      manual_override: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      publishAttemptId: null,
      creationIdempotencyKey: null,
      enqueueIdempotencyKey: null,
      publishingLockId: null,
      publishingLockExpiresAt: null,
      publishingStartedAt: null,
      ...options,
    };
  }

  withId(id: string): this {
    this.options.id = id;
    return this;
  }

  withUserId(userId: string): this {
    this.options.userId = userId;
    return this;
  }

  withCaption(caption: string): this {
    this.options.caption = caption;
    return this;
  }

  withContent(content: string): this {
    this.options.content = content;
    return this;
  }

  withFileUrl(fileUrl: string | string[]): this {
    this.options.fileUrl = Array.isArray(fileUrl) ? fileUrl : [fileUrl];
    return this;
  }

  withImages(urls: string[]): this {
    this.options.fileUrl = urls;
    this.options.postType = "IMAGE";
    return this;
  }

  withVideo(url: string): this {
    this.options.fileUrl = [url];
    this.options.postType = "VIDEO";
    return this;
  }

  asTextPost(): this {
    this.options.postType = "TEXT";
    this.options.fileUrl = [];
    return this;
  }

  asDraft(): this {
    this.options.currentState = "DRAFT";
    return this;
  }

  asScheduled(scheduledFor: string | Date): this {
    this.options.currentState = "SCHEDULED";
    this.options.scheduledFor =
      scheduledFor instanceof Date
        ? Math.floor(scheduledFor.getTime() / 1000).toString()
        : scheduledFor;
    return this;
  }

  asPosted(publishedAt?: Date): this {
    this.options.currentState = "PUBLISHED";
    this.options.publishedAt = publishedAt ?? new Date();
    this.options.nostrEventId = `event-${Date.now()}`;
    return this;
  }

  withQueueType(queueTypeId: string): this {
    this.options.queueTypeId = queueTypeId;
    return this;
  }

  withTags(tags: string[]): this {
    this.options.tags = tags;
    return this;
  }

  withHashTagPreset(hashTagPresetId: string): this {
    this.options.hashTagPresetId = hashTagPresetId;
    return this;
  }

  asRecyclable(): this {
    this.options.isRecyclable = true;
    return this;
  }

  asRepost(): this {
    this.options.repost = true;
    this.options.postKind = "REPOST";
    return this;
  }

  asQuotedPost(): this {
    this.options.isQuotedPost = true;
    this.options.postKind = "QUOTE";
    return this;
  }

  asThread(threadGroupId: string): this {
    this.options.threadGroupId = threadGroupId;
    this.options.postKind = "THREAD";
    return this;
  }

  asReply(replyToEventId: string, replyToPostId?: string | null): this {
    this.options.postKind = "REPLY";
    this.options.replyToEventId = replyToEventId;
    this.options.replyToPostId = replyToPostId ?? null;
    return this;
  }

  withSignedEvent(signedEvent: SignedEvent): this {
    this.options.signedEvent = signedEvent;
    return this;
  }

  withNostrEvent(nostrEvent: NostrEvent): this {
    this.options.nostrEvent = nostrEvent;
    // NostrEvent doesn't have an id property, so we can't set nostrEventId from it
    // nostrEventId should be set separately if needed
    return this;
  }

  withStatus(status: Status): this {
    this.options.status = status;
    return this;
  }

  build(): Post {
    const scheduledAtUtc = (() => {
      const raw = this.options.scheduledFor;
      if (!raw) return null;
      const ts = parseInt(raw, 10);
      if (!isNaN(ts)) return new Date(ts * 1000);
      const parsed = new Date(raw);
      return !isNaN(parsed.getTime()) ? parsed : null;
    })();

    // Derive postKind from relations when not explicitly set
    const postKind =
      this.options.postKind ??
      (this.options.threadGroupId != null
        ? "THREAD"
        : this.options.repostOfPostId != null
          ? "REPOST"
          : this.options.quoteOfPostId != null
            ? "QUOTE"
            : "POST");

    const post: Post = {
      id: this.options.id!,
      userId: this.options.userId!,
      caption: this.options.caption ?? null,
      content: this.options.content ?? null,
      fileUrl: this.options.fileUrl ?? [],
      scheduledAtUtc,
      publishedAt: this.options.publishedAt ?? null,
      currentState: this.options.currentState ?? "DRAFT",
      postType: this.options.postType ?? "IMAGE",
      repost: this.options.repost ?? false,
      isQuotedPost: this.options.isQuotedPost ?? false,
      isRecyclable: this.options.isRecyclable ?? false,
      createdAt: this.options.createdAt ?? new Date(),
      updatedAt: this.options.updatedAt ?? new Date(),
      status: this.options.status ?? "ACTIVE",
      signedEvent: (this.options.signedEvent ??
        null) as unknown as Prisma.JsonValue,
      nostrEvent: (this.options.nostrEvent ??
        null) as unknown as Prisma.JsonValue,
      queueTypeId: this.options.queueTypeId ?? null,
      tags: this.options.tags ?? [],
      hashTagPresetId: this.options.hashTagPresetId ?? null,
      templateId: this.options.templateId ?? null,
      nostrEventId: this.options.nostrEventId ?? null,
      manual_override: this.options.manual_override ?? false,
      publishAttemptId: this.options.publishAttemptId ?? null,
      creationIdempotencyKey: this.options.creationIdempotencyKey ?? null,
      enqueueIdempotencyKey: this.options.enqueueIdempotencyKey ?? null,
      publishingLockId: this.options.publishingLockId ?? null,
      publishingLockExpiresAt: this.options.publishingLockExpiresAt ?? null,
      publishingStartedAt: this.options.publishingStartedAt ?? null,
      repostOfPostId: this.options.repostOfPostId ?? null,
      quoteOfPostId: this.options.quoteOfPostId ?? null,
      quoteOfLongFormPostId: this.options.quoteOfLongFormPostId ?? null,
      draftMeta: this.options.draftMeta ?? null,
      draftGroupId: this.options.draftGroupId ?? null,
      threadGroupId: this.options.threadGroupId ?? null,
      postKind,
      replyToEventId: this.options.replyToEventId ?? null,
      replyToPostId: this.options.replyToPostId ?? null,
    };
    return post;
  }
}

/**
 * Convenience functions for common post types
 */
export const postFactory = {
  /**
   * Create a basic draft post
   */
  draft: (overrides?: PostFactoryOptions) => {
    return new PostFactory(overrides).asDraft().build();
  },

  /**
   * Create a scheduled post
   */
  scheduled: (scheduledFor: string | Date, overrides?: PostFactoryOptions) => {
    return new PostFactory(overrides).asScheduled(scheduledFor).build();
  },

  /**
   * Create a posted post
   */
  posted: (overrides?: PostFactoryOptions) => {
    return new PostFactory(overrides).asPosted().build();
  },

  /**
   * Create an image post
   */
  image: (urls: string[], overrides?: PostFactoryOptions) => {
    return new PostFactory(overrides).withImages(urls).build();
  },

  /**
   * Create a video post
   */
  video: (url: string, overrides?: PostFactoryOptions) => {
    return new PostFactory(overrides).withVideo(url).build();
  },

  /**
   * Create a text post
   */
  text: (content: string, overrides?: PostFactoryOptions) => {
    return new PostFactory(overrides).asTextPost().withContent(content).build();
  },

  /**
   * Create a recyclable post
   */
  recyclable: (overrides?: PostFactoryOptions) => {
    return new PostFactory(overrides).asRecyclable().build();
  },

  /**
   * Create multiple posts
   */
  many: (count: number, overrides?: PostFactoryOptions) => {
    return Array.from({ length: count }, (_, i) =>
      new PostFactory({ ...overrides, id: `post-${i + 1}` }).build()
    );
  },
};
