-- Update all template actions to have 'live' status
-- This makes them appear in the "Live" tab of My Actions

UPDATE `lumoviz.lumoviz_actions`
SET status = 'live'
WHERE is_template = TRUE;
