// Seed a parent scheduled post + attached follow-up chain for E2E workflows.
// Usage:
// npx tsx ./tests/e2e/support/create-attached-followup-chain.ts npub1xxx offset 1765000000 7200
// npx tsx ./tests/e2e/support/create-attached-followup-chain.ts npub1xxx fixed 1765000000 1765001800

require("./load-env.js");

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { installGlobals } from "@remix-run/node";
import { Pool } from "pg";

installGlobals();

type FollowupMode = "offset" | "fixed";

async function createAttachedFollowupChain(
  npub: string,
  mode: FollowupMode,
  parentUnix: number,
  childArgUnixOrOffset: number
) {
  if (!npub) throw new Error("npub required");

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

    const parentScheduledAtUtc = new Date(parentUnix * 1000);
    const childScheduledAtUtc =
      mode === "offset"
        ? new Date((parentUnix + childArgUnixOrOffset) * 1000)
        : new Date(childArgUnixOrOffset * 1000);

    const now = Date.now();
    const parentEventId = `e2e-parent-${now}`;
    const childEventId = `e2e-child-${now}`;

    const parent = await prisma.post.create({
      data: {
        userId: user.id,
        caption: `E2E parent ${now}`,
        content: `E2E parent ${now}`,
        fileUrl: [],
        postType: "TEXT",
        status: "SCHEDULED",
        currentState: "SCHEDULED",
        scheduledAtUtc: parentScheduledAtUtc,
        tags: [],
        signingState: "signed",
        signedEvent: {
          id: parentEventId,
          pubkey: npub,
          kind: 1,
          created_at: parentUnix,
          tags: [],
          content: `E2E parent ${now}`,
          sig: "e2e-parent-signature",
        },
        nostrEvent: {
          id: parentEventId,
          pubkey: npub,
          kind: 1,
          created_at: parentUnix,
          tags: [],
          content: `E2E parent ${now}`,
          sig: "e2e-parent-signature",
        },
      },
    });

    const child = await prisma.post.create({
      data: {
        userId: user.id,
        caption: `E2E child ${now}`,
        content: `E2E child ${now}`,
        fileUrl: [],
        postType: "TEXT",
        status: "SCHEDULED",
        currentState: "SCHEDULED",
        scheduledAtUtc: childScheduledAtUtc,
        tags: [],
        dependencyMode: "attached",
        targetMode: "scheduled_parent",
        parentScheduledActionId: parent.id,
        rootScheduledActionId: parent.id,
        targetScheduledActionId: parent.id,
        followUpTimingMode:
          mode === "offset" ? "offset_from_parent" : "fixed_datetime",
        followUpOffsetSeconds: mode === "offset" ? childArgUnixOrOffset : null,
        signingState: "signed",
        signedEvent: {
          id: childEventId,
          pubkey: npub,
          kind: 1,
          created_at: Math.floor(childScheduledAtUtc.getTime() / 1000),
          tags: [],
          content: `E2E child ${now}`,
          sig: "e2e-child-signature",
        },
        nostrEvent: {
          id: childEventId,
          pubkey: npub,
          kind: 1,
          created_at: Math.floor(childScheduledAtUtc.getTime() / 1000),
          tags: [],
          content: `E2E child ${now}`,
          sig: "e2e-child-signature",
        },
      },
    });

    console.log(
      `
<parentId>${parent.id}</parentId>
<childId>${child.id}</childId>
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
    const modeRaw = process.argv[3];
    const parentUnixRaw = process.argv[4];
    const childArgRaw = process.argv[5];

    if (!npub) throw new Error("npub required");
    if (modeRaw !== "offset" && modeRaw !== "fixed") {
      throw new Error("mode must be 'offset' or 'fixed'");
    }
    const parentUnix = Number(parentUnixRaw);
    const childArg = Number(childArgRaw);
    if (!Number.isFinite(parentUnix) || !Number.isFinite(childArg)) {
      throw new Error("parentUnix and child arg must be numbers");
    }

    await createAttachedFollowupChain(
      npub,
      modeRaw as FollowupMode,
      parentUnix,
      childArg
    );
    process.exit(0);
  } catch (error) {
    console.error(
      "Error creating attached follow-up chain:",
      error instanceof Error ? error.message : String(error)
    );
    if (error instanceof Error && error.stack) console.error(error.stack);
    process.exit(1);
  }
}

void main();
