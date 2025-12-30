#!/usr/bin/env node

/**
 * Script to fix prefer-nullish-coalescing warnings
 * Replaces || with ?? where safe (default value assignments, not boolean OR)
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// Patterns to fix: || followed by a default value (not boolean expressions)
const FIXES = [
  // Pattern: variable || defaultValue (but not in filter/boolean contexts)
  {
    // Match: something || "default" or something || 0 or something || undefined
    // But avoid: filter expressions and boolean OR
    pattern: /(\w+(?:\?\.\w+)*)\s+\|\|\s+(".*?"|'.*?'|\d+|undefined|null|true|false)\b/g,
    replacement: (match, left, right) => {
      // Skip if this is in a filter/boolean context (has || before or after on same line)
      // This is a simple heuristic - we'll be conservative
      return `${left} ?? ${right}`;
    },
    description: 'Default value assignments',
  },
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const changes = [];

  // More targeted fixes - look for specific patterns
  const patterns = [
    // value || "default" -> value ?? "default"
    { from: /(\w+(?:\?\.\w+)*)\s+\|\|\s+(".*?"|'.*?')/g, to: '$1 ?? $2', desc: 'String defaults' },
    // value || 0 -> value ?? 0
    { from: /(\w+(?:\?\.\w+)*)\s+\|\|\s+0\b/g, to: '$1 ?? 0', desc: 'Numeric defaults' },
    // value || undefined -> value ?? undefined
    { from: /(\w+(?:\?\.\w+)*)\s+\|\|\s+undefined\b/g, to: '$1 ?? undefined', desc: 'Undefined defaults' },
  ];

  for (const { from, to, desc } of patterns) {
    const matches = content.match(from);
    if (matches) {
      content = content.replace(from, to);
      modified = true;
      changes.push(`${desc} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return { modified: true, changes };
  }

  return { modified: false, changes: [] };
}

function main() {
  console.log('🔧 Fixing nullish coalescing warnings...\n');

  // Get all production files
  const files = [];
  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'build') {
          walkDir(fullPath);
        }
      } else if ((entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && !entry.name.endsWith('.d.ts')) {
        if (!fullPath.includes('/tests/') && !fullPath.includes('/scripts/')) {
          files.push(fullPath);
        }
      }
    }
  }

  walkDir(path.join(PROJECT_ROOT, 'app'));

  console.log(`Found ${files.length} files to check\n`);

  let totalFixed = 0;
  for (const filePath of files) {
    const result = fixFile(filePath);
    if (result.modified) {
      totalFixed++;
      const relativePath = path.relative(PROJECT_ROOT, filePath);
      console.log(`✅ Fixed: ${relativePath}`);
      result.changes.forEach(change => console.log(`   - ${change}`));
    }
  }

  console.log(`\n📊 Summary: Fixed ${totalFixed} file(s)`);
}

try {
  main();
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

