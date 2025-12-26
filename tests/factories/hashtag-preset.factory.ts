/**
 * HashTagPreset factory for creating test hashtag presets
 * Uses builder pattern for flexible test data creation
 */

import type { HashTagPreset } from "@prisma/client";
import { TEST_USER_ID } from "../utils/test-helpers";

export interface HashTagPresetFactoryOptions {
  id?: string;
  userId?: string;
  name?: string;
  tags?: string;
  description?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class HashTagPresetFactory {
  private options: HashTagPresetFactoryOptions;

  constructor(options: HashTagPresetFactoryOptions = {}) {
    this.options = {
      id: `preset-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      userId: TEST_USER_ID,
      name: "Test Preset",
      tags: "#test #hashtags",
      description: null,
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

  withName(name: string): this {
    this.options.name = name;
    return this;
  }

  withTags(tags: string | string[]): this {
    this.options.tags = Array.isArray(tags) ? tags.join(" ") : tags;
    return this;
  }

  withDescription(description: string): this {
    this.options.description = description;
    return this;
  }

  build(): HashTagPreset {
    return {
      id: this.options.id!,
      userId: this.options.userId!,
      name: this.options.name!,
      tags: this.options.tags || "",
      description: this.options.description || null,
      createdAt: this.options.createdAt || new Date(),
      updatedAt: this.options.updatedAt || new Date(),
    } as HashTagPreset;
  }
}

/**
 * Convenience functions for common hashtag preset types
 */
export const hashTagPresetFactory = {
  /**
   * Create a basic hashtag preset
   */
  basic: (overrides?: HashTagPresetFactoryOptions) => {
    return new HashTagPresetFactory(overrides).build();
  },

  /**
   * Create a preset with multiple tags
   */
  withTags: (tags: string[], overrides?: HashTagPresetFactoryOptions) => {
    return new HashTagPresetFactory(overrides).withTags(tags).build();
  },

  /**
   * Create multiple presets
   */
  many: (count: number, overrides?: HashTagPresetFactoryOptions) => {
    return Array.from({ length: count }, (_, i) =>
      new HashTagPresetFactory({
        ...overrides,
        id: `preset-${i + 1}`,
        name: `Preset ${i + 1}`,
      }).build(),
    );
  },
};



