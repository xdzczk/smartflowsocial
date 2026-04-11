// Read scheduled timestamp for a seeded post in E2E.
// Usage:
// npx tsx ./tests/e2e/support/get-post-schedule.ts npub1xxx postId

require("./load-env.js");

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { installGlobals } from "@remix-run/node";
import { Pool } from "pg";

installGlobals();

async function getPostSchedule(npub: string, postId: string) {
  if (!npub) throw new Error("npub required");
  if (!postId) throw new Error("postId required");

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
  const prisma = new PrismaClient({ adapter: adapter });

  try {
    const user = await prisma.user.findUnique({ where: { npub } });
    if (!user) throw new Error(`User not found for npub: ${npub}`);

    const post = await prisma.post.findFirst({
      where: { id: postId, userId: user.id },
      select: {
        id: true,
        scheduledAtUtc: true,
        followUpTimingMode: true,
        followUpOffsetSeconds: true,
        parentScheduledActionId: true,
      },
    });
    if (!post) throw new Error(`Post not found: ${postId}`);

    const unix = post.scheduledAtUtc
      ? Math.floor(post.scheduledAtUtc.getTime() / 1000)
      : -1;

    console.log(
      `
<id>${post.id}</id>
<scheduledAtUnix>${String(unix)}</scheduledAtUnix>
<followUpTimingMode>${post.followUpTimingMode ?? ""}</followUpTimingMode>
<followUpOffsetSeconds>${post.followUpOffsetSeconds ?? ""}</followUpOffsetSeconds>
<parentScheduledActionId>${post.parentScheduledActionId ?? ""}</parentScheduledActionId>
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
    const postId = process.argv[3];
    await getPostSchedule(String(npub), String(postId));
    process.exit(0);
  } catch (error) {
    console.error(
      "Error reading post schedule:",
      error instanceof Error ? error.message : String(error)
    );
    if (error instanceof Error && error.stack) console.error(error.stack);
    process.exit(1);
  }
}

void main();
