# Branding & Terminology Setup

You have **TWO ways** to customize your app's branding and terminology:

## ⚡ Quick Start (Choose One)

### Option 1: Direct Edit (Simple, Immediate)
Edit `src/config/appConfig.ts` directly:

```typescript
export const APP_CONFIG = {
  branding: {
    appName: 'MyApp',                    // ← Change this
    organizationName: 'My Organization', // ← Change this
    organizationShortName: 'MyOrg',      // ← Change this
  },
  terminology: {
    chapter: 'Section',    // ← Change "Chapter" to "Section"
    chapters: 'Sections',
    // ... etc
  },
};
```

**Pros:** Simple, works immediately  
**Cons:** Requires code edit, need to restart dev server

---

### Option 2: Environment Variables (Flexible)
Create a `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your values
REACT_APP_NAME=MyApp
REACT_APP_ORG_NAME=My Organization
REACT_APP_ORG_SHORT_NAME=MyOrg
REACT_APP_TERM_CHAPTER=Section
REACT_APP_TERM_CHAPTERS=Sections
```

**Pros:** No code changes, different settings per environment  
**Cons:** Requires restart to see changes

---

## 🔧 Current Terminology Changes

Based on your requirements:

| Old Term | New Term | Where to Set |
|----------|----------|--------------|
| Chapter | Section | `REACT_APP_TERM_CHAPTER=Section` or edit `appConfig.ts` |
| Chapters | Sections | `REACT_APP_TERM_CHAPTERS=Sections` |
| Carolina Federation | Your Org Name | `REACT_APP_ORG_NAME=Your Org` |
| Carolina | Your Short Name | `REACT_APP_ORG_SHORT_NAME=YourOrg` |

---

## 📝 Step-by-Step: First Time Setup

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your values:**
   ```bash
   # Example for your org
   REACT_APP_NAME=LumoViz
   REACT_APP_ORG_NAME=Durham For All
   REACT_APP_ORG_SHORT_NAME=DFA
   REACT_APP_TERM_CHAPTER=Section
   REACT_APP_TERM_CHAPTERS=Sections
   ```

3. **Restart your dev servers:**
   ```bash
   # Stop both frontend and backend (Ctrl+C)
   # Then restart:
   cd server && npm start &
   cd .. && npm start
   ```

4. **Verify changes:**
   - Open http://localhost:3000
   - Look for "Section" instead of "Chapter"
   - Look for your org name instead of "Carolina Federation"

---

## 🧪 Testing Changes

Before updating all files, test the config:

```typescript
import { TERMS, BRANDING } from './config/appConfig';

console.log(TERMS.chapter);    // "Section"
console.log(BRANDING.orgName); // "Your Organization"
```

---

## 📚 Next Steps

Once you've configured the values:

1. **Remove test users** - We'll update code to hide those hardcoded IDs
2. **Update UI files** - Replace hardcoded strings with config values
3. **Test thoroughly** - Make sure all terminology is consistent

---

## 💡 Tips

- **`.env` is gitignored** - Each developer/deployment can have different values
- **Fallbacks exist** - If no .env value, uses defaults from appConfig.ts
- **Restart required** - Changes to .env require restarting the dev server
- **Production builds** - .env values are baked into the build at compile time

---

## 🚀 What's Next?

Ready to proceed? I'll update example files to show you how to use these config values throughout your app:

1. `MainApp.tsx` - Main application
2. `UnifiedFilter.tsx` - Chapter/Section filters  
3. One dialog component - Form labels

This will establish the pattern, then we can update all remaining files.

**Say "update examples" when ready!**
