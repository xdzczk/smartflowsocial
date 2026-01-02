#!/usr/bin/env node

/**
 * Analyze ESLint warnings in test/script files
 * Shows breakdown by rule type and file location
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const REPORT_FILE = path.join(PROJECT_ROOT, 'eslint-report.json');

// Patterns to identify test/script files
const TEST_SCRIPT_PATTERNS = [
  /tests\//,
  /cypress\//,
  /scripts\//,
  /\.test\./,
  /\.spec\./,
  /\.config\./,
  /mocks\//,
  /seed/,
  /factory/,
];

function isTestOrScript(filePath) {
  return TEST_SCRIPT_PATTERNS.some(pattern => pattern.test(filePath));
}

function analyzeTestWarnings() {
  try {
    const reportContent = fs.readFileSync(REPORT_FILE, 'utf8');
    const report = JSON.parse(reportContent);

    const testWarnings = new Map();
    const fileWarnings = new Map();
    let totalWarnings = 0;

    report.forEach((file) => {
      const filePath = file.filePath.replace(PROJECT_ROOT + '/', '');
      if (!isTestOrScript(filePath)) return;

      let fileWarningCount = 0;
      file.messages.forEach((message) => {
        if (message.severity === 1) { // Warning
          const ruleId = message.ruleId || 'unknown';
          testWarnings.set(ruleId, (testWarnings.get(ruleId) || 0) + 1);
          fileWarningCount++;
          totalWarnings++;
        }
      });

      if (fileWarningCount > 0) {
        fileWarnings.set(filePath, fileWarningCount);
      }
    });

    // Sort by count
    const sortedWarnings = Array.from(testWarnings.entries())
      .sort((a, b) => b[1] - a[1]);
    const sortedFiles = Array.from(fileWarnings.entries())
      .sort((a, b) => b[1] - a[1]);

    console.log('\n' + '='.repeat(80));
    console.log('⚠️  TEST/SCRIPT FILE WARNINGS ANALYSIS');
    console.log('='.repeat(80));

    console.log(`\n📊 Total warnings in test/script files: ${totalWarnings}`);
    console.log(`📁 Files with warnings: ${fileWarnings.size}`);
    console.log(`🔧 Unique warning types: ${testWarnings.size}`);

    console.log('\n' + '─'.repeat(80));
    console.log('📋 WARNING BREAKDOWN BY RULE (Top 30):');
    console.log('─'.repeat(80));
    console.log('  Count  Rule ID');
    console.log('─'.repeat(80));
    sortedWarnings.slice(0, 30).forEach(([rule, count]) => {
      const percentage = ((count / totalWarnings) * 100).toFixed(1);
      console.log(`  ${count.toString().padStart(5)}  ${rule.padEnd(50)} (${percentage}%)`);
    });

    if (sortedWarnings.length > 30) {
      const remaining = sortedWarnings.slice(30).reduce((sum, [, count]) => sum + count, 0);
      console.log(`  ${remaining.toString().padStart(5)}  ... and ${sortedWarnings.length - 30} more rule types`);
    }

    console.log('\n' + '─'.repeat(80));
    console.log('📁 FILES WITH MOST WARNINGS (Top 20):');
    console.log('─'.repeat(80));
    console.log('  Count  File');
    console.log('─'.repeat(80));
    sortedFiles.slice(0, 20).forEach(([filePath, count]) => {
      console.log(`  ${count.toString().padStart(5)}  ${filePath}`);
    });

    if (sortedFiles.length > 20) {
      const remaining = sortedFiles.slice(20).reduce((sum, [, count]) => sum + count, 0);
      console.log(`  ${remaining.toString().padStart(5)}  ... and ${sortedFiles.length - 20} more files`);
    }

    // Categorize warnings by type
    const autoFixable = [
      'import/order',
      '@typescript-eslint/consistent-type-imports',
      '@typescript-eslint/prefer-optional-chain',
      '@typescript-eslint/prefer-nullish-coalescing',
    ];

    const highImpact = [
      '@typescript-eslint/no-unused-vars',
      '@typescript-eslint/no-explicit-any',
      '@typescript-eslint/no-unsafe-assignment',
      '@typescript-eslint/no-unsafe-member-access',
      '@typescript-eslint/no-unsafe-call',
      '@typescript-eslint/no-floating-promises',
    ];

    const autoFixableCount = sortedWarnings
      .filter(([rule]) => autoFixable.includes(rule))
      .reduce((sum, [, count]) => sum + count, 0);

    const highImpactCount = sortedWarnings
      .filter(([rule]) => highImpact.includes(rule))
      .reduce((sum, [, count]) => sum + count, 0);

    console.log('\n' + '─'.repeat(80));
    console.log('🎯 WARNING CATEGORIES:');
    console.log('─'.repeat(80));
    console.log(`  Auto-fixable warnings:     ${autoFixableCount.toString().padStart(5)} (${((autoFixableCount / totalWarnings) * 100).toFixed(1)}%)`);
    console.log(`  High-impact warnings:       ${highImpactCount.toString().padStart(5)} (${((highImpactCount / totalWarnings) * 100).toFixed(1)}%)`);
    console.log(`  Other warnings:             ${(totalWarnings - autoFixableCount - highImpactCount).toString().padStart(5)} (${(((totalWarnings - autoFixableCount - highImpactCount) / totalWarnings) * 100).toFixed(1)}%)`);

    console.log('\n' + '─'.repeat(80));
    console.log('💡 RECOMMENDED FIX STRATEGY:');
    console.log('─'.repeat(80));
    console.log('  1. Run: pnpm lint:fix (auto-fixes many warnings)');
    console.log('  2. Fix high-impact warnings manually');
    console.log('  3. Address remaining warnings as needed');
    console.log('─'.repeat(80) + '\n');

    return {
      totalWarnings,
      warningTypes: sortedWarnings,
      fileWarnings: sortedFiles,
      autoFixableCount,
      highImpactCount,
    };
  } catch (error) {
    console.error('❌ Error reading eslint-report.json:', error.message);
    console.log('\n💡 Run: pnpm lint (to generate the report)');
    process.exit(1);
  }
}

if (require.main === module) {
  analyzeTestWarnings();
}

module.exports = { analyzeTestWarnings };




