-- Add template system to actions table
-- This enables campaign-level action templates that organizers can adopt

-- Step 1: Add is_template column
ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions`
ADD COLUMN IF NOT EXISTS is_template BOOL;

-- Step 2: Set default value for is_template
ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions`
ALTER COLUMN is_template SET DEFAULT FALSE;

-- Step 3: Update existing rows to have is_template = FALSE
UPDATE `chapter-448015.lumoviz.lumoviz_actions`
SET is_template = FALSE
WHERE is_template IS NULL;

-- Step 4: Add template_action_id column (no default needed)
ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions`
ADD COLUMN IF NOT EXISTS template_action_id STRING;

-- Note: 
-- - Campaign actions have is_template = TRUE, organizer_vanid = NULL
-- - Personal actions have is_template = FALSE, organizer_vanid = [their ID]
-- - Personal actions from templates have template_action_id = [template ID]
