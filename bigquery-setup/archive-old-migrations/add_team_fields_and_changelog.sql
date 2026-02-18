-- Add new fields to lumoviz_teams table
-- These fields capture team culture, norms, and constituency

ALTER TABLE `chapter-448015.lumoviz.lumoviz_teams`
ADD COLUMN IF NOT EXISTS shared_purpose STRING OPTIONS (description = 'The shared purpose that binds the team together');

ALTER TABLE `chapter-448015.lumoviz.lumoviz_teams`
ADD COLUMN IF NOT EXISTS norms STRING OPTIONS (description = 'Team norms (stored as newline-separated list)');

ALTER TABLE `chapter-448015.lumoviz.lumoviz_teams`
ADD COLUMN IF NOT EXISTS norm_correction STRING OPTIONS (description = 'How the team handles norm violations or corrections');

ALTER TABLE `chapter-448015.lumoviz.lumoviz_teams`
ADD COLUMN IF NOT EXISTS constituency STRING OPTIONS (description = 'The constituency or community this team organizes');

-- Create a changelog table to track all edits to teams with justifications
CREATE TABLE IF NOT EXISTS `chapter-448015.lumoviz.lumoviz_team_changelog` (
  change_id STRING NOT NULL OPTIONS (description = 'Unique ID for this change record'),
  team_id STRING NOT NULL OPTIONS (description = 'ID of the team that was modified'),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP() OPTIONS (description = 'When the change was made'),
  changed_by_vanid STRING OPTIONS (description = 'VAN ID of the user who made the change'),
  changed_by_name STRING OPTIONS (description = 'Name of the user who made the change'),
  field_name STRING NOT NULL OPTIONS (description = 'Which field was changed (e.g., shared_purpose, norms, team_members)'),
  old_value STRING OPTIONS (description = 'Previous value of the field'),
  new_value STRING OPTIONS (description = 'New value of the field'),
  change_reason STRING OPTIONS (description = 'Why this change was made (justification/learning)'),
  change_type STRING OPTIONS (description = 'Type of change: create, update, delete, disband')
) OPTIONS (
  description = 'Audit log for all changes to teams, capturing what changed, who changed it, and why'
);

-- Create index on team_id for faster queries
CREATE INDEX IF NOT EXISTS idx_team_changelog_team_id
ON `chapter-448015.lumoviz.lumoviz_team_changelog` (team_id, changed_at DESC);

-- Create index on changed_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_team_changelog_changed_at
ON `chapter-448015.lumoviz.lumoviz_team_changelog` (changed_at DESC);
