# PersonChip Usage Guide

## What It Does

`PersonChip` is like `OrganizerChip` but for all people (organizers AND constituents). It shows:
- ⚠️ **Warning icon** if person is not in VAN (has temp ID or is pending)
- **Click menu** with Filter/Edit/View Details options
- **Tooltip** explaining status

## How to Use

### Replace existing name displays with PersonChip:

**Before:**
```tsx
<Typography>{person.name}</Typography>
// or
<Chip label={person.name} />
```

**After:**
```tsx
import { PersonChip } from '../ui/PersonChip';

<PersonChip
  name={person.name}
  vanId={person.vanid?.toString()}
  allMappings={organizerMappings}  // Pass mappings to detect pending status
  onFilterBy={handleFilterByPerson}
  onEditMapping={handleEditOrganizerMapping}  // Reuse existing handler
  onViewDetails={handleViewPersonDetails}
  size="small"
/>
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `name` | string | Person's display name (required) |
| `vanId` | string | VAN ID or temp ID (optional) |
| `allMappings` | OrganizerMapping[] | Mappings array to check pending status |
| `onFilterBy` | function | Called when "Filter by" is clicked |
| `onEditMapping` | function | Called when "Edit mapping" is clicked |
| `onViewDetails` | function | Called when "View details" is clicked |
| `size` | 'small' \| 'medium' | Chip size (default: 'small') |
| `showMenu` | boolean | Whether to show menu (default: true) |

## Example: In a Table

```tsx
// In a table cell displaying a person's name
<TableCell>
  <PersonChip
    name={row.name}
    vanId={row.vanid?.toString()}
    allMappings={organizerMappings}
    onFilterBy={(name, vanId) => {
      // Filter table by this person
      setFilters({ person: name });
    }}
    onEditMapping={(name, vanId) => {
      // Open edit mapping dialog
      handleEditOrganizerMapping(name, vanId);
    }}
    onViewDetails={(name, vanId) => {
      // Open person details dialog
      setSelectedPerson(row);
      setPersonDialogOpen(true);
    }}
  />
</TableCell>
```

## Example: In Lists/Cards

```tsx
// In PeoplePanel or similar list views
{people.map(person => (
  <ListItem key={person.vanid}>
    <ListItemText
      primary={
        <PersonChip
          name={person.name}
          vanId={person.vanid?.toString()}
          allMappings={organizerMappings}
          onFilterBy={handleFilterByPerson}
          onEditMapping={handleEditOrganizerMapping}
          onViewDetails={handleViewPersonDetails}
        />
      }
      secondary={person.email}
    />
  </ListItem>
))}
```

## Visual Indicators

### Normal Person (in VAN):
```
┌──────────────┐
│ John Doe     │  ← Regular chip
└──────────────┘
```

### Pending Person (not in VAN):
```
┌────────────────────┐
│ Jane Smith ⚠️      │  ← Warning icon, warning color
└────────────────────┘
```
Tooltip: "Not in VAN - needs to be added"

## Where to Use PersonChip

Replace plain text names or basic chips in:

1. **PeoplePanel** - List of contacts
2. **LeaderMetricsTable** - Leader names
3. **Lists tables** - Contact names
4. **Meeting logs** - Participant names
5. **Dashboard cards** - Any person references
6. **Pledge forms** - Submitted by names

## Integration with Person Mapping Dialog

When user clicks "Edit mapping..." on a PersonChip with warning icon:
1. Opens the EditOrganizerMappingDialog
2. User can map temp ID to real VAN ID
3. Or create new mapping if not in system yet

When user opens Person Mapping Dialog (via toolbar button):
1. Can see all pending people in one place
2. Can merge duplicates
3. Can see people needing VAN sync

## Example: Full Integration in PeoplePanel

```tsx
// src/components/panels/PeoplePanel.tsx

import { PersonChip } from '../ui/PersonChip';

// In the render of each person row:
<TableRow key={person.vanid}>
  <TableCell>
    <PersonChip
      name={person.name}
      vanId={person.vanid?.toString()}
      allMappings={organizerMappings}
      onFilterBy={(name) => {
        setFilters(prev => ({ ...prev, selectedPerson: name }));
      }}
      onEditMapping={(name, vanId) => {
        onEditOrganizerMapping?.(name, vanId);
      }}
      onViewDetails={(name, vanId) => {
        setSelectedPerson(person);
        setDetailsDialogOpen(true);
      }}
      size="small"
    />
  </TableCell>
  <TableCell>{person.email}</TableCell>
  {/* ... other cells */}
</TableRow>
```

## Quick Replace Patterns

### Pattern 1: Simple Name Display
```tsx
// Before
<Typography>{name}</Typography>

// After
<PersonChip 
  name={name} 
  vanId={vanId?.toString()}
  allMappings={organizerMappings}
/>
```

### Pattern 2: Clickable Name
```tsx
// Before
<Link onClick={() => handleClick(person)}>{person.name}</Link>

// After
<PersonChip 
  name={person.name} 
  vanId={person.vanid?.toString()}
  allMappings={organizerMappings}
  onViewDetails={() => handleClick(person)}
/>
```

### Pattern 3: Name with Badge
```tsx
// Before
<Box>
  <Chip label={name} />
  {isPending && <Badge color="warning" />}
</Box>

// After (badge is automatic!)
<PersonChip 
  name={name} 
  vanId={vanId?.toString()}
  allMappings={organizerMappings}
/>
```

## Notes

- ⚠️ The warning icon automatically appears for:
  - VAN IDs starting with `pending_`
  - Mappings where `in_van === false`
  - Mappings where `van_sync_status !== 'synced'`
  
- 🎨 Warning chips automatically use warning color (orange)

- 📋 Menu appears on click (like OrganizerChip)

- 🔍 Tooltip shows status on hover

- ♻️ Reuses existing handlers - no new backend needed!

## Testing

1. Create a pending person in BigQuery:
```sql
INSERT INTO `chapter-448015.lumoviz.lumoviz_organizer_mapping`
(primary_vanid, preferred_name, person_type, in_van, van_sync_status, source)
VALUES
('pending_123', 'Test Person', 'constituent', FALSE, 'pending_sync', 'test');
```

2. Use PersonChip to display them:
```tsx
<PersonChip 
  name="Test Person"
  vanId="pending_123"
  allMappings={organizerMappings}
  onEditMapping={handleEditOrganizerMapping}
/>
```

3. Should see:
   - Orange warning chip
   - Warning icon next to name
   - Tooltip: "Not in VAN - needs to be added"
   - Menu option: "Map to VAN ID..."

Done! 🎉
