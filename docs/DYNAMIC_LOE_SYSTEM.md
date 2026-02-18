# Dynamic LOE System

## Overview
The LOE (Level of Engagement) system is now **fully data-driven** with minimal hardcoding. LOE categories are inferred from the actual data in BigQuery, and colors are generated dynamically based on numeric prefixes.

## How It Works

### 1. Database Storage (No Changes Required)
LOE values are stored in the `contacts` table `loe` field as strings:
- `"1_TeamLeader"`, `"2_TeamMember"`, `"3_Member"`, `"4_Supporter"`, etc.
- `"Staff"` or `"Organizer"` for organizers
- `NULL` or `"Unknown"` for unclassified

### 2. Data Extraction (MainApp.tsx)
When meetings data loads, the system:
```typescript
const extracted = extractLOELevelsFromMeetings(allTimeMeetingsData);
// Returns: [
//   { level: 1, rawValue: "1_TeamLeader", label: "TeamLeader", color: "#b71c1c", ... },
//   { level: 2, rawValue: "2_TeamMember", label: "TeamMember", color: "#e65100", ... },
//   { level: 3, rawValue: "3_Member", label: "Member", color: "#f57f17", ... },
//   ...
// ]
```

### 3. Color Generation (dynamicLoeColors.ts)
Colors are assigned based on the **numeric prefix only**:

| Level | Color | Temperature |
|-------|-------|-------------|
| 1 | Deep Red (#b71c1c) | Warmest (highest engagement) |
| 2 | Orange-Red (#e65100) | Warm |
| 3 | Golden Yellow (#f57f17) | Warm |
| 4 | Green (#558b2f) | Cool |
| 5 | Blue (#1976d2) | Cool |
| 6 | Purple (#7b1fa2) | Cool |
| 7+ | Gray (#616161) | Coolest |

**Special Categories:**
- `Staff` / `Organizer` → Deep Purple (#4a148c)
- `Unknown` → Gray (#616161)

### 4. Storage & Filtering
**Raw values are used internally:**
- Filters store: `["1_TeamLeader", "2_TeamMember", "Staff"]`
- Node loeStatus: `"1_TeamLeader"`
- Comparison: Direct string match

**Display values strip the prefix:**
- Filter chips: "LOE: TeamLeader"
- Table cells: "TeamLeader"
- Dropdown: "TeamLeader (Level 1)"

### 5. Key Functions

#### `parseLOEValue(loeValue: string)`
Extracts level and label from any LOE format:
```typescript
parseLOEValue("1_TeamLeader") → { level: 1, label: "TeamLeader", rawValue: "1_TeamLeader" }
parseLOEValue("Staff") → { level: null, label: "Staff", rawValue: "Staff" }
```

#### `getLOEColor(loeStatus: string)`
Returns color based on numeric level:
```typescript
getLOEColor("1_TeamLeader") → { color: "#b71c1c", backgroundColor: "#ffebee", level: 1 }
getLOEColor("Staff") → { color: "#4a148c", backgroundColor: "#f3e5f5", level: null }
```

#### `formatLOELabel(loeValue: string)`
Strips numeric prefix for display:
```typescript
formatLOELabel("1_TeamLeader") → "TeamLeader"
formatLOELabel("Staff") → "Staff"
```

## Benefits

1. **No Hardcoded Categories**: System adapts to whatever LOE values exist in your data
2. **Flexible**: Add new LOE levels (e.g., `"5_Supporter"`, `"6_Prospect"`) by just updating BigQuery
3. **Consistent Colors**: Colors are always based on the level number, ensuring visual consistency
4. **Data Fidelity**: Raw database values are preserved throughout the system
5. **Future-Proof**: Works with any LOE naming convention as long as it follows the `number_label` format

## Adding New LOE Levels

Simply update your BigQuery `contacts.loe` field:
```sql
UPDATE contacts SET loe = "5_NewCategory" WHERE ...;
```

The system will:
- Automatically detect "5_NewCategory" exists in data
- Assign it the appropriate color (blue for level 5)
- Show it in all filter dropdowns
- Display it as "NewCategory" (stripping the "5_")

## What's Still Hardcoded

**Only the color gradient** (7 colors based on level 1-7+):
- Level 1 = Red
- Level 2 = Orange
- Level 3 = Yellow
- Level 4 = Green
- Level 5 = Blue
- Level 6 = Purple
- Level 7+ = Gray

This provides consistent visual encoding across any LOE naming scheme you use.
