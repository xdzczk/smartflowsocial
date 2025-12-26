/**
 * Post factory for creating test posts
 * Uses builder pattern for flexible test data creation
 */

import type { Post, PostType, Status } from "@prisma/client";
import { TEST_USER_ID } from "../utils/test-helpers";

export interface PostFactoryOptions {
  id?: string;
  userId?: string;
  caption?: string;
  content?: string;
  fileUrl?: string[];
  scheduledFor?: string | null;
  postedAt?: Date | null;
  isPosted?: boolean;
  isScheduled?: boolean;
  postType?: PostType;
  repost?: boolean;
  isQuotedPost?: boolean;
  isRecyclable?: boolean;
  draft?: boolean;
  status?: Status;
  signedEvent?: any;
  nostrEvent?: any;
  queueTypeId?: string | null;
  tags?: string[];
  hashTagPresetId?: string | null;
  templateId?: string | null;
  nostrEventId?: string | null;
  manual_override?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PostFactory {
  private options: PostFactoryOptions;

  constructor(options: PostFactoryOptions = {}) {
    this.options = {
      id: `post-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      userId: TEST_USER_ID,
      caption: "Test post caption",
      content: "Test post content",
      fileUrl: [],
      scheduledFor: null,
      postedAt: null,
      isPosted: false,
      isScheduled: false,
      postType: "IMAGE",
      repost: false,
      isQuotedPost: false,
      isRecyclable: false,
      draft: false,
      status: "ACTIVE",
      signedEvent: null,
      nostrEvent: null,
      queueTypeId: null,
      tags: [],
      hashTagPresetId: null,
      templateId: null,
      nostrEventId: null,
      manual_override: false,
      createdAt: new Date(),
      updatedAt: new Date(),
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
    this.options.draft = true;
    this.options.isPosted = false;
    this.options.isScheduled = false;
    return this;
  }

  asScheduled(scheduledFor: string | Date): this {
    this.options.isScheduled = true;
    this.options.draft = false;
    this.options.isPosted = false;
    this.options.scheduledFor =
      scheduledFor instanceof Date
        ? Math.floor(scheduledFor.getTime() / 1000).toString()
        : scheduledFor;
    return this;
  }

  asPosted(postedAt?: Date): this {
    this.options.isPosted = true;
    this.options.draft = false;
    this.options.isScheduled = false;
    this.options.postedAt = postedAt || new Date();
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
    return this;
  }

  asQuotedPost(): this {
    this.options.isQuotedPost = true;
    return this;
  }

  withSignedEvent(signedEvent: any): this {
    this.options.signedEvent = signedEvent;
    return this;
  }

  withNostrEvent(nostrEvent: any): this {
    this.options.nostrEvent = nostrEvent;
    this.options.nostrEventId = nostrEvent?.id || null;
    return this;
  }

  withStatus(status: Status): this {
    this.options.status = status;
    return this;
  }

  build(): Post {
    return {
      id: this.options.id!,
      userId: this.options.userId!,
      caption: this.options.caption || null,
      content: this.options.content || null,
      fileUrl: this.options.fileUrl || [],
      scheduledFor: this.options.scheduledFor || null,
      postedAt: this.options.postedAt || null,
      isPosted: this.options.isPosted || false,
      isScheduled: this.options.isScheduled || false,
      postType: this.options.postType || "IMAGE",
      repost: this.options.repost || false,
      isQuotedPost: this.options.isQuotedPost || false,
      isRecyclable: this.options.isRecyclable || false,
      createdAt: this.options.createdAt || new Date(),
      updatedAt: this.options.updatedAt || new Date(),
      draft: this.options.draft || false,
      status: this.options.status || "ACTIVE",
      signedEvent: this.options.signedEvent || null,
      nostrEvent: this.options.nostrEvent || null,
      queueTypeId: this.options.queueTypeId || null,
      tags: this.options.tags || [],
      hashTagPresetId: this.options.hashTagPresetId || null,
      templateId: this.options.templateId || null,
      nostrEventId: this.options.nostrEventId || null,
      manual_override: this.options.manual_override || false,
    } as Post;
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
      new PostFactory({ ...overrides, id: `post-${i + 1}` }).build(),
    );
  },
};



