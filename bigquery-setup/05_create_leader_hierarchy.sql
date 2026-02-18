-- ================================================================
-- LUMOVIZ LEADER HIERARCHY TABLE
-- ================================================================
-- Tracks the organizational structure of leaders (who reports to whom)

CREATE TABLE IF NOT EXISTS `people-power-change.lumoviz.lumoviz_leader_hierarchy` (
  leader_vanid STRING NOT NULL OPTIONS (description = 'The leader\'s VAN ID'),
  parent_leader_vanid STRING OPTIONS (description = 'Who they report to (NULL = direct report to organizer)'),
  organizer_vanid STRING NOT NULL OPTIONS (description = 'Who owns this hierarchy entry'),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(created_date)
CLUSTER BY organizer_vanid, leader_vanid;

-- Example data structure:
-- organizer_vanid: 101669044 (Courtney)
--   ├── leader_vanid: 123456 (Cedric) - parent_leader_vanid: NULL (direct report)
--   │   └── leader_vanid: 789012 (Nadia) - parent_leader_vanid: 123456 (reports to Cedric)
--   │       └── leader_vanid: 345678 (Ali) - parent_leader_vanid: 789012 (reports to Nadia)
