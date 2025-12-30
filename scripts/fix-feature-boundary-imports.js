#!/usr/bin/env node

/**
 * Script to fix feature boundary violations in route files
 * 
 * Replaces deep imports with public API imports:
 * - ~/features/auth/session.server → ~/features/auth
 * - ~/features/payments/subscriptions.server → ~/features/payments
 * - ~/features/posts/types → ~/features/posts
 * - ~/features/assets/types → ~/features/assets
 * - ~/features/templates/types → ~/features/templates
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ROUTES_DIR = path.join(PROJECT_ROOT, 'app/routes');

// Import path replacements
const REPLACEMENTS = [
  {
    from: /from\s+["']~\/features\/auth\/session\.server["']/g,
    to: 'from "~/features/auth"',
    description: 'auth/session.server → auth',
  },
  {
    from: /from\s+["']~\/features\/payments\/subscriptions\.server["']/g,
    to: 'from "~/features/payments"',
    description: 'payments/subscriptions.server → payments',
  },
  {
    from: /from\s+["']~\/features\/posts\/types["']/g,
    to: 'from "~/features/posts"',
    description: 'posts/types → posts',
  },
  {
    from: /from\s+["']~\/features\/assets\/types["']/g,
    to: 'from "~/features/assets"',
    description: 'assets/types → assets',
  },
  {
    from: /from\s+["']~\/features\/templates\/types["']/g,
    to: 'from "~/features/templates"',
    description: 'templates/types → templates',
  },
];

function getAllRouteFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getAllRouteFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function fixImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const changes = [];

  for (const replacement of REPLACEMENTS) {
    const matches = content.match(replacement.from);
    if (matches) {
      content = content.replace(replacement.from, replacement.to);
      modified = true;
      changes.push(`${replacement.description} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return { modified: true, changes };
  }

  return { modified: false, changes: [] };
}

function main() {
  console.log('🔧 Fixing feature boundary violations in route files...\n');

  // Find all route files
  const routeFiles = getAllRouteFiles(ROUTES_DIR);

  console.log(`Found ${routeFiles.length} route files\n`);

  let totalFixed = 0;
  const fixedFiles = [];

  for (const filePath of routeFiles) {
    const result = fixImportsInFile(filePath);
    if (result.modified) {
      totalFixed++;
      const relativePath = path.relative(PROJECT_ROOT, filePath);
      fixedFiles.push({ path: relativePath, changes: result.changes });
      console.log(`✅ Fixed: ${relativePath}`);
      result.changes.forEach(change => {
        console.log(`   - ${change}`);
      });
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total files processed: ${routeFiles.length}`);
  console.log(`   Files fixed: ${totalFixed}`);
  console.log(`   Files unchanged: ${routeFiles.length - totalFixed}`);

  if (totalFixed > 0) {
    console.log(`\n✨ Successfully fixed ${totalFixed} file(s)!`);
  } else {
    console.log(`\n✨ No files needed fixing.`);
  }
}

try {
  main();
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

