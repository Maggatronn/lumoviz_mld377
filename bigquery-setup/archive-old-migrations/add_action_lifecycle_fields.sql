-- Add lifecycle fields to lumoviz_actions table

ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions`
ADD COLUMN IF NOT EXISTS status STRING;

ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions`
ALTER COLUMN status SET DEFAULT 'live';

UPDATE `chapter-448015.lumoviz.lumoviz_actions`
SET status = 'live'
WHERE status IS NULL;

ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions`
ADD COLUMN IF NOT EXISTS started_date DATE;

ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions`
ADD COLUMN IF NOT EXISTS archived_date DATE;

ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions`
ALTER COLUMN status SET OPTIONS (
  description = 'Status of the action: live, archived, etc.'
);

ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions`
ALTER COLUMN started_date SET OPTIONS (
  description = 'Date when the action was started/created'
);

ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions`
ALTER COLUMN archived_date SET OPTIONS (
  description = 'Date when the action was archived'
);
