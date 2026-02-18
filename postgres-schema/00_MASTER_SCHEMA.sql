-- ================================================================
-- LUMOVIZ POSTGRESQL MASTER SCHEMA
-- ================================================================
-- Complete database setup for Cloud SQL PostgreSQL
-- Migrated from BigQuery schema
--
-- USAGE:
-- psql "host=localhost port=5432 dbname=lumoviz user=lumoviz_app" -f 00_MASTER_SCHEMA.sql
--
-- OR run individual files in order (01-10)
-- ================================================================

-- Enable UUID extension for generating IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- PART 1: TEAMS TABLES
-- ================================================================

-- 1.1 Teams table
CREATE TABLE IF NOT EXISTS lumoviz_teams (
  id VARCHAR(255) PRIMARY KEY,
  team_name VARCHAR(500) NOT NULL,
  team_leader VARCHAR(255),
  chapter VARCHAR(255),
  team_members TEXT,
  turf TEXT,
  date_created DATE,
  date_disbanded VARCHAR(50),
  color VARCHAR(50),
  -- Team culture fields
  shared_purpose TEXT,
  norms TEXT,
  norm_correction TEXT,
  constituency TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE lumoviz_teams IS 'Organizing teams with culture and membership info';
COMMENT ON COLUMN lumoviz_teams.shared_purpose IS 'The shared purpose that binds the team together';
COMMENT ON COLUMN lumoviz_teams.norms IS 'Team norms (stored as newline-separated list)';
COMMENT ON COLUMN lumoviz_teams.norm_correction IS 'How the team handles norm violations';
COMMENT ON COLUMN lumoviz_teams.constituency IS 'The constituency or community this team organizes';

-- 1.2 Team changelog table for audit trail
CREATE TABLE IF NOT EXISTS lumoviz_team_changelog (
  change_id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  team_id VARCHAR(255) NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  changed_by_vanid VARCHAR(255),
  changed_by_name VARCHAR(500),
  field_name VARCHAR(255) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_reason TEXT,
  change_type VARCHAR(50),
  FOREIGN KEY (team_id) REFERENCES lumoviz_teams(id) ON DELETE CASCADE
);

CREATE INDEX idx_team_changelog_team_id ON lumoviz_team_changelog(team_id);
CREATE INDEX idx_team_changelog_changed_at ON lumoviz_team_changelog(changed_at DESC);

COMMENT ON TABLE lumoviz_team_changelog IS 'Audit log for all changes to teams';

-- 1.3 Team members table with roles
CREATE TABLE IF NOT EXISTS lumoviz_team_members (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(255) NOT NULL,
  member_vanid VARCHAR(255) NOT NULL,
  member_name VARCHAR(500) NOT NULL,
  constituent_role VARCHAR(100),
  functional_role VARCHAR(100),
  date_added TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  date_removed TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (team_id) REFERENCES lumoviz_teams(id) ON DELETE CASCADE
);

CREATE INDEX idx_team_members_team_id ON lumoviz_team_members(team_id);
CREATE INDEX idx_team_members_vanid ON lumoviz_team_members(member_vanid);
CREATE INDEX idx_team_members_active ON lumoviz_team_members(is_active) WHERE is_active = TRUE;

COMMENT ON COLUMN lumoviz_team_members.constituent_role IS 'Leader, Potential Leader, Member, Supporter';
COMMENT ON COLUMN lumoviz_team_members.functional_role IS 'Team Lead, Co-Lead, Facilitator, Communications, etc.';

-- ================================================================
-- PART 2: CAMPAIGNS TABLES
-- ================================================================

-- 2.1 Campaigns table
CREATE TABLE IF NOT EXISTS lumoviz_campaigns (
  campaign_id VARCHAR(255) PRIMARY KEY,
  campaign_name VARCHAR(500) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  parent_campaign_id VARCHAR(255),
  chapters TEXT[],
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  FOREIGN KEY (parent_campaign_id) REFERENCES lumoviz_campaigns(campaign_id) ON DELETE SET NULL
);

CREATE INDEX idx_campaigns_status ON lumoviz_campaigns(status);
CREATE INDEX idx_campaigns_dates ON lumoviz_campaigns(start_date, end_date);
CREATE INDEX idx_campaigns_parent ON lumoviz_campaigns(parent_campaign_id);

-- 2.2 Campaign goals table
CREATE TABLE IF NOT EXISTS lumoviz_campaign_goals (
  goal_id VARCHAR(255) PRIMARY KEY,
  campaign_id VARCHAR(255) NOT NULL,
  goal_type VARCHAR(100) NOT NULL,
  goal_name VARCHAR(500),
  target_value INTEGER NOT NULL,
  chapter VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES lumoviz_campaigns(campaign_id) ON DELETE CASCADE
);

CREATE INDEX idx_campaign_goals_campaign_id ON lumoviz_campaign_goals(campaign_id);
CREATE INDEX idx_campaign_goals_chapter ON lumoviz_campaign_goals(chapter);

-- 2.3 Campaign milestones table
CREATE TABLE IF NOT EXISTS lumoviz_campaign_milestones (
  milestone_id VARCHAR(255) PRIMARY KEY,
  campaign_id VARCHAR(255) NOT NULL,
  milestone_date DATE NOT NULL,
  milestone_label VARCHAR(500) NOT NULL,
  goal_type VARCHAR(100),
  target_value INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES lumoviz_campaigns(campaign_id) ON DELETE CASCADE
);

CREATE INDEX idx_campaign_milestones_campaign_id ON lumoviz_campaign_milestones(campaign_id);
CREATE INDEX idx_campaign_milestones_date ON lumoviz_campaign_milestones(milestone_date);

-- ================================================================
-- PART 3: ACTIONS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS lumoviz_actions (
  action_id VARCHAR(255) PRIMARY KEY,
  action_name VARCHAR(500) NOT NULL,
  description TEXT,
  
  -- Goal tracking
  goal_type VARCHAR(100),
  has_goal BOOLEAN DEFAULT TRUE,
  default_individual_goal INTEGER,
  
  -- Campaign linking
  parent_campaign_id VARCHAR(255),
  
  -- Ownership and visibility
  organizer_vanid VARCHAR(255),
  visible_to_organizers TEXT[],
  chapters TEXT[],
  
  -- Template system
  is_template BOOLEAN DEFAULT FALSE,
  template_action_id VARCHAR(255),
  
  -- Action metadata
  target_audience VARCHAR(50),
  status VARCHAR(50) DEFAULT 'live',
  started_date DATE,
  archived_date DATE,
  
  -- Progress tracking (stored as JSONB)
  progress_steps JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (parent_campaign_id) REFERENCES lumoviz_campaigns(campaign_id) ON DELETE SET NULL
);

CREATE INDEX idx_actions_campaign ON lumoviz_actions(parent_campaign_id);
CREATE INDEX idx_actions_organizer ON lumoviz_actions(organizer_vanid);
CREATE INDEX idx_actions_status ON lumoviz_actions(status);
CREATE INDEX idx_actions_template ON lumoviz_actions(is_template);

COMMENT ON COLUMN lumoviz_actions.goal_type IS 'Type of goal this action contributes to';
COMMENT ON COLUMN lumoviz_actions.has_goal IS 'Whether action has a goal/target';
COMMENT ON COLUMN lumoviz_actions.progress_steps IS 'Array of {step_id, step_name, step_order} as JSON';

-- ================================================================
-- PART 4: LISTS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS lumoviz_lists (
  list_id VARCHAR(255) PRIMARY KEY,
  organizer_vanid VARCHAR(255) NOT NULL,
  contact_vanid BIGINT NOT NULL,
  contact_name VARCHAR(500),
  
  -- Action linking
  action VARCHAR(500),
  action_id VARCHAR(255),
  campaign_id VARCHAR(255),
  
  -- Progress tracking
  progress JSONB,
  
  -- Notes and context
  notes TEXT,
  desired_change TEXT,
  
  -- Timestamps
  date_added TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  date_pledged TIMESTAMP WITH TIME ZONE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Status flags
  is_completed BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  FOREIGN KEY (action_id) REFERENCES lumoviz_actions(action_id) ON DELETE SET NULL,
  FOREIGN KEY (campaign_id) REFERENCES lumoviz_campaigns(campaign_id) ON DELETE SET NULL
);

CREATE INDEX idx_lists_organizer ON lumoviz_lists(organizer_vanid);
CREATE INDEX idx_lists_contact ON lumoviz_lists(contact_vanid);
CREATE INDEX idx_lists_action ON lumoviz_lists(action_id);
CREATE INDEX idx_lists_active ON lumoviz_lists(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE lumoviz_lists IS 'Organizer lists for tracking contacts and action progress';

-- ================================================================
-- PART 5: CONTACTS TABLE (Extended Info)
-- ================================================================

CREATE TABLE IF NOT EXISTS lumoviz_contacts (
  vanid VARCHAR(255) PRIMARY KEY,
  phone VARCHAR(50),
  email VARCHAR(500),
  primary_organizer_vanid VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contacts_organizer ON lumoviz_contacts(primary_organizer_vanid);

COMMENT ON TABLE lumoviz_contacts IS 'Extended contact info (phone, email, primary organizer). Base data comes from contacts table/view.';

-- ================================================================
-- PART 6: MEETINGS TABLE (Conversation Tracking)
-- ================================================================

CREATE TABLE IF NOT EXISTS lumoviz_meetings (
  meeting_id VARCHAR(255) PRIMARY KEY,
  organizee_vanid BIGINT NOT NULL,
  organizer_vanid VARCHAR(255),
  meeting_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Person classification
  person_type VARCHAR(50),
  
  -- Conversation details
  purpose TEXT,
  values TEXT,
  difference TEXT,
  resources TEXT,
  
  -- Commitment tracking
  commitment_asked_yn VARCHAR(10),
  commitment_made_yn VARCHAR(10),
  commitment_what TEXT,
  
  -- Catapults (new connections)
  catapults TEXT[],
  
  -- Shared purpose reflections
  shared_purpose_constituency_stance VARCHAR(50),
  shared_purpose_constituency_how TEXT,
  shared_purpose_change_stance VARCHAR(50),
  shared_purpose_change_how TEXT,
  
  -- Leadership assessment
  leadership_tag VARCHAR(50),
  
  -- Personal sharing
  did_share_story BOOLEAN DEFAULT FALSE,
  what_shared TEXT,
  
  -- Action linkage
  action_id VARCHAR(255),
  
  FOREIGN KEY (action_id) REFERENCES lumoviz_actions(action_id) ON DELETE SET NULL
);

CREATE INDEX idx_meetings_organizee ON lumoviz_meetings(organizee_vanid);
CREATE INDEX idx_meetings_organizer ON lumoviz_meetings(organizer_vanid);
CREATE INDEX idx_meetings_date ON lumoviz_meetings(meeting_date DESC);
CREATE INDEX idx_meetings_action ON lumoviz_meetings(action_id);

COMMENT ON TABLE lumoviz_meetings IS 'Detailed conversation tracking with relational organizing data';
COMMENT ON COLUMN lumoviz_meetings.person_type IS 'Gatekeeper, Constituent, Other';
COMMENT ON COLUMN lumoviz_meetings.catapults IS 'VAN IDs of new people they introduced';

-- ================================================================
-- PART 7: LEADER HIERARCHY TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS lumoviz_leader_hierarchy (
  id SERIAL PRIMARY KEY,
  leader_vanid VARCHAR(255) NOT NULL,
  parent_leader_vanid VARCHAR(255),
  organizer_vanid VARCHAR(255) NOT NULL,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_leader_hierarchy_leader ON lumoviz_leader_hierarchy(leader_vanid);
CREATE INDEX idx_leader_hierarchy_parent ON lumoviz_leader_hierarchy(parent_leader_vanid);
CREATE INDEX idx_leader_hierarchy_organizer ON lumoviz_leader_hierarchy(organizer_vanid);

COMMENT ON COLUMN lumoviz_leader_hierarchy.leader_vanid IS 'The leader''s VAN ID';
COMMENT ON COLUMN lumoviz_leader_hierarchy.parent_leader_vanid IS 'Who they report to';

-- ================================================================
-- PART 8: ORGANIZER MAPPING TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS lumoviz_organizer_mapping (
  mapping_id VARCHAR(255) PRIMARY KEY,
  organizer_vanid VARCHAR(255) NOT NULL,
  canonical_organizer_vanid VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  notes TEXT
);

CREATE INDEX idx_organizer_mapping_vanid ON lumoviz_organizer_mapping(organizer_vanid);
CREATE INDEX idx_organizer_mapping_canonical ON lumoviz_organizer_mapping(canonical_organizer_vanid);

COMMENT ON TABLE lumoviz_organizer_mapping IS 'Maps multiple organizer identities to a single canonical organizer';

-- ================================================================
-- PART 9: SOURCE DATA TABLES
-- ================================================================
-- These tables hold source data (VAN exports, etc.)
-- In BigQuery these were separate tables, replicate structure here

-- 9.1 Contacts (source data)
CREATE TABLE IF NOT EXISTS contacts (
  vanid VARCHAR(255) PRIMARY KEY,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  chapter VARCHAR(255),
  loe VARCHAR(100),
  member_status VARCHAR(100),
  email VARCHAR(500),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(255),
  state VARCHAR(50),
  zip VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contacts_chapter ON contacts(chapter);
CREATE INDEX idx_contacts_loe ON contacts(loe);
CREATE INDEX idx_contacts_name ON contacts(first_name, last_name);

COMMENT ON TABLE contacts IS 'Base contact/member information from VAN or other source system';

-- 9.2 Conversations (source data)
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  organizer_vanid VARCHAR(255),
  participant_vanid BIGINT,
  participant_first_name VARCHAR(255),
  participant_last_name VARCHAR(255),
  participant_chapter VARCHAR(255),
  date_contacted TIMESTAMP WITH TIME ZONE,
  conversation_type VARCHAR(100),
  purpose TEXT,
  commitments TEXT,
  stakes TEXT,
  evaluation TEXT,
  host_vanid VARCHAR(255),
  host_email VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversations_organizer ON conversations(organizer_vanid);
CREATE INDEX idx_conversations_participant ON conversations(participant_vanid);
CREATE INDEX idx_conversations_date ON conversations(date_contacted DESC);
CREATE INDEX idx_conversations_chapter ON conversations(participant_chapter);

COMMENT ON TABLE conversations IS 'Conversation records from source system';

-- 9.3 Org IDs (staff/organizer lookup)
CREATE TABLE IF NOT EXISTS org_ids (
  vanid VARCHAR(255) PRIMARY KEY,
  userid VARCHAR(255) UNIQUE,
  firstname VARCHAR(255),
  lastname VARCHAR(255),
  email VARCHAR(500),
  supervisorid VARCHAR(255),
  type VARCHAR(100),
  turf VARCHAR(255),
  team_role VARCHAR(255),
  chapter VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_org_ids_userid ON org_ids(userid);
CREATE INDEX idx_org_ids_name ON org_ids(firstname, lastname);
CREATE INDEX idx_org_ids_supervisor ON org_ids(supervisorid);

COMMENT ON TABLE org_ids IS 'Staff and organizer information for name resolution';

-- ================================================================
-- PART 10: PERFORMANCE INDEXES
-- ================================================================

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_teams_chapter_active ON lumoviz_teams(chapter) 
  WHERE date_disbanded IS NULL OR date_disbanded = '';

CREATE INDEX IF NOT EXISTS idx_conversations_organizer_date ON conversations(organizer_vanid, date_contacted DESC);

CREATE INDEX IF NOT EXISTS idx_meetings_organizer_date ON lumoviz_meetings(organizer_vanid, meeting_date DESC);

-- ================================================================
-- PART 11: HELPER FUNCTIONS
-- ================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_lumoviz_teams_updated_at BEFORE UPDATE ON lumoviz_teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lumoviz_campaigns_updated_at BEFORE UPDATE ON lumoviz_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lumoviz_actions_updated_at BEFORE UPDATE ON lumoviz_actions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lumoviz_lists_updated_at BEFORE UPDATE ON lumoviz_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lumoviz_contacts_updated_at BEFORE UPDATE ON lumoviz_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_ids_updated_at BEFORE UPDATE ON org_ids
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- SETUP COMPLETE
-- ================================================================

-- Verify all tables were created
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'lumoviz%' OR tablename IN ('contacts', 'conversations', 'org_ids')
ORDER BY tablename;

-- Show table counts (all should be 0 for fresh install)
SELECT 'lumoviz_teams' as table_name, COUNT(*) as row_count FROM lumoviz_teams
UNION ALL SELECT 'lumoviz_campaigns', COUNT(*) FROM lumoviz_campaigns
UNION ALL SELECT 'lumoviz_actions', COUNT(*) FROM lumoviz_actions
UNION ALL SELECT 'lumoviz_lists', COUNT(*) FROM lumoviz_lists
UNION ALL SELECT 'lumoviz_contacts', COUNT(*) FROM lumoviz_contacts
UNION ALL SELECT 'lumoviz_meetings', COUNT(*) FROM lumoviz_meetings
UNION ALL SELECT 'contacts', COUNT(*) FROM contacts
UNION ALL SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL SELECT 'org_ids', COUNT(*) FROM org_ids;
