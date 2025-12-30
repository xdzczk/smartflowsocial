#!/usr/bin/env node

/**
 * Find files with Phase 5 warnings (unused variables and feature boundary violations)
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

// Phase 5 warning types
const PHASE5_WARNINGS = [
  '@typescript-eslint/no-unused-vars',
  'import/no-restricted-paths',
];

function findPhase5Warnings() {
  try {
    const reportContent = fs.readFileSync(REPORT_FILE, 'utf8');
    const report = JSON.parse(reportContent);

    const filesWithWarnings = new Map();
    const unusedVarsByFile = new Map();
    const boundaryViolationsByFile = new Map();

    report.forEach((file) => {
      const filePath = file.filePath.replace(PROJECT_ROOT + '/', '');
      if (isTestOrScript(filePath)) return; // Skip test/script files

      const phase5Warnings = file.messages.filter(msg => 
        msg.severity === 1 && PHASE5_WARNINGS.includes(msg.ruleId)
      );

      if (phase5Warnings.length > 0) {
        const unusedVars = phase5Warnings.filter(w => w.ruleId === '@typescript-eslint/no-unused-vars');
        const boundaryViolations = phase5Warnings.filter(w => w.ruleId === 'import/no-restricted-paths');

        if (unusedVars.length > 0) {
          unusedVarsByFile.set(filePath, {
            path: filePath,
            warnings: unusedVars,
            count: unusedVars.length,
          });
        }

        if (boundaryViolations.length > 0) {
          boundaryViolationsByFile.set(filePath, {
            path: filePath,
            warnings: boundaryViolations,
            count: boundaryViolations.length,
          });
        }

        filesWithWarnings.set(filePath, {
          path: filePath,
          unusedVars: unusedVars.length,
          boundaryViolations: boundaryViolations.length,
          total: phase5Warnings.length,
        });
      }
    });

    // Sort by count (descending)
    const sortedUnused = Array.from(unusedVarsByFile.values())
      .sort((a, b) => b.count - a.count);
    const sortedBoundary = Array.from(boundaryViolationsByFile.values())
      .sort((a, b) => b.count - a.count);

    console.log('\n🔍 Phase 5 Warnings Found:\n');
    console.log('='.repeat(80));
    
    console.log(`\n📌 Unused Variables (@typescript-eslint/no-unused-vars): ${sortedUnused.reduce((sum, f) => sum + f.count, 0)} warnings\n`);
    console.log('Top 20 files with unused variables:');
    sortedUnused.slice(0, 20).forEach((file, idx) => {
      console.log(`  ${idx + 1}. ${file.path} (${file.count} warnings)`);
      // Show first 3 examples
      file.warnings.slice(0, 3).forEach(w => {
        console.log(`     - Line ${w.line}:${w.column}: ${w.message}`);
      });
      if (file.warnings.length > 3) {
        console.log(`     ... and ${file.warnings.length - 3} more`);
      }
    });

    console.log(`\n📌 Feature Boundary Violations (import/no-restricted-paths): ${sortedBoundary.reduce((sum, f) => sum + f.count, 0)} warnings\n`);
    console.log('Top 20 files with boundary violations:');
    sortedBoundary.slice(0, 20).forEach((file, idx) => {
      console.log(`  ${idx + 1}. ${file.path} (${file.count} warnings)`);
      // Show first 3 examples
      file.warnings.slice(0, 3).forEach(w => {
        console.log(`     - Line ${w.line}:${w.column}: ${w.message}`);
      });
      if (file.warnings.length > 3) {
        console.log(`     ... and ${file.warnings.length - 3} more`);
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log(`\n📁 Files with Phase 5 warnings: ${filesWithWarnings.size}`);
    console.log(`📊 Total unused variable warnings: ${sortedUnused.reduce((sum, f) => sum + f.count, 0)}`);
    console.log(`📊 Total boundary violation warnings: ${sortedBoundary.reduce((sum, f) => sum + f.count, 0)}\n`);

    return {
      unusedVars: sortedUnused,
      boundaryViolations: sortedBoundary,
    };
  } catch (error) {
    console.error('Error reading eslint-report.json:', error.message);
    console.log('\n💡 Run: pnpm lint (to generate the report)');
    process.exit(1);
  }
}

if (require.main === module) {
  findPhase5Warnings();
}

module.exports = { findPhase5Warnings };






