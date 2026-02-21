# Context for New AI Chat Session

## What This Project Is

**LumoViz** - A network visualization and organizing tool for MLD 377. React frontend + Node.js backend + PostgreSQL database.

## Current State (Feb 2026)

- ✅ Migrated from BigQuery to PostgreSQL (Cloud SQL)
- ✅ Core features working: people, teams, conversations, meetings
- ✅ Team roles feature (constituent + functional) implemented and working
- ✅ Running locally via Cloud SQL Proxy
- ⏳ Some endpoints still being converted from BigQuery to PostgreSQL

## Tech Stack

- **Frontend**: React + TypeScript + Material-UI (port 3000)
- **Backend**: Node.js + Express (port 3003)
- **Database**: PostgreSQL on Google Cloud SQL
- **Local Dev**: Cloud SQL Proxy connects to remote database

## File Structure

```
server/index.js          → All API endpoints
server/db.js            → PostgreSQL connection pool
server/database.js      → SQL conversion layer (BigQuery → PostgreSQL)
src/components/         → React components
src/services/api.ts     → API client functions
postgres-schema/        → Database schema
```

## How to Run Locally

See [`QUICK_START.md`](./QUICK_START.md) for detailed steps.

**TL;DR**:
1. Terminal 1: `cloud-sql-proxy mld-377:us-central1:lumoviz-db --port 5432`
2. Terminal 2: `cd server && node index.js`
3. Terminal 3: `npm start` (in root)

## Key Concepts

- **Organizers**: Staff and volunteers who organize
- **Contacts**: People being organized
- **Teams**: Groups organized by "Sections" (Alyssa, Ruhee, Edgar, Zoe, Svitlana, Sepi, Teaching)
- **VAN ID**: Primary identifier for people (not always numeric, can be negative like -1771353669243)
- **Roles**: 
  - Constituent Role: Leadership level (Leader, Potential Leader, Member, Supporter)
  - Functional Role: Team function (Team Lead, Co-Lead, Facilitator, etc.)

## Important Database Tables

| Table | Purpose |
|-------|---------|
| `contacts` | Person records |
| `lumoviz_contacts` | Extended contact info + primary organizer mapping |
| `lumoviz_teams` | Team definitions |
| `lumoviz_team_members` | Team membership with roles |
| `lumoviz_team_changelog` | Audit log of changes |
| `conversations` | 1-1 conversation records |
| `org_ids` | Organizer role mappings |

## Common Patterns

### Adding a New API Endpoint

**Backend** (`server/index.js`):
```javascript
app.get('/api/my-endpoint', async (req, res) => {
  const result = await pool.query('SELECT * FROM my_table');
  res.json(result.rows);
});
```

**Frontend** (`src/services/api.ts`):
```typescript
export const fetchMyData = async () => {
  const response = await fetch(`${API_URL}/my-endpoint`);
  return await response.json();
};
```

### Direct PostgreSQL Query
```javascript
const pool = require('./db');
const result = await pool.query('SELECT * FROM table WHERE id = $1', [id]);
return result.rows;
```

### Using Database Abstraction Layer
```javascript
const database = require('./database');
// For BigQuery-style queries that need conversion
const result = await database.query({
  query: 'SELECT * FROM table WHERE id = @id',
  params: { id: someId }
});
```

## Recent Work

### Team Roles Implementation
- Added `constituent_role` and `functional_role` fields to `lumoviz_team_members`
- Display roles as colored chips in team cards (blue = constituent, green = functional)
- Fixed bug where `TeamsPanel.tsx` wasn't passing role data to API
- All team creation/editing now properly saves roles to database

### Fixed Issues
1. **Team edit button**: Now correctly identifies teams by ID
2. **Role fields**: Changed from dropdowns to free text inputs
3. **Role display**: Shows as chips next to member names
4. **Role persistence**: Saves to `lumoviz_team_members` table
5. **Shared purpose**: Now displays in team cards

## Configuration

### Branding/Terminology
Edit `src/config/appConfig.ts`:
```typescript
export const BRANDING = {
  organizationName: 'MLD 377',
  organizationShortName: 'MLD 377'
};

export const TERMS = {
  chapter: 'Section',
  chapters: 'Sections'
};
```

### Sections (Chapters)
Defined in `server/index.js` `/api/chapters` endpoint:
- Alyssa, Ruhee, Edgar, Zoe, Svitlana, Sepi, Teaching

## Debugging

**Server logs**: Check terminal running `node index.js`
**Frontend logs**: Browser console (F12)
**Database**: `psql "host=localhost port=5432 dbname=lumoviz user=lumoviz_app"`

## Known Issues / TODOs

- Some histogram/analytics endpoints still using BigQuery syntax (need conversion)
- Date range filters need refinement
- Need to fully remove hardcoded test user references (101669044, 101680550)
- Consider replacing VAN IDs with new identifier system (future)

## Important Files to Know

| File | What It Does |
|------|-------------|
| `server/index.js` | **Main file** - all API routes, business logic |
| `server/db.js` | PostgreSQL connection (use `pool.query()`) |
| `server/database.js` | Converts BigQuery SQL to PostgreSQL |
| `src/components/MainApp.tsx` | Root component, state management |
| `src/components/visualizations/Dashboard.tsx` | "My View" dashboard |
| `src/components/panels/TeamsPanel.tsx` | Teams display and management |
| `src/components/panels/PeoplePanel.tsx` | People list and filtering |
| `src/services/teamsService.ts` | Teams API client |
| `postgres-schema/00_MASTER_SCHEMA.sql` | Complete database schema |

## Tips for AI Assistant

1. **Always check server logs** when debugging API issues
2. **Use `pool.query()` directly** for simple PostgreSQL queries
3. **Use `database.query()`** for queries with BigQuery syntax that need conversion
4. **Check both frontend AND backend** when debugging - errors can be in either place
5. **Test in browser** after changes - don't just assume it works
6. **PostgreSQL uses `$1, $2, $3`** for parameters, not `@param` (BigQuery style)
7. **VAN IDs are strings**, not always numbers (e.g., "-1771353669243")
8. **Read the terminal output** - lots of helpful logging already in place

## For More Details

- [`README.md`](./README.md) - Full documentation
- [`QUICK_START.md`](./QUICK_START.md) - Step-by-step setup guide  
- [`TEAM_ROLES_IMPLEMENTATION.md`](./TEAM_ROLES_IMPLEMENTATION.md) - Team roles feature details
- [`MIGRATION_QUICKSTART.md`](./MIGRATION_QUICKSTART.md) - Database migration guide

---

**Last Updated**: February 2026

**Current Status**: App is working locally. Main features functional. Team roles feature complete and saving correctly.
