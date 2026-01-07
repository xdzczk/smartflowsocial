#!/usr/bin/env node

/**
 * Fix common ESLint warning patterns using simple regex replacements
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");

function log(message) {
  console.log(message);
}

/**
 * Fix common patterns in a file
 */
function fixFile(filePath) {
  if (!fs.existsSync(filePath)) return { fixes: 0 };
  
  let content = fs.readFileSync(filePath, "utf8");
  let fixes = 0;
  const originalContent = content;
  
  // Pattern 1: data?.property when data is guaranteed (from response.json() etc)
  // Very conservative - only fix obvious patterns
  content = content.replace(/\b(data|result|response|errorData|error)\.(\w+)\?\.(\w+)/g, (match) => {
    // If obj.prop1 is guaranteed, we can remove ?. on prop2 if it's not a method call
    // But be careful - only if the pattern is clear
    return match; // Skip for now, too risky
  });
  
  // Pattern 2: Remove ?. when followed by guaranteed property access
  // Only for very simple cases like: obj?.prop where obj is const and guaranteed
  // This is too complex to do safely with regex alone
  
  // Pattern 3: Fix ?? undefined when the left side is already T | undefined
  // We already did this, but let's catch any remaining
  content = content.replace(/(\w+(?:\.\w+)*)\s*\?\?\s*undefined\b/g, (match, varName) => {
    // Skip if in comment
    const line = content.substring(0, content.indexOf(match)).split("\n").pop();
    if (line.trim().startsWith("//") || line.includes("/*")) {
      return match;
    }
    fixes++;
    return varName;
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, "utf8");
  }
  
  return { fixes };
}

/**
 * Get files with specific warnings from ESLint output
 */
function getFilesWithWarnings(warningType) {
  let lintOutput;
  try {
    lintOutput = execSync(
      `pnpm lint 2>&1`,
      { cwd: PROJECT_ROOT, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
    );
  } catch (error) {
    lintOutput = error.stdout || error.message || "";
  }
  
  const files = new Set();
  const lines = lintOutput.split("\n");
  let currentFile = null;
  
  for (const line of lines) {
    if (line.startsWith("/") && (line.includes(".ts") || line.includes(".tsx"))) {
      currentFile = line.trim();
    }
    if (line.includes(warningType) && currentFile) {
      files.add(currentFile);
    }
  }
  
  return Array.from(files);
}

function main() {
  log("🚀 Fixing Common ESLint Patterns\n");
  log("=".repeat(60));
  
  // Get files with unnecessary optional chaining
  const optionalFiles = getFilesWithWarnings("Unnecessary optional chain");
  log(`\nFound ${optionalFiles.length} files with unnecessary optional chaining\n`);
  
  // For now, let's focus on fixing the simpler patterns
  // and provide a summary of what needs manual fixing
  
  log("⚠️  Most optional chaining fixes require manual review");
  log("   ESLint provides exact line/column positions for each warning");
  log("   Review each warning individually to ensure correctness\n");
  
  // Fix any remaining ?? undefined patterns
  const nullishFiles = getFilesWithWarnings("left-hand side of `??` operator");
  log(`Found ${nullishFiles.length} files with unnecessary nullish coalescing\n`);
  
  let totalFixes = 0;
  nullishFiles.slice(0, 20).forEach((file) => {
    const filePath = path.join(PROJECT_ROOT, file);
    const result = fixFile(filePath);
    if (result.fixes > 0) {
      log(`  ✅ Fixed ${result.fixes} issues in ${file}`);
      totalFixes += result.fixes;
    }
  });
  
  log("\n" + "=".repeat(60));
  log(`\n✅ Total fixes: ${totalFixes}`);
  log("\n💡 For remaining warnings:");
  log("   1. Review ESLint output for exact locations");
  log("   2. Fix optional chaining manually (obj?.prop -> obj.prop)");
  log("   3. Fix unnecessary conditionals with proper type guards");
  log("   4. Extract duplicate strings to constants\n");
}

if (require.main === module) {
  main();
}

module.exports = { main };

