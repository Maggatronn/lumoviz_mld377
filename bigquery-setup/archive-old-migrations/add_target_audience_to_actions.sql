-- Add target_audience column to distinguish between constituent and leadership actions
ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions` 
ADD COLUMN target_audience STRING;

-- Set default value for existing rows
UPDATE `chapter-448015.lumoviz.lumoviz_actions`
SET target_audience = CASE
  -- Auto-detect leadership actions based on name patterns
  WHEN LOWER(action_name) LIKE '%leadership%' THEN 'leadership'
  WHEN LOWER(action_name) LIKE '%leader%' THEN 'leadership'
  WHEN LOWER(action_name) LIKE '%1:1%' THEN 'leadership'
  WHEN LOWER(action_name) LIKE '%one-on-one%' THEN 'leadership'
  WHEN LOWER(action_name) LIKE '%coaching%' THEN 'leadership'
  WHEN LOWER(action_name) LIKE '%mentoring%' THEN 'leadership'
  -- Default to constituent for everything else
  ELSE 'constituent'
END
WHERE target_audience IS NULL;
