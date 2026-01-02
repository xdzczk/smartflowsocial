/**
 * Database Fixtures
 *
 * Pre-defined test data for database tests
 */

import type {
  User,
  Post,
  LongFormPost,
  QueueType,
  HashTagPreset,
  Payment,
  Plan,
} from "@prisma/client";

import {
  userFactory,
  postFactory,
  longFormPostFactory,
  queueTypeFactory,
  hashTagPresetFactory,
  paymentFactory,
} from "../factories";

export interface TestFixtures {
  users?: Partial<User>[];
  queueTypes?: Partial<QueueType>[];
  hashTagPresets?: Partial<HashTagPreset>[];
  posts?: Partial<Post>[];
  longFormPosts?: Partial<LongFormPost>[];
  payments?: Partial<Payment>[];
  plans?: Partial<Plan>[];
}

/**
 * Create minimal test fixtures
 */
export function createMinimalFixtures(): TestFixtures {
  const user = userFactory.basic();

  return {
    users: [user],
  };
}

/**
 * Create complete test fixtures with relationships
 */
export function createCompleteFixtures(): TestFixtures {
  const user = userFactory.basic({ id: "user-1" });
  const queue = queueTypeFactory.interval(4, {
    userId: user.id,
    id: "queue-1",
  });
  const preset = hashTagPresetFactory.basic({
    userId: user.id,
    id: "preset-1",
  });
  const post = postFactory.draft({ userId: user.id, queueTypeId: queue.id });
  const longform = longFormPostFactory.draft({
    userId: user.id,
    queueTypeId: queue.id,
  });

  return {
    users: [user],
    queueTypes: [queue],
    hashTagPresets: [preset],
    posts: [post],
    longFormPosts: [longform],
  };
}

/**
 * Create fixtures for specific test scenarios
 */
export const fixtures = {
  /**
   * Single user with no posts
   */
  singleUser: (): TestFixtures => ({
    users: [userFactory.basic({ id: "user-1" })],
  }),

  /**
   * User with queue types
   */
  userWithQueues: (): TestFixtures => {
    const user = userFactory.basic({ id: "user-1" });
    const queue1 = queueTypeFactory.interval(4, {
      userId: user.id,
      id: "queue-1",
      name: "Queue 1",
    });
    const queue2 = queueTypeFactory.fixedSlots(["09:00", "15:00"], {
      userId: user.id,
      id: "queue-2",
      name: "Queue 2",
    });

    return {
      users: [user],
      queueTypes: [queue1, queue2],
    };
  },

  /**
   * User with posts
   */
  userWithPosts: (): TestFixtures => {
    const user = userFactory.basic({ id: "user-1" });
    const queue = queueTypeFactory.interval(4, {
      userId: user.id,
      id: "queue-1",
    });
    const posts = postFactory.many(5, {
      userId: user.id,
      queueTypeId: queue.id,
    });

    return {
      users: [user],
      queueTypes: [queue],
      posts,
    };
  },

  /**
   * User with scheduled posts
   */
  userWithScheduledPosts: (): TestFixtures => {
    const user = userFactory.basic({ id: "user-1" });
    const queue = queueTypeFactory.interval(4, {
      userId: user.id,
      id: "queue-1",
    });
    const scheduledFor = new Date(Date.now() + 3600000);
    const posts = [
      postFactory.scheduled(scheduledFor, {
        userId: user.id,
        queueTypeId: queue.id,
      }),
      postFactory.scheduled(new Date(Date.now() + 7200000), {
        userId: user.id,
        queueTypeId: queue.id,
      }),
    ];

    return {
      users: [user],
      queueTypes: [queue],
      posts,
    };
  },

  /**
   * User with hashtag presets
   */
  userWithHashtagPresets: (): TestFixtures => {
    const user = userFactory.basic({ id: "user-1" });
    const presets = [
      hashTagPresetFactory.basic({
        userId: user.id,
        id: "preset-1",
        name: "Tech",
        tags: "#tech #coding",
      }),
      hashTagPresetFactory.basic({
        userId: user.id,
        id: "preset-2",
        name: "Crypto",
        tags: "#bitcoin #nostr",
      }),
    ];

    return {
      users: [user],
      hashTagPresets: presets,
    };
  },

  /**
   * User with payments
   */
  userWithPayments: (): TestFixtures => {
    const user = userFactory.basic({ id: "user-1" });
    const payments = [
      paymentFactory.paid({ userId: user.id }),
      paymentFactory.pending({ userId: user.id }),
    ];

    return {
      users: [user],
      payments,
    };
  },
};
