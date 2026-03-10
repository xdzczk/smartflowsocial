#!/usr/bin/env node
/**
 * CI check: fail if app/ has eslint-disable or @ts-expect-error without a trailing comment.
 * Usage: node scripts/check-suppressions-have-comments.js
 * See CONTRIBUTING.md §6 and docs/reference/suppressions-audit-app.md (visa standard).
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(ROOT, "app");

function* walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "node_modules" && !e.name.startsWith(".")) {
        yield* walkDir(full);
      }
    } else if (e.isFile() && /\.(ts|tsx|js|jsx)$/.test(e.name)) {
      yield full;
    }
  }
}

const violations = [];
for (const filePath of walkDir(APP_DIR)) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const relativePath = path.relative(ROOT, filePath);

  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trim();

    // eslint-disable without -- comment (next-line or line)
    if (
      /eslint-disable(?:-next-line|-line)?\s+[^\s*]+(?:\s*\*\/)?\s*$/.test(
        trimmed
      ) ||
      (trimmed.includes("eslint-disable") &&
        !/--\s+/.test(line) &&
        !/\/\*.*--/.test(line))
    ) {
      // Allow block that has comment in same block: /* eslint-disable X -- reason */
      const hasComment =
        /\s--\s+/.test(line) ||
        /\/\*\s*eslint-disable[^*]*--\s*[^*]+\*\//.test(line);
      if (!hasComment) {
        violations.push({
          file: relativePath,
          line: lineNum,
          match: "eslint-disable without comment",
        });
      }
    }

    // @ts-expect-error without comment (must have " - " or " -- " and text after)
    if (line.includes("@ts-expect-error")) {
      const hasComment =
        /@ts-expect-error\s*[-–]\s+\S/.test(line) ||
        /@ts-expect-error\s*\/\*\s*[^*]+/.test(line);
      if (!hasComment) {
        violations.push({
          file: relativePath,
          line: lineNum,
          match: "@ts-expect-error without comment",
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error(
    "Suppressions in app/ must have a trailing comment (visa standard). Violations:\n"
  );
  violations.forEach((v) => console.error(`  ${v.file}:${v.line}  ${v.match}`));
  process.exit(1);
}
console.log("OK: all app suppressions have comments.");
