import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Divider,
  IconButton,
  FormControl,
  FormLabel,
  Select,
  MenuItem,
  InputLabel,
  TextField,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Chip,
  Button
} from '@mui/material';
import { useChapterColors, getCustomChapterColor } from '../../contexts/ChapterColorContext';
import { format, startOfWeek, endOfWeek, addWeeks, startOfDay, endOfDay, addDays, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { ConversationGoal } from '../dialogs/ConversationGoalsDialog';
import { fetchMeetingsHistogram, HistogramDataPoint } from '../../services/api';
import DateRangePicker from '../ui/DateRangePicker';


interface ConversationsVisualizationProps {
  width: number;
  height: number;
  meetings: any[];
  contacts: any[];
  nodes: any[];
  currentDateRange: { start: Date; end: Date} | null;
  userMap: Map<string, any>;
  orgIds: any[];
  selectedChapter?: string;
  organizerFilter?: string; // NEW: Filter meetings by organizer
  goals?: ConversationGoal[];
  onNavigateToGoal?: (goalId: string) => void;
  hoveredOrganizer?: string | null;
  onOrganizerHover?: (organizer: string | null) => void;
}

type OrganizationalView = 'federation' | 'chapters' | 'teams' | 'organizers';

// Helper function to get pattern style for individual people within a chapter
const getPersonPattern = (index: number): React.CSSProperties => {
  const patterns = [
    // Solid (no pattern)
    {},
    // Bold diagonal stripes
    {
      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.6) 3px, rgba(255,255,255,0.6) 6px)'
    },
    // Large dots
    {
      backgroundImage: 'radial-gradient(circle at 4px 4px, rgba(255,255,255,0.7) 2px, transparent 2px)',
      backgroundSize: '8px 8px'
    },
    // Bold horizontal stripes
    {
      backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.6) 3px, rgba(255,255,255,0.6) 6px)'
    },
    // Bold vertical stripes
    {
      backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,255,255,0.6) 3px, rgba(255,255,255,0.6) 6px)'
    },
    // Thick cross-hatch
    {
      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 5px), repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 5px)'
    },
    // Chevron pattern
    {
      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.6) 4px, rgba(255,255,255,0.6) 8px), repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.6) 4px, rgba(255,255,255,0.6) 8px)',
      backgroundSize: '12px 12px'
    },
    // Diamond pattern
    {
      backgroundImage: 'radial-gradient(circle at 6px 6px, rgba(255,255,255,0.6) 1px, transparent 1px), radial-gradient(circle at 3px 3px, rgba(255,255,255,0.4) 1px, transparent 1px)',
      backgroundSize: '12px 12px'
    }
  ];
  return patterns[index % patterns.length];
};

// Helper function to get pattern names for the legend
const getPersonPatternName = (index: number): string => {
  const patternNames = [
    'Solid',
    'Diagonal Stripes',
    'Dots',
    'Horizontal Stripes', 
    'Vertical Stripes',
    'Cross-hatch',
    'Chevron',
    'Diamond'
  ];
  return patternNames[index % patternNames.length];
};

// Helper function to get consistent pattern index for a person name
const getPersonPatternIndex = (personName: string, allPersonNames: string[], histogramData?: any[]): number => {
  if (!histogramData) {
    // Fallback to alphabetical sorting if no histogram data provided
    const sortedNames = [...allPersonNames].sort();
    const index = sortedNames.indexOf(personName);
    return index >= 0 ? index : 0;
  }
  
  // Calculate total conversation counts for each person
  const personTotals = new Map<string, number>();
  histogramData.forEach(bucket => {
    Object.entries(bucket.scopeData).forEach(([key, count]) => {
      if (allPersonNames.includes(key)) {
        personTotals.set(key, (personTotals.get(key) || 0) + (count as number));
      }
    });
  });
  
  // Sort by total conversation count (descending), then alphabetically for ties
  const sortedNames = [...allPersonNames].sort((a, b) => {
    const countA = personTotals.get(a) || 0;
    const countB = personTotals.get(b) || 0;
    if (countB !== countA) {
      return countB - countA; // Higher counts first
    }
    return a.localeCompare(b); // Alphabetical for ties
  });
  
  const index = sortedNames.indexOf(personName);
  return index >= 0 ? index : 0;
};

// Conversation Summary Component
const ConversationSummaryView: React.FC<{
  meetings: any[];
  contacts: any[];
  currentDateRange: { start: Date; end: Date } | null;
  organizationalView: OrganizationalView;
  userMap: Map<string, any>;
  orgIds: any[];
  selectedChapter?: string;
  organizerFilter?: string;
  goals?: ConversationGoal[];
  onNavigateToGoal?: (goalId: string) => void;
  hoveredOrganizer?: string | null;
  onOrganizerHover?: (organizer: string | null) => void;
  containerWidth?: number;
  containerHeight?: number;
}> = ({ meetings, contacts, currentDateRange, organizationalView, userMap, orgIds, selectedChapter, organizerFilter, goals, onNavigateToGoal, hoveredOrganizer: externalHoveredOrganizer, onOrganizerHover, containerWidth = 800, containerHeight = 600 }) => {
  const { customColors } = useChapterColors();
  const [internalHoveredOrganizer, setInternalHoveredOrganizer] = useState<string | null>(null);
  
  // Use external hover state if provided, otherwise use internal state
  const hoveredOrganizer = externalHoveredOrganizer !== undefined ? externalHoveredOrganizer : internalHoveredOrganizer;
  const setHoveredOrganizer = onOrganizerHover || setInternalHoveredOrganizer;

  // Name-based merging logic (same as MainApp.tsx)
  const nameVariations = new Map<string, string>([
    ['lufti', 'leo'],
    ['lutfi', 'leo'],
    ['ben', 'benjamin'],
    ['benny', 'benjamin'],
  ]);

  const normalizeFirstName = (firstName: string): string => {
    const normalized = firstName.toLowerCase().trim();
    return nameVariations.get(normalized) || normalized;
  };

  // Function to get canonical organizer name (merge similar names)
  const getCanonicalOrganizerName = (meeting: any): string => {
    const originalName = getOrganizerName(meeting);
    
    // Handle specific full name replacements first
    const fullNameReplacements = new Map<string, string>([
      ['lutfi hussein', 'Leo Hussein'],
      ['lufti hussein', 'Leo Hussein'],
      ['lutfi hussein', 'Leo Hussein'], // Handle case variations
      ['lufti hussein', 'Leo Hussein'],
    ]);
    
    const normalizedOriginal = originalName.toLowerCase().trim();
    const directReplacement = fullNameReplacements.get(normalizedOriginal);
    if (directReplacement) {
      return directReplacement;
    }
    
    // Handle first name normalization for other cases
    const nameParts = originalName.split(' ');
    if (nameParts.length === 0) return originalName;
    
    const firstName = nameParts[0]?.toLowerCase().trim();
    if (!firstName) return originalName;
    
    const normalizedFirstName = normalizeFirstName(firstName);
    
    // If first name was normalized, rebuild the full name
    if (normalizedFirstName !== firstName) {
      const capitalizedFirstName = normalizedFirstName.charAt(0).toUpperCase() + normalizedFirstName.slice(1);
      const restOfName = nameParts.slice(1).join(' ');
      const rebuiltName = restOfName ? `${capitalizedFirstName} ${restOfName}` : capitalizedFirstName;
      
      // For Lutfi/Leo specifically, always use "Leo Hussein" as the canonical form
      if (normalizedFirstName === 'leo' && restOfName.toLowerCase().includes('hussein')) {
        return 'Leo Hussein';
      }
      
      return rebuiltName;
    }
    
    return originalName;
  };
  
  
  // Histogram state
  const [histogramTimeGranularity, setHistogramTimeGranularity] = useState<'day' | 'week' | 'month'>('week');
  const [histogramScope, setHistogramScope] = useState<'person' | 'chapter' | 'federation' | 'conversation_type'>('federation');
  const [selectedChapterForPersonView, setSelectedChapterForPersonView] = useState<string>('');
  const [isLoadingHistogram, setIsLoadingHistogram] = useState(false);

  // Date range for histogram - default to 1 year
  const [histogramDateRange, setHistogramDateRange] = useState<{ start: Date; end: Date }>(() => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1); // 1 year ago
    return { start, end };
  });

  const histogramStartDate = histogramDateRange.start;
  const histogramEndDate = histogramDateRange.end;

  // Ref for auto-scrolling histogram to most recent date
  const histogramScrollContainerRef = useRef<HTMLDivElement>(null);

  // Store ALL histogram data (all granularities and scopes) to avoid refetching
  const [allHistogramData, setAllHistogramData] = useState<{
    [key: string]: HistogramDataPoint[]; // Key format: "day-federation", "week-chapter", etc.
  }>({});
  
  // Track if we've already fetched to prevent duplicate calls
  const hasFetchedHistogramRef = useRef(false);
  const lastFetchParamsRef = useRef<string>('');
  
  // Fetch ALL histogram data combinations at once (ONLY when date range changes)
  // Do NOT refetch when chapter/organizer filters change - we load ALL data upfront
  useEffect(() => {
    const fetchAllHistogramData = async () => {
      // Create a key to track if parameters have changed (only date range matters)
      const fetchKey = JSON.stringify({
        start: format(histogramStartDate, 'yyyy-MM-dd'),
        end: format(histogramEndDate, 'yyyy-MM-dd')
      });
      
      // Skip if we've already fetched with these exact params
      if (lastFetchParamsRef.current === fetchKey) {
        // console.log('[GoalsVisualization] Skipping duplicate histogram fetch - already loaded');
        return;
      }
      
      // console.log('[GoalsVisualization] Fetching ALL histogram data combinations (12 queries total)');
      lastFetchParamsRef.current = fetchKey;
      setIsLoadingHistogram(true);
      
      try {
        const granularities: ('day' | 'week' | 'month')[] = ['day', 'week', 'month'];
        const scopes: ('federation' | 'chapter' | 'person' | 'type')[] = ['federation', 'chapter', 'person', 'type'];
        
        // Fetch all combinations in parallel - NO chapter/organizer filters
        // We load ALL data and filter client-side later
        const promises = granularities.flatMap(granularity => 
          scopes.map(async (scope) => {
            const response = await fetchMeetingsHistogram({
              granularity,
              scope,
              start_date: format(histogramStartDate, 'yyyy-MM-dd'),
              end_date: format(histogramEndDate, 'yyyy-MM-dd'),
              // DO NOT pass chapter or organizer - load all data
            });
            return { key: `${granularity}-${scope}`, data: response.data };
          })
        );
        
        const results = await Promise.all(promises);
        
        // Store all results in a single object keyed by "granularity-scope"
        const allData: { [key: string]: HistogramDataPoint[] } = {};
        results.forEach(({ key, data }) => {
          allData[key] = data;
        });
        
        // console.log('[GoalsVisualization] ✅ Loaded all histogram data - will NOT refetch unless date range changes');
        setAllHistogramData(allData);
        hasFetchedHistogramRef.current = true;
      } catch (error) {
        console.error('Error fetching histogram data:', error);
        setAllHistogramData({});
      } finally {
        setIsLoadingHistogram(false);
      }
    };
    
    fetchAllHistogramData();
  }, [histogramStartDate, histogramEndDate]); // ONLY date range - NOT chapter or organizer!
  // Available meeting types
  const availableMeetingTypes = useMemo(() => {
    const types = new Set<string>();
    meetings.forEach(meeting => {
      if (meeting.meeting_type) {
        types.add(meeting.meeting_type);
      } else {
        types.add('Meeting'); // Default for meetings without a type
      }
    });
    return Array.from(types).sort();
  }, [meetings]);

  // Available chapters
  const availableChapters = useMemo(() => {
    const chapters = new Set<string>();
    meetings.forEach(meeting => {
      if (meeting.chapter) {
        chapters.add(meeting.chapter);
      }
    });
    return Array.from(chapters).sort();
  }, [meetings]);

  // Default to select all meeting types
  const [selectedMeetingTypes, setSelectedMeetingTypes] = useState<string[]>([]);
  
  // Update selected types when available types change
  React.useEffect(() => {
    if (availableMeetingTypes.length > 0 && selectedMeetingTypes.length === 0) {
      setSelectedMeetingTypes(availableMeetingTypes);
    }
  }, [availableMeetingTypes, selectedMeetingTypes.length]);
  
  // Filter and deduplicate meetings data - using 1-year date range
  const filteredMeetings = useMemo(() => {
    // Filter by 1-year date range and meeting types
    const dateFilteredMeetings = meetings.filter(meeting => {
        const meetingDate = new Date(typeof meeting.datestamp === 'object' ? meeting.datestamp.value : meeting.datestamp);
      const dateInRange = meetingDate >= histogramStartDate && meetingDate <= histogramEndDate;
      
      // If no meeting types selected, include all meetings (this should rarely happen now)
      if (selectedMeetingTypes.length === 0) {
        return dateInRange;
      }
      
      // Check if this meeting's type is in the selected types
      const meetingType = meeting.meeting_type || 'Meeting';
      return dateInRange && selectedMeetingTypes.includes(meetingType);
    });

    // Then deduplicate using the same logic as NotesPanel
    return dateFilteredMeetings.reduce((acc, meeting) => {
      const dateStr = typeof meeting.datestamp === 'object' ? meeting.datestamp.value : meeting.datestamp;
      const uniqueKey = `${meeting.organizer_vanid}-${meeting.vanid}-${dateStr}-${meeting.meeting_type || 'Meeting'}`;
      
      // Only add if we haven't seen this combination before
      if (!acc.some((existingMeeting: any) => {
        const existingDateStr = typeof existingMeeting.datestamp === 'object' ? existingMeeting.datestamp.value : existingMeeting.datestamp;
        const existingKey = `${existingMeeting.organizer_vanid}-${existingMeeting.vanid}-${existingDateStr}-${existingMeeting.meeting_type || 'Meeting'}`;
        return existingKey === uniqueKey;
      })) {
        acc.push(meeting);
      }
      
      return acc;
    }, [] as any[]);
  }, [meetings, histogramStartDate, histogramEndDate, selectedMeetingTypes]);

  // Helper function for consistent name resolution (same as other panels)
  // Priority: 1. orgIds table, 2. API pre-built names, 3. userMap, 4. fallback
  const getConsistentName = (vanId: number | undefined, apiBuiltName: string | undefined, role: 'organizer' | 'contact'): string => {
    if (!vanId) {
      return apiBuiltName && apiBuiltName.trim() && apiBuiltName !== 'null null' 
        ? apiBuiltName.trim() 
        : `Unknown ${role === 'organizer' ? 'Organizer' : 'Contact'}`;
    }

    const vanIdStr = vanId.toString();
    
    // REMOVED SPECIAL OVERRIDES: Testing backend fix for name consistency

    // PRIORITY 1: orgIds table (most authoritative)
    const orgInfo = orgIds.find(p => p.vanid && p.vanid.toString() === vanIdStr);
    if (orgInfo) {
      if ((orgInfo.firstname && orgInfo.firstname !== 'null') || (orgInfo.lastname && orgInfo.lastname !== 'null')) {
        const firstName = orgInfo.firstname && orgInfo.firstname !== 'null' ? orgInfo.firstname.trim() : '';
        const lastName = orgInfo.lastname && orgInfo.lastname !== 'null' ? orgInfo.lastname.trim() : '';
        const fullName = `${firstName} ${lastName}`.trim();
        if (fullName) {
          return fullName;
        }
      }
      // Try name field from orgInfo
      if (orgInfo.name && orgInfo.name.trim() && orgInfo.name !== 'null null') {
        return orgInfo.name.trim();
      }
    }

    // PRIORITY 2: API pre-built names (from server name resolution)
    if (apiBuiltName && apiBuiltName.trim() && apiBuiltName !== 'null null') {
      return apiBuiltName.trim();
    }

    // PRIORITY 3: userMap (backup)
    const userInfo = Array.from(userMap.values()).find(user => 
      user.userid?.toString() === vanIdStr || 
      user.vanid?.toString() === vanIdStr ||
      user.id?.toString() === vanIdStr
    );
    
    if (userInfo) {
      if (userInfo.name && userInfo.name.trim() && userInfo.name !== 'null null') {
        return userInfo.name.trim();
      } else if ((userInfo.firstname && userInfo.firstname !== 'null') || (userInfo.lastname && userInfo.lastname !== 'null')) {
        const firstName = userInfo.firstname && userInfo.firstname !== 'null' ? userInfo.firstname.trim() : '';
        const lastName = userInfo.lastname && userInfo.lastname !== 'null' ? userInfo.lastname.trim() : '';
        const fullName = `${firstName} ${lastName}`.trim();
        if (fullName) {
          return fullName;
        }
      }
    }

    // PRIORITY 4: Fallback with VAN ID
    return `${role === 'organizer' ? 'Organizer' : 'Contact'} ${vanId}`;
  };

  // Helper function to get organizer name
  const getOrganizerName = (meeting: any): string => {
    // Handle Two-on-One email case separately
    if (meeting.meeting_type === 'Two-on-One' && meeting.organizer && meeting.organizer.includes('@')) {
      // Try to find the actual name by email
      const userMapEntry = Array.from(userMap.values()).find(user => 
        user.email === meeting.organizer
      );
      if (userMapEntry && userMapEntry.firstname && userMapEntry.lastname) {
        return `${userMapEntry.firstname} ${userMapEntry.lastname}`;
      }
      
      const orgIdEntry = orgIds.find(org => 
        org.email === meeting.organizer
      );
      if (orgIdEntry && orgIdEntry.firstname && orgIdEntry.lastname) {
        return `${orgIdEntry.firstname} ${orgIdEntry.lastname}`;
      }
      
      // Fallback to email for Two-on-One
      return meeting.organizer;
    }
    
    // Use consistent name resolution for all other cases
    return getConsistentName(meeting.organizer_vanid, meeting.organizer, 'organizer');
  };


  // Histogram data calculation
  // Select the appropriate pre-fetched data based on current granularity and scope
  const histogramData = useMemo(() => {
    // Get the appropriate data from our pre-fetched cache
    const scopeKey = histogramScope === 'person' ? 'person' 
      : histogramScope === 'chapter' ? 'chapter' 
      : histogramScope === 'conversation_type' ? 'type' 
      : 'federation';
    const dataKey = `${histogramTimeGranularity}-${scopeKey}`;
    const apiHistogramData = allHistogramData[dataKey] || [];
    
    if (!apiHistogramData || apiHistogramData.length === 0) {
      return [];
    }
    
    // Group by time_bucket
    const bucketMap = new Map<string, { start: Date; end: Date; label: string; scopeData: { [key: string]: number } }>();
    
    apiHistogramData.forEach((dataPoint: any) => {
      // Handle time_bucket as either string or object with value property
      const timeBucketRaw = dataPoint.time_bucket;
      const timeBucket = typeof timeBucketRaw === 'string' 
        ? timeBucketRaw 
        : (timeBucketRaw?.value || String(timeBucketRaw));
      
      const scopeLabel = dataPoint.scope_key || 'Carolina Federation';
      const count = dataPoint.meeting_count;
      
      if (!bucketMap.has(timeBucket)) {
        // Parse time_bucket to create start/end dates and label
        const bucketDate = new Date(timeBucket);
        
        // Validate bucket date before processing
        if (isNaN(bucketDate.getTime())) {
          console.warn('Invalid time_bucket value:', timeBucket);
          return; // Skip this data point
        }
        
        let bucketStart: Date;
        let bucketEnd: Date;
        let bucketLabel: string;
        
        switch (histogramTimeGranularity) {
          case 'day':
            bucketStart = startOfDay(bucketDate);
            bucketEnd = endOfDay(bucketDate);
            bucketLabel = format(bucketDate, 'MMM dd');
            break;
          case 'week':
            bucketStart = startOfWeek(bucketDate, { weekStartsOn: 0 });
            bucketEnd = endOfWeek(bucketDate, { weekStartsOn: 0 });
            bucketLabel = `${format(bucketStart, 'MMM dd')} - ${format(bucketEnd, 'MMM dd')}`;
            break;
          case 'month':
            bucketStart = startOfMonth(bucketDate);
            bucketEnd = endOfMonth(bucketDate);
            bucketLabel = format(bucketDate, 'MMM yyyy');
            break;
          default:
            bucketStart = bucketDate;
            bucketEnd = bucketDate;
            bucketLabel = format(bucketDate, 'MMM dd');
        }
        
        bucketMap.set(timeBucket, {
          start: bucketStart,
          end: bucketEnd,
          label: bucketLabel,
          scopeData: {}
        });
      }
      
      const bucket = bucketMap.get(timeBucket)!;
      bucket.scopeData[scopeLabel] = count;
    });
    
    // Convert to array and add total counts
    return Array.from(bucketMap.values()).map(bucket => ({
      ...bucket,
      count: Object.values(bucket.scopeData).reduce((sum, val) => sum + val, 0)
    })).sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [allHistogramData, histogramTimeGranularity, histogramScope]);

  // Auto-scroll histogram to most recent date (rightmost position)
  useEffect(() => {
    if (histogramScrollContainerRef.current && histogramData.length > 0) {
      // Small delay to ensure DOM is fully rendered
      const timer = setTimeout(() => {
        if (histogramScrollContainerRef.current) {
          histogramScrollContainerRef.current.scrollLeft = histogramScrollContainerRef.current.scrollWidth;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [histogramData, histogramTimeGranularity, histogramScope]);

  return (
    <Box sx={{ 
      height: '100%', 
      overflow: 'auto', 
      display: 'flex', 
      flexDirection: 'column',
      p: 2
    }}>

      {/* Histogram Section */}
      <Paper sx={{ 
        p: 3, 
        border: '1px solid #e0e0e0',
        borderRadius: 2,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        flex: 1, // Take available space
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0, // Important for flex child
        bgcolor: '#fafafa'
      }}>
        {/* Header with Title and Key Controls */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
          pb: 2.5,
          borderBottom: '1px solid #e0e0e0'
        }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem', mb: 0.5 }}>
              Conversation Trends
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
              Analyze meeting activity over time
            </Typography>
          </Box>
          
          {/* Time Period Buttons */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button
              size="small"
              variant={histogramTimeGranularity === 'day' ? 'contained' : 'outlined'}
              onClick={() => setHistogramTimeGranularity('day')}
              sx={{ minWidth: 60, textTransform: 'none', fontSize: '0.8rem' }}
            >
              Day
            </Button>
            <Button
              size="small"
              variant={histogramTimeGranularity === 'week' ? 'contained' : 'outlined'}
              onClick={() => setHistogramTimeGranularity('week')}
              sx={{ minWidth: 60, textTransform: 'none', fontSize: '0.8rem' }}
            >
              Week
            </Button>
            <Button
              size="small"
              variant={histogramTimeGranularity === 'month' ? 'contained' : 'outlined'}
              onClick={() => setHistogramTimeGranularity('month')}
              sx={{ minWidth: 60, textTransform: 'none', fontSize: '0.8rem' }}
            >
              Month
            </Button>
          </Box>
        </Box>

        {/* Secondary Controls - Compact Single Row */}
        <Box sx={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: 2.5, 
          alignItems: 'center', 
          mb: 3,
          pb: 2.5,
          borderBottom: '1px solid #e0e0e0'
        }}>
          {/* Group By Label + Dropdown */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600 }}>
              VIEW:
            </Typography>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={histogramScope}
                onChange={(e) => {
                  const newScope = e.target.value as 'person' | 'chapter' | 'federation' | 'conversation_type';
                  setHistogramScope(newScope);
                  if (newScope !== 'person') {
                    setSelectedChapterForPersonView('');
                  }
                }}
                sx={{ fontSize: '0.8rem', '& .MuiSelect-select': { py: 0.75 } }}
              >
                <MenuItem value="federation" sx={{ fontSize: '0.8rem' }}>Full Class</MenuItem>
                <MenuItem value="chapter" sx={{ fontSize: '0.8rem' }}>By Chapter</MenuItem>
                <MenuItem value="person" sx={{ fontSize: '0.8rem' }}>By Person</MenuItem>
                <MenuItem value="conversation_type" sx={{ fontSize: '0.8rem' }}>By Type</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Chapter Filter - Only show when "By Person" is selected */}
          {histogramScope === 'person' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600 }}>
                CHAPTER:
              </Typography>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={selectedChapterForPersonView}
                  onChange={(e) => setSelectedChapterForPersonView(e.target.value as string)}
                  sx={{ fontSize: '0.8rem', '& .MuiSelect-select': { py: 0.75 } }}
                >
                  <MenuItem value="" sx={{ fontSize: '0.8rem' }}>All</MenuItem>
                  {availableChapters.map((chapter) => (
                    <MenuItem key={chapter} value={chapter} sx={{ fontSize: '0.8rem' }}>
                      {chapter}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}

          {/* Date Range Picker */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600 }}>
              DATE RANGE:
            </Typography>
            <DateRangePicker
              availableDateRange={{ min: new Date('2024-01-01'), max: new Date() }}
              currentDateRange={histogramDateRange}
              onDateRangeChange={(start, end) => setHistogramDateRange({ start, end })}
            />
          </Box>

          {/* Meeting Types Filter */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600 }}>
              TYPES:
            </Typography>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <Select
                multiple
                value={selectedMeetingTypes}
                onChange={(e) => setSelectedMeetingTypes(e.target.value as string[])}
                displayEmpty
                sx={{ fontSize: '0.8rem', '& .MuiSelect-select': { py: 0.75 } }}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.length === availableMeetingTypes.length ? (
                      <Chip label="All" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                    ) : selected.length === 0 ? (
                      <Chip label="None" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                    ) : (
                      <>
                        {selected.slice(0, 1).map((value) => (
                          <Chip key={value} label={value} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                        ))}
                        {selected.length > 1 && (
                          <Chip label={`+${selected.length - 1}`} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                        )}
                      </>
                    )}
                  </Box>
                )}
              >
                {availableMeetingTypes.map((type) => (
                  <MenuItem key={type} value={type} sx={{ fontSize: '0.8rem' }}>
                    <Checkbox checked={selectedMeetingTypes.indexOf(type) > -1} size="small" />
                    <ListItemText primary={type} primaryTypographyProps={{ fontSize: '0.8rem' }} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
      </Box>
      

        {/* Horizontal Histogram Chart */}
        <Box sx={{ 
          flex: 1, // Use remaining space
          minHeight: 400, // Increased minimum height for better spacing
          display: 'flex', 
          flexDirection: 'column', // Stack bars vertically
          gap: 1.5, 
          p: 3,
          border: '1px solid #e0e0e0',
          borderRadius: 2,
          bgcolor: '#ffffff',
          overflow: 'auto',
          position: 'relative',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
        }}>
          {histogramData.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ 
              width: '100%', 
              textAlign: 'center', 
              alignSelf: 'center' 
            }}>
              No data available for the selected date range
        </Typography>
          ) : histogramScope === 'federation' ? (
            /* Horizontal bars - Time on X-axis */
            <Box 
              ref={histogramScrollContainerRef}
              sx={{ 
                display: 'flex', 
                flexDirection: 'row', 
                gap: 1, 
                alignItems: 'flex-end',
                px: 2,
                py: 3,
                minHeight: 300,
                overflowX: 'auto'
              }}
            >
              {histogramData.map((bucket, index) => {
                const maxCount = Math.max(...histogramData.map(b => b.count), 1);
                const maxBarHeight = 250; // Maximum height for bars
                const barHeight = (bucket.count / maxCount) * maxBarHeight; // Dynamic height based on count
              
                return (
                  <Box key={index} sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: 60,
                    cursor: 'pointer',
                    '&:hover .histogram-bar': {
                      opacity: 0.9,
                      transform: 'scaleY(1.02)',
                      transformOrigin: 'bottom'
                    }
                  }}>
                    {/* Count label (above bar) */}
                    <Typography variant="caption" sx={{ 
                      fontSize: '0.75rem', 
                      color: bucket.count > 0 ? '#1976d2' : 'text.secondary',
                      fontWeight: bucket.count > 0 ? 600 : 'normal',
                      mb: 0.5
                    }}>
                      {bucket.count}
                    </Typography>
                    
                    {/* Bar (vertical) */}
                    <Box
                      className="histogram-bar"
                      sx={{ 
                        width: 40,
                        height: `${Math.max(barHeight, 2)}px`,
                        bgcolor: bucket.count > 0 ? '#1976d2' : '#e0e0e0',
                        borderRadius: '4px 4px 0 0',
                        transition: 'all 0.2s ease',
                        mb: 1,
                        boxShadow: bucket.count > 0 ? '0 1px 3px rgba(25, 118, 210, 0.2)' : 'none'
                      }}
                    />
                    
                    {/* Time label (below bar) */}
                    <Typography variant="caption" sx={{ 
                      fontSize: '0.7rem',
                      color: 'text.secondary',
                      fontWeight: 400,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      transform: 'rotate(-45deg)',
                      transformOrigin: 'center',
                      mt: 2
                    }}>
                      {bucket.label}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          ) : (
            /* Grouped bars for chapter/person view */
            (() => {
              // First, get all unique scope keys across all buckets for consistent coloring
              const allScopeKeys = new Set<string>();
              histogramData.forEach(bucket => {
                Object.keys(bucket.scopeData).forEach(key => allScopeKeys.add(key));
              });
              const sortedScopeKeys = Array.from(allScopeKeys).sort();
              // Create a color mapping based on scope key and type
              const colorMap = new Map<string, string>();
              
              if (histogramScope === 'chapter') {
                // Use custom chapter colors for chapters
                sortedScopeKeys.forEach((chapterName) => {
                  const chapterColor = getCustomChapterColor(chapterName, customColors);
                  colorMap.set(chapterName, chapterColor);
                });
              } else if (histogramScope === 'person' && selectedChapterForPersonView) {
                // Use the same chapter color for all people (shapes will distinguish them)
                const baseColor = getCustomChapterColor(selectedChapterForPersonView, customColors);
                sortedScopeKeys.forEach((personName) => {
                  colorMap.set(personName, baseColor);
                });
              } else if (histogramScope === 'conversation_type') {
                // Use specific colors for conversation types with flexible matching
                const getConversationTypeColor = (type: string): string => {
                  const normalizedType = type.toLowerCase().trim();
                  
                  if (normalizedType.includes('membership') && normalizedType.includes('one-on-one')) {
                    return '#ff9800'; // Orange for Membership One-on-One
                  } else if (normalizedType.includes('leadership') && normalizedType.includes('one-on-one')) {
                    return '#9c27b0'; // Purple for Leadership One-on-One
                  } else if (normalizedType.includes('two-on-one')) {
                    return '#dc004e'; // Red for Two-on-One
                  } else if (normalizedType.includes('one-on-one')) {
                    return '#1976d2'; // Blue for regular One-on-One
                  } else if (normalizedType.includes('house') && normalizedType.includes('meeting')) {
                    return '#4caf50'; // Green for House Meeting
                  } else if (normalizedType.includes('research')) {
                    return '#00bcd4'; // Cyan for Research
                  } else if (normalizedType.includes('unknown') || normalizedType === '') {
                    return '#757575'; // Gray for Unknown
                  } else {
                    // Assign colors based on hash for consistent coloring of unknown types
                    const colors = ['#e91e63', '#673ab7', '#3f51b5', '#2196f3', '#009688', '#8bc34a', '#cddc39', '#ffc107'];
                    let hash = 0;
                    for (let i = 0; i < type.length; i++) {
                      hash = ((hash << 5) - hash + type.charCodeAt(i)) & 0xffffffff;
                    }
                    return colors[Math.abs(hash) % colors.length];
                  }
                };
                
                sortedScopeKeys.forEach((conversationType) => {
                  colorMap.set(conversationType, getConversationTypeColor(conversationType));
                });
              } else {
                // Fallback to default colors for other scopes
                const scopeColors = ['#1976d2', '#dc004e', '#ff9800', '#4caf50', '#9c27b0', '#00bcd4', '#795548', '#607d8b'];
                sortedScopeKeys.forEach((key, index) => {
                  colorMap.set(key, scopeColors[index % scopeColors.length]);
                });
              }
              
              const allMaxCount = Math.max(...histogramData.flatMap(b => Object.values(b.scopeData)), 1);
              
              // Horizontal grouped bar view
              return (
                <Box 
                  ref={histogramScrollContainerRef}
                  sx={{ 
                    display: 'flex', 
                    flexDirection: 'row', 
                    gap: 1, 
                    alignItems: 'flex-end',
                    px: 2,
                    py: 3,
                    minHeight: 300,
                    overflowX: 'auto'
                  }}
                >
                  {histogramData.map((bucket, index) => {
                    const scopeEntries = Object.entries(bucket.scopeData).sort((a, b) => b[1] - a[1]);
                    const totalCount = scopeEntries.reduce((sum, [_, count]) => sum + count, 0);
                    const maxBarHeight = 250; // Maximum height for bars
                    const barHeight = (totalCount / allMaxCount) * maxBarHeight; // Total height for this time period
                    
                    return (
                      <Box key={index} sx={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center',
                        minWidth: Math.max(60, scopeEntries.slice(0, 8).length * 16), // Dynamic width based on number of bars
                        cursor: 'pointer'
                      }}>
                        {/* Total count label (above bar group) */}
                        <Typography variant="caption" sx={{ 
                          fontSize: '0.75rem', 
                          color: totalCount > 0 ? 'text.primary' : 'text.secondary',
                          fontWeight: totalCount > 0 ? 600 : 'normal',
                          mb: 0.5
                        }}>
                          {totalCount}
                        </Typography>
                        
                        {/* Grouped bar segments (vertical, side-by-side) */}
                        <Box sx={{ 
                          display: 'flex',
                          flexDirection: 'row', // Bars side-by-side
                          gap: 0.5, // Small gap between bars
                          alignItems: 'flex-end', // Align to bottom
                          mb: 1,
                          minHeight: `${Math.max(barHeight, 2)}px`,
                        }}>
                          {scopeEntries.length === 0 ? (
                            <Box sx={{ 
                              width: 12,
                              height: 2,
                              bgcolor: '#e0e0e0'
                            }} />
                          ) : (
                            scopeEntries.slice(0, 8).map(([scopeKey, count], segmentIndex) => {
                              const individualBarHeight = (count / allMaxCount) * maxBarHeight; // Individual bar height based on its own count
                              const barColor = colorMap.get(scopeKey) || '#999999';
                              
                              // Get consistent pattern index for individual people
                              const patternIndex = histogramScope === 'person' && selectedChapterForPersonView 
                                ? getPersonPatternIndex(scopeKey, sortedScopeKeys, histogramData)
                                : segmentIndex;
                              
                              return (
                                <Box
                                  key={scopeKey}
                                  sx={{
                                    height: `${Math.max(individualBarHeight, 2)}px`,
                                    width: 12, // Narrower bars to fit more side-by-side
                                    bgcolor: barColor,
                                    borderRadius: '2px 2px 0 0',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    opacity: hoveredOrganizer && hoveredOrganizer !== scopeKey ? 0.5 : 1,
                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                                    '&:hover': {
                                      opacity: 0.9,
                                      transform: 'scaleY(1.05)',
                                      transformOrigin: 'bottom',
                                      zIndex: 10
                                    },
                                    // Add patterns for individual people within a chapter
                                    ...(histogramScope === 'person' && selectedChapterForPersonView 
                                      ? getPersonPattern(patternIndex) 
                                      : {})
                                  }}
                                  title={`${scopeKey}: ${count}`}
                                  onClick={() => setHoveredOrganizer(hoveredOrganizer === scopeKey ? null : scopeKey)}
                                />
                              );
                            })
                          )}
                        </Box>
                        
                        {/* Time label (below bar) */}
                        <Typography variant="caption" sx={{ 
                          fontSize: '0.7rem',
                          color: 'text.secondary',
                          fontWeight: 400,
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          transform: 'rotate(-45deg)',
                          transformOrigin: 'center',
                          mt: 2
                        }}>
                          {bucket.label}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              );
            })()
          )}
          
          {/* Goal Lines for All Goal Levels (Organizer/Chapter/Federation) */}
          {(() => {
            // Show goal lines for any goal level when the time granularity matches
            // No longer restrict to person scope only
            const hasMatchingGoals = goals?.some(goal => {
              const isDaily = goal.timeWindow === '1day';
              const isWeekly = goal.timeWindow === '1week';
              const isMonthly = goal.timeWindow === '1month';
              const currentGranularity = histogramTimeGranularity as 'day' | 'week' | 'month';
              return (currentGranularity === 'day' && isDaily) ||
                     (currentGranularity === 'week' && isWeekly) ||
                     (currentGranularity === 'month' && isMonthly);
            });
            
            if (!hasMatchingGoals) {
              return null;
            }
            
            // Get all unique scope keys and their color mapping (same as bars)
            const allScopeKeys = new Set<string>();
            histogramData.forEach(bucket => {
              Object.keys(bucket.scopeData).forEach(key => allScopeKeys.add(key));
            });
            const sortedScopeKeys = Array.from(allScopeKeys).sort();
            // Create color mapping
            const colorMap = new Map<string, string>();
            
            if (histogramScope === 'chapter') {
              // Use custom chapter colors for chapters
              sortedScopeKeys.forEach((chapterName) => {
                const chapterColor = getCustomChapterColor(chapterName, customColors);
                colorMap.set(chapterName, chapterColor);
              });
            } else if (histogramScope === 'person' && selectedChapterForPersonView) {
              // Use the same chapter color for all people (shapes will distinguish them)
              const baseColor = getCustomChapterColor(selectedChapterForPersonView, customColors);
              sortedScopeKeys.forEach((personName) => {
                colorMap.set(personName, baseColor);
              });
            } else {
              // Fallback to default colors for other scopes
              const scopeColors = ['#1976d2', '#dc004e', '#ff9800', '#4caf50', '#9c27b0', '#00bcd4', '#795548', '#607d8b'];
              sortedScopeKeys.forEach((key, index) => {
                colorMap.set(key, scopeColors[index % scopeColors.length]);
              });
            }
            
            // Find goals and match them to targets with data (support multiple goals per target)
            const goalLinesList: Array<{ target: string; goal: number; color: string; goalData: any }> = [];
            
            goals?.forEach(goal => {
              const isDaily = goal.timeWindow === '1day';
              const isWeekly = goal.timeWindow === '1week';
              const isMonthly = goal.timeWindow === '1month';
              
              // Match goal type to current histogram view
              const currentGranularity = histogramTimeGranularity as 'day' | 'week' | 'month';
              const goalMatches = 
                (currentGranularity === 'day' && isDaily) ||
                (currentGranularity === 'week' && isWeekly) ||
                (currentGranularity === 'month' && isMonthly);
              
              // Check if goal is active during the histogram time range
              const goalStartDate = new Date(goal.startDate);
              const goalEndDate = goal.isIndefinite ? new Date('2099-12-31') : (goal.endDate ? new Date(goal.endDate) : new Date('2099-12-31'));
              
              // Goal is active if it overlaps with histogram date range
              const isActiveInRange = goalStartDate <= histogramEndDate && goalEndDate >= histogramStartDate;
              
              if (goalMatches && isActiveInRange) {
                // Handle different goal levels
                const currentScope = histogramScope as 'person' | 'chapter' | 'federation' | 'conversation_type';
                if (goal.level === 'organizer' && currentScope === 'person' && sortedScopeKeys.includes(goal.target)) {
                  goalLinesList.push({
                    target: goal.target,
                    goal: goal.goalCount,
                    color: colorMap.get(goal.target) || '#999999',
                    goalData: goal
                  });
                } else if (goal.level === 'chapter' && currentScope === 'chapter' && sortedScopeKeys.includes(goal.target)) {
                  goalLinesList.push({
                    target: goal.target,
                    goal: goal.goalCount,
                    color: colorMap.get(goal.target) || '#999999',
                    goalData: goal
                  });
                } else if (goal.level === 'federation' && currentScope === 'federation' && goal.target === 'Carolina Federation') {
                  goalLinesList.push({
                    target: 'Carolina Federation',
                    goal: goal.goalCount,
                    color: '#1976d2', // Federation color
                    goalData: goal
                  });
                }
              }
            });
            
            if (goalLinesList.length === 0) {
              return null;
            }
            
            const maxCount = Math.max(...histogramData.flatMap(b => Object.values(b.scopeData)), 1);
            
            // Group goals by target for dot positioning
            const goalsByTarget = new Map<string, Array<{ goal: number; color: string; goalData: any }>>();
            goalLinesList.forEach(goalLine => {
              if (!goalsByTarget.has(goalLine.target)) {
                goalsByTarget.set(goalLine.target, []);
              }
              goalsByTarget.get(goalLine.target)!.push({
                goal: goalLine.goal,
                color: goalLine.color,
                goalData: goalLine.goalData
              });
            });

            // Render goal lines for each goal target (organizer/chapter/federation) with precise date positioning
            return Array.from(goalsByTarget.entries()).flatMap(([target, targetGoals]) => {
              return targetGoals.map((goalInfo, goalIndex) => {
              const goalLineHeight = (goalInfo.goal / maxCount) * 150; // 150px is max bar height
              
              // Only show if goal line would be visible
              if (goalLineHeight < 15 || goalLineHeight > 300) {
                return null;
              }
              
              // Use the stored goal data for date information
              const originalGoal = goalInfo.goalData;
              if (!originalGoal) return null;
              
              // Calculate position based on goal start/end dates
              const goalStartDate = new Date(originalGoal.startDate);
              const goalEndDate = originalGoal.isIndefinite ? histogramEndDate : (originalGoal.endDate ? new Date(originalGoal.endDate) : histogramEndDate);
              
              // Validate dates before proceeding
              if (isNaN(goalStartDate.getTime()) || isNaN(goalEndDate.getTime())) {
                console.warn('Invalid goal dates:', { startDate: originalGoal.startDate, endDate: originalGoal.endDate });
                return null;
              }
              
              // Calculate the total histogram width and time span
              const totalTimeSpan = histogramEndDate.getTime() - histogramStartDate.getTime();
              // Calculate bar width based on current granularity
              const currentGranularity = histogramTimeGranularity as 'day' | 'week' | 'month';
              // Calculate dynamic bar width based on container width and number of bars
              const availableWidth = Math.max(containerWidth - 100, 400); // Leave some padding, minimum 400px
              const idealBarWidth = histogramData.length > 0 ? Math.max(availableWidth / histogramData.length, 30) : 110;
              
              let barWidth = Math.min(idealBarWidth, 150); // Cap maximum bar width
              if (currentGranularity === 'day') {
                barWidth = Math.min(barWidth, 80);
              } else if (currentGranularity === 'month') {
                barWidth = Math.min(barWidth, 200);
              }
              
              const histogramWidth = histogramData.length > 0 ? histogramData.length * barWidth : availableWidth;
              
              // Calculate start position (clamp to histogram bounds)
              const goalStartClamped = new Date(Math.max(goalStartDate.getTime(), histogramStartDate.getTime()));
              const startOffset = ((goalStartClamped.getTime() - histogramStartDate.getTime()) / totalTimeSpan) * histogramWidth;
              
              // Calculate end position (clamp to histogram bounds)
              const goalEndClamped = new Date(Math.min(goalEndDate.getTime(), histogramEndDate.getTime()));
              const endOffset = ((goalEndClamped.getTime() - histogramStartDate.getTime()) / totalTimeSpan) * histogramWidth;
              
              // Calculate line width
              const lineWidth = Math.max(endOffset - startOffset, 20); // Minimum 20px width for visibility
              
              return (
                <Box
                  key={target}
                  sx={{
                    position: 'absolute',
                    bottom: 16 + goalLineHeight, // 16px is padding bottom
                    left: `${startOffset}px`,
                    width: `${lineWidth}px`,
                    height: '1px',
                    borderTop: `2px dashed ${goalInfo.color}`,
                    backgroundColor: `${goalInfo.color}08`, // Very subtle background
                    zIndex: 10,
                    pointerEvents: 'none', // Line itself isn't clickable
                  }}
                >
                  {/* Goal indicator circle */}
                  <Box 
                    sx={{
                      position: 'absolute',
                      right: -6, // Center on the end of the line
                      top: -6 + (goalIndex * 16), // Vertical spacing for multiple goals (16px apart)
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: goalInfo.color,
                      border: '2px solid white',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      cursor: 'pointer',
                      pointerEvents: 'auto',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      zIndex: 20 + goalIndex, // Ensure later goals appear on top
                      '&:hover': {
                        transform: 'scale(1.2)',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Navigate to the goal details
                      if (onNavigateToGoal) {
                        onNavigateToGoal(originalGoal.id);
                      }
                    }}
                    title={`${target}: ${goalInfo.goal}/${histogramTimeGranularity}${targetGoals.length > 1 ? ` (Goal ${goalIndex + 1} of ${targetGoals.length})` : ''} (${format(goalStartDate, 'MMM dd')} - ${originalGoal.isIndefinite ? '∞' : format(goalEndDate, 'MMM dd')})\nClick to view goal details`}
                  />
                </Box>
              );
              });
            })
          })()}
        </Box>

        {/* Legend for grouped view */}
        {(histogramScope === 'chapter' || histogramScope === 'person' || histogramScope === 'conversation_type') && histogramData.length > 0 && (
          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 1, display: 'block' }}>
              {histogramScope === 'chapter' ? 'Chapter' : 
               histogramScope === 'person' ? 
                 (selectedChapterForPersonView ? `${selectedChapterForPersonView} Organizers` : 'Organizer') 
                 : histogramScope === 'conversation_type' ? 'Conversation Type'
                 : 'Scope'} Legend:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {(() => {
                // Use the same color mapping logic as the bars
                const allScopeKeys = new Set<string>();
                histogramData.forEach(bucket => {
                  Object.keys(bucket.scopeData).forEach(key => allScopeKeys.add(key));
                });
                
                // Calculate total conversation counts for each scope key
                const scopeTotals = new Map<string, number>();
                histogramData.forEach(bucket => {
                  Object.entries(bucket.scopeData).forEach(([key, count]) => {
                    scopeTotals.set(key, (scopeTotals.get(key) || 0) + count);
                  });
                });
                
                // Sort by total conversation count (descending), then alphabetically for ties
                const sortedScopeKeys = Array.from(allScopeKeys).sort((a, b) => {
                  const countA = scopeTotals.get(a) || 0;
                  const countB = scopeTotals.get(b) || 0;
                  if (countB !== countA) {
                    return countB - countA; // Higher counts first
                  }
                  return a.localeCompare(b); // Alphabetical for ties
                });
                // Create the same color mapping as used in the bars
                const colorMap = new Map<string, string>();
                
                if (histogramScope === 'chapter') {
                  // Use custom chapter colors for chapters
                  sortedScopeKeys.forEach((chapterName) => {
                    const chapterColor = getCustomChapterColor(chapterName, customColors);
                    colorMap.set(chapterName, chapterColor);
                  });
                } else if (histogramScope === 'person' && selectedChapterForPersonView) {
                  // Use the same chapter color for all people (shapes will distinguish them)
                  const baseColor = getCustomChapterColor(selectedChapterForPersonView, customColors);
                  sortedScopeKeys.forEach((personName) => {
                    colorMap.set(personName, baseColor);
                  });
                } else if (histogramScope === 'conversation_type') {
                  // Use specific colors for conversation types with flexible matching
                  const getConversationTypeColor = (type: string): string => {
                    const normalizedType = type.toLowerCase().trim();
                    
                    if (normalizedType.includes('membership') && normalizedType.includes('one-on-one')) {
                      return '#ff9800'; // Orange for Membership One-on-One
                    } else if (normalizedType.includes('leadership') && normalizedType.includes('one-on-one')) {
                      return '#9c27b0'; // Purple for Leadership One-on-One
                    } else if (normalizedType.includes('two-on-one')) {
                      return '#dc004e'; // Red for Two-on-One
                    } else if (normalizedType.includes('one-on-one')) {
                      return '#1976d2'; // Blue for regular One-on-One
                    } else if (normalizedType.includes('house') && normalizedType.includes('meeting')) {
                      return '#4caf50'; // Green for House Meeting
                    } else if (normalizedType.includes('research')) {
                      return '#00bcd4'; // Cyan for Research
                    } else if (normalizedType.includes('unknown') || normalizedType === '') {
                      return '#757575'; // Gray for Unknown
                    } else {
                      // Assign colors based on hash for consistent coloring of unknown types
                      const colors = ['#e91e63', '#673ab7', '#3f51b5', '#2196f3', '#009688', '#8bc34a', '#cddc39', '#ffc107'];
                      let hash = 0;
                      for (let i = 0; i < type.length; i++) {
                        hash = ((hash << 5) - hash + type.charCodeAt(i)) & 0xffffffff;
                      }
                      return colors[Math.abs(hash) % colors.length];
                    }
                  };
                  
                  sortedScopeKeys.forEach((conversationType) => {
                    colorMap.set(conversationType, getConversationTypeColor(conversationType));
                  });
                } else {
                  // Fallback to default colors for other scopes
                  const scopeColors = ['#1976d2', '#dc004e', '#ff9800', '#4caf50', '#9c27b0', '#00bcd4', '#795548', '#607d8b'];
                  sortedScopeKeys.forEach((key, index) => {
                    colorMap.set(key, scopeColors[index % scopeColors.length]);
                  });
                }
                
                return sortedScopeKeys.slice(0, 8).map((scopeKey, index) => {
                  // Get consistent pattern index for individual people
                  const patternIndex = histogramScope === 'person' && selectedChapterForPersonView 
                    ? getPersonPatternIndex(scopeKey, sortedScopeKeys, histogramData)
                    : index;
                    
                  return (
                    <Box 
                      key={scopeKey} 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 0.5,
                        cursor: 'pointer',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.04)'
                        }
                      }}
                      onMouseEnter={() => setHoveredOrganizer(scopeKey)}
                      onMouseLeave={() => setHoveredOrganizer(null)}
                    >
                      <Box sx={{
                        width: 16,
                        height: 16,
                        bgcolor: colorMap.get(scopeKey) || '#999999',
                        borderRadius: '2px',
                        // Add patterns for individual people within a chapter
                        ...(histogramScope === 'person' && selectedChapterForPersonView 
                          ? getPersonPattern(patternIndex) 
                          : {})
                      }} />
                      <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                        {scopeKey}
                      </Typography>
                    </Box>
                  );
                });
              })()}
            </Box>
        </Box>
      )}

        {/* Summary Statistics */}
        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Total Conversations:</strong> {histogramData.reduce((sum, bucket) => sum + bucket.count, 0)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Average per {histogramTimeGranularity}:</strong> {
              histogramData.length > 0 
                ? (histogramData.reduce((sum, bucket) => sum + bucket.count, 0) / histogramData.length).toFixed(1)
                : '0'
            }
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Peak:</strong> {Math.max(...histogramData.map(b => b.count), 0)} conversations
          </Typography>
        </Box>
        
      </Paper>



    </Box>
  );
};

const ConversationsVisualization: React.FC<ConversationsVisualizationProps> = ({ 
  width, 
  height, 
  meetings, 
  contacts, 
  nodes, 
  currentDateRange, 
  userMap, 
  orgIds,
  selectedChapter,
  organizerFilter,
  goals = [],
  onNavigateToGoal,
  hoveredOrganizer,
  onOrganizerHover
}) => {
  // Use a ref to measure the container and provide dynamic sizing
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = React.useState({ width: 800, height: 600 });

  React.useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: rect.width || 800,
          height: rect.height || 600
        });
      }
    };

    // Initial size
    updateSize();

    // Update on resize
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <Box 
      ref={containerRef}
      sx={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'hidden', 
        display: 'flex', 
        flexDirection: 'column',
        minHeight: 0 // Important for flex child
      }}
    >
      {/* Content with dynamic sizing */}
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <ConversationSummaryView 
          meetings={meetings}
          contacts={contacts}
          currentDateRange={currentDateRange}
          organizationalView="organizers" // Fixed to organizers view since that's where goals work
          userMap={userMap}
          orgIds={orgIds}
          selectedChapter={selectedChapter}
          organizerFilter={organizerFilter}
          goals={goals}
          onNavigateToGoal={onNavigateToGoal}
          hoveredOrganizer={hoveredOrganizer}
          onOrganizerHover={onOrganizerHover}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
        />
      </Box>
    </Box>
  );
};

export default ConversationsVisualization;