// LOE Color System - Gradient from 5 (Prospect) to 1 (Leader)
// Colors progress from cool (blue/purple) to warm (gold/red) as engagement increases

export interface LOELevel {
  level: number;
  key: string;
  label: string;
  color: string;
  backgroundColor: string;
  description: string;
}

export const LOE_LEVELS: LOELevel[] = [
  {
    level: 1,
    key: 'TeamLeader',
    label: 'TeamLeader',
    color: '#b71c1c', // Deep red
    backgroundColor: '#ffebee',
    description: ''
  },
  {
    level: 2,
    key: 'TeamMember',
    label: 'TeamMember',
    color: '#e65100', // Orange-red
    backgroundColor: '#fff3e0',
    description: ''
  },
  {
    level: 3,
    key: 'Member',
    label: 'Member',
    color: '#f57f17', // Golden yellow
    backgroundColor: '#fffde7',
    description: ''
  },
  {
    level: 4,
    key: 'Supporter',
    label: 'Supporter',
    color: '#558b2f', // Green
    backgroundColor: '#f1f8e9',
    description: ''
  }
];

// Special colors for non-standard LOE values
export const SPECIAL_LOE_COLORS = {
  staff: {
    color: '#4a148c', // Deep purple
    backgroundColor: '#f3e5f5',
    label: 'Staff'
  },
  unknown: {
    color: '#616161', // Gray
    backgroundColor: '#f5f5f5',
    label: 'Unknown'
  }
};

// Named LOE colors for the four standard options
export const NAMED_LOE_COLORS: Record<string, { color: string; backgroundColor: string }> = {
  leader: {
    color: '#b91c1c',          // red-700 — highest engagement
    backgroundColor: '#fee2e2' // red-100
  },
  'potential leader': {
    color: '#c2410c',          // orange-700
    backgroundColor: '#ffedd5' // orange-100
  },
  supporter: {
    color: '#0f766e',          // teal-700
    backgroundColor: '#ccfbf1' // teal-100
  },
  unknown: {
    color: '#9ca3af',          // gray-400
    backgroundColor: '#f3f4f6' // gray-100
  }
};

/**
 * Get LOE color information based on LOE status string
 * Now uses dynamic system - extracts numeric prefix for color mapping
 */
export const getLOEColor = (loeStatus: string): { color: string; backgroundColor: string; level?: number } => {
  if (!loeStatus || loeStatus === 'Unknown' || loeStatus === 'unknown') {
    return SPECIAL_LOE_COLORS.unknown;
  }

  // Check named options first (case-insensitive)
  const normalized = loeStatus.trim().toLowerCase();
  if (NAMED_LOE_COLORS[normalized]) {
    return NAMED_LOE_COLORS[normalized];
  }

  // Check for staff
  if (loeStatus.toLowerCase().includes('staff') || 
      loeStatus.toLowerCase().includes('organizer')) {
    return SPECIAL_LOE_COLORS.staff;
  }

  // Extract numeric level from formats like "1_TeamLeader", "2_TeamMember"
  const match = loeStatus.match(/^(\d+)[_.]/);
  if (match) {
    const level = parseInt(match[1], 10);
    
    // Generate color based on level
    const colorGradient = [
      { color: '#b71c1c', backgroundColor: '#ffebee' }, // 1: Deep red
      { color: '#e65100', backgroundColor: '#fff3e0' }, // 2: Orange-red
      { color: '#f57f17', backgroundColor: '#fffde7' }, // 3: Golden yellow
      { color: '#558b2f', backgroundColor: '#f1f8e9' }, // 4: Green
      { color: '#1976d2', backgroundColor: '#e3f2fd' }, // 5: Blue
      { color: '#7b1fa2', backgroundColor: '#f3e5f5' }, // 6: Purple
      { color: '#616161', backgroundColor: '#f5f5f5' }, // 7+: Gray
    ];

    const index = Math.max(0, Math.min(level - 1, colorGradient.length - 1));
    return { ...colorGradient[index], level };
  }

  // Fallback - try to match against hardcoded levels for backward compatibility
  const loeLevel = LOE_LEVELS.find(level => 
    loeStatus.toLowerCase().includes(level.key.toLowerCase()) ||
    loeStatus.toLowerCase().includes(level.label.toLowerCase())
  );

  if (loeLevel) {
    return {
      color: loeLevel.color,
      backgroundColor: loeLevel.backgroundColor,
      level: loeLevel.level
    };
  }

  // Fallback to unknown
  return SPECIAL_LOE_COLORS.unknown;
};

/**
 * Get LOE level from status string
 */
export const getLOELevel = (loeStatus: string): number | null => {
  const colorInfo = getLOEColor(loeStatus);
  return colorInfo.level || null;
};

/**
 * Get all LOE levels for filtering and display
 */
export const getAllLOELevels = (): LOELevel[] => {
  return [...LOE_LEVELS];
};

/**
 * Get LOE progress color (for progress bars, gradients, etc.)
 */
export const getLOEProgressColor = (level: number): string => {
  const loeLevel = LOE_LEVELS.find(l => l.level === level);
  return loeLevel?.color || SPECIAL_LOE_COLORS.unknown.color;
};

/**
 * Check if LOE status is a valid leadership level
 */
export const isValidLOELevel = (loeStatus: string): boolean => {
  return getLOELevel(loeStatus) !== null;
};
