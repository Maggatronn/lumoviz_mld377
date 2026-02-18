# 🎯 Campaign System - Database Migration Guide

## Overview
Connect campaigns from hard-coded frontend to your existing BigQuery tables.

## Your Existing Tables ✅
- `lumoviz_campaigns` - Campaign definitions
- `lumoviz_campaign_goals` - Goals (org-wide when chapter=NULL, chapter-specific otherwise)
- `lumoviz_campaign_milestons` - Timeline milestones (note typo)

---

## 🚀 Quick Start (Run These)

### 1. Seed Campaigns
```bash
seed_campaigns_actual_schema.sql
```
Loads Spring 2026 campaign with org and chapter goals

### 2. Add Template Support
```bash
add_action_templates.sql
```
**⚠️ Run each statement ONE AT A TIME** (BigQuery limitation)

### 3. Restart Server
Backend now has `/api/campaigns` endpoint!

### 4. Test It
```bash
curl http://localhost:5006/api/campaigns
```

---

## 🎯 Goal Hierarchy (How It Works)

```
Campaign: "Spring 2026 Organizing Drive"
  │
  ├─ Org-Wide Goal: 132 team members (chapter = NULL)
  │   ├─ Durham Chapter: 25 team members (chapter = 'Durham For All')
  │   │   ├─ Courtney: 5 (personal goal in lumoviz_organizer_goals)
  │   │   └─ Cedric: 7
  │   └─ Raleigh Chapter: 30 team members
  │
  └─ Org-Wide Goal: 1760 pledges
      └─ Durham Chapter: 360 pledges
```

---

## 📊 Template System

### Campaign Templates (Blue)
- `is_template = TRUE`
- `organizer_vanid = NULL`
- Defined at campaign level
- Example: "Leadership Registration"

### Personal Actions (Purple)
- `is_template = FALSE`
- `organizer_vanid = [your ID]`
- `template_action_id = [template ID]` (if adopted from template)
- Example: Courtney's instance of "Leadership Registration"

---

## 🔍 Quick Checks

**See your campaigns:**
```sql
SELECT * FROM `chapter-448015.lumoviz.lumoviz_campaigns`;
```

**See goals (org + chapter):**
```sql
SELECT campaign_id, goal_type, goal_name, target_value, chapter
FROM `chapter-448015.lumoviz.lumoviz_campaign_goals`
ORDER BY campaign_id, chapter NULLS FIRST;
```

**See your actions:**
```sql
SELECT action_id, action_name, parent_campaign_id, goal_type, 
       is_template, template_action_id, organizer_vanid
FROM `chapter-448015.lumoviz.lumoviz_actions`
WHERE is_active = TRUE
ORDER BY created_at DESC;
```

---

## ✅ Next Steps

After running migrations:
1. Frontend will load campaigns from database
2. Campaign templates will show with blue "Use" button
3. Personal actions will show purple "Personal" badge
4. Campaign Barometer will aggregate properly (47/132)

Ready? Run the SQL files and let me know! 🎯
