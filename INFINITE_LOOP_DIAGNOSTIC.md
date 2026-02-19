# Infinite Loop Diagnostic Guide

## ✅ DIAGNOSIS COMPLETE - Infinite Loop Confirmed

**Status**: Infinite API call loop detected via server log analysis  
**Affected APIs**: `/api/teams`, `/api/actions`, `/api/contacts`, `/api/chapters`  
**Root Cause**: Missing dependencies in useEffect hooks in Dashboard.tsx and MainApp.tsx

See `INFINITE_LOOP_ANALYSIS.md` for detailed analysis and fixes.

---

## How to Check for Infinite Loading in Browser

### 1. Open Browser Console
1. Navigate to http://localhost:3000
2. Open Developer Tools (F12 or Cmd+Option+I on Mac)
3. Go to the **Console** tab
4. Look for:
   - Repeated console.log messages appearing continuously
   - Error messages repeating
   - Warning messages about too many re-renders

### 2. Check Network Tab
1. In Developer Tools, go to the **Network** tab
2. Look for:
   - Same API endpoints being called repeatedly (every few seconds)
   - Requests that never stop
   - Pay attention to these endpoints:
     - `/api/meetings/by-contacts`
     - `/api/actions`
     - `/api/teams`
     - `/api/organizers`
     - `/api/chapters`
3. Take note of:
   - Request frequency (how often they repeat)
   - Which endpoint is being called most
   - Response status codes

### 3. React DevTools Profiler
1. Install React DevTools extension if not already installed
2. Open React DevTools
3. Go to **Profiler** tab
4. Click "Record" and watch for:
   - Components rendering repeatedly
   - High render counts on specific components

## Known Issues from Code Analysis

Based on the linter warnings, these useEffect hooks have missing dependencies that could cause infinite loops:

### MainApp.tsx
1. **Line 283**: Missing dependencies `handleURLFiltersChange` and `unifiedFilters`
2. **Line 1176**: Missing dependencies `currentUserId` and `currentUserInfo?.chapter`
3. **Line 1417**: Missing dependencies related to selected actions

### Dashboard.tsx
1. **Line 1158**: Missing dependencies for action loading
2. **Line 1318**: Missing dependencies for leader hierarchy loading
3. **Line 2662**: Missing dependencies `availableActions` and `currentDateRange`
4. **Line 2826**: Missing dependency `currentDateRange`
5. **Line 2872**: Missing dependency `ACTIONS`

## Common Patterns That Cause Infinite Loops

1. **State updates in useEffect without proper dependencies**
   ```tsx
   useEffect(() => {
     setState(someValue); // This triggers re-render
   }, [someValue]); // someValue changes, triggers effect, which changes someValue...
   ```

2. **Object/Array dependencies that are recreated on each render**
   ```tsx
   const myObject = { key: value }; // New object every render
   useEffect(() => {
     // Do something
   }, [myObject]); // Triggers on every render because myObject is always new
   ```

3. **Missing dependencies in useEffect**
   ```tsx
   useEffect(() => {
     doSomething(prop); // Uses prop but not in dependency array
   }, []); // Should include [prop]
   ```

## What to Screenshot

Please take screenshots of:
1. **Console tab** - showing any repeated messages
2. **Network tab** - showing the list of API calls (filter by XHR/Fetch)
3. **Network tab timeline** - showing if requests are continuous
4. **React DevTools Profiler** - showing component render counts

## Quick Fix Attempts

If you identify which useEffect is causing the issue, try:
1. Adding missing dependencies to the dependency array
2. Using `useCallback` or `useMemo` to stabilize function/object references
3. Adding guards to prevent unnecessary state updates:
   ```tsx
   useEffect(() => {
     if (condition && !hasAlreadyFetched) {
       fetchData();
     }
   }, [dependencies]);
   ```

## Next Steps

After gathering the diagnostic information:
1. Share screenshots of Console and Network tabs
2. Note which API endpoint is being called repeatedly
3. Note any error messages in the console
4. Check if the app is usable or completely frozen
