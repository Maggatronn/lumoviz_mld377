-- Add columns for person contact information and detailed conversation tracking

-- ================================================================
-- PART 1: Add phone, email, and organizer to contacts
-- ================================================================
ALTER TABLE `chapter-448015.lumoviz.lumoviz_contacts`
ADD COLUMN IF NOT EXISTS phone STRING;

ALTER TABLE `chapter-448015.lumoviz.lumoviz_contacts`
ADD COLUMN IF NOT EXISTS email STRING;

ALTER TABLE `chapter-448015.lumoviz.lumoviz_contacts`
ADD COLUMN IF NOT EXISTS primary_organizer_vanid STRING;

ALTER TABLE `chapter-448015.lumoviz.lumoviz_contacts`
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;

-- Set default values for existing rows
UPDATE `chapter-448015.lumoviz.lumoviz_contacts`
SET created_at = CURRENT_TIMESTAMP()
WHERE created_at IS NULL;

-- ================================================================
-- PART 2: Add detailed conversation tracking fields to meetings
-- ================================================================

-- Basic fields
ALTER TABLE `chapter-448015.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS notes STRING;

ALTER TABLE `chapter-448015.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;

-- Person type
ALTER TABLE `chapter-448015.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS person_type STRING;

-- Conversation details
ALTER TABLE `chapter-448015.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS purpose STRING;

ALTER TABLE `chapter-448015.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS values STRING;

ALTER TABLE `chapter-448015.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS difference STRING;

ALTER TABLE `chapter-448015.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS resources STRING;

-- Commitment tracking (Yes/No + What)
ALTER TABLE `chapter-448015.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS commitment_asked_yn STRING;

ALTER TABLE `chapter-448015.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS commitment_made_yn STRING;

ALTER TABLE `chapter-448015.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS commitment_what STRING;

-- Catapults (new people introduced)
ALTER TABLE `chapter-448015.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS catapults ARRAY<STRING>;

-- Shared purpose reflections (stance + how)
ALTER TABLE `chapter-448015.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS shared_purpose_constituency_stance STRING;

ALTER TABLE `chapter-448015.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS shared_purpose_constituency_how STRING;

ALTER TABLE `chapter-448015.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS shared_purpose_change_stance STRING;

ALTER TABLE `chapter-448015.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS shared_purpose_change_how STRING;

-- Leadership tag
ALTER TABLE `chapter-448015.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS leadership_tag STRING;

-- Personal sharing
ALTER TABLE `chapter-448015.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS did_share_story BOOL;

ALTER TABLE `chapter-448015.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS what_shared STRING;

-- Link to action (for conversations logged as part of an action)
ALTER TABLE `chapter-448015.lumoviz.lumoviz_meetings`
ADD COLUMN IF NOT EXISTS action_id STRING;

-- Set default values for existing rows
UPDATE `chapter-448015.lumoviz.lumoviz_meetings`
SET created_at = CURRENT_TIMESTAMP()
WHERE created_at IS NULL;

UPDATE `chapter-448015.lumoviz.lumoviz_meetings`
SET person_type = 'Constituent'
WHERE person_type IS NULL;

UPDATE `chapter-448015.lumoviz.lumoviz_meetings`
SET leadership_tag = 'Unknown'
WHERE leadership_tag IS NULL;

UPDATE `chapter-448015.lumoviz.lumoviz_meetings`
SET did_share_story = FALSE
WHERE did_share_story IS NULL;
