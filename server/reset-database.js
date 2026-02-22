/**
 * Reset Database Script
 * 
 * Clears ALL data from PostgreSQL and BigQuery tables.
 * Table structure is preserved — only rows are deleted.
 * 
 * Usage: node server/reset-database.js
 * 
 * Add --yes to skip the confirmation prompt:
 *   node server/reset-database.js --yes
 */

const pool = require('./db');
const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const PROJECT_ID = process.env.PROJECT_ID || 'chapter-448015';
const DATASET_ID = 'lumoviz';
const bigquery = new BigQuery({ projectId: PROJECT_ID });

const POSTGRES_TABLES = [
  'lumoviz_lists',
  'lumoviz_meetings',
  'lumoviz_team_members',
  'lumoviz_team_changelog',
  'lumoviz_contact_organizers',
  'lumoviz_sections',
  'organizer_goals',
  'lumoviz_teams',
  'lumoviz_actions',
  'lumoviz_users',
  'contacts',
];

const BIGQUERY_TABLES = [
  'lumoviz_teams',
  'lumoviz_lists',
  'lumoviz_actions',
  'lumoviz_organizer_mapping',
  'lumoviz_campaigns',
  'lumoviz_campaign_goals',
  'lumoviz_campaign_milestones',
  'conversations',
  'contacts',
  'links',
  'staff',
  'user_map',
  'contact_history',
];

async function resetPostgres() {
  console.log('\n── Clearing PostgreSQL tables ──');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const table of POSTGRES_TABLES) {
      try {
        await client.query(`DELETE FROM ${table}`);
        console.log(`  ✓ ${table}`);
      } catch (err) {
        if (err.code === '42P01') {
          console.log(`  - ${table} (does not exist, skipping)`);
        } else if (err.code === '23503') {
          console.log(`  ~ ${table} (has FK references, will retry)`);
        } else {
          throw err;
        }
      }
    }
    // Retry any that failed due to FK ordering
    for (const table of POSTGRES_TABLES) {
      try {
        await client.query(`DELETE FROM ${table}`);
      } catch (err) {
        // Already empty or doesn't exist
      }
    }
    await client.query('COMMIT');
    console.log('  PostgreSQL reset complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('  ✗ PostgreSQL reset failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function resetBigQuery() {
  console.log('\n── Clearing BigQuery tables ──');
  for (const table of BIGQUERY_TABLES) {
    try {
      const [tableExists] = await bigquery.dataset(DATASET_ID).table(table).exists();
      if (!tableExists) {
        console.log(`  - ${table} (does not exist, skipping)`);
        continue;
      }
      await bigquery.query({
        query: `DELETE FROM \`${PROJECT_ID}.${DATASET_ID}.${table}\` WHERE TRUE`,
      });
      console.log(`  ✓ ${table}`);
    } catch (err) {
      console.log(`  - ${table} (${err.message.split('\n')[0]})`);
    }
  }
  console.log('  BigQuery reset complete.');
}

async function main() {
  const skipConfirm = process.argv.includes('--yes');

  if (!skipConfirm) {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const answer = await new Promise(resolve => {
      rl.question(
        '\n⚠️  This will DELETE ALL DATA in both PostgreSQL and BigQuery.\n' +
        '   Tables: contacts, teams, lists, actions, meetings, users, campaigns, etc.\n\n' +
        '   Type "RESET" to confirm: ',
        resolve
      );
    });
    rl.close();

    if (answer !== 'RESET') {
      console.log('\nAborted. No data was deleted.');
      process.exit(0);
    }
  }

  console.log('\n🗑️  Resetting database...');

  await resetPostgres();
  await resetBigQuery();

  console.log('\n✅ Database reset complete. All tables are empty.\n');
  process.exit(0);
}

main().catch(err => {
  console.error('\n✗ Reset failed:', err.message);
  process.exit(1);
});
