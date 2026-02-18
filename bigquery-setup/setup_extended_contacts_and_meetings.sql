-- Setup script for extended contact information and conversation tracking
-- Note: "contacts" is the VIEW, "lumoviz_contacts" is our table for extended info

-- ================================================================
-- PART 1: Create lumoviz_contacts table for additional info
-- ================================================================
CREATE TABLE IF NOT EXISTS `people-power-change.lumoviz.lumoviz_contacts` (
  vanid STRING NOT NULL,
  phone STRING,
  email STRING,
  primary_organizer_vanid STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- Note: BigQuery doesn't support traditional indexes, but partitioning/clustering can be added if needed

-- ================================================================
-- PART 2: Add detailed conversation tracking fields to meetings
-- ================================================================

-- Basic fields
ALTER TABLE `people-power-change.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS notes STRING;

ALTER TABLE `people-power-change.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;

-- Person type
ALTER TABLE `people-power-change.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS person_type STRING;

-- Conversation details
ALTER TABLE `people-power-change.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS purpose STRING;

ALTER TABLE `people-power-change.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS values STRING;

ALTER TABLE `people-power-change.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS difference STRING;

ALTER TABLE `people-power-change.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS resources STRING;

-- Commitment tracking (Yes/No + What)
ALTER TABLE `people-power-change.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS commitment_asked_yn STRING;

ALTER TABLE `people-power-change.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS commitment_made_yn STRING;

ALTER TABLE `people-power-change.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS commitment_what STRING;

-- Catapults (new people introduced)
ALTER TABLE `people-power-change.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS catapults ARRAY<STRING>;

-- Shared purpose reflections (stance + how)
ALTER TABLE `people-power-change.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS shared_purpose_constituency_stance STRING;

ALTER TABLE `people-power-change.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS shared_purpose_constituency_how STRING;

ALTER TABLE `people-power-change.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS shared_purpose_change_stance STRING;

ALTER TABLE `people-power-change.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS shared_purpose_change_how STRING;

-- Leadership tag
ALTER TABLE `people-power-change.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS leadership_tag STRING;

-- Personal sharing
ALTER TABLE `people-power-change.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS did_share_story BOOL;

ALTER TABLE `people-power-change.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS what_shared STRING;

-- Link to action (for conversations logged as part of an action)
ALTER TABLE `people-power-change.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS action_id STRING;

-- Set default values for existing rows
UPDATE `people-power-change.lumoviz.lumoviz_meetings`
SET created_at = CURRENT_TIMESTAMP()
WHERE created_at IS NULL;

UPDATE `people-power-change.lumoviz.lumoviz_meetings`
SET person_type = 'Constituent'
WHERE person_type IS NULL;

UPDATE `people-power-change.lumoviz.lumoviz_meetings`
SET leadership_tag = 'Unknown'
WHERE leadership_tag IS NULL;

UPDATE `people-power-change.lumoviz.lumoviz_meetings`
SET did_share_story = FALSE
WHERE did_share_story IS NULL;
