import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ChapterColorTheme } from '../theme/chapterColors';
import teamsService from '../services/teamsService';

interface ChapterColorContextType {
  customColors: Record<string, ChapterColorTheme>;
  updateChapterColor: (chapterName: string, color: string) => void;
  resetChapterColor: (chapterName: string) => void;
  resetAllColors: () => void;
  loadColorsFromTeams: (teams: any[]) => void;
}

const ChapterColorContext = createContext<ChapterColorContextType | undefined>(undefined);

// Default color themes (from chapterColors.ts)
const defaultChapterColors: Record<string, ChapterColorTheme> = {
  // MLD 377 organizer sections
  'Alyssa': {
    primary: '#e11d48',
    light: '#ffe4e6',
    dark: '#9f1239',
    contrast: '#ffffff'
  },
  'Ruhee': {
    primary: '#0d9488',
    light: '#ccfbf1',
    dark: '#0f766e',
    contrast: '#ffffff'
  },
  'Edgar': {
    primary: '#d97706',
    light: '#fef3c7',
    dark: '#b45309',
    contrast: '#ffffff'
  },
  'Zoe': {
    primary: '#7c3aed',
    light: '#ede9fe',
    dark: '#6d28d9',
    contrast: '#ffffff'
  },
  'Svitlana': {
    primary: '#2563eb',
    light: '#dbeafe',
    dark: '#1d4ed8',
    contrast: '#ffffff'
  },
  'Sepi': {
    primary: '#059669',
    light: '#d1fae5',
    dark: '#047857',
    contrast: '#ffffff'
  },
  'Teaching': {
    primary: '#4f46e5',
    light: '#e0e7ff',
    dark: '#4338ca',
    contrast: '#ffffff'
  },
  'Main Chapter': {
    primary: '#6b7280',
    light: '#f3f4f6',
    dark: '#374151',
    contrast: '#ffffff'
  },
  // Legacy county chapters
  'Wake': {
    primary: '#dc2626',
    light: '#fee2e2',
    dark: '#991b1b',
    contrast: '#ffffff'
  },
  'Durham': {
    primary: '#22c55e',
    light: '#dcfce7',
    dark: '#16a34a',
    contrast: '#ffffff'
  },
  'Mecklenburg': {
    primary: '#7c3aed',
    light: '#ede9fe',
    dark: '#6d28d9',
    contrast: '#ffffff'
  },
  'Guilford': {
    primary: '#ea580c',
    light: '#fed7aa',
    dark: '#c2410c',
    contrast: '#ffffff'
  },
  'Forsyth': {
    primary: '#3b82f6',
    light: '#dbeafe',
    dark: '#2563eb',
    contrast: '#ffffff'
  },
  'New Hanover': {
    primary: '#be185d',
    light: '#fce7f3',
    dark: '#9d174d',
    contrast: '#ffffff'
  },
  'Orange': {
    primary: '#0891b2',
    light: '#cffafe',
    dark: '#0e7490',
    contrast: '#ffffff'
  },
  'Cumberland': {
    primary: '#7c2d12',
    light: '#fed7aa',
    dark: '#431407',
    contrast: '#ffffff'
  },
  'Unknown': {
    primary: '#d1d5db',
    light: '#f9fafb',
    dark: '#9ca3af',
    contrast: '#6b7280'
  },
  'All Chapters': {
    primary: '#374151',
    light: '#f9fafb',
    dark: '#111827',
    contrast: '#ffffff'
  }
};

// Helper function to generate light and dark shades from a primary color
const generateColorTheme = (primaryColor: string): ChapterColorTheme => {
  // Convert hex to RGB
  const hex = primaryColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Generate lighter shade (add 40 to each component, cap at 255)
  const lightR = Math.min(255, r + 40);
  const lightG = Math.min(255, g + 40);
  const lightB = Math.min(255, b + 40);
  const light = `#${lightR.toString(16).padStart(2, '0')}${lightG.toString(16).padStart(2, '0')}${lightB.toString(16).padStart(2, '0')}`;
  
  // Generate darker shade (subtract 30 from each component, floor at 0)
  const darkR = Math.max(0, r - 30);
  const darkG = Math.max(0, g - 30);
  const darkB = Math.max(0, b - 30);
  const dark = `#${darkR.toString(16).padStart(2, '0')}${darkG.toString(16).padStart(2, '0')}${darkB.toString(16).padStart(2, '0')}`;
  
  return {
    primary: primaryColor,
    light: light,
    dark: dark,
    contrast: '#ffffff'
  };
};

export const ChapterColorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [customColors, setCustomColors] = useState<Record<string, ChapterColorTheme>>({});

  // Load saved colors from localStorage on mount
  useEffect(() => {
    const savedColors = localStorage.getItem('chapterCustomColors');
    if (savedColors) {
      try {
        setCustomColors(JSON.parse(savedColors));
      } catch (error) {
        console.error('Failed to load saved chapter colors:', error);
      }
    }
  }, []);

  // Save colors to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('chapterCustomColors', JSON.stringify(customColors));
  }, [customColors]);

  const updateChapterColor = async (chapterName: string, color: string) => {
    const colorTheme = generateColorTheme(color);
    
    // Update local state immediately for responsive UI
    setCustomColors(prev => ({
      ...prev,
      [chapterName]: colorTheme
    }));

    // Sync with BigQuery
    try {
      const result = await teamsService.updateChapterColor(chapterName, color);
      if (!result.success) {
        console.error('Failed to sync color to BigQuery:', result.error);
        // Could show a toast notification here
      }
    } catch (error) {
      console.error('Error syncing color to BigQuery:', error);
      // Could show a toast notification here
    }
  };

  const resetChapterColor = (chapterName: string) => {
    setCustomColors(prev => {
      const newColors = { ...prev };
      delete newColors[chapterName];
      return newColors;
    });
  };

  const resetAllColors = () => {
    setCustomColors({});
  };

  const loadColorsFromTeams = (teams: any[]) => {
    const colorsFromSheets: Record<string, ChapterColorTheme> = {};
    
    teams.forEach(team => {
      if (team.color && team.chapter) {
        colorsFromSheets[team.chapter] = generateColorTheme(team.color);
      }
    });
    
    // Merge with existing custom colors (local storage takes precedence)
    setCustomColors(prev => ({
      ...colorsFromSheets,
      ...prev
    }));
  };

  return (
    <ChapterColorContext.Provider value={{
      customColors,
      updateChapterColor,
      resetChapterColor,
      resetAllColors,
      loadColorsFromTeams
    }}>
      {children}
    </ChapterColorContext.Provider>
  );
};

export const useChapterColors = () => {
  const context = useContext(ChapterColorContext);
  if (context === undefined) {
    throw new Error('useChapterColors must be used within a ChapterColorProvider');
  }
  return context;
};

// Enhanced color functions that use custom colors
export const getCustomChapterColorTheme = (chapterName?: string, customColors?: Record<string, ChapterColorTheme>): ChapterColorTheme => {
  if (!chapterName) return defaultChapterColors['Unknown'];
  
  // Check custom colors first
  if (customColors && customColors[chapterName]) {
    return customColors[chapterName];
  }
  
  // Fall back to default colors
  if (defaultChapterColors[chapterName]) {
    return defaultChapterColors[chapterName];
  }
  
  // Try to match chapter names with variations (same logic as original)
  const normalizedInput = chapterName.toLowerCase().trim();
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
  
  if (chapterVariations[normalizedInput]) {
    const standardChapter = chapterVariations[normalizedInput];
    if (customColors && customColors[standardChapter]) {
      return customColors[standardChapter];
    }
    if (defaultChapterColors[standardChapter]) {
      return defaultChapterColors[standardChapter];
    }
  }
  
  // Try partial matching
  for (const [variation, standardName] of Object.entries(chapterVariations)) {
    if (normalizedInput.includes(variation)) {
      if (customColors && customColors[standardName]) {
        return customColors[standardName];
      }
      if (defaultChapterColors[standardName]) {
        return defaultChapterColors[standardName];
      }
    }
  }
  
  return defaultChapterColors['Unknown'];
};

export const getCustomChapterColor = (chapterName?: string, customColors?: Record<string, ChapterColorTheme>): string => {
  return getCustomChapterColorTheme(chapterName, customColors).primary;
};
