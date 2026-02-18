# BigQuery to PostgreSQL Query Conversion Guide

This guide helps you convert BigQuery SQL queries to PostgreSQL syntax for the Lumoviz migration.

---

## Quick Reference

| Feature | BigQuery | PostgreSQL |
|---------|----------|------------|
| **Table names** | `` `project.dataset.table` `` | `"schema"."table"` or just `table` |
| **Parameters** | `@param` | `$1, $2, $3` |
| **String concat** | `CONCAT(a, b)` | `a || b` or `CONCAT(a, b)` |
| **Current time** | `CURRENT_TIMESTAMP()` | `CURRENT_TIMESTAMP` (no parens) |
| **Date casting** | `DATE(timestamp)` | `timestamp::date` |
| **Arrays** | `ARRAY<STRING>` | `TEXT[]` |
| **Array contains** | `value IN UNNEST(array)` | `value = ANY(array)` |
| **JSON** | `JSON_EXTRACT()` | `->`, `->>`, `#>`, `#>>` |
| **Comments** | `OPTIONS (description = '...')` | `COMMENT ON TABLE/COLUMN` |

---

## 1. Table Naming

### BigQuery
```sql
SELECT * FROM `project-id.dataset.table_name`
```

### PostgreSQL
```sql
SELECT * FROM table_name
-- or with schema
SELECT * FROM public.table_name
```

**Conversion:** Remove project and dataset prefixes, use simple table names.

---

## 2. Parameterized Queries

### BigQuery (with @google-cloud/bigquery)
```javascript
const [rows] = await bigquery.query({
  query: `
    SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.lumoviz_teams\`
    WHERE chapter = @chapter
      AND date_created >= @start_date
  `,
  params: {
    chapter: 'Durham',
    start_date: '2024-01-01'
  }
});
```

### PostgreSQL (with pg)
```javascript
const result = await pool.query(
  `SELECT * FROM lumoviz_teams
   WHERE chapter = $1
     AND date_created >= $2`,
  ['Durham', '2024-01-01']
);
const rows = result.rows;
```

**Key differences:**
- Named parameters (`@chapter`) → Positional parameters (`$1, $2, $3`)
- Parameters passed as object → Parameters passed as array
- Result is nested in BigQuery (`[rows]`) → Direct access in PostgreSQL (`.rows`)

---

## 3. String Operations

### Concatenation

**BigQuery:**
```sql
CONCAT(firstname, ' ', lastname)
-- or
firstname || ' ' || lastname
```

**PostgreSQL:** (same, both work)
```sql
CONCAT(firstname, ' ', lastname)
-- or
firstname || ' ' || lastname
```

### Null-safe concatenation

**BigQuery:**
```sql
CONCAT(COALESCE(firstname, ''), ' ', COALESCE(lastname, ''))
```

**PostgreSQL:** (same)
```sql
CONCAT(COALESCE(firstname, ''), ' ', COALESCE(lastname, ''))
```

---

## 4. Date and Time Functions

### Current timestamp

**BigQuery:**
```sql
CURRENT_TIMESTAMP()
CURRENT_DATE()
```

**PostgreSQL:**
```sql
CURRENT_TIMESTAMP  -- no parentheses
CURRENT_DATE
NOW()  -- also works
```

### Date casting

**BigQuery:**
```sql
DATE(timestamp_column)
```

**PostgreSQL:**
```sql
timestamp_column::date
-- or
CAST(timestamp_column AS date)
```

### Date arithmetic

**BigQuery:**
```sql
DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY)
DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH)
```

**PostgreSQL:**
```sql
CURRENT_DATE + INTERVAL '7 days'
CURRENT_DATE - INTERVAL '1 month'
```

### Date truncation

**BigQuery:**
```sql
DATE_TRUNC(date_column, WEEK)
DATE_TRUNC(date_column, MONTH)
```

**PostgreSQL:**
```sql
DATE_TRUNC('week', date_column)
DATE_TRUNC('month', date_column)
```

### Date formatting

**BigQuery:**
```sql
FORMAT_DATE("%Y-%m-%d", date_column)
```

**PostgreSQL:**
```sql
TO_CHAR(date_column, 'YYYY-MM-DD')
```

---

## 5. Array Operations

### Array declaration

**BigQuery:**
```sql
CREATE TABLE t (
  chapters ARRAY<STRING>
);
```

**PostgreSQL:**
```sql
CREATE TABLE t (
  chapters TEXT[]
);
```

### Array contains

**BigQuery:**
```sql
WHERE 'Durham' IN UNNEST(chapters)
```

**PostgreSQL:**
```sql
WHERE 'Durham' = ANY(chapters)
```

### Array aggregation

**BigQuery:**
```sql
ARRAY_AGG(column_name)
```

**PostgreSQL:** (same)
```sql
ARRAY_AGG(column_name)
```

---

## 6. JSON Operations

### JSON column type

**BigQuery:**
```sql
CREATE TABLE t (
  data JSON
);
```

**PostgreSQL:**
```sql
CREATE TABLE t (
  data JSONB  -- use JSONB, not JSON (faster and indexable)
);
```

### JSON extraction

**BigQuery:**
```sql
JSON_EXTRACT(json_column, '$.key')
JSON_VALUE(json_column, '$.key')
```

**PostgreSQL:**
```sql
json_column->'key'           -- returns JSON
json_column->>'key'          -- returns text
json_column#>'{nested,key}'  -- nested path, returns JSON
json_column#>>'{nested,key}' -- nested path, returns text
```

---

## 7. Struct to JSONB Conversion

### BigQuery STRUCT

**BigQuery:**
```sql
CREATE TABLE actions (
  progress_steps ARRAY<STRUCT<
    step_id STRING,
    step_name STRING,
    step_order INT64
  >>
);

-- Insert
INSERT INTO actions (progress_steps)
VALUES (
  [
    STRUCT('step1' AS step_id, 'First Step' AS step_name, 1 AS step_order),
    STRUCT('step2' AS step_id, 'Second Step' AS step_name, 2 AS step_order)
  ]
);
```

**PostgreSQL (using JSONB):**
```sql
CREATE TABLE actions (
  progress_steps JSONB
);

-- Insert
INSERT INTO actions (progress_steps)
VALUES (
  '[
    {"step_id": "step1", "step_name": "First Step", "step_order": 1},
    {"step_id": "step2", "step_name": "Second Step", "step_order": 2}
  ]'::jsonb
);
```

### Querying STRUCT vs JSONB

**BigQuery:**
```sql
SELECT step.step_name
FROM actions, UNNEST(progress_steps) AS step
WHERE step.step_order = 1;
```

**PostgreSQL:**
```sql
SELECT step->>'step_name' AS step_name
FROM actions,
     jsonb_array_elements(progress_steps) AS step
WHERE (step->>'step_order')::int = 1;
```

---

## 8. Conditional Logic

### CASE statements (same in both)

**BigQuery & PostgreSQL:**
```sql
CASE
  WHEN condition THEN value1
  WHEN condition2 THEN value2
  ELSE default_value
END
```

### NULLIF (same in both)

**BigQuery & PostgreSQL:**
```sql
NULLIF(column, '')  -- returns NULL if column is empty string
```

---

## 9. Aggregations

Most aggregate functions are the same:
- `COUNT(*)`
- `SUM(column)`
- `AVG(column)`
- `MIN(column)`, `MAX(column)`
- `STRING_AGG()` (both support this)

---

## 10. Window Functions

### ROW_NUMBER (same in both)

**BigQuery & PostgreSQL:**
```sql
ROW_NUMBER() OVER (PARTITION BY category ORDER BY date DESC)
```

### LAG/LEAD (same in both)

**BigQuery & PostgreSQL:**
```sql
LAG(value, 1) OVER (ORDER BY date)
LEAD(value, 1) OVER (ORDER BY date)
```

---

## 11. Common Query Patterns

### Pattern: Get teams with member count

**BigQuery:**
```sql
SELECT 
  t.team_name,
  COUNT(m.member_vanid) as member_count
FROM `project.dataset.lumoviz_teams` t
LEFT JOIN `project.dataset.lumoviz_team_members` m
  ON t.id = m.team_id
WHERE m.is_active = TRUE
GROUP BY t.team_name
```

**PostgreSQL:**
```sql
SELECT 
  t.team_name,
  COUNT(m.member_vanid) as member_count
FROM lumoviz_teams t
LEFT JOIN lumoviz_team_members m
  ON t.id = m.team_id
WHERE m.is_active = TRUE
GROUP BY t.team_name
```

### Pattern: Filter by array membership

**BigQuery:**
```sql
WHERE 'Durham' IN UNNEST(chapters)
  OR 'Raleigh' IN UNNEST(chapters)
```

**PostgreSQL:**
```sql
WHERE 'Durham' = ANY(chapters)
   OR 'Raleigh' = ANY(chapters)
-- or
WHERE chapters && ARRAY['Durham', 'Raleigh']  -- overlaps operator
```

### Pattern: Date range filtering

**BigQuery:**
```sql
WHERE DATE(date_contacted) >= DATE('2024-01-01')
  AND DATE(date_contacted) <= DATE('2024-12-31')
```

**PostgreSQL:**
```sql
WHERE date_contacted::date >= '2024-01-01'::date
  AND date_contacted::date <= '2024-12-31'::date
-- or
WHERE date_contacted BETWEEN '2024-01-01' AND '2024-12-31'
```

---

## 12. INSERT Statements

### Single row insert (mostly same)

**BigQuery:**
```sql
INSERT INTO `project.dataset.lumoviz_teams`
(id, team_name, chapter, date_created)
VALUES (@id, @team_name, @chapter, CURRENT_DATE())
```

**PostgreSQL:**
```sql
INSERT INTO lumoviz_teams
(id, team_name, chapter, date_created)
VALUES ($1, $2, $3, CURRENT_DATE)
```

### Insert with RETURNING (PostgreSQL advantage!)

**PostgreSQL:**
```sql
INSERT INTO lumoviz_teams
(id, team_name, chapter)
VALUES ($1, $2, $3)
RETURNING id, created_at;  -- Get the inserted row back
```

BigQuery doesn't support RETURNING.

---

## 13. UPDATE Statements

### Basic update (mostly same)

**BigQuery:**
```sql
UPDATE `project.dataset.lumoviz_teams`
SET team_name = @new_name,
    updated_at = CURRENT_TIMESTAMP()
WHERE id = @team_id
```

**PostgreSQL:**
```sql
UPDATE lumoviz_teams
SET team_name = $1,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $2
```

Note: In PostgreSQL, we've set up triggers to auto-update `updated_at`, so you can omit it!

---

## 14. DELETE Statements (same syntax)

**BigQuery & PostgreSQL:**
```sql
DELETE FROM lumoviz_teams
WHERE id = $1
```

---

## 15. UPSERT (INSERT ... ON CONFLICT)

### BigQuery (using MERGE)

**BigQuery:**
```sql
MERGE `project.dataset.lumoviz_teams` AS target
USING (SELECT @id AS id, @name AS team_name) AS source
ON target.id = source.id
WHEN MATCHED THEN
  UPDATE SET team_name = source.team_name
WHEN NOT MATCHED THEN
  INSERT (id, team_name) VALUES (source.id, source.team_name)
```

### PostgreSQL (simpler!)

**PostgreSQL:**
```sql
INSERT INTO lumoviz_teams (id, team_name)
VALUES ($1, $2)
ON CONFLICT (id)
DO UPDATE SET team_name = EXCLUDED.team_name
```

---

## 16. Transaction Support

### BigQuery (limited support)

BigQuery doesn't support traditional transactions well.

### PostgreSQL (full support!)

```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  
  await client.query('UPDATE lumoviz_teams SET ... WHERE id = $1', [teamId]);
  await client.query('INSERT INTO lumoviz_team_changelog ...', [changeData]);
  
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

---

## 17. Common Mistakes to Avoid

### ❌ Mistake 1: Forgetting to change parameter syntax

```javascript
// WRONG
await pool.query('SELECT * FROM teams WHERE id = @id', { id: '123' });

// RIGHT
await pool.query('SELECT * FROM teams WHERE id = $1', ['123']);
```

### ❌ Mistake 2: Not accessing .rows property

```javascript
// WRONG
const data = await pool.query('SELECT * FROM teams');
// data is a Result object, not an array!

// RIGHT
const result = await pool.query('SELECT * FROM teams');
const data = result.rows;
```

### ❌ Mistake 3: Using BigQuery table naming

```javascript
// WRONG
const query = `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.lumoviz_teams\``;

// RIGHT
const query = 'SELECT * FROM lumoviz_teams';
```

### ❌ Mistake 4: Forgetting type casting

```javascript
// WRONG (PostgreSQL is stricter about types)
WHERE vanid = '12345'  -- string
// but vanid column is BIGINT

// RIGHT
WHERE vanid = 12345  -- number
// or
WHERE CAST(vanid AS TEXT) = '12345'
```

---

## 18. Testing Queries

### Use psql for quick testing

```bash
# Connect
psql "host=localhost port=5432 dbname=lumoviz user=lumoviz_app"

# Run query
SELECT * FROM lumoviz_teams LIMIT 5;

# Explain query performance
EXPLAIN ANALYZE SELECT * FROM lumoviz_teams WHERE chapter = 'Durham';
```

### Query timing in psql

```sql
\timing on
SELECT COUNT(*) FROM lumoviz_meetings;
\timing off
```

---

## 19. Migration Checklist

When converting each query:

- [ ] Remove project.dataset prefix from table names
- [ ] Change `@param` to `$1, $2, ...`
- [ ] Change params object to array
- [ ] Access `.rows` property on result
- [ ] Remove parentheses from `CURRENT_TIMESTAMP()`
- [ ] Change `DATE(x)` to `x::date`
- [ ] Change `IN UNNEST(array)` to `= ANY(array)`
- [ ] Update date arithmetic (`DATE_ADD` → `+ INTERVAL`)
- [ ] Test the query in psql

---

## 20. Real Examples from Lumoviz

### Example 1: Fetch teams

**Before (BigQuery):**
```javascript
const [rows] = await bigquery.query({
  query: `
    SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.lumoviz_teams\`
    WHERE chapter = @chapter
      AND (date_disbanded IS NULL OR date_disbanded = '')
  `,
  params: { chapter: 'Durham' }
});
```

**After (PostgreSQL):**
```javascript
const result = await pool.query(
  `SELECT * FROM lumoviz_teams
   WHERE chapter = $1
     AND (date_disbanded IS NULL OR date_disbanded = '')`,
  ['Durham']
);
const rows = result.rows;
```

### Example 2: Fetch meetings with joins

**Before (BigQuery):**
```javascript
const [rows] = await bigquery.query({
  query: `
    SELECT 
      c.*,
      COALESCE(o.firstname, '') || ' ' || COALESCE(o.lastname, '') as organizer_name
    FROM \`${PROJECT_ID}.${DATASET_ID}.conversations\` c
    LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.org_ids\` o
      ON CAST(c.organizer_vanid AS STRING) = CAST(o.vanid AS STRING)
    WHERE DATE(c.date_contacted) >= @start_date
      AND c.participant_chapter = @chapter
  `,
  params: {
    start_date: '2024-01-01',
    chapter: 'Durham'
  }
});
```

**After (PostgreSQL):**
```javascript
const result = await pool.query(
  `SELECT 
     c.*,
     COALESCE(o.firstname, '') || ' ' || COALESCE(o.lastname, '') as organizer_name
   FROM conversations c
   LEFT JOIN org_ids o
     ON c.organizer_vanid::text = o.vanid::text
   WHERE c.date_contacted::date >= $1
     AND c.participant_chapter = $2`,
  ['2024-01-01', 'Durham']
);
const rows = result.rows;
```

---

## Summary

Most SQL is the same between BigQuery and PostgreSQL. The main differences are:
1. **Table naming** - simpler in PostgreSQL
2. **Parameters** - positional instead of named
3. **Arrays** - `= ANY()` instead of `IN UNNEST()`
4. **Result structure** - access `.rows` property

PostgreSQL gives you additional benefits:
- ✅ Faster transactions
- ✅ RETURNING clause
- ✅ Better UPSERT syntax
- ✅ Full transaction support

Need help with a specific query? Check the examples above or test in psql!
