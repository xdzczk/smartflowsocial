#!/usr/bin/env node

/**
 * Find ESLint Errors by Location
 * 
 * This script helps identify where ESLint errors are located in the codebase
 * by analyzing the eslint-report.json file or running ESLint directly.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function isTestOrScript(filePath) {
  return (
    filePath.includes('/tests/') ||
    filePath.includes('/test/') ||
    filePath.includes('/scripts/') ||
    filePath.includes('.test.') ||
    filePath.includes('.spec.')
  );
}

function analyzeErrors() {
  console.log('🔍 Analyzing ESLint errors...\n');

  try {
    // Try to read the report file
    const reportPath = path.join(PROJECT_ROOT, 'eslint-report.json');
    let reportData;

    if (fs.existsSync(reportPath)) {
      const content = fs.readFileSync(reportPath, 'utf8');
      if (content.trim().startsWith('{')) {
        reportData = JSON.parse(content);
      } else {
        console.log('⚠️  eslint-report.json exists but is not valid JSON');
        console.log('💡 Regenerating report...\n');
        throw new Error('Invalid report');
      }
    } else {
      throw new Error('Report not found');
    }

    if (!Array.isArray(reportData)) {
      console.log('⚠️  Report format is not an array');
      return;
    }

    // Categorize errors
    const errors = {
      production: { files: new Set(), count: 0, byRule: {} },
      tests: { files: new Set(), count: 0, byRule: {} },
      scripts: { files: new Set(), count: 0, byRule: {} },
    };

    const warnings = {
      production: { files: new Set(), count: 0, byRule: {} },
      tests: { files: new Set(), count: 0, byRule: {} },
      scripts: { files: new Set(), count: 0, byRule: {} },
    };

    reportData.forEach((file) => {
      if (!file.messages || file.messages.length === 0) return;

      const isTest = isTestOrScript(file.filePath);
      const category = isTest ? 'tests' : 'production';

      file.messages.forEach((message) => {
        if (message.severity === 2) {
          // Error
          errors[category].files.add(file.filePath);
          errors[category].count++;
          errors[category].byRule[message.ruleId || 'unknown'] = 
            (errors[category].byRule[message.ruleId || 'unknown'] || 0) + 1;
        } else if (message.severity === 1) {
          // Warning
          warnings[category].files.add(file.filePath);
          warnings[category].count++;
          warnings[category].byRule[message.ruleId || 'unknown'] = 
            (warnings[category].byRule[message.ruleId || 'unknown'] || 0) + 1;
        }
      });
    });

    // Print summary
    console.log('📊 ESLint Error Summary\n');
    console.log('='.repeat(60));
    
    const totalErrors = errors.production.count + errors.tests.count + errors.scripts.count;
    const totalWarnings = warnings.production.count + warnings.tests.count + warnings.scripts.count;

    console.log(`\nTotal: ${totalErrors} errors, ${totalWarnings} warnings\n`);

    console.log('📁 By Location:\n');
    console.log(`Production Code:`);
    console.log(`  - Errors: ${errors.production.count} (${errors.production.files.size} files)`);
    console.log(`  - Warnings: ${warnings.production.count} (${warnings.production.files.size} files)`);
    
    console.log(`\nTest Files:`);
    console.log(`  - Errors: ${errors.tests.count} (${errors.tests.files.size} files)`);
    console.log(`  - Warnings: ${warnings.tests.count} (${warnings.tests.files.size} files)`);
    
    console.log(`\nScripts:`);
    console.log(`  - Errors: ${errors.scripts.count} (${errors.scripts.files.size} files)`);
    console.log(`  - Warnings: ${warnings.scripts.count} (${warnings.scripts.files.size} files)`);

    // Top error rules
    console.log('\n\n🔴 Top Error Rules:\n');
    const allErrorRules = {};
    Object.values(errors).forEach(cat => {
      Object.entries(cat.byRule).forEach(([rule, count]) => {
        allErrorRules[rule] = (allErrorRules[rule] || 0) + count;
      });
    });
    
    Object.entries(allErrorRules)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([rule, count]) => {
        console.log(`  ${rule}: ${count} errors`);
      });

    // Files with most errors
    console.log('\n\n📄 Files with Most Errors (Production):\n');
    const productionErrorFiles = Array.from(errors.production.files)
      .map(filePath => {
        const fileErrors = reportData.find(f => f.filePath === filePath)?.messages
          .filter(m => m.severity === 2).length || 0;
        return { filePath, count: fileErrors };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    productionErrorFiles.forEach(({ filePath, count }) => {
      const relativePath = path.relative(PROJECT_ROOT, filePath);
      console.log(`  ${relativePath}: ${count} errors`);
    });

    console.log('\n\n📄 Files with Most Errors (Tests):\n');
    const testErrorFiles = Array.from(errors.tests.files)
      .map(filePath => {
        const fileErrors = reportData.find(f => f.filePath === filePath)?.messages
          .filter(m => m.severity === 2).length || 0;
        return { filePath, count: fileErrors };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    testErrorFiles.forEach(({ filePath, count }) => {
      const relativePath = path.relative(PROJECT_ROOT, filePath);
      console.log(`  ${relativePath}: ${count} errors`);
    });

  } catch (error) {
    if (error.message === 'Report not found' || error.message === 'Invalid report') {
      console.log('💡 Generating ESLint report...\n');
      try {
        execSync('pnpm exec eslint --format json . > eslint-report.json', {
          cwd: PROJECT_ROOT,
          stdio: 'inherit',
        });
        console.log('\n✅ Report generated! Run this script again to analyze.');
      } catch (e) {
        console.error('❌ Failed to generate report:', e.message);
        console.log('\n💡 Try running: pnpm exec eslint --format json . > eslint-report.json');
      }
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

if (require.main === module) {
  analyzeErrors();
}

module.exports = { analyzeErrors };





