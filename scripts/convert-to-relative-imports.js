#!/usr/bin/env node

/**
 * Script to convert same-feature absolute imports to relative imports
 * 
 * Converts imports like:
 *   ~/features/posts/components/ContentBulkActions
 * to:
 *   ./ContentBulkActions (or ../components/ContentBulkActions depending on location)
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function getAllFeatureFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules, .git, etc.
      if (!file.startsWith('.') && file !== 'node_modules') {
        getAllFeatureFiles(filePath, fileList);
      }
    } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.endsWith('.d.ts')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function getFeatureName(filePath) {
  const match = filePath.match(/app\/features\/([^/]+)/);
  return match ? match[1] : null;
}

function convertToRelativePath(fromFile, toPath) {
  // Extract the feature name and path from the absolute import
  // e.g., ~/features/posts/components/ContentBulkActions -> posts/components/ContentBulkActions
  const match = toPath.match(/^~\/features\/([^/]+)\/(.+)$/);
  if (!match) return null;

  const [, featureName, importPath] = match;

  // Get the feature name of the importing file
  const fromFeature = getFeatureName(fromFile);
  if (!fromFeature || fromFeature !== featureName) {
    return null; // Not a same-feature import
  }

  // Get directories
  const fromDir = path.dirname(fromFile);
  const toFile = path.join(PROJECT_ROOT, 'app', 'features', featureName, importPath);
  
  // Try to find the actual file (with extension)
  let actualToFile = null;
  const possibleExtensions = ['.ts', '.tsx', '.js', '.jsx'];
  for (const ext of possibleExtensions) {
    const candidate = toFile + ext;
    if (fs.existsSync(candidate)) {
      actualToFile = candidate;
      break;
    }
  }
  
  // If no extension found, assume it's a directory with index file
  if (!actualToFile && fs.existsSync(toFile)) {
    const stat = fs.statSync(toFile);
    if (stat.isDirectory()) {
      // Try index files
      for (const ext of possibleExtensions) {
        const indexFile = path.join(toFile, 'index' + ext);
        if (fs.existsSync(indexFile)) {
          actualToFile = indexFile;
          break;
        }
      }
    }
  }

  if (!actualToFile) {
    // File doesn't exist, but we'll still try to create a relative path
    actualToFile = toFile;
  }

  // Calculate relative path
  const relativePath = path.relative(fromDir, actualToFile);
  
  // Remove extension for import
  let importPathRelative = relativePath.replace(/\.(ts|tsx|js|jsx)$/, '');
  
  // Ensure it starts with ./ or ../
  if (!importPathRelative.startsWith('.')) {
    importPathRelative = './' + importPathRelative;
  }

  // Normalize path separators for imports (use forward slashes)
  importPathRelative = importPathRelative.replace(/\\/g, '/');

  return importPathRelative;
}

function fixImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const changes = [];

  // Match import statements with ~/features/... paths
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*(?:\s*,\s*type\s+\{[^}]*\})*|type\s+\{[^}]*\})\s+from\s+["'](~\/features\/[^"']+)["']/g;
  
  const matches = [...content.matchAll(importRegex)];
  
  for (const match of matches) {
    const fullMatch = match[0];
    const importPath = match[1];
    
    // Check if this is a same-feature import
    const relativePath = convertToRelativePath(filePath, importPath);
    
    if (relativePath) {
      // Replace the absolute path with relative path
      const newImport = fullMatch.replace(importPath, relativePath);
      content = content.replace(fullMatch, newImport);
      modified = true;
      changes.push(`${importPath} → ${relativePath}`);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return { modified: true, changes };
  }

  return { modified: false, changes: [] };
}

function main() {
  console.log('🔄 Converting same-feature absolute imports to relative imports...\n');

  // Find all feature files
  const featuresDir = path.join(PROJECT_ROOT, 'app', 'features');
  const featureFiles = getAllFeatureFiles(featuresDir);

  console.log(`Found ${featureFiles.length} feature files\n`);

  let totalFixed = 0;
  const fixedFiles = [];

  for (const filePath of featureFiles) {
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
  console.log(`   Total files processed: ${featureFiles.length}`);
  console.log(`   Files fixed: ${totalFixed}`);
  console.log(`   Files unchanged: ${featureFiles.length - totalFixed}`);

  if (totalFixed > 0) {
    console.log(`\n✨ Successfully converted ${totalFixed} file(s)!`);
  } else {
    console.log(`\n✨ No files needed conversion.`);
  }
}

try {
  main();
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}




