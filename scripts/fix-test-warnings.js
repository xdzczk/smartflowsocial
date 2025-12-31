#!/usr/bin/env node

/**
 * Fix common test file warnings
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

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

function fixUnusedVariables(content, filePath) {
  // This is complex - we'll handle it manually for specific cases
  return content;
}

function fixTypeAssertions(content) {
  // Fix `import()` type annotations to use `import type`
  // Pattern: import( from "..." ) -> import type { ... } from "..."
  // This is complex, so we'll handle specific cases
  
  // Fix `as unknown as T` to `as T` where appropriate
  // But this needs type checking, so we'll be conservative
  
  // Fix `const x = { ... } as T` to `const x: T = { ... }`
  let fixed = content;
  
  // Pattern: const x = { ... } as Type
  fixed = fixed.replace(
    /const\s+(\w+)\s*=\s*(\{[^}]*\})\s+as\s+([A-Z][\w<>[\],\s|&]*)/g,
    (match, varName, obj, type) => {
      // Only fix if it's a simple object literal
      if (obj.includes('\n') && obj.split('\n').length > 5) {
        return match; // Too complex, skip
      }
      return `const ${varName}: ${type.trim()} = ${obj}`;
    }
  );
  
  return fixed;
}

function fixNullishCoalescing(content) {
  let fixed = content;
  
  // Fix `||` to `??` where safe (not for regex, not for falsy defaults)
  // Pattern: value || defaultValue where value could be null/undefined
  // We'll be conservative and only fix obvious cases
  
  // Fix `x ||= y` to `x ??= y` (assignment)
  fixed = fixed.replace(/(\w+)\s*\|\|=\s*/g, '$1 ??= ');
  
  // Fix simple cases: `x || y` where x is a variable and y is a literal/default
  // But we need to be careful - only fix where it's clearly a nullish check
  // Pattern: variable || defaultValue (where defaultValue is not 0, false, "")
  fixed = fixed.replace(
    /(\w+)\s*\|\|\s*([A-Z_][\w.]*|"[^"]*"|'[^']*'|\d+)/g,
    (match, varName, defaultValue) => {
      // Skip if it's a regex pattern
      if (match.includes('/') && match.includes('||')) {
        return match;
      }
      // Skip if default is 0, false, or empty string (these need ||)
      if (defaultValue === '0' || defaultValue === 'false' || defaultValue === '""' || defaultValue === "''") {
        return match;
      }
      return `${varName} ?? ${defaultValue}`;
    }
  );
  
  return fixed;
}

function processFile(filePath) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    return false;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;
  
  // Apply fixes
  content = fixTypeAssertions(content);
  content = fixNullishCoalescing(content);
  
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    return true;
  }
  
  return false;
}

// Main execution
if (require.main === module) {
  console.log('🔧 Fixing test warnings...\n');
  
  // For now, this script is a placeholder
  // We'll fix files manually for better accuracy
  console.log('⚠️  This script needs manual fixes for accuracy.');
  console.log('💡 Use this as a helper, but review changes carefully.\n');
}

module.exports = { fixTypeAssertions, fixNullishCoalescing, processFile };


