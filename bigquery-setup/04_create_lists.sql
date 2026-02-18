-- ================================================================
-- LUMOVIZ LISTS TABLE
-- ================================================================
-- Creates the lists table for organizer contact tracking

CREATE TABLE IF NOT EXISTS `people-power-change.lumoviz.lumoviz_lists` (
  list_id STRING NOT NULL OPTIONS (description = 'Unique identifier'),
  organizer_vanid STRING NOT NULL OPTIONS (description = 'VAN ID of the organizer who owns this entry'),
  contact_vanid INT64 NOT NULL OPTIONS (description = 'VAN ID of the person on the list'),
  contact_name STRING OPTIONS (description = 'Name of the person'),
  
  -- Action linking
  action STRING OPTIONS (description = 'Action name for display'),
  action_id STRING OPTIONS (description = 'Action ID (e.g., sign_pledge)'),
  campaign_id STRING OPTIONS (description = 'Optional campaign link'),
  
  -- Progress tracking
  progress JSON OPTIONS (description = 'Checkbox states as JSON object, e.g., {"asked": true, "signed": false}'),
  
  -- Notes and context
  notes STRING OPTIONS (description = 'Organizer notes'),
  desired_change STRING OPTIONS (description = 'What the person cares about'),
  
  -- Timestamps
  date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP() OPTIONS (description = 'When added to list'),
  date_pledged TIMESTAMP OPTIONS (description = 'When action was completed'),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP() OPTIONS (description = 'Last modification timestamp'),
  
  -- Status flags
  is_completed BOOL DEFAULT FALSE OPTIONS (description = 'Whether all steps are done'),
  is_active BOOL DEFAULT TRUE OPTIONS (description = 'Whether still on the list (soft delete)')
) OPTIONS (
  description = 'Organizer lists for tracking contacts and their action progress'
);
