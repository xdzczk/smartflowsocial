// Use this to delete a user by their npub
// Simply call this with:
// npx tsx ./tests/e2e/support/delete-user.ts npub1xxx
// and that user will get deleted

// @ts-expect-error - PrismaClientKnownRequestError is available at runtime but types may not be fully exported
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { installGlobals } from "@remix-run/node";

import { prisma } from "~/lib/prisma.server";
installGlobals();

async function deleteUser(npub: string) {
  if (!npub) {
    throw new Error("npub required for deletion");
  }

  try {
    await prisma.user.delete({ where: { npub } });
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

void deleteUser(process.argv[2]);
