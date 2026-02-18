-- ================================================================
-- CREATE LUMOVIZ DATASET in organizing-data-487317
-- ================================================================
-- Run this FIRST before creating tables
--
-- Instructions:
-- 1. Go to BigQuery console (console.cloud.google.com/bigquery)
-- 2. Make sure you're in the organizing-data-487317 project
-- 3. Run the command below
-- ================================================================

CREATE SCHEMA IF NOT EXISTS `organizing-data-487317.lumoviz`
OPTIONS (
  description = 'Lumoviz organizing data - teams, campaigns, actions, contacts, and meetings',
  location = 'US'
);

-- ================================================================
-- After running this, you should see 'lumoviz' appear in the left sidebar
-- under organizing-data-487317 project.
--
-- Next step: Run 00_MASTER_SETUP.sql to create all tables
-- ================================================================
