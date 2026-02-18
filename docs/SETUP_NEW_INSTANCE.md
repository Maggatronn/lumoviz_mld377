# Setting Up a New Lumoviz Instance

This guide explains how to fork and set up this application with a new BigQuery database.

## Overview

To reproduce this application elsewhere, you'll:
1. Fork/clone the repository
2. Set up a new BigQuery project and dataset
3. Configure environment variables
4. Run the BigQuery setup scripts
5. Test locally

## Step-by-Step Setup

### 1. Fork/Clone the Repository

```bash
git clone <your-repo-url>
cd lumoviz
```

### 2. Set Up Google Cloud & BigQuery

#### Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable the BigQuery API
4. Note your `PROJECT_ID`

#### Create BigQuery Dataset
1. In BigQuery console, create a dataset named `lumoviz`
2. Choose your region (e.g., `US`)

#### Set Up Core Data Tables
The application requires these base tables with your organization's data:
- `contacts` - Contact/member information
- `contact_history` - Interaction tracking
- `conversations` - Conversation records
- `org_ids` - Organization/user mappings
- `staff` - Staff information
- `user_map` - User mapping table

**Note:** These tables should contain your organization's actual data and are not created by the setup scripts below.

#### Create Service Account
1. Go to **IAM & Admin** → **Service Accounts**
2. Create service account (e.g., `lumoviz-app@your-project.iam.gserviceaccount.com`)
3. Grant roles:
   - **BigQuery Data Viewer**
   - **BigQuery Job User**
   - **BigQuery Data Editor** (for write operations)
4. Create and download JSON key file

### 3. Run BigQuery Setup Scripts

Navigate to the `bigquery-setup/` folder and run the SQL files **in order**:

```bash
cd bigquery-setup
```

#### Option A: Using BigQuery Console
1. Open each `.sql` file in order (01, 02, 03, etc.)
2. Replace `chapter-448015` with your `PROJECT_ID` in each file
3. Run in BigQuery console

#### Option B: Using Command Line
```bash
# Set your project ID
export PROJECT_ID="your-project-id"

# Run each file (replace chapter-448015 with your PROJECT_ID first)
bq query --use_legacy_sql=false < 01_create_teams.sql
bq query --use_legacy_sql=false < 02_create_campaigns.sql
bq query --use_legacy_sql=false < 03_create_actions.sql
bq query --use_legacy_sql=false < 04_create_lists.sql
bq query --use_legacy_sql=false < 05_create_leader_hierarchy.sql
bq query --use_legacy_sql=false < 06_create_organizer_mapping.sql

# Optional: Load sample data
bq query --use_legacy_sql=false < seed_data.sql
```

**Files to run:**
1. `01_create_teams.sql` - Team management tables
2. `02_create_campaigns.sql` - Campaign tracking
3. `03_create_actions.sql` - Action templates
4. `04_create_lists.sql` - Organizer lists
5. `05_create_leader_hierarchy.sql` - Leader hierarchy
6. `06_create_organizer_mapping.sql` - Organizer mapping
7. `seed_data.sql` (optional) - Sample campaign data

### 4. Configure Environment Variables

#### Update `server/.env`
```bash
REACT_APP_API_URL=http://localhost:3003/api
PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
PORT=3003
MOCK_USER_EMAIL=your-email@example.com
```

#### Update `src/.env`
```bash
REACT_APP_API_URL=http://localhost:3003/api
PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
PORT=3003
```

#### Add Service Account Credentials
Place your downloaded service account JSON file at:
```
server/credentials.json
```

⚠️ **Important:** This file is gitignored for security. You'll need to add it manually on each deployment.

### 5. Update Configuration Files

#### `server/index.js`
Update these values:
- **Line 9:** `PROJECT_ID` default value (though it reads from .env)
- **Line 10:** `DATASET_ID` (if not using 'lumoviz')
- **Lines 14-21:** `ADMIN_EMAILS` array with your admin email addresses
- **Lines 33-36:** CORS `origin` array with your domain(s)

Example:
```javascript
const PROJECT_ID = process.env.PROJECT_ID || 'your-project-id';
const DATASET_ID = 'lumoviz';

const ADMIN_EMAILS = [
  'admin1@yourorg.org',
  'admin2@yourorg.org'
];

const corsOptions = {
  origin: [
    'https://yourapp.yourdomain.org',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  // ... rest of config
};
```

### 6. Install Dependencies

```bash
# Install root dependencies
npm install --legacy-peer-deps

# Install server dependencies
cd server
npm install
cd ..
```

### 7. Test Locally

```bash
# Run both frontend and backend
npm run dev
```

This starts:
- Frontend: http://localhost:3000
- Backend: http://localhost:3003

Verify the server is running:
```bash
curl http://localhost:3003/api/health
```

### 8. Verify BigQuery Connection

```bash
cd server
node check-access.js
```

This will verify that your service account can access BigQuery.

## Quick Reference: Files to Update

| File | What to Change |
|------|----------------|
| `server/.env` | `PROJECT_ID`, `MOCK_USER_EMAIL` |
| `src/.env` | `PROJECT_ID` |
| `server/index.js` | `ADMIN_EMAILS`, CORS origins |
| `server/credentials.json` | Add your service account JSON |
| All SQL files | Replace `chapter-448015` with your `PROJECT_ID` |

## Troubleshooting

### BigQuery Access Issues
1. Check service account has correct roles
2. Verify `GOOGLE_APPLICATION_CREDENTIALS` path is correct
3. Run `node check-access.js` in server folder

### Connection Issues
1. Check `.env` files have correct values
2. Verify `PROJECT_ID` matches everywhere
3. Check CORS settings allow your domain

### Missing Tables
1. Verify all 6 setup SQL files were run
2. Check `lumoviz` dataset exists in BigQuery
3. Ensure core data tables (contacts, etc.) exist

## Next Steps

After local testing works:
- Review cloud deployment documentation in `README.md`
- Set up GitHub Actions for CI/CD (optional)
- Configure domain and SSL (for production)
- Set up Identity-Aware Proxy (for authentication)

## Support

For issues or questions:
1. Check the main `README.md`
2. Review `bigquery-setup/README.md` for schema details
3. Check the archived migrations in `bigquery-setup/archive-old-migrations/` for historical context
