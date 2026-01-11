// Use this to create a new Nostr user and login with that user
// Simply call this with:
// npx tsx ./tests/e2e/support/create-nostr-user.ts npub1xxx
// and it will log out the cookie value you can use to interact with the server
//
// The user will be created with an ACTIVE subscription if they don't already exist.
// Each test creates a fresh user, and afterEach cleans it up.

// Load environment variables FIRST using require to ensure it runs before any imports
// This is critical because PrismaClient reads DATABASE_URL when the module is first loaded
// Using .js file ensures require() executes synchronously before imports
require("./load-env.js");

// Import PrismaClient and adapter AFTER env is loaded
// This ensures PrismaClient reads DATABASE_URL from process.env correctly
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
// Import these AFTER dotenv has loaded to ensure env vars are available
import { installGlobals } from "@remix-run/node";
import { parse } from "cookie";
import { Pool } from "pg";

installGlobals();

async function createNostrUserAndLogin(npub: string) {
  if (!npub) {
    throw new Error("npub required for login");
  }

  // Verify DATABASE_URL is set before doing anything
  let dbUrl = process.env["DATABASE_URL"];
  if (!dbUrl || dbUrl.trim() === "") {
    // Try to reload from .env file if not set
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Required for dynamic env loading, require() returns any
    const dotenv = require("dotenv");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Required for dynamic env loading, require() returns any
    const path = require("path");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- require() returns any, dotenv.config() returns any
    const result = dotenv.config({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- require() returns any
      path: path.resolve(process.cwd(), ".env"),
      override: true,
    }) as { parsed?: Record<string, string>; error?: Error };

    if (result.parsed) {
      Object.assign(process.env, result.parsed);
    }
    dbUrl = process.env["DATABASE_URL"];

    if (!dbUrl || dbUrl.trim() === "") {
      const envKeys = Object.keys(process.env).filter(
        (k) =>
          k.includes("DATABASE") || k.includes("DB") || k.includes("POSTGRES")
      );
      throw new Error(
        `DATABASE_URL environment variable is not set or is empty. Available env keys: ${envKeys.join(", ")}`
      );
    }
  }

  // Explicitly ensure DATABASE_URL is in process.env for PrismaClient
  // PrismaClient reads from process.env.DATABASE_URL when the module loads
  // Set it explicitly to ensure it's available
  process.env.DATABASE_URL = dbUrl;

  // Verify it's actually set
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "") {
    throw new Error("Failed to set DATABASE_URL in process.env");
  }

  // Create Prisma client using adapter pattern (like app/lib/prisma.server.ts and tests/database/test-db.ts)
  // This ensures DATABASE_URL is properly used
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

  // Import sessionStorage AFTER PrismaClient is created
  // This prevents env.server.ts validation from running before env vars are loaded
  // Using regular import since env vars are already loaded via require("./load-env.js")
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Required to avoid dynamic import issues, require() returns any
  const {
    sessionStorage,
  } = require("../../../app/features/auth/session.server");

  // Create or find the user
  let user = await prisma.user.findUnique({
    where: { npub },
    include: { Subscription: true },
  });

  // Ensure user exists and has an active subscription
  user = await prisma.$transaction(async (tx) => {
    let currentUser = user;

    // Create user if it doesn't exist
    if (!currentUser) {
      await tx.user.create({
        data: {
          npub,
          timezone: "UTC",
          isEnabled: true,
        },
      });
    } else {
      // Ensure user is enabled
      if (!currentUser.isEnabled) {
        await tx.user.update({
          where: { id: currentUser.id },
          data: { isEnabled: true },
        });
      }
    }

    // Fetch user with subscription to ensure type compatibility
    const userWithSub = await tx.user.findUnique({
      where: { npub },
      include: { Subscription: true },
    });

    if (!userWithSub) {
      throw new Error("Failed to create or retrieve user");
    }

    // Use the fetched user for the rest of the transaction
    currentUser = userWithSub;

    // Find or create the premium plan for full feature access during testing
    let plan = await tx.plan.findFirst({
      where: { id: "premium" },
    });

    // Fall back to any active plan
    plan ??= await tx.plan.findFirst({
      where: { isActive: true },
    });

    // If no plan exists, create a premium plan for testing
    // This plan should have all features enabled for e2e tests
    plan ??= await tx.plan.create({
      data: {
        id: "premium",
        name: "Premium",
        price: 71,
        isActive: true,
        features: {
          basicScheduling: true,
          multipleQueues: true,
          bulkScheduling: true,
          engagementFeed: true,
          giveaways: true,
        },
        enableBasicScheduling: true,
        enableMultipleQueues: true,
        enableBulkScheduling: true,
        enableEngagementFeed: true,
        enableGiveaways: true,
        enableLifetimeAccess: false,
      },
    });

    // Ensure the plan has the correct name for feature detection
    // The getUserPlanType function checks planId and plan name
    if (plan.name !== "Premium" && plan.name !== "premium") {
      plan = await tx.plan.update({
        where: { id: plan.id },
        data: { name: "Premium" },
      });
    }

    // Check if user has an active subscription
    const existingSubscription = await tx.subscription.findUnique({
      where: { userId: currentUser.id },
    });

    if (existingSubscription?.status !== "ACTIVE") {
      // Create or update subscription to be active
      const now = new Date();
      const thirtyDaysFromNow = new Date(
        now.getTime() + 30 * 24 * 60 * 60 * 1000
      );

      if (existingSubscription) {
        // Update existing subscription to be active
        await tx.subscription.update({
          where: { id: existingSubscription.id },
          data: {
            planId: plan.id,
            status: "ACTIVE",
            startDate: now,
            currentPeriodStart: now,
            currentPeriodEnd: thirtyDaysFromNow,
          },
        });
      } else {
        // Create new active subscription
        const subscriptionId = `test_sub_${Date.now()}_${currentUser.id.slice(-8)}`;
        await tx.subscription.create({
          data: {
            id: subscriptionId,
            userId: currentUser.id,
            planId: plan.id,
            status: "ACTIVE",
            startDate: now,
            currentPeriodStart: now,
            currentPeriodEnd: thirtyDaysFromNow,
          },
        });
      }
    } else if (
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Test: checking subscription state
      existingSubscription &&
      existingSubscription.planId !== plan.id
    ) {
      // Update subscription to use the premium plan
      await tx.subscription.update({
        where: { id: existingSubscription.id },
        data: { planId: plan.id },
      });
    }

    // Return user with subscription
    const userWithSubscription = await tx.user.findUnique({
      where: { id: currentUser.id },
      include: { Subscription: true },
    });

    if (!userWithSubscription) {
      throw new Error("Failed to retrieve user with subscription");
    }

    return userWithSubscription;
  });

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Test: defensive check for user creation
  if (!user) {
    throw new Error("Failed to create user");
  }

  if (!user.Subscription) {
    throw new Error("Failed to create user subscription");
  }

  // Create session directly without redirect
  // sessionStorage was dynamically imported above
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- require() returns any
  const session = await sessionStorage.getSession();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- require() returns any
  session.set("userId", user.id);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment -- require() returns any
  const cookieValue = await sessionStorage.commitSession(session, {
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  const parsedCookie = parse(cookieValue);

  // Log the cookie in a parseable format

  console.log(
    `
<cookie>
  ${parsedCookie.__session ?? ""}
</cookie>
  `.trim()
  );

  await prisma.$disconnect();

  return user;
}

async function main() {
  try {
    const npub = process.argv[2];
    if (!npub) {
      console.error("Error: npub required");
      process.exit(1);
    }

    // Validate required environment variables
    if (!process.env["DATABASE_URL"]) {
      console.error("Error: DATABASE_URL environment variable is required");
      process.exit(1);
    }
    if (!process.env["SESSION_SECRET"]) {
      console.error("Error: SESSION_SECRET environment variable is required");
      process.exit(1);
    }

    await createNostrUserAndLogin(npub);
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error creating user:", errorMessage);
    if (errorStack) {
      console.error(errorStack);
    }
    process.exit(1);
  }
}

void main();
