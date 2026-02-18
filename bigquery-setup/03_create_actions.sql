-- ================================================================
-- LUMOVIZ ACTIONS TABLE
-- ================================================================
-- Creates the actions table with all fields for campaign action tracking

CREATE TABLE IF NOT EXISTS `people-power-change.lumoviz.lumoviz_actions` (
  action_id STRING NOT NULL,
  action_name STRING NOT NULL,
  description STRING,
  
  -- Goal tracking
  goal_type STRING OPTIONS (description = 'Type of goal this action contributes to (e.g., pledges, team_members)'),
  has_goal BOOL DEFAULT TRUE OPTIONS (description = 'Whether action has a goal/target (true) or is just a tracking list (false)'),
  default_individual_goal INT64 OPTIONS (description = 'Default goal for individuals (e.g., 5)'),
  
  -- Campaign linking
  parent_campaign_id STRING OPTIONS (description = 'Campaign this action belongs to'),
  
  -- Ownership and visibility
  organizer_vanid STRING OPTIONS (description = 'VAN ID of the organizer who created this action'),
  visible_to_organizers ARRAY<STRING> OPTIONS (description = 'Array of VAN IDs who can see and use this action. Empty/NULL = federation-wide'),
  chapters ARRAY<STRING> OPTIONS (description = 'Array of chapter names that can see/use this action. Empty/NULL means all chapters'),
  
  -- Template system
  is_template BOOL DEFAULT FALSE OPTIONS (description = 'Whether this is a campaign template (true) or personal action (false)'),
  template_action_id STRING OPTIONS (description = 'If created from a template, the ID of the template action'),
  
  -- Action metadata
  target_audience STRING OPTIONS (description = 'Who this action targets: constituent or leadership'),
  status STRING DEFAULT 'live' OPTIONS (description = 'Status of the action: live, archived, etc.'),
  started_date DATE OPTIONS (description = 'Date when the action was started/created'),
  archived_date DATE OPTIONS (description = 'Date when the action was archived'),
  
  -- Progress tracking structure (stored as JSON string)
  progress_steps ARRAY<STRUCT<
    step_id STRING,
    step_name STRING,
    step_order INT64
  >> OPTIONS (description = 'Ordered list of progress steps for this action'),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- Note: 
-- - Campaign-level actions have is_template = TRUE, organizer_vanid = NULL
-- - Personal actions have is_template = FALSE, organizer_vanid = [their ID]
-- - Personal actions created from templates have template_action_id = [template ID]
