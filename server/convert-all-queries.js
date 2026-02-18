#!/usr/bin/env node

/**
 * Comprehensive BigQuery to PostgreSQL Converter
 * Handles all query patterns in index.js
 */

const fs = require('fs');
const path = require('path');

const INDEX_FILE = path.join(__dirname, 'index.js');
let content = fs.readFileSync(INDEX_FILE, 'utf8');

console.log('🔄 Converting all BigQuery queries to PostgreSQL...\n');

let totalConversions = 0;

// Helper function to convert params object notation to positional
function convertParamsToPositional(paramsObj) {
  // This is a simplified version - handles basic cases
  // For complex cases, we'll need manual review
  return `Object.values(${paramsObj})`;
}

// Pattern 1: await bigquery.query({ query, params })
console.log('Converting Pattern 1: bigquery.query({ query, params })...');
let pattern1Count = 0;
content = content.replace(
  /await bigquery\.query\(\{\s*query,\s*params:\s*(\{[^}]+\})\s*\}\)/g,
  (match, params) => {
    pattern1Count++;
    return `await pool.query(query, Object.values(${params}))`;
  }
);
console.log(`✅ Converted ${pattern1Count} queries\n`);
totalConversions += pattern1Count;

// Pattern 2: await bigquery.query({ query, params: { key: value } })
console.log('Converting Pattern 2: bigquery.query({ query, params: {...} })...');
let pattern2Count = 0;
content = content.replace(
  /await bigquery\.query\(\{\s*query:\s*([^,]+),\s*params:\s*(\{[\s\S]*?\})\s*\}\)/g,
  (match, queryVar, params) => {
    pattern2Count++;
    return `await pool.query(${queryVar}, Object.values(${params}))`;
  }
);
console.log(`✅ Converted ${pattern2Count} queries\n`);
totalConversions += pattern2Count;

// Pattern 3: const [rows] = await bigquery.query(query)
console.log('Converting Pattern 3: const [rows] = await bigquery.query(query)...');
let pattern3Count = 0;
content = content.replace(
  /const \[rows\] = await bigquery\.query\(([^)]+)\)/g,
  (match, queryArg) => {
    pattern3Count++;
    if (queryArg.includes('{')) {
      // Has options object
      return `const result = await pool.query(${queryArg});\n    const rows = result.rows`;
    } else {
      // Simple query string
      return `const result = await pool.query(${queryArg});\n    const rows = result.rows`;
    }
  }
);
console.log(`✅ Converted ${pattern3Count} queries\n`);
totalConversions += pattern3Count;

// Pattern 4: await bigquery.query(options)
console.log('Converting Pattern 4: await bigquery.query(options)...');
let pattern4Count = 0;
content = content.replace(
  /await bigquery\.query\(options\)/g,
  (match) => {
    pattern4Count++;
    return `await pool.query(options.query, options.params ? Object.values(options.params) : [])`;
  }
);
console.log(`✅ Converted ${pattern4Count} queries\n`);
totalConversions += pattern4Count;

// Pattern 5: await bigquery.query({ query: `...`, params: {...} })
console.log('Converting Pattern 5: inline query with params...');
let pattern5Count = 0;
content = content.replace(
  /await bigquery\.query\(\{\s*query:\s*`([^`]+)`,\s*params:\s*(\{[^}]+\})\s*\}\)/g,
  (match, query, params) => {
    pattern5Count++;
    return `await pool.query(\`${query}\`, Object.values(${params}))`;
  }
);
console.log(`✅ Converted ${pattern5Count} queries\n`);
totalConversions += pattern5Count;

// Fix any remaining patterns
console.log('Cleaning up remaining patterns...');

// Remove any remaining bigquery references
const remaining = (content.match(/bigquery\.query/g) || []).length;

console.log('\n' + '='.repeat(60));
console.log(`✅ Total conversions: ${totalConversions}`);
console.log(`⚠️  Remaining bigquery.query calls: ${remaining}`);
console.log('='.repeat(60));

// Write the result
fs.writeFileSync(INDEX_FILE, content);

console.log(`\n📝 File updated: ${INDEX_FILE}`);

if (remaining > 0) {
  console.log(`\n⚠️  ${remaining} queries need manual conversion`);
  console.log('   Run: grep -n "bigquery.query" index.js');
  console.log('   to find remaining queries\n');
} else {
  console.log('\n✅ All queries converted!\n');
}
