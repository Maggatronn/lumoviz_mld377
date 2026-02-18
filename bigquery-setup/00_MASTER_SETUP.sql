-- ================================================================
-- LUMOVIZ MASTER SETUP SCRIPT
-- ================================================================
-- Complete database setup for a fresh BigQuery instance
-- Run this script to create all tables needed for the Lumoviz application
--
-- PROJECT CONFIGURATION:
-- Project ID: organizing-data-487317
-- Dataset: lumoviz
--
-- STEP 1: Create the dataset (run this first in BigQuery console)
-- CREATE SCHEMA IF NOT EXISTS `organizing-data-487317.lumoviz`
-- OPTIONS (description = 'Lumoviz organizing data', location = 'US');
--
-- STEP 2: Run this script to create all tables
-- 
-- To use a different project/dataset:
-- 1. Find and replace 'organizing-data-487317' with your GCP project ID
-- 2. Find and replace 'lumoviz' with your dataset name
-- ================================================================

-- ================================================================
-- PART 1: TEAMS TABLES
-- ================================================================

-- 1.1 Teams table
CREATE TABLE IF NOT EXISTS `organizing-data-487317.lumoviz.lumoviz_teams` (
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

-- 1.2 Team changelog table for audit trail
CREATE TABLE IF NOT EXISTS `organizing-data-487317.lumoviz.lumoviz_team_changelog` (
  change_id STRING NOT NULL OPTIONS (description = 'Unique ID for this change record'),
  team_id STRING NOT NULL OPTIONS (description = 'ID of the team that was modified'),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP() OPTIONS (description = 'When the change was made'),
  changed_by_vanid STRING OPTIONS (description = 'VAN ID of the user who made the change'),
  changed_by_name STRING OPTIONS (description = 'Name of the user who made the change'),
  field_name STRING NOT NULL OPTIONS (description = 'Which field was changed'),
  old_value STRING OPTIONS (description = 'Previous value of the field'),
  new_value STRING OPTIONS (description = 'New value of the field'),
  change_reason STRING OPTIONS (description = 'Why this change was made'),
  change_type STRING OPTIONS (description = 'Type of change: create, update, delete, disband')
) OPTIONS (
  description = 'Audit log for all changes to teams'
);

-- 1.3 Team members table with roles
CREATE TABLE IF NOT EXISTS `organizing-data-487317.lumoviz.lumoviz_team_members` (
  team_id STRING NOT NULL,
  member_vanid STRING NOT NULL,
  member_name STRING NOT NULL,
  constituent_role STRING OPTIONS (description = 'Leader, Potential Leader, Member, Supporter'),
  functional_role STRING OPTIONS (description = 'Team Lead, Co-Lead, Facilitator, Communications, etc.'),
  date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  date_removed TIMESTAMP,
  is_active BOOL DEFAULT TRUE
);

-- ================================================================
-- PART 2: CAMPAIGNS TABLES
-- ================================================================

-- 2.1 Campaigns table
CREATE TABLE IF NOT EXISTS `organizing-data-487317.lumoviz.lumoviz_campaigns` (
  campaign_id STRING NOT NULL,
  campaign_name STRING NOT NULL,
  description STRING,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  parent_campaign_id STRING,
  chapters ARRAY<STRING>,
  status STRING DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  created_by STRING
);

-- 2.2 Campaign goals table
CREATE TABLE IF NOT EXISTS `organizing-data-487317.lumoviz.lumoviz_campaign_goals` (
  goal_id STRING NOT NULL,
  campaign_id STRING NOT NULL,
  goal_type STRING NOT NULL,
  goal_name STRING,
  target_value INT64 NOT NULL,
  chapter STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- 2.3 Campaign milestones table
CREATE TABLE IF NOT EXISTS `organizing-data-487317.lumoviz.lumoviz_campaign_milestones` (
  milestone_id STRING NOT NULL,
  campaign_id STRING NOT NULL,
  milestone_date DATE NOT NULL,
  milestone_label STRING NOT NULL,
  goal_type STRING,
  target_value INT64,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- ================================================================
-- PART 3: ACTIONS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS `organizing-data-487317.lumoviz.lumoviz_actions` (
  action_id STRING NOT NULL,
  action_name STRING NOT NULL,
  description STRING,
  
  -- Goal tracking
  goal_type STRING OPTIONS (description = 'Type of goal this action contributes to'),
  has_goal BOOL DEFAULT TRUE OPTIONS (description = 'Whether action has a goal/target'),
  default_individual_goal INT64 OPTIONS (description = 'Default goal for individuals'),
  
  -- Campaign linking
  parent_campaign_id STRING OPTIONS (description = 'Campaign this action belongs to'),
  
  -- Ownership and visibility
  organizer_vanid STRING OPTIONS (description = 'VAN ID of the organizer who created this action'),
  visible_to_organizers ARRAY<STRING> OPTIONS (description = 'VAN IDs who can see this action'),
  chapters ARRAY<STRING> OPTIONS (description = 'Chapters that can see/use this action'),
  
  -- Template system
  is_template BOOL DEFAULT FALSE OPTIONS (description = 'Whether this is a campaign template'),
  template_action_id STRING OPTIONS (description = 'ID of the template action if created from template'),
  
  -- Action metadata
  target_audience STRING OPTIONS (description = 'constituent or leadership'),
  status STRING DEFAULT 'live' OPTIONS (description = 'live, archived, etc.'),
  started_date DATE OPTIONS (description = 'Date when action was started/created'),
  archived_date DATE OPTIONS (description = 'Date when action was archived'),
  
  -- Progress tracking structure
  progress_steps ARRAY<STRUCT<
    step_id STRING,
    step_name STRING,
    step_order INT64
  >> OPTIONS (description = 'Ordered list of progress steps'),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- ================================================================
-- PART 4: LISTS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS `organizing-data-487317.lumoviz.lumoviz_lists` (
  list_id STRING NOT NULL OPTIONS (description = 'Unique identifier'),
  organizer_vanid STRING NOT NULL OPTIONS (description = 'VAN ID of the organizer who owns this entry'),
  contact_vanid INT64 NOT NULL OPTIONS (description = 'VAN ID of the person on the list'),
  contact_name STRING OPTIONS (description = 'Name of the person'),
  
  -- Action linking
  action STRING OPTIONS (description = 'Action name for display'),
  action_id STRING OPTIONS (description = 'Action ID'),
  campaign_id STRING OPTIONS (description = 'Optional campaign link'),
  
  -- Progress tracking
  progress JSON OPTIONS (description = 'Checkbox states as JSON object'),
  
  -- Notes and context
  notes STRING OPTIONS (description = 'Organizer notes'),
  desired_change STRING OPTIONS (description = 'What the person cares about'),
  
  -- Timestamps
  date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP() OPTIONS (description = 'When added to list'),
  date_pledged TIMESTAMP OPTIONS (description = 'When action was completed'),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP() OPTIONS (description = 'Last modification'),
  
  -- Status flags
  is_completed BOOL DEFAULT FALSE OPTIONS (description = 'Whether all steps are done'),
  is_active BOOL DEFAULT TRUE OPTIONS (description = 'Whether still on the list')
) OPTIONS (
  description = 'Organizer lists for tracking contacts and action progress'
);

-- ================================================================
-- PART 5: CONTACTS TABLE (Extended Info)
-- ================================================================

CREATE TABLE IF NOT EXISTS `organizing-data-487317.lumoviz.lumoviz_contacts` (
  vanid STRING NOT NULL,
  phone STRING,
  email STRING,
  primary_organizer_vanid STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
) OPTIONS (
  description = 'Extended contact information (phone, email, primary organizer). Base contact data comes from the contacts VIEW.'
);

-- ================================================================
-- PART 6: MEETINGS TABLE (Conversation Tracking)
-- ================================================================

CREATE TABLE IF NOT EXISTS `organizing-data-487317.lumoviz.lumoviz_meetings` (
  meeting_id STRING NOT NULL,
  organizee_vanid INT64 NOT NULL OPTIONS (description = 'VAN ID of the person being organized'),
  organizer_vanid STRING OPTIONS (description = 'VAN ID of the organizer'),
  meeting_date DATE,
  notes STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  
  -- Person classification
  person_type STRING OPTIONS (description = 'Gatekeeper, Constituent, Other'),
  
  -- Conversation details
  purpose STRING OPTIONS (description = 'Purpose of the conversation'),
  values STRING OPTIONS (description = 'What moves them, what they care about'),
  difference STRING OPTIONS (description = 'What would make a difference in their life'),
  resources STRING OPTIONS (description = 'What they could contribute'),
  
  -- Commitment tracking
  commitment_asked_yn STRING OPTIONS (description = 'Did you ask them to commit? (yes/no)'),
  commitment_made_yn STRING OPTIONS (description = 'Did they commit? (yes/no)'),
  commitment_what STRING OPTIONS (description = 'Details about the commitment discussion'),
  
  -- Catapults (new connections)
  catapults ARRAY<STRING> OPTIONS (description = 'VAN IDs of new people they introduced'),
  
  -- Shared purpose reflections
  shared_purpose_constituency_stance STRING OPTIONS (description = 'Challenge, Neither, Affirm'),
  shared_purpose_constituency_how STRING OPTIONS (description = 'How it challenged or affirmed'),
  shared_purpose_change_stance STRING OPTIONS (description = 'Challenge, Neither, Affirm'),
  shared_purpose_change_how STRING OPTIONS (description = 'How it challenged or affirmed'),
  
  -- Leadership assessment
  leadership_tag STRING OPTIONS (description = 'Leader, Potential Leader, Supporter, Unknown'),
  
  -- Personal sharing
  did_share_story BOOL DEFAULT FALSE,
  what_shared STRING OPTIONS (description = 'What personal story or experience was shared'),
  
  -- Action linkage
  action_id STRING OPTIONS (description = 'Link to action if logged as part of an action')
) OPTIONS (
  description = 'Detailed conversation tracking with relational organizing data'
);

-- ================================================================
-- PART 7: LEADER HIERARCHY TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS `organizing-data-487317.lumoviz.lumoviz_leader_hierarchy` (
  leader_vanid STRING NOT NULL OPTIONS (description = 'The leader\'s VAN ID'),
  parent_leader_vanid STRING OPTIONS (description = 'Who they report to'),
  organizer_vanid STRING NOT NULL OPTIONS (description = 'Who owns this hierarchy entry'),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(created_date)
CLUSTER BY organizer_vanid, leader_vanid;

-- ================================================================
-- PART 8: ORGANIZER MAPPING TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS `organizing-data-487317.lumoviz.lumoviz_organizer_mapping` (
  mapping_id STRING NOT NULL OPTIONS (description = 'Unique identifier for this mapping'),
  organizer_vanid STRING NOT NULL OPTIONS (description = 'A VAN ID that represents this organizer'),
  canonical_organizer_vanid STRING NOT NULL OPTIONS (description = 'The primary/canonical VAN ID'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  created_by STRING OPTIONS (description = 'Who created this mapping'),
  notes STRING OPTIONS (description = 'Explanation for why these IDs are the same person')
) OPTIONS (
  description = 'Maps multiple organizer identities to a single canonical organizer'
);

-- ================================================================
-- SETUP COMPLETE
-- ================================================================
-- All tables created successfully!
-- 
-- Next steps:
-- 1. Verify all tables exist: SELECT table_name FROM `organizing-data-487317.lumoviz.INFORMATION_SCHEMA.TABLES`
-- 2. Set up the 'contacts' VIEW to point to your VAN/source contact data
-- 3. Load seed data if you have any initial campaigns, actions, or teams
-- ================================================================
