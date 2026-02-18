-- ================================================================
-- LUMOVIZ ORGANIZER MAPPING TABLE
-- ================================================================
-- Maps multiple organizer identities to a single canonical organizer
-- Handles cases where the same organizer appears with different VAN IDs or names

CREATE TABLE IF NOT EXISTS `people-power-change.lumoviz.lumoviz_organizer_mapping` (
  mapping_id STRING NOT NULL OPTIONS (description = 'Unique identifier for this mapping'),
  organizer_vanid STRING NOT NULL OPTIONS (description = 'A VAN ID that represents this organizer (could be alias or canonical)'),
  canonical_organizer_vanid STRING NOT NULL OPTIONS (description = 'The primary/canonical VAN ID for this organizer'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  created_by STRING OPTIONS (description = 'Who created this mapping'),
  notes STRING OPTIONS (description = 'Explanation for why these IDs are the same person')
);

-- Example usage:
-- If organizer "Sam Smith" appears as both VAN ID 12345 and 67890:
-- Row 1: organizer_vanid=12345, canonical_organizer_vanid=12345 (the canonical one)
-- Row 2: organizer_vanid=67890, canonical_organizer_vanid=12345 (alias pointing to canonical)
--
-- Queries should join to this table to resolve all IDs to the canonical ID
