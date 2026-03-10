#!/usr/bin/env node
/**
 * Enhanced audit of eslint-disable and TypeScript suppressions in app/.
 * Outputs TSV: file, line, kind, rule(s), comment, category (placeholder).
 * Usage: node scripts/audit-suppressions-app.js
 * See CONTRIBUTING.md § Lint and type suppression policy and docs/reference/suppressions-audit-app.md.
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

const rows = [];
for (const filePath of walkDir(APP_DIR)) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const relativePath = path.relative(ROOT, filePath);

  lines.forEach((line, i) => {
    const lineNum = i + 1;

    // Matches eslint-disable-next-line with optional rule name and description
    let m;
    const eslintRe =
      /(?:^|\s)(?:\/\*?\s*)?eslint-disable(?:-next-line)?\s+([^\s*]+?)(?:\s*--\s*([^*\n]+))?(?:\s*\*\/)?/;
    if ((m = line.match(eslintRe))) {
      const rule = m[1].trim();
      const comment = (m[2] || "").trim();
      rows.push({
        file: relativePath,
        line: lineNum,
        kind: "eslint-disable",
        rule,
        comment,
        category: "",
        action: "",
      });
    }

    // Matches eslint-disable-line at end of line with optional rule and description
    const eslintLineRe = /eslint-disable-line\s+([^\s]+)(?:\s*--\s*([^\n]+))?/;
    if ((m = line.match(eslintLineRe))) {
      const rule = m[1].trim();
      const comment = (m[2] || "").trim();
      rows.push({
        file: relativePath,
        line: lineNum,
        kind: "eslint-disable-line",
        rule,
        comment,
        category: "",
        action: "",
      });
    }

    // @ts-ignore
    if (line.includes("@ts-ignore")) {
      const commentRe =
        /@ts-ignore\s*(?:\/\*\s*([^*]*)\s*\*\/|\/\/\s*[-–]\s*([^\n]+))?/;
      const cm = line.match(commentRe);
      const comment = cm && (cm[1] || cm[2]) ? (cm[1] || cm[2]).trim() : "";
      rows.push({
        file: relativePath,
        line: lineNum,
        kind: "@ts-ignore",
        rule: "TypeScript",
        comment,
        category: "",
        action: "Replace with @ts-expect-error",
      });
    }

    // @ts-expect-error
    if (line.includes("@ts-expect-error")) {
      const commentRe =
        /@ts-expect-error\s*(?:\/\*\s*([^*]*)\s*\*\/|\/\/\s*[-–]\s*([^\n]+))?/;
      const cm = line.match(commentRe);
      const comment = cm && (cm[1] || cm[2]) ? (cm[1] || cm[2]).trim() : "";
      rows.push({
        file: relativePath,
        line: lineNum,
        kind: "@ts-expect-error",
        rule: "TypeScript",
        comment,
        category: "",
        action: "",
      });
    }
  });
}

// TSV output
console.log("file\tline\tkind\trule\tcomment\tcategory\taction");
rows.forEach((r) => {
  const comment = (r.comment || "").replace(/\t/g, " ");
  console.log(
    [r.file, r.line, r.kind, r.rule, comment, r.category, r.action].join("\t")
  );
});
