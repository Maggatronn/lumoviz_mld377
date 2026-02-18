-- Add has_goal field to lumoviz_actions table
-- This field indicates whether an action has a goal/target (true) or is just a tracking list (false)

-- Step 1: Add the column (BigQuery doesn't support DEFAULT in ADD COLUMN)
ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions`
ADD COLUMN IF NOT EXISTS has_goal BOOL;

-- Step 2: Update existing actions to have has_goal = true by default
UPDATE `chapter-448015.lumoviz.lumoviz_actions`
SET has_goal = TRUE
WHERE has_goal IS NULL;
