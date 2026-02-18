-- ================================================================
-- LUMOVIZ TEAMS TABLES
-- ================================================================
-- Creates the teams table and changelog for tracking team management

-- 1. Create teams table
CREATE TABLE IF NOT EXISTS `people-power-change.lumoviz.lumoviz_teams` (
  id STRING NOT NULL,
  team_name STRING NOT NULL,
  team_leader STRING,
  chapter STRING,
  team_members STRING,
  turf STRING,
  date_created DATE,
  date_disbanded STRING,
  color STRING,
  -- Additional team culture fields
  shared_purpose STRING OPTIONS (description = 'The shared purpose that binds the team together'),
  norms STRING OPTIONS (description = 'Team norms (stored as newline-separated list)'),
  norm_correction STRING OPTIONS (description = 'How the team handles norm violations or corrections'),
  constituency STRING OPTIONS (description = 'The constituency or community this team organizes')
);

-- 2. Create team changelog table for audit trail
CREATE TABLE IF NOT EXISTS `people-power-change.lumoviz.lumoviz_team_changelog` (
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
