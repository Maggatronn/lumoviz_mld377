# Switch App to people-power-change (Demo Database)

This guide shows how to temporarily switch the app from `chapter-448015` to `people-power-change` for demo/testing.

## Prerequisites

You need:
1. ✅ BigQuery access to `people-power-change` project
2. ✅ Service account credentials with permissions for `people-power-change`

---

## Step 1: Set Up Demo Database

Run these SQL files in BigQuery console in order:

```sql
-- 1. Create the dataset/schema
-- Run: bigquery-setup/00_CREATE_DATASET.sql
CREATE SCHEMA IF NOT EXISTS `people-power-change.lumoviz`
OPTIONS (description = 'Lumoviz demo data', location = 'US');

-- 2. Create all tables
-- Run: bigquery-setup/00_MASTER_SETUP.sql
-- (This creates 12 tables)

-- 3. Insert demo data
-- Run: bigquery-setup/01_SEED_DATA_DEMO.sql
-- (This creates 3 teams with members and sample organizing data)

-- 4. Create contacts view
-- Run: bigquery-setup/02_CREATE_CONTACTS_VIEW_DEMO.sql
-- (This creates the contacts view needed by the app)
```

---

## Step 2: Update Service Account Credentials

### Option A: Use Existing Credentials (if they have access)

Your current `server/credentials.json` might already have access to `people-power-change`. To check:

1. Look at the `client_email` in `server/credentials.json`
2. In GCP Console, go to `people-power-change` → IAM
3. Verify that service account email has these roles:
   - **BigQuery Data Viewer**
   - **BigQuery Data Editor** 
   - **BigQuery Job User**

If yes, skip to Step 3. If no, continue to Option B.

### Option B: Create New Service Account for people-power-change

1. Go to GCP Console → `people-power-change` → IAM & Admin → Service Accounts
2. Create new service account (e.g., `lumoviz-demo@people-power-change.iam.gserviceaccount.com`)
3. Grant these roles:
   - BigQuery Data Viewer
   - BigQuery Data Editor
   - BigQuery Job User
4. Create and download JSON key
5. Save as `server/credentials-demo.json`

---

## Step 3: Switch Environment Configuration

Update your `.env` file to point to the demo database:

```bash
# In server/.env, change:
PROJECT_ID=people-power-change

# Keep these the same:
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json  # or ./credentials-demo.json if you created new one
REACT_APP_API_URL=http://localhost:3003/api
PORT=3003
```

---

## Step 4: Restart the App

```bash
# Stop the current server (Ctrl+C)

# Start the server with the new config
cd server
node index.js

# In another terminal, start the frontend
npm start
```

---

## Step 5: Verify It's Working

1. Open the app (http://localhost:3000)
2. Go to Teams view - you should see:
   - Leadership Team (Marshall, Steph, Emily)
   - Data Team (Emily, Maggie, Zainab)
   - TFs (Alyssa, Svetlana, Sepi, Zainab)
3. Check the console - logs should show queries to `people-power-change.lumoviz`

---

## Revert Back to chapter-448015

When you're done testing, revert:

```bash
# In server/.env, change back:
PROJECT_ID=chapter-448015
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json

# Restart the server
```

---

## What Info Do You Need to Provide?

To make this work, I need to know:

1. **Do you have BigQuery access to `people-power-change`?**
   - Yes → Use existing credentials
   - No → Need to be granted access

2. **Does your current `server/credentials.json` service account have access to `people-power-change`?**
   - Check: What's the `client_email` in your credentials.json?
   - I can verify if that account is in the `people-power-change` IAM

3. **Do you want to use the same service account or create a new one?**
   - Same → Just need to grant it access to `people-power-change`
   - New → Need to create and download new credentials

Let me know and I can help with the specific steps!
