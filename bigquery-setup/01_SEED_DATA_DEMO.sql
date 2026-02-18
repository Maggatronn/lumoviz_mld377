-- ================================================================
-- SEED DATA FOR DEMO - organizing-data-487317.lumoviz
-- ================================================================
-- Creates sample teams, contacts, and data for testing
-- Run AFTER 00_MASTER_SETUP.sql
--
-- This populates the organizing-data-487317.lumoviz tables with:
-- - 3 Teams (Leadership, Data, TFs)
-- - 8 Team members with roles
-- - Sample campaigns, actions, lists, and meetings
-- ================================================================

-- ================================================================
-- PART 1: INSERT TEAMS
-- ================================================================

INSERT INTO `organizing-data-487317.lumoviz.lumoviz_teams` 
(id, team_name, team_leader, chapter, team_members, turf, date_created, date_disbanded, color, shared_purpose, norms, constituency)
VALUES 
(
  'team_leadership_001',
  'Leadership Team',
  'Marshall',
  'National',
  'Steph, Emily',
  'National organizing strategy and direction',
  '2024-01-15',
  NULL,
  '#2563eb',
  'Build power through strategic leadership development and organizational capacity',
  '• Lead with transparency and accountability\n• Make decisions collaboratively\n• Center equity in all decisions',
  'Organizational leaders and emerging leaders'
),
(
  'team_data_002',
  'Data Team',
  'Emily',
  'National',
  'Maggie, Zainab',
  'Data systems, analysis, and visualization',
  '2024-02-01',
  NULL,
  '#7c3aed',
  'Enable data-driven organizing through accessible tools and analysis',
  '• Prioritize user needs in tool design\n• Document everything clearly\n• Share knowledge openly',
  'Organizers and data users across the organization'
),
(
  'team_tfs_003',
  'TFs',
  'Alyssa',
  'National',
  'Svetlana, Sepi, Zainab',
  'Field organizing and direct action',
  '2024-01-10',
  NULL,
  '#dc2626',
  'Build grassroots power through direct organizing and community engagement',
  '• Show up for each other\n• Organize with love and rage\n• Build authentic relationships',
  'Community members and grassroots organizers'
);

-- ================================================================
-- PART 2: INSERT TEAM MEMBERS WITH ROLES
-- ================================================================

INSERT INTO `organizing-data-487317.lumoviz.lumoviz_team_members`
(team_id, member_vanid, member_name, constituent_role, functional_role, date_added, is_active)
VALUES
-- Leadership Team
('team_leadership_001', '10001', 'Marshall', 'Leader', 'Team Lead', CURRENT_TIMESTAMP(), TRUE),
('team_leadership_001', '10002', 'Steph', 'Leader', 'Co-Lead', CURRENT_TIMESTAMP(), TRUE),
('team_leadership_001', '10003', 'Emily', 'Leader', 'Member', CURRENT_TIMESTAMP(), TRUE),

-- Data Team
('team_data_002', '10003', 'Emily', 'Leader', 'Team Lead', CURRENT_TIMESTAMP(), TRUE),
('team_data_002', '10004', 'Maggie', 'Potential Leader', 'Co-Lead', CURRENT_TIMESTAMP(), TRUE),
('team_data_002', '10005', 'Zainab', 'Leader', 'Member', CURRENT_TIMESTAMP(), TRUE),

-- TFs Team
('team_tfs_003', '10006', 'Alyssa', 'Leader', 'Team Lead', CURRENT_TIMESTAMP(), TRUE),
('team_tfs_003', '10007', 'Svetlana', 'Potential Leader', 'Co-Lead', CURRENT_TIMESTAMP(), TRUE),
('team_tfs_003', '10008', 'Sepi', 'Leader', 'Member', CURRENT_TIMESTAMP(), TRUE),
('team_tfs_003', '10005', 'Zainab', 'Leader', 'Member', CURRENT_TIMESTAMP(), TRUE);

-- ================================================================
-- PART 3: INSERT EXTENDED CONTACT INFO
-- ================================================================

INSERT INTO `organizing-data-487317.lumoviz.lumoviz_contacts`
(vanid, phone, email, primary_organizer_vanid, created_at)
VALUES
('10001', '555-0101', 'marshall@demo.org', NULL, CURRENT_TIMESTAMP()),
('10002', '555-0102', 'steph@demo.org', NULL, CURRENT_TIMESTAMP()),
('10003', '555-0103', 'emily@demo.org', NULL, CURRENT_TIMESTAMP()),
('10004', '555-0104', 'maggie@demo.org', '10003', CURRENT_TIMESTAMP()),
('10005', '555-0105', 'zainab@demo.org', '10003', CURRENT_TIMESTAMP()),
('10006', '555-0106', 'alyssa@demo.org', NULL, CURRENT_TIMESTAMP()),
('10007', '555-0107', 'svetlana@demo.org', '10006', CURRENT_TIMESTAMP()),
('10008', '555-0108', 'sepi@demo.org', '10006', CURRENT_TIMESTAMP());

-- ================================================================
-- PART 4: CREATE SAMPLE CAMPAIGN
-- ================================================================

INSERT INTO `organizing-data-487317.lumoviz.lumoviz_campaigns`
(campaign_id, campaign_name, description, start_date, end_date, parent_campaign_id, chapters, status, created_at, created_by)
VALUES
(
  'campaign_spring_2024',
  'Spring Power Building',
  'Build organizational capacity and expand our base',
  '2024-03-01',
  '2024-05-31',
  NULL,
  ['National'],
  'active',
  CURRENT_TIMESTAMP(),
  'Marshall'
);

-- ================================================================
-- PART 5: CREATE CAMPAIGN GOALS
-- ================================================================

INSERT INTO `organizing-data-487317.lumoviz.lumoviz_campaign_goals`
(goal_id, campaign_id, goal_type, goal_name, target_value, chapter, created_at)
VALUES
('goal_001', 'campaign_spring_2024', 'new_leaders', 'Leadership Development', 25, 'National', CURRENT_TIMESTAMP()),
('goal_002', 'campaign_spring_2024', 'conversations', 'Deep Conversations', 100, 'National', CURRENT_TIMESTAMP()),
('goal_003', 'campaign_spring_2024', 'team_members', 'New Team Members', 15, 'National', CURRENT_TIMESTAMP());

-- ================================================================
-- PART 6: CREATE SAMPLE ACTIONS
-- ================================================================

INSERT INTO `organizing-data-487317.lumoviz.lumoviz_actions`
(action_id, action_name, description, goal_type, has_goal, default_individual_goal, parent_campaign_id, organizer_vanid, chapters, is_template, status, created_at)
VALUES
(
  'action_leadership_convos',
  'Leadership Conversations',
  'Have deep 1-on-1 conversations with potential leaders',
  'conversations',
  TRUE,
  10,
  'campaign_spring_2024',
  NULL,
  ['National'],
  TRUE,
  'live',
  CURRENT_TIMESTAMP()
),
(
  'action_team_recruitment',
  'Team Recruitment',
  'Recruit new team members',
  'team_members',
  TRUE,
  5,
  'campaign_spring_2024',
  NULL,
  ['National'],
  TRUE,
  'live',
  CURRENT_TIMESTAMP()
);

-- ================================================================
-- PART 7: CREATE SAMPLE LISTS (Organizer Activity)
-- ================================================================

INSERT INTO `organizing-data-487317.lumoviz.lumoviz_lists`
(list_id, organizer_vanid, contact_vanid, contact_name, action, action_id, campaign_id, progress, notes, date_added, is_completed, is_active)
VALUES
('list_001', '10004', 20001, 'Alex Johnson', 'Leadership Conversations', 'action_leadership_convos', 'campaign_spring_2024', '{"contacted": true, "met": false}', 'Reached out via email', CURRENT_TIMESTAMP(), FALSE, TRUE),
('list_002', '10004', 20002, 'Jamie Smith', 'Leadership Conversations', 'action_leadership_convos', 'campaign_spring_2024', '{"contacted": true, "met": true}', 'Great conversation about housing justice', CURRENT_TIMESTAMP(), TRUE, TRUE),
('list_003', '10007', 20003, 'Sam Williams', 'Team Recruitment', 'action_team_recruitment', 'campaign_spring_2024', '{"invited": true, "committed": false}', 'Interested in data work', CURRENT_TIMESTAMP(), FALSE, TRUE);

-- ================================================================
-- PART 8: CREATE SAMPLE MEETINGS
-- ================================================================

INSERT INTO `organizing-data-487317.lumoviz.lumoviz_meetings`
(meeting_id, organizee_vanid, organizer_vanid, meeting_date, notes, person_type, purpose, values, leadership_tag, created_at)
VALUES
(
  'meeting_001',
  20002,
  '10004',
  '2024-03-15',
  'Deep conversation about housing justice and tenant organizing',
  'Constituent',
  'Leadership development conversation',
  'Deeply cares about housing justice and keeping families in their homes',
  'Potential Leader',
  CURRENT_TIMESTAMP()
),
(
  'meeting_002',
  20001,
  '10004',
  '2024-03-10',
  'Initial outreach, discussed interest in organizing',
  'Constituent',
  'Initial recruitment conversation',
  'Interested in economic justice and worker rights',
  'Supporter',
  CURRENT_TIMESTAMP()
);

-- ================================================================
-- PART 9: CREATE ORGANIZER MAPPING (consolidate identities)
-- ================================================================

INSERT INTO `organizing-data-487317.lumoviz.lumoviz_organizer_mapping`
(mapping_id, organizer_vanid, canonical_organizer_vanid, created_at, notes)
VALUES
('map_001', '10001', '10001', CURRENT_TIMESTAMP(), 'Marshall - canonical ID'),
('map_002', '10002', '10002', CURRENT_TIMESTAMP(), 'Steph - canonical ID'),
('map_003', '10003', '10003', CURRENT_TIMESTAMP(), 'Emily - canonical ID'),
('map_004', '10004', '10004', CURRENT_TIMESTAMP(), 'Maggie - canonical ID'),
('map_005', '10005', '10005', CURRENT_TIMESTAMP(), 'Zainab - canonical ID'),
('map_006', '10006', '10006', CURRENT_TIMESTAMP(), 'Alyssa - canonical ID'),
('map_007', '10007', '10007', CURRENT_TIMESTAMP(), 'Svetlana - canonical ID'),
('map_008', '10008', '10008', CURRENT_TIMESTAMP(), 'Sepi - canonical ID');

-- ================================================================
-- SETUP COMPLETE
-- ================================================================
-- Sample data created successfully!
-- 
-- What was created:
-- - 3 Teams with members and roles
-- - 8 Team members with contact info
-- - 1 Campaign with 3 goals
-- - 2 Actions
-- - 3 List entries (organizing activity)
-- - 2 Meetings/conversations
-- - 8 Organizer mappings
--
-- Next step: Create a contacts VIEW pointing to your actual contact data
-- ================================================================
