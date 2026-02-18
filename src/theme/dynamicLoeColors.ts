// Dynamic LOE Color System - Colors based on numeric level prefix
// No hardcoded LOE categories - all inferred from data

export interface DynamicLOELevel {
  level: number;
  rawValue: string; // e.g., "1_TeamLeader", "2_TeamMember"
  label: string; // e.g., "TeamLeader", "TeamMember"
  color: string;
  backgroundColor: string;
}

/**
 * Generate color based on numeric level
 * Lower numbers (1) = warmer colors (red/orange)
 * Higher numbers (5+) = cooler colors (blue/purple)
 */
export const getColorForLevel = (level: number): { color: string; backgroundColor: string } => {
  // Gradient from warm (red) to cool (blue/gray)
  const colorGradient = [
    { color: '#b71c1c', backgroundColor: '#ffebee' }, // 1: Deep red
    { color: '#e65100', backgroundColor: '#fff3e0' }, // 2: Orange-red
    { color: '#f57f17', backgroundColor: '#fffde7' }, // 3: Golden yellow
    { color: '#558b2f', backgroundColor: '#f1f8e9' }, // 4: Green
    { color: '#1976d2', backgroundColor: '#e3f2fd' }, // 5: Blue
    { color: '#7b1fa2', backgroundColor: '#f3e5f5' }, // 6: Purple
    { color: '#616161', backgroundColor: '#f5f5f5' }, // 7+: Gray
  ];

  // Use level as index (1-indexed), default to gray for unknown levels
  const index = Math.max(0, Math.min(level - 1, colorGradient.length - 1));
  return colorGradient[index];
};

/**
 * Special colors for non-numeric LOE values
 */
export const SPECIAL_LOE_COLORS = {
  staff: {
    color: '#4a148c', // Deep purple
    backgroundColor: '#f3e5f5',
  },
  organizer: {
    color: '#4a148c', // Deep purple
    backgroundColor: '#f3e5f5',
  },
  unknown: {
    color: '#616161', // Gray
    backgroundColor: '#f5f5f5',
  }
};

/**
 * Parse LOE value from database format
 * Examples: "1_TeamLeader" -> { level: 1, label: "TeamLeader" }
 *          "TeamLeader" -> { level: null, label: "TeamLeader" }
 *          "Staff" -> { level: null, label: "Staff" }
 */
export const parseLOEValue = (loeValue: string): { level: number | null; label: string; rawValue: string } => {
  if (!loeValue || loeValue === 'Unknown' || loeValue === 'unknown') {
    return { level: null, label: 'Unknown', rawValue: loeValue || 'Unknown' };
  }

  // Check for staff/organizer
  const lowerValue = loeValue.toLowerCase();
  if (lowerValue.includes('staff') || lowerValue.includes('organizer')) {
    return { level: null, label: 'Staff', rawValue: loeValue };
  }

  // Try to extract number prefix (e.g., "1_TeamLeader" or "1.TeamLeader")
  const match = loeValue.match(/^(\d+)[_.](.+)$/);
  if (match) {
    const level = parseInt(match[1], 10);
    const label = match[2];
    return { level, label, rawValue: loeValue };
  }

  // No numeric prefix - return as-is
  return { level: null, label: loeValue, rawValue: loeValue };
};

/**
 * Get color for any LOE value
 */
export const getLOEColor = (loeValue: string): { color: string; backgroundColor: string; level: number | null } => {
  const parsed = parseLOEValue(loeValue);

  // Handle special cases
  if (parsed.label === 'Staff' || parsed.label === 'Organizer') {
    return { ...SPECIAL_LOE_COLORS.staff, level: null };
  }

  if (parsed.label === 'Unknown') {
    return { ...SPECIAL_LOE_COLORS.unknown, level: null };
  }

  // Use numeric level if available
  if (parsed.level !== null) {
    return { ...getColorForLevel(parsed.level), level: parsed.level };
  }

  // Fallback to unknown
  return { ...SPECIAL_LOE_COLORS.unknown, level: null };
};

/**
 * Extract unique LOE levels from data
 * Returns sorted list of LOE levels found in the data
 */
export const extractLOELevelsFromData = (data: Array<{ loe?: string | null }>): DynamicLOELevel[] => {
  const uniqueLOEs = new Set<string>();
  
  // Collect all unique LOE values (including Unknown)
  data.forEach(item => {
    if (item.loe && item.loe !== '') {
      uniqueLOEs.add(item.loe);
    }
  });

  // Parse and sort by level
  const levels: DynamicLOELevel[] = [];
  
  uniqueLOEs.forEach(rawValue => {
    const parsed = parseLOEValue(rawValue);
    const colors = getLOEColor(rawValue);
    
    levels.push({
      level: parsed.level || 999, // Put non-numeric at end
      rawValue: parsed.rawValue,
      label: parsed.label,
      color: colors.color,
      backgroundColor: colors.backgroundColor
    });
  });

  // Sort by level (numeric first, then alphabetically)
  levels.sort((a, b) => {
    if (a.level !== b.level) {
      return a.level - b.level;
    }
    return a.label.localeCompare(b.label);
  });

  return levels;
};

/**
 * Extract LOE levels from meetings data
 */
export const extractLOELevelsFromMeetings = (meetings: Array<{ 
  contact_loe?: string | null;
  organizer_loe?: string | null;
  organizer_contact_loe?: string | null;
}>): DynamicLOELevel[] => {
  const loeData: Array<{ loe?: string | null }> = [];
  
  meetings.forEach(meeting => {
    if (meeting.contact_loe) {
      loeData.push({ loe: meeting.contact_loe });
    }
    if (meeting.organizer_loe) {
      loeData.push({ loe: meeting.organizer_loe });
    }
    if (meeting.organizer_contact_loe) {
      loeData.push({ loe: meeting.organizer_contact_loe });
    }
  });

  // Always include staff and unknown as standard categories
  loeData.push({ loe: 'Staff' });
  loeData.push({ loe: 'Unknown' });

  return extractLOELevelsFromData(loeData);
};

/**
 * Format LOE label for display (strips numeric prefix)
 * e.g., "1_TeamLeader" -> "TeamLeader"
 *       "2.TeamMember" -> "TeamMember"
 *       "Staff" -> "Staff"
 */
export const formatLOELabel = (loeValue: string): string => {
  if (!loeValue) return 'Unknown';
  
  // Remove numeric prefix and separators
  return loeValue.replace(/^\d+[_.]/, '');
};
