/**
 * LongFormPost factory for creating test longform posts
 * Uses builder pattern for flexible test data creation
 */

import type { LongFormPost, Status } from "@prisma/client";
import { TEST_USER_ID } from "../utils/test-helpers";

export interface LongFormPostFactoryOptions {
  id?: string;
  userId?: string;
  title?: string;
  summary?: string;
  content?: string;
  image?: string | null;
  scheduledFor?: string | null;
  isScheduled?: boolean;
  postedAt?: Date | null;
  publishedAt?: Date | null;
  isPublished?: boolean;
  draft?: boolean;
  status?: Status;
  signedEvent?: any;
  nostrEvent?: any;
  queueTypeId?: string | null;
  tags?: string[];
  hashTagPresetId?: string | null;
  nostrEventId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class LongFormPostFactory {
  private options: LongFormPostFactoryOptions;

  constructor(options: LongFormPostFactoryOptions = {}) {
    this.options = {
      id: `longform-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      userId: TEST_USER_ID,
      title: "Test Longform Post",
      summary: "Test summary",
      content: "Test content",
      image: null,
      scheduledFor: null,
      isScheduled: false,
      postedAt: null,
      publishedAt: null,
      isPublished: false,
      draft: true,
      status: "DRAFT",
      signedEvent: null,
      nostrEvent: null,
      queueTypeId: null,
      tags: [],
      hashTagPresetId: null,
      nostrEventId: null,
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

  withTitle(title: string): this {
    this.options.title = title;
    return this;
  }

  withSummary(summary: string): this {
    this.options.summary = summary;
    return this;
  }

  withContent(content: string): this {
    this.options.content = content;
    return this;
  }

  withImage(image: string): this {
    this.options.image = image;
    return this;
  }

  asDraft(): this {
    this.options.draft = true;
    this.options.isPublished = false;
    this.options.isScheduled = false;
    this.options.status = "DRAFT";
    return this;
  }

  asScheduled(scheduledFor: string | Date): this {
    this.options.isScheduled = true;
    this.options.draft = false;
    this.options.isPublished = false;
    this.options.scheduledFor =
      scheduledFor instanceof Date
        ? Math.floor(scheduledFor.getTime() / 1000).toString()
        : scheduledFor;
    return this;
  }

  asPublished(publishedAt?: Date): this {
    this.options.isPublished = true;
    this.options.draft = false;
    this.options.isScheduled = false;
    this.options.status = "ACTIVE";
    this.options.publishedAt = publishedAt || new Date();
    this.options.postedAt = publishedAt || new Date();
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

  build(): LongFormPost {
    return {
      id: this.options.id!,
      userId: this.options.userId!,
      title: this.options.title || null,
      summary: this.options.summary || null,
      content: this.options.content || null,
      image: this.options.image || null,
      scheduledFor: this.options.scheduledFor || null,
      isScheduled: this.options.isScheduled || false,
      postedAt: this.options.postedAt || null,
      publishedAt: this.options.publishedAt || null,
      isPublished: this.options.isPublished || false,
      draft: this.options.draft || false,
      status: this.options.status || "DRAFT",
      signedEvent: this.options.signedEvent || null,
      nostrEvent: this.options.nostrEvent || null,
      queueTypeId: this.options.queueTypeId || null,
      tags: this.options.tags || [],
      hashTagPresetId: this.options.hashTagPresetId || null,
      nostrEventId: this.options.nostrEventId || null,
      createdAt: this.options.createdAt || new Date(),
      updatedAt: this.options.updatedAt || new Date(),
    } as LongFormPost;
  }
}

/**
 * Convenience functions for common longform post types
 */
export const longFormPostFactory = {
  /**
   * Create a basic draft longform post
   */
  draft: (overrides?: LongFormPostFactoryOptions) => {
    return new LongFormPostFactory(overrides).asDraft().build();
  },

  /**
   * Create a scheduled longform post
   */
  scheduled: (
    scheduledFor: string | Date,
    overrides?: LongFormPostFactoryOptions,
  ) => {
    return new LongFormPostFactory(overrides).asScheduled(scheduledFor).build();
  },

  /**
   * Create a published longform post
   */
  published: (overrides?: LongFormPostFactoryOptions) => {
    return new LongFormPostFactory(overrides).asPublished().build();
  },

  /**
   * Create multiple longform posts
   */
  many: (count: number, overrides?: LongFormPostFactoryOptions) => {
    return Array.from({ length: count }, (_, i) =>
      new LongFormPostFactory({ ...overrides, id: `longform-${i + 1}` }).build(),
    );
  },
};




