# Terminology Refactoring - Examples Complete! ✅

## What Was Updated

I've updated 3 key files to show you the pattern for using centralized terminology:

### 1. **`src/components/MainApp.tsx`** (Main application)
### 2. **`src/components/ui/UnifiedFilter.tsx`** (Filter component)
### 3. **`src/components/dialogs/AddPersonDialog.tsx`** (Dialog form)

---

## Changes Made

### ✅ Configuration Set
- **Organization:** "MLD 377" (replaces "Carolina Federation")  
- **Terminology:** "Chapter" → "Section"

### ✅ Pattern Examples

#### **Step 1: Import the config**
```typescript
import { TERMS, BRANDING } from '../config/appConfig';
// or '../../config/appConfig' depending on file location
```

#### **Step 2: Replace hardcoded strings**

**Organization Names:**
```typescript
// Before: "Carolina Federation"  
// After:
{BRANDING.organizationName}  // "MLD 377"

// Before: "Carolina For All"
// After:
`${BRANDING.organizationShortName} For All`  // "MLD 377 For All"
```

**Terminology:**
```typescript
// Before: "Chapter"
// After:
{TERMS.chapter}  // "Section"

// Before: "All Chapters"
// After:
{`All ${TERMS.chapters}`}  // "All Sections"

// Before: label="Chapter"
// After:
label={TERMS.chapter}  // label="Section"
```

**String Comparisons:**
```typescript
// Before:
if (selectedChapter === 'All Chapters') { ... }

// After:
const allChaptersLabel = `All ${TERMS.chapters}`;
if (selectedChapter === allChaptersLabel) { ... }
```

**Error Messages:**
```typescript
// Before:
setError('Please select a chapter');

// After:
setError(`Please select a ${TERMS.chapter.toLowerCase()}`);
```

---

## Review the Changes

**Check these files to see the pattern:**
1. Open `src/components/MainApp.tsx` - Look for `TERMS` and `BRANDING` usage
2. Open `src/components/ui/UnifiedFilter.tsx` - See dropdown labels
3. Open `src/components/dialogs/AddPersonDialog.tsx` - See form validation

**Test it:**
```bash
# If not already running, start the frontend:
npm start

# You should now see:
# - "Section" instead of "Chapter" in dropdowns
# - "All Sections" instead of "All Chapters"  
# - "MLD 377" in comments (code level)
```

---

## Next Steps - You Decide!

### Option A: Review & Approve Pattern ⭐ (Recommended)
1. **Review the 3 example files** I updated
2. **Test the UI** to see "Section" instead of "Chapter"
3. **Give feedback** - does this pattern work for you?
4. **Then I'll update all remaining ~37 files** with the same pattern

### Option B: Update All Files Now 🚀
If you're happy with the pattern, say **"update all files"** and I'll:
- Update all ~40 files with "Carolina"/"Federation" → "MLD 377"
- Update all "Chapter" → "Section" references
- Remove test user references (101669044, 101680550)

### Option C: Customize First ⚙️
Want to change terminology before I proceed?
- Edit `src/config/appConfig.ts` with your preferences
- Or create `.env` file with different values
- Then say "ready to update"

---

## Files Still To Update

**High Priority (User-facing):**
- Dashboard.tsx
- PeoplePanel.tsx
- CampaignPanel.tsx
- GoalsVisualization.tsx
- All remaining dialog components (~15 files)

**Medium Priority:**
- Visualization components
- Service files (api.ts, teamsService.ts)
- Theme files (chapterColors.ts)

**Low Priority (Backend):**
- server/index.js (database queries)

**Total:** ~37 more files

---

## Current Status

✅ Configuration created  
✅ 3 example files updated  
✅ Pattern established  
⏳ Waiting for your approval to proceed

**What would you like to do?**
- Review the examples first? 
- Update all files now?
- Customize the config first?

Just say what you'd like and I'll proceed! 🚀
