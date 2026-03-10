#!/usr/bin/env tsx
/**
 * Guardrail: Fail if domain modules that were moved out of app/lib are re-added.
 * See docs/reference/app-lib-audit.md. Run in CI as advisory or blocking.
 *
 * Usage: pnpm exec tsx scripts/check-lib-no-domain-regression.ts
 */

import { readdirSync } from "fs";
import { join } from "path";

const APP_LIB = join(process.cwd(), "app", "lib");

const MOVED_DOMAIN_BASENAMES = new Set([
  "nostr-signer-manager.client.ts",
  "nostr-signer-connection.client.ts",
  "nostr-signer-keys.client.ts",
  "nostr-signer-storage.client.ts",
  "remote-signer-sessions.client.ts",
  "remote-signer-sessions-migration.client.ts",
  "remote-signer-status.client.ts",
  "remote-signer-health.client.ts",
  "remote-signer-reconnect.client.ts",
  "primary-signer-failover.client.ts",
  "primary-signer-profile.ts",
  "relays.ts",
  "push-manager.client.ts",
  "lifecycle-manager.client.ts",
]);

function listTsFiles(dir: string, base = ""): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isFile() && e.name.endsWith(".ts")) {
      files.push(rel);
    } else if (e.isDirectory()) {
      files.push(...listTsFiles(join(dir, e.name), rel));
    }
  }
  return files;
}

const libFiles = listTsFiles(APP_LIB);
const basenames = libFiles.map((f) => f.split("/").pop() ?? f);
const reappeared = basenames.filter((b) => MOVED_DOMAIN_BASENAMES.has(b));

if (reappeared.length > 0) {
  console.error(
    "check-lib-no-domain-regression: The following domain modules were moved out of app/lib and must not be re-added:"
  );
  reappeared.forEach((b) => console.error("  -", b));
  console.error("See docs/reference/app-lib-audit.md");
  process.exit(1);
}

console.log(
  "check-lib-no-domain-regression: OK (no moved domain modules in app/lib)"
);
