-- ================================================================
-- CLEANUP DUPLICATE ACTIONS
-- ================================================================
-- Remove old personal copies that were created before the architecture change
-- Keep only the templates (is_template = TRUE)

-- Delete personal copies of Leadership Registration (keep only the template)
DELETE FROM `chapter-448015.lumoviz.lumoviz_actions`
WHERE action_id = 'leadership_registration' 
  AND is_template = FALSE 
  AND template_action_id = 'leadership_registration';

-- Verify what's left (run this after the DELETE to check)
-- SELECT action_id, action_name, is_template, template_action_id, visible_to_organizers
-- FROM `chapter-448015.lumoviz.lumoviz_actions`
-- WHERE action_id IN ('leadership_registration', 'sign_pledge')
-- ORDER BY action_id, is_template DESC;
