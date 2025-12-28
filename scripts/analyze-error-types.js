#!/usr/bin/env node

/**
 * Analyze ESLint error types in production code
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

function analyzeErrorTypes() {
  try {
    const reportContent = fs.readFileSync(REPORT_FILE, 'utf8');
    const report = JSON.parse(reportContent);

    const prodErrors = new Map();
    const prodWarnings = new Map();
    const testErrors = new Map();
    const testWarnings = new Map();

    report.forEach((file) => {
      const filePath = file.filePath.replace(PROJECT_ROOT + '/', '');
      const isTest = isTestOrScript(filePath);

      file.messages.forEach((message) => {
        const ruleId = message.ruleId || 'unknown';
        const isError = message.severity === 2;

        if (isTest) {
          if (isError) {
            testErrors.set(ruleId, (testErrors.get(ruleId) || 0) + 1);
          } else {
            testWarnings.set(ruleId, (testWarnings.get(ruleId) || 0) + 1);
          }
        } else {
          if (isError) {
            prodErrors.set(ruleId, (prodErrors.get(ruleId) || 0) + 1);
          } else {
            prodWarnings.set(ruleId, (prodWarnings.get(ruleId) || 0) + 1);
          }
        }
      });
    });

    // Sort by count
    const sortedProdErrors = Array.from(prodErrors.entries())
      .sort((a, b) => b[1] - a[1]);
    const sortedProdWarnings = Array.from(prodWarnings.entries())
      .sort((a, b) => b[1] - a[1]);

    console.log('\n🔴 PRODUCTION CODE ERRORS (Top 20):\n');
    console.log('='.repeat(70));
    sortedProdErrors.slice(0, 20).forEach(([rule, count]) => {
      console.log(`  ${count.toString().padStart(4)}  ${rule}`);
    });

    console.log('\n⚠️  PRODUCTION CODE WARNINGS (Top 20):\n');
    console.log('='.repeat(70));
    sortedProdWarnings.slice(0, 20).forEach(([rule, count]) => {
      console.log(`  ${count.toString().padStart(4)}  ${rule}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log(`\nTotal production errors: ${sortedProdErrors.reduce((sum, [, count]) => sum + count, 0)}`);
    console.log(`Total production warnings: ${sortedProdWarnings.reduce((sum, [, count]) => sum + count, 0)}`);
    console.log('');

    return {
      prodErrors: sortedProdErrors,
      prodWarnings: sortedProdWarnings,
    };
  } catch (error) {
    console.error('Error reading eslint-report.json:', error.message);
    console.log('\n💡 Run: pnpm lint (to generate the report)');
    process.exit(1);
  }
}

if (require.main === module) {
  analyzeErrorTypes();
}

module.exports = { analyzeErrorTypes };



