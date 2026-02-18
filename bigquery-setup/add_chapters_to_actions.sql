-- Add chapters column to lumoviz_actions table
-- This allows actions to be scoped to specific chapters

-- IMPORTANT: Run this in BigQuery Console for organizing-data-487317.lumoviz dataset

-- Step 1: Add the chapters column
ALTER TABLE `organizing-data-487317.lumoviz.lumoviz_actions`
ADD COLUMN IF NOT EXISTS chapters ARRAY<STRING>;

-- Step 2: Add column description
ALTER TABLE `organizing-data-487317.lumoviz.lumoviz_actions`
ALTER COLUMN chapters SET OPTIONS (
  description = 'Array of chapter names that can see/use this action. Empty/NULL means all chapters (federation-wide).'
);

-- Verify the column was added
SELECT 
  column_name, 
  data_type,
  description
FROM `organizing-data-487317.lumoviz`.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS
WHERE table_name = 'lumoviz_actions'
  AND column_name = 'chapters';

-- Optional: Check current actions to see what has chapters set
SELECT 
  action_id,
  action_name,
  chapters,
  visible_to_organizers,
  organizer_vanid
FROM `organizing-data-487317.lumoviz.lumoviz_actions`
ORDER BY action_id;
