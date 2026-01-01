#!/usr/bin/env node

/**
 * Analyze feature boundary violations
 * Groups violations by type and suggests fixes
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

function analyzeBoundaryViolations() {
  try {
    const reportContent = fs.readFileSync(REPORT_FILE, 'utf8');
    const report = JSON.parse(reportContent);

    const violations = {
      featureIndexFiles: [], // Feature index.ts importing from own internals
      routesImportingComponents: [], // Routes importing components
      routesImportingServices: [], // Routes importing services
      routesImportingHooks: [], // Routes importing hooks
      routesImportingUtils: [], // Routes importing utils
      featuresCrossImporting: [], // Features importing from other features' internals
    };

    report.forEach((file) => {
      const filePath = file.filePath.replace(PROJECT_ROOT + '/', '');
      if (isTestOrScript(filePath)) return;

      const boundaryViolations = file.messages.filter(msg => 
        msg.severity === 1 && msg.ruleId === 'import/no-restricted-paths'
      );

      if (boundaryViolations.length === 0) return;

      const isFeatureIndex = filePath.includes('/features/') && filePath.endsWith('/index.ts');
      const isRoute = filePath.startsWith('app/routes/');
      const isFeatureFile = filePath.includes('/features/') && !isFeatureIndex;

      boundaryViolations.forEach(violation => {
        const message = violation.message || '';
        
        if (isFeatureIndex) {
          violations.featureIndexFiles.push({
            file: filePath,
            line: violation.line,
            message,
          });
        } else if (isRoute) {
          if (message.includes('components')) {
            violations.routesImportingComponents.push({
              file: filePath,
              line: violation.line,
              message,
            });
          } else if (message.includes('services')) {
            violations.routesImportingServices.push({
              file: filePath,
              line: violation.line,
              message,
            });
          } else if (message.includes('hooks')) {
            violations.routesImportingHooks.push({
              file: filePath,
              line: violation.line,
              message,
            });
          } else if (message.includes('utils')) {
            violations.routesImportingUtils.push({
              file: filePath,
              line: violation.line,
              message,
            });
          }
        } else if (isFeatureFile) {
          violations.featuresCrossImporting.push({
            file: filePath,
            line: violation.line,
            message,
          });
        }
      });
    });

    console.log('\n📊 Feature Boundary Violations Analysis\n');
    console.log('='.repeat(80));
    
    console.log(`\n1. Feature Index Files (${violations.featureIndexFiles.length} violations):`);
    console.log('   These are index.ts files importing from their own internals.');
    console.log('   This is actually CORRECT - index.ts should be able to import from its own internals.');
    console.log('   These violations should be EXCLUDED from the rule.\n');
    violations.featureIndexFiles.slice(0, 5).forEach(v => {
      console.log(`   - ${v.file}:${v.line} - ${v.message.substring(0, 60)}...`);
    });
    if (violations.featureIndexFiles.length > 5) {
      console.log(`   ... and ${violations.featureIndexFiles.length - 5} more`);
    }

    console.log(`\n2. Routes Importing Components (${violations.routesImportingComponents.length} violations):`);
    console.log('   Routes should import components from feature index.ts\n');
    const componentImports = new Map();
    violations.routesImportingComponents.forEach(v => {
      const match = v.message.match(/imported in restricted zone\. Routes must use feature public API \(index\.ts\), not internal components/);
      if (match) {
        const fileMatch = v.file.match(/app\/routes\/([^/]+\.tsx?)/);
        const route = fileMatch ? fileMatch[1] : v.file;
        if (!componentImports.has(route)) {
          componentImports.set(route, []);
        }
        componentImports.get(route).push(v);
      }
    });
    Array.from(componentImports.entries()).slice(0, 10).forEach(([route, vs]) => {
      console.log(`   - ${route}: ${vs.length} component imports`);
    });

    console.log(`\n3. Routes Importing Services (${violations.routesImportingServices.length} violations):`);
    console.log('   Routes should import services from feature index.ts\n');

    console.log(`\n4. Routes Importing Hooks (${violations.routesImportingHooks.length} violations):`);
    console.log('   Routes should import hooks from feature index.ts\n');

    console.log(`\n5. Routes Importing Utils (${violations.routesImportingUtils.length} violations):`);
    console.log('   Routes should import utils from feature index.ts\n');

    console.log(`\n6. Features Cross-Importing (${violations.featuresCrossImporting.length} violations):`);
    console.log('   Features importing from other features\' internals\n');

    console.log('\n' + '='.repeat(80));
    console.log(`\n📈 Summary:`);
    console.log(`   Feature Index Files: ${violations.featureIndexFiles.length} (should be excluded)`);
    console.log(`   Routes → Components: ${violations.routesImportingComponents.length}`);
    console.log(`   Routes → Services: ${violations.routesImportingServices.length}`);
    console.log(`   Routes → Hooks: ${violations.routesImportingHooks.length}`);
    console.log(`   Routes → Utils: ${violations.routesImportingUtils.length}`);
    console.log(`   Features → Features: ${violations.featuresCrossImporting.length}`);
    console.log(`   Total: ${violations.featureIndexFiles.length + violations.routesImportingComponents.length + violations.routesImportingServices.length + violations.routesImportingHooks.length + violations.routesImportingUtils.length + violations.featuresCrossImporting.length}\n`);

    return violations;
  } catch (error) {
    console.error('Error reading eslint-report.json:', error.message);
    console.log('\n💡 Run: pnpm lint (to generate the report)');
    process.exit(1);
  }
}

if (require.main === module) {
  analyzeBoundaryViolations();
}

module.exports = { analyzeBoundaryViolations };








