# Database Migration Quick Start Guide

Ready to migrate from BigQuery to PostgreSQL? Follow this step-by-step guide.

---

## ⚡ TL;DR

**Problem**: BigQuery can't handle 20 concurrent editors  
**Solution**: Migrate to Cloud SQL PostgreSQL  
**Time**: 1-2 weeks  
**Cost**: ~$107/month (predictable)  
**Risk**: Low (we can roll back anytime)

---

## 📋 Prerequisites

- [ ] Google Cloud Project with billing enabled
- [ ] `gcloud` CLI installed and authenticated
- [ ] PostgreSQL client (`psql`) installed
- [ ] Node.js and npm installed locally
- [ ] Access to Lumoviz codebase

---

## 🚀 Step 1: Create Cloud SQL Instance (30 minutes)

### 1.1 Set environment variables

```bash
export PROJECT_ID="your-project-id"
export REGION="us-central1"
export INSTANCE_NAME="lumoviz-db"
export DB_PASSWORD="$(openssl rand -base64 32)"  # Generate strong password

# Save password for later
echo "DB Password: $DB_PASSWORD" > ~/lumoviz-db-password.txt
chmod 600 ~/lumoviz-db-password.txt
```

### 1.2 Create the instance

```bash
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
  --availability-type=zonal \
  --network=default

# This takes 5-10 minutes
```

### 1.3 Create database and user

```bash
# Create database
gcloud sql databases create lumoviz --instance=$INSTANCE_NAME

# Create application user
gcloud sql users create lumoviz_app \
  --instance=$INSTANCE_NAME \
  --password="$DB_PASSWORD"

# Get connection name (save this!)
export CONNECTION_NAME=$(gcloud sql instances describe $INSTANCE_NAME --format="value(connectionName)")
echo "Connection name: $CONNECTION_NAME"
```

**✅ Checkpoint**: You should have:
- Cloud SQL instance running
- `lumoviz` database created
- `lumoviz_app` user created
- Connection name saved

---

## 🗄️ Step 2: Set Up Schema (20 minutes)

### 2.1 Download Cloud SQL Proxy

```bash
# For macOS (Apple Silicon)
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64

# For macOS (Intel)
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.amd64

# For Linux
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.linux.amd64

chmod +x cloud-sql-proxy
```

### 2.2 Start Cloud SQL Proxy

```bash
# In a new terminal window, run:
./cloud-sql-proxy $CONNECTION_NAME
# Keep this running
```

### 2.3 Run schema setup

```bash
# In another terminal, navigate to your project
cd /Users/maggiehughes/Desktop/MLD\ 377\ 2026/lumoviz

# Connect and run schema
psql "host=localhost port=5432 dbname=lumoviz user=lumoviz_app password=$DB_PASSWORD" \
  -f postgres-schema/00_MASTER_SCHEMA.sql
```

**✅ Checkpoint**: All tables created successfully

---

## 📊 Step 3: Export Data from BigQuery (1-2 hours)

### 3.1 Create GCS bucket

```bash
export BUCKET_NAME="${PROJECT_ID}-lumoviz-migration"
gsutil mb -p $PROJECT_ID -l $REGION gs://$BUCKET_NAME/
```

### 3.2 Export BigQuery tables

```bash
export DATASET="lumoviz"

# Export each application table
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
)

for TABLE in "${TABLES[@]}"; do
  echo "Exporting $TABLE..."
  bq extract \
    --destination_format=NEWLINE_DELIMITED_JSON \
    "$PROJECT_ID:$DATASET.$TABLE" \
    "gs://$BUCKET_NAME/export/$TABLE/*.json"
done

# Also export source tables if you want to migrate them
SOURCE_TABLES=("contacts" "conversations" "org_ids")
for TABLE in "${SOURCE_TABLES[@]}"; do
  echo "Exporting source table: $TABLE..."
  bq extract \
    --destination_format=NEWLINE_DELIMITED_JSON \
    "$PROJECT_ID:$DATASET.$TABLE" \
    "gs://$BUCKET_NAME/export/$TABLE/*.json"
done
```

### 3.3 Download and import data

For now, let's do a simple test with one table:

```bash
# Download one table as example
gsutil cp gs://$BUCKET_NAME/export/lumoviz_teams/*.json /tmp/teams.json

# Import to PostgreSQL (we'll create a proper script for this)
# For now, you can use \copy or a Node.js script
```

**✅ Checkpoint**: Data exported from BigQuery to Cloud Storage

---

## 💻 Step 4: Update Application Code (2-4 hours)

### 4.1 Install PostgreSQL client

```bash
cd server
npm install pg
```

### 4.2 Create new database config

Create `server/db.js`:

```javascript
const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

const pool = isProduction
  ? new Pool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      host: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

module.exports = pool;
```

### 4.3 Update environment variables

Create `server/.env.local`:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=lumoviz_app
DB_PASSWORD=your_password_here
DB_NAME=lumoviz
INSTANCE_CONNECTION_NAME=your-project:us-central1:lumoviz-db
```

### 4.4 Convert queries

**Example conversion in `server/index.js`:**

```javascript
// OLD (BigQuery)
const [rows] = await bigquery.query({
  query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.lumoviz_teams\` WHERE chapter = @chapter`,
  params: { chapter: req.query.chapter }
});

// NEW (PostgreSQL)
const pool = require('./db');
const result = await pool.query(
  'SELECT * FROM lumoviz_teams WHERE chapter = $1',
  [req.query.chapter]
);
const rows = result.rows;
```

**✅ Checkpoint**: Application runs locally with PostgreSQL

---

## 🧪 Step 5: Test Locally (2-3 hours)

### 5.1 Start development servers

```bash
# Terminal 1: Cloud SQL Proxy (keep running)
./cloud-sql-proxy $CONNECTION_NAME

# Terminal 2: Backend
cd server
npm run dev

# Terminal 3: Frontend
npm start
```

### 5.2 Testing checklist

- [ ] View teams list
- [ ] Add a new team
- [ ] Edit team details
- [ ] View people/contacts
- [ ] Add a conversation/meeting
- [ ] View campaigns
- [ ] Create an action
- [ ] Test date range filtering
- [ ] Test chapter filtering
- [ ] Check network graph renders

### 5.3 Load testing

```bash
# Install artillery
npm install -g artillery

# Test 20 concurrent users
artillery quick --count 20 --num 50 http://localhost:3003/api/teams
```

**✅ Checkpoint**: All features work locally with PostgreSQL

---

## 🚢 Step 6: Deploy to Production (1-2 hours)

### 6.1 Store password in Secret Manager

```bash
echo -n "$DB_PASSWORD" | gcloud secrets create lumoviz-db-password \
  --data-file=- \
  --replication-policy=automatic

# Grant access to Cloud Run service account
export SERVICE_ACCOUNT="network-graph-app@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud secrets add-iam-policy-binding lumoviz-db-password \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

# Grant Cloud SQL access
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudsql.client"
```

### 6.2 Update GitHub Actions workflow

Edit `.github/workflows/deploy.yml`:

```yaml
- name: Deploy to Cloud Run
  uses: google-github-actions/deploy-cloudrun@v2
  with:
    service: ${{ env.SERVICE_NAME }}
    region: ${{ env.REGION }}
    image: gcr.io/${{ env.PROJECT_ID }}/${{ env.SERVICE_NAME }}:${{ github.sha }}
    flags: |
      --add-cloudsql-instances=${{ env.PROJECT_ID }}:${{ env.REGION }}:lumoviz-db
      --set-env-vars=DB_NAME=lumoviz,DB_USER=lumoviz_app,INSTANCE_CONNECTION_NAME=${{ env.PROJECT_ID }}:${{ env.REGION }}:lumoviz-db
      --set-secrets=DB_PASSWORD=lumoviz-db-password:latest
      --ingress=internal-and-cloud-load-balancing
      --allow-unauthenticated
```

### 6.3 Deploy

```bash
git add .
git commit -m "Migrate from BigQuery to Cloud SQL PostgreSQL"
git push origin main

# GitHub Actions will automatically deploy
```

**✅ Checkpoint**: Application running in production with PostgreSQL

---

## 📈 Step 7: Monitor (48 hours)

### Enable Cloud SQL Insights

```bash
gcloud sql instances patch $INSTANCE_NAME \
  --insights-config-query-insights-enabled \
  --insights-config-query-string-length=1024 \
  --insights-config-record-application-tags \
  --insights-config-record-client-address
```

### Check metrics

1. Go to Cloud Console → SQL → lumoviz-db → Monitoring
2. Watch:
   - CPU usage (should be <30%)
   - Connection count (should be <50)
   - Query performance (most queries <50ms)

### Set up alerts

```bash
# Create alert for high CPU
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_CHANNEL_ID \
  --display-name="Cloud SQL High CPU" \
  --condition-display-name="CPU > 80%" \
  --condition-threshold-value=0.8 \
  --condition-threshold-duration=300s
```

**✅ Checkpoint**: Monitoring set up and system stable

---

## 🎉 You're Done!

Your application is now running on PostgreSQL with:
- ✅ 10-100x faster writes
- ✅ Support for 20+ concurrent editors
- ✅ Predictable costs (~$107/month)
- ✅ Full ACID transactions
- ✅ Better developer experience

---

## 🔙 Rollback Instructions (If Needed)

If something goes wrong:

1. **Immediate rollback** (code):
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Feature flag** (if implemented):
   ```javascript
   const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
   // Set to false in Cloud Run env vars
   ```

3. **BigQuery is still there**: Your old data is unchanged

---

## 📚 Detailed Documentation

For more information, see:
- **docs/DATABASE_MIGRATION_SUMMARY.md** - Complete overview
- **docs/DATABASE_MIGRATION_PLAN.md** - Detailed migration steps
- **docs/DATABASE_RECOMMENDATION.md** - Why PostgreSQL?
- **docs/BIGQUERY_TO_POSTGRES_QUERY_GUIDE.md** - Query conversions

---

## ❓ Need Help?

Common issues:

### Issue: Can't connect to Cloud SQL
**Solution**: Make sure Cloud SQL Proxy is running and you're using the correct connection name.

### Issue: Schema creation fails
**Solution**: Check that you have the correct permissions and database name.

### Issue: Queries are slow
**Solution**: Check that indexes were created (see end of 00_MASTER_SCHEMA.sql).

### Issue: Authentication errors
**Solution**: Verify DB_USER and DB_PASSWORD are correct.

---

## 🎯 Success Criteria

You'll know the migration was successful when:
- [ ] All endpoints return data correctly
- [ ] Write operations complete in <20ms
- [ ] No errors in Cloud Run logs
- [ ] Users can edit concurrently without conflicts
- [ ] Monitoring shows healthy metrics
- [ ] Costs are stable at ~$107/month

---

## Next Optimizations (Optional)

After migration stabilizes:

1. **Add High Availability**: `--availability-type=regional` (+$107/month)
2. **Add read replicas**: For read-heavy workloads
3. **Optimize indexes**: Based on query patterns from Insights
4. **Set up automated backups**: Beyond default 7 days
5. **Consider connection pooling**: PgBouncer for very high load

---

*Last updated: February 2026*  
*Questions? Check the docs/ folder or Cloud SQL documentation.*
