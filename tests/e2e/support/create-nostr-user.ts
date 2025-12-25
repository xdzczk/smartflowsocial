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

    if (!user) {
        // Create user with a subscription in a transaction
        user = await prisma.$transaction(async (tx) => {
            // Create the user
            const newUser = await tx.user.create({
                data: {
                    npub,
                    timezone: "UTC",
                    isEnabled: true,
                },
            });

            // Find the premium plan for full feature access during testing
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

            // Create an active subscription with a valid planId
            const subscriptionId = `test_sub_${Date.now()}_${newUser.id.slice(-8)}`;
            const now = new Date();
            const thirtyDaysFromNow = new Date(
                now.getTime() + 30 * 24 * 60 * 60 * 1000,
            );

            await tx.subscription.create({
                data: {
                    id: subscriptionId,
                    userId: newUser.id,
                    planId: plan.id, // Always set planId
                    status: "ACTIVE",
                    startDate: now,
                    currentPeriodStart: now,
                    currentPeriodEnd: thirtyDaysFromNow,
                },
            });

            // Return user with subscription
            return tx.user.findUnique({
                where: { id: newUser.id },
                include: { Subscription: true },
            });
        });
    }

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
