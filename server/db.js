const { Pool } = require('pg');
require('dotenv').config(); // Load environment variables

const isProduction = process.env.NODE_ENV === 'production';

// Shared pool settings that handle Cloud SQL Proxy connection drops gracefully
const poolConfig = {
  max: 10,
  idleTimeoutMillis: 10000,       // close idle connections after 10s (avoids stale connections)
  connectionTimeoutMillis: 10000,  // give up connecting after 10s
  allowExitOnIdle: false,          // keep pool alive
};

// Configuration for PostgreSQL connection
const pool = isProduction
  ? new Pool({
      ...poolConfig,
      user: process.env.DB_USER || 'lumoviz_app',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'lumoviz',
      host: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
    })
  : new Pool({
      ...poolConfig,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'lumoviz_app',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'lumoviz',
    });

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

// Remove terminated clients from the pool automatically
pool.on('error', (err, client) => {
  console.error('❌ PostgreSQL pool error (client will be removed):', err.message);
});

module.exports = pool;
