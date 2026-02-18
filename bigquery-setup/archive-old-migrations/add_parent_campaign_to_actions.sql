-- Add parent_campaign_id column to lumoviz_actions table
-- This allows actions to be linked to campaigns

ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions`
ADD COLUMN IF NOT EXISTS parent_campaign_id STRING;

-- Note: BigQuery automatically optimizes queries on all columns
-- No explicit index creation needed
