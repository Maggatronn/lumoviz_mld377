# Quick Start Guide - Running LumoViz Locally

## Prerequisites Check

Before you start, make sure you have:
- [ ] Node.js installed (`node --version` should show v16+)
- [ ] Cloud SQL Proxy installed and configured
- [ ] PostgreSQL client tools (for database access)

## Step-by-Step Setup

### Terminal 1: Start Cloud SQL Proxy

```bash
cloud-sql-proxy mld-377:us-central1:lumoviz-db --port 5432
```

✅ **Leave this running!** You should see: `Ready for new connections`

---

### Terminal 2: Start Backend Server

```bash
cd /Users/maggiehughes/Desktop/MLD\ 377\ 2026/lumoviz/server

# First time only: Install dependencies
npm install

# Make sure .env file exists with database password
# (Should already be there)

# Start the server
node index.js
```

✅ **Leave this running!** You should see: `✅ Connected to PostgreSQL database`

The backend runs on **http://localhost:3003**

---

### Terminal 3: Start Frontend

```bash
cd /Users/maggiehughes/Desktop/MLD\ 377\ 2026/lumoviz

# First time only: Install dependencies
npm install

# Start React app
npm start
```

✅ **Your browser will open automatically** to **http://localhost:3000**

---

## You're Done! 🎉

The app should now be running. You'll see:
- **Default user**: Maggie Hughes
- **My View**: Your dashboard
- **Teams Panel**: On the right side

---

## Common Issues

### "Port 3003 already in use"
```bash
lsof -ti:3003 | xargs kill -9
```
Then restart the backend server.

### "Connection refused" or database errors
1. Make sure Cloud SQL Proxy (Terminal 1) is running
2. Check that you see "Ready for new connections"
3. Restart the backend server (Terminal 2)

### Can't find Cloud SQL Proxy
```bash
# Download and install
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.7.0/cloud-sql-proxy.darwin.amd64
chmod +x cloud-sql-proxy
sudo mv cloud-sql-proxy /usr/local/bin/
```

---

## Quick Commands Reference

| Task | Command |
|------|---------|
| Kill backend server | `lsof -ti:3003 \| xargs kill -9` |
| Check database | `psql "host=localhost port=5432 dbname=lumoviz user=lumoviz_app"` |
| View server logs | Check Terminal 2 output |
| View browser logs | Press F12 → Console tab |
| Restart everything | Ctrl+C in all terminals, then restart each |

---

## Testing Your Setup

Once everything is running:

1. ✅ Open http://localhost:3000
2. ✅ You should see "Maggie Hughes" as the logged-in user
3. ✅ Try clicking "Add Team" in the Teams Panel
4. ✅ Create a test team with a name and team lead
5. ✅ The team should appear in the Teams Panel

If you can do all of the above, **your setup is working correctly!** ✨

---

## What Each Terminal Does

| Terminal | What's Running | Port |
|----------|---------------|------|
| Terminal 1 | Cloud SQL Proxy (database tunnel) | 5432 |
| Terminal 2 | Backend API server (Node.js/Express) | 3003 |
| Terminal 3 | Frontend dev server (React) | 3000 |

**All three must be running for the app to work.**

---

## Next Steps

- Read the full [README.md](./README.md) for architecture details
- Check [TEAM_ROLES_IMPLEMENTATION.md](./TEAM_ROLES_IMPLEMENTATION.md) for team roles feature
- See [postgres-schema/00_MASTER_SCHEMA.sql](./postgres-schema/00_MASTER_SCHEMA.sql) for database schema

---

**Questions?** Check the server logs (Terminal 2) and browser console (F12) for error messages.
