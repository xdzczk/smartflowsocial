#!/usr/bin/env node

/**
 * Find Production Code ESLint Errors
 * 
 * Lists all production code files with errors and their error counts
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(PROJECT_ROOT, 'eslint-report.json');

function isProductionFile(filePath) {
  return (
    filePath.includes('/app/') &&
    !filePath.includes('/tests/') &&
    !filePath.includes('/test/') &&
    !filePath.includes('/scripts/') &&
    !filePath.includes('.test.') &&
    !filePath.includes('.spec.')
  );
}

function analyzeProductionErrors() {
  console.log('🔍 Finding Production Code ESLint Errors...\n');

  if (!fs.existsSync(REPORT_PATH)) {
    console.log('❌ eslint-report.json not found');
    console.log('💡 Run: pnpm lint (or pnpm exec eslint --format json . > eslint-report.json)');
    return;
  }

  try {
    const content = fs.readFileSync(REPORT_PATH, 'utf8');
    if (!content.trim().startsWith('[') && !content.trim().startsWith('{')) {
      console.log('❌ eslint-report.json is not valid JSON');
      console.log('💡 Regenerating report...');
      return;
    }

    const reportData = JSON.parse(content);
    if (!Array.isArray(reportData)) {
      console.log('❌ Report format is not an array');
      return;
    }

    // Collect production errors
    const productionErrors = [];

    reportData.forEach((file) => {
      if (!isProductionFile(file.filePath)) return;
      if (!file.messages || file.messages.length === 0) return;

      const errors = file.messages.filter(m => m.severity === 2);
      const warnings = file.messages.filter(m => m.severity === 1);

      if (errors.length > 0 || warnings.length > 0) {
        const relativePath = path.relative(PROJECT_ROOT, file.filePath);
        productionErrors.push({
          filePath: relativePath,
          errors: errors.length,
          warnings: warnings.length,
          errorRules: errors.map(e => e.ruleId || 'unknown'),
          warningRules: warnings.map(w => w.ruleId || 'unknown'),
        });
      }
    });

    // Sort by error count
    productionErrors.sort((a, b) => b.errors - a.errors || b.warnings - a.warnings);

    // Print summary
    const totalErrors = productionErrors.reduce((sum, f) => sum + f.errors, 0);
    const totalWarnings = productionErrors.reduce((sum, f) => sum + f.warnings, 0);

    console.log('📊 Production Code ESLint Issues\n');
    console.log('='.repeat(70));
    console.log(`\nTotal: ${totalErrors} errors, ${totalWarnings} warnings`);
    console.log(`Files with issues: ${productionErrors.length}\n`);

    // Group by error count
    const errorCounts = {};
    productionErrors.forEach(file => {
      const key = `${file.errors} errors, ${file.warnings} warnings`;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });

    console.log('\n📈 Distribution:\n');
    Object.entries(errorCounts)
      .sort((a, b) => {
        const aErrors = parseInt(a[0].match(/(\d+) errors/)?.[1] || '0');
        const bErrors = parseInt(b[0].match(/(\d+) errors/)?.[1] || '0');
        return bErrors - aErrors;
      })
      .forEach(([key, count]) => {
        console.log(`  ${key}: ${count} files`);
      });

    // Top files with errors
    console.log('\n\n🔴 Top 20 Files with Most Errors:\n');
    productionErrors
      .filter(f => f.errors > 0)
      .slice(0, 20)
      .forEach((file, index) => {
        console.log(`${(index + 1).toString().padStart(2)}. ${file.filePath}`);
        console.log(`    ${file.errors} errors, ${file.warnings} warnings`);
        
        // Show top error rules
        const ruleCounts = {};
        file.errorRules.forEach(rule => {
          ruleCounts[rule] = (ruleCounts[rule] || 0) + 1;
        });
        const topRules = Object.entries(ruleCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([rule, count]) => `${rule} (${count})`)
          .join(', ');
        if (topRules) {
          console.log(`    Top rules: ${topRules}`);
        }
        console.log('');
      });

    // Files with only warnings
    const warningOnlyFiles = productionErrors.filter(f => f.errors === 0 && f.warnings > 0);
    if (warningOnlyFiles.length > 0) {
      console.log(`\n⚠️  Files with only warnings: ${warningOnlyFiles.length} files\n`);
    }

    // Error rule breakdown
    console.log('\n\n📋 Error Rules in Production Code:\n');
    const allErrorRules = {};
    productionErrors.forEach(file => {
      file.errorRules.forEach(rule => {
        allErrorRules[rule] = (allErrorRules[rule] || 0) + 1;
      });
    });

    Object.entries(allErrorRules)
      .sort((a, b) => b[1] - a[1])
      .forEach(([rule, count]) => {
        console.log(`  ${rule}: ${count} errors`);
      });

  } catch (error) {
    console.error('❌ Error reading report:', error.message);
    console.log('\n💡 Try running: pnpm lint');
  }
}

if (require.main === module) {
  analyzeProductionErrors();
}

module.exports = { analyzeProductionErrors };



