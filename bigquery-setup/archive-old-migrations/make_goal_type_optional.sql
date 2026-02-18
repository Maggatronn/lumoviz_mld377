-- Make goal_type column optional (nullable) in lumoviz_actions table

ALTER TABLE `chapter-448015.lumoviz.lumoviz_actions`
ALTER COLUMN goal_type DROP NOT NULL;
