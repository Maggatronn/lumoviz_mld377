-- Create organizer_goals table for storing individual organizer goals per action
-- This table stores personal goals that organizers set for themselves on specific actions

CREATE TABLE IF NOT EXISTS `chapter-448015.lumoviz.organizer_goals` (
  organizer_vanid STRING NOT NULL,
  action_id STRING NOT NULL,
  goal_value INT64 NOT NULL,
  campaign_id STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- Create a unique constraint on organizer_vanid + action_id
-- Note: BigQuery doesn't support traditional UNIQUE constraints, but we handle this with MERGE in the API

-- Add some sample comments for documentation
COMMENT ON TABLE `chapter-448015.lumoviz.organizer_goals` IS 'Stores personal goals that organizers set for themselves on specific actions';

-- Example data structure:
-- organizer_vanid: '101669044' (Courtney's VAN ID)
-- action_id: 'sign_pledge'
-- goal_value: 10 (wants to get 10 pledges)
-- campaign_id: 'parent_spring_2026' (optional - links to a specific campaign)
-- created_at: timestamp when goal was first set
-- updated_at: timestamp when goal was last updated
