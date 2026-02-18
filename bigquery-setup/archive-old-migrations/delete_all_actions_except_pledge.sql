-- Delete all actions except the pledge one
-- This allows starting fresh with campaign templates

DELETE FROM `lumoviz.lumoviz_actions`
WHERE action_id != 'sign_pledge';

-- Verify what's left
-- SELECT action_id, action_name, is_template, status FROM `lumoviz.lumoviz_actions`;
