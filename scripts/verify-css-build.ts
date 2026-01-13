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

  // Also check file size - a proper Tailwind CSS file should be at least 50KB
  // 16KB is way too small and indicates utility classes weren't generated
  const minSize = 50 * 1024; // 50KB
  const sizeCheck = stats.size >= minSize;

  const allPassed = Object.values(checks).every((v) => v) && sizeCheck;

  console.log(`CSS file: ${cssFile}`);
  console.log(
    `  Size: ${stats.size} bytes (${(stats.size / 1024).toFixed(1)} KB)`
  );
  console.log(
    `  Minimum size check: ${sizeCheck ? "✅ PASS" : "❌ FAIL"} (need at least ${minSize} bytes)`
  );
  console.log(`  Utility classes check:`, checks);
  console.log(`  Status: ${allPassed ? "✅ PASS" : "❌ FAIL"}`);

  if (!sizeCheck) {
    hasErrors = true;
    console.error(`  ERROR: CSS file is too small (${stats.size} bytes)!`);
    console.error(
      `  Expected at least ${minSize} bytes for a complete Tailwind CSS file.`
    );
    console.error(
      `  This indicates utility classes were not generated during build.`
    );
  }

  if (!allPassed && sizeCheck) {
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
