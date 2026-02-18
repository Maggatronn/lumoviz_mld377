# Lumoviz BigQuery Setup

This directory contains all the SQL scripts needed to set up a fresh BigQuery instance for the Lumoviz application.

## Quick Start (Brand New Instance)

If you're setting up Lumoviz in a brand new BigQuery project, follow these steps:

### Step 1: Create the Dataset

Choose one of these options:

**Option A: In BigQuery Console (Easiest)**
1. Open `00_CREATE_DATASET.sql` in BigQuery console
2. Run the `CREATE SCHEMA` command
3. You'll see `lumoviz` appear in the left sidebar

**Option B: Command Line**
```bash
bash 00_CREATE_DATASET.sh
# or manually:
bq mk --dataset --location US organizing-data-487317:lumoviz
```

### Step 2: Create All Tables

```bash
bq query --use_legacy_sql=false < 00_MASTER_SETUP.sql
```

**CONFIGURATION**: The scripts are configured for:
- Project ID: `organizing-data-487317`
- Dataset: `lumoviz`

If you need different values, find and replace in the scripts before running.

## What Gets Created

The master setup script creates 8 core table groups:

### 1. Teams Tables
- `lumoviz_teams` - Team information (name, leader, chapter, culture)
- `lumoviz_team_changelog` - Audit log of team changes
- `lumoviz_team_members` - Individual team members with constituent and functional roles

### 2. Campaigns Tables
- `lumoviz_campaigns` - Campaign definitions
- `lumoviz_campaign_goals` - Goals by campaign and chapter
- `lumoviz_campaign_milestones` - Campaign milestones and deadlines

### 3. Actions Table
- `lumoviz_actions` - Actions that organizers can track (templates and personal)

### 4. Lists Table
- `lumoviz_lists` - Organizer contact lists with action progress tracking

### 5. Contacts Table
- `lumoviz_contacts` - Extended contact info (phone, email, primary organizer)

### 6. Meetings Table
- `lumoviz_meetings` - Detailed conversation tracking with relational organizing data

### 7. Leader Hierarchy Table
- `lumoviz_leader_hierarchy` - Who reports to whom in the leadership structure

### 8. Organizer Mapping Table
- `lumoviz_organizer_mapping` - Maps multiple VAN IDs to canonical organizer IDs

## Post-Setup Requirements

After running the setup script, you need to:

### 1. Create the `contacts` VIEW

The application expects a `contacts` VIEW that provides base contact information. This typically points to your VAN data or other contact source. Example:

```sql
CREATE OR REPLACE VIEW `organizing-data-487317.lumoviz.contacts` AS
SELECT 
  vanid,
  firstname,
  lastname,
  chapter,
  email,
  phone,
  -- Add other fields from your contact source
FROM `your-project.your-dataset.your_contacts_table`;
```

### 2. Verify Tables Were Created

```sql
SELECT table_name 
FROM `organizing-data-487317.lumoviz.INFORMATION_SCHEMA.TABLES`
ORDER BY table_name;
```

You should see 12 tables total:
- lumoviz_actions
- lumoviz_campaign_goals
- lumoviz_campaign_milestones
- lumoviz_campaigns
- lumoviz_contacts
- lumoviz_leader_hierarchy
- lumoviz_lists
- lumoviz_meetings
- lumoviz_organizer_mapping
- lumoviz_team_changelog
- lumoviz_team_members
- lumoviz_teams

### 3. Load Initial Data (Optional)

**For Demo/Testing:**
Run the demo seed data script to populate with sample teams and data:
```bash
bq query --use_legacy_sql=false < 01_SEED_DATA_DEMO.sql
bq query --use_legacy_sql=false < 02_CREATE_CONTACTS_VIEW_DEMO.sql
```

**For Production:**
If you have existing data, you can load it using the individual migration scripts in this directory or using the BigQuery console/CLI.

## Individual Setup Scripts

If you prefer to run scripts individually or need to understand the schema in parts:

1. `01_create_teams.sql` - Teams and changelog tables
2. `02_create_campaigns.sql` - Campaigns, goals, and milestones
3. `03_create_actions.sql` - Actions table
4. `04_create_lists.sql` - Lists table
5. `05_create_leader_hierarchy.sql` - Leader hierarchy
6. `06_create_organizer_mapping.sql` - Organizer identity mapping

Additional tables (included in master setup):
- Team members with roles
- Extended contacts table
- Detailed meetings/conversation tracking

## Environment Configuration

Update your `.env` file to point to your BigQuery setup:

```env
GCP_PROJECT_ID=organizing-data-487317
BIGQUERY_DATASET=lumoviz
```

## Troubleshooting

### Permission Errors
Make sure your service account has these BigQuery roles:
- BigQuery Data Editor
- BigQuery Job User

### Table Already Exists
All scripts use `CREATE TABLE IF NOT EXISTS`, so they're safe to re-run.

### Wrong Project/Dataset
Double-check the project and dataset IDs in the SQL files match your GCP setup.

## Schema Documentation

For detailed field descriptions, see the `OPTIONS (description = '...')` annotations in the SQL files, or query the INFORMATION_SCHEMA:

```sql
SELECT column_name, data_type, description
FROM `organizing-data-487317.lumoviz.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS`
WHERE table_name = 'lumoviz_teams';
```
