# Database Migration Summary

## Overview

This document summarizes the analysis and recommendations for migrating Lumoviz from BigQuery to a database that supports 20 concurrent users with frequent edits.

---

## Current State

### Architecture
- **Backend**: Node.js/Express with BigQuery client
- **Frontend**: React (TypeScript) + Material-UI  
- **Deployment**: Google Cloud Run (Docker container)
- **CI/CD**: GitHub Actions
- **Auth**: Identity-Aware Proxy (IAP)

### Database: BigQuery
**Tables:**
- **Source tables** (read-only): `contacts`, `conversations`, `org_ids`, `staff`, `user_map`
- **Application tables** (read/write): 
  - `lumoviz_teams`
  - `lumoviz_campaigns`
  - `lumoviz_actions`
  - `lumoviz_lists`
  - `lumoviz_meetings`
  - `lumoviz_organizer_mapping`
  - `lumoviz_contacts`
  - `lumoviz_team_members`
  - `lumoviz_campaign_goals`
  - `lumoviz_campaign_milestones`
  - `lumoviz_team_changelog`
  - `lumoviz_leader_hierarchy`

### Pain Points with BigQuery
1. ❌ **Slow writes**: 500-2000ms per write operation
2. ❌ **No row-level locking**: Concurrent edits cause conflicts
3. ❌ **No ACID transactions**: Data consistency issues
4. ❌ **Unpredictable costs**: Pay per query, charges add up
5. ❌ **Not designed for OLTP**: BigQuery is for analytics, not transactional apps

---

## Recommendation: Cloud SQL PostgreSQL

### Why PostgreSQL?

| Criterion | BigQuery | PostgreSQL | Winner |
|-----------|----------|------------|--------|
| **Write latency** | 500-2000ms | 5-15ms | PostgreSQL (100x faster) |
| **Concurrent edits** | ❌ No locking | ✅ Row-level locks | PostgreSQL |
| **ACID transactions** | ❌ Limited | ✅ Full support | PostgreSQL |
| **Cost** | $50-300/month (variable) | $107/month (fixed) | PostgreSQL |
| **Developer experience** | Good | Excellent | PostgreSQL |
| **Suitable for 20 users** | ❌ No | ✅ Yes | PostgreSQL |

### Instance Recommendation
- **Type**: `db-n1-standard-2`
- **Specs**: 2 vCPU, 7.5 GB RAM
- **Cost**: ~$107/month
- **Capacity**: 100+ concurrent users (plenty of headroom)
- **High Availability**: Optional +$107/month (recommended for production)

---

## Migration Deliverables

I've created the following resources for you:

### 1. Documentation
- ✅ **DATABASE_MIGRATION_PLAN.md** - Complete step-by-step migration guide
- ✅ **DATABASE_RECOMMENDATION.md** - Detailed analysis and cost comparison
- ✅ **BIGQUERY_TO_POSTGRES_QUERY_GUIDE.md** - Query conversion reference
- ✅ **This summary document**

### 2. Schema Files
- ✅ **postgres-schema/00_MASTER_SCHEMA.sql** - Complete PostgreSQL schema
- ✅ **postgres-schema/README.md** - Schema documentation

### 3. Migration Scripts (to be created)
- ⏳ Data export script (BigQuery → Cloud Storage → PostgreSQL)
- ⏳ Query conversion script (update server/index.js)
- ⏳ Testing checklist
- ⏳ Rollback procedures

---

## Migration Phases

### Phase 1: Setup (2-3 hours)
1. Create Cloud SQL PostgreSQL instance
2. Run schema creation scripts
3. Configure networking and IAM
4. Set up Cloud SQL Proxy for local development

### Phase 2: Schema Migration (2-4 hours)
1. Review and run PostgreSQL schema
2. Verify all tables and indexes created
3. Set up triggers for auto-updating timestamps

### Phase 3: Data Migration (3-6 hours)
1. Export data from BigQuery to Cloud Storage (JSON format)
2. Transform data (arrays, timestamps, etc.)
3. Bulk import to PostgreSQL
4. Validate row counts and relationships

### Phase 4: Code Changes (4-8 hours)
1. Replace BigQuery client with `pg` library
2. Convert all queries (parameter syntax, table names)
3. Update connection configuration
4. Add environment variables for DB credentials

### Phase 5: Testing (4-6 hours)
1. Local testing with Cloud SQL Proxy
2. Load testing (20 concurrent users)
3. Concurrent edit testing
4. Performance validation

### Phase 6: Deployment (2-3 hours)
1. Update Cloud Run configuration (add Cloud SQL instance)
2. Store DB password in Secret Manager
3. Deploy via GitHub Actions
4. Monitor for 48 hours

### Phase 7: Validation & Monitoring (ongoing)
1. Enable Cloud SQL Insights
2. Set up performance alerts
3. Monitor query performance
4. Validate with users

**Total Estimated Time: 17-30 hours** (1-2 weeks with testing)

---

## Key Technical Changes

### Database Client

**Before (BigQuery):**
```javascript
const { BigQuery } = require('@google-cloud/bigquery');
const bigquery = new BigQuery({
  projectId: PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});
```

**After (PostgreSQL):**
```javascript
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST || '/cloudsql/PROJECT:REGION:INSTANCE',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
```

### Query Pattern

**Before (BigQuery):**
```javascript
const [rows] = await bigquery.query({
  query: `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.lumoviz_teams\` WHERE chapter = @chapter`,
  params: { chapter: 'Durham' }
});
```

**After (PostgreSQL):**
```javascript
const result = await pool.query(
  'SELECT * FROM lumoviz_teams WHERE chapter = $1',
  ['Durham']
);
const rows = result.rows;
```

### Main Conversion Patterns
1. Table names: `` `project.dataset.table` `` → `table`
2. Parameters: `@param` → `$1, $2, $3`
3. Parameter values: `{key: value}` → `[value1, value2]`
4. Result access: `[rows]` → `result.rows`
5. Arrays: `IN UNNEST(array)` → `= ANY(array)`
6. Timestamps: `CURRENT_TIMESTAMP()` → `CURRENT_TIMESTAMP`

---

## Costs

### Current (BigQuery)
- **Queries**: $5 per TB scanned
- **Storage**: $0.02/GB/month  
- **Estimated**: $50-300/month (highly variable)

### Proposed (Cloud SQL PostgreSQL)
- **Instance (db-n1-standard-2)**: $106.17/month
- **Storage (20 GB SSD)**: Included
- **Backups (7 days)**: Included
- **High Availability (optional)**: +$106.17/month
- **Total**: ~$107-213/month (predictable)

### Cost Comparison
For 20 concurrent users with frequent writes, PostgreSQL will likely be:
- ✅ **More predictable** (fixed monthly cost)
- ✅ **Cheaper at scale** (no per-query charges)
- ✅ **Better value** (10-100x faster performance)

---

## Risks & Mitigation

### Low Risks ✅
- **Query compatibility** → 95% of SQL is identical
- **Data loss** → Export validation and checksums
- **Deployment** → Well-documented Cloud Run integration

### Medium Risks ⚠️
- **Migration downtime** → Mitigation: Feature flags, keep BigQuery running initially
- **Unforeseen query issues** → Mitigation: Comprehensive testing phase
- **Team learning curve** → Mitigation: PostgreSQL is more standard, easier to find help

### High Risks ❌
**None identified.** This is a common, well-documented migration path.

---

## Rollback Plan

If something goes wrong:

1. **Immediate rollback**: Use feature flag to switch back to BigQuery
2. **Code rollback**: Revert git commit, redeploy via GitHub Actions
3. **Data rollback**: Keep BigQuery running for 1 week as backup
4. **No data loss**: All data remains in BigQuery during migration

---

## Timeline Options

### Option 1: Full Phased Approach (4-5 weeks)
- Week 1: Setup + Schema Migration
- Week 2-3: Code Changes + Testing
- Week 4: Staging deployment + UAT
- Week 5: Production deployment
- **Risk Level**: Low
- **Recommended for**: Production systems with high uptime requirements

### Option 2: Fast-Track (1-2 weeks)
- Week 1: Setup + Schema + Code + Local Testing
- Week 2: Production deployment + monitoring
- **Risk Level**: Medium
- **Recommended for**: Faster time-to-market, lower stakes

---

## Success Metrics

After migration, you should see:

### Performance
- ✅ Write latency: <20ms (vs 500-2000ms before)
- ✅ Read latency: <10ms (vs 100-500ms before)
- ✅ Page load times: 2-5x faster
- ✅ No concurrent edit conflicts

### Cost
- ✅ Predictable monthly cost (~$107/month)
- ✅ No surprise query charges
- ✅ Better cost/performance ratio

### Developer Experience
- ✅ Faster local development (Cloud SQL Proxy)
- ✅ Standard PostgreSQL tooling
- ✅ Better debugging with psql
- ✅ Full ACID transactions

### User Experience
- ✅ Instant saves (no lag)
- ✅ No conflicts from concurrent editing
- ✅ More reliable application

---

## Next Steps

### Immediate (this week)
1. **Review these documents** with your team
2. **Approve the migration plan**
3. **Set timeline** (phased vs fast-track)

### Week 1
1. **Create Cloud SQL instance**
   ```bash
   gcloud sql instances create lumoviz-db \
     --database-version=POSTGRES_15 \
     --tier=db-n1-standard-2 \
     --region=us-central1
   ```

2. **Run schema scripts**
   ```bash
   psql -f postgres-schema/00_MASTER_SCHEMA.sql
   ```

3. **Start code conversion** in a new git branch

### Week 2-3
1. **Migrate data** from BigQuery to PostgreSQL
2. **Test locally** with Cloud SQL Proxy
3. **Load testing** (simulate 20 concurrent users)
4. **Fix any issues** found during testing

### Week 4-5
1. **Deploy to staging** (if applicable)
2. **User acceptance testing**
3. **Production deployment** (scheduled maintenance window)
4. **Monitor closely** for 48-72 hours

---

## Questions?

### Q: Can we keep BigQuery for analytics?
**A:** Yes! You can run both. PostgreSQL for the app, BigQuery for reporting/analytics. Set up nightly exports if needed.

### Q: What if we need to roll back?
**A:** Use feature flags to switch between BigQuery and PostgreSQL instantly. Keep both running initially.

### Q: Do we need to change the frontend?
**A:** No changes needed. This is a backend-only migration.

### Q: Can we scale beyond 20 users?
**A:** Absolutely. PostgreSQL on db-n1-standard-2 can handle 100+ concurrent users. Easy to scale up.

### Q: How much downtime?
**A:** With feature flags: Zero downtime. Without: 2-4 hour maintenance window for final data migration.

---

## Support Resources

- **Migration Plan**: docs/DATABASE_MIGRATION_PLAN.md
- **Recommendation**: docs/DATABASE_RECOMMENDATION.md
- **Query Guide**: docs/BIGQUERY_TO_POSTGRES_QUERY_GUIDE.md
- **Schema Files**: postgres-schema/
- **Google Cloud SQL Docs**: https://cloud.google.com/sql/docs/postgres
- **PostgreSQL Docs**: https://www.postgresql.org/docs/

---

## Decision Time

**You have three options:**

### ✅ Option A: Proceed with Full Migration (Recommended)
- **Timeline**: 4-5 weeks
- **Risk**: Low
- **Outcome**: Production-ready PostgreSQL database with full testing

### ⚡ Option B: Fast-Track Migration
- **Timeline**: 1-2 weeks
- **Risk**: Medium
- **Outcome**: Faster deployment, less comprehensive testing

### ⏸️ Option C: Stay with BigQuery (Not Recommended)
- **Timeline**: No change
- **Risk**: High (performance issues, concurrent edit conflicts)
- **Outcome**: Continue with suboptimal database for your use case

---

## My Recommendation

**Proceed with Option A: Full Migration to Cloud SQL PostgreSQL**

**Why:**
1. BigQuery is fundamentally wrong tool for your use case
2. 20 concurrent users WILL experience issues with BigQuery
3. PostgreSQL will be 10-100x faster for writes
4. Cost is predictable and reasonable (~$107/month)
5. Migration risk is low with proper testing

**I'm ready to help you execute this migration. Should I proceed with creating the data migration scripts and updating the application code?**

---

*Document created: February 2026*
*Next review: After phase 1 completion*
