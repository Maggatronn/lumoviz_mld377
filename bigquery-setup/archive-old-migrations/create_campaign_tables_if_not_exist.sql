-- Create campaign tables if they don't already exist
-- Run these in BigQuery console one at a time

-- 1. Create campaigns table
CREATE TABLE IF NOT EXISTS `chapter-448015.lumoviz.lumoviz_campaigns` (
  campaign_id STRING NOT NULL,
  campaign_name STRING NOT NULL,
  description STRING,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  parent_campaign_id STRING,
  chapters ARRAY<STRING>,
  status STRING DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  created_by STRING
);

-- 2. Create campaign goals table
CREATE TABLE IF NOT EXISTS `chapter-448015.lumoviz.lumoviz_campaign_goals` (
  goal_id STRING NOT NULL,
  campaign_id STRING NOT NULL,
  goal_type STRING NOT NULL,
  goal_name STRING,
  target_value INT64 NOT NULL,
  chapter STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- 3. Create campaign milestones table
CREATE TABLE IF NOT EXISTS `chapter-448015.lumoviz.lumoviz_campaign_milestones` (
  milestone_id STRING NOT NULL,
  campaign_id STRING NOT NULL,
  milestone_date DATE NOT NULL,
  milestone_label STRING NOT NULL,
  goal_type STRING,
  target_value INT64,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);
