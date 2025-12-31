/**
 * Seed Test Database
 * 
 * Utility script to seed the test database with initial data
 */

import type { Prisma } from "@prisma/client";

import { createCompleteFixtures } from "./fixtures";
import { getTestPrisma, setupTestDatabase } from "./test-db";
async function seedTestDatabase() {
  try {
    // Setup database (run migrations)
    await setupTestDatabase();

    const prisma = getTestPrisma();

    // Clear existing data
    await prisma.post.deleteMany({});
    await prisma.longFormPost.deleteMany({});
    await prisma.queueType.deleteMany({});
    await prisma.hashTagPreset.deleteMany({});
    await prisma.template.deleteMany({});
    await prisma.asset.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.user.deleteMany({});

    // Seed with complete fixtures
    const testFixtures = createCompleteFixtures();
    
    // Apply fixtures
    if (testFixtures.users) {
      for (const user of testFixtures.users) {
        await prisma.user.create({ data: user as Prisma.UserCreateInput });
      }
    }

    if (testFixtures.queueTypes) {
      for (const queueType of testFixtures.queueTypes) {
        await prisma.queueType.create({ data: queueType as Prisma.QueueTypeCreateInput });
      }
    }

    if (testFixtures.hashTagPresets) {
      for (const preset of testFixtures.hashTagPresets) {
        await prisma.hashTagPreset.create({ data: preset as Prisma.HashTagPresetCreateInput });
      }
    }

    if (testFixtures.posts) {
      for (const post of testFixtures.posts) {
        await prisma.post.create({ data: post as Prisma.PostCreateInput });
      }
    }

    if (testFixtures.longFormPosts) {
      for (const longform of testFixtures.longFormPosts) {
        await prisma.longFormPost.create({ data: longform as Prisma.LongFormPostCreateInput });
      }
    }

    console.log("✅ Test database seeded successfully");
  } catch (error) {
    console.error("❌ Failed to seed test database:", error);
    process.exit(1);
  } finally {
    const prisma = getTestPrisma();
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  seedTestDatabase();
}

export { seedTestDatabase };







