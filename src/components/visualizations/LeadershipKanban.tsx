import React, { useMemo, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Chip,
  Stack,
  Badge,
  Button,
  Tooltip
} from '@mui/material';
import {
  Email as EmailIcon,
  Phone as PhoneIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { LOE_LEVELS, getLOEColor, SPECIAL_LOE_COLORS } from '../../theme/loeColors';
import { getChapterColor } from '../../theme/chapterColors';

type GroupByOption = 'none' | 'chapter';

interface PersonRecord {
  id: string;
  name: string;
  type?: string;
  chapter: string;
  mostRecentContact: Date | null;
  totalMeetings: number;
  latestNotes: string;
  email?: string;
  phone?: string;
  organizers: string[];
  loeStatus?: string;
  memberStatus?: string;
  allMeetings: any[];
}

interface LeadershipKanbanProps {
  people: PersonRecord[];
  loeCounts?: { total: number; by_loe: { [key: string]: number } };
  onPersonClick?: (person: PersonRecord) => void;
  onLOEClick?: (loeLevel: string) => void;
  onChapterClick?: (chapter: string) => void;
  onOrganizerClick?: (organizer: string) => void;
}

interface KanbanColumn {
  key: string;
  title: string;
  color: string;
  backgroundColor: string;
  people: PersonRecord[];
  description: string;
}

const LeadershipKanban: React.FC<LeadershipKanbanProps> = ({
  people,
  loeCounts,
  onPersonClick,
  onLOEClick,
  onChapterClick,
  onOrganizerClick
}) => {
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');

  // Helper function to get total count for an LOE level from API
  const getTotalCountForLOE = (loeKey: string): number | null => {
    if (!loeCounts || !loeCounts.by_loe) return null;
    
    // Map LOE keys to possible database values
    const loeMapping: { [key: string]: string[] } = {
      'staff': ['Staff', 'Organizer'],
      'team_leader': ['5_TeamLeader', 'Team Leader'],
      'team_member': ['4_TeamMember', 'Team Member'],
      'member': ['3_Member', 'Member'],
      'supporter': ['2_Supporter', 'Supporter', '1_Supporter'],
      'unknown': ['Unknown', 'null', '']
    };
    
    const possibleKeys = loeMapping[loeKey] || [loeKey];
    let total = 0;
    
    for (const key of possibleKeys) {
      if (loeCounts.by_loe[key]) {
        total += loeCounts.by_loe[key];
      }
    }
    
    return total > 0 ? total : null;
  };

  // Get unique chapters for grouping
  const uniqueChapters = useMemo(() => {
    const chapters = new Set<string>();
    people.forEach(p => {
      if (p.chapter) chapters.add(p.chapter);
    });
    return Array.from(chapters).sort();
  }, [people]);

  // Generate consistent colors for chapters
  const chapterColors = useMemo(() => {
    const colors: Record<string, string> = {};
    uniqueChapters.forEach((chapter, index) => {
      colors[chapter] = getChapterColor(chapter) || `hsl(${(index * 360) / uniqueChapters.length}, 70%, 50%)`;
    });
    return colors;
  }, [uniqueChapters]);

  const kanbanData = useMemo(() => {
    // Create columns for each LOE level plus special categories (excluding Unknown)
    const columns: KanbanColumn[] = [
      // LOE Levels (in reverse order - 5 to 1)
      ...LOE_LEVELS.slice().reverse().map(loe => ({
        key: loe.key,
        title: loe.label,
        color: loe.color,
        backgroundColor: loe.backgroundColor,
        description: loe.description,
        people: people.filter(person => {
          const personLOE = person.loeStatus || '';
          return personLOE.includes(loe.level.toString()) ||
                 personLOE.toLowerCase().includes(loe.key.toLowerCase()) ||
                 personLOE.toLowerCase().includes(loe.label.toLowerCase());
        })
      })),
      // Staff category
      {
        key: 'staff',
        title: 'Staff',
        color: SPECIAL_LOE_COLORS.staff.color,
        backgroundColor: SPECIAL_LOE_COLORS.staff.backgroundColor,
        description: 'Organizers and staff members',
        people: people.filter(person => {
          const personLOE = person.loeStatus || '';
          return personLOE.toLowerCase().includes('staff') || 
                 personLOE.toLowerCase().includes('organizer');
        })
      }
      // Note: Removed "Unknown" category as it contains 130k+ people and skews the visualization
    ];

    return columns;
  }, [people]);

  // Calculate total people excluding Unknown
  const totalPeople = useMemo(() => {
    if (loeCounts?.by_loe) {
      // Sum all counts except Unknown
      return Object.entries(loeCounts.by_loe)
        .filter(([key]) => !key.toLowerCase().includes('unknown') && key.toLowerCase() !== 'null')
        .reduce((sum, [, count]) => sum + (count as number), 0);
    }
    return people.length;
  }, [loeCounts, people.length]);

  // Helper to get count for a column (use loeCounts if available, otherwise people.length)
  const getColumnCount = useCallback((columnKey: string, peopleInColumn: any[]) => {
    if (loeCounts?.by_loe) {
      // Find the matching count by checking if the API key contains our column identifier
      // API returns keys like "02_TeamLeader", "03_Core", "04_Supporter", "Staff/Organizer"
      let matchedCount = 0;
      
      // Special handling for staff
      if (columnKey === 'staff') {
        // Look for "Staff/Organizer" or any key containing "staff" or "organizer"
        for (const [apiKey, count] of Object.entries(loeCounts.by_loe)) {
          if (apiKey.toLowerCase().includes('staff') || apiKey.toLowerCase().includes('organizer')) {
            matchedCount = count as number;
            break;
          }
        }
      } else {
        // For LOE levels, match by the label or key
        const loeLevel = LOE_LEVELS.find(loe => loe.key.toLowerCase() === columnKey.toLowerCase());
        
        if (loeLevel) {
          // Try to find a match using the LOE label
          for (const [apiKey, count] of Object.entries(loeCounts.by_loe)) {
            // Check if the API key contains the LOE label (case-insensitive)
            if (apiKey.toLowerCase().includes(loeLevel.label.toLowerCase()) ||
                apiKey.toLowerCase().includes(loeLevel.key.toLowerCase()) ||
                apiKey.includes(`0${loeLevel.level}_`) ||
                apiKey.includes(`${loeLevel.level}_`)) {
              matchedCount = count as number;
              break;
            }
          }
        }
      }
      
      // Return matched count if found, otherwise use people in column
      return matchedCount > 0 ? matchedCount : peopleInColumn.length;
    }
    return peopleInColumn.length;
  }, [loeCounts]);

  // Calculate max count for histogram scaling based on DISPLAYED columns only
  const maxCount = useMemo(() => {
    // Get the count for each displayed column
    const displayedCounts = kanbanData.map(column => {
      if (loeCounts?.by_loe) {
        // Try to get count from API
        let matchedCount = 0;
        
        if (column.key === 'staff') {
          for (const [apiKey, count] of Object.entries(loeCounts.by_loe)) {
            if (apiKey.toLowerCase().includes('staff') || apiKey.toLowerCase().includes('organizer')) {
              matchedCount = count as number;
              break;
            }
          }
        } else {
          const loeLevel = LOE_LEVELS.find(loe => loe.key.toLowerCase() === column.key.toLowerCase());
          if (loeLevel) {
            for (const [apiKey, count] of Object.entries(loeCounts.by_loe)) {
              if (apiKey.toLowerCase().includes(loeLevel.label.toLowerCase()) ||
                  apiKey.toLowerCase().includes(loeLevel.key.toLowerCase()) ||
                  apiKey.includes(`0${loeLevel.level}_`) ||
                  apiKey.includes(`${loeLevel.level}_`)) {
                matchedCount = count as number;
                break;
              }
            }
          }
        }
        
        return matchedCount > 0 ? matchedCount : column.people.length;
      }
      return column.people.length;
    });
    
    return displayedCounts.length > 0 ? Math.max(...displayedCounts) : 1;
  }, [kanbanData, loeCounts]);

  // Calculate grouped data for stacked histogram
  const groupedHistogramData = useMemo(() => {
    if (groupBy === 'none') return null;

    return kanbanData.map(column => {
      const chapterCounts: Record<string, number> = {};
      column.people.forEach(person => {
        const chapter = person.chapter || 'Unknown';
        chapterCounts[chapter] = (chapterCounts[chapter] || 0) + 1;
      });
      return {
        ...column,
        chapterCounts,
        // Sort chapters by count for better visualization
        sortedChapters: Object.entries(chapterCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([chapter]) => chapter)
      };
    });
  }, [kanbanData, groupBy]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#fafafa' }}>
      {/* Header */}
      <Box sx={{ p: 3, borderBottom: '1px solid #e0e0e0', bgcolor: '#fff' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem', mb: 0.5 }}>
              Leadership Ladder
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
              Organize people by leadership development stage
            </Typography>
          </Box>
          
          {/* Group By Buttons */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button
              size="small"
              variant={groupBy === 'none' ? 'contained' : 'outlined'}
              onClick={() => setGroupBy('none')}
              sx={{ minWidth: 70, textTransform: 'none', fontSize: '0.8rem' }}
            >
              All
            </Button>
            <Button
              size="small"
              variant={groupBy === 'chapter' ? 'contained' : 'outlined'}
              onClick={() => setGroupBy('chapter')}
              sx={{ minWidth: 90, textTransform: 'none', fontSize: '0.8rem' }}
            >
              By Chapter
            </Button>
          </Box>
        </Box>

        {/* Legend for grouped view */}
        {groupBy === 'chapter' && uniqueChapters.length > 0 && (
          <Box sx={{ 
            mt: 1.5, 
            pt: 1.5, 
            borderTop: '1px solid #e0e0e0',
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 1,
            alignItems: 'center'
          }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', mr: 1 }}>
              Chapters:
            </Typography>
            {uniqueChapters.map(chapter => (
              <Box 
                key={chapter} 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 0.5,
                  cursor: 'pointer',
                  '&:hover': { opacity: 0.7 }
                }}
              >
                <Box 
                  sx={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: '2px',
                    backgroundColor: chapterColors[chapter] 
                  }} 
                />
                <Typography variant="caption" sx={{ fontSize: '11px' }}>
                  {chapter}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Histogram Bar Chart */}
      <Box sx={{ 
        display: 'flex', 
        gap: 3, 
        px: 3,
        pt: 2.5,
        pb: 2,
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        borderBottom: '1px solid #e0e0e0',
        overflowX: 'auto'
      }}>
        {kanbanData.map((column, colIndex) => {
          const columnCount = getColumnCount(column.key, column.people);
          const barHeight = maxCount > 0 ? (columnCount / maxCount) * 100 : 0;
          const groupedColumn = groupedHistogramData?.[colIndex];
          
          // For grouped view, find max count within this column's chapters
          const maxChapterCount = groupedColumn 
            ? Math.max(...Object.values(groupedColumn.chapterCounts), 1)
            : 1;
          
          return (
            <Box
              key={`histogram-${column.key}`}
              sx={{
                minWidth: 240,
                maxWidth: 240,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.75
              }}
            >
              {/* Count label above bar */}
              <Typography 
                variant="caption" 
                sx={{ 
                  fontWeight: 'bold', 
                  color: column.color,
                  fontSize: '12px'
                }}
              >
                {columnCount}
              </Typography>
              
              {/* Bar - Grouped side-by-side when grouped, solid when not */}
              {groupBy === 'none' || !groupedColumn ? (
                // Solid bar (no grouping)
                <Box
                  sx={{
                    width: '80%',
                    height: `${Math.max(barHeight, 4)}px`,
                    backgroundColor: column.color,
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.3s ease',
                    cursor: 'pointer',
                    '&:hover': {
                      opacity: 0.8,
                      transform: 'scaleY(1.05)',
                      transformOrigin: 'bottom'
                    }
                  }}
                  onClick={() => onLOEClick?.(column.title)}
                  title={`${column.title}: ${column.people.length} people`}
                />
              ) : (
                // Grouped bars (side-by-side by chapter)
                <Box
                  sx={{
                    width: '90%',
                    height: '80px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    gap: '2px',
                    cursor: 'pointer'
                  }}
                  onClick={() => onLOEClick?.(column.title)}
                >
                  {groupedColumn.sortedChapters.map((chapter) => {
                    const count = groupedColumn.chapterCounts[chapter] || 0;
                    // Scale bar height relative to max count across ALL columns for consistent scaling
                    const groupedBarHeight = maxCount > 0 
                      ? (count / maxCount) * 80 
                      : 0;
                    const barWidth = Math.max(
                      Math.floor(160 / Math.max(groupedColumn.sortedChapters.length, 1)) - 2,
                      4
                    );
                    return (
                      <Tooltip 
                        key={chapter} 
                        title={`${chapter}: ${count}`}
                        arrow
                        placement="top"
                      >
                        <Box
                          sx={{
                            width: `${barWidth}px`,
                            height: `${Math.max(groupedBarHeight, 2)}px`,
                            backgroundColor: chapterColors[chapter] || '#999',
                            borderRadius: '2px 2px 0 0',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              filter: 'brightness(1.2)',
                              transform: 'scaleY(1.05)',
                              transformOrigin: 'bottom'
                            }
                          }}
                        />
                      </Tooltip>
                    );
                  })}
                </Box>
              )}
              
              {/* Label below bar */}
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'text.secondary',
                  fontSize: '10px',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%'
                }}
              >
                {column.title}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* Kanban Columns */}
      <Box sx={{ 
        display: 'flex', 
        gap: 3, 
        p: 3, 
        overflowX: 'auto',
        overflowY: 'hidden',
        flex: 1,
        minHeight: 0
      }}>
        {kanbanData.map((column) => (
          <Box
            key={column.key}
            sx={{
              minWidth: 280,
              maxWidth: 280,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#f8f9fa',
              borderRadius: 2,
              border: '1px solid #e0e0e0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
            }}
          >
            {/* Column Header */}
            <Box
              sx={{
                p: 2.5,
                backgroundColor: column.backgroundColor,
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                borderBottom: `3px solid ${column.color}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: `${column.color}15`
                }
              }}
              onClick={() => onLOEClick?.(column.title)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    color: column.color
                  }}
                >
                  {column.title}
                </Typography>
                <Tooltip title={`Showing ${column.people.length} loaded contacts`}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <Badge 
                      badgeContent={(() => {
                        const totalCount = getTotalCountForLOE(column.key);
                        if (totalCount !== null && totalCount > column.people.length) {
                          return `${column.people.length} of ${totalCount}`;
                        }
                        return column.people.length;
                      })()} 
                      color="primary"
                      sx={{
                        '& .MuiBadge-badge': {
                          backgroundColor: column.color,
                          color: 'white',
                          fontSize: '0.7rem',
                          height: 'auto',
                          minWidth: '20px',
                          padding: '2px 6px'
                        }
                      }}
                    />
                    {(() => {
                      const totalCount = getTotalCountForLOE(column.key);
                      if (totalCount !== null && totalCount > column.people.length) {
                        return (
                          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', mt: 0.25 }}>
                            Total: {totalCount}
                          </Typography>
                        );
                      }
                      return null;
                    })()}
                  </Box>
                </Tooltip>
              </Box>
            </Box>

            {/* People Cards */}
            <Box sx={{ 
              p: 1, 
              flex: 1, 
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              minHeight: 0 // Allows flex child to shrink below content size
            }}>
              {column.people.map((person) => (
                <Card
                  key={person.id}
                  sx={{
                    cursor: 'pointer',
                    border: `1px solid ${column.color}20`,
                    borderRadius: 1.5,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    transition: 'all 0.2s ease',
                    minHeight: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: `0 6px 16px ${column.color}30`,
                      borderColor: column.color
                    }
                  }}
                  onClick={() => onPersonClick?.(person)}
                >
                  <CardContent sx={{ 
                    p: 2, 
                    '&:last-child': { pb: 2 },
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}>
                    {/* Name */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          fontSize: '0.85rem',
                          backgroundColor: column.color,
                          color: 'white',
                          fontWeight: 600
                        }}
                      >
                        {person.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </Avatar>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1
                        }}
                      >
                        {person.name}
                      </Typography>
                    </Box>

                    {/* Chapter */}
                    <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.75 }}>
                      <Chip
                        label={person.chapter}
                        size="small"
                        variant="outlined"
                        onClick={(e) => {
                          e.stopPropagation();
                          onChapterClick?.(person.chapter);
                        }}
                        sx={{
                          fontSize: '0.6rem',
                          height: 18,
                          borderColor: column.color + '60',
                          color: column.color,
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: column.color + '10',
                            borderColor: column.color
                          }
                        }}
                      />
                    </Stack>

                    {/* Organizers */}
                    {person.organizers && person.organizers.length > 0 && (
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 0.75, 
                          mb: 1,
                          cursor: 'pointer',
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          bgcolor: 'rgba(0, 0, 0, 0.02)',
                          transition: 'background-color 0.2s',
                          '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.06)'
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (person.organizers[0]) {
                            onOrganizerClick?.(person.organizers[0]);
                          }
                        }}
                      >
                        <PersonIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography 
                          variant="caption" 
                          color="text.secondary"
                          sx={{ 
                            fontSize: '0.7rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {person.organizers.slice(0, 2).join(', ')}
                          {person.organizers.length > 2 && ` +${person.organizers.length - 2}`}
                        </Typography>
                      </Box>
                    )}

                    {/* Contact Info */}
                    {(person.email || person.phone) && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mb: 0.5 }}>
                        {person.email && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <EmailIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                            <Typography 
                              variant="caption" 
                              color="text.secondary"
                              sx={{ 
                                fontSize: '0.6rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {person.email}
                            </Typography>
                          </Box>
                        )}
                        {person.phone && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PhoneIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                            <Typography 
                              variant="caption" 
                              color="text.secondary"
                              sx={{ 
                                fontSize: '0.6rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {person.phone}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}

                    {/* Meetings & Last Contact */}
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: 0.5,
                      mt: 'auto',
                      pt: 1.5,
                      borderTop: '1px solid #e0e0e0'
                    }}>
                      {(() => {
                        // Calculate meetings in different time periods
                        const now = new Date();
                        const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
                        
                        let last30Days = 0;
                        let last3Months = 0;
                        let last6Months = 0;
                        
                        person.allMeetings?.forEach((meeting: any) => {
                          const meetingDate = meeting.datestamp ? 
                            (typeof meeting.datestamp === 'string' ? new Date(meeting.datestamp) : new Date(meeting.datestamp.value)) 
                            : null;
                          
                          if (meetingDate) {
                            if (meetingDate >= oneMonthAgo) last30Days++;
                            if (meetingDate >= threeMonthsAgo) last3Months++;
                            if (meetingDate >= sixMonthsAgo) last6Months++;
                          }
                        });
                        
                        return (
                          <Tooltip
                            title={
                              <Box>
                                <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>
                                  Meeting History
                                </Typography>
                                <Typography variant="caption" display="block">
                                  Last 30 days: {last30Days}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  Last 3 months: {last3Months}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  Last 6 months: {last6Months}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  All time: {person.totalMeetings}
                                </Typography>
                              </Box>
                            }
                            arrow
                            placement="top"
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'help', gap: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                                {person.totalMeetings} total • {last3Months} in 3mo
                              </Typography>
                              <Typography 
                                variant="caption" 
                                color="text.secondary" 
                                sx={{ 
                                  fontSize: '0.7rem',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '90px'
                                }}
                              >
                                {person.mostRecentContact ? 
                                  new Date(person.mostRecentContact).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 
                                  'No contact'
                                }
                              </Typography>
                            </Box>
                          </Tooltip>
                        );
                      })()}
                    </Box>
                  </CardContent>
                </Card>
              ))}

              {/* Empty state */}
              {column.people.length === 0 && (
                <Box
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    color: 'text.secondary',
                    fontStyle: 'italic',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    minHeight: 120 // Match card height for consistency
                  }}
                >
                  <Typography variant="caption">
                    No people in this stage
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default LeadershipKanban;
