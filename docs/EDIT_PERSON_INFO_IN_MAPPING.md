# Feature: Edit Person Contact Info Through Mapping Dialog

## Problem

When a person's OrganizerChip shows their VAN ID instead of their name (e.g., "Contact 101693675"), there was no easy way to add their information manually. The user needed a way to edit/add:
- First and last name
- Chapter
- Phone number
- Email address

And have this information stored in the `lumoviz_organizer_mapping` table so it displays correctly throughout the app.

## Solution

Enhanced `EditOrganizerMappingDialog` to support **editing person contact information** in addition to the existing mapping functionality.

## What Changed

### 1. EditOrganizerMappingDialog.tsx

Added new checkbox: **"Edit person's contact information"**

When checked, the dialog shows fields for:
- First Name (required)
- Last Name (required)
- Chapter
- Phone
- Email

```typescript
// New state
const [editPersonInfo, setEditPersonInfo] = useState(false);
const [firstName, setFirstName] = useState('');
const [lastName, setLastName] = useState('');
const [chapter, setChapter] = useState('');
const [phone, setPhone] = useState('');
const [email, setEmail] = useState('');
```

### 2. Auto-populate Existing Data

When the dialog opens for an existing person, it pre-fills:
- Name (split into first/last)
- Chapter
- Phone
- Email

From the existing mapping if available.

### 3. Save Person Info to Mapping Table

When "Edit person's contact information" is checked and user clicks "Save Contact Info":

```typescript
if (editPersonInfo) {
  const fullName = `${firstName} ${lastName}`.trim();
  const updatedMapping: OrganizerMapping = {
    ...targetMapping,
    preferred_name: fullName,
    chapter: chapter || targetMapping.chapter,
    phone: phone || targetMapping.phone,
    email: email || targetMapping.email,
    // ...
  };
  await saveOrganizerMapping(updatedMapping);
}
```

This updates (or creates) the mapping entry with the person's full contact info.

### 4. Refresh userMap After Save (MainApp.tsx)

Added logic to `handleMappingSaved()` to update `userMap` with mapping data:

```typescript
const handleMappingSaved = async () => {
  const mappings = await getOrganizerMappings();
  setOrganizerMappings(mappings);
  
  // Update userMap with new mapping information
  setUserMap(prev => {
    const updated = new Map(prev);
    mappings.forEach(mapping => {
      const nameParts = mapping.preferred_name.split(' ');
      updated.set(mapping.primary_vanid, {
        userId: mapping.primary_vanid,
        firstname: nameParts[0],
        lastname: nameParts.slice(1).join(' '),
        fullName: mapping.preferred_name,
        chapter: mapping.chapter || 'Unknown',
        phone: mapping.phone,
        email: mapping.email,
        // ...
      });
      
      // Also add entries for alternate VAN IDs
      mapping.alternate_vanids?.forEach(altVanid => {
        updated.set(altVanid, { /* same data */ });
      });
    });
    return updated;
  });
  
  // Re-resolve contacts...
};
```

**Result**: Names display correctly IMMEDIATELY after saving, no page refresh needed!

## How to Use

### Scenario: Meghan shows as "Contact 101693675"

1. **Click on the chip** showing "Contact 101693675"
2. **Select "Edit mapping..."** from the menu
3. **Check** "Edit person's contact information"
4. **Fill in the fields**:
   - First Name: Meghan
   - Last Name: Smith
   - Chapter: Winston-Salem (or whatever chapter)
   - Phone: (optional)
   - Email: (optional)
5. **Click "Save Contact Info"**
6. ✅ The chip now shows "Meghan Smith" immediately!

### Behind the Scenes

1. Dialog saves to `lumoviz_organizer_mapping` table:
   ```json
   {
     "primary_vanid": "101693675",
     "preferred_name": "Meghan Smith",
     "chapter": "Winston-Salem",
     "phone": "...",
     "email": "...",
     "updated_at": "2026-02-14"
   }
   ```

2. `handleMappingSaved()` runs and updates `userMap`:
   ```javascript
   userMap.set('101693675', {
     userId: '101693675',
     firstname: 'Meghan',
     lastname: 'Smith',
     fullName: 'Meghan Smith',
     chapter: 'Winston-Salem',
     // ...
   });
   ```

3. Dashboard's `myLeaders` useMemo runs and looks up the name:
   ```typescript
   const leaderInfo = userMap.get('101693675');
   const leaderName = leaderInfo?.fullName || leaderInfo?.name || `Contact ${leaderId}`;
   // Result: "Meghan Smith" ✅
   ```

4. OrganizerChip displays "Meghan Smith" ✅

## Three Modes in EditOrganizerMappingDialog

The dialog now has **three exclusive modes**:

### Mode 1: Map Name Variations (Original)
- **Use when**: Mapping different name spellings or IDs to a canonical person
- **Example**: "Sam Smith", "Samuel Smith", "S. Smith" → all map to "Sam Smith (VAN ID 123)"
- **Fields**: Select canonical organizer dropdown

### Mode 2: Create New Person
- **Use when**: Person is completely new to the system
- **Checkbox**: "This is a new organizer (not in system yet)"
- **Fields**: Preferred Name, Primary VAN ID, Chapter, Phone, Email

### Mode 3: Edit Person Info (NEW!)
- **Use when**: Person exists but info is missing/incorrect
- **Checkbox**: "Edit person's contact information"
- **Fields**: First Name, Last Name, Chapter, Phone, Email
- **Use case**: "Contact 101693675" → Add their real name

The checkboxes are **mutually exclusive** - checking one unchecks the other.

## Data Flow

```
User clicks "Contact 101693675" chip
  ↓
EditOrganizerMappingDialog opens
  ↓
User checks "Edit person's contact information"
  ↓
User fills in: Meghan, Smith, Winston-Salem
  ↓
Clicks "Save Contact Info"
  ↓
saveOrganizerMapping() → POST /api/organizer-mapping
  ↓
Updates lumoviz_organizer_mapping table
  ↓
handleMappingSaved() runs
  ↓
Fetches updated mappings
  ↓
Updates userMap with new data
  ↓
Dashboard re-renders (myLeaders useMemo)
  ↓
Looks up userMap.get('101693675')
  ↓
Finds: { fullName: "Meghan Smith", chapter: "Winston-Salem" }
  ↓
OrganizerChip displays "Meghan Smith" ✅
```

## Why This Solves the Problem

### Before:
1. `userMap` only had people who were in VAN contacts or organizers
2. Pledge signers not in VAN had VAN IDs but no names in userMap
3. When added as leaders, their chips showed "Contact {vanid}"
4. No way to manually add their info

### After:
1. `userMap` can be populated from mappings table
2. User can manually add person info through Edit dialog
3. Info is saved to `lumoviz_organizer_mapping` table
4. `userMap` is updated immediately after save
5. Names display correctly throughout app

## Related Fixes

This works together with:
- ✅ **FIX_USERMAP_FULLNAME_LOOKUP.md** - Look up `fullName` not `name`
- ✅ **FIX_USERMAP_FOR_ALL_CONTACTS.md** - Populate userMap with all contacts
- ✅ **FIX_ADD_PLEDGE_SIGNERS_TO_CONTACTS.md** - Add pledge signers to contacts list

## Database Schema

The `lumoviz_organizer_mapping` table already has these fields (from previous work):

```sql
CREATE TABLE lumoviz_organizer_mapping (
  primary_vanid STRING,
  preferred_name STRING,
  alternate_vanids ARRAY<STRING>,
  name_variations ARRAY<STRING>,
  email STRING,
  phone STRING,
  notes STRING,
  chapter STRING,  -- Added for person info
  person_type STRING,
  in_van BOOLEAN,
  van_sync_status STRING,
  source STRING,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

No schema changes needed! 🎉

## Testing

### Test 1: Edit Existing Person
1. Find a person showing as "Contact {vanid}"
2. Click chip → Edit mapping
3. Check "Edit person's contact information"
4. Fill in name and chapter
5. Save
6. ✅ Chip shows name immediately

### Test 2: Create New Person with Info
1. Click chip for unknown name
2. Check "This is a new organizer"
3. Fill in all fields including chapter
4. Save
5. ✅ Person created with all info

### Test 3: Update Existing Mapping
1. Open edit for person with existing mapping
2. Check "Edit person's contact information"
3. Change chapter or add phone
4. Save
5. ✅ Info updates, name still correct

### Test 4: Pre-population
1. Open edit for person with existing mapping
2. Check "Edit person's contact information"
3. ✅ Fields should pre-fill with existing data

## Future Enhancements

Potential improvements:
1. Add "Edit Info" button directly in PersonChip menu (not just OrganizerChip)
2. Show chapter as a tooltip or badge on chips
3. Bulk edit multiple people's info
4. Import person info from CSV
5. Sync person info back to VAN (if we have write access)

---

**Status**: ✅ Complete - Users can now edit person contact info through mapping dialog  
**Date**: February 14, 2026  
**Files Modified**: 
- `src/components/dialogs/EditOrganizerMappingDialog.tsx`
- `src/components/MainApp.tsx` (handleMappingSaved)
