// Use this to delete a Nostr user by their npub
// Simply call this with:
// npx tsx ./tests/e2e/support/delete-nostr-user.ts npub1xxx

import { PrismaClient } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { installGlobals } from "@remix-run/node";

installGlobals();

// Create a fresh Prisma client for the script
const prisma = new PrismaClient();

async function deleteNostrUser(npub: string) {
    if (!npub) {
        throw new Error("npub required");
    }

    try {
        await prisma.user.delete({ where: { npub } });
        // eslint-disable-next-line no-console
        console.log("User deleted successfully");
    } catch (error) {
        if (
            error instanceof PrismaClientKnownRequestError &&
            error.code === "P2025"
        ) {
            // eslint-disable-next-line no-console
            console.log("User not found, so no need to delete");
        } else {
            throw error;
        }
    } finally {
        await prisma.$disconnect();
    }
}

deleteNostrUser(process.argv[2]);
