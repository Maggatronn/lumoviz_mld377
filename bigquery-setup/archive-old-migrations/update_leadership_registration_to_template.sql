-- Update Leadership Registration to be a template
-- This makes it automatically available to all organizers

UPDATE `lumoviz.lumoviz_actions`
SET is_template = TRUE,
    status = 'live'
WHERE action_id = 'leadership_registration';
