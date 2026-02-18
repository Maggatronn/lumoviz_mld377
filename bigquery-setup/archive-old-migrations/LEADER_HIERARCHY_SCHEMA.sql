-- Leader Hierarchy Table
-- Tracks the organizational structure of leaders (who reports to whom)

CREATE TABLE `lumoviz_leader_hierarchy` (
  leader_vanid STRING NOT NULL,           -- The leader's VAN ID
  parent_leader_vanid STRING,             -- Who they report to (NULL = direct report to organizer)
  organizer_vanid STRING NOT NULL,        -- Who owns this hierarchy entry
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(created_date)
CLUSTER BY organizer_vanid, leader_vanid;

-- Index for fast lookups
-- Note: BigQuery doesn't support indexes, but clustering provides similar benefits

-- Example data:
-- organizer_vanid: 101669044 (Courtney)
-- leader_vanid: 123456 (Cedric) - parent_leader_vanid: NULL (direct report)
-- leader_vanid: 789012 (Nadia) - parent_leader_vanid: 123456 (reports to Cedric)
-- leader_vanid: 345678 (Ali) - parent_leader_vanid: 789012 (reports to Nadia)
