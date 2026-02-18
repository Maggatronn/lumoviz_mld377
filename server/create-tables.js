const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const PROJECT_ID = process.env.PROJECT_ID || 'chapter-448015';

const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

const dataset = 'lumoviz';

async function createDatasetIfNotExists() {
  try {
    const [datasets] = await bigquery.getDatasets();
    const datasetExists = datasets.some(d => d.id === dataset);
    
    if (!datasetExists) {
      console.log(`Creating dataset: ${dataset}`);
      await bigquery.createDataset(dataset);
      console.log(`Dataset ${dataset} created successfully!`);
    } else {
      console.log(`Dataset ${dataset} already exists.`);
    }
  } catch (error) {
    console.error('Error creating dataset:', error);
    throw error;
  }
}

async function createContactsTable() {
  try {
    const [exists] = await bigquery
      .dataset(dataset)
      .table('contacts')
      .exists();
      
    if (!exists) {
      console.log('Creating contacts table...');
      
      const schema = [
        { name: 'id', type: 'STRING' },
        { name: 'firstname', type: 'STRING' },
        { name: 'lastname', type: 'STRING' },
        { name: 'chapter', type: 'STRING' },
        { name: 'member_status', type: 'STRING' },
        { name: 'loe', type: 'STRING' }
      ];
      
      const options = {
        schema,
        timePartitioning: {
          type: 'DAY'
        }
      };
      
      await bigquery
        .dataset(dataset)
        .createTable('contacts', options);
        
      console.log('Contacts table created successfully!');
    } else {
      console.log('Contacts table already exists.');
    }
  } catch (error) {
    console.error('Error creating contacts table:', error);
    throw error;
  }
}

async function createIdMappingTable() {
  try {
    const [exists] = await bigquery
      .dataset(dataset)
      .table('id_mapping')
      .exists();
      
    if (!exists) {
      console.log('Creating id_mapping table...');
      
      const schema = [
        { name: 'UserID', type: 'STRING' },
        { name: 'VANID', type: 'STRING' },
        { name: 'First Name', type: 'STRING' },
        { name: 'Last Name', type: 'STRING' }
      ];
      
      const options = {
        schema
      };
      
      await bigquery
        .dataset(dataset)
        .createTable('id_mapping', options);
        
      console.log('ID mapping table created successfully!');
    } else {
      console.log('ID mapping table already exists.');
    }
  } catch (error) {
    console.error('Error creating id_mapping table:', error);
    throw error;
  }
}

async function createLinksTable() {
  try {
    const [exists] = await bigquery
      .dataset(dataset)
      .table('links')
      .exists();
      
    if (!exists) {
      console.log('Creating links table...');
      
      const schema = [
        { name: 'source', type: 'STRING' },
        { name: 'target', type: 'STRING' },
        { name: 'count', type: 'STRING' },
        { name: 'source_chapter', type: 'STRING' },
        { name: 'target_chapter', type: 'STRING' },
        { name: 'contact_type', type: 'STRING' },
        { name: 'contact_result', type: 'STRING' },
        { name: 'vanId', type: 'STRING' },
        { name: 'userId', type: 'STRING' },
        { name: 'utc_datecanvassed', type: 'TIMESTAMP' }
      ];
      
      const options = {
        schema,
        timePartitioning: {
          type: 'DAY',
          field: 'utc_datecanvassed'
        }
      };
      
      await bigquery
        .dataset(dataset)
        .createTable('links', options);
        
      console.log('Links table created successfully!');
    } else {
      console.log('Links table already exists.');
    }
  } catch (error) {
    console.error('Error creating links table:', error);
    throw error;
  }
}

async function createTeamsTable() {
  try {
    const [exists] = await bigquery
      .dataset(dataset)
      .table('lumoviz_teams')
      .exists();

    if (!exists) {
      console.log('Creating lumoviz_teams table...');

      const schema = [
        { name: 'id', type: 'STRING' },
        { name: 'team_name', type: 'STRING' },
        { name: 'team_leader', type: 'STRING' },
        { name: 'chapter', type: 'STRING' },
        { name: 'team_members', type: 'STRING' },
        { name: 'turf', type: 'STRING' },
        { name: 'date_created', type: 'DATE' },
        { name: 'date_disbanded', type: 'STRING' },
        { name: 'color', type: 'STRING' }
      ];

      await bigquery
        .dataset(dataset)
        .createTable('lumoviz_teams', { schema });

      console.log('lumoviz_teams table created successfully!');
    } else {
      console.log('lumoviz_teams table already exists.');
    }
  } catch (error) {
    console.error('Error creating lumoviz_teams table:', error);
    throw error;
  }
}

async function run() {
  try {
    await createDatasetIfNotExists();
    await createContactsTable();
    await createIdMappingTable();
    await createLinksTable();
    await createTeamsTable();
    console.log('All tables created successfully!');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
}

run(); 