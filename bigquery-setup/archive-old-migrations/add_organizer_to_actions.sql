-- Add columns to lumoviz_actions table for personal/shared actions

-- Creator of the action
ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions`
ADD COLUMN IF NOT EXISTS organizer_vanid STRING;

-- Who can see/use this action (array of VAN IDs)
-- If empty/NULL, action is federation-wide (everyone can see it)
-- If has values, only those organizers can see it
ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions`
ADD COLUMN IF NOT EXISTS visible_to_organizers ARRAY<STRING>;

-- Add comments to explain the columns
ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions`
ALTER COLUMN organizer_vanid SET OPTIONS (
  description = 'VAN ID of the organizer who created this action.'
);

ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions`
ALTER COLUMN visible_to_organizers SET OPTIONS (
  description = 'Array of VAN IDs who can see and use this action. Empty/NULL = federation-wide (everyone can see it).'
);

-- Optional: Add index for faster queries
-- CREATE INDEX idx_organizer ON `chapter-448015.lumoviz.lumoviz_actions`(organizer_vanid);
