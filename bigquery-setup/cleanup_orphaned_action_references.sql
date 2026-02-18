-- ================================================================
-- CLEANUP ORPHANED ACTION REFERENCES
-- ================================================================
-- This script cleans up references to deleted actions across all tables
-- Run this after deleting actions to remove orphaned references
--
-- Tables affected:
-- 1. lumoviz_lists (action_id column)
-- 2. lumoviz_meetings (action_id column)
-- 3. lumoviz_actions (template_action_id column)
--
-- IMPORTANT: Review the diagnostic queries first before running cleanup!
-- ================================================================

-- ================================================================
-- STEP 1: DIAGNOSTIC QUERIES (Run these first to see what will be affected)
-- ================================================================

-- Check orphaned action references in LISTS table
SELECT 
  'LISTS' as table_name,
  COUNT(*) as orphaned_count,
  COUNT(DISTINCT l.action_id) as unique_orphaned_actions
FROM `organizing-data-487317.lumoviz.lumoviz_lists` l
WHERE l.action_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM `organizing-data-487317.lumoviz.lumoviz_actions` a
    WHERE a.action_id = l.action_id
  );

-- Show specific orphaned action IDs in lists
SELECT DISTINCT
  l.action_id,
  l.action as action_name,
  COUNT(*) as affected_rows
FROM `organizing-data-487317.lumoviz.lumoviz_lists` l
WHERE l.action_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM `organizing-data-487317.lumoviz.lumoviz_actions` a
    WHERE a.action_id = l.action_id
  )
GROUP BY l.action_id, l.action
ORDER BY affected_rows DESC;

-- Check orphaned action references in MEETINGS table
SELECT 
  'MEETINGS' as table_name,
  COUNT(*) as orphaned_count,
  COUNT(DISTINCT m.action_id) as unique_orphaned_actions
FROM `organizing-data-487317.lumoviz.lumoviz_meetings` m
WHERE m.action_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM `organizing-data-487317.lumoviz.lumoviz_actions` a
    WHERE a.action_id = m.action_id
  );

-- Show specific orphaned action IDs in meetings
SELECT DISTINCT
  m.action_id,
  COUNT(*) as affected_rows
FROM `organizing-data-487317.lumoviz.lumoviz_meetings` m
WHERE m.action_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM `organizing-data-487317.lumoviz.lumoviz_actions` a
    WHERE a.action_id = m.action_id
  )
GROUP BY m.action_id
ORDER BY affected_rows DESC;

-- Check orphaned template action references in ACTIONS table
SELECT 
  'ACTIONS (templates)' as table_name,
  COUNT(*) as orphaned_count,
  COUNT(DISTINCT a.template_action_id) as unique_orphaned_templates
FROM `organizing-data-487317.lumoviz.lumoviz_actions` a
WHERE a.template_action_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM `organizing-data-487317.lumoviz.lumoviz_actions` template
    WHERE template.action_id = a.template_action_id
  );

-- Show specific orphaned template references
SELECT DISTINCT
  a.template_action_id,
  COUNT(*) as affected_actions
FROM `organizing-data-487317.lumoviz.lumoviz_actions` a
WHERE a.template_action_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM `organizing-data-487317.lumoviz.lumoviz_actions` template
    WHERE template.action_id = a.template_action_id
  )
GROUP BY a.template_action_id
ORDER BY affected_actions DESC;

-- ================================================================
-- STEP 2: CLEANUP OPTIONS
-- ================================================================
-- Choose ONE of the following approaches based on your needs

-- ----------------------------------------------------------------
-- OPTION A: NULL out orphaned action references (RECOMMENDED)
-- ----------------------------------------------------------------
-- This keeps the list/meeting records but removes the invalid action link
-- Good if the list entries and meetings are still valuable even without the action link

-- Clean up LISTS table
UPDATE `organizing-data-487317.lumoviz.lumoviz_lists` l
SET 
  action_id = NULL,
  action = NULL,
  last_updated = CURRENT_TIMESTAMP()
WHERE l.action_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM `organizing-data-487317.lumoviz.lumoviz_actions` a
    WHERE a.action_id = l.action_id
  );

-- Clean up MEETINGS table
UPDATE `organizing-data-487317.lumoviz.lumoviz_meetings` m
SET action_id = NULL
WHERE m.action_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM `organizing-data-487317.lumoviz.lumoviz_actions` a
    WHERE a.action_id = m.action_id
  );

-- Clean up ACTIONS table (template references)
UPDATE `organizing-data-487317.lumoviz.lumoviz_actions` a
SET template_action_id = NULL
WHERE a.template_action_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM `organizing-data-487317.lumoviz.lumoviz_actions` template
    WHERE template.action_id = a.template_action_id
  );

-- ----------------------------------------------------------------
-- OPTION B: DELETE rows with orphaned action references (USE WITH CAUTION)
-- ----------------------------------------------------------------
-- This permanently removes list entries and meetings that reference deleted actions
-- Only use if these records are not valuable without the action link

/*
-- Delete orphaned list entries
DELETE FROM `organizing-data-487317.lumoviz.lumoviz_lists` l
WHERE l.action_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM `organizing-data-487317.lumoviz.lumoviz_actions` a
    WHERE a.action_id = l.action_id
  );

-- Delete orphaned meeting records
DELETE FROM `organizing-data-487317.lumoviz.lumoviz_meetings` m
WHERE m.action_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM `organizing-data-487317.lumoviz.lumoviz_actions` a
    WHERE a.action_id = m.action_id
  );

-- Note: We don't delete actions with orphaned template references,
-- we just NULL out the template_action_id field
UPDATE `organizing-data-487317.lumoviz.lumoviz_actions` a
SET template_action_id = NULL
WHERE a.template_action_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM `organizing-data-487317.lumoviz.lumoviz_actions` template
    WHERE template.action_id = a.template_action_id
  );
*/

-- ================================================================
-- STEP 3: VERIFICATION (Run after cleanup)
-- ================================================================

-- Verify no orphaned references remain
SELECT 
  'After cleanup check' as status,
  (SELECT COUNT(*) FROM `organizing-data-487317.lumoviz.lumoviz_lists` l
   WHERE l.action_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM `organizing-data-487317.lumoviz.lumoviz_actions` a
     WHERE a.action_id = l.action_id
   )) as orphaned_lists,
  (SELECT COUNT(*) FROM `organizing-data-487317.lumoviz.lumoviz_meetings` m
   WHERE m.action_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM `organizing-data-487317.lumoviz.lumoviz_actions` a
     WHERE a.action_id = m.action_id
   )) as orphaned_meetings,
  (SELECT COUNT(*) FROM `organizing-data-487317.lumoviz.lumoviz_actions` a
   WHERE a.template_action_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM `organizing-data-487317.lumoviz.lumoviz_actions` t
     WHERE t.action_id = a.template_action_id
   )) as orphaned_template_refs;

-- ================================================================
-- OPTIONAL: Create a view for future monitoring
-- ================================================================

CREATE OR REPLACE VIEW `organizing-data-487317.lumoviz.orphaned_action_references` AS
SELECT 
  'LISTS' as source_table,
  l.list_id as record_id,
  l.action_id as orphaned_action_id,
  l.organizer_vanid,
  l.contact_vanid,
  l.date_added
FROM `organizing-data-487317.lumoviz.lumoviz_lists` l
WHERE l.action_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `organizing-data-487317.lumoviz.lumoviz_actions` a
    WHERE a.action_id = l.action_id
  )

UNION ALL

SELECT 
  'MEETINGS' as source_table,
  m.meeting_id as record_id,
  m.action_id as orphaned_action_id,
  m.organizer_vanid,
  m.organizee_vanid as contact_vanid,
  m.created_at as date_added
FROM `organizing-data-487317.lumoviz.lumoviz_meetings` m
WHERE m.action_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `organizing-data-487317.lumoviz.lumoviz_actions` a
    WHERE a.action_id = m.action_id
  )

UNION ALL

SELECT 
  'ACTIONS' as source_table,
  act.action_id as record_id,
  act.template_action_id as orphaned_action_id,
  act.organizer_vanid,
  NULL as contact_vanid,
  act.created_at as date_added
FROM `organizing-data-487317.lumoviz.lumoviz_actions` act
WHERE act.template_action_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `organizing-data-487317.lumoviz.lumoviz_actions` t
    WHERE t.action_id = act.template_action_id
  );

-- Query the monitoring view
-- SELECT * FROM `organizing-data-487317.lumoviz.orphaned_action_references`;
