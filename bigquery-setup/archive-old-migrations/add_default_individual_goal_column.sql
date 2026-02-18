-- Add default_individual_goal column to lumoviz_actions table
-- This field stores the default goal for individuals (e.g., 5)

ALTER TABLE `lumoviz.lumoviz_actions`
ADD COLUMN IF NOT EXISTS default_individual_goal INT64;

-- Update existing actions to have a default value of 5
UPDATE `lumoviz.lumoviz_actions`
SET default_individual_goal = 5
WHERE default_individual_goal IS NULL;
