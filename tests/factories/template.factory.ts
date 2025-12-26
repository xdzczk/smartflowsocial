/**
 * Template factory for creating test templates
 * Uses builder pattern for flexible test data creation
 */

import type { Template } from "@prisma/client";

import { TEST_USER_ID } from "../utils/test-helpers";

export interface TemplateFactoryOptions {
  id?: string;
  userId?: string;
  name?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class TemplateFactory {
  private options: TemplateFactoryOptions;

  constructor(options: TemplateFactoryOptions = {}) {
    this.options = {
      id: `template-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      userId: TEST_USER_ID,
      name: "Test Template",
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

  build(): Template {
    return {
      id: this.options.id!,
      userId: this.options.userId!,
      name: this.options.name || null,
      createdAt: this.options.createdAt || new Date(),
      updatedAt: this.options.updatedAt || new Date(),
    } as Template;
  }
}

/**
 * Convenience functions for common template types
 */
export const templateFactory = {
  /**
   * Create a basic template
   */
  basic: (overrides?: TemplateFactoryOptions) => {
    return new TemplateFactory(overrides).build();
  },

  /**
   * Create multiple templates
   */
  many: (count: number, overrides?: TemplateFactoryOptions) => {
    return Array.from({ length: count }, (_, i) =>
      new TemplateFactory({
        ...overrides,
        id: `template-${i + 1}`,
        name: `Template ${i + 1}`,
      }).build(),
    );
  },
};




