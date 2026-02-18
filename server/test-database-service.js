require('dotenv').config();
const database = require('./database');

async function testDatabaseService() {
  console.log('🧪 Testing Database Service Layer\n');
  
  try {
    // Test 1: Simple query
    console.log('Test 1: Simple query');
    const [rows1] = await database.query('SELECT COUNT(*) as count FROM lumoviz_teams');
    console.log('✅ Result:', rows1[0]);
    
    // Test 2: Query with BigQuery table reference (should auto-convert)
    console.log('\nTest 2: BigQuery-style table reference');
    const [rows2] = await database.query('SELECT COUNT(*) as count FROM `project.dataset.lumoviz_teams`');
    console.log('✅ Result:', rows2[0]);
    
    // Test 3: Query with params (BigQuery style)
    console.log('\nTest 3: Query with named parameters');
    const [rows3] = await database.query({
      query: 'SELECT * FROM lumoviz_teams WHERE chapter = @chapter LIMIT 1',
      params: { chapter: 'Durham' }
    });
    console.log('✅ Result:', rows3.length, 'rows');
    
    // Test 4: SQL syntax conversion
    console.log('\nTest 4: SQL syntax conversion (CURRENT_TIMESTAMP)');
    const [rows4] = await database.query('SELECT CURRENT_TIMESTAMP() as now');
    console.log('✅ Result:', rows4[0]);
    
    console.log('\n✅ All tests passed!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testDatabaseService();
