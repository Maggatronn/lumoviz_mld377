const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const PROJECT_ID = process.env.PROJECT_ID || 'chapter-448015';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

/**
 * Check BigQuery permissions and access levels
 */
async function checkAccess() {  
  try {
    const [datasets] = await bigquery.getDatasets({ maxResults: 1 });
    
    try {

      const [allDatasets] = await bigquery.getDatasets();
      
      if (allDatasets.length > 0) {
        console.log('\nAvailable datasets:');
        for (const dataset of allDatasets) {
          console.log(`- ${dataset.id}`);
          
          try {
            // Try to list tables in each dataset
            const [tables] = await dataset.getTables();
            console.log(`  ✅ Has access to ${tables.length} tables in this dataset`);
            
            if (tables.length > 0) {
              console.log('  Tables:');
              tables.forEach(table => {
                console.log(`  - ${table.id}`);
              });
              
              // Try to query the first table
              const [rows] = await bigquery.query({
                query: `SELECT * FROM \`${PROJECT_ID}.${dataset.id}.${tables[0].id}\` LIMIT 1`
              });
              console.log(`  ✅ Can query data from ${tables[0].id} (found ${rows.length} rows)`);
            }
          } catch (e) {
            console.log(`  ❌ Cannot access tables in this dataset: ${e.message}`);
          }
        }
      }
    } catch (e) {
      console.log(`❌ Cannot list datasets: ${e.message}`);
    }
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
  }
  
  console.log('\n=== END OF ACCESS CHECK ===\n');
}

// Run the check
checkAccess(); 