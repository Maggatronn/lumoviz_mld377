-- ================================================================
-- SAMPLE SEED DATA (OPTIONAL)
-- ================================================================
-- This file contains example campaign data for testing.
-- Modify the values to match your organization's needs or skip entirely.

-- ----------------------------------------------------------------
-- 1. INSERT PARENT CAMPAIGN
-- ----------------------------------------------------------------
INSERT INTO `organizing-data-487317.lumoviz.lumoviz_campaigns`
(campaign_id, campaign_name, description, start_date, end_date, chapters, parent_campaign_id, status)
VALUES
('parent_spring_2026', 'Spring 2026 Organizing Drive', 
 'Organization-wide campaign to build pledges and activate team members',
 '2025-11-18', '2026-03-28', ['All Chapters'], NULL, 'active');

-- ----------------------------------------------------------------
-- 2. INSERT ORGANIZATION-LEVEL GOALS (chapter = NULL for org-wide)
-- ----------------------------------------------------------------
INSERT INTO `organizing-data-487317.lumoviz.lumoviz_campaign_goals`
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
INSERT INTO `organizing-data-487317.lumoviz.lumoviz_campaign_milestones`
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
-- 4. INSERT EXAMPLE CHAPTER CAMPAIGN (Durham)
-- ----------------------------------------------------------------
INSERT INTO `organizing-data-487317.lumoviz.lumoviz_campaigns`
(campaign_id, campaign_name, description, start_date, end_date, chapters, parent_campaign_id, status)
VALUES
('durham_spring_2026', 'Durham - Spring 2026', 
 'Durham chapter contribution to Spring 2026 Organizing Drive',
 '2025-11-18', '2026-03-28', ['Durham For All'], 'parent_spring_2026', 'active');

-- ----------------------------------------------------------------
-- 5. INSERT CHAPTER-LEVEL GOALS
-- ----------------------------------------------------------------
INSERT INTO `organizing-data-487317.lumoviz.lumoviz_campaign_goals`
(goal_id, campaign_id, goal_type, goal_name, target_value, chapter)
VALUES
-- Durham chapter goals
('pledges_durham', 'durham_spring_2026', 'pledges', 'Pledges', 360, 'Durham For All'),
('team_members_durham', 'durham_spring_2026', 'team_members', 'Team Members', 25, 'Durham For All'),
('membership_1on1s_durham', 'durham_spring_2026', 'membership_1on1s', 'Membership One-on-One', 100, 'Durham For All'),
('leadership_1on1s_durham', 'durham_spring_2026', 'leadership_1on1s', 'Leadership Development One-on-One', 40, 'Durham For All');

-- ----------------------------------------------------------------
-- 6. INSERT CHAPTER MILESTONES
-- ----------------------------------------------------------------
INSERT INTO `organizing-data-487317.lumoviz.lumoviz_campaign_milestones`
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
-- 7. INSERT SAMPLE ACTION TEMPLATES
-- ----------------------------------------------------------------
INSERT INTO `organizing-data-487317.lumoviz.lumoviz_actions`
(action_id, action_name, description, goal_type, has_goal, default_individual_goal, 
 parent_campaign_id, is_template, target_audience, status)
VALUES
('sign_pledge', 'Sign Pledge', 
 'Get constituents to sign the organizing pledge', 
 'pledges', TRUE, 5,
 'parent_spring_2026', TRUE, 'constituent', 'live'),
 
('leadership_registration', 'Leadership Registration', 
 'Recruit new team members for leadership development', 
 'team_members', TRUE, 2,
 'parent_spring_2026', TRUE, 'leadership', 'live');

-- ----------------------------------------------------------------
-- NOTES:
-- ----------------------------------------------------------------
-- With this schema:
-- 1. Org-wide goals: chapter = NULL
-- 2. Chapter-specific goals: chapter = 'Durham For All' (or your chapter name)
-- 3. Actions reference goal_type (like 'team_members' or 'pledges')
-- 4. The backend resolves actions to specific goals based on:
--    - campaign_id + goal_type + user's chapter context
