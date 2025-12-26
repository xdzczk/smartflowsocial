// Use this to create a new Nostr user and login with that user
// Simply call this with:
// npx tsx ./tests/e2e/support/create-nostr-user.ts npub1xxx
// and it will log out the cookie value you can use to interact with the server
//
// The user will be created with an ACTIVE subscription if they don't already exist.
// Each test creates a fresh user, and afterEach cleans it up.

import { installGlobals } from "@remix-run/node";
import { parse } from "cookie";
import { PrismaClient } from "@prisma/client";

import { sessionStorage } from "../../../app/features/auth/session.server";

installGlobals();

// Create a fresh Prisma client for the script
const prisma = new PrismaClient();

async function createNostrUserAndLogin(npub: string) {
    if (!npub) {
        throw new Error("npub required for login");
    }

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
            currentUser = await tx.user.create({
                data: {
                    npub,
                    timezone: "UTC",
                    isEnabled: true,
                },
            });
        } else {
            // Ensure user is enabled
            if (!currentUser.isEnabled) {
                currentUser = await tx.user.update({
                    where: { id: currentUser.id },
                    data: { isEnabled: true },
                });
            }
        }

        // Find or create the premium plan for full feature access during testing
        let plan = await tx.plan.findFirst({
            where: { id: "premium" },
        });

        if (!plan) {
            // Fall back to any active plan
            plan = await tx.plan.findFirst({
                where: { isActive: true },
            });
        }

        // If no plan exists, create a premium plan for testing
        // This plan should have all features enabled for e2e tests
        if (!plan) {
            plan = await tx.plan.create({
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
        }
        
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

        if (!existingSubscription || existingSubscription.status !== "ACTIVE") {
            // Create or update subscription to be active
            const now = new Date();
            const thirtyDaysFromNow = new Date(
                now.getTime() + 30 * 24 * 60 * 60 * 1000,
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
        } else if (existingSubscription.planId !== plan.id) {
            // Update subscription to use the premium plan
            await tx.subscription.update({
                where: { id: existingSubscription.id },
                data: { planId: plan.id },
            });
        }

        // Return user with subscription
        return tx.user.findUnique({
            where: { id: currentUser.id },
            include: { Subscription: true },
        });
    });

    if (!user) {
        throw new Error("Failed to create user");
    }

    // Create session directly without redirect
    const session = await sessionStorage.getSession();
    session.set("userId", user.id);

    const cookieValue = await sessionStorage.commitSession(session, {
        maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    const parsedCookie = parse(cookieValue);

    // Log the cookie in a parseable format
    console.log(
        `
<cookie>
  ${parsedCookie.__session}
</cookie>
  `.trim(),
    );

    await prisma.$disconnect();
}

createNostrUserAndLogin(process.argv[2]);
