-- ================================================================
-- EXTEND EXISTING ORGANIZER MAPPING TABLE
-- ================================================================
-- This script extends the existing organizer_mapping table to support:
-- - Constituents (not just organizers)
-- - Pending people (not yet in VAN, e.g., from pledge forms)
--
-- NO NEW TABLE NEEDED - just adds columns to existing table
--
-- ================================================================
-- IMPORTANT: BigQuery Rate Limits!
-- ================================================================
-- BigQuery limits table update operations. You must run this in stages:
--
-- 1. Run STAGE 1 (all ADD COLUMN statements)
-- 2. WAIT 1-2 MINUTES
-- 3. Uncomment and run STAGE 2 (SET DEFAULT statements) - OPTIONAL
-- 4. WAIT 1-2 MINUTES  
-- 5. Uncomment and run STAGE 3 (UPDATE to backfill values)
-- 6. WAIT 1-2 MINUTES
-- 7. Run STAGE 4 (CREATE VIEWS)
--
-- Stage 2 is optional - defaults only affect new records inserted later
-- Stage 3 is the important one - it backfills existing organizer records
-- ================================================================

-- ================================================================
-- STAGE 1: Add new columns (run these together)
-- ================================================================
ALTER TABLE `chapter-448015.lumoviz.lumoviz_organizer_mapping`
ADD COLUMN IF NOT EXISTS person_type STRING 
OPTIONS (description = 'organizer, constituent, leader, or pending');

ALTER TABLE `chapter-448015.lumoviz.lumoviz_organizer_mapping`
ADD COLUMN IF NOT EXISTS in_van BOOL
OPTIONS (description = 'Whether this person exists in VAN contacts');

ALTER TABLE `chapter-448015.lumoviz.lumoviz_organizer_mapping`
ADD COLUMN IF NOT EXISTS van_sync_status STRING
OPTIONS (description = 'synced, pending_sync, needs_manual_review, or not_in_van');

ALTER TABLE `chapter-448015.lumoviz.lumoviz_organizer_mapping`
ADD COLUMN IF NOT EXISTS source STRING
OPTIONS (description = 'Where this person came from: van, pledge_form, manual_entry, import');

ALTER TABLE `chapter-448015.lumoviz.lumoviz_organizer_mapping`
ADD COLUMN IF NOT EXISTS source_id STRING
OPTIONS (description = 'ID from source system (e.g., pledge submission ID)');

ALTER TABLE `chapter-448015.lumoviz.lumoviz_organizer_mapping`
ADD COLUMN IF NOT EXISTS phone STRING
OPTIONS (description = 'Phone number for pending people');

ALTER TABLE `chapter-448015.lumoviz.lumoviz_organizer_mapping`
ADD COLUMN IF NOT EXISTS chapter STRING
OPTIONS (description = 'Chapter affiliation');

ALTER TABLE `chapter-448015.lumoviz.lumoviz_organizer_mapping`
ADD COLUMN IF NOT EXISTS merged_from_ids ARRAY<STRING>
OPTIONS (description = 'VAN IDs that were merged into this identity');

ALTER TABLE `chapter-448015.lumoviz.lumoviz_organizer_mapping`
ADD COLUMN IF NOT EXISTS merge_date TIMESTAMP
OPTIONS (description = 'When identities were merged');

-- ================================================================
-- WAIT 1 MINUTE, then run STAGE 2
-- ================================================================

-- ================================================================
-- STAGE 2: Set default values for columns (run these together)
-- ================================================================
/*
ALTER TABLE `chapter-448015.lumoviz.lumoviz_organizer_mapping`
ALTER COLUMN IF EXISTS person_type SET DEFAULT 'organizer';

ALTER TABLE `chapter-448015.lumoviz.lumoviz_organizer_mapping`
ALTER COLUMN IF EXISTS in_van SET DEFAULT TRUE;

ALTER TABLE `chapter-448015.lumoviz.lumoviz_organizer_mapping`
ALTER COLUMN IF EXISTS van_sync_status SET DEFAULT 'synced';

ALTER TABLE `chapter-448015.lumoviz.lumoviz_organizer_mapping`
ALTER COLUMN IF EXISTS source SET DEFAULT 'van';
*/

-- ================================================================
-- WAIT 1 MINUTE, then run STAGE 3
-- ================================================================

-- ================================================================
-- STAGE 3: Backfill existing records (run this single UPDATE)
-- ================================================================
/*
UPDATE `chapter-448015.lumoviz.lumoviz_organizer_mapping`
SET 
  person_type = 'organizer',
  in_van = TRUE,
  van_sync_status = 'synced',
  source = 'van'
WHERE person_type IS NULL;
*/

-- ================================================================
-- WAIT 1 MINUTE, then run STAGE 4
-- ================================================================

-- ================================================================
-- STAGE 4: CREATE HELPER VIEWS (run these together)
-- ================================================================

-- View: Get all organizers (backward compatible)
CREATE OR REPLACE VIEW `chapter-448015.lumoviz.organizers_view` AS
SELECT 
  primary_vanid,
  preferred_name,
  alternate_vanids,
  name_variations,
  email,
  phone,
  turf,
  team_role,
  chapter,
  in_van,
  van_sync_status,
  notes,
  created_at,
  updated_at
FROM `chapter-448015.lumoviz.lumoviz_organizer_mapping`
WHERE person_type = 'organizer';

-- View: Get all constituents
CREATE OR REPLACE VIEW `chapter-448015.lumoviz.constituents_view` AS
SELECT 
  primary_vanid,
  preferred_name,
  alternate_vanids,
  name_variations,
  email,
  phone,
  chapter,
  in_van,
  van_sync_status,
  source,
  source_id,
  notes,
  created_at,
  updated_at
FROM `chapter-448015.lumoviz.lumoviz_organizer_mapping`
WHERE person_type IN ('constituent', 'leader');

-- View: Get people needing VAN sync
CREATE OR REPLACE VIEW `chapter-448015.lumoviz.pending_van_sync_view` AS
SELECT 
  primary_vanid,
  preferred_name,
  person_type,
  email,
  phone,
  source,
  source_id,
  van_sync_status,
  notes,
  created_at
FROM `chapter-448015.lumoviz.lumoviz_organizer_mapping`
WHERE in_van = FALSE OR van_sync_status != 'synced'
ORDER BY created_at DESC;

-- ================================================================
-- VERIFY THE CHANGES
-- ================================================================

-- Check that columns were added
SELECT 
  column_name,
  data_type,
  description
FROM `chapter-448015.lumoviz.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS`
WHERE table_name = 'lumoviz_organizer_mapping'
ORDER BY ordinal_position;

-- Check existing records (should all be person_type = 'organizer')
SELECT 
  person_type,
  in_van,
  van_sync_status,
  COUNT(*) as count
FROM `chapter-448015.lumoviz.lumoviz_organizer_mapping`
GROUP BY person_type, in_van, van_sync_status;

-- ================================================================
-- EXAMPLE USAGE
-- ================================================================

-- Example 1: Add a new constituent from a pledge form (not in VAN yet)
/*
INSERT INTO `chapter-448015.lumoviz.lumoviz_organizer_mapping`
(primary_vanid, preferred_name, person_type, email, phone, 
 in_van, van_sync_status, source, source_id, notes, created_at, updated_at)
VALUES
('pending_' || CAST(UNIX_MILLIS(CURRENT_TIMESTAMP()) AS STRING), 
 'Maria Garcia', 'constituent', 'maria@example.com', '555-1234',
 FALSE, 'pending_sync', 'pledge_form', 'pledge_submission_123',
 'Filled out pledge form. Need to add to VAN.', 
 CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());
*/

-- Example 2: Merge two constituents (same person, different VAN IDs)
/*
-- Step 1: Update primary record with alternate ID
UPDATE `chapter-448015.lumoviz.lumoviz_organizer_mapping`
SET 
  alternate_vanids = ARRAY_CONCAT(IFNULL(alternate_vanids, []), ['20002']),
  name_variations = ARRAY_CONCAT(IFNULL(name_variations, []), ['María García']),
  merged_from_ids = ARRAY_CONCAT(IFNULL(merged_from_ids, []), ['20002']),
  merge_date = CURRENT_TIMESTAMP(),
  notes = CONCAT(IFNULL(notes, ''), '\nMerged VAN ID 20002 on ', CAST(CURRENT_TIMESTAMP() AS STRING)),
  updated_at = CURRENT_TIMESTAMP()
WHERE primary_vanid = '20001';

-- Step 2: Delete the duplicate
DELETE FROM `chapter-448015.lumoviz.lumoviz_organizer_mapping`
WHERE primary_vanid = '20002';

-- Step 3: Update references in other tables
UPDATE `chapter-448015.lumoviz.lumoviz_lists` SET contact_vanid = 20001 WHERE contact_vanid = 20002;
UPDATE `chapter-448015.lumoviz.lumoviz_meetings` SET organizee_vanid = 20001 WHERE organizee_vanid = 20002;
*/

-- Example 3: Update pending person when they're added to VAN
/*
UPDATE `chapter-448015.lumoviz.lumoviz_organizer_mapping`
SET 
  primary_vanid = '50001',  -- Their new VAN ID
  in_van = TRUE,
  van_sync_status = 'synced',
  notes = CONCAT(IFNULL(notes, ''), '\nAdded to VAN with ID 50001 on ', CAST(CURRENT_TIMESTAMP() AS STRING)),
  updated_at = CURRENT_TIMESTAMP()
WHERE primary_vanid = 'pending_1234567890';
*/

-- Example 4: Find people not yet in VAN
/*
SELECT * FROM `chapter-448015.lumoviz.pending_van_sync_view`;
*/

-- Example 5: Find potential duplicate constituents (same name)
/*
SELECT 
  preferred_name,
  person_type,
  ARRAY_AGG(primary_vanid) as vanids,
  COUNT(*) as count
FROM `chapter-448015.lumoviz.lumoviz_organizer_mapping`
WHERE person_type IN ('constituent', 'leader')
GROUP BY preferred_name, person_type
HAVING COUNT(*) > 1
ORDER BY count DESC;
*/

-- Example 6: Add a new constituent who IS in VAN
/*
INSERT INTO `chapter-448015.lumoviz.lumoviz_organizer_mapping`
(primary_vanid, preferred_name, person_type, in_van, van_sync_status, 
 source, notes, created_at, updated_at)
VALUES
('20001', 'John Smith', 'constituent', TRUE, 'synced', 'van',
 'Mapped constituent for easier identity management',
 CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());
*/
