#!/usr/bin/env tsx
/**
 * Verifies that the built CSS file contains utility classes.
 * This ensures Tailwind is generating classes correctly during Docker builds.
 */

import fs from "node:fs";
import path from "node:path";

const buildAssetsDir = path.join(process.cwd(), "public", "build", "_assets");

if (!fs.existsSync(buildAssetsDir)) {
  console.error("ERROR: Build assets directory not found:", buildAssetsDir);
  process.exit(1);
}

const cssFiles = fs
  .readdirSync(buildAssetsDir, { recursive: true })
  .filter((f): f is string => typeof f === "string" && f.endsWith(".css"));

if (cssFiles.length === 0) {
  console.error("ERROR: No CSS files found in build output");
  process.exit(1);
}

let hasErrors = false;

for (const cssFile of cssFiles) {
  const fullPath = path.join(buildAssetsDir, cssFile);
  const stats = fs.statSync(fullPath);
  const content = fs.readFileSync(fullPath, "utf8");

  // Check for essential utility classes used on Plans page
  const checks = {
    container: content.includes(".container"),
    grid: content.includes(".grid"),
    "text-4xl": content.includes(".text-4xl"),
    "grid-cols": content.includes(".grid-cols"),
    "bg-amber": content.includes(".bg-amber"),
  };

  const allPassed = Object.values(checks).every((v) => v);

  console.log(`CSS file: ${cssFile}`);
  console.log(`  Size: ${stats.size} bytes`);
  console.log(`  Utility classes check:`, checks);
  console.log(`  Status: ${allPassed ? "✅ PASS" : "❌ FAIL"}`);

  if (!allPassed) {
    hasErrors = true;
    console.error(`  ERROR: CSS file missing required utility classes!`);
    console.error(
      `  This usually means Tailwind didn't scan files correctly during build.`
    );
  }
}

if (hasErrors) {
  console.error("\n❌ Build verification failed!");
  console.error("The CSS file is missing utility classes.");
  console.error("This will cause pages to appear unstyled in production.");
  process.exit(1);
}

console.log("\n✅ Build verification passed!");
console.log("CSS file contains all required utility classes.");
