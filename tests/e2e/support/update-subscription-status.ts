// Use this to update a Nostr user's subscription status for testing
// Simply call this with:
// npx tsx ./tests/e2e/support/update-subscription-status.ts npub1xxx STATUS
//
// Where STATUS is one of: FREE, ACTIVE, EXPIRED, CANCELED, PAST_DUE

// Load environment variables FIRST
require("./load-env.js");

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, SubscriptionStatus } from "@prisma/client";
import { installGlobals } from "@remix-run/node";
import { Pool } from "pg";
installGlobals();

type TestSubscriptionStatus =
  | "FREE"
  | "ACTIVE"
  | "EXPIRED"
  | "CANCELED"
  | "PAST_DUE";

async function updateSubscriptionStatus(
  npub: string,
  targetStatus: TestSubscriptionStatus
) {
  if (!npub) {
    throw new Error("npub required");
  }

  // targetStatus is typed as TestSubscriptionStatus (union of string literals)
  // The check is technically unnecessary but kept for runtime safety in case of invalid input
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety check for invalid input
  if (!targetStatus) {
    throw new Error(
      "status required (FREE, ACTIVE, EXPIRED, CANCELED, PAST_DUE)"
    );
  }

  // Verify DATABASE_URL is set
  const dbUrl = process.env["DATABASE_URL"];
  if (!dbUrl || dbUrl.trim() === "") {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Create Prisma client using adapter pattern
  const pool = new Pool({
    connectionString: dbUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({
    adapter: adapter,
  });

  // Find the user
  const user = await prisma.user.findUnique({
    where: { npub },
    include: { Subscription: true },
  });

  if (!user) {
    throw new Error(`User not found: ${npub}`);
  }

  if (targetStatus === "FREE") {
    // Delete any existing subscription to simulate free user
    if (user.Subscription) {
      await prisma.subscription.delete({
        where: { userId: user.id },
      });
    }

    console.log(`<status>FREE</status>`);
  } else if (targetStatus === "ACTIVE") {
    const now = new Date();
    const thirtyDaysFromNow = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000
    );

    if (user.Subscription) {
      // Update existing subscription to active
      await prisma.subscription.update({
        where: { userId: user.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: thirtyDaysFromNow,
          cancelAtPeriodEnd: false,
        },
      });
    } else {
      // Create a new active subscription
      let plan = await prisma.plan.findFirst({
        where: { id: "premium" },
      });

      plan ??= await prisma.plan.findFirst({
        where: { isActive: true },
      });

      if (!plan) {
        throw new Error("No plan found in database");
      }

      const subscriptionId = `test_sub_${Date.now()}_${user.id.slice(-8)}`;
      await prisma.subscription.create({
        data: {
          id: subscriptionId,
          userId: user.id,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          startDate: now,
          currentPeriodStart: now,
          currentPeriodEnd: thirtyDaysFromNow,
        },
      });
    }

    console.log(`<status>ACTIVE</status>`);
  } else if (targetStatus === "EXPIRED") {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    if (user.Subscription) {
      // Update subscription to expired (INACTIVE status with past end date)
      await prisma.subscription.update({
        where: { userId: user.id },
        data: {
          status: SubscriptionStatus.INACTIVE,
          currentPeriodStart: sixtyDaysAgo,
          currentPeriodEnd: thirtyDaysAgo,
          endDate: thirtyDaysAgo,
        },
      });
    } else {
      // Create an expired subscription
      let plan = await prisma.plan.findFirst({
        where: { id: "premium" },
      });

      plan ??= await prisma.plan.findFirst({
        where: { isActive: true },
      });

      if (!plan) {
        throw new Error("No plan found in database");
      }

      const subscriptionId = `test_sub_${Date.now()}_${user.id.slice(-8)}`;
      await prisma.subscription.create({
        data: {
          id: subscriptionId,
          userId: user.id,
          planId: plan.id,
          status: SubscriptionStatus.INACTIVE,
          startDate: sixtyDaysAgo,
          currentPeriodStart: sixtyDaysAgo,
          currentPeriodEnd: thirtyDaysAgo,
          endDate: thirtyDaysAgo,
        },
      });
    }

    console.log(`<status>EXPIRED</status>`);
  } else if (targetStatus === "CANCELED") {
    const now = new Date();
    const thirtyDaysFromNow = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000
    );

    if (user.Subscription) {
      // Update subscription to canceled (still active until period end, but won't renew)
      await prisma.subscription.update({
        where: { userId: user.id },
        data: {
          status: SubscriptionStatus.CANCELED,
          currentPeriodEnd: thirtyDaysFromNow,
          cancelAtPeriodEnd: true,
        },
      });
    } else {
      // Create a canceled subscription
      let plan = await prisma.plan.findFirst({
        where: { id: "premium" },
      });

      plan ??= await prisma.plan.findFirst({
        where: { isActive: true },
      });

      if (!plan) {
        throw new Error("No plan found in database");
      }

      const subscriptionId = `test_sub_${Date.now()}_${user.id.slice(-8)}`;
      await prisma.subscription.create({
        data: {
          id: subscriptionId,
          userId: user.id,
          planId: plan.id,
          status: SubscriptionStatus.CANCELED,
          startDate: now,
          currentPeriodStart: now,
          currentPeriodEnd: thirtyDaysFromNow,
          cancelAtPeriodEnd: true,
        },
      });
    }

    console.log(`<status>CANCELED</status>`);
  } else {
    // At this point, targetStatus must be "PAST_DUE" (the only remaining option in the union type)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (user.Subscription) {
      // Update subscription to past due
      await prisma.subscription.update({
        where: { userId: user.id },
        data: {
          status: SubscriptionStatus.PAST_DUE,
          currentPeriodEnd: sevenDaysAgo,
        },
      });
    } else {
      // Create a past due subscription
      let plan = await prisma.plan.findFirst({
        where: { id: "premium" },
      });

      plan ??= await prisma.plan.findFirst({
        where: { isActive: true },
      });

      if (!plan) {
        throw new Error("No plan found in database");
      }

      const subscriptionId = `test_sub_${Date.now()}_${user.id.slice(-8)}`;
      await prisma.subscription.create({
        data: {
          id: subscriptionId,
          userId: user.id,
          planId: plan.id,
          status: SubscriptionStatus.PAST_DUE,
          startDate: sevenDaysAgo,
          currentPeriodStart: sevenDaysAgo,
          currentPeriodEnd: sevenDaysAgo,
        },
      });
    }

    console.log(`<status>PAST_DUE</status>`);
  }

  await prisma.$disconnect();
  await pool.end();
}

void updateSubscriptionStatus(
  process.argv[2],
  process.argv[3] as TestSubscriptionStatus
);
