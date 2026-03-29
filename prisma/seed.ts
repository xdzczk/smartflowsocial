import { PrismaClient } from "@prisma/client";

const prisma: PrismaClient = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // Clear existing plans first to avoid duplicates
  console.log("🧹 Clearing existing plans...");
  await prisma.planPrice.deleteMany({});
  await prisma.plan.deleteMany({});
  console.log("✅ Existing plans cleared");

  // Define plans based on the hardcoded plans in app/routes/plans.tsx
  const plans = [
    {
      id: "free",
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
      enableEngagementFeed: true,
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
      id: "basic",
      name: "Basic",
      price: 28,
      description: "For growing creators",
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
      id: "premium",
      name: "Premium",
      price: 71,
      description: "For serious content creators",
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
      id: "founder",
      name: "Founder",
      price: 2600,
      description: "For early supporters and power users",
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
      maxPostsPerMonth: null, // Unlimited
      maxQueueTypes: null, // Unlimited
      maxTemplates: null, // Unlimited
      maxLongFormPosts: null, // Unlimited
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
    await prisma.plan.create({
      data: {
        ...plan,
        isActive: true, // Explicitly set to true to ensure all plans are active
        updatedAt: new Date(),
      },
    });
  }

  console.log("💵 Seeding plan prices (v1.5 SKUs)...");
  // Explicit pricing matrix (USD is source of truth).
  // Allowed combinations:
  // - NWC auto-renew: monthly(1), yearly(12)
  // - Manual Lightning: monthly(1/3/6), yearly(12)
  //
  // IMPORTANT: Update these numbers to match your intended discount ladder.
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

  for (const plan of plans) {
    // Skip free plan SKUs (no invoicing)
    if (plan.id === "free" || Number(plan.price) === 0) continue;

    // Base monthly price comes from Plan.price
    const monthly = Number(plan.price);
    // Default yearly anchor: 12 months (no discount unless adjusted below)
    const yearly = monthly * 12;

    // NWC recurring SKUs
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
      }
    );

    // Manual monthly prepay SKUs (edit these totals as desired)
    priceMatrix.push(
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

  const founderPlan = plans.find((p) => p.id === "founder");
  if (founderPlan) {
    const founderUsd = Number(founderPlan.price);
    await prisma.planPrice.upsert({
      where: {
        planId_billingCadence_accessDurationMonths_paymentMethod: {
          planId: "founder",
          billingCadence: "monthly",
          accessDurationMonths: 1,
          paymentMethod: "btc_btcpay_onchain",
        },
      },
      create: {
        planId: "founder",
        billingCadence: "monthly",
        accessDurationMonths: 1,
        paymentMethod: "btc_btcpay_onchain",
        priceUsd: founderUsd,
        isActive: true,
      },
      update: {
        priceUsd: founderUsd,
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
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:");
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
