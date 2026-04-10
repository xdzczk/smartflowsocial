import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { Pool } from "pg";

const { log, error: logError } = require("./logger") as {
  log: (..._args: unknown[]) => void;
  error: (..._args: unknown[]) => void;
};

config({ path: resolve(process.cwd(), ".env") });

const DATABASE_URL = process.env["DATABASE_URL"]?.trim();
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const runSeed = args.has("--seed");
const repairOnly = args.has("--repair-only");

const FREE_PLAN_ID = "free";

async function ensureFreePlanExists(prisma: PrismaClient): Promise<void> {
  await prisma.plan.upsert({
    where: { id: FREE_PLAN_ID },
    create: {
      id: FREE_PLAN_ID,
      name: "Free",
      price: 0,
      description: "Perfect for getting started",
      features: {
        basicScheduling: true,
        multipleQueues: false,
        bulkScheduling: false,
        repostsAndQuotes: false,
        engagementFeed: true,
        giveaways: true,
        contests: true,
        commissions: "High",
        leaderboards: false,
        advancedAnalytics: false,
        multiAccountSwitching: false,
        wolfFilteringAndVortex: false,
        nativeS3BlossomStorage: false,
        relayBlast: false,
        visualPerks: false,
        lifetimeAccess: false,
      },
      maxPostsPerMonth: 10,
      maxQueueTypes: 1,
      maxTemplates: 3,
      maxLongFormPosts: 2,
      planBillingModel: "free",
      purchasable: false,
      visibleOnPricingPage: true,
      isComingSoon: false,
      isSpecialOffering: false,
      founderSeatCap: null,
      sortOrder: 10,
      enableBasicScheduling: true,
      enableMultipleQueues: false,
      enableBulkScheduling: false,
      enableRepostsAndQuotes: false,
      enableEngagementFeed: true,
      enableGiveaways: true,
      enableContests: true,
      enableCommissions: false,
      enableLeaderboards: false,
      enableAdvancedAnalytics: false,
      enableMultiAccountSwitching: false,
      enableWolfFilteringAndVortex: false,
      enableNativeS3BlossomStorage: false,
      enableRelayBlast: false,
      enableVisualPerks: false,
      enableLifetimeAccess: false,
      updatedAt: new Date(),
    },
    update: {},
  });
}

async function getMissingSubscriptionUserIds(
  prisma: PrismaClient
): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT u.id
    FROM "User" u
    LEFT JOIN "Subscription" s ON s."userId" = u.id
    WHERE s."userId" IS NULL
  `;
  return rows.map((r) => r.id);
}

async function getBrokenSubscriptionCount(
  prisma: PrismaClient
): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "Subscription" s
    WHERE s."planId" IS NULL
       OR NOT EXISTS (SELECT 1 FROM "Plan" p WHERE p.id = s."planId")
  `;
  return Number(rows[0]?.count ?? 0n);
}

async function main(): Promise<void> {
  log("== Reseed plans + backfill free ==");
  log(`mode: ${dryRun ? "dry-run" : "apply"}`);
  log(
    `seed step: ${runSeed ? "enabled (explicit)" : "skipped (safe default)"}`
  );
  log(
    `subscription scope: ${repairOnly ? "repair broken only" : "force all users to free"}`
  );

  if (runSeed) {
    if (dryRun) {
      log("[dry-run] would run: pnpm db:seed");
    } else {
      log("Running plan seed...");
      const result = spawnSync("pnpm", ["db:seed"], {
        stdio: "inherit",
        env: process.env,
      });
      if (result.status !== 0) {
        throw new Error(
          "Seed command failed. This commonly happens when subscriptions reference existing plans and seed deletes plan rows. Re-run without --seed."
        );
      }
      log("Seed completed.");
    }
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await ensureFreePlanExists(prisma);

    const before = {
      users: await prisma.user.count(),
      disabledUsers: await prisma.user.count({ where: { isEnabled: false } }),
      subscriptions: await prisma.subscription.count(),
      freeSubscriptions: await prisma.subscription.count({
        where: { planId: FREE_PLAN_ID },
      }),
      brokenSubscriptions: await getBrokenSubscriptionCount(prisma),
      usersWithoutSubscription: (await getMissingSubscriptionUserIds(prisma))
        .length,
    };
    log("Before:", before);

    if (dryRun) {
      log("Dry-run complete. No database writes were made.");
      return;
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (repairOnly) {
      const repaired = await prisma.$executeRawUnsafe(
        `
          UPDATE "Subscription" s
          SET
            "planId" = $1,
            "plan" = $1,
            "status" = 'ACTIVE',
            "billingCadence" = 'monthly',
            "accessDurationMonths" = 1,
            "paymentMethod" = 'lightning_one_time',
            "renewalMode" = 'manual',
            "renewalFailureCount" = 0,
            "lastRenewalAttemptAt" = NULL,
            "nextRenewalAttemptAt" = NULL,
            "gracePeriodEndsAt" = NULL,
            "currentPeriodStart" = $2,
            "currentPeriodEnd" = $3,
            "nextPaymentDue" = $3,
            "lastPaymentDate" = $2,
            "amountSats" = 0,
            "amountUsd" = 0,
            "cancelAtPeriodEnd" = false,
            "updatedAt" = now()
          WHERE s."planId" IS NULL
             OR NOT EXISTS (SELECT 1 FROM "Plan" p WHERE p.id = s."planId")
        `,
        FREE_PLAN_ID,
        now,
        periodEnd
      );
      log(`Repaired broken subscriptions: ${repaired}`);
    } else {
      const updated = await prisma.subscription.updateMany({
        data: {
          planId: FREE_PLAN_ID,
          plan: FREE_PLAN_ID,
          status: "ACTIVE",
          billingCadence: "monthly",
          accessDurationMonths: 1,
          paymentMethod: "lightning_one_time",
          renewalMode: "manual",
          renewalFailureCount: 0,
          lastRenewalAttemptAt: null,
          nextRenewalAttemptAt: null,
          gracePeriodEndsAt: null,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextPaymentDue: periodEnd,
          lastPaymentDate: now,
          amountSats: BigInt(0),
          amountUsd: 0,
          cancelAtPeriodEnd: false,
        },
      });
      log(`Forced subscriptions to free: ${updated.count}`);
    }

    const missingUserIds = await getMissingSubscriptionUserIds(prisma);
    if (missingUserIds.length > 0) {
      await prisma.subscription.createMany({
        data: missingUserIds.map((userId, index) => ({
          id: `sub_${userId}_${FREE_PLAN_ID}_${Date.now()}_${index}`,
          userId,
          planId: FREE_PLAN_ID,
          status: "ACTIVE",
          renewalMode: "manual",
          billingCadence: "monthly",
          accessDurationMonths: 1,
          paymentMethod: "lightning_one_time",
          startDate: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextPaymentDue: periodEnd,
          lastPaymentDate: now,
          plan: FREE_PLAN_ID,
          amountSats: BigInt(0),
          amountUsd: 0,
        })),
      });
    }
    log(`Created missing free subscriptions: ${missingUserIds.length}`);

    const reenabled = await prisma.user.updateMany({
      where: { isEnabled: false },
      data: { isEnabled: true },
    });
    log(`Re-enabled users: ${reenabled.count}`);

    const after = {
      users: await prisma.user.count(),
      disabledUsers: await prisma.user.count({ where: { isEnabled: false } }),
      subscriptions: await prisma.subscription.count(),
      freeSubscriptions: await prisma.subscription.count({
        where: { planId: FREE_PLAN_ID },
      }),
      brokenSubscriptions: await getBrokenSubscriptionCount(prisma),
      usersWithoutSubscription: (await getMissingSubscriptionUserIds(prisma))
        .length,
    };
    log("After:", after);
    log("✅ Done.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main().catch((e: unknown) => {
  logError("❌ Script failed:", e);
  process.exit(1);
});
