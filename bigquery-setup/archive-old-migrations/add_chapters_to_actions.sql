-- Add chapters column to lumoviz_actions table
-- This allows actions to be scoped to specific chapters

ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions`
ADD COLUMN IF NOT EXISTS chapters ARRAY<STRING>;

ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions`
ALTER COLUMN chapters SET OPTIONS (
  description = 'Array of chapter names that can see/use this action. Empty/NULL means all chapters can use it.'
);
