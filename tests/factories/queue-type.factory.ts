/**
 * QueueType factory for creating test queue types
 * Uses builder pattern for flexible test data creation
 */

import type { QueueType, ScheduleType } from "@prisma/client";
import { TEST_USER_ID } from "../utils/test-helpers";

export interface QueueTypeFactoryOptions {
  id?: string;
  userId?: string;
  name?: string;
  scheduleType?: ScheduleType;
  scheduleConfig?: any;
  isEnabled?: boolean;
  color?: string | null;
  description?: string | null;
  lastPostTime?: Date | null;
  isDefault?: boolean;
  hashTagPresetId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class QueueTypeFactory {
  private options: QueueTypeFactoryOptions;

  constructor(options: QueueTypeFactoryOptions = {}) {
    this.options = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      userId: TEST_USER_ID,
      name: "Test Queue",
      scheduleType: "INTERVAL",
      scheduleConfig: { intervalHours: 4 },
      isEnabled: true,
      color: "#3B82F6",
      description: null,
      lastPostTime: null,
      isDefault: false,
      hashTagPresetId: null,
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

  asInterval(intervalHours: number, useGlobalInterval: boolean = false): this {
    this.options.scheduleType = "INTERVAL";
    this.options.scheduleConfig = {
      intervalHours,
      useGlobalInterval,
    };
    return this;
  }

  asFixedSlots(slots: string[]): this {
    this.options.scheduleType = "FIXED_SLOTS";
    this.options.scheduleConfig = { slots };
    return this;
  }

  withHashTagPreset(hashTagPresetId: string): this {
    this.options.hashTagPresetId = hashTagPresetId;
    return this;
  }

  asDefault(): this {
    this.options.isDefault = true;
    return this;
  }

  asDisabled(): this {
    this.options.isEnabled = false;
    return this;
  }

  withColor(color: string): this {
    this.options.color = color;
    return this;
  }

  withDescription(description: string): this {
    this.options.description = description;
    return this;
  }

  withLastPostTime(lastPostTime: Date): this {
    this.options.lastPostTime = lastPostTime;
    return this;
  }

  build(): QueueType {
    return {
      id: this.options.id!,
      userId: this.options.userId!,
      name: this.options.name!,
      scheduleType: this.options.scheduleType || "INTERVAL",
      scheduleConfig: this.options.scheduleConfig || { intervalHours: 4 },
      isEnabled: this.options.isEnabled ?? true,
      color: this.options.color || null,
      description: this.options.description || null,
      lastPostTime: this.options.lastPostTime || null,
      isDefault: this.options.isDefault || false,
      hashTagPresetId: this.options.hashTagPresetId || null,
      createdAt: this.options.createdAt || new Date(),
      updatedAt: this.options.updatedAt || new Date(),
    } as QueueType;
  }
}

/**
 * Convenience functions for common queue type configurations
 */
export const queueTypeFactory = {
  /**
   * Create an interval-based queue
   */
  interval: (intervalHours: number, overrides?: QueueTypeFactoryOptions) => {
    return new QueueTypeFactory(overrides).asInterval(intervalHours).build();
  },

  /**
   * Create a fixed slots queue
   */
  fixedSlots: (slots: string[], overrides?: QueueTypeFactoryOptions) => {
    return new QueueTypeFactory(overrides).asFixedSlots(slots).build();
  },

  /**
   * Create a default queue
   */
  default: (overrides?: QueueTypeFactoryOptions) => {
    return new QueueTypeFactory(overrides).asDefault().build();
  },

  /**
   * Create multiple queue types
   */
  many: (count: number, overrides?: QueueTypeFactoryOptions) => {
    return Array.from({ length: count }, (_, i) =>
      new QueueTypeFactory({
        ...overrides,
        id: `queue-${i + 1}`,
        name: `Queue ${i + 1}`,
      }).build(),
    );
  },
};

