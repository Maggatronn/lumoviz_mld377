/**
 * Application Configuration
 * Centralized place for branding, terminology, and application-wide settings
 * 
 * To rebrand the app, you have TWO options:
 * 1. Edit values directly in this file (simple, works immediately)
 * 2. Create a .env file with REACT_APP_* variables (flexible, no code changes needed)
 *    - Copy .env.example to .env and customize
 *    - Environment variables override values here
 */

export const APP_CONFIG = {
  // ============================================================
  // BRANDING
  // ============================================================
  branding: {
    appName: process.env.REACT_APP_NAME || 'LumoViz',
    organizationName: process.env.REACT_APP_ORG_NAME || 'MLD 377',
    organizationShortName: process.env.REACT_APP_ORG_SHORT_NAME || 'MLD 377',
  },

  // ============================================================
  // TERMINOLOGY
  // ============================================================
  terminology: {
    // Organizational structure
    chapter: process.env.REACT_APP_TERM_CHAPTER || 'Section',           // TODO: Customize (was "Chapter")
    chapters: process.env.REACT_APP_TERM_CHAPTERS || 'Sections',        // Plural form
    chapterLabel: process.env.REACT_APP_TERM_CHAPTER || 'Section',      // For form labels
    
    // People roles
    organizer: process.env.REACT_APP_TERM_ORGANIZER || 'Organizer',
    organizers: process.env.REACT_APP_TERM_ORGANIZERS || 'Organizers',
    constituent: 'Constituent',
    constituents: 'Constituents',
    leader: 'Leader',
    leaders: 'Leaders',
    
    // Activities
    conversation: 'Conversation',
    conversations: 'Conversations',
    meeting: process.env.REACT_APP_TERM_MEETING || '1:1',
    meetings: process.env.REACT_APP_TERM_MEETINGS || '1:1s',
    action: 'Action',
    actions: 'Actions',
    campaign: 'Campaign',
    campaigns: 'Campaigns',
    
    // Other
    team: 'Team',
    teams: 'Teams',
    goal: 'Goal',
    goals: 'Goals',
  },

  // ============================================================
  // DEMO/TEST DATA
  // ============================================================
  demo: {
    enabled: process.env.REACT_APP_DEMO_MODE === 'true', // Set to true to show demo users
    testUserIds: [
      '101669044', // Courtney - TODO: Remove these test users
      '101680550', // Test user
    ],
  },

  // ============================================================
  // FEATURE FLAGS
  // ============================================================
  features: {
    pledgeSubmissions: process.env.REACT_APP_PLEDGE_SUBMISSIONS === 'true', // You don't need this
    vanIntegration: true,     // Will be false after VAN ID redesign
  },
} as const;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get terminology with proper capitalization
 */
export const getTerm = (key: keyof typeof APP_CONFIG.terminology, capitalize: boolean = false) => {
  const term = APP_CONFIG.terminology[key];
  return capitalize ? term.charAt(0).toUpperCase() + term.slice(1) : term;
};

/**
 * Replace terminology in a string template
 * Example: replaceTerm("Select a {chapter}") → "Select a Section"
 */
export const replaceTerm = (template: string, terms: Record<string, string> = {}) => {
  let result = template;
  
  // Replace custom terms
  Object.entries(terms).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  });
  
  // Replace standard terminology
  Object.entries(APP_CONFIG.terminology).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  });
  
  return result;
};

// Export shortcuts for common access patterns
export const TERMS = APP_CONFIG.terminology;
export const BRANDING = APP_CONFIG.branding;
export const FEATURES = APP_CONFIG.features;
