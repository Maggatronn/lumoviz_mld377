# Cleanup Orphaned Action References

## Problem
When actions are deleted (not archived) from the `lumoviz_actions` table, there may be orphaned references to those actions in other tables. This causes data integrity issues and can lead to errors in the application.

## Affected Tables
Action references exist in three places:

1. **`lumoviz_lists`** - `action_id` column
   - List entries that track which action a person is working on
   - Example: A list entry for "Leadership Conversations" action

2. **`lumoviz_meetings`** - `action_id` column
   - Meeting/conversation records that were logged as part of an action
   - Example: A 1:1 meeting logged under a specific campaign action

3. **`lumoviz_actions`** - `template_action_id` column
   - Personal actions created from campaign templates
   - Example: An organizer's personal copy of "Leadership Registration" template

## How to Use the Cleanup Script

### Step 1: Run Diagnostics
Open `cleanup_orphaned_action_references.sql` and run the **STEP 1: DIAGNOSTIC QUERIES** section.

These queries will show you:
- How many orphaned references exist in each table
- Which specific action IDs are orphaned
- How many records are affected

Example output:
```
table_name | orphaned_count | unique_orphaned_actions
-----------|----------------|------------------------
LISTS      | 45             | 3
```

### Step 2: Choose Cleanup Approach

#### Option A: NULL out references (RECOMMENDED)
- Keeps the list entries and meetings
- Just removes the invalid action_id link
- **Use when:** The records are still valuable even without the action link
- **Example:** You deleted an action but want to keep the list of people who were working on it

Run the **OPTION A** queries in the script.

#### Option B: Delete rows with orphaned references (USE WITH CAUTION)
- Permanently deletes list entries and meetings that reference deleted actions
- **Use when:** The records are not valuable without the action link
- **Example:** You deleted test actions and want to clean up all test data

Uncomment and run the **OPTION B** queries in the script.

### Step 3: Verify Cleanup
Run the **STEP 3: VERIFICATION** queries to confirm all orphaned references are gone.

Expected output:
```
status              | orphaned_lists | orphaned_meetings | orphaned_template_refs
--------------------|----------------|-------------------|----------------------
After cleanup check | 0              | 0                 | 0
```

### Step 4 (Optional): Set up Monitoring
Run the **CREATE VIEW** query to create a monitoring view that you can query anytime to check for orphaned references:

```sql
SELECT * FROM `organizing-data-487317.lumoviz.orphaned_action_references`;
```

This is useful for catching orphaned references early in the future.

## Quick Reference

### Find orphaned references in lists:
```sql
SELECT action_id, COUNT(*) as count
FROM `organizing-data-487317.lumoviz.lumoviz_lists`
WHERE action_id IS NOT NULL
  AND action_id NOT IN (SELECT action_id FROM `organizing-data-487317.lumoviz.lumoviz_actions`)
GROUP BY action_id;
```

### Clean up lists (NULL approach):
```sql
UPDATE `organizing-data-487317.lumoviz.lumoviz_lists`
SET action_id = NULL, action = NULL
WHERE action_id NOT IN (SELECT action_id FROM `organizing-data-487317.lumoviz.lumoviz_actions`);
```

### Clean up meetings (NULL approach):
```sql
UPDATE `organizing-data-487317.lumoviz.lumoviz_meetings`
SET action_id = NULL
WHERE action_id NOT IN (SELECT action_id FROM `organizing-data-487317.lumoviz.lumoviz_actions`);
```

## Best Practices

1. **Always run diagnostics first** - Know what you're about to change
2. **Prefer NULL over DELETE** - Keep your historical data
3. **Run cleanup after bulk deletes** - Make it part of your deletion workflow
4. **Use the monitoring view** - Catch issues early
5. **Take a snapshot before cleanup** - BigQuery snapshots are cheap insurance

## Recovery
If you accidentally delete data, you can restore from BigQuery table snapshots:

```sql
-- Restore lists table from 1 hour ago
CREATE OR REPLACE TABLE `organizing-data-487317.lumoviz.lumoviz_lists`
CLONE `organizing-data-487317.lumoviz.lumoviz_lists`
FOR SYSTEM_TIME AS OF TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR);
```

## Questions?
- **Q: What if I want to archive instead of delete actions?**
  - A: Set `status = 'archived'` instead of deleting. No cleanup needed!

- **Q: Can orphaned references cause errors?**
  - A: Yes, if your app assumes action_id references are valid, it may crash or show errors.

- **Q: How often should I run cleanup?**
  - A: After any bulk action deletions, or check the monitoring view weekly.
