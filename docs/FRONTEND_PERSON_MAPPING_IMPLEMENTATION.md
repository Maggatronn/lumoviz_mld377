# Frontend Person Mapping Implementation Guide

## What I've Created

1. **PersonMappingDialog.tsx** - A comprehensive dialog for managing person mappings
2. **Updated organizerMappingService.ts** - Added merge and pending person functions

## Features

### PersonMappingDialog has 3 tabs:

1. **Pending VAN Sync** - Shows people who need to be added to VAN (from pledge forms, etc.)
2. **Potential Duplicates** - Finds people with the same name but different VAN IDs
3. **All Mappings** - Complete list of all mapped people

## Step 1: Add the Dialog to MainApp

```typescript
// src/components/MainApp.tsx

// Add import
import { PersonMappingDialog } from './dialogs/PersonMappingDialog';
import { mergePeople } from '../services/organizerMappingService';

// Inside MainApp component, add state
const [personMappingDialogOpen, setPersonMappingDialogOpen] = useState(false);

// Add handler for merging people
const handleMergePeople = async (primaryVanid: string, mergeVanid: string) => {
  try {
    await mergePeople(primaryVanid, mergeVanid, organizerMappings);
    
    // Refresh mappings
    const updatedMappings = await getOrganizerMappings();
    setOrganizerMappings(updatedMappings);
    
    // TODO: Also update references in lists, meetings, etc.
    // You'll need to call backend endpoints to update those tables
    
  } catch (error) {
    console.error('Error merging people:', error);
    throw error;
  }
};

// Add a button somewhere in your UI (e.g., in the header or a settings menu)
<Button
  variant="outlined"
  startIcon={<PeopleIcon />}
  onClick={() => setPersonMappingDialogOpen(true)}
>
  Manage People
</Button>

// Add the dialog before the closing </Box> tag
<PersonMappingDialog
  open={personMappingDialogOpen}
  onClose={() => setPersonMappingDialogOpen(false)}
  allMappings={organizerMappings}
  allPeople={Array.from(userMap.entries()).map(([vanid, info]) => ({
    name: info.fullName || `${info.firstname || ''} ${info.lastname || ''}`.trim(),
    vanid: vanid
  }))}
  onMergePeople={handleMergePeople}
  onRefresh={async () => {
    const updated = await getOrganizerMappings();
    setOrganizerMappings(updated);
  }}
/>
```

## Step 2: Auto-Create Pending People from Pledge Forms

You need to handle this in your pledge submission process. Here's how:

### Option A: Handle in Frontend (When Pledge is Submitted)

```typescript
// When processing pledge submissions
import { createPendingPerson } from '../services/organizerMappingService';

async function processPledgeSubmission(pledge: {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  vanid?: number;
}) {
  let vanid = pledge.vanid;
  
  // If no VAN ID provided, check if person exists
  if (!vanid) {
    const existingPerson = Array.from(userMap.entries()).find(([id, info]) => {
      const email = info.email?.toLowerCase();
      const phone = info.phone;
      return (pledge.email && email === pledge.email.toLowerCase()) ||
             (pledge.phone && phone === pledge.phone);
    });
    
    if (existingPerson) {
      vanid = parseInt(existingPerson[0]);
    } else {
      // Create pending person
      const name = `${pledge.first_name} ${pledge.last_name}`.trim();
      const tempId = await createPendingPerson({
        name,
        email: pledge.email,
        phone: pledge.phone,
        personType: 'constituent',
        source: 'pledge_form',
        sourceId: pledge.id || undefined
      });
      
      vanid = tempId; // Use temporary ID
      
      // Refresh mappings so they show up
      const updated = await getOrganizerMappings();
      setOrganizerMappings(updated);
    }
  }
  
  // Continue with pledge submission using vanid (real or temporary)
  // ...
}
```

### Option B: Handle in Backend (Recommended)

Add a backend endpoint that processes pledge submissions and auto-creates pending people:

```javascript
// server/index.js

app.post('/api/pledge-submissions', async (req, res) => {
  try {
    const { first_name, last_name, email, phone, vanid, ...otherData } = req.body;
    
    let finalVanid = vanid;
    
    // If no VAN ID provided, check if person exists or create pending
    if (!finalVanid) {
      // Check contacts table
      const contactQuery = `
        SELECT vanid FROM \`${PROJECT_ID}.lumoviz.contacts_view\`
        WHERE email = @email OR phone = @phone
        LIMIT 1
      `;
      
      const [contacts] = await bigquery.query({
        query: contactQuery,
        params: { email: email || null, phone: phone || null }
      });
      
      if (contacts.length > 0) {
        finalVanid = contacts[0].vanid;
      } else {
        // Create pending person in organizer_mapping table
        const tempId = `pending_${Date.now()}`;
        const name = `${first_name} ${last_name}`.trim();
        
        const insertQuery = `
          INSERT INTO \`${PROJECT_ID}.lumoviz.lumoviz_organizer_mapping\`
          (primary_vanid, preferred_name, person_type, email, phone, 
           in_van, van_sync_status, source, created_at, updated_at)
          VALUES
          (@vanid, @name, 'constituent', @email, @phone,
           FALSE, 'pending_sync', 'pledge_form', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
        `;
        
        await bigquery.query({
          query: insertQuery,
          params: {
            vanid: tempId,
            name,
            email: email || null,
            phone: phone || null
          }
        });
        
        finalVanid = tempId;
      }
    }
    
    // Now save pledge with finalVanid (real or temporary)
    const pledgeQuery = `
      INSERT INTO \`${PROJECT_ID}.pledge_campaign.pledge_submissions\`
      (vanid, first_name, last_name, email, phone, ...)
      VALUES (@vanid, @first_name, @last_name, ...)
    `;
    
    await bigquery.query({
      query: pledgeQuery,
      params: { vanid: finalVanid, first_name, last_name, ... }
    });
    
    res.json({ success: true, vanid: finalVanid });
    
  } catch (error) {
    console.error('Error processing pledge:', error);
    res.status(500).json({ error: error.message });
  }
});
```

## Step 3: Update References When Merging

When you merge two people, you need to update all references in other tables. Add this to your backend:

```javascript
// server/index.js

app.post('/api/person-mapping/merge', async (req, res) => {
  try {
    const { primary_vanid, merge_vanid } = req.body;
    
    // Get both mappings
    const getQuery = `
      SELECT * FROM \`${PROJECT_ID}.lumoviz.lumoviz_organizer_mapping\`
      WHERE primary_vanid IN (@primary, @merge)
    `;
    
    const [mappings] = await bigquery.query({
      query: getQuery,
      params: { primary: primary_vanid, merge: merge_vanid }
    });
    
    if (mappings.length !== 2) {
      return res.status(404).json({ error: 'One or both people not found' });
    }
    
    const primary = mappings.find(m => m.primary_vanid === primary_vanid);
    const toMerge = mappings.find(m => m.primary_vanid === merge_vanid);
    
    // Merge data
    const mergedAlternateVanids = [
      ...(primary.alternate_vanids || []),
      merge_vanid,
      ...(toMerge.alternate_vanids || [])
    ];
    
    const mergedNameVariations = [
      ...(primary.name_variations || []),
      toMerge.preferred_name,
      ...(toMerge.name_variations || [])
    ];
    
    // Update primary record
    const updateQuery = `
      UPDATE \`${PROJECT_ID}.lumoviz.lumoviz_organizer_mapping\`
      SET 
        alternate_vanids = @alternate_vanids,
        name_variations = @name_variations,
        merged_from_ids = ARRAY_CONCAT(IFNULL(merged_from_ids, []), [@merge_id]),
        merge_date = CURRENT_TIMESTAMP(),
        notes = CONCAT(IFNULL(notes, ''), @merge_note),
        updated_at = CURRENT_TIMESTAMP()
      WHERE primary_vanid = @primary_vanid
    `;
    
    await bigquery.query({
      query: updateQuery,
      params: {
        primary_vanid,
        alternate_vanids: mergedAlternateVanids,
        name_variations: mergedNameVariations,
        merge_id: merge_vanid,
        merge_note: `\nMerged ${merge_vanid} on ${new Date().toISOString()}`
      }
    });
    
    // Update references in other tables
    const tables = [
      { table: 'lumoviz_lists', column: 'contact_vanid' },
      { table: 'lumoviz_meetings', column: 'organizee_vanid' },
      { table: 'lumoviz_meetings', column: 'organizer_vanid' }
    ];
    
    for (const { table, column } of tables) {
      const updateRefQuery = `
        UPDATE \`${PROJECT_ID}.lumoviz.${table}\`
        SET ${column} = @new_value
        WHERE CAST(${column} AS STRING) = @old_value
      `;
      
      await bigquery.query({
        query: updateRefQuery,
        params: {
          new_value: primary_vanid,
          old_value: merge_vanid
        }
      });
    }
    
    // Delete the merged record
    const deleteQuery = `
      DELETE FROM \`${PROJECT_ID}.lumoviz.lumoviz_organizer_mapping\`
      WHERE primary_vanid = @merge_vanid
    `;
    
    await bigquery.query({
      query: deleteQuery,
      params: { merge_vanid }
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error merging people:', error);
    res.status(500).json({ error: error.message });
  }
});
```

## Step 4: Call Backend Merge from Frontend

Update the mergePeople call to use the backend:

```typescript
// src/services/organizerMappingService.ts

// Update mergePeople to call backend
export async function mergePeople(
  primaryVanid: string,
  mergeVanid: string
): Promise<void> {
  const response = await fetch(`${API_URL}/person-mapping/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ primary_vanid: primaryVanid, merge_vanid: mergeVanid })
  });
  
  if (!response.ok) {
    throw new Error('Failed to merge people');
  }
}
```

## Summary

**To answer your questions:**

### 1. Frontend Mapping Functionality ✅
- Use `PersonMappingDialog` component
- Add it to MainApp with a button to open it
- Shows pending people, duplicates, and all mappings

### 2. Auto-Adding Pledges Without VAN IDs ❌ → ✅
- **Currently:** They do NOT auto-add
- **Solution:** Implement Option B (backend handling) recommended
- When pledge comes in without VAN ID:
  1. Check if email/phone exists in contacts
  2. If yes, use that VAN ID
  3. If no, create pending person with temp ID
  4. Save pledge with VAN ID (real or temp)

### Next Steps:
1. Add PersonMappingDialog to MainApp
2. Implement backend `/api/person-mapping/merge` endpoint
3. Implement auto-create pending people in pledge submission flow
4. Test with a pledge submission that has no VAN ID

Need help with any of these steps?
