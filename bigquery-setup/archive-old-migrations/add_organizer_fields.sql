-- Add turf and team_role fields to org_ids table
-- This allows each organizer to have their own turf assignment and team role

-- Option 1: If you want to add columns directly to org_ids table
ALTER TABLE `chapter-448015.lumoviz.org_ids`
ADD COLUMN IF NOT EXISTS turf STRING OPTIONS (description = 'Geographic area or organizing territory assigned to this organizer');

ALTER TABLE `chapter-448015.lumoviz.org_ids`
ADD COLUMN IF NOT EXISTS team_role STRING OPTIONS (description = 'Role of this organizer within their team (e.g., Lead Organizer, Deputy, Member)');

-- Option 2: Or create a separate organizer_details table (recommended if org_ids is read-only)
-- Uncomment below if you prefer a separate table:

/*
CREATE TABLE IF NOT EXISTS `chapter-448015.lumoviz.lumoviz_organizer_details` (
  vanid STRING NOT NULL OPTIONS (description = 'VAN ID of the organizer'),
  turf STRING OPTIONS (description = 'Geographic area or organizing territory'),
  team_role STRING OPTIONS (description = 'Role within the team'),
  notes STRING OPTIONS (description = 'Additional notes about the organizer'),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP() OPTIONS (description = 'Last update timestamp'),
  updated_by STRING OPTIONS (description = 'User who last updated this record')
) OPTIONS (
  description = 'Additional details for organizers that can be edited'
);

-- Create unique index on vanid
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizer_details_vanid
ON `chapter-448015.lumoviz.lumoviz_organizer_details` (vanid);
*/
