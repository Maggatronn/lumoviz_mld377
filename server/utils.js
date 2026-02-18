const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const PROJECT_ID = process.env.PROJECT_ID || 'chapter-448015';
  
const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

const dataset = 'network_data';
const requiredTables = ['contacts', 'links', 'id_mapping'];

/**
 * Checks which BigQuery datasets the service account has access to
 */
async function listAvailableDatasets() {
  
  try {
    const [datasets] = await bigquery.getDatasets();
    if (datasets.length === 0) {
      console.log('No datasets found. Make sure the service account has access to BigQuery datasets.');
      return [];
    }
    return datasets.map(dataset => dataset.id);
  } catch (error) {
    console.error('Error listing datasets:', error);
    return [];
  }
}

/**
 * Lists available tables in the given dataset
 */
async function listTablesInDataset(datasetId) {  
  try {
    const [tables] = await bigquery.dataset(datasetId).getTables();
    if (tables.length === 0) {
      console.log(`No tables found in dataset: ${datasetId}`);
      return [];
    }    
    return tables.map(table => table.id);
  } catch (error) {
    console.error(`Error listing tables in ${datasetId}:`, error);
    return [];
  }
}

module.exports = {
  listAvailableDatasets,
  listTablesInDataset
}; 