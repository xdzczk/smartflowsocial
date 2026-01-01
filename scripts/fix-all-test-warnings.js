#!/usr/bin/env node

/**
 * Comprehensive script to fix all test warnings systematically
 * This script helps batch-fix common patterns
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

console.log('🔧 Starting comprehensive test warning fixes...\n');

// Step 1: Run auto-fix
console.log('1️⃣  Running ESLint auto-fix...');
try {
  execSync('pnpm lint:fix', { cwd: PROJECT_ROOT, stdio: 'inherit' });
  console.log('✅ Auto-fix completed\n');
} catch (error) {
  console.log('⚠️  Auto-fix completed with some issues (expected)\n');
}

// Step 2: Get current warning count
console.log('2️⃣  Checking remaining warnings...');
try {
  const result = execSync('pnpm lint 2>&1 | grep "problems"', { 
    cwd: PROJECT_ROOT, 
    encoding: 'utf8' 
  });
  console.log(result.trim());
} catch (error) {
  console.log('Could not get warning count');
}

console.log('\n💡 Manual fixes needed for:');
console.log('   - Unused variables (prefix with _)');
console.log('   - jest/expect-expect (add assertions or disable)');
console.log('   - Nullish coalescing (|| to ??)');
console.log('   - Type assertions in integration tests');
console.log('   - Unsafe assignments (add proper types)');
console.log('   - cypress/no-unnecessary-waiting (replace cy.wait())');
console.log('\n📝 Continue with manual fixes...\n');



