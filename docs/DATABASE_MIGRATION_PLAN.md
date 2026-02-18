# Database Migration Plan: BigQuery → Cloud SQL (PostgreSQL)

## Overview
This document outlines the complete migration from BigQuery to Cloud SQL PostgreSQL to support 20 concurrent users with frequent edits.

---

## Phase 1: Cloud SQL Setup (Est. 2-3 hours)

### Step 1.1: Create Cloud SQL Instance

```bash
# Set your project
export PROJECT_ID="your-project-id"
export REGION="us-central1"
export INSTANCE_NAME="lumoviz-db"

# Create PostgreSQL instance
gcloud sql instances create $INSTANCE_NAME \
  --project=$PROJECT_ID \
  --database-version=POSTGRES_15 \
  --tier=db-n1-standard-2 \
  --region=$REGION \
  --storage-type=SSD \
  --storage-size=20GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=4 \
  --availability-type=regional \
  --network=default
```

**Instance sizing guide:**
- `db-n1-standard-1` (1 vCPU, 3.75 GB) - ~$50/month - Good for testing
- `db-n1-standard-2` (2 vCPU, 7.5 GB) - ~$100/month - **Recommended for 20 users**
- `db-n1-standard-4` (4 vCPU, 15 GB) - ~$200/month - If you need headroom

### Step 1.2: Create Database and User

```bash
# Create database
gcloud sql databases create lumoviz --instance=$INSTANCE_NAME

# Create application user
gcloud sql users create lumoviz_app \
  --instance=$INSTANCE_NAME \
  --password=CHANGE_ME_STRONG_PASSWORD

# Get connection name (needed for Cloud SQL Proxy)
gcloud sql instances describe $INSTANCE_NAME --format="value(connectionName)"
```

### Step 1.3: Enable Cloud SQL Admin API

```bash
gcloud services enable sqladmin.googleapis.com --project=$PROJECT_ID
```

---

## Phase 2: Schema Migration (Est. 2-4 hours)

### Step 2.1: Convert BigQuery Schema to PostgreSQL

I've created PostgreSQL schema files based on your BigQuery setup. The key differences:

**BigQuery → PostgreSQL Changes:**
- `STRING` → `VARCHAR` or `TEXT`
- `INT64` → `INTEGER` or `BIGINT`
- `BOOL` → `BOOLEAN`
- `ARRAY<STRING>` → `TEXT[]` (PostgreSQL array)
- `ARRAY<STRUCT<...>>` → `JSONB` (for complex nested data)
- `TIMESTAMP` → `TIMESTAMP WITH TIME ZONE`
- `DATE` → `DATE` (same)

### Step 2.2: Connect to Cloud SQL

**Option A: Cloud SQL Proxy (recommended for local development)**
```bash
# Download Cloud SQL Proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy

# Start proxy (replace with your connection name)
./cloud-sql-proxy your-project-id:us-central1:lumoviz-db
```

**Option B: Direct connection (if using authorized networks)**
```bash
# Get the public IP
gcloud sql instances describe $INSTANCE_NAME --format="value(ipAddresses[0].ipAddress)"

# Connect via psql
psql "host=PUBLIC_IP port=5432 dbname=lumoviz user=lumoviz_app password=YOUR_PASSWORD sslmode=require"
```

### Step 2.3: Run Schema Creation Scripts

I'll create these in the next step. The order is:

1. `postgres-schema/01_create_teams.sql`
2. `postgres-schema/02_create_campaigns.sql`
3. `postgres-schema/03_create_actions.sql`
4. `postgres-schema/04_create_lists.sql`
5. `postgres-schema/05_create_contacts.sql`
6. `postgres-schema/06_create_meetings.sql`
7. `postgres-schema/07_create_leader_hierarchy.sql`
8. `postgres-schema/08_create_organizer_mapping.sql`
9. `postgres-schema/09_create_source_tables.sql` (contacts, conversations, org_ids)
10. `postgres-schema/10_create_indexes.sql` (performance optimization)

---

## Phase 3: Data Migration (Est. 3-6 hours)

### Step 3.1: Export Data from BigQuery

```bash
# Create a GCS bucket for export
export BUCKET_NAME="${PROJECT_ID}-lumoviz-migration"
gsutil mb -p $PROJECT_ID -l $REGION gs://$BUCKET_NAME/

# Export each table to GCS (JSON format)
export DATASET="lumoviz"

# List of tables to export
TABLES=(
  "lumoviz_teams"
  "lumoviz_team_changelog"
  "lumoviz_team_members"
  "lumoviz_campaigns"
  "lumoviz_campaign_goals"
  "lumoviz_campaign_milestones"
  "lumoviz_actions"
  "lumoviz_lists"
  "lumoviz_contacts"
  "lumoviz_meetings"
  "lumoviz_leader_hierarchy"
  "lumoviz_organizer_mapping"
  "contacts"
  "conversations"
  "org_ids"
)

for TABLE in "${TABLES[@]}"; do
  bq extract \
    --destination_format=NEWLINE_DELIMITED_JSON \
    "$PROJECT_ID:$DATASET.$TABLE" \
    "gs://$BUCKET_NAME/export/$TABLE/*.json"
done
```

### Step 3.2: Transform and Import to PostgreSQL

Create a migration script `scripts/migrate-bigquery-to-postgres.js`:

```javascript
// This will handle:
// 1. Download JSON files from GCS
// 2. Transform data (arrays, timestamps, etc.)
// 3. Bulk insert into PostgreSQL
// 4. Validate row counts match
```

### Step 3.3: Verify Data Integrity

```sql
-- Run these checks on PostgreSQL
SELECT 'lumoviz_teams' as table_name, COUNT(*) as row_count FROM lumoviz_teams
UNION ALL
SELECT 'lumoviz_campaigns', COUNT(*) FROM lumoviz_campaigns
UNION ALL
SELECT 'lumoviz_actions', COUNT(*) FROM lumoviz_actions
-- ... (compare with BigQuery counts)
```

---

## Phase 4: Application Code Changes (Est. 4-8 hours)

### Step 4.1: Add PostgreSQL Dependencies

```bash
cd server
npm install pg
```

### Step 4.2: Update server/index.js

**Replace BigQuery client with PostgreSQL:**

```javascript
// OLD:
const { BigQuery } = require('@google-cloud/bigquery');
const bigquery = new BigQuery({...});

// NEW:
const { Pool } = require('pg');

// For Cloud Run (using Unix socket)
const pool = process.env.NODE_ENV === 'production'
  ? new Pool({
      user: process.env.DB_USER || 'lumoviz_app',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'lumoviz',
      host: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
    })
  : new Pool({
      // Local development via Cloud SQL Proxy
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'lumoviz_app',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'lumoviz',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
```

### Step 4.3: Convert Queries

**BigQuery parameterized queries:**
```javascript
// OLD
const [rows] = await bigquery.query({
  query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.lumoviz_teams\` WHERE chapter = @chapter`,
  params: { chapter: 'Durham' }
});
```

**PostgreSQL parameterized queries:**
```javascript
// NEW
const result = await pool.query(
  'SELECT * FROM lumoviz_teams WHERE chapter = $1',
  ['Durham']
);
const rows = result.rows;
```

**Key query conversion patterns:**
- Backticks → Regular quotes: `` `table` `` → `"table"`
- Parameters: `@param` → `$1, $2, $3`
- Arrays: `UNNEST(@ids)` → `= ANY($1::text[])`
- Date functions: `DATE(field)` → `field::date`
- String concat: `CONCAT(a, b)` → `a || b`
- CURRENT_TIMESTAMP() → `CURRENT_TIMESTAMP`

### Step 4.4: Update Environment Variables

```bash
# server/.env (local development)
DB_HOST=localhost
DB_PORT=5432
DB_USER=lumoviz_app
DB_PASSWORD=your_password
DB_NAME=lumoviz

# For Cloud Run, set these secrets:
INSTANCE_CONNECTION_NAME=your-project:us-central1:lumoviz-db
```

---

## Phase 5: Testing (Est. 4-6 hours)

### Step 5.1: Local Testing Checklist

- [ ] Start Cloud SQL Proxy
- [ ] Update server/.env with local DB credentials
- [ ] Run `npm run dev`
- [ ] Test each feature:
  - [ ] View teams, add/edit teams
  - [ ] View people, add conversations
  - [ ] Campaign creation and tracking
  - [ ] Actions and lists
  - [ ] Person mapping
  - [ ] Date range filtering
  - [ ] Chapter filtering
  - [ ] Network graph rendering
  - [ ] Export/download features

### Step 5.2: Load Testing

```bash
# Install artillery
npm install -g artillery

# Create load test (20 concurrent users)
artillery quick --count 20 --num 100 http://localhost:3003/api/teams
```

### Step 5.3: Concurrent Edit Testing

Simulate 10+ users editing the same team simultaneously to verify locking works correctly.

---

## Phase 6: Deployment (Est. 2-3 hours)

### Step 6.1: Update Dockerfile

No changes needed! Cloud SQL connection works with existing Dockerfile.

### Step 6.2: Configure Cloud Run Service

```bash
# Grant Cloud Run service account access to Cloud SQL
export SERVICE_ACCOUNT="network-graph-app@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudsql.client"
```

### Step 6.3: Update GitHub Actions Deployment

**.github/workflows/deploy.yml:**

```yaml
- name: Deploy to Cloud Run
  uses: google-github-actions/deploy-cloudrun@v2
  with:
    service: ${{ env.SERVICE_NAME }}
    region: ${{ env.REGION }}
    image: gcr.io/${{ env.PROJECT_ID }}/${{ env.SERVICE_NAME }}:${{ github.sha }}
    
    # ADD THESE LINES:
    flags: |
      --add-cloudsql-instances=${{ env.PROJECT_ID }}:${{ env.REGION }}:lumoviz-db
      --set-env-vars=DB_NAME=lumoviz,DB_USER=lumoviz_app,INSTANCE_CONNECTION_NAME=${{ env.PROJECT_ID }}:${{ env.REGION }}:lumoviz-db
      --set-secrets=DB_PASSWORD=lumoviz-db-password:latest
      --ingress=internal-and-cloud-load-balancing
      --allow-unauthenticated
```

### Step 6.4: Create Secret for DB Password

```bash
# Create secret in Secret Manager
echo -n "your_strong_password" | gcloud secrets create lumoviz-db-password \
  --data-file=- \
  --replication-policy=automatic

# Grant Cloud Run service account access to secret
gcloud secrets add-iam-policy-binding lumoviz-db-password \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

### Step 6.5: Deploy

```bash
# Push to main branch
git add .
git commit -m "Migrate from BigQuery to Cloud SQL PostgreSQL"
git push origin main

# GitHub Actions will automatically deploy
```

---

## Phase 7: Monitoring & Optimization (Ongoing)

### Step 7.1: Enable Cloud SQL Insights

```bash
gcloud sql instances patch $INSTANCE_NAME --insights-config-query-insights-enabled
```

### Step 7.2: Set up Alerts

- Query performance (slow queries > 1s)
- Connection count (> 80% of max)
- CPU usage (> 80%)
- Storage usage (> 85%)

### Step 7.3: Create Indexes for Performance

See `postgres-schema/10_create_indexes.sql` for optimized indexes based on your query patterns.

---

## Rollback Plan

If issues arise during migration:

1. **Keep BigQuery running** until Cloud SQL is fully validated
2. **Feature flag**: Add environment variable to switch between BigQuery and PostgreSQL
3. **Quick rollback**: Revert git commit and redeploy

---

## Cost Comparison

| Service | Current (BigQuery) | New (Cloud SQL) |
|---------|-------------------|-----------------|
| **Database** | ~$50-200/month (depending on query volume) | ~$100/month (db-n1-standard-2) |
| **Storage** | $0.02/GB/month | Included in instance |
| **Queries** | $5 per TB scanned | Unlimited |
| **Backups** | Included | Included (7 days retention) |
| **Total Estimate** | $50-200/month | ~$100-120/month |

**Additional benefits:**
- Predictable costs (no per-query charges)
- Much better performance for transactional workloads
- Support for concurrent editing

---

## Timeline Summary

| Phase | Estimated Time | Can Parallelize? |
|-------|----------------|------------------|
| Cloud SQL Setup | 2-3 hours | No |
| Schema Migration | 2-4 hours | No |
| Data Migration | 3-6 hours | No |
| Code Changes | 4-8 hours | Yes (with schema work) |
| Testing | 4-6 hours | Partially |
| Deployment | 2-3 hours | No |
| **Total** | **17-30 hours** | - |

**Recommended approach:**
- Week 1: Setup + Schema Migration (work in `postgres-migration` branch)
- Week 2: Data Migration + Code Changes + Local Testing
- Week 3: Deploy to staging, extensive testing, then production

---

## Next Steps

1. Review and approve this plan
2. I'll create the PostgreSQL schema files
3. I'll create the data migration scripts
4. I'll update the application code
5. Run through testing checklist
6. Deploy to production

Would you like me to proceed with creating the schema files and migration scripts?
