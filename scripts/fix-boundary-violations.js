#!/usr/bin/env node

/**
 * Script to help fix feature boundary violations
 * Provides a list of files that need to be updated
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

function getBoundaryViolations() {
  try {
    const reportContent = fs.readFileSync(REPORT_FILE, 'utf8');
    const report = JSON.parse(reportContent);

    const routeViolations = new Map();
    const featureViolations = new Map();

    report.forEach((file) => {
      const filePath = file.filePath.replace(PROJECT_ROOT + '/', '');
      if (isTestOrScript(filePath)) return;

      const violations = file.messages.filter(msg => 
        msg.severity === 1 && msg.ruleId === 'import/no-restricted-paths'
      );

      if (violations.length === 0) return;

      if (filePath.startsWith('app/routes/')) {
        routeViolations.set(filePath, violations);
      } else if (filePath.includes('/features/')) {
        featureViolations.set(filePath, violations);
      }
    });

    return { routeViolations, featureViolations };
  } catch (error) {
    console.error('Error reading eslint-report.json:', error.message);
    console.log('\n💡 Run: pnpm lint (to generate the report)');
    process.exit(1);
  }
}

if (require.main === module) {
  const { routeViolations, featureViolations } = getBoundaryViolations();
  
  console.log('\n📋 Files with Boundary Violations:\n');
  console.log(`Routes: ${routeViolations.size} files`);
  console.log(`Features: ${featureViolations.size} files\n`);
  
  console.log('Routes to fix:');
  Array.from(routeViolations.keys()).forEach(file => {
    console.log(`  - ${file} (${routeViolations.get(file).length} violations)`);
  });
}

module.exports = { getBoundaryViolations };








