-- ================================================================
-- CREATE CONTACTS VIEW FOR DEMO
-- ================================================================
-- This creates a simple contacts view for demo purposes
-- In production, this would point to your actual VAN/contact data source
-- ================================================================

CREATE OR REPLACE VIEW `organizing-data-487317.lumoviz.contacts` AS
SELECT 
  -- Core identity fields
  CAST(c.vanid AS INT64) as vanid,
  CASE 
    WHEN c.vanid = '10001' THEN 'Marshall'
    WHEN c.vanid = '10002' THEN 'Steph'
    WHEN c.vanid = '10003' THEN 'Emily'
    WHEN c.vanid = '10004' THEN 'Maggie'
    WHEN c.vanid = '10005' THEN 'Zainab'
    WHEN c.vanid = '10006' THEN 'Alyssa'
    WHEN c.vanid = '10007' THEN 'Svetlana'
    WHEN c.vanid = '10008' THEN 'Sepi'
    ELSE SPLIT(c.vanid, '0')[OFFSET(0)]
  END as firstname,
  '' as lastname,
  
  -- Contact info from lumoviz_contacts
  c.email,
  c.phone,
  
  -- Chapter/location
  'National' as chapter,
  
  -- Additional organizing fields
  'organizer' as type,
  NULL as loe,
  NULL as loe_status
  
FROM `organizing-data-487317.lumoviz.lumoviz_contacts` c

UNION ALL

-- Add the sample contacts from lists (people being organized)
SELECT
  l.contact_vanid as vanid,
  SPLIT(l.contact_name, ' ')[OFFSET(0)] as firstname,
  CASE 
    WHEN ARRAY_LENGTH(SPLIT(l.contact_name, ' ')) > 1 
    THEN SPLIT(l.contact_name, ' ')[OFFSET(1)]
    ELSE ''
  END as lastname,
  NULL as email,
  NULL as phone,
  'National' as chapter,
  'contact' as type,
  NULL as loe,
  'Unknown' as loe_status
FROM `organizing-data-487317.lumoviz.lumoviz_lists` l
WHERE l.is_active = TRUE
GROUP BY vanid, firstname, lastname, email, phone, chapter, type, loe, loe_status;

-- ================================================================
-- VIEW CREATED
-- ================================================================
-- The contacts view now includes:
-- - All 8 team members from lumoviz_contacts
-- - All contacts from lists (people being organized)
--
-- You can query it with:
-- SELECT * FROM `organizing-data-487317.lumoviz.contacts` ORDER BY firstname;
-- ================================================================
