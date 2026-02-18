# Test Setup & Troubleshooting Guide

## Current Issues Fixed
✅ People showing in People Panel
✅ Primary organizer field added to contacts
✅ Team dialogs now load people without requiring search
✅ "Chapter" changed to "Section" throughout app

## Remaining Issues

### 1. Database Connection Drops
**Problem**: Cloud SQL Proxy connection terminates unexpectedly after some time.

**Solution**: Restart both proxy and server together:

```bash
# Kill existing processes
pkill -f cloud-sql-proxy && pkill -f "node index.js"

# Wait a moment
sleep 3

# Restart Cloud SQL Proxy
cloud-sql-proxy $(cat ~/lumoviz-connection-name.txt) > /tmp/cloud-sql-proxy.log 2>&1 &

# Wait for proxy to be ready
sleep 3

# Restart server
cd "/Users/maggiehughes/Desktop/MLD 377 2026/lumoviz/server"
npm start > /tmp/lumoviz-server.log 2>&1 &
```

### 2. My View - Showing People

People will appear in "My View" if **EITHER**:
- You've had conversations with them, OR
- You're set as their primary organizer

**To set primary organizer for existing people:**

```bash
# Connect to database
psql "host=localhost port=5432 dbname=lumoviz user=lumoviz_app password=YOUR_PASSWORD"

# Set Maggie Hughes (100001) as primary organizer for a person
INSERT INTO lumoviz_contacts (vanid, primary_organizer_vanid, created_at, updated_at) 
VALUES ('PERSON_VANID', '100001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
ON CONFLICT (vanid) DO UPDATE 
SET primary_organizer_vanid = '100001', updated_at = CURRENT_TIMESTAMP;
```

**Current test data with primary organizer set:**
- Sarah Johnson: `-1771296532199` → Maggie (100001)
- Emily Lin: `-1771296068498` → Maggie (100001)  
- Jenny Jean: `-1771297679125` → Maggie (100001)

### 3. Team Dialogs

**Fixed**: Team Lead and Member dropdowns now show all people immediately when you click them (no need to type first).

If people still don't show:
1. Refresh the browser
2. Check that `sharedAllContacts` has data (see browser console)
3. Restart server if needed

## Test Checklist

After restarting server, test:

1. ✅ **People Panel**: Shows all 5 people
2. ⏳ **My View**: Select "Maggie Hughes" - should show 3 people (Sarah, Emily, Jenny)
3. ⏳ **Add Team Dialog**: Click "Add New Team", click Team Lead dropdown - should show all 5 people
4. ⏳ **Search in Team Dialog**: Type "Sarah" - should show Sarah Johnson

## Quick Server Health Check

```bash
# Check if server is running
curl http://localhost:3003/api/contacts?limit=1

# Expected: JSON response with pagination and data

# Check logs
tail -20 /tmp/lumoviz-server.log
```

## Current People in Database

1. Maggie Hughes (100001) - Main Chapter - Organizer
2. Sarah Johnson (-1771296532199) - Primary Org: Maggie
3. Test Person (-1771295994317) - No primary org
4. Emily Lin (-1771296068498) - Primary Org: Maggie
5. Jenny Jean (-1771297679125) - Primary Org: Maggie
