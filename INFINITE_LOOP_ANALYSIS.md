# Infinite Loop Analysis - Lumoviz App

## 🔴 CONFIRMED: Infinite API Call Loop Detected

Based on server logs analysis, there is a **confirmed infinite loop** of API calls happening in the application.

## Evidence from Server Logs (Terminal 8)

### Pattern of Repeated API Calls:
The following sequence repeats continuously every few seconds:

```
[/api/teams] Fetching teams from PostgreSQL...
[/api/teams] Found 13 teams
[/api/teams] Found 72 team members with roles
[/api/actions] organizer_vanid: 100001 organizer_chapter: Main Chapter
[/api/actions] organizer_vanid: 100001 organizer_chapter: undefined
[/api/actions] organizer_vanid: undefined organizer_chapter: undefined
[/api/contacts] Total contacts: 77
[/api/chapters] Returning 7 sections
```

This pattern repeats **indefinitely**, indicating a React useEffect dependency issue.

## Root Cause Analysis

### 1. Missing Dependencies in useEffect Hooks

From linter warnings, these useEffect hooks have missing dependencies:

#### MainApp.tsx:
- **Line 283**: Missing `handleURLFiltersChange` and `unifiedFilters`
- **Line 1176**: Missing `currentUserId` and `currentUserInfo?.chapter`
- **Line 1417**: Missing dependencies for selected actions
- **Line 2170**: Missing `getConsistentName` function
- **Line 2216**: Missing `teamsLoading`

#### Dashboard.tsx:
- **Line 1158**: Missing dependencies for action loading (likely causing the /api/actions loop)
- **Line 1318**: Missing dependencies for leader hierarchy (likely causing the /api/teams loop)
- **Line 2662**: Missing `availableActions` and `currentDateRange`
- **Line 2826**: Missing `currentDateRange`
- **Line 2872**: Missing `ACTIONS`

### 2. Database Errors Contributing to the Issue

Repeated error: `relation "contact_history" does not exist`
- This error occurs every time `/api/contacts` is called
- The error might be causing the frontend to retry the request

### 3. Likely Trigger Points

Based on the API call pattern, the infinite loop is likely triggered by:

1. **Teams data loading** → triggers actions loading
2. **Actions loading** → triggers contacts loading
3. **Contacts loading** → triggers chapters loading
4. **One of these updates state** → triggers teams loading again
5. **Cycle repeats infinitely**

## Specific Problem Areas

### Dashboard.tsx Line 1158
```typescript
useEffect(() => {
  loadActions();
}, [selectedOrganizerId, reloadTrigger, selectedOrganizerInfo?.userId, currentUserInfo?.userId, teamsData]);
```

**Problem**: Missing dependencies that are used inside `loadActions()`:
- `currentUserInfo?.chapter`
- `selectedActionForAdd`
- `selectedOrganizerInfo?.chapter`
- `selectedOrganizerInfo?.firstname`
- `selectedOrganizerInfo?.fullName`

### Dashboard.tsx Line 1318
```typescript
useEffect(() => {
  loadLeaderActionsAndGoals();
}, [leaderHierarchyProp, reloadTrigger, teamsData, selectedOrganizerInfo?.userId, currentUserInfo?.userId]);
```

**Problem**: Missing dependencies:
- `currentUserInfo` (full object)
- `nodes`
- `peopleRecords`
- `selectedOrganizerInfo` (full object)
- `userMap`

## Recommended Fixes

### Priority 1: Fix Dashboard.tsx useEffect Dependencies

1. **Fix Line 1158** - Add all missing dependencies or use useCallback for functions:
```typescript
const loadActions = useCallback(async () => {
  // ... existing code
}, [selectedOrganizerId, selectedOrganizerInfo, currentUserInfo, teamsData]);

useEffect(() => {
  loadActions();
}, [loadActions, reloadTrigger]);
```

2. **Fix Line 1318** - Add missing dependencies:
```typescript
useEffect(() => {
  loadLeaderActionsAndGoals();
}, [
  leaderHierarchyProp, 
  reloadTrigger, 
  teamsData, 
  selectedOrganizerInfo, 
  currentUserInfo,
  nodes,
  peopleRecords,
  userMap
]);
```

### Priority 2: Add Guards to Prevent Redundant Calls

Add guards to prevent calling the same API multiple times:

```typescript
const hasFetchedRef = useRef(false);

useEffect(() => {
  if (hasFetchedRef.current) return;
  
  const loadData = async () => {
    // ... fetch logic
    hasFetchedRef.current = true;
  };
  
  loadData();
}, [dependencies]);
```

### Priority 3: Fix Database Error

Fix the `contact_history` table issue:
- Either create the missing table
- Or update the query to handle the missing table gracefully

## Testing Steps After Fix

1. Open browser console
2. Go to Network tab
3. Filter by XHR/Fetch
4. Refresh the page
5. Verify that each API endpoint is called only ONCE (or a reasonable number of times)
6. Check that no requests repeat continuously

## Expected Behavior After Fix

- `/api/teams` should be called 1-2 times on page load
- `/api/actions` should be called 1-2 times on page load
- `/api/contacts` should be called 1-2 times on page load
- `/api/chapters` should be called 1-2 times on page load
- No continuous repetition of requests

## Current Impact

- **Performance**: Excessive API calls causing slow page load
- **Database load**: Unnecessary database queries
- **User experience**: App may appear to be loading indefinitely
- **Network**: Wasted bandwidth from repeated requests

## Next Steps

1. Apply the recommended fixes to Dashboard.tsx
2. Apply the recommended fixes to MainApp.tsx
3. Test in browser to confirm the loop is resolved
4. Fix the database error for `contact_history` table
5. Monitor server logs to ensure API calls are no longer repeating
