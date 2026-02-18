# User Login Guide

## How "Login" Works in LumoViz

LumoViz doesn't have a traditional login system. Instead, you **select an organizer from the dropdown** to view their dashboard.

---

## 🚀 Quick Start

1. **Open the app:** http://localhost:3000
2. **Click "Dashboard" tab** in the top navigation
3. **You'll see:** "Dashboard" title with a dropdown that says "Select an organizer to view dashboard"
4. **Click the dropdown** and select **"Maggie Hughes"**
5. **The page will update** to show "Maggie View" and her personal dashboard

---

## 👤 Current Test User

**Name:** Maggie Hughes  
**VAN ID:** 100001  
**Chapter:** Main Chapter  
**Email:** maggie@mld377.org

---

## 📝 How to Add More Test Users

### Option 1: Use the UI (Recommended)
1. Select an organizer (Maggie Hughes)
2. Click **"Add Person"** button
3. Fill in the form with organizer details
4. The new person will be added to the database

### Option 2: Run SQL Script
Edit `server/seed-test-user.sql` and add more users, then run:
```bash
cd server
psql "host=localhost port=5432 dbname=lumoviz user=lumoviz_app password=YOUR_PASSWORD" -f seed-test-user.sql
```

### Option 3: Use the seed script template
```sql
-- Add another organizer
INSERT INTO org_ids (vanid, userid, firstname, lastname, email, chapter, type)
VALUES ('100002', 'john_smith', 'John', 'Smith', 'john@mld377.org', 'Main Chapter', 'organizer');

INSERT INTO lumoviz_organizer_mapping (
  mapping_id, organizer_vanid, canonical_organizer_vanid, 
  primary_vanid, preferred_name, person_type
)
VALUES (
  gen_random_uuid()::text, '100002', '100002',
  '100002', 'John Smith', 'organizer'
);
```

---

## 🔄 Switching Users

1. **Use the dropdown** at the top of the Dashboard
2. Select a different organizer name
3. The dashboard instantly updates to show that person's view

**The selected organizer is saved** in your browser's localStorage, so it persists between page refreshes.

---

## 🧪 Testing the Add Person Feature

Now that you have Maggie as an organizer:

1. **Select Maggie Hughes** from the dropdown
2. **Click "Add Person"** button
3. **Fill in the form:**
   - First Name: (e.g., "Jane")
   - Last Name: (e.g., "Doe")
   - **Chapter/Section:** Select "Main Chapter" (or any chapter you want)
   - Email: (optional)
   - Phone: (optional)
   - VAN ID: (optional)
4. **Click "Save"**
5. The person should be added to the database

---

## 🎯 What You Can Do Now

✅ **View Dashboard** - Select Maggie to see her dashboard  
✅ **Add People** - Use "Add Person" button to add contacts  
✅ **Log Conversations** - Use "Log Conversation" button to record 1:1s  
✅ **Create Teams** - (If you have multiple organizers)  
✅ **Set Goals** - Track progress toward goals  

---

## 🔒 Future: Real Authentication

For production, you'll want to add real authentication:

**Options:**
- **Google OAuth** - Sign in with Google
- **Email/Password** - Traditional login
- **SSO** - Single Sign-On integration
- **JWT tokens** - Secure API access

**For now:** The dropdown "login" works fine for testing and development!

---

## 💡 Pro Tips

- **Clear localStorage:** If the wrong user is selected by default, open browser DevTools > Application > Local Storage > Clear
- **Test with multiple users:** Add 2-3 test organizers to test team features
- **Use the URL:** You can bookmark specific views (e.g., `?organizer=Maggie+Hughes`)

---

## ✅ Verification Checklist

- [ ] Can you see "Dashboard" title (not "Courtney View")?
- [ ] Can you see dropdown with "Select an organizer to view dashboard"?
- [ ] Can you see "Maggie Hughes" in the dropdown?
- [ ] When you select Maggie, does it say "Maggie View"?
- [ ] Are "Add Person" and "Log Conversation" buttons clickable?

If you see all ✅, you're ready to test!
