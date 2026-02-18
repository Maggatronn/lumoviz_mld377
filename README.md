# LumoViz - Organizing Network Visualization Tool

A React + Node.js application for visualizing and managing organizing networks, teams, and member relationships for MLD 377.

## 🚀 Quick Start - Running Locally

### Prerequisites

- **Node.js** (v16 or higher)
- **PostgreSQL** (v14 or higher)
- **Google Cloud SDK** (`gcloud` CLI)
- **Cloud SQL Proxy** (for local database connection)

### 1. Database Setup

#### Start Cloud SQL Proxy (in a separate terminal)
```bash
cloud-sql-proxy mld-377:us-central1:lumoviz-db --port 5432
```

Keep this running while you work.

### 2. Backend Setup

```bash
cd server

# Install dependencies
npm install

# Set up environment variables
# Create server/.env with:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lumoviz
DB_USER=lumoviz_app
DB_PASSWORD="your-password-here"

# Start the backend server (port 3003)
node index.js
```

### 3. Frontend Setup

```bash
# In the root directory (separate terminal)
npm install

# Start the React dev server (port 3000)
npm start
```

### 4. Access the Application

Open your browser to: **http://localhost:3000**

Default user: **Maggie Hughes** (automatically selected)

---

## 📁 Project Structure

```
lumoviz/
├── server/                      # Backend (Node.js/Express)
│   ├── index.js                # Main server file, API routes
│   ├── database.js             # Database abstraction layer (BQ → PG conversion)
│   ├── db.js                   # PostgreSQL connection pool
│   └── .env                    # Environment variables (create this)
│
├── src/                        # Frontend (React/TypeScript)
│   ├── components/
│   │   ├── visualizations/     # Main views (Dashboard, NetworkGraph, etc.)
│   │   ├── panels/             # Side panels (PeoplePanel, TeamsPanel, etc.)
│   │   └── dialogs/            # Modal dialogs (AddTeamDialog, EditTeamDialog, etc.)
│   ├── services/
│   │   ├── api.ts              # API client functions
│   │   └── teamsService.ts     # Teams-specific API calls
│   └── config/
│       └── appConfig.ts        # Centralized app configuration
│
├── postgres-schema/            # Database schema files
│   └── 00_MASTER_SCHEMA.sql   # Complete PostgreSQL schema
│
└── docs/                       # Documentation
```

---

## 🗄️ Database

### Technology
- **Current**: PostgreSQL (Cloud SQL)
- **Previous**: BigQuery (migration in progress)

### Key Tables

| Table | Purpose |
|-------|---------|
| `contacts` | Person records (VAN ID, name, email, etc.) |
| `lumoviz_contacts` | Extended contact info (primary organizer mapping) |
| `lumoviz_teams` | Team definitions (name, chapter, purpose, norms) |
| `lumoviz_team_members` | Team membership with roles (constituent + functional) |
| `lumoviz_team_changelog` | Audit log of all team changes |
| `conversations` | 1-1 conversation records |
| `lumoviz_meetings` | Meeting/event records |
| `org_ids` | Organizer mappings and roles |

### Database Connection

The app connects to Cloud SQL via:
1. **Local Development**: Cloud SQL Proxy → localhost:5432
2. **Production**: Direct Cloud SQL connection (Cloud Run)

Connection config is in `server/db.js` using the `pg` package.

---

## 🏗️ How It Works

### Architecture Overview

```
Browser (React)
    ↓ HTTP
Express Backend (Node.js)
    ↓ SQL
PostgreSQL (Cloud SQL)
```

### Data Flow

1. **Frontend** makes API calls via `services/api.ts` or `services/teamsService.ts`
2. **Backend** receives requests at `server/index.js` (Express routes)
3. **Database Layer** (`server/database.js`) converts BigQuery SQL → PostgreSQL SQL
4. **PostgreSQL** (`server/db.js`) executes queries and returns data
5. **Backend** sends JSON response back to frontend
6. **Frontend** renders data in React components

### Key Concepts

- **Organizers**: People who organize (staff, volunteers)
- **Contacts**: People being organized (members, supporters)
- **Teams**: Groups of organizers with specific sections/chapters
- **Sections**: Organizational divisions (Alyssa, Ruhee, Edgar, Zoe, Svitlana, Sepi, Teaching)
- **Roles**: 
  - **Constituent Role**: Leadership level (Leader, Potential Leader, Member, Supporter)
  - **Functional Role**: Team function (Team Lead, Co-Lead, Facilitator, Communications, etc.)

---

## 🔧 Common Tasks

### Add a New API Endpoint

1. Add route in `server/index.js`:
   ```javascript
   app.get('/api/my-endpoint', async (req, res) => {
     const result = await pool.query('SELECT * FROM my_table');
     res.json(result.rows);
   });
   ```

2. Add client function in `src/services/api.ts`:
   ```typescript
   export const fetchMyData = async () => {
     const response = await fetch(`${API_URL}/my-endpoint`);
     return await response.json();
   };
   ```

### Update the Database Schema

1. Write SQL migration in `postgres-schema/`
2. Apply via Cloud SQL Proxy:
   ```bash
   psql "host=localhost port=5432 dbname=lumoviz user=lumoviz_app" -f postgres-schema/my-migration.sql
   ```

### Change Branding/Terminology

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

---

## 🐛 Troubleshooting

### "Connection refused" errors
- ✅ Check Cloud SQL Proxy is running
- ✅ Check backend server is running (`node index.js`)
- ✅ Verify `server/.env` has correct database credentials

### "Command not found: psql"
```bash
brew install postgresql@15
```

### Port 3003 already in use
```bash
lsof -ti:3003 | xargs kill -9
```

### Team roles not saving
- ✅ Verify `lumoviz_team_members` table exists
- ✅ Check server logs for `[POST /api/teams]` output
- ✅ Ensure `teamLeadData` and `teamMembersData` are being sent in request

---

## 📝 Development Notes

### Current Migration Status
- ✅ Core database migrated from BigQuery to PostgreSQL
- ✅ Teams, contacts, meetings, conversations working
- ✅ Team roles (constituent + functional) implemented
- ⏳ Some endpoints still need BigQuery → PostgreSQL conversion

### Environment Variables

#### Backend (`server/.env`)
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lumoviz
DB_USER=lumoviz_app
DB_PASSWORD="your-password-here"
```

#### Frontend (`.env` - optional)
```env
REACT_APP_ORGANIZATION_NAME="MLD 377"
REACT_APP_ORGANIZATION_SHORT_NAME="MLD 377"
```

---

## 📚 Key Files Reference

| File | Purpose |
|------|---------|
| `server/index.js` | All API endpoints, main backend logic |
| `server/database.js` | SQL dialect conversion (BigQuery → PostgreSQL) |
| `server/db.js` | PostgreSQL connection pool |
| `src/components/MainApp.tsx` | Main app component, state management |
| `src/components/visualizations/Dashboard.tsx` | "My View" dashboard |
| `src/components/panels/PeoplePanel.tsx` | People list and filtering |
| `src/components/panels/TeamsPanel.tsx` | Teams display and management |
| `src/services/teamsService.ts` | Teams API client |
| `postgres-schema/00_MASTER_SCHEMA.sql` | Complete database schema |

---

## 🎯 Quick Reference: Teams with Roles

### Creating a Team with Roles

1. Click "Add Team" button
2. Fill in team details:
   - Team Name
   - Team Lead (select person)
   - **Constituent Role** (text field): e.g., "Leader", "Potential Leader"
   - **Functional Role** (text field): e.g., "Team Lead", "Co-Lead"
   - Team Members (select people)
   - For each member, assign roles
3. Save

### Where Roles are Stored

- **Database**: `lumoviz_team_members` table
  - `member_vanid`: Person's VAN ID
  - `constituent_role`: Leadership level role
  - `functional_role`: Team function role

- **Display**: Team cards show roles as colored chips
  - 🔵 Blue chip = Constituent Role
  - 🟢 Green chip = Functional Role

### API Endpoints

- `POST /api/teams` - Create team (saves to `lumoviz_teams` + `lumoviz_team_members`)
- `GET /api/teams` - Get all teams (includes `teamMembersWithRoles` array)
- `PUT /api/teams/:id` - Update team and roles

---

## 📖 More Documentation

- [`MIGRATION_QUICKSTART.md`](./MIGRATION_QUICKSTART.md) - Database migration guide
- [`TEAM_ROLES_IMPLEMENTATION.md`](./TEAM_ROLES_IMPLEMENTATION.md) - Team roles implementation details
- [`docs/SETUP_NEW_INSTANCE.md`](./docs/SETUP_NEW_INSTANCE.md) - Cloud deployment setup

---

## 💡 For Future Development

When starting work on this codebase, use this README to get oriented. Key things to know:

1. **Backend is at `server/index.js`** - All API routes are there
2. **PostgreSQL connection** via `server/db.js` using `pg` package
3. **Database abstraction** in `server/database.js` converts BigQuery SQL to PostgreSQL
4. **Direct queries** use `pool.query(sql, params)` when conversion isn't needed
5. **Frontend state** managed in `MainApp.tsx`, passed down to components
6. **Sections** (formerly "Chapters") are: Alyssa, Ruhee, Edgar, Zoe, Svitlana, Sepi, Teaching

**The codebase is actively being migrated from BigQuery to PostgreSQL. Most core features work, but some queries may still reference BigQuery syntax.**

---

## 🆘 Getting Help

If you encounter issues:
1. Check server logs (terminal running `node index.js`)
2. Check browser console (F12 → Console tab)
3. Verify Cloud SQL Proxy is running
4. Check database with: `psql "host=localhost port=5432 dbname=lumoviz user=lumoviz_app"`

**Last Updated**: February 2026
