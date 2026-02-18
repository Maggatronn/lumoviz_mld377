#!/usr/bin/env node

/**
 * Automated BigQuery to PostgreSQL Query Converter
 * 
 * This script converts BigQuery queries in index.js to PostgreSQL syntax
 */

const fs = require('fs');
const path = require('path');

const INDEX_FILE = path.join(__dirname, 'index.js');
const BACKUP_FILE = path.join(__dirname, 'index.js.backup');

console.log('🔄 Converting BigQuery queries to PostgreSQL...\n');

// Create backup
fs.copyFileSync(INDEX_FILE, BACKUP_FILE);
console.log(`✅ Backup created: ${BACKUP_FILE}\n`);

let content = fs.readFileSync(INDEX_FILE, 'utf8');
let conversionCount = 0;

// Conversion patterns
const conversions = [
  // 1. Replace BigQuery table references with simple table names
  {
    pattern: /`\$\{PROJECT_ID\}\.\$\{DATASET_ID\}\.([a-z_]+)`/g,
    replacement: '$1',
    description: 'Remove project/dataset prefix from table names'
  },
  {
    pattern: /`chapter-448015\.lumoviz\.([a-z_]+)`/g,
    replacement: '$1',
    description: 'Remove hardcoded project/dataset'
  },
  
  // 2. Replace BigQuery query execution pattern
  {
    pattern: /const \[rows\] = await bigquery\.query\(\{[\s\S]*?query:\s*`([\s\S]*?)`[\s\S]*?params:\s*(\{[\s\S]*?\})[\s\S]*?\}\);/g,
    replacement: (match, query, params) => {
      conversionCount++;
      // Convert params object to array
      return `const result = await pool.query(\n  \`${query}\`,\n  Object.values(${params})\n);\nconst rows = result.rows;`;
    },
    description: 'Convert BigQuery query pattern to PostgreSQL'
  },
  
  // 3. Replace simple queries without params
  {
    pattern: /const \[rows\] = await bigquery\.query\(\{\s*query:\s*`([\s\S]*?)`,\s*location:\s*'[^']*'\s*\}\);/g,
    replacement: (match, query) => {
      conversionCount++;
      return `const result = await pool.query(\`${query}\`);\nconst rows = result.rows;`;
    },
    description: 'Convert simple queries without params'
  },
  
  // 4. Replace @ parameters with $ placeholders
  {
    pattern: /@(\w+)/g,
    replacement: (match, paramName, offset, fullString) => {
      // Only replace if it's in a SQL query (inside backticks)
      // This is a simplified approach - you might need to refine
      return match; // We'll handle this in a second pass
    },
    description: 'Convert @ parameters to $ placeholders'
  },
  
  // 5. Replace CURRENT_TIMESTAMP() with CURRENT_TIMESTAMP
  {
    pattern: /CURRENT_TIMESTAMP\(\)/g,
    replacement: 'CURRENT_TIMESTAMP',
    description: 'Fix CURRENT_TIMESTAMP syntax'
  },
  
  // 6. Replace DATE() casts
  {
    pattern: /DATE\(([^)]+)\)/g,
    replacement: '($1)::date',
    description: 'Convert DATE() to PostgreSQL cast'
  },
  
  // 7. Replace IN UNNEST() with = ANY()
  {
    pattern: /(\w+)\s+IN\s+UNNEST\(([^)]+)\)/gi,
    replacement: '$1 = ANY($2)',
    description: 'Convert IN UNNEST to = ANY'
  },
];

// Apply all conversions
conversions.forEach(conv => {
  const before = content;
  content = content.replace(conv.pattern, conv.replacement);
  const changesMade = before !== content;
  
  console.log(`${changesMade ? '✅' : '⏭️ '} ${conv.description}`);
});

console.log(`\n📊 Converted ${conversionCount} query patterns\n`);

// Write the updated file
fs.writeFileSync(INDEX_FILE, content);

console.log('✅ Conversion complete!');
console.log(`📝 Updated file: ${INDEX_FILE}`);
console.log(`💾 Backup saved: ${BACKUP_FILE}`);
console.log('\n⚠️  IMPORTANT: This is an automated conversion.');
console.log('   Manual review and testing is required!');
console.log('   Some queries may need additional adjustments.\n');
