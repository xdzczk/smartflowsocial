/**
 * Asset factory for creating test assets
 * Uses builder pattern for flexible test data creation
 */

import type { Asset, AssetType } from "@prisma/client";

import { TEST_USER_ID } from "../utils/test-helpers";

export interface AssetFactoryOptions {
  id?: string;
  userId?: string;
  title?: string | null;
  content?: string | null;
  fileUrl?: string | null;
  tags?: string[];
  assetType?: AssetType;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AssetFactory {
  private readonly options: AssetFactoryOptions;

  constructor(options: AssetFactoryOptions = {}) {
    this.options = {
      id: `asset-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      userId: TEST_USER_ID,
      title: "Test Asset",
      content: null,
      fileUrl: null,
      tags: [],
      assetType: "TEXT",
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

  withContent(content: string): this {
    this.options.content = content;
    return this;
  }

  withFileUrl(fileUrl: string): this {
    this.options.fileUrl = fileUrl;
    return this;
  }

  withTags(tags: string[]): this {
    this.options.tags = tags;
    return this;
  }

  asText(): this {
    this.options.assetType = "TEXT";
    return this;
  }

  asImage(fileUrl: string): this {
    this.options.assetType = "IMAGE";
    this.options.fileUrl = fileUrl;
    return this;
  }

  asVideo(fileUrl: string): this {
    this.options.assetType = "VIDEO";
    this.options.fileUrl = fileUrl;
    return this;
  }

  build(): Asset {
    const asset: Asset = {
      id: this.options.id!,
      userId: this.options.userId!,
      title: this.options.title ?? null,
      content: this.options.content ?? null,
      fileUrl: this.options.fileUrl ?? null,
      tags: this.options.tags ?? [],
      assetType: this.options.assetType ?? "TEXT",
      createdAt: this.options.createdAt ?? new Date(),
      updatedAt: this.options.updatedAt ?? new Date(),
    };
    return asset;
  }
}

/**
 * Convenience functions for common asset types
 */
export const assetFactory = {
  /**
   * Create a text asset
   */
  text: (overrides?: AssetFactoryOptions) => {
    return new AssetFactory(overrides).asText().build();
  },

  /**
   * Create an image asset
   */
  image: (fileUrl: string, overrides?: AssetFactoryOptions) => {
    return new AssetFactory(overrides).asImage(fileUrl).build();
  },

  /**
   * Create a video asset
   */
  video: (fileUrl: string, overrides?: AssetFactoryOptions) => {
    return new AssetFactory(overrides).asVideo(fileUrl).build();
  },

  /**
   * Create multiple assets
   */
  many: (count: number, overrides?: AssetFactoryOptions) => {
    return Array.from({ length: count }, (_, i) =>
      new AssetFactory({ ...overrides, id: `asset-${i + 1}` }).build()
    );
  },
};
