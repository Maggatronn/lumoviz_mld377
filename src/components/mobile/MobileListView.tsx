import React, { useState, useMemo } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Divider,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Chat as ChatIcon,
  FilterList as FilterListIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { format } from 'date-fns';

interface MobileListViewProps {
  meetings: any[];
  contacts: any[];
  nodes: any[];
  currentDateRange: { start: Date; end: Date } | null;
  selectedChapter: string;
  userMap?: Map<string, any>;
  orgIds?: any[];
  onNodeSelect?: (nodeId: string) => void;
  onMeetingSelect?: (meeting: any) => void;
}

interface PeopleFilterState {
  organizer: string;
  chapter: string;
  searchText: string;
  loeStatus: string;
  hasRecentContact: boolean | null;
}

interface EnhancedPersonData {
  id: string;
  name: string;
  chapter: string;
  type?: string;
  email?: string;
  phone?: string;
  loeStatus?: string;
  totalMeetings: number;
  mostRecentContact: Date | null;
  organizers: string[];
  latestNotes: string;
}

type ListViewMode = 'people' | 'meetings' | 'contacts';

const MobileListView: React.FC<MobileListViewProps> = ({
  meetings,
  contacts,
  nodes,
  currentDateRange,
  selectedChapter,
  userMap = new Map(),
  orgIds = [],
  onNodeSelect,
  onMeetingSelect
}) => {
  const [searchText, setSearchText] = useState('');
  const [viewMode, setViewMode] = useState<ListViewMode>('people');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [showPersonDetail, setShowPersonDetail] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<EnhancedPersonData | null>(null);
  const [filters, setFilters] = useState<PeopleFilterState>({
    organizer: '',
    chapter: '',
    searchText: '',
    loeStatus: '',
    hasRecentContact: null
  });

  // Enhanced people data processing
  const enhancedPeopleData = useMemo(() => {
    const peopleMap = new Map<string, EnhancedPersonData>();

    // Process each person from nodes
    nodes.forEach(node => {
      if (!peopleMap.has(node.id)) {
        const userInfo = userMap.get(parseInt(node.id)) || {};
        const orgInfo = orgIds.find(p => p.vanid && p.vanid.toString() === node.id);
        
        peopleMap.set(node.id, {
          id: node.id,
          name: node.name || userInfo.name || `${userInfo.firstname || ''} ${userInfo.lastname || ''}`.trim() || `Person ${node.id}`,
          chapter: node.chapter || userInfo.chapter || orgInfo?.chapter || 'Unknown',
          type: node.type || userInfo.type || orgInfo?.type || 'contact',
          email: userInfo.email || orgInfo?.email,
          phone: userInfo.phone || orgInfo?.phone,
          loeStatus: userInfo.loe_status || orgInfo?.loe_status || 'Unknown',
          totalMeetings: 0,
          mostRecentContact: null,
          organizers: [],
          latestNotes: ''
        });
      }
    });

    // Process meetings to enhance people data
    meetings.forEach(meeting => {
      if (!meeting.vanid || !meeting.organizer_vanid) return;
      
      const organizeeId = meeting.vanid.toString();
      const organizerId = meeting.organizer_vanid.toString();
      const person = peopleMap.get(organizeeId);
      
      if (person) {
        // Update meeting count
        person.totalMeetings += 1;
        
        // Update most recent contact
        const meetingDate = typeof meeting.datestamp === 'string' 
          ? new Date(meeting.datestamp) 
          : new Date(meeting.datestamp.value);
        
        if (!person.mostRecentContact || meetingDate > person.mostRecentContact) {
          person.mostRecentContact = meetingDate;
        }
        
        // Update latest notes
        const notes = [
          meeting.notes_purpose,
          meeting.notes_commitments,
          meeting.notes_stakes,
          meeting.notes_development,
          meeting.notes_evaluation
        ].filter(Boolean).join(' | ');
        
        if (notes && (!person.latestNotes || meetingDate === person.mostRecentContact)) {
          person.latestNotes = notes;
        }
        
        // Track organizers
        const organizerInfo = userMap.get(meeting.organizer_vanid) || {};
        const organizerOrgInfo = orgIds.find(p => p.vanid && p.vanid.toString() === organizerId);
        
        let organizerName = '';
        if (meeting.organizer && meeting.organizer.trim() && meeting.organizer !== 'null null') {
          organizerName = meeting.organizer.trim();
        } else if (organizerInfo.name && organizerInfo.name.trim() && organizerInfo.name !== 'null null') {
          organizerName = organizerInfo.name.trim();
        } else if ((organizerInfo.firstname && organizerInfo.firstname !== 'null') || (organizerInfo.lastname && organizerInfo.lastname !== 'null')) {
          const firstName = organizerInfo.firstname && organizerInfo.firstname !== 'null' ? organizerInfo.firstname.trim() : '';
          const lastName = organizerInfo.lastname && organizerInfo.lastname !== 'null' ? organizerInfo.lastname.trim() : '';
          organizerName = `${firstName} ${lastName}`.trim();
        } else if (organizerOrgInfo && ((organizerOrgInfo.firstname && organizerOrgInfo.firstname !== 'null') || (organizerOrgInfo.lastname && organizerOrgInfo.lastname !== 'null'))) {
          const firstName = organizerOrgInfo.firstname && organizerOrgInfo.firstname !== 'null' ? organizerOrgInfo.firstname.trim() : '';
          const lastName = organizerOrgInfo.lastname && organizerOrgInfo.lastname !== 'null' ? organizerOrgInfo.lastname.trim() : '';
          organizerName = `${firstName} ${lastName}`.trim();
        }
        
        if (!organizerName || organizerName === 'null null' || organizerName.trim() === '') {
          organizerName = `Organizer ${meeting.organizer_vanid}`;
        }
        
        if (!person.organizers.includes(organizerName)) {
          person.organizers.push(organizerName);
        }
      }
    });

    return Array.from(peopleMap.values());
  }, [nodes, meetings, userMap, orgIds]);

  // Filter and process data based on search and filters
  const filteredData = useMemo(() => {
    const searchLower = (searchText || filters.searchText).toLowerCase();

    switch (viewMode) {
      case 'people':
        let filtered = enhancedPeopleData;

        // Apply search filter
        if (searchLower) {
          filtered = filtered.filter(person =>
            person.name.toLowerCase().includes(searchLower) ||
            person.chapter.toLowerCase().includes(searchLower) ||
            person.organizers.some(org => org.toLowerCase().includes(searchLower)) ||
            person.latestNotes.toLowerCase().includes(searchLower)
          );
        }

        // Apply organizer filter
        if (filters.organizer) {
          const organizerLower = filters.organizer.toLowerCase();
          filtered = filtered.filter(person =>
            person.organizers.some(org => org.toLowerCase().includes(organizerLower))
          );
        }

        // Apply chapter filter
        if (filters.chapter) {
          const chapterLower = filters.chapter.toLowerCase();
          filtered = filtered.filter(person =>
            person.chapter.toLowerCase().includes(chapterLower)
          );
        }

        // Apply LOE status filter
        if (filters.loeStatus) {
          filtered = filtered.filter(person =>
            person.loeStatus?.toLowerCase().includes(filters.loeStatus.toLowerCase())
          );
        }

        // Apply recent contact filter
        if (filters.hasRecentContact !== null) {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          if (filters.hasRecentContact) {
            filtered = filtered.filter(person =>
              person.mostRecentContact && person.mostRecentContact >= thirtyDaysAgo
            );
          } else {
            filtered = filtered.filter(person =>
              !person.mostRecentContact || person.mostRecentContact < thirtyDaysAgo
            );
          }
        }

        return filtered.sort((a, b) => a.name.localeCompare(b.name));

      case 'meetings':
        return meetings
          .filter(meeting => {
            const searchableText = [
              meeting.organizer_firstname,
              meeting.organizer_lastname,
              meeting.contact_firstname,
              meeting.contact_lastname,
              meeting.notes_purpose,
              meeting.notes_commitments,
              meeting.meeting_type
            ].join(' ').toLowerCase();
            return searchableText.includes(searchLower);
          })
          .sort((a, b) => {
            const aDate = new Date(typeof a.datestamp === 'object' ? a.datestamp.value : a.datestamp);
            const bDate = new Date(typeof b.datestamp === 'object' ? b.datestamp.value : b.datestamp);
            return bDate.getTime() - aDate.getTime();
          })
          .slice(0, 50); // Limit to first 50 for performance

      case 'contacts':
        return contacts
          .filter(contact => {
            const searchableText = [
              contact.source_firstname,
              contact.source_lastname,
              contact.target_firstname,
              contact.target_lastname,
              contact.contact_type,
              contact.contact_result
            ].join(' ').toLowerCase();
            return searchableText.includes(searchLower);
          })
          .sort((a, b) => {
            const aDate = new Date(typeof a.utc_datecanvassed === 'object' ? a.utc_datecanvassed.value : a.utc_datecanvassed);
            const bDate = new Date(typeof b.utc_datecanvassed === 'object' ? b.utc_datecanvassed.value : b.utc_datecanvassed);
            return bDate.getTime() - aDate.getTime();
          })
          .slice(0, 50);

      default:
        return [];
    }
  }, [viewMode, searchText, nodes, meetings, contacts]);

  const formatDate = (date: any) => {
    try {
      const dateObj = typeof date === 'object' ? new Date(date.value) : new Date(date);
      return format(dateObj, 'MMM dd, yyyy');
    } catch {
      return 'Unknown Date';
    }
  };

  const getPersonMeetingCount = (nodeId: string) => {
    return meetings.filter(meeting => 
      meeting.organizer_vanid?.toString() === nodeId || 
      meeting.vanid?.toString() === nodeId
    ).length;
  };

  // Filter handlers
  const handleFilterChange = (field: keyof PeopleFilterState, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.organizer) count++;
    if (filters.chapter) count++;
    if (filters.searchText) count++;
    if (filters.loeStatus) count++;
    if (filters.hasRecentContact !== null) count++;
    return count;
  };

  const handleClearFilters = () => {
    setFilters({
      organizer: '',
      chapter: '',
      searchText: '',
      loeStatus: '',
      hasRecentContact: null
    });
  };

  // Get available filter options
  const availableChapters = useMemo(() => {
    return Array.from(new Set(enhancedPeopleData.map(person => person.chapter).filter(Boolean)));
  }, [enhancedPeopleData]);

  const availableOrganizers = useMemo(() => {
    const organizerSet = new Set<string>();
    enhancedPeopleData.forEach(person => {
      person.organizers.forEach(org => organizerSet.add(org));
    });
    return Array.from(organizerSet).sort();
  }, [enhancedPeopleData]);

  const formatLOEStatus = (loe: string): string => {
    if (!loe || loe === 'Unknown') return 'Unknown';
    
    switch (loe) {
      case '1_Elected Leader':
        return 'Leader';
      case '2_Team Leader':
        return 'Team Lead';
      case '3_Team Member':
        return 'Member';
      case '4_Activated Prospect':
        return 'Active';
      case '5_Prospect':
        return 'Prospect';
      default:
        return loe.replace(/^\d+_/, '').replace(/_/g, ' ');
    }
  };

  // Person detail view handlers
  const handlePersonClick = (person: EnhancedPersonData) => {
    setSelectedPerson(person);
    setShowPersonDetail(true);
    // Still call onNodeSelect for any parent component functionality
    onNodeSelect?.(person.id);
  };

  const handlePersonDetailClose = () => {
    setShowPersonDetail(false);
    setSelectedPerson(null);
  };

  const getChapterColor = (chapter: string) => {
    // Simple hash-based color generation
    let hash = 0;
    for (let i = 0; i < chapter.length; i++) {
      hash = chapter.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 50%)`;
  };

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  // Render person detail view if a person is selected
  if (showPersonDetail && selectedPerson) {
    return (
      <Box sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        pb: 8, // Space for bottom navigation
        bgcolor: 'background.default'
      }}>
        {/* Person Detail Header */}
        <Box sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          p: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <IconButton 
              onClick={handlePersonDetailClose}
              sx={{ 
                bgcolor: 'action.hover',
                '&:hover': { bgcolor: 'action.selected' }
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Avatar 
              sx={{ 
                bgcolor: getChapterColor(selectedPerson.chapter || 'Unknown'),
                width: 48, 
                height: 48 
              }}
            >
              <PersonIcon />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight="bold">
                {selectedPerson.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedPerson.chapter} • {formatLOEStatus(selectedPerson.loeStatus || 'Unknown')}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Person Detail Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2, pb: 4 }}>
          <Stack spacing={3}>
            {/* Contact Information Card */}
            <Card sx={{ border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3, color: 'primary.main' }}>
                  Contact Information
                </Typography>
                
                <Stack spacing={2}>
                  {/* Leadership Level */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 1 }}>
                      Leadership Level
                    </Typography>
                    <Chip 
                      label={formatLOEStatus(selectedPerson.loeStatus || 'Unknown')} 
                      size="medium"
                      color={
                        selectedPerson.loeStatus?.includes('Leader') || selectedPerson.loeStatus?.includes('1_') ? 'success' :
                        selectedPerson.loeStatus?.includes('Member') || selectedPerson.loeStatus?.includes('3_') ? 'info' :
                        selectedPerson.loeStatus?.includes('Active') || selectedPerson.loeStatus?.includes('4_') ? 'warning' :
                        'default'
                      }
                    />
                  </Box>

                  {/* Contact Details */}
                  {selectedPerson.email && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 1 }}>
                        Email
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EmailIcon color="action" />
                        <Typography variant="body1">{selectedPerson.email}</Typography>
                      </Box>
                    </Box>
                  )}
                  
                  {selectedPerson.phone && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 1 }}>
                        Phone
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PhoneIcon color="action" />
                        <Typography variant="body1">{selectedPerson.phone}</Typography>
                      </Box>
                    </Box>
                  )}
                  
                  {/* Meeting Stats */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 1 }}>
                        Total Meetings
                      </Typography>
                      <Typography variant="h6" fontWeight="bold" color="primary.main">
                        {selectedPerson.totalMeetings}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 1 }}>
                        Last Contact
                      </Typography>
                      <Typography variant="body2">
                        {selectedPerson.mostRecentContact ? format(selectedPerson.mostRecentContact, 'MMM dd, yyyy') : 'No meetings'}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Organizers */}
                  {selectedPerson.organizers.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'text.secondary', mb: 1 }}>
                        Organizers ({selectedPerson.organizers.length})
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {selectedPerson.organizers.map((organizer, index) => (
                          <Chip
                            key={index}
                            label={organizer}
                            size="small"
                            variant="outlined"
                            color="primary"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* Meeting History */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'primary.main' }}>
                Meeting History ({selectedPerson.totalMeetings})
              </Typography>
              
              {selectedPerson.totalMeetings === 0 ? (
                <Card sx={{ border: '1px solid', borderColor: 'divider' }}>
                  <CardContent sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="body1" color="text.secondary">
                      No meetings found for this person.
                    </Typography>
                  </CardContent>
                </Card>
              ) : (
                <Stack spacing={2}>
                  {meetings
                    .filter(meeting => 
                      meeting.vanid?.toString() === selectedPerson.id || 
                      meeting.organizer_vanid?.toString() === selectedPerson.id
                    )
                    .sort((a, b) => {
                      const aDate = typeof a.datestamp === 'string' ? new Date(a.datestamp) : new Date(a.datestamp.value);
                      const bDate = typeof b.datestamp === 'string' ? new Date(b.datestamp) : new Date(b.datestamp.value);
                      return bDate.getTime() - aDate.getTime(); // Most recent first
                    })
                    .map((meeting, index) => {
                      const meetingDate = typeof meeting.datestamp === 'string' 
                        ? new Date(meeting.datestamp) 
                        : new Date(meeting.datestamp.value);
                      
                      // Determine if this person was the organizer or organizee
                      const isOrganizer = meeting.organizer_vanid?.toString() === selectedPerson.id;
                      
                      // Get the other person's name
                      const otherPersonId = isOrganizer ? meeting.vanid : meeting.organizer_vanid;
                      const otherPersonInfo = userMap.get(otherPersonId) || {};
                      const otherPersonOrgInfo = orgIds.find(p => p.vanid && p.vanid.toString() === otherPersonId?.toString());
                      
                      let otherPersonName = '';
                      if (isOrganizer && meeting.contact && meeting.contact.trim() && meeting.contact !== 'null null') {
                        otherPersonName = meeting.contact.trim();
                      } else if (!isOrganizer && meeting.organizer && meeting.organizer.trim() && meeting.organizer !== 'null null') {
                        otherPersonName = meeting.organizer.trim();
                      } else if (otherPersonInfo.name && otherPersonInfo.name.trim() && otherPersonInfo.name !== 'null null') {
                        otherPersonName = otherPersonInfo.name.trim();
                      } else if ((otherPersonInfo.firstname && otherPersonInfo.firstname !== 'null') || (otherPersonInfo.lastname && otherPersonInfo.lastname !== 'null')) {
                        const firstName = otherPersonInfo.firstname && otherPersonInfo.firstname !== 'null' ? otherPersonInfo.firstname.trim() : '';
                        const lastName = otherPersonInfo.lastname && otherPersonInfo.lastname !== 'null' ? otherPersonInfo.lastname.trim() : '';
                        otherPersonName = `${firstName} ${lastName}`.trim();
                      } else if (otherPersonOrgInfo && ((otherPersonOrgInfo.firstname && otherPersonOrgInfo.firstname !== 'null') || (otherPersonOrgInfo.lastname && otherPersonOrgInfo.lastname !== 'null'))) {
                        const firstName = otherPersonOrgInfo.firstname && otherPersonOrgInfo.firstname !== 'null' ? otherPersonOrgInfo.firstname.trim() : '';
                        const lastName = otherPersonOrgInfo.lastname && otherPersonOrgInfo.lastname !== 'null' ? otherPersonOrgInfo.lastname.trim() : '';
                        otherPersonName = `${firstName} ${lastName}`.trim();
                      }
                      
                      if (!otherPersonName || otherPersonName === 'null null' || otherPersonName.trim() === '') {
                        otherPersonName = isOrganizer ? `Contact ${meeting.vanid}` : `Organizer ${meeting.organizer_vanid}`;
                      }

                      return (
                        <Card key={index} sx={{ border: '1px solid', borderColor: 'divider' }}>
                          <CardContent sx={{ p: 3 }}>
                            {/* Meeting Header */}
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                                {isOrganizer ? 'Organized meeting with' : 'Met with'} {otherPersonName}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                <Chip 
                                  label={meeting.meeting_type || 'Meeting'} 
                                  size="small" 
                                  color="primary" 
                                  variant="outlined" 
                                />
                                <Chip 
                                  label={format(meetingDate, 'MMM dd, yyyy')} 
                                  size="small" 
                                  icon={<CalendarIcon />}
                                  variant="outlined"
                                />
                              </Box>
                            </Box>

                            {/* Meeting Notes */}
                            <Stack spacing={2}>
                              {meeting.notes_purpose && (
                                <Box>
                                  <Typography variant="subtitle2" fontWeight="bold" color="primary.main" sx={{ mb: 0.5 }}>
                                    Purpose
                                  </Typography>
                                  <Typography variant="body2">
                                    {meeting.notes_purpose}
                                  </Typography>
                                </Box>
                              )}
                              {meeting.notes_commitments && (
                                <Box>
                                  <Typography variant="subtitle2" fontWeight="bold" color="primary.main" sx={{ mb: 0.5 }}>
                                    Commitments
                                  </Typography>
                                  <Typography variant="body2">
                                    {meeting.notes_commitments}
                                  </Typography>
                                </Box>
                              )}
                              {meeting.notes_stakes && (
                                <Box>
                                  <Typography variant="subtitle2" fontWeight="bold" color="primary.main" sx={{ mb: 0.5 }}>
                                    Stakes
                                  </Typography>
                                  <Typography variant="body2">
                                    {meeting.notes_stakes}
                                  </Typography>
                                </Box>
                              )}
                              {meeting.notes_development && (
                                <Box>
                                  <Typography variant="subtitle2" fontWeight="bold" color="primary.main" sx={{ mb: 0.5 }}>
                                    Development
                                  </Typography>
                                  <Typography variant="body2">
                                    {meeting.notes_development}
                                  </Typography>
                                </Box>
                              )}
                              {meeting.notes_evaluation && (
                                <Box>
                                  <Typography variant="subtitle2" fontWeight="bold" color="primary.main" sx={{ mb: 0.5 }}>
                                    Evaluation
                                  </Typography>
                                  <Typography variant="body2">
                                    {meeting.notes_evaluation}
                                  </Typography>
                                </Box>
                              )}
                              {!(meeting.notes_purpose || meeting.notes_commitments || meeting.notes_stakes || 
                                 meeting.notes_development || meeting.notes_evaluation) && (
                                <Typography variant="body2" color="text.secondary" fontStyle="italic">
                                  No detailed notes available for this meeting.
                                </Typography>
                              )}
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })}
                </Stack>
              )}
            </Box>
          </Stack>
        </Box>
      </Box>
    );
  }

  // Main list view
  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      pb: 8 // Space for bottom navigation
    }}>
      {/* View Mode Selector */}
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          {(['people', 'meetings', 'contacts'] as ListViewMode[]).map((mode) => (
            <Chip
              key={mode}
              label={mode.charAt(0).toUpperCase() + mode.slice(1)}
              onClick={() => setViewMode(mode)}
              variant={viewMode === mode ? 'filled' : 'outlined'}
              color={viewMode === mode ? 'primary' : 'default'}
              size="small"
            />
          ))}
        </Box>

        {/* Search and Filter Row */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder={`Search ${viewMode}...`}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: searchText && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setSearchText('')}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            )
          }}
            sx={{ flex: 1 }}
          />
          
          {/* Filter Button - only show for people view */}
          {viewMode === 'people' && (
            <IconButton
              size="small"
              onClick={() => setFilterOpen(true)}
              sx={{
                backgroundColor: getActiveFiltersCount() > 0 ? 'primary.main' : 'transparent',
                color: getActiveFiltersCount() > 0 ? 'white' : 'text.secondary',
                border: '1px solid',
                borderColor: getActiveFiltersCount() > 0 ? 'primary.main' : 'divider',
                '&:hover': {
                  backgroundColor: getActiveFiltersCount() > 0 ? 'primary.dark' : 'action.hover'
                },
                position: 'relative'
              }}
            >
              <FilterListIcon fontSize="small" />
              {getActiveFiltersCount() > 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    backgroundColor: 'error.main',
                    color: 'white',
                    borderRadius: '50%',
                    width: 16,
                    height: 16,
                    fontSize: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold'
                  }}
                >
                  {getActiveFiltersCount()}
                </Box>
              )}
            </IconButton>
          )}
        </Box>

        {/* Active Filter Chips - only show for people view */}
        {viewMode === 'people' && getActiveFiltersCount() > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
            {filters.searchText && (
              <Chip 
                label={`Search: ${filters.searchText}`} 
                size="small" 
                color="primary"
                variant="outlined"
                onDelete={() => handleFilterChange('searchText', '')}
              />
            )}
            {filters.organizer && (
              <Chip 
                label={`Organizer: ${filters.organizer}`} 
                size="small" 
                color="primary"
                variant="outlined"
                onDelete={() => handleFilterChange('organizer', '')}
              />
            )}
            {filters.chapter && (
              <Chip 
                label={`Chapter: ${filters.chapter}`} 
                size="small" 
                color="primary"
                variant="outlined"
                onDelete={() => handleFilterChange('chapter', '')}
              />
            )}
            {filters.loeStatus && (
              <Chip 
                label={`LOE: ${filters.loeStatus}`} 
                size="small" 
                color="primary"
                variant="outlined"
                onDelete={() => handleFilterChange('loeStatus', '')}
              />
            )}
            {filters.hasRecentContact !== null && (
              <Chip 
                label={`Contact: ${filters.hasRecentContact ? 'Recent' : 'Not Recent'}`} 
                size="small" 
                color="primary"
                variant="outlined"
                onDelete={() => handleFilterChange('hasRecentContact', null)}
              />
            )}
          </Box>
        )}
      </Box>

      {/* Results Count */}
      <Box sx={{ px: 2, py: 1, bgcolor: 'grey.50' }}>
        <Typography variant="caption" color="text.secondary">
          {filteredData.length} {viewMode} found
          {viewMode === 'meetings' && filteredData.length === 50 && ' (showing first 50)'}
          {viewMode === 'contacts' && filteredData.length === 50 && ' (showing first 50)'}
        </Typography>
      </Box>

      {/* List Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {viewMode === 'people' && (
          <List>
            {filteredData.map((person: EnhancedPersonData) => (
              <ListItem
                key={person.id}
                onClick={() => handlePersonClick(person)}
                sx={{ cursor: 'pointer', py: 1.5 }}
              >
                <ListItemAvatar>
                  <Avatar 
                    sx={{ 
                      bgcolor: getChapterColor(person.chapter || 'Unknown'),
                      width: 40, 
                      height: 40 
                    }}
                  >
                    <PersonIcon fontSize="small" />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {person.name}
                      </Typography>
                      <Chip 
                        label={formatLOEStatus(person.loeStatus || 'Unknown')}
                        size="small"
                        color={
                          person.loeStatus?.includes('Leader') || person.loeStatus?.includes('1_') ? 'success' :
                          person.loeStatus?.includes('Member') || person.loeStatus?.includes('3_') ? 'info' :
                          person.loeStatus?.includes('Active') || person.loeStatus?.includes('4_') ? 'warning' :
                          'default'
                        }
                        sx={{ fontSize: '0.7rem', height: '20px' }}
                      />
                    </Box>
                  }
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      {/* Chapter and meeting count */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Chip 
                          label={person.chapter}
                          size="small"
                          sx={{ 
                            backgroundColor: getChapterColor(person.chapter),
                            color: 'white',
                            fontSize: '0.7rem',
                            height: '20px'
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {person.totalMeetings} meetings
                        </Typography>
                      </Box>
                      
                      {/* Contact info */}
                      {(person.email || person.phone) && (
                        <Box sx={{ display: 'flex', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                          {person.email && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <EmailIcon fontSize="small" color="action" />
                              <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                                {person.email.length > 20 ? `${person.email.substring(0, 20)}...` : person.email}
                              </Typography>
                            </Box>
                          )}
                          {person.phone && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <PhoneIcon fontSize="small" color="action" />
                              <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                                {person.phone}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      )}
                      
                      {/* Recent contact and organizers */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Last contact: {person.mostRecentContact 
                            ? format(person.mostRecentContact, 'MMM dd, yyyy')
                            : 'No meetings'
                          }
                        </Typography>
                        
                        {person.organizers.length > 0 && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                              Organizers:
                      </Typography>
                            {person.organizers.slice(0, 2).map((organizer, index) => (
                              <Chip
                                key={index}
                                label={organizer}
                                size="small"
                                variant="outlined"
                                color="primary"
                                sx={{ fontSize: '0.65rem', height: '18px' }}
                              />
                            ))}
                            {person.organizers.length > 2 && (
                      <Typography variant="caption" color="text.secondary">
                                +{person.organizers.length - 2} more
                      </Typography>
                            )}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}

        {viewMode === 'meetings' && (
          <List>
            {filteredData.map((meeting: any, index: number) => {
              const meetingId = `meeting-${index}`;
              const isExpanded = expandedItems.has(meetingId);
              
              return (
                <Card key={meetingId} sx={{ mb: 1, mx: 1 }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'flex-start',
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleExpanded(meetingId)}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {meeting.organizer_firstname} {meeting.organizer_lastname} → {meeting.contact_firstname} {meeting.contact_lastname}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                          <Chip 
                            label={meeting.meeting_type || 'Meeting'} 
                            size="small" 
                            color="primary" 
                            variant="outlined" 
                          />
                          <Chip 
                            label={formatDate(meeting.datestamp)} 
                            size="small" 
                            icon={<CalendarIcon />}
                          />
                        </Box>
                      </Box>
                      <IconButton size="small">
                        <ExpandMoreIcon sx={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                      </IconButton>
                    </Box>

                    {isExpanded && (
                      <Box sx={{ mt: 2 }}>
                        {meeting.notes_purpose && (
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="caption" fontWeight="bold" color="text.secondary">
                              Purpose:
                            </Typography>
                            <Typography variant="body2">
                              {meeting.notes_purpose}
                            </Typography>
                          </Box>
                        )}
                        {meeting.notes_commitments && (
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="caption" fontWeight="bold" color="text.secondary">
                              Commitments:
                            </Typography>
                            <Typography variant="body2">
                              {meeting.notes_commitments}
                            </Typography>
                          </Box>
                        )}
                        <Button 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            onMeetingSelect?.(meeting);
                          }}
                        >
                          View Details
                        </Button>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </List>
        )}

        {viewMode === 'contacts' && (
          <List>
            {filteredData.map((contact: any, index: number) => (
              <ListItem key={`contact-${index}`}>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
                    <ChatIcon fontSize="small" />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={`${contact.source_firstname || contact.firstname || ''} ${contact.source_lastname || contact.lastname || ''} → ${contact.target_firstname || contact.target_first_name || ''} ${contact.target_lastname || contact.target_last_name || ''}`}
                  secondary={
                    <Box>
                      <Typography variant="caption" display="block">
                        {contact.contact_type || 'Contact'} • {contact.contact_result || 'Unknown'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(contact.utc_datecanvassed)}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}

        {filteredData.length === 0 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No {viewMode} found matching "{searchText}"
            </Typography>
          </Box>
        )}
      </Box>

      {/* Filter Dialog */}
      <Dialog open={filterOpen} onClose={() => setFilterOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Filter People</Typography>
            <IconButton onClick={() => setFilterOpen(false)} size="small">
              <ClearIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {/* Search Text */}
            <TextField
              label="Search all fields"
              value={filters.searchText}
              onChange={(e) => handleFilterChange('searchText', e.target.value)}
              placeholder="Search names, chapters, organizers, notes..."
              fullWidth
              size="small"
            />

            {/* Organizer and Chapter filters */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Organizer</InputLabel>
                <Select
                  value={filters.organizer}
                  onChange={(e) => handleFilterChange('organizer', e.target.value)}
                  label="Organizer"
                >
                  <MenuItem value="">All Organizers</MenuItem>
                  {availableOrganizers.map((organizer) => (
                    <MenuItem key={organizer} value={organizer}>
                      {organizer}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl fullWidth size="small">
                <InputLabel>Chapter</InputLabel>
                <Select
                  value={filters.chapter}
                  onChange={(e) => handleFilterChange('chapter', e.target.value)}
                  label="Chapter"
                >
                  <MenuItem value="">All Chapters</MenuItem>
                  {availableChapters.map((chapter) => (
                    <MenuItem key={chapter} value={chapter}>
                      {chapter}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* LOE Status and Recent Contact */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="LOE Status"
                value={filters.loeStatus}
                onChange={(e) => handleFilterChange('loeStatus', e.target.value)}
                placeholder="e.g., Leader, Member, Prospect"
                fullWidth
                size="small"
              />
              <FormControl fullWidth size="small">
                <InputLabel>Recent Contact</InputLabel>
                <Select
                  value={filters.hasRecentContact ?? ''}
                  onChange={(e) => handleFilterChange('hasRecentContact', e.target.value === '' ? null : e.target.value === 'true')}
                  label="Recent Contact"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="true">Recent Contact (30 days)</MenuItem>
                  <MenuItem value="false">No Recent Contact</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Active Filters Display */}
            {getActiveFiltersCount() > 0 && (
              <Box sx={{ 
                p: 2, 
                backgroundColor: 'grey.50', 
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'grey.300'
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Active Filters ({getActiveFiltersCount()})
                  </Typography>
                  <Button 
                    size="small" 
                    onClick={handleClearFilters}
                    color="error"
                    variant="outlined"
                  >
                    Clear All
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {filters.searchText && (
                    <Chip 
                      label={`Search: ${filters.searchText}`} 
                      size="small" 
                      onDelete={() => handleFilterChange('searchText', '')}
                    />
                  )}
                  {filters.organizer && (
                    <Chip 
                      label={`Organizer: ${filters.organizer}`} 
                      size="small" 
                      onDelete={() => handleFilterChange('organizer', '')}
                    />
                  )}
                  {filters.chapter && (
                    <Chip 
                      label={`Chapter: ${filters.chapter}`} 
                      size="small" 
                      onDelete={() => handleFilterChange('chapter', '')}
                    />
                  )}
                  {filters.loeStatus && (
                    <Chip 
                      label={`LOE: ${filters.loeStatus}`} 
                      size="small" 
                      onDelete={() => handleFilterChange('loeStatus', '')}
                    />
                  )}
                  {filters.hasRecentContact !== null && (
                    <Chip 
                      label={`Contact: ${filters.hasRecentContact ? 'Recent' : 'Not Recent'}`} 
                      size="small" 
                      onDelete={() => handleFilterChange('hasRecentContact', null)}
                    />
                  )}
                </Box>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClearFilters} color="inherit">
            Clear All
          </Button>
          <Button onClick={() => setFilterOpen(false)} color="primary" variant="contained">
            Apply Filters
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default MobileListView;

