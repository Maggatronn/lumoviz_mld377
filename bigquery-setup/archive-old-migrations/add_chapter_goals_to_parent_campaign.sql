-- Add chapter-specific goals to parent campaign (Spring 2026 Organizing Drive)
-- These will show up as breakdowns in the goal tooltips

-- PLEDGES (by March 28) - Total: 1,760
-- Durham: 360, Forsyth: 800, New Hanover: 300, Guilford: 300

INSERT INTO `chapter-448015.lumoviz.lumoviz_campaign_goals`
(goal_id, campaign_id, goal_type, goal_name, target_value, chapter)
VALUES
-- Durham pledges
('pledges_parent_durham', 'parent_spring_2026', 'pledges', 'Pledges', 360, 'Durham For All'),
-- Forsyth pledges
('pledges_parent_forsyth', 'parent_spring_2026', 'pledges', 'Pledges', 800, 'Forsyth For All'),
-- New Hanover pledges
('pledges_parent_new_hanover', 'parent_spring_2026', 'pledges', 'Pledges', 300, 'New Hanover For All'),
-- Guilford pledges
('pledges_parent_guilford', 'parent_spring_2026', 'pledges', 'Pledges', 300, 'Guilford For All');

-- TEAM MEMBERS (by January 31) - Total: 132
-- Durham: 25, New Hanover: 12, Forsyth: 80 (8 teams of 10), Guilford: 15

INSERT INTO `chapter-448015.lumoviz.lumoviz_campaign_goals`
(goal_id, campaign_id, goal_type, goal_name, target_value, chapter)
VALUES
-- Durham team members
('team_members_parent_durham', 'parent_spring_2026', 'team_members', 'Team Members', 25, 'Durham For All'),
-- New Hanover team members
('team_members_parent_new_hanover', 'parent_spring_2026', 'team_members', 'Team Members', 12, 'New Hanover For All'),
-- Forsyth team members (8 teams of 10)
('team_members_parent_forsyth', 'parent_spring_2026', 'team_members', 'Team Members', 80, 'Forsyth For All'),
-- Guilford team members
('team_members_parent_guilford', 'parent_spring_2026', 'team_members', 'Team Members', 15, 'Guilford For All');
