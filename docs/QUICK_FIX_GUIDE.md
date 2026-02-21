# Quick Fix Guide - Infinite Loop Issue

## 🎯 Problem Summary

Your lumoviz app has an **infinite loop** caused by missing dependencies in React useEffect hooks. This causes the same API calls to repeat continuously:

- `/api/teams` → `/api/actions` → `/api/contacts` → `/api/chapters` → (repeats infinitely)

## 🔧 Quick Fixes

### Fix #1: Dashboard.tsx - Line 1158 (CRITICAL)

**Current Code:**
```typescript
useEffect(() => {
  const loadActions = async () => {
    // ... code that uses currentUserInfo?.chapter, selectedOrganizerInfo, etc.
  };
  
  loadActions();
}, [selectedOrganizerId, reloadTrigger, selectedOrganizerInfo?.userId, currentUserInfo?.userId, teamsData]);
```

**Fixed Code:**
```typescript
useEffect(() => {
  const loadActions = async () => {
    // ... existing code
  };
  
  loadActions();
}, [
  selectedOrganizerId, 
  reloadTrigger, 
  selectedOrganizerInfo?.userId, 
  selectedOrganizerInfo?.chapter,
  selectedOrganizerInfo?.firstname,
  selectedOrganizerInfo?.fullName,
  currentUserInfo?.userId,
  currentUserInfo?.chapter,
  teamsData,
  selectedActionForAdd
]);
```

### Fix #2: Dashboard.tsx - Line 1318 (CRITICAL)

**Current Code:**
```typescript
useEffect(() => {
  const loadLeaderActionsAndGoals = async () => {
    // ... code that uses currentUserInfo, nodes, peopleRecords, userMap
  };
  
  loadLeaderActionsAndGoals();
}, [leaderHierarchyProp, reloadTrigger, teamsData, selectedOrganizerInfo?.userId, currentUserInfo?.userId]);
```

**Fixed Code:**
```typescript
useEffect(() => {
  const loadLeaderActionsAndGoals = async () => {
    // ... existing code
  };
  
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

### Fix #3: MainApp.tsx - Line 283

**Current Code:**
```typescript
useEffect(() => {
  if (campaignViewTab || campaignMetric || barometerActions.length > 0 || barometerSort || barometerSortDir || currentVisualization) {
    const updatedFilters = {
      // ... uses handleURLFiltersChange and unifiedFilters
    };
    handleURLFiltersChange(updatedFilters);
  }
}, [campaignViewTab, campaignMetric, barometerActions, barometerSort, barometerSortDir, currentVisualization]);
```

**Fixed Code:**
```typescript
useEffect(() => {
  if (campaignViewTab || campaignMetric || barometerActions.length > 0 || barometerSort || barometerSortDir || currentVisualization) {
    const updatedFilters = {
      // ... existing code
    };
    handleURLFiltersChange(updatedFilters);
  }
}, [
  campaignViewTab, 
  campaignMetric, 
  barometerActions, 
  barometerSort, 
  barometerSortDir, 
  currentVisualization,
  handleURLFiltersChange,
  unifiedFilters
]);
```

**Note**: You may also need to wrap `handleURLFiltersChange` in `useCallback` to prevent it from changing on every render.

### Fix #4: MainApp.tsx - Line 1176

**Current Code:**
```typescript
useEffect(() => {
  const loadTemplateActions = async () => {
    // ... uses currentUserId and currentUserInfo?.chapter
  };
  
  loadTemplateActions();
}, []);
```

**Fixed Code:**
```typescript
useEffect(() => {
  const loadTemplateActions = async () => {
    // ... existing code
  };
  
  loadTemplateActions();
}, [currentUserId, currentUserInfo?.chapter]);
```

## 🛡️ Better Approach: Use useCallback

To prevent functions from causing dependency issues, wrap them in `useCallback`:

**Example:**
```typescript
const handleURLFiltersChange = useCallback((filters) => {
  // ... existing code
}, [/* dependencies that the function uses */]);

const loadActions = useCallback(async () => {
  // ... existing code
}, [selectedOrganizerId, currentUserInfo, teamsData]);

useEffect(() => {
  loadActions();
}, [loadActions, reloadTrigger]);
```

## 🧪 How to Test the Fix

1. **Apply the fixes** to Dashboard.tsx and MainApp.tsx
2. **Save the files** - the dev server should auto-reload
3. **Open browser** to http://localhost:3000
4. **Open Developer Tools** (F12 or Cmd+Option+I)
5. **Go to Network tab**
6. **Refresh the page**
7. **Watch the Network tab**:
   - ✅ Each API should be called 1-2 times
   - ✅ No continuous repetition
   - ✅ Network activity should stop after initial load

## 📊 Expected Results After Fix

### Before Fix (Current State):
```
/api/teams → /api/actions → /api/contacts → /api/chapters
/api/teams → /api/actions → /api/contacts → /api/chapters  ← REPEAT
/api/teams → /api/actions → /api/contacts → /api/chapters  ← REPEAT
... (infinite)
```

### After Fix (Expected):
```
/api/teams → /api/actions → /api/contacts → /api/chapters
(done - no more requests)
```

## 🚨 If the Loop Persists

If the infinite loop continues after applying these fixes:

1. **Check browser console** for any error messages
2. **Look for other useEffect hooks** that might be missing dependencies
3. **Use React DevTools Profiler** to identify which component is re-rendering
4. **Add console.log statements** inside useEffect hooks to see which one is triggering repeatedly

## 📝 Additional Fixes Needed

### Fix the Database Error

You also have a database error that appears in the logs:

```
Database query error: relation "contact_history" does not exist
```

This error occurs every time `/api/contacts` is called. While it's not causing the infinite loop, it should be fixed:

**Option 1**: Create the missing `contact_history` table
**Option 2**: Update the query to handle the missing table gracefully:

```javascript
// In your server code
try {
  const result = await db.query(`
    SELECT MIN(utc_datecanvassed) as min_date,
           MAX(utc_datecanvassed) as max_date
    FROM contact_history
    WHERE utc_datecanvassed IS NOT NULL
  `);
  return result.rows[0];
} catch (error) {
  if (error.message.includes('does not exist')) {
    // Return default values if table doesn't exist
    return { min_date: null, max_date: null };
  }
  throw error;
}
```

## 🎯 Priority Order

1. **Fix Dashboard.tsx Line 1158** (CRITICAL - likely main cause)
2. **Fix Dashboard.tsx Line 1318** (CRITICAL - likely main cause)
3. **Fix MainApp.tsx Line 283** (HIGH)
4. **Fix MainApp.tsx Line 1176** (MEDIUM)
5. **Fix database error** (LOW - not causing loop but should be fixed)

## ✅ Success Criteria

After applying the fixes, you should see:
- ✅ Page loads completely
- ✅ No continuous API calls in Network tab
- ✅ CPU usage returns to normal
- ✅ No repeated console.log messages
- ✅ App is responsive and usable

## 📚 Related Documents

- `INFINITE_LOOP_ANALYSIS.md` - Detailed analysis of the issue
- `BROWSER_CONSOLE_SIMULATION.md` - What you would see in browser
- `INFINITE_LOOP_DIAGNOSTIC.md` - Diagnostic guide and checklist
