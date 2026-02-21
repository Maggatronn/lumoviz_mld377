# Documentation Index

Quick reference to all documentation files in this project.

## 🚀 Getting Started

### For First-Time Setup
1. **[QUICK_START.md](./QUICK_START.md)** ⭐ START HERE
   - Step-by-step instructions to run locally
   - Prerequisites checklist
   - Common issues and solutions
   - ~5 minute read

### For Understanding the Project
2. **[README.md](./README.md)** 📚 MAIN DOCS
   - Complete project overview
   - Architecture explanation
   - API reference
   - Development guide
   - ~15 minute read

### For New AI Chat Sessions
3. **[NEW_CHAT_CONTEXT.md](./NEW_CHAT_CONTEXT.md)** 🤖 FOR AI
   - Concise context for AI assistants
   - Current state of the project
   - Common patterns and examples
   - Key files and concepts
   - ~10 minute read

---

## 📖 Feature Documentation

### Team Roles Feature
4. **[TEAM_ROLES_IMPLEMENTATION.md](./TEAM_ROLES_IMPLEMENTATION.md)**
   - How team roles work
   - Database schema for roles
   - Frontend/backend implementation
   - Testing checklist
   - Bug fixes applied

---

## 🗄️ Database Documentation

### Database Setup & Migration
5. **[MIGRATION_QUICKSTART.md](./MIGRATION_QUICKSTART.md)**
   - Database migration overview
   - Step-by-step migration guide
   - Cloud SQL setup

6. **[postgres-schema/00_MASTER_SCHEMA.sql](./postgres-schema/00_MASTER_SCHEMA.sql)**
   - Complete PostgreSQL schema
   - All table definitions
   - Indexes and constraints
   - Run this to set up database

### Migration Details
7. **[docs/DATABASE_MIGRATION_PLAN.md](./docs/DATABASE_MIGRATION_PLAN.md)**
   - Detailed migration strategy
   - BigQuery → PostgreSQL conversion notes

8. **[docs/BIGQUERY_TO_POSTGRES_QUERY_GUIDE.md](./docs/BIGQUERY_TO_POSTGRES_QUERY_GUIDE.md)**
   - SQL syntax differences
   - Common conversions
   - Examples

---

## 🎨 Configuration & Customization

### Branding & Terminology
9. **[BRANDING_SETUP.md](./BRANDING_SETUP.md)**
   - How to change organization name
   - Terminology customization
   - Configuration file locations

10. **[TERMINOLOGY_REFACTORING.md](./TERMINOLOGY_REFACTORING.md)**
    - "Chapter" → "Section" terminology change
    - Files affected
    - Implementation notes

11. **[TERMINOLOGY_EXAMPLES.md](./TERMINOLOGY_EXAMPLES.md)**
    - Code examples using new terminology
    - Best practices

---

## 👥 User Management

### User Setup
12. **[USER_LOGIN_GUIDE.md](./USER_LOGIN_GUIDE.md)**
    - How user login works
    - Setting default user
    - Adding new organizers

---

## 🛠️ Troubleshooting

### Setup & Testing
13. **[TEST_SETUP.md](./TEST_SETUP.md)**
    - Common setup issues
    - Testing procedures
    - Database connection troubleshooting

---

## 🏗️ Architecture

### System Architecture
14. **[src/ARCHITECTURE.md](./src/ARCHITECTURE.md)** (if exists)
    - System design overview
    - Component hierarchy
    - Data flow diagrams

---

## 📋 Quick Reference by Use Case

### "I want to..."

| Goal | Document |
|------|----------|
| Run the app for the first time | [QUICK_START.md](./QUICK_START.md) |
| Understand the whole project | [README.md](./README.md) |
| Start a new AI chat session | [NEW_CHAT_CONTEXT.md](./NEW_CHAT_CONTEXT.md) |
| Work on team roles feature | [TEAM_ROLES_IMPLEMENTATION.md](./TEAM_ROLES_IMPLEMENTATION.md) |
| Set up the database | [postgres-schema/00_MASTER_SCHEMA.sql](./postgres-schema/00_MASTER_SCHEMA.sql) |
| Migrate from BigQuery | [MIGRATION_QUICKSTART.md](./MIGRATION_QUICKSTART.md) |
| Change the organization name | [BRANDING_SETUP.md](./BRANDING_SETUP.md) |
| Convert SQL queries | [docs/BIGQUERY_TO_POSTGRES_QUERY_GUIDE.md](./docs/BIGQUERY_TO_POSTGRES_QUERY_GUIDE.md) |
| Troubleshoot setup issues | [TEST_SETUP.md](./TEST_SETUP.md) |
| Add a new user | [USER_LOGIN_GUIDE.md](./USER_LOGIN_GUIDE.md) |

---

## 📝 Documentation Hierarchy

```
📚 Documentation
│
├── 🚀 Quick Start
│   ├── QUICK_START.md          ← Start here
│   └── README.md               ← Full documentation
│
├── 🤖 For AI/Development
│   ├── NEW_CHAT_CONTEXT.md     ← Give this to new AI chats
│   └── DOCS_INDEX.md           ← You are here
│
├── 🎯 Feature Documentation
│   └── TEAM_ROLES_IMPLEMENTATION.md
│
├── 🗄️ Database
│   ├── MIGRATION_QUICKSTART.md
│   ├── postgres-schema/00_MASTER_SCHEMA.sql
│   └── docs/
│       ├── DATABASE_MIGRATION_PLAN.md
│       └── BIGQUERY_TO_POSTGRES_QUERY_GUIDE.md
│
├── 🎨 Configuration
│   ├── BRANDING_SETUP.md
│   ├── TERMINOLOGY_REFACTORING.md
│   └── TERMINOLOGY_EXAMPLES.md
│
└── 🛠️ Troubleshooting
    ├── TEST_SETUP.md
    └── USER_LOGIN_GUIDE.md
```

---

## 🔄 Keeping Documentation Updated

When making significant changes:
1. Update [README.md](./README.md) - main documentation
2. Update [NEW_CHAT_CONTEXT.md](./NEW_CHAT_CONTEXT.md) - if architecture changes
3. Create feature docs like [TEAM_ROLES_IMPLEMENTATION.md](./TEAM_ROLES_IMPLEMENTATION.md) for new features
4. Update this index if you add new documentation files

---

**Last Updated**: February 2026
