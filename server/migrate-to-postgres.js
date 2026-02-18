#!/usr/bin/env node

/**
 * BigQuery to PostgreSQL Migration Script
 * Converts queries in index.js systematically
 */

const fs = require('fs');
const path = require('path');

const INDEX_FILE = path.join(__dirname, 'index.js');
const BACKUP_FILE = path.join(__dirname, 'index.js.bigquery-backup');

console.log('🔄 Migrating BigQuery queries to PostgreSQL...\n');

// Create backup if it doesn't exist
if (!fs.existsSync(BACKUP_FILE)) {
  fs.copyFileSync(INDEX_FILE, BACKUP_FILE);
  console.log(`✅ Backup created: ${BACKUP_FILE}\n`);
} else {
  console.log(`ℹ️  Backup already exists: ${BACKUP_FILE}\n`);
}

let content = fs.readFileSync(INDEX_FILE, 'utf8');
let totalReplacements = 0;

// Step 1: Remove table prefixes
console.log('📝 Step 1: Removing BigQuery table prefixes...');
let step1Count = 0;

// Remove backticks and PROJECT.DATASET prefix
content = content.replace(
  /`\$\{PROJECT_ID\}\.\$\{DATASET_ID\}\.([a-z_]+)`/g,
  (match, tableName) => {
    step1Count++;
    return tableName;
  }
);

// Remove hardcoded project.dataset
content = content.replace(
  /`chapter-448015\.lumoviz\.([a-z_]+)`/g,
  (match, tableName) => {
    step1Count++;
    return tableName;
  }
);

console.log(`   ✅ Removed ${step1Count} table prefixes\n`);
totalReplacements += step1Count;

// Step 2: Convert BigQuery query execution to PostgreSQL
console.log('📝 Step 2: Converting query execution patterns...');
let step2Count = 0;

// Pattern 1: Simple queries without params
content = content.replace(
  /const \[rows\] = await bigquery\.query\(\{\s*query:\s*`/g,
  (match) => {
    step2Count++;
    return 'const result = await pool.query(`';
  }
);

content = content.replace(
  /const \[rows\] = await bigquery\.query\(\s*`/g,
  (match) => {
    step2Count++;
    return 'const result = await pool.query(`';
  }
);

// Add result.rows after each converted query
content = content.replace(
  /(const result = await pool\.query\([^;]+\);)(?!\s*const rows)/g,
  (match) => {
    return `${match}\n    const rows = result.rows;`;
  }
);

console.log(`   ✅ Converted ${step2Count} query executions\n`);
totalReplacements += step2Count;

// Step 3: Remove BigQuery-specific options
console.log('📝 Step 3: Removing BigQuery-specific options...');
let step3Count = 0;

content = content.replace(
  /,\s*location:\s*['"]US['"]/g,
  () => {
    step3Count++;
    return '';
  }
);

content = content.replace(
  /,\s*location:\s*['"]us-central1['"]/g,
  () => {
    step3Count++;
    return '';
  }
);

console.log(`   ✅ Removed ${step3Count} BigQuery options\n`);
totalReplacements += step3Count;

// Step 4: Fix SQL syntax differences
console.log('📝 Step 4: Converting SQL syntax differences...');
let step4Count = 0;

// CURRENT_TIMESTAMP() -> CURRENT_TIMESTAMP
const before4a = content;
content = content.replace(/CURRENT_TIMESTAMP\(\)/g, 'CURRENT_TIMESTAMP');
step4Count += (before4a !== content) ? (before4a.length - content.length) / 'CURRENT_TIMESTAMP()'.length : 0;

// DATE(field) -> field::date
const before4b = content;
content = content.replace(/\bDATE\(([^)]+)\)/g, '($1)::date');
step4Count += (before4b !== content) ? 1 : 0;

// IN UNNEST(array) -> = ANY(array)
const before4c = content;
content = content.replace(/(\w+)\s+IN\s+UNNEST\(([^)]+)\)/gi, '$1 = ANY($2)');
step4Count += (before4c !== content) ? 1 : 0;

console.log(`   ✅ Fixed ${step4Count} SQL syntax differences\n`);
totalReplacements += step4Count;

// Write the result
fs.writeFileSync(INDEX_FILE, content);

console.log('=' .repeat(60));
console.log(`✅ Migration complete! Made ${totalReplacements} changes`);
console.log('=' .repeat(60));
console.log(`\n📝 Updated: ${INDEX_FILE}`);
console.log(`💾 Backup: ${BACKUP_FILE}`);
console.log('\n⚠️  NEXT STEPS:');
console.log('1. Review the changes in index.js');
console.log('2. Look for any remaining bigquery.query() calls');
console.log('3. Manually fix parameterized queries (@param -> $1, $2, etc.)');
console.log('4. Test the server: npm start\n');
