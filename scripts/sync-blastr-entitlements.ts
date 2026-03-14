/**
 * One-off script: sync Blastr entitlements for all eligible users.
 *
 * For each user with an ACTIVE subscription and a plan with enableRelayBlast,
 * calls Blastr PUT /admin/entitlements/:pubkey with status: "active"
 * (same eligibility logic as afterSubscriptionUpdated).
 *
 * Requires: DATABASE_URL, BLASTR_ADMIN_URL, BLASTR_ADMIN_API_TOKEN in .env
 *
 * Usage:
 *   npx tsx scripts/sync-blastr-entitlements.ts
 */

import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { nip19 } from "nostr-tools";
import { Pool } from "pg";

const { log, error: logError } = require("./logger") as {
  log: (..._args: unknown[]) => void;
  error: (..._args: unknown[]) => void;
};

config({ path: resolve(process.cwd(), ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
const BLASTR_ADMIN_URL = process.env.BLASTR_ADMIN_URL?.trim();
const BLASTR_ADMIN_API_TOKEN = process.env.BLASTR_ADMIN_API_TOKEN?.trim();

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

if (!BLASTR_ADMIN_URL || BLASTR_ADMIN_URL.length === 0) {
  log("BLASTR_ADMIN_URL is unset; skipping Blastr entitlement sync.");
  process.exit(0);
}

const BLASTR_BASE = BLASTR_ADMIN_URL;

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function resolvePubkeyHex(npubOrHex: string): string | null {
  if (!npubOrHex || typeof npubOrHex !== "string") return null;
  const trimmed = npubOrHex.trim();
  if (trimmed.length < 32) return null;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed.toLowerCase();
  try {
    const decoded = nip19.decode(trimmed);
    if (decoded.type === "npub" && typeof decoded.data === "string") {
      return decoded.data;
    }
  } catch {
    // ignore
  }
  return null;
}

async function putEntitlement(
  baseUrl: string,
  pubkeyHex: string
): Promise<boolean> {
  const base = baseUrl.replace(/\/$/, "");
  const path = `/admin/entitlements/${encodeURIComponent(pubkeyHex)}`;
  const url = `${base}${path}`;
  const body = JSON.stringify({
    status: "active",
    plan_tier: "default",
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (BLASTR_ADMIN_API_TOKEN) {
    headers["Authorization"] = `Bearer ${BLASTR_ADMIN_API_TOKEN}`;
    headers["X-API-TOKEN"] = BLASTR_ADMIN_API_TOKEN;
  }

  const res = await fetch(url, {
    method: "PUT",
    headers,
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    logError(
      `Blastr PUT entitlement failed: ${res.status}`,
      text.slice(0, 300)
    );
    return false;
  }
  return true;
}

async function main() {
  log("Syncing Blastr entitlements for eligible users...");
  log(
    "Eligibility: ACTIVE subscription + plan with enableRelayBlast + user isEnabled."
  );
  log("=".repeat(50));

  const subscriptions = await prisma.subscription.findMany({
    where: { status: "ACTIVE" },
    include: {
      Plan: true,
      User: {
        select: { id: true, npub: true, isEnabled: true },
      },
    },
  });

  const eligible = subscriptions.filter(
    (s) =>
      s.Plan?.enableRelayBlast === true &&
      s.User?.isEnabled === true &&
      s.User?.npub
  );

  log(`Found ${eligible.length} eligible user(s).`);

  let synced = 0;
  let failed = 0;
  for (const s of eligible) {
    const user = s.User!;
    const pubkeyHex = resolvePubkeyHex(user.npub!);
    if (!pubkeyHex) {
      log(`Skip user ${user.id}: could not resolve npub to hex`);
      failed++;
      continue;
    }
    const ok = await putEntitlement(BLASTR_BASE, pubkeyHex);
    if (ok) {
      synced++;
      log(
        `Synced entitlement: user ${user.id} (pubkey ${pubkeyHex.slice(0, 16)}...)`
      );
    } else {
      failed++;
    }
  }

  log("=".repeat(50));
  log(`Done. Synced: ${synced}, failed: ${failed}.`);
}

main()
  .catch((err) => {
    logError("Sync failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
    await prisma.$disconnect();
  });
