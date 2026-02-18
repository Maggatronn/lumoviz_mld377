# Archived Migration Files

This folder contains the original incremental SQL migration files from the development process. These are **NOT needed** for a fresh setup.

## What's Here

These files represent the historical evolution of the schema:
- `add_*.sql` - ALTER TABLE commands to add new columns
- `update_*.sql` - Data update scripts
- `cleanup_*.sql` - One-time data cleanup operations
- `create_campaign_tables_if_not_exist.sql` - Original campaign table creation
- `seed_campaigns_actual_schema.sql` - Original seed data with hardcoded project IDs
- `LEADER_HIERARCHY_SCHEMA.sql` - Original hierarchy table schema

## Why They're Archived

All of these changes have been **consolidated** into the numbered SQL files in the parent directory (`01_create_teams.sql`, `02_create_campaigns.sql`, etc.).

The consolidated files:
- Include all fields from all the ALTER TABLE migrations
- Use CREATE TABLE statements (not ALTER TABLE)
- Are organized in logical order
- Are ready for a fresh BigQuery setup

## When to Use These

- **For a fresh setup**: Use the numbered files in the parent directory
- **For reference**: These files show the historical development process
- **For debugging**: If you need to understand why a field exists or how it evolved

These files are kept for historical reference only.
