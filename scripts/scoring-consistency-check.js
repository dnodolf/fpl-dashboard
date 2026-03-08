#!/usr/bin/env node
/**
 * Scoring Consistency Check
 *
 * Catches banned field usage patterns that cause scoring inconsistencies.
 * Run: node scripts/scoring-consistency-check.js
 *
 * Rules enforced (from CLAUDE.md v3.8):
 * 1. NEVER use `current_gw_prediction` or `v3_current_gw` in display components
 * 2. NEVER use `convertToV3Points()` for display — use embedded `prediction.v3_pts`
 * 3. Current GW points: ALWAYS use `getNextNGameweeksTotal()`
 */

const fs = require('fs');
const path = require('path');

// Files to scan (display components + utilities that feed display)
const SCAN_DIRS = [
  'app/components',
  'app/utils',
  'app/hooks',
];

// Files explicitly excluded (service layer setting fields is OK)
const EXCLUDE_FILES = [
  'app/services/',         // Services SET these fields, they don't display them
  'app/api/',              // API routes SET these fields
  'app/utils/cacheManager.js',       // Caching copies fields for storage, not display
  'app/utils/playerTransformUtils.js', // Transform copies fields for transport, not display
  'node_modules/',
  'scripts/',
  '.next/',
];

// Banned patterns with explanations
const BANNED_PATTERNS = [
  {
    // Match player.current_gw_prediction, p.current_gw_prediction, etc.
    // But NOT setting it (x.current_gw_prediction = ...) or in comments
    pattern: /(?<!\/\/.*)\bplayer\.current_gw_prediction\b|\bp\.current_gw_prediction\b/,
    name: 'current_gw_prediction (read)',
    reason: 'Use getNextNGameweeksTotal(player, scoringMode, currentGW, 1) instead',
    severity: 'error',
  },
  {
    pattern: /(?<!\/\/.*)\bplayer\.v3_current_gw\b|\bp\.v3_current_gw\b/,
    name: 'v3_current_gw (read)',
    reason: 'Use getNextNGameweeksTotal(player, scoringMode, currentGW, 1) instead',
    severity: 'error',
  },
  {
    pattern: /(?<!\/\/.*)\bconvertToV3Points\s*\(/,
    name: 'convertToV3Points() call',
    reason: 'Use embedded prediction.v3_pts instead (calibrated values)',
    severity: 'warning',
  },
];

function getAllJsFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllJsFiles(fullPath));
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

function checkFile(filePath, rootDir) {
  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');

  // Skip excluded files
  if (EXCLUDE_FILES.some(ex => relativePath.startsWith(ex))) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  lines.forEach((line, lineIndex) => {
    // Skip comment lines
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

    for (const rule of BANNED_PATTERNS) {
      if (rule.pattern.test(line)) {
        violations.push({
          file: relativePath,
          line: lineIndex + 1,
          code: trimmed,
          rule: rule.name,
          reason: rule.reason,
          severity: rule.severity,
        });
      }
    }
  });

  return violations;
}

// Run the check
const rootDir = path.resolve(__dirname, '..');
let allViolations = [];

for (const dir of SCAN_DIRS) {
  const fullDir = path.join(rootDir, dir);
  const files = getAllJsFiles(fullDir);
  for (const file of files) {
    allViolations.push(...checkFile(file, rootDir));
  }
}

// Also check page.js
const pageFile = path.join(rootDir, 'app/page.js');
if (fs.existsSync(pageFile)) {
  allViolations.push(...checkFile(pageFile, rootDir));
}

// Report results
const errors = allViolations.filter(v => v.severity === 'error');
const warnings = allViolations.filter(v => v.severity === 'warning');

console.log('\n=== Scoring Consistency Check ===\n');

if (allViolations.length === 0) {
  console.log('✅ No scoring consistency violations found!\n');
  console.log('All display components use the predictions array (single source of truth).');
  process.exit(0);
}

if (errors.length > 0) {
  console.log(`❌ ${errors.length} ERROR(S) — banned field usage in display components:\n`);
  errors.forEach(v => {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    Rule: ${v.rule}`);
    console.log(`    Fix:  ${v.reason}`);
    console.log(`    Code: ${v.code}\n`);
  });
}

if (warnings.length > 0) {
  console.log(`⚠️  ${warnings.length} WARNING(S) — potentially unsafe scoring patterns:\n`);
  warnings.forEach(v => {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    Rule: ${v.rule}`);
    console.log(`    Fix:  ${v.reason}`);
    console.log(`    Code: ${v.code}\n`);
  });
}

console.log(`\nTotal: ${errors.length} errors, ${warnings.length} warnings`);

// Exit with error code if errors found
if (errors.length > 0) {
  process.exit(1);
}
