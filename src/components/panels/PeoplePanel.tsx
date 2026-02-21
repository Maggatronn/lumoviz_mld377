import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import AddConnectionDialog from '../dialogs/AddConnectionDialog';
import PersonDetailsDialog, { PersonUpdate } from '../dialogs/PersonDetailsDialog';
import OrganizerDetailsDialog from '../dialogs/OrganizerDetailsDialog';
import BatchAddPeopleDialog from '../dialogs/BatchAddPeopleDialog';
import LogConversationDialog, { NewConversation } from '../dialogs/LogConversationDialog';
import { getChapterColor, getChapterColorTheme } from '../../theme/chapterColors';
import { useChapterColors, getCustomChapterColor, getCustomChapterColorTheme } from '../../contexts/ChapterColorContext';
import { getLOEColor, LOE_LEVELS } from '../../theme/loeColors';
import { formatLOELabel } from '../../theme/dynamicLoeColors';
import { fetchContacts, fetchMeetings, fetchMeetingsByContacts, fetchLists, addToList, ContactsParams, ContactsResponse, Contact } from '../../services/api';
import { TERMS } from '../../config/appConfig';
import { API_BASE_URL } from '../../config';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  ListItemIcon,
  Divider,
  Tooltip,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Skeleton,
  CircularProgress
} from '@mui/material';
import { OrganizerChip } from '../ui/OrganizerChip';
import { PersonChip } from '../ui/PersonChip';
import {
  Search as SearchIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  ContentCopy,
  PersonAdd as PersonAddIcon,
  Chat as ChatIcon,
  FilterList as FilterListIcon,
  Edit as EditIcon
} from '@mui/icons-material';

// This will be populated from props - placeholder for now
// Will be passed from parent component

interface MeetingNote {
  organizer_vanid: number;
  vanid?: number; // API /meetings returns this (aliased from participant_vanid)
  participant_vanid?: number; // API /meetings/by-contacts returns this
  organizer?: string; // Pre-built organizer name from API
  contact?: string; // Pre-built contact name from API
  datestamp?: { value: string } | string; // From /meetings API
  date_contacted?: { value: string } | string; // From /meetings/by-contacts API
  chapter?: string;
  meeting_type?: string;
  conversation_type?: string; // From /meetings/by-contacts API
  // Notes fields - /meetings API uses notes_ prefix, /meetings/by-contacts uses raw names
  notes_purpose?: string;
  notes_commitments?: string;
  notes_stakes?: string;
  notes_development?: string;
  notes_evaluation?: string;
  purpose?: string; // From /meetings/by-contacts API
  commitments?: string;
  stakes?: string;
  development?: string;
  evaluation?: string;
  // Organizer name fields from joined contacts table
  organizer_first_name?: string;
  organizer_last_name?: string;
  organizer_firstname?: string;
  organizer_lastname?: string;
  // Access control properties added by backend
  hasFullAccess?: boolean;
  hasTwoOnOneNotesAccess?: boolean;
  [key: string]: any; // Allow additional fields from different API endpoints
}

// Last contact filter options for flexible querying
type LastContactFilter = 
  | 'all'           // No filter
  | 'within_7_days' // Contacted within last 7 days
  | 'within_14_days' // Contacted within last 14 days (2 weeks)
  | 'within_30_days' // Contacted within last 30 days
  | 'within_3_months' // Contacted within last 3 months
  | 'over_30_days'   // Not contacted in 30+ days (or never)
  | 'over_3_months'  // Not contacted in 3+ months (or never)
  | 'over_6_months'  // Not contacted in 6+ months (or never)
  | 'never';         // Never contacted

interface PeopleFilterState {
  organizer: string;
  chapter: string;
  searchText: string;
  loeStatus: string[];
  memberStatus: string[];
  lastContactFilter: LastContactFilter;
  meetingCountFilter: 'all' | 'zero' | 'hasAny';
  actionStatus: 'all' | 'completed' | 'onList' | 'notOnList';
  team: string;
  commitmentAsked: '' | 'yes' | 'no';
  commitmentMade: '' | 'yes' | 'no';
}

interface UserInfo {
  name?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  type?: string;
  chapter?: string;
  loe_status?: string;
}

interface NodeData {
  id: string;
  name: string;
  type: string;
  chapter: string;
  color: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface NewConnection {
  organizer: { vanid: string; firstname?: string; lastname?: string; [key: string]: any; };
  organizee: { vanid: string; firstname?: string; lastname?: string; [key: string]: any; };
  meetingType: string;
  notes?: string;
}

interface PeoplePanelProps {
  meetings: MeetingNote[];
  contacts?: any[]; // Add contacts prop
  selectedNodeId: string | null;
  currentDateRange?: [Date, Date] | null;
  userMap: Map<number, UserInfo>;
  organizerMappings?: any[];
  onFilterByOrganizer?: (name: string, vanId?: string) => void;
  onEditOrganizerMapping?: (name: string, vanId?: string) => void;
  orgIds: any[];
  selectedChapter: string;
  onNodeHover: (nodeId: string | null) => void;
  nodes: NodeData[];
  onClearFilter: () => void;
  onAddConnection: (connection: NewConnection) => void;
  currentVisualization?: 'people' | 'teams' | 'goals' | 'campaign';
  showCopyButton?: boolean;
  hoveredOrganizer?: string | null;
  onOrganizerHover?: (organizer: string | null) => void;
  // New props for shared filtering
  peopleRecords?: PersonRecord[];
  // Callbacks for person actions
  onEditPerson?: (personId: string) => void;
  onSavePerson?: (personId: string, updates: PersonUpdate) => Promise<void>;
  availableOrganizers?: Array<{ id: string; name: string }>;
  onAddConversation?: (personId: string) => void;
  onAddToAction?: (personId: string) => void;
  filteredPeopleRecords?: PersonRecord[];
  peopleFilters?: PeopleFilterState;
  onFiltersChange?: (filters: PeopleFilterState) => void;
  // Actions/campaigns
  pledgeSubmissions?: any[];
  selectedActions?: string[];
  currentUserId?: string;
  currentUserName?: string;
  selectedOrganizerId?: string;
  selectedOrganizerName?: string;
  actions?: any[];
  turfLists?: any[]; // List of people on various action lists
  // Column visibility
  hideColumns?: string[]; // Array of column keys to hide (e.g., ['chapter', 'organizer'])
  // External control of filter dialog
  externalFilterOpen?: boolean;
  onExternalFilterOpenChange?: (open: boolean) => void;
  // Available sections for editing
  chapters?: string[];
  // Shared data from MainApp (to avoid duplicate fetching)
  sharedAllContacts?: any[];
  sharedCachedMeetings?: any[];
  // Quick add to list callback
  onQuickAddToList?: (person: any) => void;
  // Teams data for team column
  teamsData?: any[];
  // Organizer assignment
  contactOrganizerMap?: Map<string, Array<{ organizer_vanid: string; name: string }>>;
  onAddOrganizer?: (contactVanId: string, contactName: string) => void;
  onRemoveOrganizer?: (contactVanId: string, organizerVanId: string) => void;
  hideActionButtons?: boolean;
  onEditConversation?: (meeting: any) => void;
  onDeleteConversation?: (meetingId: string) => Promise<void>;
  organizerVanIds?: string[];
  onDeletePerson?: (personId: string) => Promise<void>;
}

interface PersonRecord {
  id: string;
  name: string;
  type?: string;
  chapter: string;
  mostRecentContact: Date | null;
  mostRecentContactAllTime: Date | null;
  totalMeetings: number;
  totalMeetingsAllTime: number;
  latestNotes: string;
  latestCommitmentAsked: string;
  latestCommitmentMade: string;
  email?: string;
  phone?: string;
  organizers: string[];
  loeStatus?: string;
  memberStatus?: string;
  allMeetings: MeetingNote[];
  allMeetingsAllTime: MeetingNote[];
  primary_organizer_vanid?: string;
}

type SortColumn = 'name' | 'chapter' | 'team' | 'mostRecentContact' | 'totalMeetings' | 'organizers';
type SortDirection = 'asc' | 'desc';

const PeoplePanel: React.FC<PeoplePanelProps> = ({ 
  meetings, 
  contacts = [], // Add contacts prop with default
  selectedNodeId, 
  currentDateRange, 
  userMap = new Map(),
  organizerMappings = [],
  onFilterByOrganizer,
  onEditOrganizerMapping, 
  orgIds = [], 
  selectedChapter,
  onNodeHover,
  nodes = [],
  onClearFilter,
  onAddConnection,
  currentVisualization,
  hoveredOrganizer,
  onOrganizerHover,
  // New props for shared filtering
  peopleRecords: externalPeopleRecords,
  filteredPeopleRecords: externalFilteredPeopleRecords,
  peopleFilters: externalPeopleFilters,
  onFiltersChange,
  // Actions/campaigns
  pledgeSubmissions = [],
  selectedActions = [],
  currentUserId,
  currentUserName,
  selectedOrganizerId: propSelectedOrganizerId,
  selectedOrganizerName: propSelectedOrganizerName,
  actions = [],
  turfLists = [],
  // Column visibility
  showCopyButton = false,
  hideColumns = [],
  // External filter dialog control
  externalFilterOpen,
  onExternalFilterOpenChange,
  // Shared data from MainApp
  sharedAllContacts,
  sharedCachedMeetings,
  onQuickAddToList,
  // Person action callbacks
  onEditPerson,
  onSavePerson,
  availableOrganizers = [],
  onAddConversation,
  onAddToAction,
  chapters: availableSections = [],
  teamsData = [],
  contactOrganizerMap,
  onAddOrganizer,
  onRemoveOrganizer,
  hideActionButtons = false,
  onEditConversation,
  onDeleteConversation,
  onDeletePerson,
  organizerVanIds: propOrganizerVanIds,
}) => {
  // Normalize actions from database format to component format
  const ACTIONS = React.useMemo(() => {
    return actions.map((action: any) => ({
      id: action.action_id || action.id,
      name: action.action_name || action.name,
      fields: action.fields || [],
      goalType: action.goal_type || action.goalType
    }));
  }, [actions]);
  const { customColors } = useChapterColors();
  const [editingLoeId, setEditingLoeId] = useState<string | null>(null);
  // Local overrides for LOE edited inline (vanid → loe string)
  const [loeOverrides, setLoeOverrides] = useState<Record<string, string>>({});
  // LOE chip context menu state
  const [loeMenuAnchorEl, setLoeMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [loeMenuPersonId, setLoeMenuPersonId] = useState<string | null>(null);
  const [loeMenuCurrentLoe, setLoeMenuCurrentLoe] = useState<string>('');

  // Build a lookup from personId → team names they belong to
  const personToTeams = useMemo(() => {
    const map = new Map<string, string[]>();
    const addEntry = (id: string, teamName: string) => {
      if (!id || !teamName) return;
      if (!map.has(id)) map.set(id, []);
      if (!map.get(id)!.includes(teamName)) map.get(id)!.push(teamName);
    };
    teamsData.forEach((team: any) => {
      const teamName = team.teamName || team.team_name || team.bigQueryData?.teamName || '';
      if (!teamName) return;
      // Source 1: enhanced organizers array (PersonRecord[])
      (team.organizers || []).forEach((member: any) => {
        addEntry(member.id?.toString() || '', teamName);
      });
      // Source 2: teamMembersWithRoles from DB (has vanid)
      (team.bigQueryData?.teamMembersWithRoles || team.teamMembersWithRoles || []).forEach((member: any) => {
        addEntry(member.id?.toString() || '', teamName);
      });
      // Source 3: name-based fallback using userMap
      (team.bigQueryData?.teamMembers || []).forEach((memberName: string) => {
        if (!memberName) return;
        const nameLower = memberName.toLowerCase().trim();
        userMap.forEach((info, vanid) => {
          const fullName = (info.fullName || `${info.firstname || ''} ${info.lastname || ''}`.trim()).toLowerCase();
          if (fullName === nameLower) {
            addEntry(vanid.toString(), teamName);
          }
        });
      });
      // Source 4: team lead
      if (team.bigQueryData?.teamLead) {
        const leadName = team.bigQueryData.teamLead.toLowerCase().trim();
        userMap.forEach((info, vanid) => {
          const fullName = (info.fullName || `${info.firstname || ''} ${info.lastname || ''}`.trim()).toLowerCase();
          if (fullName === leadName) {
            addEntry(vanid.toString(), teamName);
          }
        });
      }
    });
    return map;
  }, [teamsData, userMap]);

  // Note-visibility: current user's teams and whether they're on the Teaching team
  const { currentUserTeams, isCurrentUserTeachingTeam } = useMemo(() => {
    const teams = personToTeams.get(currentUserId || '') || [];
    const isTeaching = teams.some(t => t.toLowerCase().includes('teaching'));
    return { currentUserTeams: new Set(teams), isCurrentUserTeachingTeam: isTeaching };
  }, [personToTeams, currentUserId]);

  const canSeeNotesForOrganizer = useCallback((organizerVanid: string | number | undefined): boolean => {
    if (isCurrentUserTeachingTeam) return true;
    if (!organizerVanid) return false;
    const orgId = organizerVanid.toString();
    if (orgId === currentUserId) return true;
    const orgTeams = personToTeams.get(orgId) || [];
    return orgTeams.some(t => currentUserTeams.has(t));
  }, [isCurrentUserTeachingTeam, currentUserId, personToTeams, currentUserTeams]);

  const [showBatchAddDialog, setShowBatchAddDialog] = useState(false);
  const [showLogConversationDialog, setShowLogConversationDialog] = useState(false);
  const [searchText, setSearchText] = useState('');
  // Default to most recent contact sorting (reverse chronological order)
  const [sortColumn, setSortColumn] = useState<SortColumn>('mostRecentContact');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedPerson, setSelectedPerson] = useState<PersonRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addConnectionDialogOpen, setAddConnectionDialogOpen] = useState(false);
  const [organizerDialogOpen, setOrganizerDialogOpen] = useState(false);
  const [selectedOrganizerName, setSelectedOrganizerName] = useState<string>('');
  const [selectedOrganizerVanId, setSelectedOrganizerVanId] = useState<string | undefined>(undefined);
  // Use external filters if provided, otherwise use internal state
  const [internalFilters, setInternalFilters] = useState<PeopleFilterState>({
    organizer: '',
    chapter: '',
    searchText: '',
    loeStatus: [],
    memberStatus: [],
    lastContactFilter: 'all',
    meetingCountFilter: 'all',
    actionStatus: 'all',
    team: '',
    commitmentAsked: '',
    commitmentMade: ''
  });
  
  // Local chapter filter - managed independently since global setPeopleFilters strips chapter
  // to avoid triggering API reloads from the global selectedChapter
  // Initialize from URL param
  const getChapterFromURL = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('chapter') || '';
  };
  
  const [localChapterFilter, setLocalChapterFilter] = useState(getChapterFromURL());
  
  // Sync local chapter filter with external filter prop (for when UnifiedFilter chip is clicked)
  useEffect(() => {
    if (externalPeopleFilters && externalPeopleFilters.chapter !== localChapterFilter) {
      setLocalChapterFilter(externalPeopleFilters.chapter);
      updateChapterInURL(externalPeopleFilters.chapter);
    }
  }, [externalPeopleFilters?.chapter]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Listen for URL changes (back/forward buttons) and update chapter filter
  useEffect(() => {
    const handlePopState = () => {
      const urlChapter = getChapterFromURL();
      setLocalChapterFilter(urlChapter);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  
  const filters = externalPeopleFilters 
    ? {
        ...externalPeopleFilters,
        chapter: localChapterFilter || externalPeopleFilters.chapter,
        team: internalFilters.team,
        commitmentAsked: internalFilters.commitmentAsked,
        commitmentMade: internalFilters.commitmentMade
      }
    : internalFilters;
  const setFilters = onFiltersChange || setInternalFilters;
  const [internalFilterOpen, setInternalFilterOpen] = useState(false);
  const filterOpen = externalFilterOpen !== undefined ? externalFilterOpen : internalFilterOpen;
  const setFilterOpen = (open: boolean) => {
    if (onExternalFilterOpenChange) {
      onExternalFilterOpenChange(open);
    } else {
      setInternalFilterOpen(open);
    }
  };
  
  // State for action selection dialog
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [personForActionMenu, setPersonForActionMenu] = useState<{ vanid: string; name: string } | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string>('');
  const [dialogOrganizerId, setDialogOrganizerId] = useState<string>('');
  const [dialogOrganizerName, setDialogOrganizerName] = useState<string>('');

  // State for ALL contacts (loaded once, filtered client-side)
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  
  // Pagination for display only (not for fetching)
  const DISPLAY_LIMIT = 100; // Show 100 at a time

  // Meetings cached for up to 1000 contacts
  const [cachedMeetings, setCachedMeetings] = useState<MeetingNote[]>([]);
  
  // Lists data for actions
  const [listsData, setListsData] = useState<any[]>([]);
  
  // Fetch lists data if currentUserId is available
  useEffect(() => {
    const loadLists = async () => {
      if (!currentUserId) return;
      
      try {
        const lists = await fetchLists(currentUserId);
        setListsData(lists);
      } catch (error) {
        console.error('Error fetching lists:', error);
      }
    };
    
    loadLists();
  }, [currentUserId]);

  // Removed: Auto-clearing organizer filter on mount
  // This is no longer needed since MainApp no longer auto-sets organizer filter
  
  // This component now only handles the People view

  // Filter handler functions
  const handleFilterChange = (field: keyof PeopleFilterState, value: any) => {
    // Team and commitment filters are always managed locally
    if (field === 'team' || field === 'commitmentAsked' || field === 'commitmentMade') {
      setInternalFilters((prev: PeopleFilterState) => ({ ...prev, [field]: value }));
      return;
    }
    // Chapter is managed locally AND synced to global filters for UI display
    if (field === 'chapter') {
      setLocalChapterFilter(value || '');
      updateChapterInURL(value || '');
      // Also update global filters for chip display
      if (onFiltersChange) {
        onFiltersChange({
          ...filters,
          chapter: value || ''
        });
      } else {
        setInternalFilters((prev: PeopleFilterState) => ({ ...prev, chapter: value }));
      }
      return;
    }
    if (onFiltersChange) {
      // External state management
      onFiltersChange({
        ...filters,
        [field]: value
      });
    } else {
      // Internal state management
      setInternalFilters((prev: PeopleFilterState) => ({
      ...prev,
      [field]: value
    }));
    }
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.organizer) count++;
    if (filters.chapter) count++;
    if (filters.searchText) count++;
    if (filters.loeStatus.length > 0) count++;
    if (filters.memberStatus.length > 0) count++;
    if (filters.lastContactFilter !== 'all') count++;
    if (filters.meetingCountFilter !== 'all') count++;
    if (filters.actionStatus !== 'all') count++;
    if (filters.team) count++;
    if (filters.commitmentAsked) count++;
    if (filters.commitmentMade) count++;
    return count;
  };

  // Predefined membership status options
  const membershipStatusOptions = [
    { value: 'Active', label: 'Active', color: '#4caf50' },
    { value: 'Lapsed', label: 'Lapsed', color: '#ff9800' },
    { value: 'Former', label: 'Former', color: '#f44336' },
    { value: 'null', label: 'No Status', color: '#9e9e9e' }
  ];

  // Fetch ALL contacts at once (only when dateRange changes - filter ALL chapters client-side)
  const loadAllContacts = useCallback(async () => {
    // Use shared data from MainApp if available (avoids duplicate fetching)
    if (sharedAllContacts && sharedAllContacts.length > 0) {
      setAllContacts(sharedAllContacts);
      setContactsLoading(false);
      return;
    }
    
    // console.log('[PeoplePanel] loadAllContacts called - loading ALL chapters');
    setContactsLoading(true);
    setAllContacts([]); // Clear to show loading
    
    try {
      // Load contacts with recent activity (since December 2024)
      // This limits the initial load to active contacts only
      const cutoffDate = new Date('2024-12-01');
      const today = new Date();
      
      const params: ContactsParams = {
        chapter: undefined, // ALWAYS load all chapters
        limit: 5000, // Reduced from 10k - only recent contacts
        offset: 0,
        // Filter to contacts with activity since December 2024
        start_date: format(cutoffDate, 'yyyy-MM-dd'),
        end_date: format(today, 'yyyy-MM-dd')
      };
      
      // console.log('[PeoplePanel] Fetching ALL contacts (all chapters) with params:', params);
      const response = await fetchContacts(params);
      // console.log(`[PeoplePanel] Loaded ${response.data.length} total contacts for client-side filtering`);
      
      setAllContacts(response.data);
    } catch (error) {
      console.error('Error loading all contacts:', error);
      setAllContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }, [currentDateRange, sharedAllContacts]); // Reload when date range or shared data changes

  // Client-side filtering of all contacts
  const filteredContacts = useMemo(() => {
    let result = [...allContacts];
    
    // Debug logging - commented out for production
    // console.log('[PeoplePanel] Filtering contacts:', {
    //   totalContacts: allContacts.length,
    //   filterChapter: filters.chapter,
    //   selectedChapter: selectedChapter,
    //   filterOrganizer: filters.organizer,
    //   cachedMeetingsCount: cachedMeetings.length
    // });
    
    // Filter by chapter (from global filter state - filters.chapter)
    if (filters.chapter && filters.chapter.trim()) {
      // console.log('[PeoplePanel] Applying chapter filter:', filters.chapter);
      result = result.filter(c => c.chapter === filters.chapter);
    }
    // Also respect the global selectedChapter if it's not "All Chapters" or "All Sections"
    // This ensures consistency with top-level chapter filter
    else if (selectedChapter && selectedChapter !== `All ${TERMS.chapters}`) {
      // console.log('[PeoplePanel] Applying selectedChapter filter:', selectedChapter);
      result = result.filter(c => c.chapter === selectedChapter);
    }
    
    // console.log('[PeoplePanel] After chapter filter:', result.length, 'contacts');
    
    // Filter by organizer: use explicit VAN ID list if provided, otherwise derive from name
    if (propOrganizerVanIds && propOrganizerVanIds.length > 0) {
      const vanIdSet = new Set(propOrganizerVanIds.map(id => id.toString()));
      result = result.filter(c => {
        if (c.primary_organizer_vanid && vanIdSet.has(c.primary_organizer_vanid.toString())) return true;
        const organizers = c.organizers || [];
        return organizers.some((org: string) => vanIdSet.has(org.toString()));
      });
    } else if (filters.organizer && filters.organizer.trim()) {
      const organizerLower = filters.organizer.toLowerCase().trim();
      
      // Get all VAN IDs and names for this organizer from mapping table
      const getAllVariations = () => {
        const vanIds: string[] = [];
        const names: string[] = [organizerLower];
        
        // Try to find in mapping table first
        if (organizerMappings && organizerMappings.length > 0) {
          const mapping = organizerMappings.find(m => 
            m.preferred_name?.toLowerCase() === organizerLower ||
            m.primary_vanid?.toLowerCase() === organizerLower
          );
          
          if (mapping) {
            vanIds.push(mapping.primary_vanid);
            if (mapping.alternate_vanids && Array.isArray(mapping.alternate_vanids)) {
              vanIds.push(...mapping.alternate_vanids);
            }
            names.push(mapping.preferred_name);
            if (mapping.name_variations && Array.isArray(mapping.name_variations)) {
              names.push(...mapping.name_variations);
            }
            return { vanIds, names };
          }
        }
        
        // If no mapping found, try to find VAN ID from userMap
        // Search userMap for a user with matching name
        Array.from(userMap.entries()).forEach(([vanid, userInfo]) => {
          const fullName = (userInfo.fullName || `${userInfo.firstname || ''} ${userInfo.lastname || ''}`.trim()).toLowerCase();
          const firstName = (userInfo.firstname || '').toLowerCase();
          
          if (fullName === organizerLower || firstName === organizerLower) {
            vanIds.push(vanid.toString());
          }
        });
        
        return { vanIds, names };
      };
      
      const { vanIds, names } = getAllVariations();
      
      console.log('[PeoplePanel] Filtering by organizer:', organizerLower, 'vanIds:', vanIds, 'names:', names);
      
      result = result.filter(c => {
        // Check primary_organizer_vanid first (from contacts table)
        if (c.primary_organizer_vanid) {
          const primaryOrgVanid = c.primary_organizer_vanid.toString();
          const matchByPrimaryOrg = vanIds.some(id => id === primaryOrgVanid);
          if (matchByPrimaryOrg) {
            return true;
          }
        }
        
        // Also check organizers array (from meeting history)
        const organizers = c.organizers || [];
        return organizers.some(org => {
          const orgLower = org.toLowerCase();
          return vanIds.some(id => orgLower === id.toLowerCase()) ||
                 names.some(name => orgLower.includes(name.toLowerCase()));
        });
      });
    }
    
    // Filter by member status
    if (filters.memberStatus.length > 0) {
      result = result.filter(c => {
        const status = c.member_status || 'null';
        return filters.memberStatus.includes(status);
      });
    }
    
    // Filter by LOE status
    if (filters.loeStatus.length > 0) {
      result = result.filter(c => {
        const loe = c.loe || 'null';
        return filters.loeStatus.includes(loe);
      });
    }
    
    // Don't filter by search text here - do it later after pledge submissions are added
    // This allows searching pledge-only people who aren't in the contacts table
    
    // Sort client-side
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'name': {
          const aKey = `${a.lastname || ''} ${a.firstname || ''}`.trim().toLowerCase();
          const bKey = `${b.lastname || ''} ${b.firstname || ''}`.trim().toLowerCase();
          comparison = aKey.localeCompare(bKey);
          break;
        }
        case 'chapter':
          comparison = (a.chapter || '').localeCompare(b.chapter || '');
          break;
        case 'team': {
          const aTeam = (personToTeams.get(String(a.vanid ?? '')) || [])[0] || '';
          const bTeam = (personToTeams.get(String(b.vanid ?? '')) || [])[0] || '';
          comparison = aTeam.localeCompare(bTeam);
          break;
        }
        case 'organizers': {
          const aOrg = ((a.organizers || []) as string[])[0] || '';
          const bOrg = ((b.organizers || []) as string[])[0] || '';
          comparison = aOrg.localeCompare(bOrg);
          break;
        }
        case 'totalMeetings':
          comparison = (a.total_meetings_all_time || 0) - (b.total_meetings_all_time || 0);
          break;
        case 'mostRecentContact':
        default: {
          const aDateRaw: any = a.last_contact_date;
          const bDateRaw: any = b.last_contact_date;
          const aDateStr = typeof aDateRaw === 'object' && aDateRaw?.value ? aDateRaw.value : aDateRaw;
          const bDateStr = typeof bDateRaw === 'object' && bDateRaw?.value ? bDateRaw.value : bDateRaw;
          comparison = (aDateStr ? new Date(aDateStr).getTime() : 0) - (bDateStr ? new Date(bDateStr).getTime() : 0);
          break;
        }
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [allContacts, filters.chapter, filters.organizer, filters.memberStatus, filters.loeStatus, selectedChapter, sortColumn, sortDirection, propOrganizerVanIds]);
  
  // Paginated display of filtered contacts - show all loaded so far (0 to displayLimit)
  const [displayLimit, setDisplayLimit] = useState(DISPLAY_LIMIT);
  const paginatedContacts = useMemo(() => {
    return filteredContacts.slice(0, displayLimit);
  }, [filteredContacts, displayLimit]);
  
  // Fetch meetings for first 1000 contacts ONCE when allContacts loads
  // Fetch in batches to avoid payload size issues
  useEffect(() => {
    const fetchMeetingsInBatches = async () => {
      // Use shared cached meetings from MainApp if available
      if (sharedCachedMeetings && sharedCachedMeetings.length > 0) {
        setCachedMeetings(sharedCachedMeetings);
        return;
      }
      
      if (allContacts.length === 0) {
        setCachedMeetings([]);
        return;
      }
      
      // Fetch meetings for up to first 1000 contacts from allContacts (not filtered)
      const contactsToFetch = allContacts.slice(0, 1000);
      // console.log(`[PeoplePanel] Fetching meetings for first ${contactsToFetch.length} contacts in batches (ONE TIME - cached)`);
      
      try {
        const BATCH_SIZE = 250; // Fetch 250 contacts at a time to avoid timeout
        const allMeetings: any[] = [];
        
        for (let i = 0; i < contactsToFetch.length; i += BATCH_SIZE) {
          const batch = contactsToFetch.slice(i, i + BATCH_SIZE);
          const contactIds = batch.map(c => c.vanid);
          
          // console.log(`[PeoplePanel] Fetching batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(contactsToFetch.length / BATCH_SIZE)}: ${contactIds.length} contacts`);
          
          // Fetch meeting data WITH notes for display
          const batchMeetings = await fetchMeetingsByContacts(contactIds, true); // true = include notes
          allMeetings.push(...batchMeetings);
          
          // console.log(`[PeoplePanel] Batch ${Math.floor(i / BATCH_SIZE) + 1} complete: ${batchMeetings.length} meetings`);
        }
        
        // console.log(`[PeoplePanel] ✅ Cached ${allMeetings.length} meetings WITH notes - will NOT refetch`, {
        //   sampleMeeting: allMeetings[0] ? {
        //     participant_vanid: allMeetings[0].participant_vanid,
        //     date_contacted: allMeetings[0].date_contacted,
        //     purpose: allMeetings[0].purpose,
        //     keys: Object.keys(allMeetings[0]).slice(0, 12)
        //   } : null
        // });
        setCachedMeetings(allMeetings);
      } catch (error) {
        console.error('[PeoplePanel] ❌ Error fetching meetings:', error);
        setCachedMeetings([]);
      }
    };
    
    fetchMeetingsInBatches();
  }, [allContacts, sharedCachedMeetings]); // When allContacts or shared meetings change
  
  // Filter cached meetings to only those for currently displayed contacts
  // Note: Backend returns participant_vanid (not vanid) and date_contacted (not datestamp)
  const contactMeetings = useMemo(() => {
    // Normalize vanids to strings for comparison
    const displayedVanIds = new Set(
      paginatedContacts.map(c => c.vanid?.toString()).filter(Boolean)
    );
    
    const filtered = cachedMeetings.filter(m => {
      // Backend uses participant_vanid, not vanid
      const meetingVanid = m.participant_vanid || m.vanid;
      if (!meetingVanid) return false;
      return displayedVanIds.has(meetingVanid.toString());
    });
    
    // Debug logging - commented out for production
    // console.log('[PeoplePanel] contactMeetings filter:', {
    //   cachedMeetingsCount: cachedMeetings.length,
    //   paginatedContactsCount: paginatedContacts.length,
    //   filteredMeetingsCount: filtered.length,
    //   displayedVanIdsCount: displayedVanIds.size
    // });
    
    return filtered;
  }, [cachedMeetings, paginatedContacts]);

  // Track if we've loaded contacts to prevent duplicate loads
  const hasLoadedContactsRef = useRef(false);
  const lastLoadParamsRef = useRef<string>('');
  
  // Load all contacts ONCE (only when dateRange changes)
  // Chapter filtering happens client-side, so chapter changes don't trigger reload
  useEffect(() => {
    const loadParams = JSON.stringify({ currentDateRange });
    
    // Skip if we've already loaded with these exact params
    if (lastLoadParamsRef.current === loadParams && hasLoadedContactsRef.current) {
      // console.log('[PeoplePanel] Skipping duplicate contacts load - already loaded');
      return;
    }
    
    // console.log('[PeoplePanel] useEffect triggered to load ALL contacts (all chapters)');
    lastLoadParamsRef.current = loadParams;
    hasLoadedContactsRef.current = true;
    
    loadAllContacts();
    setDisplayLimit(DISPLAY_LIMIT); // Reset pagination when reloading
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDateRange]); // Only date range - NOT selectedChapter

  // Reset display offset when any filters change (all client-side now)
  useEffect(() => {
    setDisplayLimit(DISPLAY_LIMIT); // Reset to show first 100 when filters change
  }, [filters.chapter, filters.organizer, filters.memberStatus, filters.loeStatus, filters.searchText, filters.lastContactFilter, filters.meetingCountFilter, filters.actionStatus, sortColumn, sortDirection]);
  
  // Load more contacts (client-side pagination) - append more to visible list
  const handleLoadMore = () => {
    if (displayLimit < filteredContacts.length) {
      setDisplayLimit(prev => prev + DISPLAY_LIMIT);
    }
  };

  const handleClearFilters = () => {
    setLocalChapterFilter('');
    setInternalFilters((prev: PeopleFilterState) => ({ ...prev, team: '', commitmentAsked: '', commitmentMade: '' }));
    setFilters({
      organizer: '',
      chapter: '',
      searchText: '',
      loeStatus: [],
      memberStatus: [],
      lastContactFilter: 'all',
      meetingCountFilter: 'all',
      actionStatus: 'all',
      team: '',
      commitmentAsked: '',
      commitmentMade: ''
    });
  };

  // Click handlers for quick filtering
  const handleOrganizerClick = (organizerName: string) => {
    // 🔍 COMPREHENSIVE ORGANIZER LOGGING (People Panel - Organizer Chip Click)
    // Find all meetings involving this organizer
    const organizerMeetings = meetings.filter(meeting => 
      meeting.organizer && meeting.organizer.toLowerCase().includes(organizerName.toLowerCase()) ||
      (meeting.organizer_vanid && userMap.get(meeting.organizer_vanid) && 
       `${userMap.get(meeting.organizer_vanid)?.firstname || ''} ${userMap.get(meeting.organizer_vanid)?.lastname || ''}`.trim().toLowerCase().includes(organizerName.toLowerCase()))
    );
    
    if (organizerMeetings.length > 0) {
      const firstMeeting = organizerMeetings[0];
    }
    
    // Try to find organizer by name in userMap
    const userMapEntry = Array.from(userMap.values()).find(user => 
      `${user.firstname || ''} ${user.lastname || ''}`.trim().toLowerCase() === organizerName.toLowerCase() ||
      user.name?.toLowerCase() === organizerName.toLowerCase()
    );
  
    
    // Try to find organizer by name in orgIds
    const orgIdEntry = orgIds.find(org => 
      `${org.firstname || ''} ${org.lastname || ''}`.trim().toLowerCase() === organizerName.toLowerCase() ||
      org.name?.toLowerCase() === organizerName.toLowerCase()
    );
  
    
    // Find organizer VAN ID from meetings
    const organizerVanIds = organizerMeetings
      .map(m => m.organizer_vanid)
      .filter(Boolean)
      .filter((id, index, arr) => arr.indexOf(id) === index); // unique values
    
    // Look up each VAN ID
    organizerVanIds.forEach(vanId => {
      const userEntry = userMap.get(vanId!);
      const orgEntry = orgIds.find(org => org.vanid?.toString() === vanId?.toString());
    
    });
    
    // Chapter analysis
    const chapterSet = new Set(organizerMeetings.map(m => m.chapter).filter(Boolean));
    const chapters = Array.from(chapterSet);
    
    // People they organize
    const organizedPeople = organizerMeetings.map(m => ({
      vanid: m.vanid,
      contact: m.contact,
      chapter: m.chapter
    })).filter(p => p.vanid);
  
    
    if (onFiltersChange) {
      onFiltersChange({
        ...filters,
        organizer: organizerName
      });
    } else {
      setInternalFilters((prev: PeopleFilterState) => ({
      ...prev,
      organizer: organizerName
    }));
    }
  };

  // Update URL with chapter filter
  const updateChapterInURL = (chapter: string) => {
    const params = new URLSearchParams(window.location.search);
    if (chapter) {
      params.set('chapter', chapter);
    } else {
      params.delete('chapter');
    }
    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newURL);
  };

  const handleChapterClick = (chapterName: string) => {
    // Toggle chapter filter - if already filtering by this chapter, clear it
    const newChapter = localChapterFilter === chapterName ? '' : chapterName;
    setLocalChapterFilter(newChapter);
    updateChapterInURL(newChapter);
    // Update global filters if external control (for filter chip display)
    if (onFiltersChange) {
      onFiltersChange({
        ...filters,
        chapter: newChapter
      });
    } else {
      setInternalFilters((prev: PeopleFilterState) => ({
        ...prev,
        chapter: newChapter
      }));
    }
  };

  // This component focuses on people data only

  // Use contactMeetings (fetched for loaded contacts only - no date range limit!)
  const filteredMeetings = useMemo(() => {
    let filtered = contactMeetings;

    // Filter by selected node if any
    if (selectedNodeId) {
      const selectedNodeIdNum = parseInt(selectedNodeId);
      filtered = filtered.filter(meeting => 
        meeting.organizer_vanid === selectedNodeIdNum || meeting.participant_vanid === selectedNodeIdNum
      );
    }

    // Deduplicate meetings
    const uniqueMeetings = new Map<string, MeetingNote>();
    filtered.forEach((meeting: any) => {
      const dateString = typeof meeting.date_contacted === 'object' ? meeting.date_contacted.value : meeting.date_contacted;
      const uniqueKey = `${meeting.organizer_vanid}-${meeting.participant_vanid}-${dateString}-${meeting.meeting_type || ''}-${meeting.notes_purpose || ''}`;
      
      if (!uniqueMeetings.has(uniqueKey)) {
        // Normalize field names for consistency (API returns date_contacted, not datestamp)
        const normalizedMeeting = {
          ...meeting,
          vanid: meeting.participant_vanid || meeting.vanid,
          datestamp: meeting.date_contacted || meeting.datestamp,
          organizer: meeting.organizer_first_name && meeting.organizer_last_name 
            ? `${meeting.organizer_first_name} ${meeting.organizer_last_name}`.trim()
            : meeting.organizer
        };
        uniqueMeetings.set(uniqueKey, normalizedMeeting);
      }
    });

    return Array.from(uniqueMeetings.values());
  }, [contactMeetings, selectedNodeId]);

  // Helper function to format LOE status
  const formatLOEStatus = (loe: string): string => {
    if (!loe) return 'Unknown';
    
    switch (loe) {
      case '1_Elected Leader':
        return '1. Leader';
      case '2_Team Leader':
        return '2. Team Lead';
      case '3_Team Member':
        return '3. Member';
      case '4_Activated Prospect':
        return '4. Active';
      case '5_Prospect':
        return '5. Prospect';
      default:
        return loe.replace(/^\d+_/, '').replace(/_/g, ' '); // Clean up format
    }
  };

  // Helper function to get readable label for last contact filter
  const getLastContactFilterLabel = (filter: LastContactFilter): string => {
    switch (filter) {
      case 'within_7_days': return 'Within 7 days';
      case 'within_14_days': return 'Within 2 weeks';
      case 'within_30_days': return 'Within 30 days';
      case 'within_3_months': return 'Within 3 months';
      case 'over_30_days': return '30+ days ago';
      case 'over_3_months': return '3+ months ago';
      case 'over_6_months': return '6+ months ago';
      case 'never': return 'Never contacted';
      default: return 'All';
    }
  };
  
  const getMeetingCountFilterLabel = (filter: 'all' | 'zero' | 'hasAny'): string => {
    switch (filter) {
      case 'zero': return 'No meetings (0)';
      case 'hasAny': return 'Has meetings (1+)';
      default: return 'All';
    }
  };

  // Helper function to get LOE status from contacts data
  const getLOEStatus = (personId: string): string => {
    // Check meetings data for LOE
    const meeting = meetings.find(m => 
      m.organizer_vanid?.toString() === personId || 
      m.vanid?.toString() === personId
    );
    
    if (meeting) {
      // Check if they're an organizer or contact
      if (meeting.organizer_vanid?.toString() === personId) {
        // They're an organizer - check for organizer LOE field
        const organizerLOE = (meeting as any).organizer_loe || (meeting as any).organizer_contact_loe;
        if (organizerLOE) {
          return formatLOEStatus(organizerLOE);
        }
        return 'Staff'; // Default for organizers without LOE data
      } else {
        // They're a contact - check contact LOE field
        const contactLOE = (meeting as any).contact_loe;
        if (contactLOE) {
          return formatLOEStatus(contactLOE);
        }
      }
    }

    // Check contacts data for LOE
    const contact = contacts.find(c => 
      c.userid?.toString() === personId || 
      c.vanid?.toString() === personId ||
      c.source?.toString() === personId || 
      c.target?.toString() === personId
    );

    if (contact) {
      // Check if they're source or target
      if (contact.userid?.toString() === personId || contact.source?.toString() === personId) {
        // They're the source - check source LOE
        const sourceLOE = (contact as any).source_loe;
        if (sourceLOE) {
          // console.log(`PeoplePanel: Found source LOE for ${personId}: ${sourceLOE}`);
          return formatLOEStatus(sourceLOE);
        }
        return 'Staff'; // Default for sources without LOE data
      } else {
        // They're the target - check target LOE
        const targetLOE = (contact as any).target_loe;
        if (targetLOE) {
          // console.log(`PeoplePanel: Found target LOE for ${personId}: ${targetLOE}`);
          return formatLOEStatus(targetLOE);
        }
      }
    }

    return 'Unknown';
  };

  // Helper function for consistent name resolution
  // Priority: 1. Meeting contact fields, 2. orgIds table, 3. API pre-built names, 4. userMap, 5. contacts data, 6. fallback
  const getConsistentName = (vanId: number | undefined, apiBuiltName: string | undefined, role: 'organizer' | 'contact', meeting?: any): string => {
    if (!vanId) {
      return apiBuiltName && apiBuiltName.trim() && apiBuiltName !== 'null null' 
        ? apiBuiltName.trim() 
        : `Unknown ${role === 'organizer' ? 'Organizer' : 'Contact'}`;
    }

    const vanIdStr = vanId.toString();

    // PRIORITY 1: Check meeting-specific contact fields first (from backend joins)
    if (meeting && role === 'contact') {
      // Check for contact_firstname/contact_lastname from backend
      if (meeting.contact_firstname || meeting.contact_lastname) {
        const firstName = meeting.contact_firstname && meeting.contact_firstname !== 'null' ? meeting.contact_firstname.trim() : '';
        const lastName = meeting.contact_lastname && meeting.contact_lastname !== 'null' ? meeting.contact_lastname.trim() : '';
        const fullName = `${firstName} ${lastName}`.trim();
        if (fullName) {
          return fullName;
        }
      }
    }

    // PRIORITY 2: orgIds table (most authoritative)
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

    // PRIORITY 3: API pre-built names (from server name resolution)
    if (apiBuiltName && apiBuiltName.trim() && apiBuiltName !== 'null null') {
      return apiBuiltName.trim();
    }

    // PRIORITY 4: userMap (backup)
    const userInfo = userMap.get(vanId) || {};
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

    // PRIORITY 5: Check contacts data for name information
    const contactInfo = contacts.find(contact => 
      contact.vanid?.toString() === vanIdStr ||
      contact.userid?.toString() === vanIdStr
    );
    
    if (contactInfo) {
      // Check if this is a target contact (organizee)
      if (contactInfo.target_firstname || contactInfo.target_lastname || contactInfo.firstname || contactInfo.lastname) {
        const firstName = contactInfo.target_firstname || contactInfo.firstname || '';
        const lastName = contactInfo.target_lastname || contactInfo.lastname || '';
        const fullName = `${firstName} ${lastName}`.trim();
        if (fullName) {
          return fullName;
        }
      }
    }

    // PRIORITY 6: Fallback with VAN ID (but try to make it more user-friendly)
    return `Person ${vanId}`;
  };

  
  // Helper functions for action status
  const hasSignedPledge = (vanid: string): boolean => {
    // Flatten all submissions from all pledge submission records and check by VAN ID
    return pledgeSubmissions.some(pledgeGroup => 
      pledgeGroup.submissions?.some((submission: any) => 
        submission.vanid?.toString() === vanid
      )
    );
  };
  
  const isOnList = (vanid: string, actionId: string): boolean => {
    // Check turfLists first (passed from parent), fallback to local listsData
    const list = (turfLists && turfLists.length > 0) ? turfLists : listsData;
    return list.some((item: any) =>
      item.vanid?.toString() === vanid &&
      (item.action_id === actionId || item.action === actionId)
    );
  };
  
  // Check if action is completed for a person
  const isActionCompleted = (vanid: string, actionId: string): boolean => {
    // For sign_pledge, check pledge submissions
    if (actionId === 'sign_pledge') {
      return hasSignedPledge(vanid);
    }
    
    // For other actions, check if all fields are completed in turfLists
    if (turfLists && turfLists.length > 0) {
      const entry = turfLists.find((item: any) => 
        item.vanid?.toString() === vanid &&
        item.action === actionId
      );
      if (!entry) return false;
      
      // Find action definition
      const action = ACTIONS.find(a => a.id === actionId);
      if (!action || !action.fields) return false;
      
      // Check if all fields are true
      return action.fields.every((field: any) => entry.fields?.[field.key] === true);
    }
    return false;
  };
  
  const handleAddToList = async (vanid: string, personName: string, actionId: string) => {
    if (!currentUserId) {
      console.error('[PeoplePanel] No current user ID');
      return;
    }
    
    try {
      const result = await addToList({
        organizer_vanid: currentUserId,
        organizer_name: currentUserName || '',
        contact_vanid: parseInt(vanid),
        contact_name: personName,
        action_id: actionId,
        action: actionId // Use action_id for the action field as well
      });
      
      // Refresh lists after adding
      const lists = await fetchLists(currentUserId);
      setListsData(lists);
      
      // Close dialog
      setActionDialogOpen(false);
      setPersonForActionMenu(null);
      setSelectedActionId('');
    } catch (error) {
      console.error('[PeoplePanel] Error adding to list:', error);
    }
  };
  
  const handleOpenActionMenu = (event: React.MouseEvent<HTMLElement>, vanid: string, name: string) => {
    event.stopPropagation();
    setPersonForActionMenu({ vanid, name });
    setSelectedActionId('');
    const defaultOrgId = propSelectedOrganizerId || currentUserId || '';
    const defaultOrgName = propSelectedOrganizerName || currentUserName || '';
    setDialogOrganizerId(defaultOrgId);
    setDialogOrganizerName(defaultOrgName);
    setActionDialogOpen(true);
  };
  
  const handleCloseActionDialog = () => {
    setActionDialogOpen(false);
    setPersonForActionMenu(null);
    setSelectedActionId('');
  };
  
  const handleConfirmAddToAction = async () => {
    if (personForActionMenu && selectedActionId && dialogOrganizerId) {
      try {
        const result = await addToList({
          organizer_vanid: dialogOrganizerId,
          organizer_name: dialogOrganizerName,
          contact_vanid: parseInt(personForActionMenu.vanid),
          contact_name: personForActionMenu.name,
          action_id: selectedActionId,
          action: selectedActionId
        });
        
        const lists = await fetchLists(dialogOrganizerId);
        setListsData(lists);
        
        setActionDialogOpen(false);
        setPersonForActionMenu(null);
        setSelectedActionId('');
      } catch (error) {
        console.error('[PeoplePanel] Error adding to list:', error);
      }
    }
  };

  // Compute people records using contacts as base, enriched with meeting data
  const computePeopleRecordsFromMeetings = () => {
    const peopleMap = new Map<string, PersonRecord>();
    
    // STEP 1: Create base records from paginated contacts
    // This uses server-side filtered and paginated contacts
    paginatedContacts.forEach(contact => {
      const contactId = contact.vanid?.toString() || '';
      if (!contactId) return;
      
      const name = `${contact.firstname || ''} ${contact.lastname || ''}`.trim() || `Contact ${contactId}`;
      
      // Use the last_contact_date from API if available (maintains API sort order)
      // BigQuery returns dates as {value: 'YYYY-MM-DD'} objects
      let lastContactDate = null;
      if (contact.last_contact_date) {
        const rawDate: any = contact.last_contact_date;
        const dateStr = typeof rawDate === 'object' && rawDate?.value
          ? rawDate.value
          : rawDate;
        const parsedDate = new Date(dateStr);
        // Only use if valid date
        if (!isNaN(parsedDate.getTime())) {
          lastContactDate = parsedDate;
        }
      }
      
      // Build organizers array: start with API-provided, then add from primary_organizer_vanid
      const organizers = [...(contact.organizers || [])];
      
      // If contact has primary_organizer_vanid, look up the name
      if (contact.primary_organizer_vanid) {
        const vanidStr = contact.primary_organizer_vanid.toString();
        const vanidNum = parseInt(contact.primary_organizer_vanid);
        
        let organizerInfo = userMap.get(vanidStr as any) || userMap.get(vanidNum as any);
        
        if (organizerInfo) {
          const organizerName = organizerInfo.fullName || 
            `${organizerInfo.firstname || ''} ${organizerInfo.lastname || ''}`.trim();
          if (organizerName && !organizers.includes(organizerName)) {
            organizers.push(organizerName);
          }
        }
      }
      
      // Merge in explicitly-assigned organizers from contactOrganizerMap
      const assignedOrgs = contactOrganizerMap?.get(contactId);
      if (assignedOrgs) {
        assignedOrgs.forEach(org => {
          if (org.name && !organizers.includes(org.name)) {
            organizers.push(org.name);
          }
        });
      }
      
      // Infer section from primary organizer when contact's own section is missing
      let inferredSection = contact.chapter;
      if ((!inferredSection || inferredSection === 'Unknown') && contact.primary_organizer_vanid) {
        const orgVanid = contact.primary_organizer_vanid.toString();
        const org = orgIds.find((o: any) => o.vanid?.toString() === orgVanid);
        if (org?.chapter && org.chapter !== 'Unknown') inferredSection = org.chapter;
        if (!inferredSection || inferredSection === 'Unknown') {
          const orgInfo = userMap.get(parseInt(orgVanid) as any) || userMap.get(orgVanid as any);
          if ((orgInfo as any)?.chapter && (orgInfo as any).chapter !== 'Unknown') inferredSection = (orgInfo as any).chapter;
        }
      }

      const personRecord: PersonRecord = {
        id: contactId,
        name: name,
        type: 'contact',
        chapter: inferredSection || 'Unknown',
        email: contact.email || undefined,
        phone: undefined,
        mostRecentContact: lastContactDate,
        mostRecentContactAllTime: lastContactDate,
        totalMeetings: 0,
        totalMeetingsAllTime: contact.total_meetings_all_time || 0,
        latestNotes: '',
        latestCommitmentAsked: '',
        latestCommitmentMade: '',
        organizers: organizers,
        loeStatus: contact.loe || getLOEStatus(contactId),
        memberStatus: contact.member_status || undefined,
        allMeetings: [],
        allMeetingsAllTime: [],
        primary_organizer_vanid: contact.primary_organizer_vanid?.toString()
          || contactOrganizerMap?.get(contactId)?.[0]?.organizer_vanid
          || undefined,
      };
      peopleMap.set(contactId, personRecord);
    });

    // Debug logging - commented out for production
    // console.log('[PeoplePanel] computePeopleRecordsFromMeetings: Starting enrichment', {
    //   contactsCount: peopleMap.size,
    //   filteredMeetingsCount: filteredMeetings.length,
    //   sampleContact: paginatedContacts[0] ? {
    //     vanid: paginatedContacts[0].vanid,
    //     last_contact_date: paginatedContacts[0].last_contact_date,
    //     total_meetings: paginatedContacts[0].total_meetings_all_time
    //   } : null,
    //   samplePersonRecord: peopleMap.size > 0 ? (() => {
    //     const first = Array.from(peopleMap.values())[0];
    //     return {
    //       name: first.name,
    //       mostRecentContact: first.mostRecentContact,
    //       mostRecentContactAllTime: first.mostRecentContactAllTime,
    //       latestNotes: first.latestNotes,
    //       totalMeetings: first.totalMeetings,
    //       totalMeetingsAllTime: first.totalMeetingsAllTime
    //     };
    //   })() : null
    // });
    
    // STEP 2: Enrich with meeting data (ONLY for people already in the contacts API response)
    // Note: Backend by-contacts API returns participant_vanid, date_contacted, meeting_type, purpose/notes fields
    let enrichedCount = 0;
    filteredMeetings.forEach((meeting, index) => {
      // Backend uses participant_vanid (not vanid) for by-contacts API
      const meetingVanid = meeting.participant_vanid || meeting.vanid;
      const meetingOrganizerVanid = meeting.organizer_vanid;
      
      // Skip completely empty records
      if (!meetingVanid && !meetingOrganizerVanid) {
        return;
      }
      
      const organizeeId = meetingVanid ? meetingVanid.toString() : `unknown_contact_${index}`;

      // IMPORTANT: Only enrich existing records from API, don't add new people from meetings
      if (!peopleMap.has(organizeeId)) {
        return; // Skip this meeting - person not in API results
      }

      const person = peopleMap.get(organizeeId)!;
      enrichedCount++;
      
      // Extract date - backend uses date_contacted (may be object {value: '...'} or string)
      const rawDate = meeting.date_contacted || meeting.datestamp;
      const dateString = typeof rawDate === 'object' && rawDate?.value ? rawDate.value : (typeof rawDate === 'string' ? rawDate : '');
      
      // Deduplicate meetings
      const meetingType = meeting.meeting_type || meeting.conversation_type || '';
      const notesPurpose = meeting.purpose || meeting.notes_purpose || '';
      const notesCommitments = meeting.commitments || meeting.notes_commitments || '';
      const meetingKey = `${meetingOrganizerVanid}-${meetingVanid}-${dateString}-${meetingType}-${notesPurpose}-${notesCommitments}`;
      
      const isDuplicate = person.allMeetings.some(existingMeeting => {
        const existingRawDate = existingMeeting.date_contacted || existingMeeting.datestamp;
        const existingDateString = typeof existingRawDate === 'object' && existingRawDate?.value ? existingRawDate.value : (typeof existingRawDate === 'string' ? existingRawDate : '');
        const existingType = existingMeeting.meeting_type || existingMeeting.conversation_type || '';
        const existingPurpose = existingMeeting.purpose || existingMeeting.notes_purpose || '';
        const existingCommitments = existingMeeting.commitments || existingMeeting.notes_commitments || '';
        const existingKey = `${existingMeeting.organizer_vanid}-${(existingMeeting.participant_vanid || existingMeeting.vanid)}-${existingDateString}-${existingType}-${existingPurpose}-${existingCommitments}`;
        return existingKey === meetingKey;
      });
      
      if (!isDuplicate) {
        person.totalMeetings += 1;
        person.allMeetings.push(meeting);
      }

      // Update most recent contact
      const meetingDate = dateString ? new Date(dateString) : null;
      
      if (meetingDate && !isNaN(meetingDate.getTime()) && (!person.mostRecentContact || meetingDate > person.mostRecentContact)) {
        person.mostRecentContact = meetingDate;
      }

      // Update latest notes — include both legacy fields and lumoviz_meetings actual fields
      const notes = [
        meeting.purpose || meeting.notes_purpose,
        (meeting as any).lmtg_values,
        (meeting as any).lmtg_difference,
        (meeting as any).lmtg_resources,
        meeting.commitments || meeting.notes_commitments || (meeting as any).lmtg_commitment_what,
        meeting.stakes || meeting.notes_stakes,
        meeting.development || meeting.notes_development,
        meeting.evaluation || meeting.notes_evaluation,
        (meeting as any).lmtg_notes,
      ].filter(Boolean).join(' | ');
      
      if (notes && meetingDate && (!person.latestNotes || (person.mostRecentContact && meetingDate.getTime() === person.mostRecentContact.getTime()))) {
        person.latestNotes = notes;
      }

      // Track most-recent commitment asked/made from lumoviz_meetings
      if (meetingDate && person.mostRecentContact && meetingDate.getTime() === person.mostRecentContact.getTime()) {
        const asked = (meeting as any).lmtg_commitment_asked;
        const made  = (meeting as any).lmtg_commitment_made;
        if (asked) person.latestCommitmentAsked = asked;
        if (made)  person.latestCommitmentMade  = made;
      }

      // Track organizers from meetings (only if not already populated from API)
      if (person.organizers.length === 0) {
        // Build organizer name from the joined fields
        const orgFirstName = meeting.organizer_first_name || meeting.organizer_firstname || '';
        const orgLastName = meeting.organizer_last_name || meeting.organizer_lastname || '';
        const organizerName = meeting.organizer || `${orgFirstName} ${orgLastName}`.trim() || 
          getConsistentName(meetingOrganizerVanid, meeting.organizer, 'organizer', meeting);
        
        if (organizerName && !person.organizers.includes(organizerName)) {
          person.organizers.push(organizerName);
        }
      }
    });

    // STEP 3: Process pledge submissions
    // - Add people from pledge submissions who aren't already in contacts
    // - Update last contact date for existing people if pledge date is more recent
    pledgeSubmissions.forEach(pledgeGroup => {
      if (!pledgeGroup.submissions) return;
      
      pledgeGroup.submissions.forEach((submission: any) => {
        const pledgeVanid = submission.vanid?.toString();
        if (!pledgeVanid) return;
        
        // Apply organizer filter to pledge submissions
        const leaderName = submission.leader || '';
        if (propOrganizerVanIds && propOrganizerVanIds.length > 0) {
          const leaderVanid = (submission as any).leader_vanid?.toString() || '';
          if (!propOrganizerVanIds.includes(leaderVanid)) {
            return;
          }
        } else if (filters.organizer) {
          if (!leaderName.toLowerCase().includes(filters.organizer.toLowerCase())) {
            return;
          }
        }
        
        const pledgeDate = new Date(pledgeGroup.date_submitted);
        
        // Check if person already exists in the map (from contacts)
        if (peopleMap.has(pledgeVanid)) {
          const person = peopleMap.get(pledgeVanid)!;
          
          // Update last contact date if pledge date is more recent than their last meeting
          const currentLastContact = person.mostRecentContactAllTime || person.mostRecentContact;
          if (!currentLastContact || pledgeDate > currentLastContact) {
            person.mostRecentContact = pledgeDate;
            person.mostRecentContactAllTime = pledgeDate;
            
            // Update latest notes to include pledge info
            const pledgeNote = `Signed pledge: ${submission.desired_change || ''}`;
            if (!person.latestNotes || pledgeDate.getTime() === person.mostRecentContact.getTime()) {
              person.latestNotes = pledgeNote;
            }
          }
          
          // Add leader to organizers if not already there
          if (leaderName && !person.organizers.includes(leaderName)) {
            person.organizers.push(leaderName);
          }
        } else {
          // Person not in contacts - only add them if no LOE/membership filters are active
          // (since we don't have LOE/membership data for pledge-only people)
          const hasLOEOrMemberFilter = filters.loeStatus.length > 0 || filters.memberStatus.length > 0;
          
          if (!hasLOEOrMemberFilter) {
            const name = `${submission.first_name || ''} ${submission.last_name || ''}`.trim() || `Contact ${pledgeVanid}`;
            
            const personRecord: PersonRecord = {
              id: pledgeVanid,
              name: name,
              type: 'contact',
              chapter: pledgeGroup.chapter || 'Unknown',
              email: undefined,
              phone: undefined,
              mostRecentContact: pledgeDate,
              mostRecentContactAllTime: pledgeDate,
              totalMeetings: 0,
              totalMeetingsAllTime: 0,
              latestNotes: `Signed pledge: ${submission.desired_change || ''}`,
              latestCommitmentAsked: '',
              latestCommitmentMade: '',
              organizers: leaderName ? [leaderName] : [],
              loeStatus: undefined,
              memberStatus: undefined,
              allMeetings: [],
              allMeetingsAllTime: []
            };
            peopleMap.set(pledgeVanid, personRecord);
          }
        }
      });
    });

    // STEP 4: All-time stats now come from the API (total_meetings_all_time)
    // No need to calculate here - API aggregates this efficiently

    // Debug logging - commented out for production
    // console.log('[PeoplePanel] computePeopleRecordsFromMeetings: Enrichment complete', {
    //   enrichedCount,
    //   totalPeopleRecords: peopleMap.size,
    //   sampleEnrichedPerson: Array.from(peopleMap.values())[0] ? {
    //     name: Array.from(peopleMap.values())[0].name,
    //     mostRecentContact: Array.from(peopleMap.values())[0].mostRecentContact,
    //     latestNotes: Array.from(peopleMap.values())[0].latestNotes?.substring(0, 50),
    //     totalMeetings: Array.from(peopleMap.values())[0].totalMeetings
    //   } : null
    // });
    
    // STEP 5: Sort by most recent contact date (reverse chronological)
    const result = Array.from(peopleMap.values());
    result.sort((a, b) => {
      const aDate = a.mostRecentContactAllTime || a.mostRecentContact;
      const bDate = b.mostRecentContactAllTime || b.mostRecentContact;
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1; // Put people with no contact date at the end
      if (!bDate) return -1;
      return bDate.getTime() - aDate.getTime(); // Reverse chronological (newest first)
    });
    
    return result;
  };

  // Create people records from paginated contacts (use external data if available)
  const peopleRecords = useMemo(() => {
    // If external people records are provided, use them
    if (externalPeopleRecords) {
      return externalPeopleRecords;
    }
    
    // Otherwise, compute them from paginated contacts enriched with contact-specific meetings
    return computePeopleRecordsFromMeetings();
  }, [externalPeopleRecords, contactMeetings, selectedNodeId, userMap, orgIds, paginatedContacts, pledgeSubmissions, filters.organizer, contactOrganizerMap]);

  // Focus on people data processing only

  const processedPeople = useMemo(() => {
    // If external filtered data is provided, use it but still apply selectedNodeId filter
    if (externalFilteredPeopleRecords) {
      let filtered = externalFilteredPeopleRecords;
      
      // Apply selectedNodeId filter if present
      if (selectedNodeId) {
        filtered = filtered.filter(person => person.id === selectedNodeId);
      }
      
      // Apply meeting count filter (client-side only, not API-filtered)
      if (filters.meetingCountFilter === 'zero') {
        filtered = filtered.filter(person => 
          (person.totalMeetingsAllTime || person.totalMeetings || 0) === 0
        );
      } else if (filters.meetingCountFilter === 'hasAny') {
        filtered = filtered.filter(person => 
          (person.totalMeetingsAllTime || person.totalMeetings || 0) > 0
        );
      }
      
      // Apply last contact filter (client-side only)
      if (filters.lastContactFilter !== 'all') {
        const now = new Date();
        filtered = filtered.filter(person => {
          const lastContact = person.mostRecentContactAllTime || person.mostRecentContact;
          
          if (!lastContact && filters.lastContactFilter === 'never') {
            return true; // Include people never contacted
          }
          
          if (!lastContact) {
            // For "over X days/months" filters, include people with no contact date
            return filters.lastContactFilter.startsWith('over_');
          }
          
          const daysSinceContact = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
          
          switch (filters.lastContactFilter) {
            case 'within_7_days':
              return daysSinceContact <= 7;
            case 'within_14_days':
              return daysSinceContact <= 14;
            case 'within_30_days':
              return daysSinceContact <= 30;
            case 'within_3_months':
              return daysSinceContact <= 90;
            case 'over_30_days':
              return daysSinceContact > 30;
            case 'over_3_months':
              return daysSinceContact > 90;
            case 'over_6_months':
              return daysSinceContact > 180;
            case 'never':
              return false; // Already handled above
            default:
              return true;
          }
        });
      }
      
      // Organizer filter is now handled server-side
      
      // Apply sorting
      filtered.sort((a, b) => {
        let comparison = 0;

        switch (sortColumn) {
          case 'name': {
            const aLast = (a.name || '').split(' ').slice(-1)[0].toLowerCase();
            const bLast = (b.name || '').split(' ').slice(-1)[0].toLowerCase();
            comparison = aLast.localeCompare(bLast) || (a.name || '').localeCompare(b.name || '');
            break;
          }
          case 'chapter':
            comparison = (a.chapter || '').localeCompare(b.chapter || '');
            break;
          case 'team': {
            const aTeam = (personToTeams.get(a.id) || [])[0] || '';
            const bTeam = (personToTeams.get(b.id) || [])[0] || '';
            comparison = aTeam.localeCompare(bTeam) || (a.name || '').localeCompare(b.name || '');
            break;
          }
          case 'organizers': {
            const aOrg = (a.organizers || [])[0] || '';
            const bOrg = (b.organizers || [])[0] || '';
            comparison = aOrg.localeCompare(bOrg);
            break;
          }
          case 'mostRecentContact': {
            const aDate = (a.mostRecentContactAllTime || a.mostRecentContact)?.getTime() || 0;
            const bDate = (b.mostRecentContactAllTime || b.mostRecentContact)?.getTime() || 0;
            comparison = aDate - bDate;
            break;
          }
          case 'totalMeetings':
            comparison = (a.totalMeetingsAllTime || a.totalMeetings) - (b.totalMeetingsAllTime || b.totalMeetings);
            break;
          default:
            comparison = 0;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });

      return filtered;
    }
    
    // Use peopleRecords directly - API already handles filtering and initial sort
    let filtered = [...peopleRecords];

    // Apply selectedNodeId filter if present (this is UI-specific, not API-filtered)
    if (selectedNodeId) {
      filtered = filtered.filter(person => person.id === selectedNodeId);
    }

    // Apply team filter (client-side, uses personToTeams lookup)
    if (filters.team && filters.team.trim()) {
      filtered = filtered.filter(person => {
        const teams = personToTeams.get(person.id) || [];
        return teams.some(t => t === filters.team);
      });
    }

    // Apply commitment asked filter
    if (filters.commitmentAsked) {
      filtered = filtered.filter(person => person.latestCommitmentAsked === filters.commitmentAsked);
    }

    // Apply commitment made filter
    if (filters.commitmentMade) {
      filtered = filtered.filter(person => person.latestCommitmentMade === filters.commitmentMade);
    }

    // Apply search text filter (client-side, including pledge-only people)
    if (filters.searchText && filters.searchText.trim()) {
      const searchLower = filters.searchText.toLowerCase().trim();
      filtered = filtered.filter(person => {
        const nameLower = person.name.toLowerCase();
        const emailLower = (person.email || '').toLowerCase();
        let notesLower = '';
        if (person.latestNotes) {
          const latestMtg = [...(person.allMeetings || [])].sort((a, b) => {
            const aD = (typeof a.date_contacted === 'object' ? a.date_contacted?.value : a.date_contacted) || '';
            const bD = (typeof b.date_contacted === 'object' ? b.date_contacted?.value : b.date_contacted) || '';
            return bD.localeCompare(aD);
          })[0];
          if (!latestMtg || canSeeNotesForOrganizer(latestMtg.organizer_vanid)) {
            notesLower = person.latestNotes.toLowerCase();
          }
        }
        return nameLower.includes(searchLower) || 
               notesLower.includes(searchLower) || 
               emailLower.includes(searchLower);
      });
    }

    // Apply meeting count filter (client-side only, not API-filtered)
    if (filters.meetingCountFilter === 'zero') {
      filtered = filtered.filter(person => 
        (person.totalMeetingsAllTime || person.totalMeetings || 0) === 0
      );
    } else if (filters.meetingCountFilter === 'hasAny') {
      filtered = filtered.filter(person => 
        (person.totalMeetingsAllTime || person.totalMeetings || 0) > 0
      );
    }

    // Apply action status filter (client-side only)
    if (filters.actionStatus !== 'all') {
      filtered = filtered.filter(person => {
        // Check action status for ALL actions (not just selected ones)
        const actionStatuses = ACTIONS.map(action => {
          const actionId = action.id;
          const isCompleted = actionId === 'sign_pledge' ? hasSignedPledge(person.id) : false;
          const onList = isOnList(person.id, actionId);
          return { actionId, isCompleted, onList };
        });

        switch (filters.actionStatus) {
          case 'completed':
            // Has completed at least one action
            return actionStatuses.some(a => a.isCompleted);
          case 'onList':
            // On list but not completed for at least one action
            return actionStatuses.some(a => a.onList && !a.isCompleted);
          case 'notOnList':
            // Not on any list (and not completed)
            return actionStatuses.every(a => !a.onList && !a.isCompleted);
          default:
            return true;
        }
      });
    }

    // Apply last contact filter (client-side only)
    if (filters.lastContactFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(person => {
        const lastContact = person.mostRecentContactAllTime || person.mostRecentContact;
        
        if (!lastContact && filters.lastContactFilter === 'never') {
          return true; // Include people never contacted
        }
        
        if (!lastContact) {
          // For "over X days/months" filters, include people with no contact date
          return filters.lastContactFilter.startsWith('over_');
        }
        
        const daysSinceContact = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (filters.lastContactFilter) {
          case 'within_7_days':
            return daysSinceContact <= 7;
          case 'within_14_days':
            return daysSinceContact <= 14;
          case 'within_30_days':
            return daysSinceContact <= 30;
          case 'within_3_months':
            return daysSinceContact <= 90;
          case 'over_30_days':
            return daysSinceContact > 30;
          case 'over_3_months':
            return daysSinceContact > 90;
          case 'over_6_months':
            return daysSinceContact > 180;
          case 'never':
            return false; // Already handled above
          default:
            return true;
        }
      });
    }

    // Organizer filter is now handled server-side - no need for client-side filtering!

    // Always sort client-side so the chosen column is respected regardless of API order
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'name': {
          // Sort by last name, then first name
          const aLast = (a.name || '').split(' ').slice(-1)[0].toLowerCase();
          const bLast = (b.name || '').split(' ').slice(-1)[0].toLowerCase();
          comparison = aLast.localeCompare(bLast) || (a.name || '').localeCompare(b.name || '');
          break;
        }
        case 'chapter':
          comparison = (a.chapter || '').localeCompare(b.chapter || '');
          break;
        case 'team': {
          const aTeam = (personToTeams.get(a.id) || [])[0] || '';
          const bTeam = (personToTeams.get(b.id) || [])[0] || '';
          comparison = aTeam.localeCompare(bTeam) || (a.name || '').localeCompare(b.name || '');
          break;
        }
        case 'organizers': {
          const aOrg = (a.organizers || [])[0] || '';
          const bOrg = (b.organizers || [])[0] || '';
          comparison = aOrg.localeCompare(bOrg);
          break;
        }
        case 'mostRecentContact': {
          const aDate = (a.mostRecentContactAllTime || a.mostRecentContact)?.getTime() || 0;
          const bDate = (b.mostRecentContactAllTime || b.mostRecentContact)?.getTime() || 0;
          comparison = aDate - bDate;
          break;
        }
        case 'totalMeetings':
          comparison = (a.totalMeetingsAllTime || a.totalMeetings) - (b.totalMeetingsAllTime || b.totalMeetings);
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [peopleRecords, externalFilteredPeopleRecords, searchText, filters, sortColumn, sortDirection, selectedNodeId]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      // Text columns default A→Z; numeric/date columns default newest/most first
      const textColumns: SortColumn[] = ['name', 'chapter', 'team', 'organizers'];
      setSortDirection(textColumns.includes(column) ? 'asc' : 'desc');
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    // Also update filters.searchText so API receives the search term
    handleFilterChange('searchText', value);
  };

  const handlePersonClick = (person: PersonRecord) => {
    setSelectedPerson(person);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedPerson(null);
  };

  const handleViewOrganizerDetails = (name: string, vanId?: string) => {
    setSelectedOrganizerName(name);
    setSelectedOrganizerVanId(vanId);
    setOrganizerDialogOpen(true);
  };

  const handleCloseOrganizerDialog = () => {
    setOrganizerDialogOpen(false);
    setSelectedOrganizerName('');
    setSelectedOrganizerVanId(undefined);
  };


  const handleAddConnection = (connection: NewConnection) => {
    if (onAddConnection) {
      onAddConnection(connection);
    }
    setAddConnectionDialogOpen(false);
  };

  const getSelectedNodeName = () => {
    if (!selectedNodeId) return '';
    const person = peopleRecords.find(p => p.id === selectedNodeId);
    if (person) return person.name;
    
    const userInfo = userMap.get(parseInt(selectedNodeId));
    return userInfo?.name || `Person ${selectedNodeId}`;
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' ? <ArrowUpIcon fontSize="small" /> : <ArrowDownIcon fontSize="small" />;
  };

  // Copy filtered view to clipboard in TSV format (Tab-Separated Values)
  // This format pastes nicely into Google Docs and Excel as a table
  const copyToClipboard = async () => {
    try {
      const rows: string[] = [];
      
      // Header row - match the visible columns in the table
      const headerCells: string[] = ['Name'];
      
      if (!hideColumns.includes('chapter')) {
        headerCells.push('Chapter');
      }
      if (!hideColumns.includes('organizer')) {
        headerCells.push('Organizers');
      }
      
      headerCells.push('LOE', 'Status', 'Last Contact', 'One-on-Ones', 'Latest Notes');
      
      rows.push(headerCells.join('\t'));
      
      // Data rows - extract only visible data from the table
      processedPeople.forEach(person => {
        const cells: string[] = [];
        
        // Name
        cells.push(person.name || 'Unknown');
        
        // Chapter (if visible)
        if (!hideColumns.includes('chapter')) {
          cells.push(person.chapter || '-');
        }
        
        // Organizers (if visible)
        if (!hideColumns.includes('organizer')) {
          cells.push(person.organizers.length > 0 ? person.organizers.join(', ') : '-');
        }
        
        // LOE Status
        cells.push(person.loeStatus && person.loeStatus !== 'Unknown' 
          ? person.loeStatus.replace(/^\d+[_.]/, '') 
          : '-');
        
        // Member Status
        cells.push(person.memberStatus || '-');
        
        // Last Contact
        cells.push(person.mostRecentContactAllTime || person.mostRecentContact
          ? format(person.mostRecentContactAllTime || person.mostRecentContact!, 'M/d/yy')
          : 'Never');
        
        // One-on-Ones count
        cells.push(String(person.totalMeetingsAllTime || person.totalMeetings || 0));
        
        // Latest Notes (clean up any tabs or newlines that would break TSV format)
        let rawNotes = person.latestNotes || '-';
        if (rawNotes !== '-') {
          const latestMtg = [...(person.allMeetings || [])].sort((a, b) => {
            const aD = (typeof a.date_contacted === 'object' ? a.date_contacted?.value : a.date_contacted) || '';
            const bD = (typeof b.date_contacted === 'object' ? b.date_contacted?.value : b.date_contacted) || '';
            return bD.localeCompare(aD);
          })[0];
          if (latestMtg && !canSeeNotesForOrganizer(latestMtg.organizer_vanid)) {
            rawNotes = 'Team only';
          }
        }
        const notes = rawNotes
          .replace(/\t/g, ' ')
          .replace(/\n/g, ' ')
          .trim();
        cells.push(notes);
        
        rows.push(cells.join('\t'));
      });
      
      // Join all rows with newlines
      const tsvOutput = rows.join('\n');
      
      await navigator.clipboard.writeText(tsvOutput);
      alert(`✓ Copied ${processedPeople.length} contacts as table!\n\nYou can now paste this into Google Docs, Excel, or any spreadsheet.`);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      alert('Failed to copy to clipboard. Please try again.');
    }
  };

  const handleLogConversation = async (conversation: NewConversation) => {
    const res = await fetch(`${API_BASE_URL}/api/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conversation),
    });
    if (!res.ok) throw new Error('Failed to log conversation');
  };

  // Build organizer list from orgIds for dialogs
  const dialogOrganizers = React.useMemo(() => {
    return orgIds.map((o: any) => ({
      id: o.vanid?.toString() || '',
      name: `${o.firstname || ''} ${o.lastname || ''}`.trim() || o.name || '',
      section: o.chapter || '',
    })).filter(o => o.id && o.name);
  }, [orgIds]);

  // Build contacts list for conversation dialog
  const dialogContacts = React.useMemo(() => {
    const source = sharedAllContacts ?? contacts;
    return source.map((c: any) => ({
      vanid: c.vanid?.toString() || c.id || '',
      name: `${c.firstname || c.first_name || ''} ${c.lastname || c.last_name || ''}`.trim() || c.name || '',
      chapter: c.chapter || '',
    })).filter(c => c.vanid && c.name);
  }, [sharedAllContacts, contacts]);

  return (
    <Box sx={{
      width: '100%',
      height: '100%',
      backgroundColor: '#fafafa',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* People Content */}
          {/* Summary Section with Results Count */}
          {processedPeople.length > 0 && (
            <Box sx={{ 
              padding: '12px 20px', 
              backgroundColor: '#f8f9fa',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              flexDirection: 'column',
              gap: 1
            }}>
              {/* Top row: People count and actions */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                  Showing <strong>{processedPeople.length}</strong> {filteredContacts.length > processedPeople.length && `of ${filteredContacts.length}`} contacts
                  {selectedNodeId && ` with meetings involving ${getSelectedNodeName()}`}
                  {filters.searchText && ` matching "${filters.searchText}"`}
                  {filters.organizer && ` organized by ${filters.organizer}`}
                  {filters.team && ` on team "${filters.team}"`}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {contactsLoading && (
                    <Typography variant="caption" color="primary" sx={{ fontSize: '0.75rem' }}>Loading...</Typography>
                  )}
                  {!hideActionButtons && (
                    <>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ChatIcon fontSize="small" />}
                        onClick={() => setShowLogConversationDialog(true)}
                        sx={{ fontSize: '0.75rem', py: 0.4, borderColor: '#d1d5db', color: 'text.secondary', '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}
                      >
                        Log Conversation
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<PersonAddIcon fontSize="small" />}
                        onClick={() => setShowBatchAddDialog(true)}
                        sx={{ fontSize: '0.75rem', py: 0.4 }}
                      >
                        Add People
                      </Button>
                    </>
                  )}
                  {showCopyButton && (
                    <Tooltip title="Copy as table (paste into Google Docs/Excel)">
                      <IconButton 
                        onClick={copyToClipboard}
                        size="small"
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>

              {/* Bottom row: Conversation stats */}
              {(() => {
                // Aggregate meetings from processedPeople, filtered by current date range
                const allMeetings = processedPeople.flatMap(person => {
                  const meetings = person.allMeetings || [];
                  
                  // Filter meetings by current date range if set
                  if (currentDateRange) {
                    const [startDate, endDate] = currentDateRange;
                    return meetings.filter(meeting => {
                      const rawDate = meeting.date_contacted || meeting.datestamp;
                      const dateStr = typeof rawDate === 'object' && rawDate?.value 
                        ? rawDate.value 
                        : (typeof rawDate === 'string' ? rawDate : null);
                      if (!dateStr) return false;
                      
                      const meetingDate = new Date(dateStr as string);
                      if (isNaN(meetingDate.getTime())) return false;
                      
                      return meetingDate >= startDate && meetingDate <= endDate;
                    });
                  }
                  
                  return meetings;
                });
                
                const totalOneOnOnes = allMeetings.length;
                
                // Count by conversation type
                const typeCounts: Record<string, number> = {};
                allMeetings.forEach(meeting => {
                  const type = meeting.conversation_type || meeting.meeting_type || 'Unknown';
                  typeCounts[type] = (typeCounts[type] || 0) + 1;
                });
                
                // Sort by count descending
                const sortedTypes = Object.entries(typeCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5); // Show top 5 types
                
                // Count completed actions in the date range (filtered by organizer AND visible people)
                const { count: completedActionsCount, breakdown: actionsBreakdown } = (() => {
                  // Calculate date range based on lastContactFilter
                  const now = new Date();
                  let startDate: Date;
                  let endDate: Date = now;
                  
                  switch (filters.lastContactFilter) {
                    case 'within_7_days':
                      startDate = new Date(now);
                      startDate.setDate(startDate.getDate() - 7);
                      break;
                    case 'within_14_days':
                      startDate = new Date(now);
                      startDate.setDate(startDate.getDate() - 14);
                      break;
                    case 'within_30_days':
                      startDate = new Date(now);
                      startDate.setDate(startDate.getDate() - 30);
                      break;
                    case 'within_3_months':
                      startDate = new Date(now);
                      startDate.setMonth(startDate.getMonth() - 3);
                      break;
                    case 'all':
                    default:
                      // For 'all', show all time - use a very old date
                      startDate = new Date('2020-01-01');
                      break;
                  }
                  
                  // Only count actions for people visible in the table
                  const visiblePeopleIds = new Set(processedPeople.map(p => p.id));
                  
                  const actionBreakdown: Record<string, number> = {};
                  
                  // Get organizer VAN IDs and names for filtering (same logic as conversation filtering)
                  const getOrganizerVariations = () => {
                    if (!filters.organizer || !filters.organizer.trim()) {
                      return { vanIds: [], names: [] };
                    }
                    
                    const organizerLower = filters.organizer.toLowerCase().trim();
                    
                    if (!organizerMappings || organizerMappings.length === 0) {
                      return { vanIds: [], names: [organizerLower] };
                    }
                    
                    const mapping = organizerMappings.find((m: any) => 
                      m.preferred_name?.toLowerCase() === organizerLower ||
                      m.primary_vanid?.toLowerCase() === organizerLower
                    );
                    
                    if (!mapping) {
                      return { vanIds: [], names: [organizerLower] };
                    }
                    
                    const vanIds = [
                      mapping.primary_vanid,
                      ...(mapping.alternate_vanids || [])
                    ].filter(Boolean).map((id: any) => id.toString());
                    
                    const names = [
                      mapping.preferred_name,
                      ...(mapping.alternate_names || [])
                    ].filter(Boolean).map((n: string) => n.toLowerCase());
                    
                    return { vanIds, names };
                  };
                  
                  const { vanIds: organizerVanIds, names: organizerNames } = getOrganizerVariations();
                  
                  // Get live actions
                  const liveActions = actions.filter((a: any) => (a.status || 'live') === 'live');
                  
                  let completedCount = 0;
                  
                  // Count completed turf list entries
                  if (turfLists && turfLists.length > 0) {
                    liveActions.forEach((action: any) => {
                      const goalFieldKey = action.goal_field_key;
                      
                      // Get entries for this action in the date range
                      const actionEntries = turfLists.filter((entry: any) => {
                        // Only count for people visible in the table
                        const entryVanid = entry.vanid?.toString() || entry.participant_vanid?.toString();
                        if (!visiblePeopleIds.has(entryVanid)) return false;
                        
                        // Match by action_id (not action name)
                        if (entry.action_id !== action.action_id) return false;
                        
                        // Filter by organizer if specified
                        if (filters.organizer && filters.organizer.trim()) {
                          const entryOrganizerVanid = entry.organizer_vanid?.toString();
                          const matchesVanId = entryOrganizerVanid && organizerVanIds.includes(entryOrganizerVanid);
                          
                          if (!matchesVanId) {
                            return false;
                          }
                        }
                        
                        // Check if in date range - use last_updated or date_added
                        const entryDate = entry.last_updated?.value ? new Date(entry.last_updated.value) : 
                                        entry.date_added?.value ? new Date(entry.date_added.value) :
                                        entry.updated_at ? new Date(entry.updated_at) : 
                                        new Date(entry.created_at || entry.date_added);
                        if (isNaN(entryDate.getTime())) return false;
                        if (entryDate < startDate || entryDate > endDate) return false;
                        
                        // Check if completed - look for is_completed flag or check progress fields
                        if (entry.is_completed === true) {
                          return true;
                        }
                        
                        // Check if goal field is completed
                        if (goalFieldKey && entry.fields) {
                          return entry.fields[goalFieldKey] === true;
                        } else if (entry.progress) {
                          // For actions with progress object, check if all steps are done
                          const progressValues = Object.values(entry.progress);
                          return progressValues.length > 0 && progressValues.every((v: any) => v === true);
                        } else {
                          // Use last field if no goal field specified
                          const lastField = action.fields?.[action.fields.length - 1];
                          if (lastField && entry.fields) {
                            return entry.fields[lastField.key] === true;
                          }
                        }
                        
                        return false;
                      });
                      
                      if (actionEntries.length > 0) {
                        actionBreakdown[action.action_name] = (actionBreakdown[action.action_name] || 0) + actionEntries.length;
                      }
                      completedCount += actionEntries.length;
                    });
                  }
                  
                  // Count completed pledges (sign_pledge actions)
                  const pledgeAction = liveActions.find((a: any) => a.action_name === 'Sign Pledge' || a.action_id === 'sign_pledge');
                  if (pledgeAction && pledgeSubmissions && pledgeSubmissions.length > 0) {
                    let pledgeCount = 0;
                    
                    pledgeSubmissions.forEach((pledgeGroup: any, idx: number) => {
                      // Get the date for this pledge group
                      const pledgeDate = pledgeGroup.date_submitted ? new Date(pledgeGroup.date_submitted) :
                                        pledgeGroup.timestamp ? new Date(pledgeGroup.timestamp) :
                                        pledgeGroup.date_pledged?.value ? new Date(pledgeGroup.date_pledged.value) :
                                        pledgeGroup.date_pledged ? new Date(pledgeGroup.date_pledged) : null;
                      
                      if (pledgeDate && !isNaN(pledgeDate.getTime()) && pledgeDate >= startDate && pledgeDate <= endDate) {
                        // Filter submissions by organizer if specified
                        if (pledgeGroup.submissions && Array.isArray(pledgeGroup.submissions)) {
                          pledgeGroup.submissions.forEach((submission: any) => {
                            // Only count pledges from people visible in the table
                            const submissionVanid = submission.vanid?.toString();
                            if (!visiblePeopleIds.has(submissionVanid)) return;
                            
                            // Filter by organizer/leader if specified
                            if (filters.organizer && filters.organizer.trim()) {
                              const leaderName = (submission.leader || '').toLowerCase();
                              const matchesName = organizerNames.some((name: string) => 
                                leaderName.includes(name) || name.includes(leaderName)
                              );
                              
                              if (matchesName) {
                                pledgeCount += 1;
                              }
                            } else {
                              // No organizer filter, count all
                              pledgeCount += 1;
                            }
                          });
                        } else if (!filters.organizer && pledgeGroup.pledge_count) {
                          // No organizer filter and no submissions array, use count
                          pledgeCount += pledgeGroup.pledge_count;
                        } else if (!filters.organizer) {
                          // No organizer filter and no submissions or count, count as 1
                          pledgeCount += 1;
                        }
                      }
                    });
                    
                    if (pledgeCount > 0) {
                      actionBreakdown[pledgeAction.action_name] = (actionBreakdown[pledgeAction.action_name] || 0) + pledgeCount;
                    }
                    completedCount += pledgeCount;
                  }
                  
                  return { count: completedCount, breakdown: actionBreakdown };
                })();
                
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    {/* Total Conversations Count */}
                    <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.primary' }}>
                      <strong style={{ color: '#1976d2', fontSize: '1rem' }}>{totalOneOnOnes}</strong> total conversations
                    </Typography>
                    
                    {/* Completed Actions Count */}
                    {completedActionsCount > 0 && (
                      <>
                        <span style={{ color: '#d0d0d0' }}>•</span>
                        <Tooltip 
                          title={
                            <Box sx={{ p: 0.5 }}>
                              <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                                Actions Breakdown:
                              </Typography>
                              {Object.entries(actionsBreakdown)
                                .sort((a, b) => b[1] - a[1])
                                .map(([actionName, count]) => (
                                  <Typography key={actionName} variant="caption" sx={{ display: 'block' }}>
                                    {actionName}: {count}
                                  </Typography>
                                ))}
                            </Box>
                          }
                          arrow
                        >
                          <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.primary', cursor: 'help' }}>
                            <strong style={{ color: '#4caf50', fontSize: '1rem' }}>{completedActionsCount}</strong> actions completed
                          </Typography>
                        </Tooltip>
                      </>
                    )}
                    
                    {/* Breakdown by Type - compact inline format */}
                    {sortedTypes.length > 0 && (
                      <>
                        <span style={{ color: '#d0d0d0' }}>•</span>
                        {sortedTypes.map(([type, count], idx) => (
                          <React.Fragment key={type}>
                            <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                              {type}: <strong style={{ color: 'text.primary' }}>{count}</strong>
                            </Typography>
                            {idx < sortedTypes.length - 1 && <span style={{ color: '#d0d0d0' }}>•</span>}
                          </React.Fragment>
                        ))}
                      </>
                    )}
                  </Box>
                );
              })()}
            </Box>
          )}

          {/* Table Container */}
          <Box sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            backgroundColor: '#fff'
          }}>
            {contactsLoading && processedPeople.length === 0 ? (
              <Box sx={{
                padding: '32px 16px',
                textAlign: 'center',
                color: '#6c757d',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2
              }}>
                <CircularProgress size={40} sx={{ mb: 2 }} />
                <Typography variant="body1">
                  Loading people...
                </Typography>
              </Box>
            ) : processedPeople.length === 0 ? (
              <Box sx={{
                padding: '32px 16px',
                textAlign: 'center',
                color: '#6c757d',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2
              }}>
                <Typography variant="body1">
                  {filters.searchText ? 'No people match your search' : 'No people found'}
                </Typography>
              </Box>
            ) : (
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  fontSize: '0.875rem',
                  backgroundColor: '#fff',
                  tableLayout: 'fixed'
                }}>
                  <colgroup>
                    <col style={{ width: '10%' }} />
                    {!hideColumns.includes('chapter') && <col style={{ width: '5%' }} />}
                    <col style={{ width: '8%' }} />
                    {!hideColumns.includes('organizer') && <col style={{ width: '10%' }} />}
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '44%' }} />
                    <col style={{ width: '7%' }} />
                  </colgroup>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr>
                      <th 
                        onClick={() => handleSort('name')}
                        style={{ 
                          cursor: 'pointer', 
                          fontWeight: 600,
                          backgroundColor: '#fafafa',
                          fontSize: '0.75rem',
                          padding: '4px 16px',
                          textAlign: 'left',
                          borderBottom: '1px solid rgba(224, 224, 224, 1)'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          Name <SortIcon column="name" />
                        </Box>
                      </th>
                      {!hideColumns.includes('chapter') && (
                        <th 
                          onClick={() => handleSort('chapter')}
                          style={{ 
                            cursor: 'pointer',
                            fontWeight: 600,
                            backgroundColor: '#fafafa',
                            fontSize: '0.75rem',
                            padding: '4px 16px',
                            textAlign: 'left',
                            borderBottom: '1px solid rgba(224, 224, 224, 1)'
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            Section <SortIcon column="chapter" />
                          </Box>
                        </th>
                      )}
                      <th
                        onClick={() => handleSort('team')}
                        style={{ 
                          cursor: 'pointer',
                          fontWeight: 600,
                          backgroundColor: '#fafafa',
                          fontSize: '0.75rem',
                          padding: '4px 16px',
                          textAlign: 'left',
                          borderBottom: '1px solid rgba(224, 224, 224, 1)'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          Team <SortIcon column="team" />
                        </Box>
                      </th>
                      {!hideColumns.includes('organizer') && (
                        <th 
                          onClick={() => handleSort('organizers')}
                          style={{ 
                            cursor: 'pointer', 
                            fontWeight: 600,
                            backgroundColor: '#fafafa',
                            fontSize: '0.75rem',
                            padding: '4px 16px',
                            textAlign: 'left',
                            borderBottom: '1px solid rgba(224, 224, 224, 1)'
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            Organizers <SortIcon column="organizers" />
                          </Box>
                        </th>
                      )}
                      <th style={{ 
                        fontWeight: 600,
                        backgroundColor: '#fafafa',
                        fontSize: '0.75rem',
                        padding: '4px 16px',
                        textAlign: 'left',
                        borderBottom: '1px solid rgba(224, 224, 224, 1)'
                      }}>
                        LOE
                      </th>
                      <th 
                        onClick={() => handleSort('mostRecentContact')}
                        style={{ 
                          cursor: 'pointer', 
                          fontWeight: 600,
                          backgroundColor: '#fafafa',
                          fontSize: '0.75rem',
                          padding: '4px 16px',
                          textAlign: 'left',
                          borderBottom: '1px solid rgba(224, 224, 224, 1)'
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          Last Contact <SortIcon column="mostRecentContact" />
                        </Box>
                      </th>
                      <th 
                        onClick={() => handleSort('totalMeetings')}
                        style={{ 
                          cursor: 'pointer', 
                          fontWeight: 600,
                          backgroundColor: '#fafafa',
                          fontSize: '0.75rem',
                          padding: '4px 16px',
                          textAlign: 'left',
                          borderBottom: '1px solid rgba(224, 224, 224, 1)'
                        }}
                      >
                        <Tooltip title="Total one-on-one meetings (all time)">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            One-on-Ones <SortIcon column="totalMeetings" />
                          </Box>
                        </Tooltip>
                      </th>
                      <th style={{ 
                        fontWeight: 600,
                        backgroundColor: '#fafafa',
                        fontSize: '0.75rem',
                        padding: '4px 16px',
                        textAlign: 'left',
                        borderBottom: '1px solid rgba(224, 224, 224, 1)',
                        minWidth: 240,
                      }}>
                        Latest Notes
                      </th>
                      <th style={{ 
                        fontWeight: 600,
                        backgroundColor: '#fafafa',
                        fontSize: '0.7rem',
                        padding: '4px 4px',
                        textAlign: 'center',
                        borderBottom: '1px solid rgba(224, 224, 224, 1)',
                        width: 40,
                        minWidth: 40,
                        maxWidth: 40,
                        whiteSpace: 'nowrap',
                      }}>
                        <Tooltip title="Was a commitment asked in the most recent conversation?">
                          <span>Ask?</span>
                        </Tooltip>
                      </th>
                      <th style={{ 
                        fontWeight: 600,
                        backgroundColor: '#fafafa',
                        fontSize: '0.7rem',
                        padding: '4px 4px',
                        textAlign: 'center',
                        borderBottom: '1px solid rgba(224, 224, 224, 1)',
                        width: 44,
                        minWidth: 44,
                        maxWidth: 44,
                        whiteSpace: 'nowrap',
                      }}>
                        <Tooltip title="Was a commitment made in the most recent conversation?">
                          <span>Made?</span>
                        </Tooltip>
                      </th>
                      <th style={{ 
                        fontWeight: 600,
                        backgroundColor: '#fafafa',
                        fontSize: '0.75rem',
                        padding: '4px 16px',
                        textAlign: 'center',
                        borderBottom: '1px solid rgba(224, 224, 224, 1)'
                      }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {contactsLoading && processedPeople.length === 0 ? (
                      // Loading skeleton rows
                      Array.from({ length: 10 }).map((_, index) => (
                        <tr key={`skeleton-${index}`}>
                          <td style={{ padding: '6px 16px', borderBottom: '1px solid rgba(224, 224, 224, 1)' }}>
                            <Skeleton animation="wave" width="80%" />
                          </td>
                          {!hideColumns.includes('chapter') && (
                            <td style={{ padding: '6px 16px', borderBottom: '1px solid rgba(224, 224, 224, 1)' }}>
                              <Skeleton animation="wave" width="12px" height="12px" variant="circular" />
                            </td>
                          )}
                          {!hideColumns.includes('organizer') && (
                            <td style={{ padding: '6px 16px', borderBottom: '1px solid rgba(224, 224, 224, 1)' }}>
                              <Skeleton animation="wave" width="70%" />
                            </td>
                          )}
                          <td style={{ padding: '6px 16px', borderBottom: '1px solid rgba(224, 224, 224, 1)' }}>
                            <Skeleton animation="wave" width="60%" />
                          </td>
                          <td style={{ padding: '6px 16px', borderBottom: '1px solid rgba(224, 224, 224, 1)' }}>
                            <Skeleton animation="wave" width="50%" />
                          </td>
                          <td style={{ padding: '6px 16px', borderBottom: '1px solid rgba(224, 224, 224, 1)' }}>
                            <Skeleton animation="wave" width="70%" />
                          </td>
                          <td style={{ padding: '6px 16px', borderBottom: '1px solid rgba(224, 224, 224, 1)' }}>
                            <Skeleton animation="wave" width="70%" />
                          </td>
                          <td style={{ padding: '6px 16px', borderBottom: '1px solid rgba(224, 224, 224, 1)' }}>
                            <Skeleton animation="wave" width="30%" />
                          </td>
                          <td style={{ padding: '6px 16px', borderBottom: '1px solid rgba(224, 224, 224, 1)' }}>
                            <Skeleton animation="wave" width="100%" />
                          </td>
                          <td style={{ padding: '6px 16px', borderBottom: '1px solid rgba(224, 224, 224, 1)' }}>
                            <Skeleton animation="wave" width="40px" />
                          </td>
                        </tr>
                      ))
                    ) : processedPeople.map((person) => (
                      <tr 
                        key={person.id}
                        onClick={() => handlePersonClick(person)}
                        style={{ 
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {/* Name */}
                        <td style={{ padding: '6px 16px', fontSize: '0.8rem', borderBottom: '1px solid rgba(224, 224, 224, 1)' }}>
                          <PersonChip
                            name={person.name}
                            vanId={person.id}
                            allMappings={organizerMappings}
                            onFilterBy={(name) => {
                              // Filter by this person's name in search
                              handleFilterChange('searchText', name);
                            }}
                            onEditMapping={onEditOrganizerMapping}
                            onViewDetails={() => handlePersonClick(person)}
                            size="small"
                            variant="outlined"
                          />
                        </td>
                        
                        {/* Section - clickable pill to filter by section */}
                        {!hideColumns.includes('chapter') && (
                          <td
                            onClick={(e) => e.stopPropagation()}
                            style={{ padding: '6px 16px', borderBottom: '1px solid rgba(224, 224, 224, 1)', fontSize: '0.75rem' }}
                          >
                            {(() => {
                              const sectionVal = person.chapter;
                              const isUnset = !sectionVal || sectionVal === 'Unknown';
                              const color = isUnset ? '#9ca3af' : getCustomChapterColor(sectionVal, customColors);
                              const isActive = !isUnset && filters.chapter === sectionVal;
                              return (
                                <Tooltip
                                  title={isUnset ? '' : isActive ? 'Click to clear section filter' : `Filter by "${sectionVal}"`}
                                  placement="top"
                                >
                                  <span
                                    onClick={(e) => {
                                      if (isUnset) return;
                                      e.stopPropagation();
                                      handleFilterChange('chapter', isActive ? '' : sectionVal);
                                    }}
                                    style={{
                                      display: 'inline-block',
                                      padding: '2px 8px',
                                      borderRadius: '12px',
                                      fontSize: '0.65rem',
                                      fontWeight: 600,
                                      cursor: isUnset ? 'default' : 'pointer',
                                      backgroundColor: isActive ? color : (isUnset ? '#f3f4f6' : `${color}18`),
                                      color: isActive ? '#fff' : (isUnset ? '#9ca3af' : color),
                                      border: `1px solid ${isUnset ? '#e5e7eb' : `${color}55`}`,
                                      letterSpacing: '0.01em',
                                      transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => {
                                      if (!isUnset && !isActive) {
                                        e.currentTarget.style.backgroundColor = color;
                                        e.currentTarget.style.color = '#fff';
                                      }
                                    }}
                                    onMouseLeave={e => {
                                      if (!isUnset && !isActive) {
                                        e.currentTarget.style.backgroundColor = `${color}18`;
                                        e.currentTarget.style.color = color;
                                      }
                                    }}
                                  >
                                    {isUnset ? '—' : sectionVal}
                                  </span>
                                </Tooltip>
                              );
                            })()}
                          </td>
                        )}
                        
                        {/* Team */}
                        {(() => {
                          const teams = personToTeams.get(person.id) || [];
                          return (
                            <td
                              onClick={(e) => e.stopPropagation()}
                              style={{ padding: '6px 16px', borderBottom: '1px solid rgba(224, 224, 224, 1)' }}
                            >
                              {teams.length > 0 ? (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                  {teams.map(teamName => {
                                    const isActive = filters.team === teamName;
                                    return (
                                      <Tooltip key={teamName} title={isActive ? 'Click to clear team filter' : `Filter by "${teamName}"`} placement="top">
                                        <span
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleFilterChange('team', isActive ? '' : teamName);
                                          }}
                                          style={{
                                            display: 'inline-block',
                                            padding: '2px 7px',
                                            borderRadius: '12px',
                                            fontSize: '0.65rem',
                                            fontWeight: 600,
                                            backgroundColor: isActive ? '#3b5bdb' : '#f0f4ff',
                                            color: isActive ? '#fff' : '#3b5bdb',
                                            border: `1px solid ${isActive ? '#3b5bdb' : '#c5d0fc'}`,
                                            whiteSpace: 'nowrap',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s',
                                          }}
                                          onMouseEnter={e => {
                                            if (!isActive) {
                                              e.currentTarget.style.backgroundColor = '#3b5bdb';
                                              e.currentTarget.style.color = '#fff';
                                            }
                                          }}
                                          onMouseLeave={e => {
                                            if (!isActive) {
                                              e.currentTarget.style.backgroundColor = '#f0f4ff';
                                              e.currentTarget.style.color = '#3b5bdb';
                                            }
                                          }}
                                        >
                                          {teamName}
                                        </span>
                                      </Tooltip>
                                    );
                                  })}
                                </Box>
                              ) : (
                                <span style={{ color: '#d1d5db', fontSize: '0.75rem' }}>—</span>
                              )}
                            </td>
                          );
                        })()}

                        {/* Organizers */}
                        {!hideColumns.includes('organizer') && (
                          <td style={{ padding: '6px 16px', fontSize: '0.75rem', borderBottom: '1px solid rgba(224, 224, 224, 1)' }}>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                              {person.organizers.map((organizerName: string, idx: number) => {
                                const meeting = person.allMeetings?.find(m => {
                                  const meetingOrgName = m.organizer || 
                                    `${m.organizer_first_name || m.organizer_firstname || ''} ${m.organizer_last_name || m.organizer_lastname || ''}`.trim();
                                  return meetingOrgName === organizerName;
                                });
                                let organizerVanId = meeting?.organizer_vanid?.toString();
                                // Also check assigned organizers for vanId
                                if (!organizerVanId) {
                                  const assigned = contactOrganizerMap?.get(person.id);
                                  const match = assigned?.find(a => a.name === organizerName);
                                  if (match) organizerVanId = match.organizer_vanid;
                                }
                                
                                return (
                                  <OrganizerChip
                                    key={idx}
                                    name={organizerName}
                                    vanId={organizerVanId}
                                    contactVanId={person.id}
                                    size="small"
                                    onFilterBy={onFilterByOrganizer}
                                    onEditMapping={onEditOrganizerMapping}
                                    onViewDetails={handleViewOrganizerDetails}
                                    onRemoveOrganizer={onRemoveOrganizer}
                                  />
                                );
                              })}
                              {onAddOrganizer && (
                                <Chip
                                  icon={<PersonAddIcon sx={{ fontSize: '0.85rem !important' }} />}
                                  label={person.organizers.length === 0 ? 'Add' : ''}
                                  size="small"
                                  variant="outlined"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAddOrganizer(person.id, person.name);
                                  }}
                                  sx={{
                                    height: 22,
                                    fontSize: '0.65rem',
                                    borderStyle: 'dashed',
                                    color: 'text.secondary',
                                    cursor: 'pointer',
                                    '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
                                    ...(person.organizers.length > 0 ? { 
                                      '& .MuiChip-label': { display: 'none' },
                                      '& .MuiChip-icon': { mx: 0 },
                                      px: 0, minWidth: 24
                                    } : {})
                                  }}
                                />
                              )}
                              {!onAddOrganizer && person.organizers.length === 0 && (
                                <span style={{ color: '#999' }}>-</span>
                              )}
                            </Box>
                          </td>
                        )}
                        
                        {/* LOE Status — inline editable */}
                        {(() => {
                          const LOE_OPTIONS = ['Leader', 'Potential Leader', 'Supporter', 'Unknown'];
                          const currentLoe = loeOverrides[person.id] ?? person.loeStatus ?? '';
                          const displayLoe = currentLoe.replace(/^\d+[_.]/, '');
                          const loeColors = getLOEColor(currentLoe);
                          const isUnset = !currentLoe || currentLoe === 'Unknown';
                          return (
                            <td
                              onClick={(e) => e.stopPropagation()}
                              style={{ padding: '6px 16px', fontSize: '0.75rem', borderBottom: '1px solid rgba(224, 224, 224, 1)' }}
                            >
                              {editingLoeId === person.id ? (
                                <select
                                  autoFocus
                                  value={currentLoe}
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onChange={async (e) => {
                                    e.stopPropagation();
                                    const newLoe = e.target.value;
                                    setLoeOverrides(prev => ({ ...prev, [person.id]: newLoe }));
                                    setEditingLoeId(null);
                                    try {
                                      await fetch(`/api/contacts/${encodeURIComponent(person.id)}/loe`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ loe: newLoe }),
                                      });
                                    } catch (err) {
                                      console.error('Failed to update LOE:', err);
                                    }
                                  }}
                                  onBlur={() => setEditingLoeId(null)}
                                  style={{
                                    fontSize: '0.75rem',
                                    border: '1px solid #bbb',
                                    borderRadius: 4,
                                    padding: '2px 4px',
                                    background: '#fff',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <option value="">— none —</option>
                                  {LOE_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLoeMenuAnchorEl(e.currentTarget);
                                    setLoeMenuPersonId(person.id);
                                    setLoeMenuCurrentLoe(currentLoe);
                                  }}
                                  title="Click for options"
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '0.65rem',
                                    fontWeight: 'bold',
                                    backgroundColor: isUnset ? '#f3f4f6' : loeColors.backgroundColor,
                                    color: isUnset ? '#9ca3af' : loeColors.color,
                                    border: `1px solid ${isUnset ? '#d1d5db' : loeColors.color}`,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    minWidth: 40,
                                    textAlign: 'center',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isUnset) {
                                      e.currentTarget.style.backgroundColor = loeColors.color;
                                      e.currentTarget.style.color = 'white';
                                    }
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = isUnset ? '#f3f4f6' : loeColors.backgroundColor;
                                    e.currentTarget.style.color = isUnset ? '#9ca3af' : loeColors.color;
                                    e.currentTarget.style.transform = 'scale(1)';
                                  }}
                                >
                                  {isUnset ? '—' : displayLoe}
                                </span>
                              )}
                            </td>
                          );
                        })()}
                        
                        {/* Last Contact - Black, Smaller - Use API data */}
                        <td style={{ padding: '6px 16px', fontSize: '0.75rem', borderBottom: '1px solid rgba(224, 224, 224, 1)' }}>
                          {person.mostRecentContactAllTime || person.mostRecentContact
                            ? format(person.mostRecentContactAllTime || person.mostRecentContact!, 'M/d/yy')
                            : 'Never'
                          }
                        </td>
                        
                        {/* Meetings - Just Number - Use API data (all time) */}
                        <td style={{ padding: '6px 16px', fontSize: '0.75rem', textAlign: 'center', borderBottom: '1px solid rgba(224, 224, 224, 1)' }}>
                          {person.totalMeetingsAllTime || person.totalMeetings || 0}
                        </td>
                        
                        {/* Latest Notes */}
                        <td style={{ 
                          padding: '6px 16px',
                          minWidth: 240,
                          fontSize: '0.7rem',
                          color: 'rgba(0, 0, 0, 0.6)',
                          borderBottom: '1px solid rgba(224, 224, 224, 1)',
                          wordWrap: 'break-word',
                          whiteSpace: 'normal'
                        }}>
                          {(() => {
                            if (!person.latestNotes) return '-';
                            const latestMeeting = [...(person.allMeetings || [])].sort((a, b) => {
                              const aD = (typeof a.date_contacted === 'object' ? a.date_contacted?.value : a.date_contacted) || '';
                              const bD = (typeof b.date_contacted === 'object' ? b.date_contacted?.value : b.date_contacted) || '';
                              return bD.localeCompare(aD);
                            })[0];
                            if (latestMeeting && !canSeeNotesForOrganizer(latestMeeting.organizer_vanid)) {
                              return <span style={{ fontStyle: 'italic', color: '#9e9e9e' }}>Team only</span>;
                            }
                            return person.latestNotes;
                          })()}
                        </td>

                        {/* Commitment Asked */}
                        <td
                          onClick={(e) => e.stopPropagation()}
                          style={{ padding: '4px 4px', width: 40, minWidth: 40, maxWidth: 40, textAlign: 'center', borderBottom: '1px solid rgba(224, 224, 224, 1)' }}
                        >
                          {person.latestCommitmentAsked ? (() => {
                            const val = person.latestCommitmentAsked as 'yes' | 'no';
                            const isActive = filters.commitmentAsked === val;
                            const isYes = val === 'yes';
                            return (
                              <Tooltip title={isActive ? 'Clear filter' : `Filter: commitment asked = ${val}`} placement="top">
                                <span
                                  onClick={(e) => { e.stopPropagation(); handleFilterChange('commitmentAsked', isActive ? '' : val); }}
                                  style={{
                                    display: 'inline-block',
                                    padding: '1px 5px',
                                    borderRadius: 8,
                                    fontSize: '0.6rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    backgroundColor: isActive ? (isYes ? '#2e7d32' : '#616161') : (isYes ? '#c8e6c9' : '#e0e0e0'),
                                    color: isActive ? '#fff' : (isYes ? '#1b5e20' : '#616161'),
                                    transition: 'all 0.15s',
                                  }}
                                >
                                  {isYes ? '✓' : '✗'}
                                </span>
                              </Tooltip>
                            );
                          })() : <span style={{ color: 'rgba(0,0,0,0.25)', fontSize: '0.7rem' }}>—</span>}
                        </td>

                        {/* Commitment Made */}
                        <td
                          onClick={(e) => e.stopPropagation()}
                          style={{ padding: '4px 4px', width: 44, minWidth: 44, maxWidth: 44, textAlign: 'center', borderBottom: '1px solid rgba(224, 224, 224, 1)' }}
                        >
                          {person.latestCommitmentMade ? (() => {
                            const val = person.latestCommitmentMade as 'yes' | 'no';
                            const isActive = filters.commitmentMade === val;
                            const isYes = val === 'yes';
                            return (
                              <Tooltip title={isActive ? 'Clear filter' : `Filter: commitment made = ${val}`} placement="top">
                                <span
                                  onClick={(e) => { e.stopPropagation(); handleFilterChange('commitmentMade', isActive ? '' : val); }}
                                  style={{
                                    display: 'inline-block',
                                    padding: '1px 5px',
                                    borderRadius: 8,
                                    fontSize: '0.6rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    backgroundColor: isActive ? (isYes ? '#2e7d32' : '#616161') : (isYes ? '#c8e6c9' : '#e0e0e0'),
                                    color: isActive ? '#fff' : (isYes ? '#1b5e20' : '#616161'),
                                    transition: 'all 0.15s',
                                  }}
                                >
                                  {isYes ? '✓' : '✗'}
                                </span>
                              </Tooltip>
                            );
                          })() : <span style={{ color: 'rgba(0,0,0,0.25)', fontSize: '0.7rem' }}>—</span>}
                        </td>
                        
                        {/* Actions - Show chips for all actions person is involved with */}
                        <td 
                          style={{ padding: '6px 16px', borderBottom: '1px solid rgba(224, 224, 224, 1)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                            {(() => {
                              // Check status for ALL actions (not just selected ones)
                              const actionStatuses = ACTIONS.map(action => {
                                const actionId = action.id;
                                
                                // Check if completed (e.g., signed pledge)
                                const isCompleted = actionId === 'sign_pledge' ? hasSignedPledge(person.id) : false;
                                const onList = isOnList(person.id, actionId);
                                
                                // Only show if person is involved with this action
                                if (!isCompleted && !onList) return null;
                                
                                return {
                                  actionId,
                                  actionName: action.name,
                                  isCompleted,
                                  onList
                                };
                              }).filter(Boolean);
                              
                              // Show span chips for all actions person is involved with
                              const actionElements = actionStatuses.map(status => {
                                if (!status) return null;
                                const targetStatus = status.isCompleted ? 'completed' : 'onList';
                                const isActive = filters.actionStatus === targetStatus;
                                return (
                                  <Tooltip
                                    key={status.actionId}
                                    title={isActive ? 'Clear action filter' : `Filter by "${status.actionName}"`}
                                    placement="top"
                                  >
                                    <span
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleFilterChange('actionStatus', isActive ? 'all' : targetStatus);
                                      }}
                                      style={{
                                        display: 'inline-block',
                                        padding: '2px 7px',
                                        borderRadius: 12,
                                        fontSize: '0.65rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.15s',
                                        backgroundColor: isActive
                                          ? (status.isCompleted ? '#2e7d32' : '#1565c0')
                                          : (status.isCompleted ? '#c8e6c9' : '#e3f2fd'),
                                        color: isActive
                                          ? '#fff'
                                          : (status.isCompleted ? '#1b5e20' : '#1565c0'),
                                        border: `1px solid ${status.isCompleted ? '#a5d6a7' : '#90caf9'}`,
                                      }}
                                    >
                                      {status.actionName}
                                    </span>
                                  </Tooltip>
                                );
                              });
                              
                              // Always show plus button to add more actions
                              return (
                                <>
                                  {actionElements}
                                  <Tooltip title="Add to action list">
                                    <IconButton
                                      size="small"
                                      onClick={(e) => handleOpenActionMenu(e, person.id, person.name)}
                                      sx={{ 
                                        p: 0.25,
                                        color: '#1976d2',
                                        '&:hover': { 
                                          bgcolor: '#e3f2fd',
                                          color: '#1565c0'
                                        }
                                      }}
                                    >
                                      <AddIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                  </Tooltip>
                                </>
                              );
                            })()}
                          </Box>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Load More Button */}
            {(displayLimit < filteredContacts.length) && (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                p: 2, 
                borderTop: '1px solid #e0e0e0',
                backgroundColor: '#fafafa'
              }}>
                <Button
                  variant="outlined"
                  onClick={handleLoadMore}
                  sx={{ minWidth: 200 }}
                >
                  Load More
                </Button>
              </Box>
            )}
          </Box>

      {/* PersonDetailsDialog */}
      <PersonDetailsDialog
        open={dialogOpen} 
        onClose={handleCloseDialog} 
        person={selectedPerson}
        userMap={userMap}
        orgIds={orgIds}
        pledgeSubmissions={pledgeSubmissions}
        cachedMeetings={cachedMeetings}
        allContacts={sharedAllContacts}
        onEditPerson={onEditPerson}
        onSavePerson={onSavePerson}
        availableChapters={availableSections}
        availableOrganizers={availableOrganizers}
        onAddConversation={onAddConversation}
        onAddToAction={onAddToAction}
        onEditConversation={onEditConversation}
        onDeleteConversation={onDeleteConversation}
        onDeletePerson={onDeletePerson}
        canSeeNotesForOrganizer={canSeeNotesForOrganizer}
      />

      {/* OrganizerDetailsDialog */}
      <OrganizerDetailsDialog
        open={organizerDialogOpen}
        onClose={handleCloseOrganizerDialog}
        organizerName={selectedOrganizerName}
        organizerVanId={selectedOrganizerVanId}
        cachedMeetings={cachedMeetings}
        userMap={userMap}
        allContacts={sharedAllContacts}
      />

      {/* Add Connection Dialog */}
      <AddConnectionDialog
        open={addConnectionDialogOpen}
        onClose={() => setAddConnectionDialogOpen(false)}
        onSave={handleAddConnection}
        orgIds={orgIds}
        meetings={meetings}
      />
      
      {/* Add to Action List Dialog */}
      <Dialog
        open={actionDialogOpen}
        onClose={handleCloseActionDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>Add to Action List</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Person</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {personForActionMenu?.name || ''}
              </Typography>
            </Box>

            <FormControl fullWidth size="small">
              <InputLabel>Action List</InputLabel>
              <Select
                value={selectedActionId}
                onChange={(e) => setSelectedActionId(e.target.value)}
                label="Action List"
              >
                {actions
                  .filter((action: any) => action.status === 'live')
                  .map((action: any) => (
                    <MenuItem key={action.action_id} value={action.action_id}>
                      {action.action_name}
                    </MenuItem>
                  ))
                }
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Organizer (whose list)</InputLabel>
              <Select
                value={dialogOrganizerId}
                onChange={(e) => {
                  const orgId = e.target.value;
                  setDialogOrganizerId(orgId);
                  const org = availableOrganizers.find(o => o.id === orgId);
                  setDialogOrganizerName(org ? org.name : '');
                }}
                label="Organizer (whose list)"
              >
                {availableOrganizers.map((org) => (
                  <MenuItem key={org.id} value={org.id}>
                    {org.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseActionDialog}>Cancel</Button>
          <Button
            onClick={handleConfirmAddToAction}
            variant="contained"
            disabled={!selectedActionId || !dialogOrganizerId}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Filter Dialog */}
      <Dialog open={filterOpen} onClose={() => setFilterOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Filter People</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {/* Search Text */}
            <TextField
              label="Search all fields"
              value={filters.searchText}
              onChange={(e) => handleFilterChange('searchText', e.target.value)}
              placeholder="Search names, chapters, organizers, notes..."
              fullWidth
              size="small"
            />

            {/* Name and Chapter filters */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Organizer name"
                value={filters.organizer}
                onChange={(e) => handleFilterChange('organizer', e.target.value)}
                placeholder="Filter by organizer name"
                fullWidth
                size="small"
              />
              <TextField
                label="Chapter"
                value={filters.chapter}
                onChange={(e) => handleFilterChange('chapter', e.target.value)}
                placeholder="Filter by chapter"
                fullWidth
                size="small"
              />
            </Box>

            {/* LOE Status (Multi-Select) */}
            <FormControl fullWidth size="small">
              <InputLabel>LOE Status</InputLabel>
              <Select
                multiple
                value={filters.loeStatus}
                onChange={(e) => handleFilterChange('loeStatus', e.target.value as string[])}
                input={<OutlinedInput label="LOE Status" />}
                renderValue={(selected) => (selected as string[]).join(', ')}
              >
                {LOE_LEVELS.map((loe) => (
                  <MenuItem key={loe.key} value={loe.label}>
                    <Checkbox checked={filters.loeStatus.includes(loe.label)} />
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: loe.color,
                        mr: 1
                      }}
                    />
                    <ListItemText primary={loe.label} />
                  </MenuItem>
                ))}
                <MenuItem value="Staff">
                  <Checkbox checked={filters.loeStatus.includes('Staff')} />
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#4a148c', mr: 1 }} />
                  <ListItemText primary="Staff" />
                </MenuItem>
                <MenuItem value="Unknown">
                  <Checkbox checked={filters.loeStatus.includes('Unknown')} />
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#616161', mr: 1 }} />
                  <ListItemText primary="Unknown" />
                </MenuItem>
              </Select>
            </FormControl>

            {/* Last Contact Filter */}
            <FormControl fullWidth size="small">
              <InputLabel>Last Contact</InputLabel>
              <Select
                value={filters.lastContactFilter}
                onChange={(e) => handleFilterChange('lastContactFilter', e.target.value as LastContactFilter)}
                label="Last Contact"
              >
                <MenuItem value="all">All (no filter)</MenuItem>
                <MenuItem value="within_7_days">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#4caf50' }} />
                    Within 7 days
                  </Box>
                </MenuItem>
                <MenuItem value="within_14_days">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#66bb6a' }} />
                    Within 2 weeks
                  </Box>
                </MenuItem>
                <MenuItem value="within_30_days">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#8bc34a' }} />
                    Within 30 days
                  </Box>
                </MenuItem>
                <MenuItem value="within_3_months">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#cddc39' }} />
                    Within 3 months
                  </Box>
                </MenuItem>
                <MenuItem value="over_30_days">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ff9800' }} />
                    30+ days ago (or never)
                  </Box>
                </MenuItem>
                <MenuItem value="over_3_months">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#f44336' }} />
                    3+ months ago (or never)
                  </Box>
                </MenuItem>
                <MenuItem value="over_6_months">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#9c27b0' }} />
                    6+ months ago (or never)
                  </Box>
                </MenuItem>
                <MenuItem value="never">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#607d8b' }} />
                    Never contacted
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            {/* Membership Status Filter (Multi-Select) */}
            <FormControl fullWidth size="small">
              <InputLabel>Membership Status</InputLabel>
              <Select
                multiple
                value={filters.memberStatus}
                onChange={(e) => handleFilterChange('memberStatus', e.target.value as string[])}
                input={<OutlinedInput label="Membership Status" />}
                renderValue={(selected) => {
                  const selectedArr = selected as string[];
                  return selectedArr.map(val => {
                    if (val === 'null') return 'No Status';
                    const option = membershipStatusOptions.find(o => o.value === val);
                    return option?.label || val;
                  }).join(', ');
                }}
              >
                {membershipStatusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Checkbox checked={filters.memberStatus.includes(option.value)} />
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: option.color,
                        mr: 1
                      }}
                    />
                    <ListItemText primary={option.label} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* One-on-One Meeting Count Filter */}
            <FormControl fullWidth size="small">
              <InputLabel>One-on-One Meetings</InputLabel>
              <Select
                value={filters.meetingCountFilter}
                onChange={(e) => handleFilterChange('meetingCountFilter', e.target.value as 'all' | 'zero' | 'hasAny')}
                label="One-on-One Meetings"
              >
                <MenuItem value="all">All (no filter)</MenuItem>
                <MenuItem value="zero">No meetings (0)</MenuItem>
                <MenuItem value="hasAny">Has meetings (1+)</MenuItem>
              </Select>
            </FormControl>

            {/* Action Status Filter */}
            {selectedActions && selectedActions.length > 0 && (
              <FormControl fullWidth size="small">
                <InputLabel>Action Status</InputLabel>
                <Select
                  value={filters.actionStatus}
                  onChange={(e) => handleFilterChange('actionStatus', e.target.value as 'all' | 'completed' | 'onList' | 'notOnList')}
                  label="Action Status"
                >
                  <MenuItem value="all">All (no filter)</MenuItem>
                  <MenuItem value="completed">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon sx={{ fontSize: 16, color: '#4caf50' }} />
                      Completed
                    </Box>
                  </MenuItem>
                  <MenuItem value="onList">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleOutlineIcon sx={{ fontSize: 16, color: '#1976d2' }} />
                      On List (Not Completed)
                    </Box>
                  </MenuItem>
                  <MenuItem value="notOnList">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      Not on Any List
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            )}

            {/* Active Filters Display */}
            {getActiveFiltersCount() > 0 && (
              <Box sx={{ 
                mt: 2, 
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
                  {filters.loeStatus.map(status => (
                    <Chip 
                      key={`loe-${status}`}
                      label={`LOE: ${status}`} 
                      size="small" 
                      onDelete={() => handleFilterChange('loeStatus', filters.loeStatus.filter(s => s !== status))}
                    />
                  ))}
                  {filters.memberStatus.map(status => (
                    <Chip 
                      key={`member-${status}`}
                      label={`Membership: ${status === 'null' ? 'No Status' : status}`} 
                      size="small" 
                      onDelete={() => handleFilterChange('memberStatus', filters.memberStatus.filter(s => s !== status))}
                    />
                  ))}
                  {filters.lastContactFilter !== 'all' && (
                    <Chip 
                      label={`Last Contact: ${getLastContactFilterLabel(filters.lastContactFilter)}`} 
                      size="small" 
                      onDelete={() => handleFilterChange('lastContactFilter', 'all')}
                    />
                  )}
                  {filters.meetingCountFilter !== 'all' && (
                    <Chip 
                      label={`One-on-Ones: ${getMeetingCountFilterLabel(filters.meetingCountFilter)}`} 
                      size="small" 
                      onDelete={() => handleFilterChange('meetingCountFilter', 'all')}
                    />
                  )}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClearFilters} color="inherit">
            Clear All
          </Button>
          <Button onClick={() => setFilterOpen(false)} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Batch Add People Dialog */}
      <BatchAddPeopleDialog
        open={showBatchAddDialog}
        onClose={() => setShowBatchAddDialog(false)}
        onSaved={(_count) => setShowBatchAddDialog(false)}
        availableSections={availableSections}
        availableOrganizers={dialogOrganizers}
        availableActions={ACTIONS}
        currentUserId={currentUserId}
      />

      {/* Log Conversation Dialog */}
      <LogConversationDialog
        open={showLogConversationDialog}
        onClose={() => setShowLogConversationDialog(false)}
        onSave={handleLogConversation}
        availableContacts={dialogContacts}
        currentUserVanId={currentUserId}
        availableChapters={availableSections}
        availableOrganizers={dialogOrganizers}
      />

      {/* LOE chip context menu */}
      <Menu
        anchorEl={loeMenuAnchorEl}
        open={Boolean(loeMenuAnchorEl)}
        onClose={() => { setLoeMenuAnchorEl(null); setLoeMenuPersonId(null); }}
        onClick={(e) => e.stopPropagation()}
        disableRestoreFocus
        PaperProps={{ sx: { minWidth: 180, borderRadius: 2, boxShadow: 3 } }}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
      >
        {loeMenuCurrentLoe && loeMenuCurrentLoe !== 'Unknown' && (
          <MenuItem
            dense
            onClick={(e) => {
              e.stopPropagation();
              handleFilterChange('loeStatus', [loeMenuCurrentLoe]);
              setLoeMenuAnchorEl(null);
              setLoeMenuPersonId(null);
            }}
          >
            <ListItemIcon><FilterListIcon fontSize="small" /></ListItemIcon>
            <ListItemText
              primary={`Filter by "${loeMenuCurrentLoe.replace(/^\d+[_.]/, '')}"`}
              primaryTypographyProps={{ fontSize: '0.8rem' }}
            />
          </MenuItem>
        )}
        {loeMenuCurrentLoe && loeMenuCurrentLoe !== 'Unknown' && <Divider />}
        <MenuItem
          dense
          onClick={(e) => {
            e.stopPropagation();
            const personId = loeMenuPersonId;
            setLoeMenuAnchorEl(null);
            setLoeMenuPersonId(null);
            setTimeout(() => {
              if (personId) setEditingLoeId(personId);
            }, 150);
          }}
        >
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText
            primary="Edit LOE"
            primaryTypographyProps={{ fontSize: '0.8rem' }}
          />
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default PeoplePanel;