import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format, subMonths } from 'date-fns';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Checkbox,
  Chip,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  useTheme,
  Tabs,
  Tab,
  TextField,
  ListItemText,
  Tooltip
} from '@mui/material';
import { 

  Timeline as TimelineIcon,
  AccountTree as SnowflakeIcon,
  Flag as GoalsIcon,
  Campaign as CampaignIcon,
  Close as CloseIcon,
  People as PeopleIcon,
  Groups as TeamsIcon,
  Dashboard as DashboardIcon,
  BarChart as BarChartIcon,
  ViewKanban as ViewKanbanIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';

// Configuration
import { TERMS, BRANDING } from '../config/appConfig';

// API and services
import { fetchChapters, fetchOrgIds, fetchMeetings, fetchCurrentUserInfo, fetchContacts, fetchMeetingsByContacts, fetchLOECounts, fetchActions, fetchLeaderHierarchy, fetchLists, fetchAllLists, fetchOrganizerGoals, fetchCampaigns, createCampaign, updateCampaign, deleteCampaign, ActionDefinition, fetchAllContactOrganizers, addContactOrganizer, removeContactOrganizer, fetchSections, SectionLead } from '../services/api';
import { teamsService } from '../services/teamsService';
import { getOrganizerMappings, OrganizerMapping, getCanonicalOrganizerName, mergePeople } from '../services/organizerMappingService';
import { API_BASE_URL } from '../config';

// Components
import AppLayout from './layout/AppLayout';
import NetworkGraph from './visualizations/NetworkGraph';
import GoalsVisualization from './visualizations/GoalsVisualization';
import CampaignLineGraph from './visualizations/CampaignLineGraph';
import LeadershipKanban from './visualizations/LeadershipKanban';
import Dashboard from './visualizations/Dashboard';
import PeoplePanel from './panels/PeoplePanel';
import TeamsPanel from './panels/TeamsPanel';
// import NotesPanel from './panels/NotesPanel'; // TODO: Being consolidated into People panel
import CampaignPanel from './panels/CampaignPanel';
import DateRangePicker from './ui/DateRangePicker';
import PersonDetailsDialog, { PersonUpdate } from './dialogs/PersonDetailsDialog';
import AssignOrganizerDialog from './dialogs/AssignOrganizerDialog';
import { EditOrganizerMappingDialog } from './dialogs/EditOrganizerMappingDialog';
import UnifiedFilter, { FilterState } from './ui/UnifiedFilter';
import { useMobile } from '../hooks/useMobile';
import { useURLRouting, ViewModeType } from '../hooks/useURLRouting';
import { useNetworkData } from '../hooks/useNetworkData';
import { ConversationGoal } from './dialogs/ConversationGoalsDialog';
import { ParentCampaign, CampaignGoalType, CampaignMilestone } from './dialogs/ParentCampaignDialog';

// Mobile components
import MobileNavigation from './mobile/MobileNavigation';
import MobileVisualizationView from './mobile/MobileVisualizationView';
import MobileDateRangePicker from './mobile/MobileDateRangePicker';

// Theme
import { getChapterColor } from '../theme/chapterColors';
import { LOE_LEVELS, SPECIAL_LOE_COLORS, getLOEColor } from '../theme/loeColors';
import { extractLOELevelsFromMeetings, parseLOEValue, getLOEColor as getDynamicLOEColor, type DynamicLOELevel } from '../theme/dynamicLoeColors';
import { ChapterColorProvider, useChapterColors } from '../contexts/ChapterColorContext';

// Types
import { 
  GraphNode as Node, 
  CampaignAction,
  CampaignEvent, 
  GraphLink, 
  VisualizationType, 
  RightPanelViewType 
} from '../types';

// Constants
// Campaigns now loaded from API, not hard-coded
const DEFAULT_SELECTED_CAMPAIGNS: string[] = [];

// Helper function to transform API campaign data to ParentCampaign format
const transformCampaignFromAPI = (campaign: any): ParentCampaign => ({
  id: campaign.id,
  name: campaign.name,
  description: campaign.description,
  startDate: campaign.startDate,
  endDate: campaign.endDate,
  chapters: campaign.chapters,
  teams: campaign.teams || [],
  parentCampaignId: campaign.parentCampaignId,
  campaignType: (campaign.campaignType as 'standalone' | 'parent' | 'child' | 'phase' | undefined) || 'parent',
  createdDate: campaign.createdDate,
  goalTypes: campaign.goalTypes,
  milestones: campaign.milestones
});

const MainAppContent: React.FC<{ authUser?: import('../services/auth').AuthUser; onLogout?: () => void }> = ({ authUser, onLogout }) => {
  const theme = useTheme();
  const { customColors } = useChapterColors();
  const isMobile = useMobile();
  
  // URL routing
  const { 
    viewMode,
    currentVisualization, 
    networkView, 
    setNetworkView,
    selectedActions: urlSelectedActions,
    urlFilters,
    updateURL,
    handleViewModeChange,
    handleVisualizationChange,
    handleSelectedActionsChange,
    handleFiltersChange: handleURLFiltersChange
  } = useURLRouting();

  // Core app state
  // Map visualization to panel view
  const getPanelViewFromVisualization = (viz: VisualizationType): RightPanelViewType => {
    switch (viz) {
      case 'people': return 'people'; // Not used - People view hides right panel
      case 'teams': return 'teams';
      case 'campaign': return 'campaigns';
      default: return 'meetings';
    }
  };
  
  const rightPanelView = getPanelViewFromVisualization(currentVisualization);
  
  // Network date range (for Teams view)
  const [networkStartDate, setNetworkStartDate] = useState<string>(() => {
    const threeMonthsAgo = subMonths(new Date(), 3);
    return format(threeMonthsAgo, 'yyyy-MM-dd');
  });
  const [networkEndDate, setNetworkEndDate] = useState<string>(() => {
    return format(new Date(), 'yyyy-MM-dd');
  });
  
  // Unified filter state - adapts to current view
  // Initialize from URL if available
  const [unifiedFilters, setUnifiedFilters] = useState<FilterState>({
    searchText: urlFilters.searchText || '',
    chapter: urlFilters.chapter || '',
    organizer: urlFilters.organizer || '',
    loeStatus: urlFilters.loeStatus || [],
    memberStatus: urlFilters.memberStatus || [],
    lastContactFilter: urlFilters.lastContactFilter || 'all',
    meetingCountFilter: urlFilters.meetingCountFilter || 'all',
    actionStatus: urlFilters.actionStatus || 'all',
    teamType: '',
    goalType: [],
    dateRange: { start: null, end: null }
  });
  
  // Sync filters to URL when they change
  useEffect(() => {
    handleURLFiltersChange(unifiedFilters);
  }, [unifiedFilters]); // Removed handleURLFiltersChange to prevent infinite loop
  
  // Sync filters FROM URL when URL changes (for back/forward navigation or direct URL updates)
  // For People view, chapter comes from URL (managed by PeoplePanel), not from global state
  useEffect(() => {
    const syncFromURL = () => {
      const params = new URLSearchParams(window.location.search);
      const urlChapter = params.get('chapter') || '';
      
      // Only update unifiedFilters.chapter for display (chips), but don't trigger data refetch
      // by keeping selectedChapter separate
      if (currentVisualization === 'people' && urlChapter !== unifiedFilters.chapter) {
        setUnifiedFilters((prev: FilterState) => ({
          ...prev,
          chapter: urlChapter
        }));
      }
    };
    
    // Sync on mount and when URL changes
    syncFromURL();
    window.addEventListener('popstate', syncFromURL);
    
    // DISABLED: This interval was causing infinite loops
    // const checkInterval = setInterval(() => {
    //   if (currentVisualization === 'people') {
    //     syncFromURL();
    //   }
    // }, 500);
    
    return () => {
      window.removeEventListener('popstate', syncFromURL);
      // clearInterval(checkInterval); // Disabled since interval is disabled
    };
  }, [currentVisualization]); // Removed unifiedFilters.chapter to prevent infinite loop
  
  // Use unified filter for chapter selection - but NOT for People view (to avoid API reloads)
  const selectedChapter = currentVisualization === 'people' 
    ? `All ${TERMS.chapters}` // People view filters client-side, doesn't use selectedChapter
    : (unifiedFilters.chapter || `All ${TERMS.chapters}`);
  const [chapters, setChapters] = useState<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserInfo, setCurrentUserInfo] = useState<any>(null);
  
  const [dashboardSelectedOrganizerId, setDashboardSelectedOrganizerId] = useState<string | null>(null);
  const [dashboardSelectedOrganizerName, setDashboardSelectedOrganizerName] = useState<string>('');

  // Dynamic LOE levels extracted from actual data
  const [dynamicLOELevels, setDynamicLOELevels] = useState<DynamicLOELevel[]>([]);
  
  // LOE filter state - all LOE levels selected by default
  const [selectedLOELevels, setSelectedLOELevels] = useState<Set<string>>(() => {
    const allLevels = [...LOE_LEVELS.map(l => l.key), 'staff', 'unknown'];
    return new Set(allLevels);
  });
  
  // Date range state
  const [availableDateRange, setAvailableDateRange] = useState<{ min: Date; max: Date } | null>(null);
  
  // Teams data for network integration and chapter lookup
  const [teamsData, setTeamsData] = React.useState<any[]>([]);
  const teamsEnhancedRef = useRef(false);
  const [teamsLoading, setTeamsLoading] = React.useState(false);
  const [roleCounts, setRoleCounts] = React.useState<{ student: number; teacher: number; constituent: number }>({ student: 0, teacher: 0, constituent: 0 });
  
  // Memoize date range as tuple for PeoplePanel to prevent unnecessary re-renders
  
  // Conversation goals state
  const [conversationGoals, setConversationGoals] = useState<ConversationGoal[]>([]);

  // Campaign state
  const [campaignActions, setCampaignActions] = useState<CampaignAction[]>([]); // Action templates
  const [campaignEvents, setCampaignEvents] = useState<CampaignEvent[]>([]); // Timeline events/milestones
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [campaignViewTab, setCampaignViewTab] = useState<'timeline' | 'barometer'>(
    urlFilters.campaignViewTab || 'barometer'
  );
  
  // Campaign metric view state (for barometer)
  const [campaignMetric, setCampaignMetric] = useState<'federation' | 'chapters' | 'teams' | 'people' | 'leadership'>(
    urlFilters.campaignMetric || 'federation'
  );
  
  // Campaign barometer actions state (selected actions/metrics)
  const [barometerActions, setBarometerActions] = useState<string[]>(
    // Filter out any legacy 'pledges' value that may have been persisted in the URL
    (urlFilters.barometerActions || []).filter((a: string) => a !== 'pledges')
  );
  
  // Campaign barometer sort state
  const [barometerSort, setBarometerSort] = useState<string | null>(
    urlFilters.barometerSort || 'total'
  );
  const [barometerSortDir, setBarometerSortDir] = useState<'asc' | 'desc'>(
    urlFilters.barometerSortDir || 'desc'
  );
  
  // Update URL when campaign settings change
  useEffect(() => {
    if (currentVisualization === 'campaign') {
      const updatedFilters = { 
        ...unifiedFilters, 
        campaignViewTab, 
        campaignMetric, 
        barometerActions,
        barometerSort,
        barometerSortDir
      };
      handleURLFiltersChange(updatedFilters);
    }
  }, [campaignViewTab, campaignMetric, barometerActions, barometerSort, barometerSortDir, currentVisualization]);
  
  // Handlers for barometer state changes
  const handleBarometerActionsChange = useCallback((actions: string[]) => {
    setBarometerActions(actions);
  }, []);
  
  const handleBarometerSortChange = useCallback((column: string | null, direction: 'asc' | 'desc') => {
    setBarometerSort(column);
    setBarometerSortDir(direction);
  }, []);
  
  // People view mode state
  const [peopleViewMode, setPeopleViewMode] = useState<'kanban' | 'timeline' | 'list'>('list');
  
  // Parent campaigns state
  const [parentCampaigns, setParentCampaigns] = useState<ParentCampaign[]>([]);
  const [selectedParentCampaigns, setSelectedParentCampaigns] = useState<string[]>(DEFAULT_SELECTED_CAMPAIGNS);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [actions, setActions] = useState<ActionDefinition[]>([]);

  // Legacy peopleFilters for backward compatibility - use useMemo to prevent re-renders
  const peopleFilters = React.useMemo(() => ({
    organizer: unifiedFilters.organizer,
    chapter: unifiedFilters.chapter,
    searchText: unifiedFilters.searchText,
    loeStatus: unifiedFilters.loeStatus,
    memberStatus: unifiedFilters.memberStatus,
    lastContactFilter: unifiedFilters.lastContactFilter,
    meetingCountFilter: unifiedFilters.meetingCountFilter,
    actionStatus: unifiedFilters.actionStatus,
    team: '',
    commitmentAsked: '' as const,
    commitmentMade: '' as const
  }), [
    unifiedFilters.organizer,
    unifiedFilters.chapter,
    unifiedFilters.searchText,
    unifiedFilters.loeStatus,
    unifiedFilters.memberStatus,
    unifiedFilters.lastContactFilter,
    unifiedFilters.meetingCountFilter,
    unifiedFilters.actionStatus
  ]);

  const setPeopleFilters = (updater: any) => {
    if (typeof updater === 'function') {
      setUnifiedFilters((prev: FilterState) => {
        const newPeopleFilters = updater({
          organizer: prev.organizer,
          chapter: prev.chapter,
          searchText: prev.searchText,
          loeStatus: prev.loeStatus,
          memberStatus: prev.memberStatus,
          lastContactFilter: prev.lastContactFilter,
          meetingCountFilter: prev.meetingCountFilter,
          actionStatus: prev.actionStatus
        });
        return { ...prev, ...newPeopleFilters };
      });
    } else {
      setUnifiedFilters((prev: FilterState) => ({ ...prev, ...updater }));
    }
  };

  // Data state
  const [meetingsData, setMeetingsData] = useState<any[]>([]);
  const [allTimeMeetingsData, setAllTimeMeetingsData] = useState<any[]>([]); // All meetings, not filtered by date range
  const [dataReady, setDataReady] = useState(false);
  const hasAllTimeMeetingsRef = useRef(false); // Track if we've fetched all-time meetings
  
  // Shared PeoplePanel data (loaded once, used by both Dashboard and Federation views)
  const [sharedAllContacts, setSharedAllContacts] = useState<any[]>([]);
  const [sharedCachedMeetings, setSharedCachedMeetings] = useState<any[]>([]);
  const sharedDataLoadedRef = useRef(false);
  
  // Shared leader hierarchy data (loaded once, used by Dashboard)
  const [leaderHierarchy, setLeaderHierarchy] = useState<any[]>([]);
  const leaderHierarchyLoadedRef = useRef(false);
  
  // Network LOE filter state - Initialize with all LOE levels checked
  const [networkLOEFilter, setNetworkLOEFilter] = useState<string[]>([]);
  
  // Network mode: 'teams' (organizers only) or 'constituents' (organizers + their contacts)
  const [networkMode, setNetworkMode] = useState<'teams' | 'constituents'>('teams');
  
  // Persist node positions so the graph survives tab switches
  const networkNodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  
  // Extract dynamic LOE levels from meetings data when it loads
  useEffect(() => {
    // Always run — extractLOELevelsFromMeetings always includes Staff + Unknown as base levels
    const extracted = extractLOELevelsFromMeetings(allTimeMeetingsData || []);
    setDynamicLOELevels(extracted);
    // Always (re-)initialize the filter to all available values so the network shows by default
    setNetworkLOEFilter(extracted.map(loe => loe.rawValue));
  }, [allTimeMeetingsData]);
  
  // Shared lists/turf data (loaded once, used by Dashboard)
  const [listsData, setListsData] = useState<any[]>([]);
  const listsLoadedRef = useRef(false);
  
  // Shared organizer mapping data (loaded once, used throughout app)
  const [organizerMappings, setOrganizerMappings] = useState<any[]>([]);
  const organizerMappingsLoadedRef = useRef(false);
  
  // Edit organizer mapping dialog state
  const [editMappingDialogOpen, setEditMappingDialogOpen] = useState(false);
  const [editMappingData, setEditMappingData] = useState<{ name: string; vanId?: string } | null>(null);
  
  // Contact-organizer assignment state
  const [contactOrganizerMap, setContactOrganizerMap] = useState<Map<string, Array<{ organizer_vanid: string; name: string }>>>(new Map());
  const [assignOrgDialogOpen, setAssignOrgDialogOpen] = useState(false);
  const [assignOrgTarget, setAssignOrgTarget] = useState<{ contactVanId: string; contactName: string } | null>(null);
  
  // Person mapping management dialog state
  const [personMappingDialogOpen, setPersonMappingDialogOpen] = useState(false);
  
  // Shared organizer goals data (loaded once, used by Dashboard)
  const [organizerGoals, setOrganizerGoals] = useState<any[]>([]);
  const organizerGoalsLoadedRef = useRef(false);
  
  // Track if mappings are loaded (must load before other data)
  const [mappingsReady, setMappingsReady] = useState(false);
  const [earlyTeamsReady, setEarlyTeamsReady] = useState(false);
  
  // Load organizer mappings AND teams data FIRST (in parallel), before any other data
  useEffect(() => {
    const loadEarlyData = async () => {
      if (organizerMappingsLoadedRef.current) return;
      organizerMappingsLoadedRef.current = true;
      
      try {
        // console.log('[MainApp] Loading early data (mappings + teams)...');
        
        // Load mappings and teams in parallel
        const [mappings, teams] = await Promise.all([
          getOrganizerMappings(),
          teamsService.loadEnhancedTeams([], [], []) // Load with empty data initially
        ]);
        
        // console.log('[MainApp] Loaded', mappings.length, 'organizer mappings');
        // console.log('[MainApp] Loaded', teams.length, 'teams (early)');
        
        setOrganizerMappings(mappings);
        
        // Set initial teams data if we got any
        if (teams.length > 0) {
          setTeamsData(teams);
        }
        
        setMappingsReady(true);
        setEarlyTeamsReady(true);
      } catch (error) {
        console.error('Error loading early data:', error);
        setMappingsReady(true); // Continue even if loading fails
        setEarlyTeamsReady(true);
      }
    };
    
    loadEarlyData();
  }, []);
  
  // Load campaigns from API
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const campaignsData = await fetchCampaigns();
        // Transform API format to ParentCampaign format
        const transformedCampaigns = campaignsData.map(transformCampaignFromAPI);
        setParentCampaigns(transformedCampaigns);
        
        // Auto-select parent campaigns by default (campaigns without a parentCampaignId)
        const parentCampaignIds = transformedCampaigns
          .filter(c => !c.parentCampaignId)
          .map(c => c.id);
        if (parentCampaignIds.length > 0) {
          setSelectedParentCampaigns(parentCampaignIds);
        }
      } catch (error) {
        console.error('Error loading campaigns:', error);
      } finally {
        setLoadingCampaigns(false);
      }
    };
    
    loadCampaigns();
  }, []);
  
  // Load shared contacts and meetings data once (for PeoplePanel)
  const reloadSharedContacts = useCallback(async (includeMeetings = false) => {
    try {
      const contactsResponse = await fetchContacts({
        chapter: undefined,
        limit: 5000,
        offset: 0
      });
      
      const contacts = (contactsResponse.data || []).map(contact => ({
        ...contact,
        organizers: contact.organizers?.map(organizer => 
          getCanonicalOrganizerName(organizer, organizerMappings)
        )
      }));
      
      setSharedAllContacts(contacts);
      
      setUserMap(prev => {
        const updated = new Map(prev);
        contacts.forEach(contact => {
          const vanid = contact.vanid?.toString();
          if (vanid) {
            updated.set(vanid, {
              userId: vanid,
              firstname: contact.firstname,
              lastname: contact.lastname,
              fullName: `${contact.firstname || ''} ${contact.lastname || ''}`.trim(),
              chapter: contact.chapter || 'Unknown',
              type: 'contact',
              email: contact.email,
              phone: undefined
            });
          }
        });
        return updated;
      });
      
      if (includeMeetings && contacts.length > 0) {
        const contactsToFetch = contacts.slice(0, 500);
        const BATCH_SIZE = 100;
        const allMeetings: any[] = [];
        
        for (let i = 0; i < contactsToFetch.length; i += BATCH_SIZE) {
          const batch = contactsToFetch.slice(i, i + BATCH_SIZE);
          const contactIds = batch.map(c => c.vanid?.toString()).filter(Boolean) as string[];
          
          if (contactIds.length > 0) {
            const batchMeetings = await fetchMeetingsByContacts(contactIds, true);
            allMeetings.push(...batchMeetings);
            setSharedCachedMeetings([...allMeetings]);
          }
        }
      }
    } catch (error) {
      console.error('Error reloading shared contacts:', error);
    }
  }, [organizerMappings]);

  useEffect(() => {
    const loadSharedData = async () => {
      if (sharedDataLoadedRef.current) {
        return;
      }
      
      if (!mappingsReady) {
        return;
      }
      
      sharedDataLoadedRef.current = true;
      
      await reloadSharedContacts(true);
    };
    
    loadSharedData();
  }, [mappingsReady, reloadSharedContacts]);
  
  // Load leader hierarchy once when currentUserId is available
  const loadLeaderHierarchyData = React.useCallback(async () => {
    try {
      // Fetch ALL hierarchy entries (not filtered by organizer)
      // This allows Dashboard to traverse the full tree when showing nested leaders
      const hierarchy = await fetchLeaderHierarchy();
      setLeaderHierarchy(hierarchy);
    } catch (error) {
      console.error('Error loading leader hierarchy:', error);
    }
  }, []);
  
  useEffect(() => {
    if (leaderHierarchyLoadedRef.current) return;
    leaderHierarchyLoadedRef.current = true;
    loadLeaderHierarchyData();
  }, [loadLeaderHierarchyData]);
  
  // Load contact-organizer assignments
  const loadContactOrganizers = useCallback(async () => {
    try {
      const data = await fetchAllContactOrganizers();
      const map = new Map<string, Array<{ organizer_vanid: string; name: string }>>();
      data.forEach(row => {
        const name = `${row.firstname || ''} ${row.lastname || ''}`.trim() || row.organizer_vanid;
        if (!map.has(row.contact_vanid)) {
          map.set(row.contact_vanid, []);
        }
        map.get(row.contact_vanid)!.push({ organizer_vanid: row.organizer_vanid, name });
      });
      setContactOrganizerMap(map);
    } catch (err) {
      console.error('Error loading contact organizers:', err);
    }
  }, []);

  useEffect(() => {
    loadContactOrganizers();
  }, [loadContactOrganizers]);

  // Handlers for organizer chip actions
  const handleFilterByOrganizer = (name: string, vanId?: string) => {
    setUnifiedFilters((prev: FilterState) => ({
      ...prev,
      organizer: name
    }));
  };
  
  const handleEditOrganizerMapping = (name: string, vanId?: string) => {
    setEditMappingData({ name, vanId });
    setEditMappingDialogOpen(true);
  };
  
  const handleAddOrganizer = (contactVanId: string, contactName: string) => {
    setAssignOrgTarget({ contactVanId, contactName });
    setAssignOrgDialogOpen(true);
  };
  
  const handleAssignOrganizer = async (organizerVanid: string, _organizerName: string) => {
    if (!assignOrgTarget) return;
    const ok = await addContactOrganizer(assignOrgTarget.contactVanId, organizerVanid);
    if (ok) {
      await loadContactOrganizers();
    }
  };
  
  const handleRemoveOrganizer = async (contactVanId: string, organizerVanId: string) => {
    const ok = await removeContactOrganizer(contactVanId, organizerVanId);
    if (ok) {
      await loadContactOrganizers();
    }
  };
  
  const handleMergePeople = async (primaryVanid: string, mergeVanid: string) => {
    try {
      await mergePeople(primaryVanid, mergeVanid, organizerMappings);
      
      // Refresh mappings
      const updatedMappings = await getOrganizerMappings();
      setOrganizerMappings(updatedMappings);
      
      // Re-resolve contact data with new mappings
      setSharedAllContacts(prev => prev.map(contact => ({
        ...contact,
        organizers: contact.organizers?.map((organizer: string) => 
          getCanonicalOrganizerName(organizer, updatedMappings)
        )
      })));
      
    } catch (error) {
      console.error('Error merging people:', error);
      throw error;
    }
  };
  
  const handleMappingSaved = async () => {
    // Refresh organizer mappings and re-resolve all existing contact data
    try {
      // console.log('[MainApp] Refreshing organizer mappings after save...');
      const mappings = await getOrganizerMappings();
      setOrganizerMappings(mappings);
      
      // Update userMap with new mapping information
      setUserMap(prev => {
        const updated = new Map(prev);
        mappings.forEach(mapping => {
          const vanid = mapping.primary_vanid;
          const existingInfo = updated.get(vanid) || {};
          
          // Parse name into first/last if possible
          const nameParts = mapping.preferred_name.split(' ');
          const firstname = nameParts[0] || '';
          const lastname = nameParts.slice(1).join(' ') || '';
          
          // Update userMap entry with mapping data
          updated.set(vanid, {
            ...existingInfo,
            userId: vanid,
            firstname: firstname,
            lastname: lastname,
            fullName: mapping.preferred_name,
            chapter: mapping.chapter || existingInfo.chapter || 'Unknown',
            phone: mapping.phone || existingInfo.phone,
            email: mapping.email || existingInfo.email,
            type: mapping.person_type || existingInfo.type || 'contact'
          });
          
          // Also add entries for alternate VAN IDs
          mapping.alternate_vanids?.forEach(altVanid => {
            updated.set(altVanid, {
              ...existingInfo,
              userId: altVanid,
              firstname: firstname,
              lastname: lastname,
              fullName: mapping.preferred_name,
              chapter: mapping.chapter || existingInfo.chapter || 'Unknown',
              phone: mapping.phone || existingInfo.phone,
              email: mapping.email || existingInfo.email,
              type: mapping.person_type || existingInfo.type || 'contact'
            });
          });
        });
        return updated;
      });
      
      // Re-resolve all existing contact data with new mappings
      
      // Re-resolve shared contacts
      setSharedAllContacts(prev => prev.map(contact => ({
        ...contact,
        organizers: contact.organizers?.map((organizer: string) => 
          getCanonicalOrganizerName(organizer, mappings)
        )
      })));
      
      // Re-resolve initial contacts
      setContactsData(prev => prev.map(contact => ({
        ...contact,
        organizers: contact.organizers?.map((organizer: string) => 
          getCanonicalOrganizerName(organizer, mappings)
        )
      })));
      
      // Re-resolve kanban contacts
      setKanbanContacts(prev => prev.map(contact => ({
        ...contact,
        organizers: contact.organizers?.map((organizer: string) => 
          getCanonicalOrganizerName(organizer, mappings)
        )
      })));
      
      // console.log('[MainApp] ✅ All data re-resolved with new mappings');
    } catch (error) {
      console.error('Error refreshing organizer mappings:', error);
    }
  };
  
  // Load ALL lists data (across all organizers) for barometer rollups
  const loadListsData = React.useCallback(async () => {
    try {
      const lists = await fetchAllLists();
      setListsData(lists);
    } catch (error) {
      console.error('Error loading lists:', error);
    }
  }, []);
  
  useEffect(() => {
    if (listsLoadedRef.current) return;
    listsLoadedRef.current = true;
    loadListsData();
  }, [loadListsData]);
  
  // Load organizer goals once when currentUserId is available
  const loadOrganizerGoalsData = React.useCallback(async () => {
    if (!currentUserId) return;
    
    try {
      const goals = await fetchOrganizerGoals(currentUserId);
      setOrganizerGoals(goals);
    } catch (error) {
      console.error('Error loading organizer goals:', error);
    }
  }, [currentUserId]);
  
  useEffect(() => {
    if (!currentUserId || organizerGoalsLoadedRef.current) return;
    organizerGoalsLoadedRef.current = true;
    loadOrganizerGoalsData();
  }, [currentUserId, loadOrganizerGoalsData]);

  // Available filter options
  const [contactsData, setContactsData] = useState<any[]>([]);
  const [orgIds, setOrgIds] = useState<any[]>([]);
  const [userMap, setUserMap] = useState<Map<string, any>>(new Map());
  const [sectionLeads, setSectionLeads] = useState<SectionLead[]>([]);

  // Build combined organizer options from contacts + team members (dedup by vanid AND name)
  const allOrganizerOptions = React.useMemo(() => {
    const seenVanids = new Set<string>();
    const seenNames = new Set<string>();
    const combined: Array<{ vanid?: string | number; firstname?: string; lastname?: string; chapter?: string }> = [];

    for (const o of orgIds) {
      const vid = o.vanid?.toString();
      const name = `${o.firstname || ''} ${o.lastname || ''}`.trim().toLowerCase();
      if (vid && !seenVanids.has(vid) && (!name || !seenNames.has(name))) {
        seenVanids.add(vid);
        if (name) seenNames.add(name);
        combined.push(o);
      }
    }

    for (const team of teamsData) {
      const members = team.organizers || [];
      for (const m of members) {
        const vid = (m.id || m.vanId)?.toString();
        const name = m.name?.trim().toLowerCase();
        if (vid && !seenVanids.has(vid) && name && !seenNames.has(name)) {
          seenVanids.add(vid);
          seenNames.add(name);
          const nameParts = m.name.trim().split(/\s+/);
          combined.push({
            vanid: vid,
            firstname: nameParts[0] || '',
            lastname: nameParts.slice(1).join(' ') || '',
            chapter: m.chapter || team.chapter
          });
        }
      }
    }

    return combined;
  }, [orgIds, teamsData]);

  // Available filter options (organizer dropdown in the filter bar)
  const filterOptions = React.useMemo(() => {
    const organizerSet = new Set<string>();

    meetingsData.forEach(meeting => {
      if (meeting.organizer && meeting.organizer !== 'Unknown Organizer') {
        organizerSet.add(meeting.organizer);
      }
    });

    orgIds.forEach((o: any) => {
      const name = `${o.firstname || ''} ${o.lastname || ''}`.trim();
      if (name) organizerSet.add(name);
    });

    teamsData.forEach((team: any) => {
      (team.organizers || []).forEach((m: any) => {
        if (m.name) organizerSet.add(m.name);
      });
    });

    const organizers = Array.from(organizerSet).sort();

    const teamNames = (teamsData || [])
      .map((t: any) => t.teamName)
      .filter(Boolean)
      .sort();

    return {
      chapters,
      organizers,
      teamTypes: teamNames,
      goalTypes: ['Pledges', 'Leadership', 'Membership', 'Events']
    };
  }, [chapters, meetingsData, orgIds, teamsData]);
  
  // Memoize userMap with integer keys for PeoplePanel to prevent unnecessary re-renders
  const peopleUserMap = React.useMemo(() => {
    return new Map(Array.from(userMap.entries()).map(([k, v]) => [parseInt(k), v]));
  }, [userMap]);
  
  // UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileDatePickerOpen, setMobileDatePickerOpen] = useState(false);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [selectedPersonForDialog, setSelectedPersonForDialog] = useState<any>(null);
  
  // Fetch control
  const [fetchRequested, setFetchRequested] = useState<boolean>(false);
  const hasFetchedDataRef = useRef<boolean>(false);

  // Campaign actions localStorage functions
  const loadCampaignActionsFromStorage = (): CampaignAction[] => {
    try {
      const stored = localStorage.getItem('lumoviz-campaign-actions');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      // console.error('Error loading campaign actions from localStorage:', error);
      return [];
    }
  };

  // NO LONGER USED - Campaign actions are now stored in BigQuery
  // const saveCampaignActionsToStorage = (actions: CampaignAction[]) => {
  //   try {
  //     localStorage.setItem('lumoviz-campaign-actions', JSON.stringify(actions));
  //   } catch (error) {
  //     // console.error('Error saving campaign actions to localStorage:', error);
  //   }
  // };

  // Parent campaigns localStorage functions (NO LONGER USED - now in BigQuery)
  // const loadParentCampaignsFromStorage = (): ParentCampaign[] => {
  //   try {
  //     const stored = localStorage.getItem('lumoviz-parent-campaigns');
  //     return stored ? JSON.parse(stored) : [];
  //   } catch (error) {
  //     return [];
  //   }
  // };

  // const saveParentCampaignsToStorage = (campaigns: ParentCampaign[]) => {
  //   try {
  //     localStorage.setItem('lumoviz-parent-campaigns', JSON.stringify(campaigns));
  //   } catch (error) {
  //     // Error saving
  //   }
  // };

  // Campaign action handlers
  const handleAddCampaignAction = async (actionData: Omit<CampaignAction, 'id'>) => {
    try {
      // Create action via API
      const response = await fetch(`${API_BASE_URL}/api/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_name: actionData.name,
          fields: actionData.fields,
          goal_field_key: actionData.goalFieldKey,
          parent_campaign_id: actionData.parentCampaignId,
          goal_type_id: actionData.goalTypeId,
          has_goal: actionData.hasGoal !== false,
          target_audience: actionData.targetAudience || 'constituent',
          is_template: true,  // All campaign actions are templates
          organizer_vanid: actionData.creatorOrganizerVanid,
          visible_to_organizers: actionData.visibleToOrganizers || [],
          default_individual_goal: actionData.defaultIndividualGoal || 5
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create action');
      }

      // Reload campaign actions from database
      const dbActions = await fetchActions(currentUserId || undefined, currentUserInfo?.chapter || undefined);
      const campaignActionsFromDB: CampaignAction[] = dbActions
        .filter(action => action.is_template)
        .map(action => ({
          id: action.action_id,
          name: action.action_name,
          fields: (action.fields || []).map(f => ({
            key: f.key,
            label: f.label,
            type: (f.type as 'boolean' | 'select' | 'text' | undefined) || 'boolean',
            options: f.options
          })),
          goalFieldKey: (action as any).goal_field_key || undefined,
          parentCampaignId: action.parent_campaign_id || undefined,
          goalTypeId: action.goal_type || undefined,
          chapters: [],
          isTemplate: action.is_template === true,
          templateActionId: action.template_action_id || undefined,
          creatorOrganizerVanid: action.organizer_vanid || undefined,
          visibleToOrganizers: (action as any).visible_to_organizers || [],
          defaultIndividualGoal: action.default_individual_goal || 5
        }));
      
      setCampaignActions(campaignActionsFromDB);
      
      alert(`✓ Template "${actionData.name}" created!`);
    } catch (error) {
      console.error('Error creating action:', error);
      alert('Failed to create action. Please try again.');
    }
  };

  const handleEditCampaignAction = async (actionId: string, actionData: Omit<CampaignAction, 'id'>) => {
    try {
      // Update action via API
      const response = await fetch(`${API_BASE_URL}/api/actions/${actionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_name: actionData.name,
          fields: actionData.fields,
          goal_field_key: actionData.goalFieldKey,
          parent_campaign_id: actionData.parentCampaignId,
          goal_type_id: actionData.goalTypeId,
          has_goal: actionData.hasGoal !== false,
          target_audience: actionData.targetAudience || 'constituent',
          is_template: true,  // All campaign actions are templates
          organizer_vanid: actionData.creatorOrganizerVanid,
          visible_to_organizers: actionData.visibleToOrganizers || [],
          default_individual_goal: actionData.defaultIndividualGoal || 5
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update action');
      }

      // Reload campaign actions from database
      const dbActions = await fetchActions(currentUserId || undefined, currentUserInfo?.chapter || undefined);
      const campaignActionsFromDB: CampaignAction[] = dbActions
        .filter(action => action.is_template)
        .map(action => ({
          id: action.action_id,
          name: action.action_name,
          fields: (action.fields || []).map(f => ({
            key: f.key,
            label: f.label,
            type: (f.type as 'boolean' | 'select' | 'text' | undefined) || 'boolean',
            options: f.options
          })),
          goalFieldKey: (action as any).goal_field_key || undefined,
          parentCampaignId: action.parent_campaign_id || undefined,
          goalTypeId: action.goal_type || undefined,
          chapters: [],
          isTemplate: action.is_template === true,
          templateActionId: action.template_action_id || undefined,
          creatorOrganizerVanid: action.organizer_vanid || undefined,
          visibleToOrganizers: (action as any).visible_to_organizers || [],
          defaultIndividualGoal: action.default_individual_goal || 5
        }));
      
      setCampaignActions(campaignActionsFromDB);
      
      alert(`✓ Template "${actionData.name}" updated!`);
    } catch (error) {
      console.error('Error updating action:', error);
      alert('Failed to update action. Please try again.');
    }
  };

  const handleDeleteCampaignAction = async (actionId: string) => {
    try {
      const action = campaignActions.find(a => a.id === actionId);
      if (!action) {
        alert('Action not found');
        return;
      }

      if (!window.confirm(`Are you sure you want to permanently delete "${action.name}"?`)) {
        return;
      }

      // Delete action via API
      const response = await fetch(`${API_BASE_URL}/api/actions/${actionId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete action');
      }

      // Reload campaign actions from database
      const dbActions = await fetchActions(currentUserId || undefined, currentUserInfo?.chapter || undefined);
      const campaignActionsFromDB: CampaignAction[] = dbActions
        .filter(action => action.is_template)
        .map(action => ({
          id: action.action_id,
          name: action.action_name,
          fields: (action.fields || []).map(f => ({
            key: f.key,
            label: f.label,
            type: (f.type as 'boolean' | 'select' | 'text' | undefined) || 'boolean',
            options: f.options
          })),
          goalFieldKey: (action as any).goal_field_key || undefined,
          parentCampaignId: action.parent_campaign_id || undefined,
          goalTypeId: action.goal_type || undefined,
          chapters: [],
          isTemplate: action.is_template === true,
          templateActionId: action.template_action_id || undefined,
          creatorOrganizerVanid: action.organizer_vanid || undefined,
          visibleToOrganizers: (action as any).visible_to_organizers || [],
          defaultIndividualGoal: action.default_individual_goal || 5
        }));
      
      setCampaignActions(campaignActionsFromDB);
      
      alert(`✓ Action "${action.name}" deleted`);
    } catch (error) {
      console.error('Error deleting action:', error);
      alert('Failed to delete action. Please try again.');
    }
  };

  const handleArchiveCampaignAction = async (actionId: string) => {
    try {
      const action = campaignActions.find(a => a.id === actionId);
      if (!action) {
        alert('Action not found');
        return;
      }

      // Update action status to 'archived' via API
      const response = await fetch(`${API_BASE_URL}/api/actions/${actionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_name: action.name,
          fields: action.fields,
          goal_field_key: action.goalFieldKey || undefined,
          parent_campaign_id: action.parentCampaignId,
          goal_type_id: action.goalTypeId,
          has_goal: true,
          is_template: action.isTemplate,
          organizer_vanid: action.creatorOrganizerVanid,
          status: 'archived',
          archived_date: new Date().toISOString().split('T')[0]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to archive action');
      }

      // Reload campaign actions from database
      const dbActions = await fetchActions(currentUserId || undefined, currentUserInfo?.chapter || undefined);
      const campaignActionsFromDB: CampaignAction[] = dbActions
        .filter(action => action.is_template)
        .map(action => ({
          id: action.action_id,
          name: action.action_name,
          fields: (action.fields || []).map(f => ({
            key: f.key,
            label: f.label,
            type: (f.type as 'boolean' | 'select' | 'text' | undefined) || 'boolean',
            options: f.options
          })),
          goalFieldKey: (action as any).goal_field_key || undefined,
          parentCampaignId: action.parent_campaign_id || undefined,
          goalTypeId: action.goal_type || undefined,
          chapters: [],
          isTemplate: action.is_template === true,
          templateActionId: action.template_action_id || undefined,
          creatorOrganizerVanid: action.organizer_vanid || undefined,
          visibleToOrganizers: (action as any).visible_to_organizers || [],
          defaultIndividualGoal: action.default_individual_goal || 5
        }));
      
      setCampaignActions(campaignActionsFromDB);
      
      alert(`✓ Action "${action.name}" archived`);
    } catch (error) {
      console.error('Error archiving action:', error);
      alert('Failed to archive action. Please try again.');
    }
  };

  // Parent campaign handlers
  const handleAddParentCampaign = async (campaignData: Omit<ParentCampaign, 'id' | 'createdDate'>) => {
    try {
      // Transform frontend data format to backend API format
      const apiData = {
        campaign_name: campaignData.name,
        description: campaignData.description,
        start_date: campaignData.startDate,
        end_date: campaignData.endDate,
        chapters: campaignData.chapters,
        teams: campaignData.teams,
        parent_campaign_id: campaignData.parentCampaignId,
        goal_types: campaignData.goalTypes,
        milestones: campaignData.milestones
      };
      
      const result = await createCampaign(apiData);
      
      // Reload campaigns from API
      const campaignsData = await fetchCampaigns();
      const transformedCampaigns = campaignsData.map(transformCampaignFromAPI);
      setParentCampaigns(transformedCampaigns);
    } catch (error) {
      console.error('Error adding campaign:', error);
      alert('Failed to add campaign. Please try again.');
    }
  };

  const handleUpdateParentCampaign = async (campaignId: string, campaignData: Omit<ParentCampaign, 'id' | 'createdDate'>) => {
    try {
      // Transform frontend data format to backend API format
      const apiData = {
        campaign_name: campaignData.name,
        description: campaignData.description,
        start_date: campaignData.startDate,
        end_date: campaignData.endDate,
        chapters: campaignData.chapters,
        teams: campaignData.teams,
        parent_campaign_id: campaignData.parentCampaignId,
        status: 'active'
      };
      
      await updateCampaign(campaignId, apiData);
      
      // Reload campaigns from API
      const campaignsData = await fetchCampaigns();
      const transformedCampaigns = campaignsData.map(transformCampaignFromAPI);
      setParentCampaigns(transformedCampaigns);
    } catch (error) {
      console.error('Error updating campaign:', error);
      alert('Failed to update campaign. Please try again.');
    }
  };

  const handleDeleteParentCampaign = async (campaignId: string) => {
    try {
      await deleteCampaign(campaignId);
      
      // Remove from local state
      const updatedCampaigns = parentCampaigns.filter(campaign => campaign.id !== campaignId);
      setParentCampaigns(updatedCampaigns);
      
      // Reload campaign actions from database (cascade delete happens on backend)
      const dbActions = await fetchActions();
      const campaignActionsFromDB: CampaignAction[] = dbActions
        .filter(action => action.is_template)
        .map(action => ({
          id: action.action_id,
          name: action.action_name,
          fields: (action.fields || []).map(f => ({
            key: f.key,
            label: f.label,
            type: (f.type as 'boolean' | 'select' | 'text' | undefined) || 'boolean',
            options: f.options
          })),
          goalFieldKey: (action as any).goal_field_key || undefined,
          parentCampaignId: action.parent_campaign_id || undefined,
          goalTypeId: action.goal_type || undefined,
          chapters: [],
          isTemplate: action.is_template === true,
          templateActionId: action.template_action_id || undefined,
          creatorOrganizerVanid: action.organizer_vanid || undefined,
          visibleToOrganizers: (action as any).visible_to_organizers || [],
          defaultIndividualGoal: action.default_individual_goal || 5
        }));
      
      setCampaignActions(campaignActionsFromDB);
    } catch (error) {
      console.error('Error deleting campaign:', error);
      alert('Failed to delete campaign. Please try again.');
    }
  };

  const handleCampaignClick = (campaignName: string) => {
    setSelectedCampaign(campaignName);
  };

  const handleResetCampaignZoom = () => {
    setSelectedCampaign(null);
  };

  // Load template actions from database
  useEffect(() => {
    const loadTemplateActions = async () => {
      try {
        // Fetch all actions from database
        const dbActions = await fetchActions(currentUserId || undefined, currentUserInfo?.chapter || undefined);
        
        // Convert database actions to CampaignAction format
        // Only load templates for Campaign view
        const campaignActionsFromDB: CampaignAction[] = dbActions
          .filter(action => action.is_template) // Only templates
          .map(action => ({
            id: action.action_id,
            name: action.action_name,
            fields: (action.fields || []).map(f => ({
              key: f.key,
              label: f.label,
              type: (f.type as 'boolean' | 'select' | 'text' | undefined) || 'boolean',
              options: f.options
            })),
            goalFieldKey: (action as any).goal_field_key || undefined,
            parentCampaignId: action.parent_campaign_id || undefined,
            goalTypeId: action.goal_type || undefined,
            chapters: [],
            isTemplate: action.is_template === true,
            templateActionId: action.template_action_id || undefined,
            creatorOrganizerVanid: action.organizer_vanid || undefined,
            visibleToOrganizers: (action as any).visible_to_organizers || [],
            defaultIndividualGoal: action.default_individual_goal || 5
          }));
        
        setCampaignActions(campaignActionsFromDB);
        setActions(dbActions);
      } catch (error) {
        console.error('Error loading template actions:', error);
      }
    };
    
    loadTemplateActions();
  }, []);

  // Initialize date range and chapters on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setLoading(true);
        
        // Fetch chapters
        const chaptersResponse = await fetchChapters();
        const chaptersData = Array.isArray(chaptersResponse) ? chaptersResponse : [];
        const finalChapters = [`All ${TERMS.chapters}`, ...chaptersData];
        setChapters(finalChapters);
        // Note: unifiedFilters already initialized with chapter: '' in useState, no need to set again
        
        // Date range fetching removed - no longer needed since currentDateRange was removed
        
        // Fetch org data
        const orgData = await fetchOrgIds();
        setOrgIds(orgData || []);

        // Fetch section leads
        const sectionsData = await fetchSections();
        setSectionLeads(sectionsData || []);

        // Fetch role counts for campaign goal calculation
        try {
          const rcResponse = await fetch(`${API_BASE_URL}/api/organizer-role-counts`);
          if (rcResponse.ok) {
            const rc = await rcResponse.json();
            setRoleCounts(rc);
          }
        } catch (e) {
          console.warn('Could not fetch role counts:', e);
        }
        
        // Build userMap from org data (includes all organizers)
        const newUserMap = new Map<string, any>();
        if (orgData && Array.isArray(orgData)) {
          orgData.forEach((person: any) => {
            const vanid = person.vanid?.toString();
            if (vanid) {
              newUserMap.set(vanid, {
                userId: vanid,
                chapter: person.chapter,
                firstname: person.firstname,
                lastname: person.lastname,
                email: person.email,
                type: person.type,
                fullName: `${person.firstname || ''} ${person.lastname || ''}`.trim()
              });
            }
          });
        }
        setUserMap(newUserMap);
        
        // Resolve current user from auth
        let resolvedUserId = authUser?.vanid || null;
        let resolvedUserInfo: any = resolvedUserId ? newUserMap.get(resolvedUserId) : null;

        // If vanid didn't match, try finding by email in the user map
        if (!resolvedUserInfo && authUser?.email) {
          const entries = Array.from(newUserMap.entries());
          for (let i = 0; i < entries.length; i++) {
            const [vid, info] = entries[i];
            if (info.email && info.email.toLowerCase() === authUser.email.toLowerCase()) {
              resolvedUserId = vid;
              resolvedUserInfo = info;
              break;
            }
          }
        }

        // If still not found, try matching by display name
        if (!resolvedUserInfo && authUser?.displayName) {
          const entries = Array.from(newUserMap.entries());
          const authNameLower = authUser.displayName.toLowerCase();
          for (let i = 0; i < entries.length; i++) {
            const [vid, info] = entries[i];
            const fullName = (info.fullName || `${info.firstname || ''} ${info.lastname || ''}`.trim()).toLowerCase();
            if (fullName && fullName === authNameLower) {
              resolvedUserId = vid;
              resolvedUserInfo = info;
              break;
            }
          }
        }

        // Last resort: create a stub entry for this user
        if (!resolvedUserId) {
          resolvedUserId = `auth_${authUser?.id || 'unknown'}`;
        }
        if (!resolvedUserInfo) {
          resolvedUserInfo = {
            userId: resolvedUserId,
            chapter: 'Unknown',
            firstname: authUser?.displayName?.split(' ')[0] || 'User',
            lastname: authUser?.displayName?.split(' ').slice(1).join(' ') || '',
            email: authUser?.email || '',
            fullName: authUser?.displayName || 'User',
            username: authUser?.email?.split('@')[0] || 'user',
            alternateIds: [resolvedUserId]
          };
          newUserMap.set(resolvedUserId, resolvedUserInfo);
          setUserMap(new Map(newUserMap));
        }

        setCurrentUserId(resolvedUserId);
        setCurrentUserInfo(resolvedUserInfo);
        
        setFetchRequested(true); // Trigger initial data fetch
        
      } catch (error) {
    
        setError('Failed to initialize application');
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  // DISABLED: Data fetching useEffects to stop infinite loop
  // The app will use static/default data until the infinite loop is fully resolved


  // TEMPORARILY DISABLED: Load actions from database on mount and when user info changes
  // useEffect(() => {
  //   const loadActions = async () => {
  //     try {
  //       // Get user's chapter from their team
  //       const userFullName = currentUserInfo?.fullName;
  //       const userFirstName = currentUserInfo?.firstname;
  //       
  //       // Find the team where this user is a member or lead
  //       const userTeam = teamsData?.find(team => {
  //         const teamLead = team.bigQueryData?.teamLead;
  //         const teamMembers = team.bigQueryData?.teamMembers || [];
  //         
  //         // Check if user is the lead
  //         if (teamLead === userFullName || teamLead === userFirstName) {
  //           return true;
  //         }
  //         
  //         // Check if user is a member
  //         return teamMembers.some((member: string) => 
  //           member === userFullName || member === userFirstName
  //         );
  //       });
  //       
  //       // Get chapter from team, or fall back to currentUserInfo
  //       const userChapter = userTeam?.bigQueryData?.chapter || currentUserInfo?.chapter;
  //       
  //       // Pass both organizer VAN ID and chapter for proper filtering
  //       const fetchedActions = await fetchActions(
  //         currentUserId || undefined, 
  //         userChapter || undefined
  //       );
  //       setActions(fetchedActions);
  //       
  //       // Set default selected actions if none are selected from URL
  //       if (urlSelectedActions.length === 0 && fetchedActions.length > 0) {
  //         // Default to the first active action
  //         const defaultActionId = fetchedActions[0].action_id;
  //         handleSelectedActionsChange([defaultActionId]);
  //       }
  //     } catch (error) {
  //       console.error('Error fetching actions:', error);
  //       setActions([]);
  //     }
  //   };

  //   if (currentUserId && teamsData) {
  //     loadActions();
  //   }
  // }, [currentUserId, currentUserInfo?.chapter, teamsData]); // Re-load when user, chapter, or teams change

  // Handle date range changes
  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    // setCurrentDateRange removed - no longer used
    hasFetchedDataRef.current = false;
    setFetchRequested(true);
  };

  // Track previous chapter to detect when filter is cleared
  const prevChapterRef = useRef<string>(selectedChapter);
  
  // Ensure data refreshes when chapter filter is cleared
  useEffect(() => {
    const allChaptersLabel = `All ${TERMS.chapters}`;
    // Only trigger refresh if chapter changed from a specific chapter to all chapters
    if (prevChapterRef.current !== allChaptersLabel && selectedChapter === allChaptersLabel) {
      // Small delay to ensure state has settled, then trigger fetch
      const timer = setTimeout(() => {
        hasFetchedDataRef.current = false;
        setFetchRequested(true);
      }, 100);
      prevChapterRef.current = selectedChapter;
      return () => clearTimeout(timer);
    }
    prevChapterRef.current = selectedChapter;
  }, [selectedChapter]);

  // Handle chapter changes through unified filter
  const handleChapterChange = (chapter: string) => {
    setUnifiedFilters(prev => ({ ...prev, chapter: chapter === `All ${TERMS.chapters}` ? '' : chapter }));
    hasFetchedDataRef.current = false;
    setFetchRequested(true);
  };

  // Handle node selection
  const handleNodeSelection = (nodeId: string | null) => {
    setSelectedNodeId(prev => (prev === nodeId ? null : nodeId));
    
    // Show comprehensive node information in console
    if (!nodeId) return;
    
    const node = networkNodes.find(n => n.id === nodeId);
    if (!node) return;
    
    // Find all meetings/conversations involving this person
    const personMeetings = meetingsData.filter((meeting: any) => 
      String(meeting.organizer_vanid) === nodeId || 
      String(meeting.vanid) === nodeId ||
      (meeting.organizer || '').toLowerCase().trim() === node.name.toLowerCase().trim() ||
      (meeting.contact || '').toLowerCase().trim() === node.name.toLowerCase().trim()
    );
    
    // Find team information
    const teamInfo = teamsData.find((team: any) => 
      team.organizers?.some((member: any) => String(member.id) === nodeId || member.name === node.name)
    );
    
    // Find connections (people they're connected to)
    const connections = networkLinks
      .filter(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        return sourceId === nodeId || targetId === nodeId;
      })
      .map(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        const connectedNodeId = sourceId === nodeId ? targetId : sourceId;
        const connectedNode = networkNodes.find(n => n.id === connectedNodeId);
        
        if (!connectedNode) return null;
        
        return {
          name: connectedNode.name,
          chapter: connectedNode.chapter,
          type: connectedNode.type || 'Unknown'
        };
      })
      .filter(Boolean);
    
    // Comprehensive node information
  };

  // Handle conversation goals changes
  const handleGoalsChange = (goals: ConversationGoal[]) => {
    setConversationGoals(goals);
  };

  // Handle clearing node selection when switching tabs
  const onVisualizationChange = (newVisualization: VisualizationType) => {
    handleVisualizationChange(newVisualization);
    // Clear any selected node when switching tabs
    setSelectedNodeId(null);
  };


  // Handler for opening person details dialog from Kanban
  const handlePersonDetailsOpen = (personId: string) => {
    let person = peopleRecords.find(p => p.id === personId) || allTimePeopleRecords.find(p => p.id === personId);
    
    if (!person && sharedAllContacts) {
      const contact = sharedAllContacts.find((c: any) => c.vanid?.toString() === personId);
      if (contact) {
        person = {
          id: contact.vanid?.toString() || personId,
          name: `${contact.firstname || ''} ${contact.lastname || ''}`.trim() || `Contact ${personId}`,
          type: contact.type || 'contact',
          chapter: contact.chapter || '',
          mostRecentContact: null,
          totalMeetings: 0,
          latestNotes: '',
          organizers: contact.organizers || [],
          loeStatus: contact.loe_status || 'Unknown',
          allMeetings: [],
          email: contact.email,
          phone: contact.phone
        };
      }
    }

    if (person) {
      setSelectedPersonForDialog(person);
      setPersonDialogOpen(true);
    }
  };

  const handlePersonDialogClose = () => {
    setPersonDialogOpen(false);
    setSelectedPersonForDialog(null);
  };

  const handleSavePersonFromDialog = async (personId: string, updates: PersonUpdate) => {
    const response = await fetch(`${API_BASE_URL}/api/contacts/${personId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) {
      throw new Error('Failed to update person');
    }
    reloadSharedContacts(false);
  };

  const handleDeleteConversationFromDialog = async (meetingId: string) => {
    const response = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error('Failed to delete conversation');
    }
    reloadSharedContacts(true);
  };

  const handleDeletePersonFromDialog = async (personId: string) => {
    const response = await fetch(`${API_BASE_URL}/api/contacts/${personId}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error('Failed to delete person');
    }
    setPersonDialogOpen(false);
    setSelectedPersonForDialog(null);
    reloadSharedContacts(false);
  };

  // Helper function to get LOE status from contacts data
  // Returns RAW LOE values from database (e.g., "1_TeamLeader", not "TeamLeader")
  // Uses allTimeMeetingsData for stability (doesn't change on date range changes)
  const getLOEStatus = React.useCallback((personId: string): string => {
    // Check all-time meetings data for LOE (more stable than date-range filtered data)
    const meeting = allTimeMeetingsData.find(m => 
      m.organizer_vanid?.toString() === personId || 
      m.vanid?.toString() === personId
    );
    
    if (meeting) {
      // Check if they're an organizer or contact
      if (meeting.organizer_vanid?.toString() === personId) {
        // They're an organizer - check for organizer LOE field
        const organizerLOE = (meeting as any).organizer_loe || (meeting as any).organizer_contact_loe;
        if (organizerLOE) {
          return organizerLOE; // Return raw value from database
        }
        return 'Staff'; // Default for organizers without LOE data
      } else {
        // They're a contact - check contact LOE field
        const contactLOE = (meeting as any).contact_loe;
        if (contactLOE) {
          return contactLOE; // Return raw value from database
        }
      }
    }

    // Skip contacts data check in MainApp - will be handled in individual panels if needed

    return 'Unknown';
  }, [allTimeMeetingsData]);

  // Helper function to normalize names (same logic as in name merging)
  const normalizeDisplayName = (name: string): string => {
    // Full name replacements for specific cases
    const fullNameReplacements = new Map<string, string>([
      ['lutfi hussein', 'Leo Hussein'],
      ['lufti hussein', 'Leo Hussein'],
      ['lutfi hussein', 'Leo Hussein'], // Handle case variations
      ['lufti hussein', 'Leo Hussein'],
    ]);
    
    const normalizedFull = name.toLowerCase().trim();
    const directReplacement = fullNameReplacements.get(normalizedFull);
    if (directReplacement) {
      return directReplacement;
    }
    
    // Handle first name normalization for other cases
    const nameVariations = new Map<string, string>([
      ['lufti', 'leo'],
      ['lutfi', 'leo'],
      ['ben', 'benjamin'],
      ['benny', 'benjamin'],
    ]);
    
    const nameParts = name.split(' ');
    if (nameParts.length === 0) return name;
    
    const firstName = nameParts[0]?.toLowerCase().trim();
    if (!firstName) return name;
    
    const normalizedFirstName = nameVariations.get(firstName) || firstName;
    
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
    
    return name;
  };

  // Helper function for consistent name resolution
  const getConsistentName = React.useCallback((vanId: number | undefined, apiBuiltName: string | undefined, role: 'organizer' | 'contact', meeting?: any): string => {
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
          return normalizeDisplayName(fullName);
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
          return normalizeDisplayName(fullName);
        }
      }
      if (orgInfo.name && orgInfo.name.trim() && orgInfo.name !== 'null null') {
        return normalizeDisplayName(orgInfo.name.trim());
      }
    }

    // PRIORITY 3: API pre-built names (from server name resolution)
    if (apiBuiltName && apiBuiltName.trim() && apiBuiltName !== 'null null') {
      return normalizeDisplayName(apiBuiltName.trim());
    }

    // PRIORITY 4: userMap (backup)
    const userInfo = userMap.get(vanId.toString()) || {};
    if (userInfo.name && userInfo.name.trim() && userInfo.name !== 'null null') {
      return normalizeDisplayName(userInfo.name.trim());
    } else if ((userInfo.firstname && userInfo.firstname !== 'null') || (userInfo.lastname && userInfo.lastname !== 'null')) {
      const firstName = userInfo.firstname && userInfo.firstname !== 'null' ? userInfo.firstname.trim() : '';
      const lastName = userInfo.lastname && userInfo.lastname !== 'null' ? userInfo.lastname.trim() : '';
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName) {
        return normalizeDisplayName(fullName);
      }
    }

    // PRIORITY 5: Fallback with VAN ID (but try to make it more user-friendly)
    return `Person ${vanId}`;
  }, [orgIds, userMap]);

  // Create people records from meetings (current date range)
  const peopleRecords = React.useMemo(() => {
    if (!meetingsData || meetingsData.length === 0) {
      return [];
    }

    const peopleMap = new Map<string, any>();

    meetingsData.forEach((meeting, index) => {
      // Only skip if both vanid AND organizer_vanid are missing (completely empty record)
      if (!meeting.vanid && !meeting.organizer_vanid) {
        return;
      }
      
      // Use placeholder IDs if missing, but still process the meeting
      const organizeeId = meeting.vanid ? meeting.vanid.toString() : `unknown_contact_${index}`;
      
      // Process organizee
      if (!peopleMap.has(organizeeId)) {
        // Use consistent name resolution
        const name = getConsistentName(meeting.vanid, meeting.contact, 'contact', meeting);
        
        // Get additional info for PersonRecord fields
        const userInfo = meeting.vanid ? (userMap.get(meeting.vanid) || {}) : {};
        const orgInfo = meeting.vanid ? orgIds.find(p => p.vanid && p.vanid.toString() === organizeeId) : null;
        
        const personRecord = {
          id: organizeeId,
          name: name,
          type: userInfo.type || orgInfo?.type || 'contact',
          chapter: meeting.chapter || userInfo.chapter || orgInfo?.chapter || 'Unknown',
          email: userInfo.email || orgInfo?.email || meeting.email,
          phone: userInfo.phone || orgInfo?.phone,
          mostRecentContact: null,
          mostRecentContactAllTime: null,
          totalMeetings: 0,
          totalMeetingsAllTime: 0,
          latestNotes: '',
          organizers: [],
          loeStatus: getLOEStatus(organizeeId),
          memberStatus: meeting.member_status || orgInfo?.member_status,
          allMeetings: [],
          allMeetingsAllTime: []
        };
        peopleMap.set(organizeeId, personRecord);
      }

      const person = peopleMap.get(organizeeId)!;
      
      // Check if this meeting is already in the person's allMeetings to prevent duplicates
      const dateString = typeof meeting.datestamp === 'object' ? meeting.datestamp.value : meeting.datestamp;
      const meetingKey = `${meeting.organizer_vanid}-${meeting.vanid}-${dateString}-${meeting.meeting_type}-${meeting.notes_purpose || ''}-${meeting.notes_commitments || ''}`;
      
      const isDuplicate = person.allMeetings.some((existingMeeting: any) => {
        const existingDateString = typeof existingMeeting.datestamp === 'object' ? existingMeeting.datestamp.value : existingMeeting.datestamp;
        const existingKey = `${existingMeeting.organizer_vanid}-${existingMeeting.vanid}-${existingDateString}-${existingMeeting.meeting_type}-${existingMeeting.notes_purpose || ''}-${existingMeeting.notes_commitments || ''}`;
        return existingKey === meetingKey;
      });
      
      if (!isDuplicate) {
        // Update meeting count and add meeting only if it's not a duplicate
        person.totalMeetings += 1;
        person.allMeetings.push(meeting);
      } else {
        // console.log(`MainApp: Skipping duplicate meeting for person ${organizeeId}: ${meetingKey}`);
      }

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

      // Track organizers - use consistent name resolution AND canonicalization
      const organizerName = getConsistentName(meeting.organizer_vanid, meeting.organizer, 'organizer');
      // Canonicalize using the organizer mapping table (e.g., "Lefty" -> "Leo Hussein")
      const canonicalOrganizerName = getCanonicalOrganizerName(organizerName, organizerMappings);
      
      if (!person.organizers.includes(canonicalOrganizerName)) {
        person.organizers.push(canonicalOrganizerName);
      }
    });

    // Enrich with contacts data (total_meetings_all_time, etc.)
    contactsData.forEach((contact: any) => {
      const contactId = contact.vanid?.toString();
      if (contactId && peopleMap.has(contactId)) {
        const person = peopleMap.get(contactId)!;
        person.totalMeetingsAllTime = contact.total_meetings_all_time || 0;
        // Also update last contact date if available from API
        if (contact.last_contact_date) {
          const apiDate = new Date(contact.last_contact_date);
          if (!isNaN(apiDate.getTime())) {
            person.mostRecentContactAllTime = apiDate;
            // Update mostRecentContact if this is more recent
            if (!person.mostRecentContact || apiDate > person.mostRecentContact) {
              person.mostRecentContact = apiDate;
            }
          }
        }
      }
    });

    return Array.from(peopleMap.values());
  }, [meetingsData, userMap, orgIds, contactsData, getConsistentName, getLOEStatus]); // Removed organizerMappings to prevent infinite loop

  // Create all-time people records for Dashboard "My People"
  const allTimePeopleRecords = React.useMemo(() => {
    if (!allTimeMeetingsData || allTimeMeetingsData.length === 0) {
      return [];
    }

    const peopleMap = new Map<string, any>();

    allTimeMeetingsData.forEach((meeting, index) => {
      // Only skip if both vanid AND organizer_vanid are missing (completely empty record)
      if (!meeting.vanid && !meeting.organizer_vanid) {
        return;
      }
      
      // Use placeholder IDs if missing, but still process the meeting
      const organizeeId = meeting.vanid ? meeting.vanid.toString() : `unknown_contact_${index}`;
      
      // Process organizee
      if (!peopleMap.has(organizeeId)) {
        // Use consistent name resolution
        const name = getConsistentName(meeting.vanid, meeting.contact, 'contact', meeting);
        
        // Get additional info for PersonRecord fields
        const userInfo = meeting.vanid ? (userMap.get(meeting.vanid) || {}) : {};
        const orgInfo = meeting.vanid ? orgIds.find(p => p.vanid && p.vanid.toString() === organizeeId) : null;
        
        const personRecord = {
          id: organizeeId,
          name: name,
          type: userInfo.type || orgInfo?.type || 'contact',
          chapter: meeting.chapter || userInfo.chapter || orgInfo?.chapter || 'Unknown',
          email: userInfo.email || orgInfo?.email || meeting.email,
          phone: userInfo.phone || orgInfo?.phone,
          mostRecentContact: null,
          totalMeetings: 0,
          latestNotes: '',
          organizers: [],
          loeStatus: getLOEStatus(organizeeId),
          memberStatus: meeting.member_status || orgInfo?.member_status,
          allMeetings: []
        };
        peopleMap.set(organizeeId, personRecord);
      }

      const person = peopleMap.get(organizeeId)!;
      
      // Check if this meeting is already in the person's allMeetings to prevent duplicates
      const dateString = typeof meeting.datestamp === 'object' ? meeting.datestamp.value : meeting.datestamp;
      const meetingKey = `${meeting.organizer_vanid}-${meeting.vanid}-${dateString}-${meeting.meeting_type}-${meeting.notes_purpose || ''}-${meeting.notes_commitments || ''}`;
      
      const isDuplicate = person.allMeetings.some((existingMeeting: any) => {
        const existingDateString = typeof existingMeeting.datestamp === 'object' ? existingMeeting.datestamp.value : existingMeeting.datestamp;
        const existingKey = `${existingMeeting.organizer_vanid}-${existingMeeting.vanid}-${existingDateString}-${existingMeeting.meeting_type}-${existingMeeting.notes_purpose || ''}-${existingMeeting.notes_commitments || ''}`;
        return existingKey === meetingKey;
      });
      
      if (!isDuplicate) {
        // Update meeting count and add meeting only if it's not a duplicate
        person.totalMeetings += 1;
        person.allMeetings.push(meeting);
      }

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

      // Track organizers - use consistent name resolution AND canonicalization
      const organizerName = getConsistentName(meeting.organizer_vanid, meeting.organizer, 'organizer');
      // Canonicalize using the organizer mapping table (e.g., "Lefty" -> "Leo Hussein")
      const canonicalOrganizerName = getCanonicalOrganizerName(organizerName, organizerMappings);
      
      if (!person.organizers.includes(canonicalOrganizerName)) {
        person.organizers.push(canonicalOrganizerName);
      }
    });

    // Enrich with contacts data (total_meetings_all_time, primary_organizer_vanid, etc.)
    contactsData.forEach((contact: any) => {
      const contactId = contact.vanid?.toString();
      if (contactId && peopleMap.has(contactId)) {
        const person = peopleMap.get(contactId)!;
        if (contact.primary_organizer_vanid) {
          person.primary_organizer_vanid = contact.primary_organizer_vanid.toString();
        }
        if (contact.last_contact_date) {
          const apiDate = new Date(contact.last_contact_date);
          if (!isNaN(apiDate.getTime())) {
            if (!person.mostRecentContact || apiDate > person.mostRecentContact) {
              person.mostRecentContact = apiDate;
            }
          }
        }
      }
    });

    return Array.from(peopleMap.values());
  }, [allTimeMeetingsData, userMap, orgIds, contactsData, getConsistentName, getLOEStatus]); // Removed organizerMappings to prevent infinite loop

  // Apply people filters (shared between People Panel and Leadership Kanban)
  const filteredPeopleRecords = React.useMemo(() => {
    let filtered = peopleRecords;

    // Apply search filters
    if (peopleFilters.searchText) {
      const searchLower = peopleFilters.searchText.toLowerCase();
      filtered = filtered.filter(person =>
        person.name.toLowerCase().includes(searchLower) ||
        person.chapter.toLowerCase().includes(searchLower) ||
        person.organizers.some((org: string) => org.toLowerCase().includes(searchLower)) ||
        person.latestNotes.toLowerCase().includes(searchLower)
      );
    }

    // Apply organizer filter
    if (peopleFilters.organizer) {
      const organizerLower = peopleFilters.organizer.toLowerCase();
      filtered = filtered.filter(person =>
        person.organizers.some((org: string) => org.toLowerCase().includes(organizerLower))
      );
    }

    // Apply chapter filter
    if (peopleFilters.chapter) {
      const chapterLower = peopleFilters.chapter.toLowerCase();
      filtered = filtered.filter(person =>
        person.chapter.toLowerCase().includes(chapterLower)
      );
    }

    // Apply LOE status filter (multi-select) - exact match on raw values
    if (peopleFilters.loeStatus.length > 0) {
      filtered = filtered.filter(person => {
        const personLOE = person.loeStatus || 'Unknown';
        // Direct match against filter values (raw database format)
        return peopleFilters.loeStatus.includes(personLOE);
      });
    }

    // Apply membership status filter (multi-select)
    if (peopleFilters.memberStatus.length > 0) {
      filtered = filtered.filter(person => {
        const personMemberStatus = person.memberStatus || 'Unknown';
        return peopleFilters.memberStatus.includes(personMemberStatus);
      });
    }

    // Apply last contact filter
    if (peopleFilters.lastContactFilter !== 'all') {
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      filtered = filtered.filter(person => {
        const lastContact = person.mostRecentContact;
        
        switch (peopleFilters.lastContactFilter) {
          case 'within_7_days':
            return lastContact && lastContact >= sevenDaysAgo;
          case 'within_30_days':
            return lastContact && lastContact >= thirtyDaysAgo;
          case 'within_3_months':
            return lastContact && lastContact >= threeMonthsAgo;
          case 'over_30_days':
            return !lastContact || lastContact < thirtyDaysAgo;
          case 'over_3_months':
            return !lastContact || lastContact < threeMonthsAgo;
          case 'over_6_months':
            return !lastContact || lastContact < sixMonthsAgo;
          case 'never':
            return !lastContact;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [peopleRecords, peopleFilters]);

  // Fetch filtered contacts for Kanban (separate from PeoplePanel pagination)
  const [kanbanContacts, setKanbanContacts] = React.useState<any[]>([]);
  const [loeCounts, setLoeCounts] = React.useState<{ total: number; by_loe: { [key: string]: number } }>({ total: 0, by_loe: {} });
  const [kanbanLoading, setKanbanLoading] = React.useState(false);
  const kanbanFetchRef = React.useRef(false);
  const lastKanbanFiltersRef = React.useRef<string>('');
  
  // Create stable filter key for comparison
  const kanbanFilterKey = React.useMemo(() => JSON.stringify({
    chapter: unifiedFilters.chapter,
    loeStatus: unifiedFilters.loeStatus.sort().join(','),
    memberStatus: unifiedFilters.memberStatus.sort().join(','),
    searchText: unifiedFilters.searchText
  }), [unifiedFilters.chapter, unifiedFilters.loeStatus, unifiedFilters.memberStatus, unifiedFilters.searchText]);
  
  React.useEffect(() => {
    // Skip if filters haven't actually changed (check immediately before debounce)
    if (lastKanbanFiltersRef.current === kanbanFilterKey && currentVisualization === 'people') {
      return;
    }
    
    // Debounce search text to avoid fetching on every keystroke
    const searchDebounceTimer = setTimeout(() => {
      const fetchKanbanContacts = async () => {
        // Prevent concurrent fetches
        if (kanbanFetchRef.current || kanbanLoading) {
          return;
        }

        try {
          lastKanbanFiltersRef.current = kanbanFilterKey;
          kanbanFetchRef.current = true;
          setKanbanLoading(true);
        
        // Fetch contacts for Kanban - start with just 50 for fast initial load
        // The accurate counts come from fetchLOECounts, not from this list
        const params: any = {
          sortBy: 'mostRecentContact',
          sortOrder: 'DESC',
          limit: 50,
          offset: 0
        };
        
        // Apply filters
        if (unifiedFilters.chapter) {
          params.chapter = unifiedFilters.chapter;
        }
        if (unifiedFilters.loeStatus.length > 0) {
          params.loe = unifiedFilters.loeStatus.join(',');
        }
        if (unifiedFilters.memberStatus.length > 0) {
          params.member_status = unifiedFilters.memberStatus.join(',');
        }
        if (unifiedFilters.searchText) {
          params.search = unifiedFilters.searchText;
        }
        
        // Fetch both contacts and total LOE counts in parallel
        const [contactsResponse, countsResponse] = await Promise.all([
          fetchContacts(params),
          fetchLOECounts({
            chapter: unifiedFilters.chapter,
            member_status: unifiedFilters.memberStatus.length > 0 ? unifiedFilters.memberStatus.join(',') : undefined,
            search: unifiedFilters.searchText
          })
        ]);
        
        // Resolve organizer names to canonical form
        const resolvedKanbanContacts = (contactsResponse.data || []).map(contact => ({
          ...contact,
          organizers: contact.organizers?.map(organizer => 
            getCanonicalOrganizerName(organizer, organizerMappings)
          )
        }));
        
        setKanbanContacts(resolvedKanbanContacts);
        setLoeCounts(countsResponse);
      } catch (error) {
        console.error('Error fetching Kanban contacts:', error);
      } finally {
          kanbanFetchRef.current = false;
          setKanbanLoading(false);
        }
      };
      
      // Only fetch if we're on people view
      if (currentVisualization === 'people') {
        fetchKanbanContacts();
      }
    }, unifiedFilters.searchText ? 300 : 0); // 300ms debounce for search, immediate for other filters
    
    return () => clearTimeout(searchDebounceTimer);
  }, [kanbanFilterKey, currentVisualization, mappingsReady]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Convert Kanban contacts to people records format (excludes Unknown and Null LOE)
  // Enrich with organizer data and meetings from meetings data
  const kanbanPeopleRecords = React.useMemo(() => {
    // Build maps of contact ID -> organizers and meetings from meetings data
    const contactOrganizersMap = new Map<string, Set<string>>();
    const contactMeetingsMap = new Map<string, any[]>();
    
    meetingsData.forEach((meeting: any) => {
      if (meeting.vanid) {
        const contactId = meeting.vanid.toString();
        
        // Track organizers
        if (!contactOrganizersMap.has(contactId)) {
          contactOrganizersMap.set(contactId, new Set());
        }
        const organizerName = getConsistentName(meeting.organizer_vanid, meeting.organizer, 'organizer');
        if (organizerName && !organizerName.includes('Unknown')) {
          contactOrganizersMap.get(contactId)!.add(organizerName);
        }
        
        // Track meetings for time-based calculations
        if (!contactMeetingsMap.has(contactId)) {
          contactMeetingsMap.set(contactId, []);
        }
        contactMeetingsMap.get(contactId)!.push(meeting);
      }
    });
    
    return kanbanContacts
      .filter(contact => {
        const loe = contact.loe?.toLowerCase() || '';
        return loe && loe !== 'unknown' && loe !== 'null' && loe !== '';
      })
      .map(contact => {
        const contactId = contact.vanid?.toString() || '';
        const name = `${contact.firstname || ''} ${contact.lastname || ''}`.trim() || `Contact ${contactId}`;
        
        // Get organizers for this contact
        const organizers = contactOrganizersMap.has(contactId) 
          ? Array.from(contactOrganizersMap.get(contactId)!)
          : [];
        
        // Get meetings for this contact (for time-based breakdown in tooltip)
        const allMeetings = contactMeetingsMap.get(contactId) || [];
        
        return {
          id: contactId,
          name: name,
          type: 'contact',
          chapter: contact.chapter || 'Unknown',
          email: contact.email || undefined,
          phone: undefined,
          mostRecentContact: contact.last_contact_date ? new Date(contact.last_contact_date) : null,
          mostRecentContactAllTime: contact.last_contact_date ? new Date(contact.last_contact_date) : null,
          totalMeetings: contact.total_meetings_all_time || 0, // Use all-time count for Kanban
          totalMeetingsAllTime: contact.total_meetings_all_time || 0,
          latestNotes: '',
          organizers: organizers,
          loeStatus: contact.loe || 'Unknown',
          memberStatus: contact.member_status || undefined,
          allMeetings: allMeetings,
          allMeetingsAllTime: allMeetings
        };
      })
      .filter(person => {
        // Apply organizer filter client-side (since API doesn't support it)
        if (unifiedFilters.organizer) {
          const organizerLower = unifiedFilters.organizer.toLowerCase();
          return person.organizers.some((org: string) => 
            org.toLowerCase().includes(organizerLower)
          );
        }
        return true;
      });
  }, [kanbanContacts, meetingsData, unifiedFilters.organizer]);

  // Re-enhance teams data when orgIds and contactsData become available (after early load)
  React.useEffect(() => {
    const reEnhanceTeamsData = async () => {
      // Wait for both early teams load AND orgIds/contactsData to be available
      if (!earlyTeamsReady || orgIds.length === 0 || contactsData.length === 0) return;
      if (teamsLoading || teamsEnhancedRef.current) return; // Prevent concurrent loads and repeated enhancements
      
      setTeamsLoading(true);
      
      try {
        // Create minimal peopleRecords from orgIds for team member matching
        const minimalPeopleRecords = orgIds.map((org: any) => ({
          id: org.vanid?.toString() || org.userid?.toString() || `org_${Math.random()}`,
          name: `${org.firstname || ''} ${org.lastname || ''}`.trim() || 'Unknown',
          type: org.type || 'organizer',
          chapter: org.chapter || 'Unknown',
          mostRecentContact: null,
          totalMeetings: 0,
          latestNotes: '',
          organizers: [],
          loeStatus: org.loe_status || 'Unknown',
          allMeetings: [],
          email: org.email,
          phone: org.phone
        }));
        
        const enhancedTeams = await teamsService.loadEnhancedTeams(
          minimalPeopleRecords,
          contactsData,
          orgIds
        );
        
        if (enhancedTeams.length > 0) {
          // console.log('[MainApp] Re-enhanced', enhancedTeams.length, 'teams');
          setTeamsData(enhancedTeams);
          teamsEnhancedRef.current = true; // Mark as enhanced to prevent re-runs
        }
      } catch (error) {
        console.error('Error re-enhancing teams:', error);
      } finally {
        setTeamsLoading(false);
      }
    };
    
    reEnhanceTeamsData();
  }, [orgIds, contactsData, earlyTeamsReady]);
  
  // Monitor when all critical data is loaded to prevent visualization jittering
  React.useEffect(() => {
    if (dataReady) return;
    
    // Only require loading to be done - don't block on orgIds or teams data
    if (!loading && !teamsLoading) {
      const timer = setTimeout(() => {
        setDataReady(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, teamsLoading, dataReady]);
  
  // Stable callback to prevent infinite re-renders
  const handleTeamsDataChange = React.useCallback((teams: any[]) => {
    setTeamsData(teams);
  }, []);

  // Refresh teams data
  const handleRefreshTeams = React.useCallback(async () => {
    setTeamsLoading(true);
    try {
      const minimalPeopleRecords = orgIds.map((org: any) => ({
        id: org.vanid?.toString() || org.userid?.toString() || `org_${Math.random()}`,
        name: `${org.firstname || ''} ${org.lastname || ''}`.trim() || 'Unknown',
        type: org.type || 'organizer',
        chapter: org.chapter || 'Unknown',
        mostRecentContact: null,
        totalMeetings: 0,
        latestNotes: '',
        organizers: [],
        loeStatus: org.loe_status || 'Unknown',
        allMeetings: [],
        email: org.email,
        phone: org.phone
      }));
      
      const enhancedTeams = await teamsService.loadEnhancedTeams(
        minimalPeopleRecords,
        contactsData,
        orgIds
      );
      
      if (enhancedTeams.length > 0) {
        setTeamsData(enhancedTeams);
      }
    } catch (error) {
      console.error('Error refreshing teams:', error);
    } finally {
      setTeamsLoading(false);
    }
  }, [orgIds, contactsData]);

  // Process meetings data into nodes and links for network graph (date-filtered for main views)
  // This must be before any early returns to follow React hooks rules
  const { processedNodes, processedLinks } = React.useMemo(() => {
    if (!meetingsData || meetingsData.length === 0) {
      return { processedNodes: [], processedLinks: [] };
    }

    const nodeMap = new Map<string, Node>();
    const linkMap = new Map<string, any>();

    // Process meetings to create nodes and links
    meetingsData.forEach(meeting => {
      // Create organizer node
      if (meeting.organizer_vanid) {
        const organizerId = meeting.organizer_vanid.toString();
        if (!nodeMap.has(organizerId)) {
          const organizerInfo = userMap.get(organizerId) || {};
          const orgInfo = orgIds.find(org => org.vanid?.toString() === organizerId);
          
          nodeMap.set(organizerId, {
            id: organizerId,
            name: meeting.organizer || organizerInfo.name || `${organizerInfo.firstname || ''} ${organizerInfo.lastname || ''}`.trim() || `Organizer ${organizerId}`,
            chapter: meeting.chapter || organizerInfo.chapter || orgInfo?.chapter || 'Unknown',
            type: 'staff',
            color: '#1f77b4',
            x: Math.random() * 800,
            y: Math.random() * 600
          });
        }
      }

      // Create contact/organizee node
      if (meeting.vanid) {
        const contactId = meeting.vanid.toString();
        if (!nodeMap.has(contactId)) {
          const contactInfo = userMap.get(contactId) || {};
          const orgInfo = orgIds.find(org => org.vanid?.toString() === contactId);
          
          nodeMap.set(contactId, {
            id: contactId,
            name: meeting.contact || contactInfo.name || `${contactInfo.firstname || ''} ${contactInfo.lastname || ''}`.trim() || `Contact ${contactId}`,
            chapter: meeting.chapter || contactInfo.chapter || orgInfo?.chapter || 'Unknown',
            type: 'contact',
            color: '#ff7f0e',
            x: Math.random() * 800,
            y: Math.random() * 600
          });
        }
      }

      // Create link between organizer and contact
      if (meeting.organizer_vanid && meeting.vanid) {
        const sourceId = meeting.organizer_vanid.toString();
        const targetId = meeting.vanid.toString();
        const linkKey = sourceId < targetId ? `${sourceId}-${targetId}` : `${targetId}-${sourceId}`;
        
        if (!linkMap.has(linkKey)) {
          const sourceNode = nodeMap.get(sourceId);
          const targetNode = nodeMap.get(targetId);
          
          if (sourceNode && targetNode) {
            linkMap.set(linkKey, {
              source: sourceNode,
              target: targetNode,
              date: new Date(typeof meeting.datestamp === 'object' ? meeting.datestamp.value : meeting.datestamp),
              type: meeting.meeting_type || 'meeting',
              result: 'success',
              utc_datecanvassed: typeof meeting.datestamp === 'object' ? meeting.datestamp.value : meeting.datestamp,
              contact_type: meeting.meeting_type || 'meeting',
              contact_result: 'completed',
              linkSource: 'meetings' as const,
              meetingId: `${meeting.organizer_vanid}-${meeting.vanid}-${typeof meeting.datestamp === 'object' ? meeting.datestamp.value : meeting.datestamp}`
            });
          }
        }
      }
    });

    return {
      processedNodes: Array.from(nodeMap.values()),
      processedLinks: Array.from(linkMap.values())
    };
  }, [meetingsData, userMap, orgIds]);

  // Process ALL-TIME meetings for Dashboard (lightweight - only builds network relationships)
  // This ensures leaders and their nested relationships are calculated from full history
  const { processedNodes: allTimeNodes, processedLinks: allTimeLinks } = React.useMemo(() => {
    if (!allTimeMeetingsData || allTimeMeetingsData.length === 0) {
      // Fallback to date-filtered data if all-time not available
      return { processedNodes, processedLinks };
    }

    // Only build the essential node/link structure - no heavy processing
    const nodeMap = new Map<string, Node>();
    const linkMap = new Map<string, any>();

    allTimeMeetingsData.forEach((meeting) => {
      const organizerVanId = meeting.organizer_vanid?.toString();
      const participantVanId = meeting.vanid?.toString();

      // Add organizer node
      if (organizerVanId && !nodeMap.has(organizerVanId)) {
        const organizerInfo = userMap.get(organizerVanId);
        nodeMap.set(organizerVanId, {
          id: organizerVanId,
          name: getConsistentName(meeting.organizer_vanid, meeting.organizer, 'organizer'),
          type: 'organizer',
          chapter: meeting.chapter || organizerInfo?.chapter || 'Unknown',
          color: '#1976d2',
          x: 0,
          y: 0
        });
      }

      // Add participant node
      if (participantVanId && !nodeMap.has(participantVanId)) {
        nodeMap.set(participantVanId, {
          id: participantVanId,
          name: getConsistentName(meeting.vanid, meeting.contact, 'contact'),
          type: 'contact',
          chapter: meeting.chapter || 'Unknown',
          color: '#4caf50',
          x: 0,
          y: 0
        });
      }

      // Add link
      if (organizerVanId && participantVanId) {
        const linkKey = `${organizerVanId}-${participantVanId}`;
        if (!linkMap.has(linkKey)) {
          linkMap.set(linkKey, {
            source: organizerVanId,
            target: participantVanId,
            type: 'conversation',
            contact_type: meeting.meeting_type || 'Meeting',
            contact_result: 'completed',
            linkSource: 'meetings' as const
          });
        }
      }
    });

    return {
      processedNodes: Array.from(nodeMap.values()),
      processedLinks: Array.from(linkMap.values())
    };
  }, [allTimeMeetingsData, processedNodes, processedLinks, userMap, getConsistentName]);

  // Network graph data processing (extracted to hook)
  // Always use 'connections' view for Teams tab to show all contacts + relationships
  // Use allTimeMeetingsData so network can filter by its own date range
  const { networkNodes: allNetworkNodes, networkLinks: allNetworkLinks, networkTeamCenters } = useNetworkData({
    teamsData,
    meetingsData: allTimeMeetingsData, // Use all-time meetings, let hook filter by network date range
    networkView: 'connections', // Force connections view for Teams tab
    selectedLOELevels,
    selectedChapter,
    getLOEStatus,
    getConsistentName,
    networkStartDate,
    networkEndDate
  });
  
  // Helper function to extract LOE category from node's loeStatus
  // Returns the RAW LOE value to match against filter (e.g., "1_TeamLeader")
  const getNodeLOECategory = React.useCallback((node: any): string => {
    const loeStatus = node.loeStatus || 'Unknown';
    
    // Return the raw LOE value as-is for matching
    // This preserves the database format (e.g., "1_TeamLeader", "Staff", "Unknown")
    return loeStatus;
  }, []);
  
  // Client-side filtering by chapter and LOE (to avoid recalculating network graph)
  const { networkNodes, networkLinks } = React.useMemo(() => {
    let filteredNodes = allNetworkNodes;
    
    // Filter by chapter
    if (selectedChapter && selectedChapter !== `All ${TERMS.chapters}`) {
      filteredNodes = filteredNodes.filter(node => node.chapter === selectedChapter);
    }
    
    // Filter by LOE status - only apply when the user has explicitly selected values
    // Empty filter = show all nodes (default state before meetings data loads)
    if (networkLOEFilter.length > 0) {
      filteredNodes = filteredNodes.filter(node => {
        const nodeLOECategory = getNodeLOECategory(node);
        return networkLOEFilter.includes(nodeLOECategory);
      });
    }

    // Filter by team name
    if (unifiedFilters.teamType) {
      const selectedTeam = unifiedFilters.teamType;
      filteredNodes = filteredNodes.filter(node => {
        return node.teams?.includes(selectedTeam) || node.type === 'section_leader';
      });
    }
    
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    
    // Filter existing links to only include those between filtered nodes
    let filteredLinks = allNetworkLinks.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId);
    });
    
    // Add leadership hierarchy links
    const leadershipLinks: any[] = [];
    leaderHierarchy.forEach((relationship: any) => {
      const leaderId = relationship.leader_vanid?.toString();
      const reportId = relationship.report_vanid?.toString();
      
      // Only add if both nodes are in the filtered set
      if (leaderId && reportId && filteredNodeIds.has(leaderId) && filteredNodeIds.has(reportId)) {
        // Check if this link doesn't already exist (as a team or meeting link)
        const linkExists = filteredLinks.some(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          return (sourceId === leaderId && targetId === reportId) || 
                 (sourceId === reportId && targetId === leaderId);
        });
        
        if (!linkExists) {
          leadershipLinks.push({
            source: leaderId,
            target: reportId,
            linkSource: 'leadership',
            type: 'leadership',
            strength: 0.5
          });
        }
      }
    });
    
    // ── Section-leader nodes + per-team representative links ────────────────
    // Each section (Alyssa / Zoe / etc.) gets one node and ONE link to each
    // team they lead, connecting to the highest-degree member of that team.
    const sectionLeaderNewNodes: any[] = [];
    const sectionLeaderLinks: any[] = [];
    const sectionLeaderIdMap = new Map<string, string>(); // sectionName → nodeId

    teamsData.forEach((team: any) => {
      const sectionName: string = team.chapter || team.bigQueryData?.chapter;
      if (!sectionName || !team.organizers?.length) return;

      // Respect chapter filter
      if (selectedChapter && selectedChapter !== `All ${TERMS.chapters}` && selectedChapter !== sectionName) return;

      // Find or create the section leader node (once per section)
      if (!sectionLeaderIdMap.has(sectionName)) {
        // Look up the section lead from the DB-seeded sectionLeads
        const sectionEntry = sectionLeads.find(
          (s: SectionLead) => s.chapter_name?.toLowerCase() === sectionName.toLowerCase()
        );

        let leaderId: string;
        let leaderName: string;

        if (sectionEntry?.lead_vanid) {
          leaderId = sectionEntry.lead_vanid;
          leaderName = [sectionEntry.lead_firstname, sectionEntry.lead_lastname]
            .filter(Boolean).join(' ') || sectionName;
        } else {
          // Fallback: try to find by first name in orgIds (legacy behavior)
          const sectionLower = sectionName.toLowerCase();
          const leaderOrg = (orgIds as any[]).find((org: any) =>
            (org.firstname || '').trim().toLowerCase() === sectionLower
          );
          leaderId = leaderOrg?.vanid?.toString() || `section_leader_${sectionName}`;
          leaderName = leaderOrg
            ? `${(leaderOrg.firstname || '')} ${(leaderOrg.lastname || '')}`.trim()
            : sectionName;
        }

        sectionLeaderIdMap.set(sectionName, leaderId);

        if (!filteredNodeIds.has(leaderId)) {
          sectionLeaderNewNodes.push({
            id: leaderId,
            name: leaderName,
            chapter: sectionName,
            type: 'section_leader',
            degree: (teamsData as any[]).filter((t: any) => (t.chapter || t.bigQueryData?.chapter) === sectionName).length,
            x: 0,
            y: 0,
          });
          filteredNodeIds.add(leaderId);
        }
      }

      const leaderId = sectionLeaderIdMap.get(sectionName)!;

      // Link section leader to the team lead (or highest-degree member) of each team
      const candidates = (team.organizers as any[])
        .map((m: any) => {
          const id = String(m.id ?? '');
          const node = filteredNodes.find((n: any) => n.id === id);
          return node ? { id, degree: (node as any).degree || 0, isLead: id === team.lead?.id } : null;
        })
        .filter(Boolean) as Array<{ id: string; degree: number; isLead: boolean }>;

      if (candidates.length === 0) return;

      // Prefer team lead, then highest-degree member
      const teamLead = candidates.find(c => c.isLead);
      const target = teamLead || candidates.sort((a, b) => b.degree - a.degree)[0];

      if (target.id !== leaderId) {
        sectionLeaderLinks.push({
          source: leaderId,
          target: target.id,
          type: 'section_leader',
          linkSource: 'section_leader',
          teamName: team.teamName,
        });
      }
    });

    if (sectionLeaderNewNodes.length > 0) {
      filteredNodes = [...filteredNodes, ...sectionLeaderNewNodes];
    }

    // ── Constituent nodes + edges (when constituents mode is active) ──────
    const constituentNodes: any[] = [];
    const constituentLinks: any[] = [];
    if (networkMode === 'constituents' && sharedAllContacts.length > 0) {
      const existingNodeIds = new Set(filteredNodes.map(n => n.id));

      sharedAllContacts.forEach((contact: any) => {
        const contactId = contact.vanid?.toString();
        const organizerId = contact.primary_organizer_vanid?.toString();
        if (!contactId || !organizerId) return;
        if (existingNodeIds.has(contactId)) return; // skip people already in the network (organizers)
        if (!existingNodeIds.has(organizerId)) return; // skip if their organizer isn't visible

        const contactName = `${contact.firstname || ''} ${contact.lastname || ''}`.trim() || `Contact ${contactId}`;
        const loeStatus = contact.loe || getLOEStatus(contactId);

        constituentNodes.push({
          id: contactId,
          name: contactName,
          chapter: contact.chapter || 'Unknown',
          type: 'constituent',
          loeStatus,
          color: '#999',
          x: 0,
          y: 0,
          degree: 0,
        });
        existingNodeIds.add(contactId);

        constituentLinks.push({
          source: organizerId,
          target: contactId,
          type: 'constituent',
          linkSource: 'contacts',
        });
      });

      filteredNodes = [...filteredNodes, ...constituentNodes];
    }

    // Combine all links
    const allLinks = [...filteredLinks, ...leadershipLinks, ...sectionLeaderLinks, ...constituentLinks];
    
    // Restore saved positions so graph survives tab switches
    const positionedNodes = filteredNodes.map(node => {
      const saved = networkNodePositionsRef.current.get(node.id);
      if (saved) {
        return { ...node, x: saved.x, y: saved.y };
      }
      return node;
    });

    return { networkNodes: positionedNodes, networkLinks: allLinks };
  }, [allNetworkNodes, allNetworkLinks, selectedChapter, networkLOEFilter, leaderHierarchy, getNodeLOECategory, teamsData, orgIds, unifiedFilters.teamType, networkMode, sharedAllContacts, getLOEStatus]);


  const selectedNodeName = React.useMemo(() => {
    if (!selectedNodeId) return null;
    const node = networkNodes.find(n => n.id === selectedNodeId);
    if (node) return node.name;
    const info = userMap.get(selectedNodeId);
    if (info) return info.fullName || `${info.firstname || ''} ${info.lastname || ''}`.trim();
    return selectedNodeId;
  }, [selectedNodeId, networkNodes, userMap]);

  // Render mobile view
  if (isMobile) {
  return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* Mobile view shows simplified Dashboard (My View) */}
        <Box sx={{ 
          bgcolor: 'primary.main', 
          color: 'white', 
          px: 2, 
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            My Dashboard
          </Typography>
        </Box>
        
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Dashboard
            currentUserId={currentUserId}
            currentUserInfo={currentUserInfo}
            parentCampaigns={parentCampaigns}
            nodes={allTimeNodes}
            links={allTimeLinks}
            userMap={userMap}
            onNodeSelect={handleNodeSelection}
            onPersonDetailsOpen={handlePersonDetailsOpen}
            onPersonAdd={() => {
              reloadSharedContacts(false);
            }}
            onConversationLog={() => {
              reloadSharedContacts(true);
            }}
            selectedChapter={selectedChapter}
            teamsData={teamsData}
            peopleRecords={allTimePeopleRecords}
            onRefreshTeams={handleRefreshTeams}
            actions={actions || []}
            allPeople={orgIds.map((org: any) => ({
              id: org.vanid?.toString() || org.userid?.toString() || '',
              name: `${org.firstname || ''} ${org.lastname || ''}`.trim() || 'Unknown',
              type: org.type || 'contact',
              chapter: org.chapter || 'Unknown'
            }))}
            organizers={orgIds.filter((org: any) => org.type === 'organizer').map((org: any) => ({
              id: org.vanid?.toString() || org.userid?.toString() || '',
              name: `${org.firstname || ''} ${org.lastname || ''}`.trim() || 'Unknown',
              type: 'organizer',
              chapter: org.chapter || 'Unknown'
            }))}
            chapters={chapters}
            selectedActions={urlSelectedActions}
            onSelectedActionsChange={handleSelectedActionsChange}
            sharedAllContacts={sharedAllContacts}
            sharedCachedMeetings={sharedCachedMeetings}
            leaderHierarchy={leaderHierarchy}
            onLeaderHierarchyChange={loadLeaderHierarchyData}
            listsData={listsData}
            onListsDataChange={loadListsData}
            organizerGoals={organizerGoals}
            onOrganizerGoalsChange={loadOrganizerGoalsData}
            organizerMappings={organizerMappings}
            onFilterByOrganizer={handleFilterByOrganizer}
            onEditOrganizerMapping={handleEditOrganizerMapping}
            sectionLeads={sectionLeads}
            onSelectedOrganizerChange={(id, name) => {
              setDashboardSelectedOrganizerId(id);
              setDashboardSelectedOrganizerName(name);
            }}
          />
        </Box>
      </Box>
    );
  }

  // Render desktop view - Static top bar (minimal - just title and global controls)
  const topBarContent = (
    <AppBar position="static" elevation={0} sx={{ bgcolor: 'background.paper', borderBottom: `1px solid ${theme.palette.divider}`, zIndex: 1100 }}>
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: 56 }}>
        {/* Left section - Logo, View Mode Toggle, and Navigation Tabs */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Typography variant="h6" sx={{ 
            fontWeight: 600,
            color: 'text.primary'
          }}>
            MLD 377 Data System
          </Typography>

          {/* Simplified Flat Navigation */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 0.25
          }}>
            {/* My View Tab */}
            <Box
              onClick={() => handleViewModeChange('dashboard')}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.25,
                py: 0.5,
                borderRadius: 0.5,
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: viewMode === 'dashboard' ? 600 : 400,
                color: viewMode === 'dashboard' ? 'primary.main' : 'text.secondary',
                bgcolor: viewMode === 'dashboard' ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
                transition: 'all 0.15s ease',
                '&:hover': {
                  color: 'primary.main',
                  bgcolor: 'rgba(25, 118, 210, 0.08)'
                }
              }}
            >
              <DashboardIcon sx={{ fontSize: 16 }} />
              My View
            </Box>
            
            {/* Separator */}
            <Box sx={{ 
              width: '1px', 
              height: 20, 
              bgcolor: '#e0e0e0',
              mx: 0.75
            }} />
            
            {/* {BRANDING.organizationName} Tabs - Always visible */}
            {[
              { value: 'people', label: 'People', icon: <PeopleIcon sx={{ fontSize: 16 }} /> },
              { value: 'teams', label: 'Teams', icon: <TeamsIcon sx={{ fontSize: 16 }} /> },
              { value: 'campaign', label: 'Campaign', icon: <CampaignIcon sx={{ fontSize: 16 }} /> }
            ].map((tab) => (
              <Box
                key={tab.value}
                onClick={() => {
                  // Switch to federation mode and set visualization
                  if (viewMode !== 'federation') {
                    handleViewModeChange('federation');
                  }
                  handleVisualizationChange(tab.value as any);
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1.25,
                  py: 0.5,
                  borderRadius: 0.5,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: viewMode === 'federation' && currentVisualization === tab.value ? 600 : 400,
                  color: viewMode === 'federation' && currentVisualization === tab.value ? 'primary.main' : 'text.secondary',
                  bgcolor: viewMode === 'federation' && currentVisualization === tab.value ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    color: 'primary.main',
                    bgcolor: 'rgba(25, 118, 210, 0.08)'
                  }
                }}
              >
                {tab.icon}
                {tab.label}
              </Box>
            ))}
          </Box>

          {/* Selected node filter chip */}
          {selectedNodeId && selectedNodeName && (
            <Chip
              label={selectedNodeName}
              size="small"
              color="primary"
              variant="outlined"
              onDelete={() => setSelectedNodeId(null)}
              sx={{
                ml: 2,
                fontWeight: 500,
                fontSize: '0.8rem',
                animation: 'fadeIn 0.2s ease',
                '@keyframes fadeIn': {
                  from: { opacity: 0, transform: 'scale(0.9)' },
                  to: { opacity: 1, transform: 'scale(1)' }
                }
              }}
            />
          )}
        </Box>

        {/* Right section - Global Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Unified Filter - Only show in federation mode */}
            {viewMode === 'federation' && (
              <UnifiedFilter
                currentView={currentVisualization}
                filters={unifiedFilters}
                onFiltersChange={(newFilters) => setUnifiedFilters((prev: FilterState) => ({ ...prev, ...newFilters }))}
                availableOptions={filterOptions}
                placeholder={
                  currentVisualization === 'people' ? 'Search people...' :
                  currentVisualization === 'teams' ? 'Search teams...' :
                  currentVisualization === 'campaign' ? 'Search campaigns...' :
                  'Search...'
                }
              />
            )}

            
            {/* Bug Report Button */}
            <Tooltip title="Report a bug">
              <Box
                component="a"
                href="https://docs.google.com/forms/d/e/1FAIpQLSe8DDcNQYZV-qw_SECCBIWUZSGipK-S-tCcoDcierrsNxCHkw/viewform?usp=publish-editor"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  fontSize: '1.35rem',
                  cursor: 'pointer',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  borderRadius: '50%',
                  p: 0.5,
                  transition: 'filter 0.2s ease',
                  '&:hover': { filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }
                }}
              >
                🐞
              </Box>
            </Tooltip>

            {/* User info & Logout */}
            {authUser && onLogout && (
              <Tooltip title={`Signed in as ${authUser.displayName || authUser.email}. Click to sign out.`}>
                <Chip
                  label={authUser.displayName?.split(' ')[0] || authUser.email.split('@')[0]}
                  onClick={onLogout}
                  icon={<LogoutIcon sx={{ fontSize: 14 }} />}
                  size="small"
                  variant="outlined"
                  sx={{ 
                    ml: 0.5,
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                />
              </Tooltip>
            )}
          </Box>
        </Toolbar>
      </AppBar>
  );

  const leftContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      {/* Main Content Area */}
      <Box sx={{ 
        flex: 1,
        overflow: 'hidden', 
        position: 'relative',
        bgcolor: 'background.default' // Use theme's default background (white in light mode)
      }}>
        {/* Show loading indicator until all data is ready */}
        {!dataReady && (
          <Box sx={{ 
            position: 'absolute',
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            textAlign: 'center'
          }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
              Loading data...
            </Typography>
          </Box>
        )}

        {/* Only render visualizations when all data is ready */}
        {dataReady && (
          <>
            {/* People Visualization - Kanban or Timeline */}
            <Box sx={{ 
              width: '100%', 
              height: '100%',
              display: currentVisualization === 'people' ? 'flex' : 'none',
              flexDirection: 'column'
            }}>
              {/* View Tabs */}
              <Box sx={{ 
                borderBottom: 1, 
                borderColor: 'divider',
                backgroundColor: '#fff',
                px: 2
              }}>
                <Tabs 
                  value={peopleViewMode} 
                  onChange={(e, newValue) => setPeopleViewMode(newValue)}
                  sx={{ 
                    minHeight: 42,
                    '& .MuiTab-root': { 
                      minHeight: 42,
                      textTransform: 'none',
                      fontSize: '0.875rem',
                      fontWeight: 500
                    }
                  }}
                >
                  <Tab 
                    label="List" 
                    value="list" 
                    icon={<PeopleIcon sx={{ fontSize: 18 }} />}
                    iconPosition="start"
                  />
                  <Tab 
                    label="Kanban" 
                    value="kanban" 
                    icon={<ViewKanbanIcon sx={{ fontSize: 18 }} />}
                    iconPosition="start"
                  />
                  <Tab 
                    label="Timeline" 
                    value="timeline" 
                    icon={<BarChartIcon sx={{ fontSize: 18 }} />}
                    iconPosition="start"
                  />
                </Tabs>
              </Box>

              {/* List View */}
              <Box sx={{ flex: 1, overflow: 'hidden', display: peopleViewMode === 'list' ? 'block' : 'none' }}>
                <PeoplePanel
                  meetings={meetingsData}
                  contacts={contactsData}
                  selectedNodeId={selectedNodeId}
                  userMap={peopleUserMap}
                  orgIds={orgIds}
                  selectedChapter={selectedChapter}
                  onNodeHover={handleNodeSelection}
                  nodes={[]}
                  onClearFilter={() => setSelectedNodeId(null)}
                  onAddConnection={() => {}}
                  currentVisualization={currentVisualization}
                  peopleFilters={peopleFilters}
                  onFiltersChange={setPeopleFilters}
                  selectedActions={urlSelectedActions}
                  currentUserId={currentUserId || undefined}
                  currentUserName={currentUserInfo?.fullName || currentUserInfo?.firstname || ''}
                  actions={actions || []}
                  turfLists={listsData}
                  sharedAllContacts={sharedAllContacts}
                  sharedCachedMeetings={sharedCachedMeetings}
                  organizerMappings={organizerMappings}
                  onFilterByOrganizer={handleFilterByOrganizer}
                  onEditOrganizerMapping={handleEditOrganizerMapping}
                  chapters={chapters}
                  teamsData={teamsData}
                  contactOrganizerMap={contactOrganizerMap}
                  onAddOrganizer={handleAddOrganizer}
                  onRemoveOrganizer={handleRemoveOrganizer}
                  onSavePerson={handleSavePersonFromDialog}
                  onDeleteConversation={handleDeleteConversationFromDialog}
                  onDeletePerson={handleDeletePersonFromDialog}
                  onDataChange={() => reloadSharedContacts(true)}
                  availableOrganizers={allOrganizerOptions.map(o => ({
                    id: (o.vanid || '').toString(),
                    name: `${o.firstname || ''} ${o.lastname || ''}`.trim()
                  })).filter(o => o.id && o.name)}
                />
              </Box>

              {/* Kanban View */}
              <Box sx={{ flex: 1, overflow: 'hidden', display: peopleViewMode === 'kanban' ? 'block' : 'none' }}>
                <LeadershipKanban
                  people={kanbanPeopleRecords}
                  loeCounts={loeCounts}
                  onPersonClick={(person) => handlePersonDetailsOpen(person.id)}
                  onLOEClick={(loeLevel) => {
                    // Toggle LOE filter when column is clicked
                    setPeopleFilters((prev: any) => ({
                      ...prev,
                      loeStatus: prev.loeStatus.includes(loeLevel) 
                        ? prev.loeStatus.filter((s: string) => s !== loeLevel)
                        : [...prev.loeStatus, loeLevel]
                    }));
                  }}
                  onChapterClick={(chapter) => {
                    // Set chapter filter (we're already on people view)
                    setPeopleFilters((prev: any) => ({
                      ...prev,
                      chapter: chapter
                    }));
                  }}
                  onOrganizerClick={(organizer) => {
                    // Set organizer filter (we're already on people view)
                    setPeopleFilters((prev: any) => ({
                      ...prev,
                      organizer: organizer
                    }));
                  }}
                />
              </Box>

              {/* Timeline View */}
              <Box sx={{ flex: 1, overflow: 'hidden', display: peopleViewMode === 'timeline' ? 'block' : 'none' }}>
                <GoalsVisualization
                  width={0}
                  height={0}
                  meetings={meetingsData}
                  contacts={contactsData}
                  nodes={[]}
                  userMap={userMap}
                  orgIds={orgIds}
                  selectedChapter={selectedChapter}
                  organizerFilter={unifiedFilters.organizer}
                  goals={conversationGoals}
                  onNavigateToGoal={() => {}}
                  hoveredOrganizer={null}
                  onOrganizerHover={() => {}}
                  teamsData={teamsData}
                />
              </Box>
            </Box>

        {/* Teams Visualization - Network Graph with Floating Team Cards */}
        {currentVisualization === 'teams' && (
          <Box sx={{ 
            width: '100%', 
            height: '100%', 
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Date Range Selector */}
            <Box sx={{ 
              position: 'absolute', 
              top: 16, 
              left: 16, 
              zIndex: 10,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderRadius: 1,
              padding: 1.5,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1, color: 'text.secondary' }}>
                Network Time Range
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                <TextField
                  type="date"
                  label="Start Date"
                  size="small"
                  value={networkStartDate}
                  onChange={(e) => setNetworkStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 180 }}
                />
                <TextField
                  type="date"
                  label="End Date"
                  size="small"
                  value={networkEndDate}
                  onChange={(e) => setNetworkEndDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 180 }}
                />
              </Box>
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mt: 1.5, mb: 0.5, color: 'text.secondary' }}>
                View
              </Typography>
              <ToggleButtonGroup
                value={networkMode}
                exclusive
                onChange={(_, val) => { if (val) { networkNodePositionsRef.current.clear(); setNetworkMode(val); } }}
                size="small"
                sx={{ width: '100%' }}
              >
                <ToggleButton value="teams" sx={{ flex: 1, fontSize: '0.7rem', py: 0.5 }}>Teams</ToggleButton>
                <ToggleButton value="constituents" sx={{ flex: 1, fontSize: '0.7rem', py: 0.5 }}>Constituents</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            
            {/* Floating Team Cards - Compact & Transparent */}
            <Box sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              zIndex: 10,
              maxWidth: 350,
              maxHeight: 'calc(100% - 32px)',
              overflow: 'auto',
              '&::-webkit-scrollbar': {
                width: '6px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '3px',
              }
            }}>
              <TeamsPanel
                meetings={meetingsData}
                contacts={contactsData}
                userMap={new Map(Array.from(userMap.entries()).map(([k, v]) => [parseInt(k), v]))}
                orgIds={orgIds}
                selectedChapter={selectedChapter}
                organizerMappings={organizerMappings}
                onFilterByOrganizer={handleFilterByOrganizer}
                onEditOrganizerMapping={handleEditOrganizerMapping}
                nodes={orgIds.map(person => ({
                  id: person.vanid?.toString() || '',
                  name: `${person.firstname || ''} ${person.lastname || ''}`.trim() || 'Unknown',
                  type: person.type || 'contact',
                  chapter: person.chapter || 'Unknown',
                  color: '#1976d2'
                }))}
                peopleRecords={peopleRecords}
                onRefreshTeams={handleRefreshTeams}
                existingTeamsData={teamsData}
                compact={true}
                chapters={chapters}
              />
            </Box>
            
            {/* Network Graph Container */}
            <Box sx={{ 
              width: '100%', 
              height: '100%',
              minHeight: 0, // Important for flex child to shrink
              flex: 1
            }}>
              <NetworkGraph
                key={`connections-${Array.from(selectedLOELevels).sort().join(',')}`}
                nodes={networkNodes}
                links={networkLinks}
                allLinks={networkLinks}
                colorMode={'chapter'}
                selectedChapter={selectedChapter}
                meetingsData={meetingsData}
                userMap={userMap}
                adminUserIds={new Set()}
                dataSource="teams"
                selectedNodeId={selectedNodeId}
                onNodeClick={handleNodeSelection}
                onNodeHover={() => {}}
                hoveredMeetingId={null}
                nodeFilters={{}}
                onNodesChange={(updatedNodes) => {
                  updatedNodes.forEach(n => {
                    if (typeof n.x === 'number' && typeof n.y === 'number') {
                      networkNodePositionsRef.current.set(n.id, { x: n.x, y: n.y });
                    }
                  });
                }}
                teamCenters={networkTeamCenters}
                customColors={customColors}
                searchText={unifiedFilters.searchText}
              />
            </Box>
          </Box>
        )}


        {/* Campaign Visualization - Line Graph */}
        {currentVisualization === 'campaign' && (
          <Box sx={{ 
            width: '100%', 
            height: '100%',
            minHeight: 0,
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Tabs */}
            <Tabs
              value={campaignViewTab}
              onChange={(_, newValue) => setCampaignViewTab(newValue)}
              sx={{
                backgroundColor: '#fff',
                borderBottom: '1px solid #e0e0e0',
                minHeight: 48,
                '& .MuiTab-root': {
                  minHeight: 48,
                  textTransform: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 500
                }
              }}
            >
              <Tab
                value="barometer"
                label="Barometer"
                icon={<BarChartIcon />}
                iconPosition="start"
              />
              <Tab
                value="timeline"
                label="Campaign Timeline"
                icon={<TimelineIcon />}
                iconPosition="start"
              />
            </Tabs>

            {/* Content */}
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              <CampaignLineGraph
                actions={campaignEvents}
                width={0} // Will be calculated dynamically
                height={0} // Will be calculated dynamically
                selectedChapter={selectedChapter}
                onActionClick={(action) => {
                  // Optional: Could show action details dialog here
                }}
                selectedCampaign={selectedCampaign || undefined}
                onResetZoom={handleResetCampaignZoom}
                parentCampaigns={parentCampaigns}
                selectedParentCampaigns={selectedParentCampaigns}
                meetingsData={meetingsData}
                showOnlyBarometer={campaignViewTab === 'barometer'}
                userMap={userMap}
                barometerView={campaignMetric}
                onBarometerViewChange={setCampaignMetric}
                barometerActions={barometerActions}
                onBarometerActionsChange={handleBarometerActionsChange}
                barometerSort={barometerSort || undefined}
                barometerSortDir={barometerSortDir}
                onBarometerSortChange={handleBarometerSortChange}
                onFilterByOrganizer={handleFilterByOrganizer}
                onEditOrganizerMapping={handleEditOrganizerMapping}
                leaderHierarchy={leaderHierarchy}
                listsData={listsData}
                actionsFromDB={actions}
                teamsData={teamsData}
              />
            </Box>
          </Box>
        )}
          </>
        )}
            </Box>
          </Box>
        );
      
  const rightContent = (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#fff',
      borderLeft: '1px solid #ddd'
    }}>

      {/* Panel Content - render all panels but only display active one */}
      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Right panel is hidden when on People view - People panel shows in left with tabs */}
        
        {/* Teams panel now floats over the network, no longer in right panel */}
        
        <Box sx={{ display: rightPanelView === 'campaigns' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <CampaignPanel
            actions={campaignActions}
            onAddAction={handleAddCampaignAction}
            onEditAction={handleEditCampaignAction}
            onDeleteAction={handleDeleteCampaignAction}
            onArchiveAction={handleArchiveCampaignAction}
            chapters={chapters}
            selectedChapter={selectedChapter}
            onCampaignClick={handleCampaignClick}
            parentCampaigns={parentCampaigns}
            onAddParentCampaign={handleAddParentCampaign}
            onUpdateParentCampaign={handleUpdateParentCampaign}
            onDeleteParentCampaign={handleDeleteParentCampaign}
            selectedParentCampaigns={selectedParentCampaigns}
            onParentCampaignClick={(campaignId) => {
              if (!campaignId) {
                setSelectedParentCampaigns([]);
              } else {
                setSelectedParentCampaigns(prev => 
                  prev.includes(campaignId)
                    ? prev.filter(id => id !== campaignId)
                    : [...prev, campaignId]
                );
              }
            }}
            currentUserId={currentUserId || undefined}
            currentUserName={currentUserInfo?.fullName || currentUserInfo?.firstname || ''}
            selectedOrganizerId={dashboardSelectedOrganizerId || currentUserId || undefined}
            selectedOrganizerName={dashboardSelectedOrganizerName || currentUserInfo?.fullName || currentUserInfo?.firstname || ''}
            availableOrganizers={allOrganizerOptions.map(o => ({
              vanid: (o.vanid || '').toString(),
              name: `${o.firstname || ''} ${o.lastname || ''}`.trim()
            })).filter(o => o.vanid && o.name)}
            availableTeams={teamsData.map((t: any) => ({ id: t.id, name: t.teamName }))}
            organizerCount={allOrganizerOptions.filter(o => o.vanid).length}
            roleCounts={roleCounts}
          />
        </Box>
      </Box>
    </Box>
  );

  // Render both views, use display to toggle - prevents unmounting/remounting and data reloads
  return (
    <Box sx={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Static Top Bar */}
      {topBarContent}
      
      {/* Dashboard Content - Full Width (hidden when not in dashboard mode) */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'hidden',
        display: viewMode === 'dashboard' ? 'block' : 'none' 
      }}>
        <Dashboard
          currentUserId={currentUserId}
          currentUserInfo={currentUserInfo}
          parentCampaigns={parentCampaigns}
          nodes={allTimeNodes}
          links={allTimeLinks}
          userMap={userMap}
          onNodeSelect={handleNodeSelection}
          onPersonDetailsOpen={handlePersonDetailsOpen}
          onPersonAdd={() => {
            reloadSharedContacts(false);
          }}
          onConversationLog={() => {
            reloadSharedContacts(true);
          }}
          selectedChapter={selectedChapter}
          teamsData={teamsData}
          peopleRecords={allTimePeopleRecords}
          onRefreshTeams={handleRefreshTeams}
          actions={actions || []}
          allPeople={orgIds.map((org: any) => ({
            id: org.vanid?.toString() || org.userid?.toString() || '',
            name: `${org.firstname || ''} ${org.lastname || ''}`.trim() || 'Unknown',
            type: org.type || 'contact',
            chapter: org.chapter || 'Unknown'
          }))}
          organizers={orgIds.filter((org: any) => org.type === 'organizer').map((org: any) => ({
            id: org.vanid?.toString() || org.userid?.toString() || '',
            name: `${org.firstname || ''} ${org.lastname || ''}`.trim() || 'Unknown',
            type: 'organizer',
            chapter: org.chapter || 'Unknown'
          }))}
          chapters={chapters}
          selectedActions={urlSelectedActions}
          onSelectedActionsChange={handleSelectedActionsChange}
          sharedAllContacts={sharedAllContacts}
          sharedCachedMeetings={sharedCachedMeetings}
          leaderHierarchy={leaderHierarchy}
          onLeaderHierarchyChange={loadLeaderHierarchyData}
          listsData={listsData}
          onListsDataChange={loadListsData}
          organizerGoals={organizerGoals}
          onOrganizerGoalsChange={loadOrganizerGoalsData}
          organizerMappings={organizerMappings}
          onFilterByOrganizer={handleFilterByOrganizer}
          onEditOrganizerMapping={handleEditOrganizerMapping}
          sectionLeads={sectionLeads}
          onSelectedOrganizerChange={(id, name) => {
            setDashboardSelectedOrganizerId(id);
            setDashboardSelectedOrganizerName(name);
          }}
        />
      </Box>

      {/* Federation/Network Content - Split panel layout (hidden when in dashboard mode) */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'hidden',
        display: viewMode === 'dashboard' ? 'none' : 'block' 
      }}>
        <AppLayout
          leftContent={leftContent}
          rightContent={rightContent}
          showRightPanel={currentVisualization !== 'people' && currentVisualization !== 'teams'}
        />
      </Box>

      {/* Person Details Dialog - shared across both views */}
      <PersonDetailsDialog
        open={personDialogOpen}
        onClose={handlePersonDialogClose}
        person={selectedPersonForDialog}
        userMap={new Map(Array.from(userMap.entries()).map(([k, v]) => [parseInt(k), v]))}
        orgIds={orgIds}
        cachedMeetings={sharedCachedMeetings}
        allContacts={sharedAllContacts}
        onSavePerson={handleSavePersonFromDialog}
        availableChapters={chapters}
        availableOrganizers={allOrganizerOptions.map(o => ({
          id: (o.vanid || '').toString(),
          name: `${o.firstname || ''} ${o.lastname || ''}`.trim()
        })).filter(o => o.id && o.name)}
        onDeleteConversation={handleDeleteConversationFromDialog}
        onDeletePerson={handleDeletePersonFromDialog}
        sx={{ zIndex: 9999 }}
      />
      
      {/* Edit Organizer Mapping Dialog */}
      {editMappingData && (() => {
        // Build comprehensive organizer list from all data sources
        const organizerSet = new Map<string, string>(); // vanid -> name
        
        // 1. From userMap (most comprehensive)
        userMap.forEach((info, id) => {
          const name = info.fullName || `${info.firstname || ''} ${info.lastname || ''}`.trim();
          if (name && name !== 'null null') {
            organizerSet.set(id, name);
          }
        });
        
        // 2. From teams (team members and leads)
        if (teamsData && Array.isArray(teamsData)) {
          teamsData.forEach(team => {
            // Team members
            if (team.bigQueryData?.teamMembers) {
              team.bigQueryData.teamMembers.forEach((memberName: string) => {
                const person = allTimeNodes.find((n: any) => n.name.toLowerCase() === memberName.toLowerCase());
                if (person && person.id) {
                  organizerSet.set(person.id, person.name);
                }
              });
            }
            // Team lead
            if (team.lead && team.lead.id) {
              organizerSet.set(team.lead.id, team.lead.name);
            }
          });
        }
        
        // 3. From meetings (organizers)
        if (sharedCachedMeetings) {
          sharedCachedMeetings.forEach((meeting: any) => {
            if (meeting.organizer_vanid) {
              const vanid = meeting.organizer_vanid.toString();
              if (!organizerSet.has(vanid)) {
                const info = userMap.get(vanid);
                const name = info?.fullName || info?.firstname || meeting.organizer || vanid;
                organizerSet.set(vanid, name);
              }
            }
          });
        }
        
        // 4. From orgIds (fallback)
        orgIds.forEach((org: any) => {
          const vanid = org.vanid?.toString();
          const name = `${org.firstname || ''} ${org.lastname || ''}`.trim();
          if (vanid && name && !organizerSet.has(vanid)) {
            organizerSet.set(vanid, name);
          }
        });
        
        // 6. From sharedAllContacts (comprehensive contact list)
        if (sharedAllContacts && Array.isArray(sharedAllContacts)) {
          sharedAllContacts.forEach((contact: any) => {
            const vanid = contact.vanid?.toString();
            const name = contact.fullName || 
                        `${contact.firstname || ''} ${contact.lastname || ''}`.trim() ||
                        contact.name;
            if (vanid && name && name !== 'null null' && !organizerSet.has(vanid)) {
              organizerSet.set(vanid, name);
            }
          });
        }
        
        // Convert to array and sort
        const allOrganizersList = Array.from(organizerSet.entries())
          .map(([vanid, name]) => ({ name, vanid }))
          .filter(org => org.name && org.vanid) // Remove any invalid entries
          .sort((a, b) => a.name.localeCompare(b.name));
        
        // console.log('[MainApp] Built comprehensive organizer list:', allOrganizersList.length, 'organizers');
        
        return (
          <EditOrganizerMappingDialog
            open={editMappingDialogOpen}
            onClose={() => {
              setEditMappingDialogOpen(false);
              setEditMappingData(null);
            }}
            nameOrId={editMappingData.name}
            vanId={editMappingData.vanId}
            allMappings={organizerMappings}
            allOrganizers={allOrganizersList}
            onMappingSaved={handleMappingSaved}
          />
        );
      })()}
      

      
      {/* Assign Organizer Dialog */}
      <AssignOrganizerDialog
        open={assignOrgDialogOpen}
        onClose={() => {
          setAssignOrgDialogOpen(false);
          setAssignOrgTarget(null);
        }}
        onAssign={handleAssignOrganizer}
        contactName={assignOrgTarget?.contactName || ''}
        orgIds={allOrganizerOptions}
      />
    </Box>
  );
};

interface MainAppProps {
  authUser?: import('../services/auth').AuthUser;
  onLogout?: () => void;
}

const MainApp: React.FC<MainAppProps> = ({ authUser, onLogout }) => {
  return (
    <ChapterColorProvider>
      <MainAppContent authUser={authUser} onLogout={onLogout} />
    </ChapterColorProvider>
  );
};

export default MainApp; 
