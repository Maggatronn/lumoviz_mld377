# Simple Person Mapping Guide
## Using Your Existing Table (No Migration!)

## What This Does

Extends your existing `organizer_mapping` table to support:
- ✅ **Organizers** (already works)
- ✅ **Constituents** (new)
- ✅ **Pending people** from pledge forms who aren't in VAN yet (new)

**NO new table. NO data migration. Just adds a few columns.**

## Step 1: Run the Extension Script (In Stages!)

**IMPORTANT:** BigQuery has rate limits on table updates. You must run this script in stages with 1-2 minute waits between each stage.

### How to Run:

1. **Open the script** in BigQuery Console: `extend_organizer_mapping_for_all_people.sql`

2. **Run STAGE 1** - Copy and run all the `ADD COLUMN` statements (already uncommented)

3. **WAIT 1-2 MINUTES** ⏰

4. **Skip STAGE 2** - Optional (only sets defaults for future inserts)

5. **Run STAGE 3** - Uncomment and run the `UPDATE` statement to backfill existing records

6. **WAIT 1-2 MINUTES** ⏰

7. **Run STAGE 4** - Run the `CREATE VIEW` statements

Done! ✅

This adds these columns to your existing table:
- `person_type` - 'organizer', 'constituent', 'leader', or 'pending'
- `in_van` - Whether they're in VAN contacts (TRUE/FALSE)
- `van_sync_status` - 'synced', 'pending_sync', etc.
- `source` - Where they came from ('van', 'pledge_form', etc.)
- `source_id` - Link to source record
- `phone` - For pending people
- `chapter` - Chapter affiliation
- `merged_from_ids` - Track merged identities
- `merge_date` - When merge happened

**Your existing organizer data is safe** - all existing records default to:
- `person_type = 'organizer'`
- `in_van = TRUE`
- `van_sync_status = 'synced'`

## Step 2: No Backend Changes Needed!

Your existing API endpoints still work:
- `GET /api/organizer-mapping` - Returns all (organizers + constituents)
- `POST /api/organizer-mapping` - Works for both
- `DELETE /api/organizer-mapping/:vanid` - Works for both

The only change: when creating new records, set the `person_type` field.

## Use Case 1: Someone Fills Out Pledge (Not in VAN)

```sql
INSERT INTO `chapter-448015.lumoviz.lumoviz_organizer_mapping`
(primary_vanid, preferred_name, person_type, email, phone, 
 in_van, van_sync_status, source, source_id, notes)
VALUES
('pending_1707926400000',  -- Temporary ID
 'Maria Garcia', 
 'constituent',             -- Not an organizer
 'maria@example.com', 
 '555-1234',
 FALSE,                     -- Not in VAN yet
 'pending_sync',            -- Needs to be added
 'pledge_form', 
 'pledge_submission_123',
 'Filled out pledge form on 2024-02-14');
```

**What happens:**
- Gets temporary ID: `pending_1707926400000`
- Stored with contact info
- Shows up in `pending_van_sync_view`
- Can be referenced in lists/meetings
- When added to VAN, just update the `primary_vanid` to real VAN ID

## Use Case 2: Merge Duplicate Constituents

Same person appears as two different VAN IDs:

```sql
-- Merge VAN ID 20002 into 20001
UPDATE `chapter-448015.lumoviz.lumoviz_organizer_mapping`
SET 
  alternate_vanids = ARRAY_CONCAT(IFNULL(alternate_vanids, []), ['20002']),
  name_variations = ARRAY_CONCAT(IFNULL(name_variations, []), ['María García']),
  merged_from_ids = ARRAY_CONCAT(IFNULL(merged_from_ids, []), ['20002']),
  merge_date = CURRENT_TIMESTAMP(),
  notes = CONCAT(IFNULL(notes, ''), '\nMerged duplicate 20002'),
  updated_at = CURRENT_TIMESTAMP()
WHERE primary_vanid = '20001';

-- Delete the duplicate
DELETE FROM `chapter-448015.lumoviz.lumoviz_organizer_mapping`
WHERE primary_vanid = '20002';

-- Update all references
UPDATE `chapter-448015.lumoviz.lumoviz_lists` 
SET contact_vanid = 20001 WHERE contact_vanid = 20002;

UPDATE `chapter-448015.lumoviz.lumoviz_meetings` 
SET organizee_vanid = 20001 WHERE organizee_vanid = 20002;
```

## Use Case 3: Update Pending Person When Added to VAN

```sql
UPDATE `chapter-448015.lumoviz.lumoviz_organizer_mapping`
SET 
  primary_vanid = '50001',      -- Real VAN ID
  in_van = TRUE,
  van_sync_status = 'synced',
  notes = CONCAT(IFNULL(notes, ''), '\nAdded to VAN'),
  updated_at = CURRENT_TIMESTAMP()
WHERE primary_vanid = 'pending_1707926400000';
```

## Use Case 4: Find People Needing VAN Sync

```sql
SELECT * FROM `chapter-448015.lumoviz.pending_van_sync_view`;
```

Or directly:
```sql
SELECT 
  primary_vanid,
  preferred_name,
  person_type,
  email,
  phone,
  source,
  created_at
FROM `chapter-448015.lumoviz.lumoviz_organizer_mapping`
WHERE in_van = FALSE
ORDER BY created_at DESC;
```

## Helper Views Created

Three convenient views:

### 1. Organizers Only (Backward Compatible)
```sql
SELECT * FROM `chapter-448015.lumoviz.organizers_view`;
```

### 2. Constituents Only
```sql
SELECT * FROM `chapter-448015.lumoviz.constituents_view`;
```

### 3. Pending VAN Sync
```sql
SELECT * FROM `chapter-448015.lumoviz.pending_van_sync_view`;
```

## Frontend Changes (Optional)

If you want to filter by type in the frontend:

```typescript
// Existing service works as-is, but you can add:

// Get only organizers
export async function getOrganizerMappings(): Promise<OrganizerMapping[]> {
  const all = await fetch(`${API_URL}/organizer-mapping`).then(r => r.json());
  return all.filter(m => m.person_type === 'organizer' || !m.person_type);
}

// Get only constituents
export async function getConstituentMappings(): Promise<OrganizerMapping[]> {
  const all = await fetch(`${API_URL}/organizer-mapping`).then(r => r.json());
  return all.filter(m => m.person_type === 'constituent' || m.person_type === 'leader');
}

// Get pending people
export async function getPendingPeople(): Promise<OrganizerMapping[]> {
  const all = await fetch(`${API_URL}/organizer-mapping`).then(r => r.json());
  return all.filter(m => !m.in_van || m.van_sync_status !== 'synced');
}
```

Or add a query parameter to the backend:

```javascript
// server/index.js - modify existing endpoint
app.get('/api/organizer-mapping', async (req, res) => {
  const { person_type } = req.query;
  
  let query = `SELECT * FROM \`${PROJECT_ID}.${DATASET}.lumoviz_organizer_mapping\``;
  
  if (person_type) {
    query += ` WHERE person_type = @person_type`;
  }
  
  query += ` ORDER BY preferred_name`;
  
  const [rows] = await bigquery.query({
    query,
    params: person_type ? { person_type } : {}
  });
  
  res.json(rows);
});
```

Then:
```typescript
// Get only organizers
const organizers = await fetch(`${API_URL}/organizer-mapping?person_type=organizer`);

// Get only constituents
const constituents = await fetch(`${API_URL}/organizer-mapping?person_type=constituent`);
```

## When Someone Submits a Pledge

```javascript
async function handlePledgeSubmission(formData) {
  // Check if person exists in VAN
  const existingPerson = await checkVAN(formData.email);
  
  let vanid;
  
  if (existingPerson) {
    vanid = existingPerson.vanid;
  } else {
    // Create pending person
    vanid = `pending_${Date.now()}`;
    
    await fetch('/api/organizer-mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primary_vanid: vanid,
        preferred_name: formData.name,
        person_type: 'constituent',
        email: formData.email,
        phone: formData.phone,
        in_van: false,
        van_sync_status: 'pending_sync',
        source: 'pledge_form',
        source_id: pledgeSubmissionId,
      })
    });
  }
  
  // Use vanid in pledge record...
}
```

## Temporary ID Format

For pending people not in VAN yet:
- `pending_` + timestamp: `pending_1707926400000`
- Easy to identify
- Won't conflict with real VAN IDs

Generate in JavaScript:
```javascript
const tempId = `pending_${Date.now()}`;
```

Or in SQL:
```sql
'pending_' || CAST(UNIX_MILLIS(CURRENT_TIMESTAMP()) AS STRING)
```

## Summary

**What you get:**
1. ✅ Use existing table - no migration needed
2. ✅ Store constituents alongside organizers
3. ✅ Handle people not yet in VAN (from pledge forms)
4. ✅ Merge duplicates (organizers OR constituents)
5. ✅ Track sync status
6. ✅ Backward compatible - existing code still works

**What you don't need:**
1. ❌ Create new tables
2. ❌ Migrate data
3. ❌ Change existing API endpoints (unless you want filtering)
4. ❌ Update existing frontend code (unless you want constituent-specific features)

Just run the SQL script and start using it! 🎉
