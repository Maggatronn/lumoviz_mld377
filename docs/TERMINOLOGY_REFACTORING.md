# Terminology Refactoring Guide

This guide explains how to use the centralized configuration to manage app branding and terminology.

## Configuration File

All branding and terminology is centralized in `src/config/appConfig.ts`.

### To Rebrand the App

Edit `src/config/appConfig.ts`:

```typescript
export const APP_CONFIG = {
  branding: {
    appName: 'MyApp',              // Your app name
    organizationName: 'My Org',    // Your organization name
    organizationShortName: 'MO',   // Short name
  },
  
  terminology: {
    chapter: 'Section',            // Change "Chapter" → "Section"
    chapters: 'Sections',
    // ... etc
  },
};
```

## Usage Examples

### Before (Hardcoded)

```tsx
// ❌ Bad - hardcoded strings
<Select label="Chapter">
  <MenuItem>Durham Chapter</MenuItem>
</Select>

<Typography>
  Carolina Federation Organizer Dashboard
</Typography>
```

### After (Using Config)

```tsx
import { TERMS, BRANDING } from '../config/appConfig';

// ✅ Good - uses config
<Select label={TERMS.chapter}>
  <MenuItem>Durham {TERMS.chapter}</MenuItem>
</Select>

<Typography>
  {BRANDING.organizationName} Organizer Dashboard
</Typography>
```

### Using Helper Functions

```tsx
import { getTerm, replaceTerm } from '../config/appConfig';

// Get term with capitalization
const label = getTerm('chapter', true); // "Section"

// Replace multiple terms in a template
const message = replaceTerm(
  "Select a {chapter} to view {organizers}",
  { chapter: 'Section', organizers: 'Organizers' }
);
// Result: "Select a Section to view Organizers"
```

## Migration Strategy

### Option 1: Automated (Recommended)
Let AI update all files at once using search & replace.

### Option 2: Gradual
Update files as you touch them during development.

### Option 3: File-by-File
Review each file individually for careful migration.

## Common Patterns to Replace

### 1. Chapter References
```tsx
// Before
filter.chapter
"Select Chapter"
"All Chapters"

// After
import { TERMS } from '../config/appConfig';
filter[TERMS.chapter]
`Select ${TERMS.chapter}`
`All ${TERMS.chapters}`
```

### 2. Organization Names
```tsx
// Before
"Carolina Federation"
"Carolina For All"

// After
import { BRANDING } from '../config/appConfig';
BRANDING.organizationName
`${BRANDING.organizationShortName} For All`
```

### 3. Test Users
```tsx
// Before
const testUserId = '101669044';

// After
import { APP_CONFIG } from '../config/appConfig';
if (APP_CONFIG.demo.enabled) {
  // Show demo users
}
```

## Refactoring Checklist

- [ ] Update `src/config/appConfig.ts` with your branding
- [ ] Replace hardcoded "Chapter" with `TERMS.chapter`
- [ ] Replace "Carolina"/"Federation" with `BRANDING.*`
- [ ] Remove or conditionally show test users
- [ ] Update server-side references (server/index.js)
- [ ] Update database column names (future task)
- [ ] Test all UI components
- [ ] Update documentation

## Files to Update

Based on grep analysis:

### High Priority (UI visible to users)
- `src/components/MainApp.tsx` - Main app shell
- `src/components/ui/UnifiedFilter.tsx` - Chapter filters
- `src/components/panels/PeoplePanel.tsx` - People management
- `src/components/visualizations/Dashboard.tsx` - Dashboard
- All dialog components (Add/Edit forms)

### Medium Priority
- `src/services/api.ts` - API calls
- `src/theme/chapterColors.ts` - Theme colors
- Visualization components

### Low Priority (Backend)
- `server/index.js` - Server API endpoints
- Database queries (future migration)

## Next Steps After Refactoring

1. **Update Database Schema** (separate migration)
   - Rename `chapter` columns to `section`
   - Update views and queries

2. **Remove VAN Dependencies** (major redesign)
   - Replace VAN IDs with internal IDs
   - Create dynamic chapters/sections table

3. **Create Admin UI**
   - CRUD for chapters/sections
   - Manage terminology via UI
