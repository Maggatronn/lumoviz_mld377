/**
 * Chapter Color Theme System
 * Provides consistent colors for chapters across the entire application
 */

export interface ChapterColorTheme {
  primary: string;     // Main color for nodes, badges, etc.
  light: string;       // Lighter shade for backgrounds
  dark: string;        // Darker shade for borders, text
  contrast: string;    // High contrast color for text on primary background
}

// Define color themes for each chapter
const chapterColorThemes: Record<string, ChapterColorTheme> = {
  // Durham chapter
  'Wake': {
    primary: '#dc2626',    // red-600
    light: '#fee2e2',      // red-100
    dark: '#991b1b',       // red-800
    contrast: '#ffffff'
  },
  
  // Durham chapter
  'Durham': {
    primary: '#22c55e',    // green-500 - TEMPORARY HARDCODE
    light: '#dcfce7',      // green-100
    dark: '#16a34a',       // green-600
    contrast: '#ffffff'
  },
  
  // Mecklenburg chapter
  'Mecklenburg': {
    primary: '#7c3aed',    // violet-600
    light: '#ede9fe',      // violet-100
    dark: '#6d28d9',       // violet-700
    contrast: '#ffffff'
  },
  
  // Guilford chapter
  'Guilford': {
    primary: '#ea580c',    // orange-600
    light: '#fed7aa',      // orange-100
    dark: '#c2410c',       // orange-700
    contrast: '#ffffff'
  },
  
  // Forsyth chapter
  'Forsyth': {
    primary: '#3b82f6',    // blue-500 - TEMPORARY HARDCODE
    light: '#dbeafe',      // blue-100
    dark: '#2563eb',       // blue-600
    contrast: '#ffffff'
  },
  
  // Cumberland chapter
  'New Hanover': {
    primary: '#be185d',    // pink-700
    light: '#fce7f3',      // pink-100
    dark: '#9d174d',       // pink-800
    contrast: '#ffffff'
  },
  
  // Orange chapter
  'Orange': {
    primary: '#0891b2',    // cyan-600
    light: '#cffafe',      // cyan-100
    dark: '#0e7490',       // cyan-700
    contrast: '#ffffff'
  },

  // New Hanover chapter
  'Cumberland': {
    primary: '#7c2d12',    // orange-800
    light: '#fed7aa',      // orange-100
    dark: '#431407',       // orange-900
    contrast: '#ffffff'
  },
  
  // Default for unknown chapters
  'Unknown': {
    primary: '#6b7280',    // gray-500
    light: '#f3f4f6',      // gray-100
    dark: '#374151',       // gray-700
    contrast: '#ffffff'
  },
  
  // All Chapters view
  'All Chapters': {
    primary: '#374151',    // gray-700
    light: '#f9fafb',      // gray-50
    dark: '#111827',       // gray-900
    contrast: '#ffffff'
  }
};

/**
 * Get the color theme for a specific chapter
 */
export const getChapterColorTheme = (chapterName?: string): ChapterColorTheme => {
  if (!chapterName) return chapterColorThemes['Unknown'];
  
  // Check for exact match first
  if (chapterColorThemes[chapterName]) {
    return chapterColorThemes[chapterName];
  }
  
  // Try to match chapter names with variations (e.g., "Durham For All" -> "Durham")
  const normalizedInput = chapterName.toLowerCase().trim();
  
  // Chapter name variations mapping
  const chapterVariations: Record<string, string> = {
    'durham for all': 'Durham',
    'durham': 'Durham',
    'new hanover for all': 'New Hanover',
    'new hanover': 'New Hanover',
    'wilmington': 'New Hanover',
    'wake': 'Wake',
    'wake county': 'Wake',
    'mecklenburg': 'Mecklenburg',
    'charlotte': 'Mecklenburg',
    'guilford': 'Guilford',
    'greensboro': 'Guilford',
    'forsyth': 'Forsyth',
    'winston-salem': 'Forsyth',
    'winston salem': 'Forsyth',
    'cumberland': 'Cumberland',
    'fayetteville': 'Cumberland',
    'orange': 'Orange',
    'chapel hill': 'Orange',
    'carrboro': 'Orange'
  };
  
  // Check for variations
  if (chapterVariations[normalizedInput]) {
    const standardChapter = chapterVariations[normalizedInput];
    if (chapterColorThemes[standardChapter]) {
      return chapterColorThemes[standardChapter];
    }
  }
  
  // Try partial matching for any chapter name that contains known keywords
  for (const [variation, standardName] of Object.entries(chapterVariations)) {
    if (normalizedInput.includes(variation) && chapterColorThemes[standardName]) {
      return chapterColorThemes[standardName];
    }
  }
  
  // If no match found, return Unknown theme
  return chapterColorThemes['Unknown'];
};

/**
 * Get just the primary color for a chapter (most common use case)
 */
export const getChapterColor = (chapterName?: string): string => {
  return getChapterColorTheme(chapterName).primary;
};

/**
 * Get all available chapter names with their colors
 */
export const getAllChapterColors = (): Array<{ name: string; theme: ChapterColorTheme }> => {
  return Object.entries(chapterColorThemes)
    .filter(([name]) => name !== 'Unknown' && name !== 'All Chapters')
    .map(([name, theme]) => ({ name, theme }));
};

/**
 * Generate CSS custom properties for a chapter theme
 */
export const getChapterCSSVars = (chapterName?: string): Record<string, string> => {
  const theme = getChapterColorTheme(chapterName);
  return {
    '--chapter-primary': theme.primary,
    '--chapter-light': theme.light,
    '--chapter-dark': theme.dark,
    '--chapter-contrast': theme.contrast
  };
};

/**
 * Get readable chapter colors for data visualization
 * Returns an array of colors that work well in charts and graphs
 */
export const getVisualizationColors = (): string[] => {
  return [
    '#dc2626', // red
    '#2563eb', // blue  
    '#7c3aed', // violet
    '#ea580c', // orange
    '#059669', // emerald
    '#be185d', // pink
    '#0891b2', // cyan
    '#6b7280'  // gray (fallback)
  ];
};
