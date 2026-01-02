// Use this to delete a user by their npub
// Simply call this with:
// npx tsx ./tests/e2e/support/delete-user.ts npub1xxx
// and that user will get deleted

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
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      console.log("User not found, so no need to delete");
    } else {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

void deleteUser(process.argv[2]);
