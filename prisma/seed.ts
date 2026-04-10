import { PrismaPg } from "@prisma/adapter-pg";
import { PlanBillingModel, PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const databaseUrl = process.env["DATABASE_URL"]?.trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run prisma seed");
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log:
    process.env["NODE_ENV"] === "development" ? ["warn", "error"] : ["error"],
});

async function disconnectSeedClient(): Promise<void> {
  try {
    await prisma.$disconnect();
  } finally {
    await pool.end();
  }
}

type SeedPlan = {
  id: string;
  name: string;
  price: number;
  description: string;
  sortOrder: number;
  planBillingModel: PlanBillingModel;
  purchasable: boolean;
  visibleOnPricingPage: boolean;
  isComingSoon: boolean;
  isSpecialOffering: boolean;
  founderSeatCap: number | null;
  features: Record<string, boolean | string>;
  maxPostsPerMonth: number | null;
  maxQueueTypes: number | null;
  maxTemplates: number | null;
  maxLongFormPosts: number | null;
  enableBasicScheduling: boolean;
  enableMultipleQueues: boolean;
  enableBulkScheduling: boolean;
  enableRepostsAndQuotes: boolean;
  enableEngagementFeed: boolean;
  enableGiveaways: boolean;
  enableCommissions: boolean;
  enableLeaderboards: boolean;
  enableAdvancedAnalytics: boolean;
  enableMultiAccountSwitching: boolean;
  enableWolfFilteringAndVortex: boolean;
  enableNativeS3BlossomStorage: boolean;
  enableRelayBlast: boolean;
  enableVisualPerks: boolean;
  enableLifetimeAccess: boolean;
};

async function main() {
  console.log("🌱 Starting seed...");

  console.log("🧹 Clearing existing plans...");
  await prisma.planPrice.deleteMany({});
  await prisma.plan.deleteMany({});
  console.log("✅ Existing plans cleared");

  const plans: SeedPlan[] = [
    {
      id: "free",
      name: "Free",
      price: 0,
      description: "Learn the system",
      sortOrder: 10,
      planBillingModel: PlanBillingModel.free,
      purchasable: false,
      visibleOnPricingPage: true,
      isComingSoon: false,
      isSpecialOffering: false,
      founderSeatCap: null,
      features: {
        basicScheduling: true,
        multipleQueues: false,
        bulkScheduling: false,
        repostsAndQuotes: false,
        engagementFeed: false,
        giveaways: true,
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
      enableBasicScheduling: true,
      enableMultipleQueues: false,
      enableBulkScheduling: false,
      enableRepostsAndQuotes: false,
      enableEngagementFeed: false,
      enableGiveaways: true,
      enableCommissions: false,
      enableLeaderboards: false,
      enableAdvancedAnalytics: false,
      enableMultiAccountSwitching: false,
      enableWolfFilteringAndVortex: false,
      enableNativeS3BlossomStorage: false,
      enableRelayBlast: false,
      enableVisualPerks: false,
      enableLifetimeAccess: false,
    },
    {
      id: "starter",
      name: "Starter",
      price: 4,
      description: "Start running consistent paid workflows",
      sortOrder: 20,
      planBillingModel: PlanBillingModel.recurring,
      purchasable: true,
      visibleOnPricingPage: true,
      isComingSoon: false,
      isSpecialOffering: false,
      founderSeatCap: null,
      features: {
        basicScheduling: true,
        multipleQueues: true,
        bulkScheduling: true,
        repostsAndQuotes: true,
        engagementFeed: true,
        giveaways: true,
        commissions: "Medium",
        leaderboards: true,
        advancedAnalytics: false,
        multiAccountSwitching: false,
        wolfFilteringAndVortex: "Basic",
        nativeS3BlossomStorage: true,
        relayBlast: false,
        visualPerks: false,
        lifetimeAccess: false,
      },
      maxPostsPerMonth: 100,
      maxQueueTypes: 2,
      maxTemplates: 20,
      maxLongFormPosts: 10,
      enableBasicScheduling: true,
      enableMultipleQueues: true,
      enableBulkScheduling: true,
      enableRepostsAndQuotes: true,
      enableEngagementFeed: true,
      enableGiveaways: true,
      enableCommissions: false,
      enableLeaderboards: true,
      enableAdvancedAnalytics: false,
      enableMultiAccountSwitching: false,
      enableWolfFilteringAndVortex: true,
      enableNativeS3BlossomStorage: true,
      enableRelayBlast: false,
      enableVisualPerks: false,
      enableLifetimeAccess: false,
    },
    {
      id: "creator",
      name: "Creator",
      price: 7,
      description: "Run your content properly",
      sortOrder: 30,
      planBillingModel: PlanBillingModel.recurring,
      purchasable: true,
      visibleOnPricingPage: true,
      isComingSoon: false,
      isSpecialOffering: false,
      founderSeatCap: null,
      features: {
        basicScheduling: true,
        multipleQueues: true,
        bulkScheduling: true,
        repostsAndQuotes: true,
        engagementFeed: true,
        giveaways: true,
        commissions: "Medium",
        leaderboards: true,
        advancedAnalytics: false,
        multiAccountSwitching: false,
        wolfFilteringAndVortex: "Basic",
        nativeS3BlossomStorage: true,
        relayBlast: false,
        visualPerks: false,
        lifetimeAccess: false,
      },
      maxPostsPerMonth: 100,
      maxQueueTypes: 5,
      maxTemplates: 20,
      maxLongFormPosts: 10,
      enableBasicScheduling: true,
      enableMultipleQueues: true,
      enableBulkScheduling: true,
      enableRepostsAndQuotes: true,
      enableEngagementFeed: true,
      enableGiveaways: true,
      enableCommissions: false,
      enableLeaderboards: true,
      enableAdvancedAnalytics: false,
      enableMultiAccountSwitching: false,
      enableWolfFilteringAndVortex: true,
      enableNativeS3BlossomStorage: true,
      enableRelayBlast: false,
      enableVisualPerks: false,
      enableLifetimeAccess: false,
    },
    {
      id: "pro",
      name: "Pro",
      price: 17,
      description: "Operate at full power",
      sortOrder: 40,
      planBillingModel: PlanBillingModel.recurring,
      purchasable: true,
      visibleOnPricingPage: true,
      isComingSoon: false,
      isSpecialOffering: false,
      founderSeatCap: null,
      features: {
        basicScheduling: true,
        multipleQueues: true,
        bulkScheduling: true,
        repostsAndQuotes: true,
        engagementFeed: true,
        giveaways: true,
        commissions: "Low",
        leaderboards: true,
        advancedAnalytics: true,
        multiAccountSwitching: true,
        wolfFilteringAndVortex: true,
        nativeS3BlossomStorage: true,
        relayBlast: true,
        visualPerks: false,
        lifetimeAccess: false,
      },
      maxPostsPerMonth: 500,
      maxQueueTypes: 15,
      maxTemplates: 50,
      maxLongFormPosts: 25,
      enableBasicScheduling: true,
      enableMultipleQueues: true,
      enableBulkScheduling: true,
      enableRepostsAndQuotes: true,
      enableEngagementFeed: true,
      enableGiveaways: true,
      enableCommissions: false,
      enableLeaderboards: true,
      enableAdvancedAnalytics: true,
      enableMultiAccountSwitching: true,
      enableWolfFilteringAndVortex: true,
      enableNativeS3BlossomStorage: true,
      enableRelayBlast: true,
      enableVisualPerks: false,
      enableLifetimeAccess: false,
    },
    {
      id: "teams",
      name: "Teams",
      price: 0,
      description: "Built for collaborative publishing",
      sortOrder: 50,
      planBillingModel: PlanBillingModel.disabled,
      purchasable: false,
      visibleOnPricingPage: false,
      isComingSoon: true,
      isSpecialOffering: false,
      founderSeatCap: null,
      features: {
        basicScheduling: true,
        multipleQueues: true,
        bulkScheduling: true,
        repostsAndQuotes: true,
        engagementFeed: true,
        giveaways: true,
        commissions: "Low",
        leaderboards: true,
        advancedAnalytics: true,
        multiAccountSwitching: true,
        wolfFilteringAndVortex: true,
        nativeS3BlossomStorage: true,
        relayBlast: true,
        visualPerks: false,
        lifetimeAccess: false,
      },
      maxPostsPerMonth: null,
      maxQueueTypes: null,
      maxTemplates: null,
      maxLongFormPosts: null,
      enableBasicScheduling: true,
      enableMultipleQueues: true,
      enableBulkScheduling: true,
      enableRepostsAndQuotes: true,
      enableEngagementFeed: true,
      enableGiveaways: true,
      enableCommissions: false,
      enableLeaderboards: true,
      enableAdvancedAnalytics: true,
      enableMultiAccountSwitching: true,
      enableWolfFilteringAndVortex: true,
      enableNativeS3BlossomStorage: true,
      enableRelayBlast: true,
      enableVisualPerks: false,
      enableLifetimeAccess: false,
    },
    {
      id: "founder",
      name: "Founder",
      price: 899,
      description: "Lifetime access for early believers",
      sortOrder: 100,
      planBillingModel: PlanBillingModel.lifetime,
      purchasable: true,
      visibleOnPricingPage: true,
      isComingSoon: false,
      isSpecialOffering: true,
      founderSeatCap: 21,
      features: {
        basicScheduling: true,
        multipleQueues: true,
        bulkScheduling: true,
        repostsAndQuotes: true,
        engagementFeed: true,
        giveaways: true,
        commissions: "Very Low",
        leaderboards: true,
        advancedAnalytics: true,
        multiAccountSwitching: true,
        wolfFilteringAndVortex: true,
        nativeS3BlossomStorage: true,
        relayBlast: true,
        visualPerks: true,
        lifetimeAccess: true,
      },
      maxPostsPerMonth: null,
      maxQueueTypes: null,
      maxTemplates: null,
      maxLongFormPosts: null,
      enableBasicScheduling: true,
      enableMultipleQueues: true,
      enableBulkScheduling: true,
      enableRepostsAndQuotes: true,
      enableEngagementFeed: true,
      enableGiveaways: true,
      enableCommissions: false,
      enableLeaderboards: true,
      enableAdvancedAnalytics: true,
      enableMultiAccountSwitching: true,
      enableWolfFilteringAndVortex: true,
      enableNativeS3BlossomStorage: true,
      enableRelayBlast: true,
      enableVisualPerks: true,
      enableLifetimeAccess: true,
    },
  ];

  console.log("📋 Seeding plans...");

  for (const plan of plans) {
    console.log(`✨ Creating plan ${plan.id}...`);
    const {
      sortOrder,
      planBillingModel,
      purchasable,
      visibleOnPricingPage,
      isComingSoon,
      isSpecialOffering,
      founderSeatCap,
      ...rest
    } = plan;
    await prisma.plan.create({
      data: {
        ...rest,
        sortOrder,
        planBillingModel,
        purchasable,
        visibleOnPricingPage,
        isComingSoon,
        isSpecialOffering,
        founderSeatCap,
        isActive: true,
        updatedAt: new Date(),
      },
    });
  }

  console.log("💵 Seeding plan prices...");
  const priceMatrix: Array<{
    planId: string;
    billingCadence: "monthly" | "yearly";
    accessDurationMonths: number;
    paymentMethod:
      | "nwc_auto_renew"
      | "lightning_one_time"
      | "btc_btcpay_onchain";
    priceUsd: number;
  }> = [];

  const yearlyMultiplier = 10;

  for (const plan of plans) {
    if (plan.id === "free" || plan.id === "teams" || Number(plan.price) === 0) {
      continue;
    }

    if (plan.id === "founder") {
      const once = Number(plan.price);
      priceMatrix.push(
        {
          planId: "founder",
          billingCadence: "yearly",
          accessDurationMonths: 12,
          paymentMethod: "lightning_one_time",
          priceUsd: once,
        },
        {
          planId: "founder",
          billingCadence: "yearly",
          accessDurationMonths: 12,
          paymentMethod: "btc_btcpay_onchain",
          priceUsd: once,
        }
      );
      continue;
    }

    const monthly = Number(plan.price);
    const yearly = monthly * yearlyMultiplier;

    priceMatrix.push(
      {
        planId: plan.id,
        billingCadence: "monthly",
        accessDurationMonths: 1,
        paymentMethod: "nwc_auto_renew",
        priceUsd: monthly,
      },
      {
        planId: plan.id,
        billingCadence: "yearly",
        accessDurationMonths: 12,
        paymentMethod: "nwc_auto_renew",
        priceUsd: yearly,
      },
      {
        planId: plan.id,
        billingCadence: "monthly",
        accessDurationMonths: 1,
        paymentMethod: "lightning_one_time",
        priceUsd: monthly,
      },
      {
        planId: plan.id,
        billingCadence: "monthly",
        accessDurationMonths: 3,
        paymentMethod: "lightning_one_time",
        priceUsd: monthly * 3,
      },
      {
        planId: plan.id,
        billingCadence: "monthly",
        accessDurationMonths: 6,
        paymentMethod: "lightning_one_time",
        priceUsd: monthly * 6,
      },
      {
        planId: plan.id,
        billingCadence: "yearly",
        accessDurationMonths: 12,
        paymentMethod: "lightning_one_time",
        priceUsd: yearly,
      },
      {
        planId: plan.id,
        billingCadence: "yearly",
        accessDurationMonths: 12,
        paymentMethod: "btc_btcpay_onchain",
        priceUsd: yearly,
      }
    );
  }

  for (const row of priceMatrix) {
    await prisma.planPrice.upsert({
      where: {
        planId_billingCadence_accessDurationMonths_paymentMethod: {
          planId: row.planId,
          billingCadence: row.billingCadence,
          accessDurationMonths: row.accessDurationMonths,
          paymentMethod: row.paymentMethod,
        },
      },
      create: {
        planId: row.planId,
        billingCadence: row.billingCadence,
        accessDurationMonths: row.accessDurationMonths,
        paymentMethod: row.paymentMethod,
        priceUsd: row.priceUsd,
        isActive: true,
      },
      update: {
        priceUsd: row.priceUsd,
        isActive: true,
      },
    });
  }

  console.log("✅ Plans seeded successfully!");
  console.log("📊 Seeded plans:");
  for (const plan of plans) {
    console.log(`  - ${plan.name} (${plan.id}): $${plan.price}`);
  }
}

main()
  .then(async () => {
    await disconnectSeedClient();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:");
    console.error(e);
    await disconnectSeedClient();
    process.exit(1);
  });
