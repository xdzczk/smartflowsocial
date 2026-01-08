// Use this to delete a Nostr user by their npub
// Simply call this with:
// npx tsx ./tests/e2e/support/delete-nostr-user.ts npub1xxx

import { PrismaClient } from "@prisma/client";
// @ts-expect-error - PrismaClientKnownRequestError is available at runtime but types may not be fully exported
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

    console.log("User deleted successfully");
  } catch (error: unknown) {
    if (error instanceof PrismaClientKnownRequestError) {
      if ((error as { code?: string }).code === "P2025") {
        console.log("User not found, so no need to delete");
        return;
      }
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

void deleteNostrUser(process.argv[2]);
