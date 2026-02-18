-- Seed script to add Maggie Hughes as a test organizer
-- Run this to populate the database with initial test data

-- Add Maggie Hughes to organizer mapping
INSERT INTO lumoviz_organizer_mapping (
  mapping_id,
  organizer_vanid,
  canonical_organizer_vanid,
  primary_vanid,
  preferred_name,
  person_type,
  in_van,
  van_sync_status,
  source,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid()::text,
  '100001',  -- Maggie's VAN ID
  '100001',
  '100001',
  'Maggie Hughes',
  'organizer',
  true,
  'synced',
  'manual_entry',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT (primary_vanid) DO NOTHING;

-- Add Maggie to org_ids table (for dropdown population)
INSERT INTO org_ids (
  vanid,
  userid,
  firstname,
  lastname,
  email,
  chapter,
  type,
  created_at
) VALUES (
  '100001',
  'maggie_hughes',
  'Maggie',
  'Hughes',
  'maggie@mld377.org',
  'Main Chapter',
  'organizer',
  CURRENT_TIMESTAMP
) ON CONFLICT (vanid) DO NOTHING;

-- Verify the data was inserted
SELECT 'Organizer Mapping:' as table_name;
SELECT primary_vanid, preferred_name, person_type FROM lumoviz_organizer_mapping WHERE primary_vanid = '100001';

SELECT 'Org IDs:' as table_name;
SELECT vanid, firstname, lastname, chapter FROM org_ids WHERE vanid = '100001';
