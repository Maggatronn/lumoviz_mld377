-- ================================================================
-- ADD RECURRING ACTIONS AND DEADLINE FIELDS
-- ================================================================
-- This migration adds support for rate-based/recurring actions
-- and deadline tracking to the lumoviz_actions table.
--
-- Features added:
-- 1. Rate-based actions (e.g., "5 1:1s per week")
-- 2. Recurring actions (e.g., "Weekly team meeting")
-- 3. Deadline tracking (e.g., "Complete by March 15")
-- 4. Time-based progress tracking
--
-- Backward compatible: All existing actions default to 'one_time'
-- ================================================================

-- ================================================================
-- STEP 1: Add columns (without defaults)
-- ================================================================
-- BigQuery requires adding columns first, then setting defaults separately

ALTER TABLE `organizing-data-487317.lumoviz.lumoviz_actions`
ADD COLUMN IF NOT EXISTS action_type STRING,
ADD COLUMN IF NOT EXISTS recurrence_period STRING,
ADD COLUMN IF NOT EXISTS recurrence_count INT64,
ADD COLUMN IF NOT EXISTS deadline_date DATE,
ADD COLUMN IF NOT EXISTS deadline_type STRING,
ADD COLUMN IF NOT EXISTS time_tracking_enabled BOOL;

-- ================================================================
-- STEP 2: Set default values for new columns
-- ================================================================
-- Run these ALTER statements to set defaults for future inserts

ALTER TABLE `organizing-data-487317.lumoviz.lumoviz_actions`
ALTER COLUMN action_type SET DEFAULT 'one_time';

ALTER TABLE `organizing-data-487317.lumoviz.lumoviz_actions`
ALTER COLUMN deadline_type SET DEFAULT 'soft';

ALTER TABLE `organizing-data-487317.lumoviz.lumoviz_actions`
ALTER COLUMN time_tracking_enabled SET DEFAULT FALSE;

-- ================================================================
-- STEP 3: Update existing rows with default values
-- ================================================================
-- Set sensible defaults for all existing actions

UPDATE `organizing-data-487317.lumoviz.lumoviz_actions`
SET 
  action_type = 'one_time',
  deadline_type = 'soft',
  time_tracking_enabled = FALSE
WHERE action_type IS NULL;

-- ================================================================
-- FIELD DEFINITIONS
-- ================================================================
-- 
-- action_type:
--   - 'one_time': Traditional action with total goal (default)
--   - 'rate_based': Action with rate goal (e.g., X per week)
--   - 'recurring': Action that resets each period
--
-- recurrence_period:
--   - 'daily': Track per day
--   - 'weekly': Track per week
--   - 'monthly': Track per month
--   - 'quarterly': Track per quarter
--   - 'annual': Track per year
--   NULL for one_time actions
--
-- recurrence_count:
--   - Number of completions expected per period
--   - e.g., 5 for "5 1:1s per week"
--   - NULL for one_time actions
--
-- deadline_date:
--   - Optional target completion date
--   - Used for "by when" tracking
--   - Can be used with any action_type
--
-- deadline_type:
--   - 'soft': Goal/target date (shows as suggestion)
--   - 'hard': Required date (shows as warning)
--
-- time_tracking_enabled:
--   - TRUE: Track completion dates for progress over time
--   - FALSE: Only track total counts
--   - Auto-enabled for rate_based and recurring
-- ================================================================

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Check that columns were added
SELECT 
  column_name,
  data_type,
  is_nullable
FROM `organizing-data-487317.lumoviz.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'lumoviz_actions'
  AND column_name IN (
    'action_type',
    'recurrence_period',
    'recurrence_count',
    'deadline_date',
    'deadline_type',
    'time_tracking_enabled'
  )
ORDER BY column_name;

-- Show sample of existing actions (should all be 'one_time')
SELECT 
  action_id,
  action_name,
  action_type,
  recurrence_period,
  recurrence_count,
  deadline_date,
  time_tracking_enabled
FROM `organizing-data-487317.lumoviz.lumoviz_actions`
LIMIT 10;

-- ================================================================
-- EXAMPLE: Create a rate-based action
-- ================================================================
-- Uncomment and modify to test creating a rate-based action
/*
INSERT INTO `organizing-data-487317.lumoviz.lumoviz_actions`
(
  action_id,
  action_name,
  goal_type,
  fields,
  is_active,
  action_type,
  recurrence_period,
  recurrence_count,
  time_tracking_enabled,
  has_goal,
  target_audience,
  default_individual_goal
)
VALUES (
  'weekly_one_on_ones',
  'Weekly 1:1 Meetings',
  'leadership',
  JSON '[{"key": "completed", "label": "Meeting Held", "type": "conversation"}]',
  TRUE,
  'rate_based',
  'weekly',
  5,
  TRUE,
  TRUE,
  'leadership',
  5
);
*/

-- ================================================================
-- EXAMPLE: Create action with deadline
-- ================================================================
-- Uncomment and modify to test creating an action with a deadline
/*
INSERT INTO `organizing-data-487317.lumoviz.lumoviz_actions`
(
  action_id,
  action_name,
  goal_type,
  fields,
  is_active,
  action_type,
  deadline_date,
  deadline_type,
  has_goal,
  target_audience,
  default_individual_goal
)
VALUES (
  'q1_leadership_registration',
  'Q1 Leadership Registration',
  'pledge',
  JSON '[{"key": "registered", "label": "Registered", "type": "boolean"}]',
  TRUE,
  'one_time',
  '2026-03-31',
  'hard',
  TRUE,
  'leadership',
  100
);
*/

-- ================================================================
-- EXAMPLE QUERIES FOR RATE-BASED TRACKING
-- ================================================================

-- To track "this week's" completions, you'll need completion dates
-- Option 1: Add completion_date to lumoviz_lists
/*
ALTER TABLE `organizing-data-487317.lumoviz.lumoviz_lists`
ADD COLUMN IF NOT EXISTS field_completion_dates JSON;

-- Query for this week's completions
SELECT 
  l.vanid,
  l.action_id,
  l.action,
  JSON_EXTRACT_SCALAR(l.field_completion_dates, '$.completed') as completed_date
FROM `organizing-data-487317.lumoviz.lumoviz_lists` l
WHERE l.action_id = 'weekly_one_on_ones'
  AND JSON_EXTRACT_SCALAR(l.field_completion_dates, '$.completed') >= 
    DATE_SUB(CURRENT_DATE(), INTERVAL EXTRACT(DAYOFWEEK FROM CURRENT_DATE()) - 1 DAY)
ORDER BY completed_date DESC;
*/

-- Option 2: Create separate completions tracking table
/*
CREATE TABLE IF NOT EXISTS `organizing-data-487317.lumoviz.lumoviz_action_completions` (
  id STRING NOT NULL,
  action_id STRING NOT NULL,
  vanid INT64 NOT NULL,
  field_key STRING NOT NULL,
  completed_date DATE NOT NULL,
  completed_by STRING,  -- Organizer VAN ID who marked it complete
  notes STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- Query for rate-based progress
SELECT 
  action_id,
  COUNT(*) as completions_this_week,
  COUNT(DISTINCT vanid) as unique_people
FROM `organizing-data-487317.lumoviz.lumoviz_action_completions`
WHERE action_id = 'weekly_one_on_ones'
  AND completed_date >= DATE_SUB(CURRENT_DATE(), INTERVAL EXTRACT(DAYOFWEEK FROM CURRENT_DATE()) - 1 DAY)
GROUP BY action_id;
*/

-- ================================================================
-- ROLLBACK (if needed)
-- ================================================================
-- Uncomment to remove the new columns
/*
ALTER TABLE `organizing-data-487317.lumoviz.lumoviz_actions`
DROP COLUMN IF EXISTS action_type,
DROP COLUMN IF EXISTS recurrence_period,
DROP COLUMN IF EXISTS recurrence_count,
DROP COLUMN IF EXISTS deadline_date,
DROP COLUMN IF EXISTS deadline_type,
DROP COLUMN IF EXISTS time_tracking_enabled;
*/
