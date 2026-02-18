-- ================================================================
-- SEED CAMPAIGNS INTO EXISTING BIGQUERY TABLES
-- ================================================================
-- Uses YOUR existing schema (lumoviz_campaigns, lumoviz_campaign_goals, lumoviz_campaign_milestones)

-- ----------------------------------------------------------------
-- 1. INSERT PARENT CAMPAIGN
-- ----------------------------------------------------------------
INSERT INTO `chapter-448015.lumoviz.lumoviz_campaigns`
(campaign_id, campaign_name, description, start_date, end_date, chapters, parent_campaign_id, status)
VALUES
('parent_spring_2026', 'Spring 2026 Organizing Drive', 
 'Organization-wide campaign to build pledges and activate team members',
 '2025-11-18', '2026-03-28', ['All Chapters'], NULL, 'active');

-- ----------------------------------------------------------------
-- 2. INSERT ORGANIZATION-LEVEL GOALS (chapter = NULL for org-wide)
-- ----------------------------------------------------------------
INSERT INTO `chapter-448015.lumoviz.lumoviz_campaign_goals`
(goal_id, campaign_id, goal_type, goal_name, target_value, chapter)
VALUES
-- Organization-wide goals (chapter = NULL)
('pledges_org', 'parent_spring_2026', 'pledges', 'Pledges', 1760, NULL),
('team_members_org', 'parent_spring_2026', 'team_members', 'Team Members', 132, NULL),
('membership_1on1s_org', 'parent_spring_2026', 'membership_1on1s', 'Membership One-on-One', 500, NULL),
('leadership_1on1s_org', 'parent_spring_2026', 'leadership_1on1s', 'Leadership Development One-on-One', 200, NULL);

-- ----------------------------------------------------------------
-- 3. INSERT ORGANIZATION-LEVEL MILESTONES
-- ----------------------------------------------------------------
INSERT INTO `chapter-448015.lumoviz.lumoviz_campaign_milestones`
(milestone_id, campaign_id, milestone_date, milestone_label, goal_type, target_value)
VALUES
-- Jan 31 milestones
('milestone_jan31_team_members', 'parent_spring_2026', '2026-01-31', 'Team Members Goal', 'team_members', 132),
('milestone_jan31_pledges', 'parent_spring_2026', '2026-01-31', 'Team Members Goal', 'pledges', 500),

-- Feb 28 milestone
('milestone_feb28_pledges', 'parent_spring_2026', '2026-02-28', 'Mid-Campaign Check', 'pledges', 1200),

-- Mar 28 milestones
('milestone_mar28_pledges', 'parent_spring_2026', '2026-03-28', 'Final Goals', 'pledges', 1760),
('milestone_mar28_membership', 'parent_spring_2026', '2026-03-28', 'Final Goals', 'membership_1on1s', 500),
('milestone_mar28_leadership', 'parent_spring_2026', '2026-03-28', 'Final Goals', 'leadership_1on1s', 200);

-- ----------------------------------------------------------------
-- 4. INSERT DURHAM CHAPTER CAMPAIGN
-- ----------------------------------------------------------------
INSERT INTO `chapter-448015.lumoviz.lumoviz_campaigns`
(campaign_id, campaign_name, description, start_date, end_date, chapters, parent_campaign_id, status)
VALUES
('durham_spring_2026', 'Durham - Spring 2026', 
 'Durham chapter contribution to Spring 2026 Organizing Drive',
 '2025-11-18', '2026-03-28', ['Durham For All'], 'parent_spring_2026', 'active');

-- ----------------------------------------------------------------
-- 5. INSERT DURHAM CHAPTER-LEVEL GOALS
-- ----------------------------------------------------------------
INSERT INTO `chapter-448015.lumoviz.lumoviz_campaign_goals`
(goal_id, campaign_id, goal_type, goal_name, target_value, chapter)
VALUES
-- Durham chapter goals
('pledges_durham', 'durham_spring_2026', 'pledges', 'Pledges', 360, 'Durham For All'),
('team_members_durham', 'durham_spring_2026', 'team_members', 'Team Members', 25, 'Durham For All'),
('membership_1on1s_durham', 'durham_spring_2026', 'membership_1on1s', 'Membership One-on-One', 100, 'Durham For All'),
('leadership_1on1s_durham', 'durham_spring_2026', 'leadership_1on1s', 'Leadership Development One-on-One', 40, 'Durham For All');

-- ----------------------------------------------------------------
-- 6. INSERT DURHAM MILESTONES
-- ----------------------------------------------------------------
INSERT INTO `chapter-448015.lumoviz.lumoviz_campaign_milestones`
(milestone_id, campaign_id, milestone_date, milestone_label, goal_type, target_value)
VALUES
-- Jan 31 Durham milestones
('durham_jan31_team_members', 'durham_spring_2026', '2026-01-31', 'Team Members Goal', 'team_members', 25),
('durham_jan31_pledges', 'durham_spring_2026', '2026-01-31', 'Team Members Goal', 'pledges', 100),
('durham_jan31_membership', 'durham_spring_2026', '2026-01-31', 'Team Members Goal', 'membership_1on1s', 30),
('durham_jan31_leadership', 'durham_spring_2026', '2026-01-31', 'Team Members Goal', 'leadership_1on1s', 12),

-- Mar 28 Durham milestones
('durham_mar28_pledges', 'durham_spring_2026', '2026-03-28', 'Final Goals', 'pledges', 360),
('durham_mar28_membership', 'durham_spring_2026', '2026-03-28', 'Final Goals', 'membership_1on1s', 100),
('durham_mar28_leadership', 'durham_spring_2026', '2026-03-28', 'Final Goals', 'leadership_1on1s', 40);

-- ----------------------------------------------------------------
-- 7. UPDATE EXISTING ACTIONS TO LINK TO CAMPAIGNS
-- ----------------------------------------------------------------
-- Now update your existing actions to properly link to these campaigns

-- Update leadership_registration to link to parent campaign
UPDATE `chapter-448015.lumoviz.lumoviz_actions`
SET 
  goal_type = 'team_members',  -- Keep simple goal_type name
  parent_campaign_id = 'parent_spring_2026',
  is_template = TRUE  -- Make it a campaign template
WHERE action_id = 'leadership_registration';

-- Update sign_pledge 
UPDATE `chapter-448015.lumoviz.lumoviz_actions`
SET 
  goal_type = 'pledges',
  parent_campaign_id = 'parent_spring_2026',
  is_template = TRUE
WHERE action_id = 'sign_pledge';

-- ----------------------------------------------------------------
-- NOTES:
-- ----------------------------------------------------------------
-- With your schema:
-- 1. Org-wide goals: chapter = NULL
-- 2. Chapter goals: chapter = 'Durham For All' (same table!)
-- 3. Goal lookup logic: 
--    - Find goal where campaign_id matches AND goal_type matches
--    - If chapter is set, it's chapter-specific; if NULL, it's org-wide
-- 4. Actions reference goal_type (simple name like 'team_members')
--    Backend resolves to specific goal based on campaign_id + goal_type + user's chapter
