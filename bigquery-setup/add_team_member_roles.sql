-- Add team member roles table
-- This table stores individual team members with their constituent and functional roles

CREATE TABLE IF NOT EXISTS `people-power-change.lumoviz.lumoviz_team_members` (
  team_id STRING NOT NULL,
  member_vanid STRING NOT NULL,
  member_name STRING NOT NULL,
  constituent_role STRING,  -- Leader, Potential Leader, Member, Supporter
  functional_role STRING,   -- Team Lead, Co-Lead, Facilitator, Communications, Logistics, Recruitment, Other
  date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  date_removed TIMESTAMP,
  is_active BOOL DEFAULT TRUE
);

-- Note: BigQuery doesn't support traditional indexes, but we could add clustering if needed
-- CLUSTER BY team_id, member_vanid if performance becomes an issue
