# PostgreSQL Schema Files

This directory contains the PostgreSQL schema for migrating from BigQuery.

## Files

- **00_MASTER_SCHEMA.sql** - Complete schema in one file (run this for fresh install)

## Quick Start

### Option 1: Run Master Schema (Recommended)

```bash
# Connect via Cloud SQL Proxy
psql "host=localhost port=5432 dbname=lumoviz user=lumoviz_app" -f 00_MASTER_SCHEMA.sql
```

### Option 2: Run Individual Files (if you want granular control)

Individual schema files coming soon if needed.

## Schema Differences from BigQuery

### Data Type Conversions

| BigQuery | PostgreSQL | Notes |
|----------|------------|-------|
| `STRING` | `VARCHAR(n)` or `TEXT` | Use TEXT for unlimited length |
| `INT64` | `INTEGER` or `BIGINT` | BIGINT for vanids > 2 billion |
| `FLOAT64` | `DOUBLE PRECISION` | - |
| `BOOL` | `BOOLEAN` | - |
| `DATE` | `DATE` | Same |
| `TIMESTAMP` | `TIMESTAMP WITH TIME ZONE` | Always use timezone-aware |
| `ARRAY<STRING>` | `TEXT[]` | PostgreSQL native arrays |
| `ARRAY<STRUCT<...>>` | `JSONB` | Use JSONB for complex structures |
| `JSON` | `JSONB` | JSONB is faster and indexable |

### Key Features

1. **Foreign Keys**: Enforced relationships between tables (BigQuery doesn't support this)
2. **Triggers**: Auto-update `updated_at` timestamps
3. **Indexes**: Optimized for common query patterns
4. **UUID Extension**: For generating unique IDs

## Connecting to Cloud SQL

### Local Development (Cloud SQL Proxy)

```bash
# Start proxy
./cloud-sql-proxy your-project:us-central1:lumoviz-db

# Connect with psql
psql "host=localhost port=5432 dbname=lumoviz user=lumoviz_app password=YOUR_PASSWORD"
```

### Production (Cloud Run)

Cloud Run automatically connects via Unix socket:
```javascript
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
});
```

## Schema Management

### View Current Schema

```sql
-- List all tables
\dt

-- Show table structure
\d lumoviz_teams

-- Show all indexes
\di
```

### Backup Schema

```bash
pg_dump -h localhost -U lumoviz_app -d lumoviz --schema-only > schema_backup.sql
```

### Backup Data

```bash
pg_dump -h localhost -U lumoviz_app -d lumoviz > full_backup.sql
```

## Performance

The schema includes indexes for common query patterns:
- Team lookups by chapter
- Meeting/conversation queries by organizer and date
- Campaign filtering by status and dates
- Contact searches by name and chapter

## Next Steps

After running the schema:
1. Run data migration script (see scripts/migrate-data.js)
2. Verify table counts match BigQuery
3. Test query performance
4. Update application code to use PostgreSQL

## Support

For questions about the schema or migration process, see:
- **docs/DATABASE_MIGRATION_PLAN.md** - Complete migration guide
- **docs/DATABASE_RECOMMENDATION.md** - Why PostgreSQL?
