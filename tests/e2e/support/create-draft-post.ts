// Seed a deterministic draft short post for E2E workflows.
// Usage:
// npx tsx ./tests/e2e/support/create-draft-post.ts npub1xxx "caption text"

require("./load-env.js");

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { installGlobals } from "@remix-run/node";
import { Pool } from "pg";

installGlobals();

async function createDraftPost(npub: string, caption: string) {
  if (!npub) {
    throw new Error("npub required");
  }

  const dbUrl = process.env["DATABASE_URL"];
  if (!dbUrl || dbUrl.trim() === "") {
    throw new Error("DATABASE_URL environment variable is not set");
  }

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

  try {
    const user = await prisma.user.findUnique({
      where: { npub },
    });
    if (!user) {
      throw new Error(`User not found for npub: ${npub}`);
    }

    const uniqueCaption = caption.trim();
    const post = await prisma.post.create({
      data: {
        userId: user.id,
        caption: uniqueCaption,
        content: uniqueCaption,
        fileUrl: [],
        postType: "TEXT",
        status: "DRAFT",
        currentState: "DRAFT",
        tags: [],
      },
    });

    console.log(
      `
<postId>${post.id}</postId>
<caption>${uniqueCaption}</caption>
      `.trim()
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function main() {
  try {
    const npub = process.argv[2];
    const caption = process.argv[3];
    if (!npub) {
      console.error("Error: npub required");
      process.exit(1);
    }
    if (!caption || caption.trim() === "") {
      console.error("Error: caption required");
      process.exit(1);
    }
    await createDraftPost(npub, caption);
    process.exit(0);
  } catch (error) {
    console.error(
      "Error creating draft post:",
      error instanceof Error ? error.message : String(error)
    );
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

void main();
