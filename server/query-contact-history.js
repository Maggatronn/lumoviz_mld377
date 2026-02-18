const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT_ID = process.env.PROJECT_ID || 'chapter-448015';

// Initialize the BigQuery client
const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

async function queryContactHistory() {
  try {

    // First get the table schema
    const columnsQuery = `
      SELECT column_name, data_type
      FROM \`${PROJECT_ID}\`.pdp_data.INFORMATION_SCHEMA.COLUMNS
      WHERE table_name = 'contact_history'
      ORDER BY ordinal_position
    `;

    const [columns] = await bigquery.query({ query: columnsQuery, location: 'US' });

    
    // Query sample data
    const dataQuery = `
      SELECT *
      FROM \`${PROJECT_ID}.pdp_data.contact_history\`
      LIMIT 10
    `;

    const [rows] = await bigquery.query({ query: dataQuery, location: 'US' });
      
    // Check if there are any date columns
    const dateColumns = columns.filter(col => 
      col.data_type.toLowerCase().includes('date') || 
      col.data_type.toLowerCase().includes('time') ||
      col.column_name.toLowerCase().includes('date') ||
      col.column_name.toLowerCase().includes('time')
    );
    
    // Check if this table can be joined with the links table
    const linksColumnsQuery = `
      SELECT column_name
      FROM \`${PROJECT_ID}\`.pdp_data.INFORMATION_SCHEMA.COLUMNS
      WHERE table_name = 'links'
    `;
    
    const [linksColumns] = await bigquery.query({ query: linksColumnsQuery, location: 'US' });
    const linksColumnNames = linksColumns.map(col => col.column_name);
    const contactHistoryColumnNames = columns.map(col => col.column_name);
    
    const commonColumns = linksColumnNames.filter(col => 
      contactHistoryColumnNames.includes(col)
    );

  } catch (err) {
    console.error('❌ Error querying contact_history table:', err);
  }
}

// Run the query
queryContactHistory(); 