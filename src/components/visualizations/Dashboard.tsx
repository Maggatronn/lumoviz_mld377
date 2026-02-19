import React, { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Button,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  InputAdornment,
  Tooltip,
  Tabs,
  Tab
} from '@mui/material';
import { 
  addToList, 
  updateListItem, 
  removeFromList, 
  saveOrganizerGoal,
  fetchOrganizerGoals,
  saveLeaderHierarchy,
  removeLeaderHierarchy,
  fetchLists,
  createAction,
  fetchActions,
  updateActionStatus,
  updateAction
} from '../../services/api';
import {
  Star as StarIcon,
  EmojiEvents as TrophyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  People as PeopleIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Groups as GroupsIcon,
  InfoOutlined as InfoIcon,
  FilterList as FilterListIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  PersonOutline as PersonIcon,
  AccountTree as LeadershipIcon,
  ContentCopy as ContentCopyIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Chat as ChatIcon
} from '@mui/icons-material';
import { ParentCampaign } from '../dialogs/ParentCampaignDialog';
import AddTeamDialog from '../dialogs/AddTeamDialog';
import EditTeamDialog from '../dialogs/EditTeamDialog';
import CampaignActionDialog from '../dialogs/CampaignActionDialog';
import AddPersonDialog, { NewPerson } from '../dialogs/AddPersonDialog';
import EditPersonDialog, { PersonUpdate } from '../dialogs/EditPersonDialog';
import LogConversationDialog, { NewConversation, EditableConversation } from '../dialogs/LogConversationDialog';
import BatchAddPeopleDialog from '../dialogs/BatchAddPeopleDialog';
import teamsService from '../../services/teamsService';
import { useChapterColors } from '../../contexts/ChapterColorContext';
import { getLOEColor, LOE_LEVELS } from '../../theme/loeColors';
import { GraphNode, GraphLink, CampaignAction } from '../../types';
import PeoplePanel from '../panels/PeoplePanel';
import ActionListTable from '../ui/ActionListTable';
import { OrganizerChip } from '../ui/OrganizerChip';
import { PersonChip } from '../ui/PersonChip';
import { getCanonicalOrganizerName } from '../../services/organizerMappingService';
import { LeaderMetricsTable } from '../tables/LeaderMetricsTable';
import { API_BASE_URL } from '../../config';

interface DashboardProps {
  currentUserId: string | null;
  currentUserInfo: any;
  parentCampaigns: ParentCampaign[];
  // Network data for user's teams
  nodes: GraphNode[];
  links: GraphLink[];
  userMap: Map<string, any>;
  onNodeSelect?: (nodeId: string | null) => void;
  onPersonDetailsOpen?: (personId: string) => void; // Open person details dialog
  onPersonAdd?: () => void; // Callback when person is added
  onConversationLog?: () => void; // Callback when conversation is logged
  selectedChapter?: string;
  currentDateRange?: { start: Date; end: Date } | null;
  teamsData?: any[]; // Add teams data
  peopleRecords?: any[]; // Add people records for conversations
  onRefreshTeams?: () => Promise<void>; // Callback to refresh teams
  allPeople?: any[]; // All people for team dialogs
  organizers?: any[]; // Organizers for team dialogs
  chapters?: string[]; // Available chapters
  selectedActions?: string[]; // Selected actions from URL
  onSelectedActionsChange?: (actions: string[]) => void; // Callback to update URL
  actions?: ActionDefinition[]; // Actions from database
  // Shared PeoplePanel data from MainApp
  sharedAllContacts?: any[];
  sharedCachedMeetings?: any[];
  // Shared leader hierarchy from MainApp
  leaderHierarchy?: any[];
  onLeaderHierarchyChange?: () => void; // Callback to refresh hierarchy after changes
  // Shared lists data from MainApp
  listsData?: any[];
  onListsDataChange?: () => void; // Callback to refresh lists after changes
  // Shared organizer goals from MainApp
  organizerGoals?: any[];
  onOrganizerGoalsChange?: () => void; // Callback to refresh goals after changes
  // Organizer mapping functionality
  organizerMappings?: any[];
  onFilterByOrganizer?: (name: string, vanId?: string) => void;
  onEditOrganizerMapping?: (name: string, vanId?: string) => void;
}

// Action definitions interface
export interface ActionDefinition {
  action_id: string;
  action_name: string;
  goal_type: string;
  description?: string;
  fields: { key: string; label: string }[];
  is_active: boolean;
  has_goal?: boolean;
  status?: string;
  archived_date?: string;
}

interface TurfPerson {
  vanid: number;
  firstName: string;
  lastName: string;
  desiredChange: string;
  action: string; // action ID
  fields: Record<string, boolean>; // dynamic boolean fields based on action
  datePledged?: string;
  list_id?: string; // BigQuery list ID for updates
  loeStatus?: string; // LOE status from contacts
  memberStatus?: string; // Membership status from contacts
}

interface MyLeader {
  vanid: number;
  name: string;
}

interface SelectablePerson {
  id: string;
  name: string;
  chapter: string;
  totalMeetings: number;
  inVan?: boolean;
  isPledgeOnly?: boolean;
}

export interface LeaderProgress {
  id: string;
  name: string;
  pledgeCount?: number;
  pledgeGoal?: number;
  hasMetGoal: boolean;
  subLeaders: LeaderProgress[];
  isAutomatic?: boolean; // True if from team structure
  memberStatus?: string; // Membership status
  actionProgress?: { // Progress for each action type
    [actionId: string]: {
      count: number;       // Goal-field-filtered count (what progress bar uses)
      namedCount?: number; // Raw total on list (all people added, before field filtering)
      goal: number;
      hasMetGoal: boolean;
    }
  };
  metadata?: { // Optional metadata for special entries like "Other / Canvassers"
    isOthersAggregate?: boolean;
    othersNames?: string;
    othersCount?: number;
  };
}

interface ActionGoal {
  actionId: string;
  actionName: string;
  current: number;
  goal: number;
  percentage: number;
}

const Dashboard: React.FC<DashboardProps> = ({
  currentUserId,
  currentUserInfo,
  parentCampaigns,
  nodes,
  links,
  userMap,
  onNodeSelect,
  onPersonDetailsOpen,
  onPersonAdd,
  onConversationLog,
  selectedChapter = 'All Chapters',
  currentDateRange = null,
  teamsData = [],
  peopleRecords = [],
  onRefreshTeams,
  allPeople = [],
  organizers = [],
  chapters = [],
  selectedActions: selectedActionsProp = ['sign_pledge'],
  onSelectedActionsChange,
  actions: actionsProp = [],
  sharedAllContacts = [],
  sharedCachedMeetings = [],
  leaderHierarchy: leaderHierarchyProp = [],
  onLeaderHierarchyChange,
  listsData: listsDataProp = [],
  onListsDataChange,
  organizerGoals: organizerGoalsProp = [],
  onOrganizerGoalsChange,
  organizerMappings = [],
  onFilterByOrganizer,
  onEditOrganizerMapping
}) => {
  const { updateChapterColor } = useChapterColors();
  
  // Store latest prop values in refs to avoid useEffect dependency issues
  const teamsDataRef = React.useRef(teamsData);
  teamsDataRef.current = teamsData;
  const selectedOrganizerInfoRef = React.useRef<any>(null);
  const currentUserInfoRef = React.useRef(currentUserInfo);
  currentUserInfoRef.current = currentUserInfo;
  const userMapRef = React.useRef(userMap);
  userMapRef.current = userMap;
  const nodesRef = React.useRef(nodes);
  nodesRef.current = nodes;
  const peopleRecordsRef = React.useRef(peopleRecords);
  peopleRecordsRef.current = peopleRecords;
  const leaderHierarchyPropRef = React.useRef(leaderHierarchyProp);
  leaderHierarchyPropRef.current = leaderHierarchyProp;
  
  // Convert userMap from string keys to number keys for PeoplePanel compatibility
  const peopleUserMap = React.useMemo(() => {
    return new Map(Array.from(userMap.entries()).map(([k, v]) => [parseInt(k), v]));
  }, [userMap]);
  
  // Normalize actions from database format to component format
  const ACTIONS = React.useMemo(() => {
    return actionsProp.map(action => ({
      id: action.action_id,
      name: action.action_name,
      fields: action.fields || [],
      goalType: action.goal_type as 'pledge' | 'team' | 'other',
      has_goal: action.has_goal !== false // Default to true if not set
    }));
  }, [actionsProp]);
  
  // State for managing actions - MUST BE DECLARED BEFORE selectedActions memo
  const [availableActions, setAvailableActions] = React.useState<any[]>([]);
  const [loadingActions, setLoadingActions] = React.useState(false);
  const [actionStatusFilter, setActionStatusFilter] = React.useState<'live' | 'archived'>('live');
  const [showAddActionDialog, setShowAddActionDialog] = React.useState(false);
  const [editingAction, setEditingAction] = React.useState<any>(null);
  
  // Goal setting state
  const [showSetGoalDialog, setShowSetGoalDialog] = React.useState(false);
  const [goalActionId, setGoalActionId] = React.useState<string>('');
  const [goalValue, setGoalValue] = React.useState<number>(5);
  const [organizerGoals, setOrganizerGoals] = React.useState<Record<string, number>>({});
  // Map of all leader goals: leaderVanId -> (actionId -> goalValue)
  const [allLeaderGoalsMap, setAllLeaderGoalsMap] = React.useState<Map<string, Map<string, number>>>(new Map());
  
  // Get live actions for the current organizer (replaces global selectedActions)
  // These will be used in My Goals section
  const currentOrganizerLiveActions = useMemo(() => {
    return availableActions
      .filter((a: any) => (a.status || 'live') === 'live')
      .map((a: any) => a.action_id);
  }, [availableActions]);
  
  // Map of organizer_vanid -> live action IDs
  // This will be computed per leader in the My Leaders table
  const [leaderActionsMap, setLeaderActionsMap] = React.useState<Record<string, string[]>>({});
  
  // Map of organizer_vanid -> { action_id -> goal_value }
  // This stores each leader's personal goals for their actions
  
  // State for showing conversions in LeaderMetricsTable
  const [showConversions, setShowConversions] = React.useState(false);
  const [leaderGoalsMap, setLeaderGoalsMap] = React.useState<Record<string, Record<string, number>>>({});
  
  // State for managing turf
  const [turfList, setTurfList] = React.useState<TurfPerson[]>([]);
  const [reloadTrigger, setReloadTrigger] = React.useState(0);
  const [showAddTurfDialog, setShowAddTurfDialog] = React.useState(false);
  const [selectedActionForAdd, setSelectedActionForAdd] = React.useState<string>(''); // Action to add people to
  const [selectedPeopleForAdd, setSelectedPeopleForAdd] = React.useState<string[]>([]); // Selected people IDs
  const [showAddPersonDialog, setShowAddPersonDialog] = React.useState(false);
  const [showEditPersonDialog, setShowEditPersonDialog] = React.useState(false);
  const [showLogConversationDialog, setShowLogConversationDialog] = React.useState(false);
  const [showBatchAddDialog, setShowBatchAddDialog] = React.useState(false);
  const [editingConversation, setEditingConversation] = React.useState<EditableConversation | null>(null);
  const [selectedPersonForEdit, setSelectedPersonForEdit] = React.useState<any>(null);
  const [selectedPersonForConversation, setSelectedPersonForConversation] = React.useState<any>(null);
  const [selectedPersonForAction, setSelectedPersonForAction] = React.useState<any>(null);
  const [selectedActionForConversation, setSelectedActionForConversation] = React.useState<{
    actionId: string;
    listId: string;
    fieldKey: string;
  } | null>(null);
  // Dashboard tab state - sync with URL
  const getDashboardTabFromURL = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('dashboardTab') as 'lists' | 'people' | 'leaders' | 'actions' | 'conversations' || 'people';
  };
  
  const [turfTab, setTurfTab] = React.useState<'lists' | 'people' | 'leaders' | 'actions' | 'conversations'>(getDashboardTabFromURL());
  const [listStatusFilter, setListStatusFilter] = React.useState<'all' | 'complete' | 'in_progress'>('all'); // Filter for My Lists by status
  const [listAudienceFilter, setListAudienceFilter] = React.useState<'constituent' | 'leadership'>('constituent'); // Filter for My Lists by target audience
  
  // Get organizer from URL or default to Courtney
  const getOrganizerFromURL = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('organizer') || '';
  };

  // Dynamically build organizer list from userMap (all people in org_ids/contacts)
  const dashboardOrganizers = React.useMemo(() => {
    const organizers: { vanid: string; name: string }[] = [];
    const seen = new Set<string>();
    
    // Add all people from userMap
    userMapRef.current.forEach((info, vanid) => {
      if (!seen.has(vanid) && info.fullName && info.fullName.trim() !== '') {
        seen.add(vanid);
        organizers.push({ vanid, name: info.fullName });
      }
    });
    
    // Ensure Maggie Hughes is always present as a default
    if (!seen.has('100001')) {
      organizers.unshift({ vanid: '100001', name: 'Maggie Hughes' });
    }
    
    // Sort alphabetically by name
    organizers.sort((a, b) => a.name.localeCompare(b.name));
    
    return organizers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userMap]);
  
  // TEMPORARY FIX: Just default to Maggie Hughes
  const [selectedOrganizerId, setSelectedOrganizerId] = React.useState<string>('100001');
  const [selectedOrganizerInfo, setSelectedOrganizerInfo] = React.useState<any>(currentUserInfo);

  // TEMPORARY FIX: Remove the effect that was causing loops

  // Update selected organizer when dropdown changes
  // Only depend on selectedOrganizerId (primitive string) to prevent loops
  React.useEffect(() => {
    if (selectedOrganizerId) {
      const selectedOrg = dashboardOrganizers.find(org => 
        org.vanid === selectedOrganizerId || org.name === selectedOrganizerId
      );
      
      if (selectedOrg) {
        if (selectedOrg.vanid !== selectedOrganizerId) {
          setSelectedOrganizerId(selectedOrg.vanid);
          return;
        }
        
        const orgInfo = userMapRef.current.get(selectedOrganizerId);
        const info = orgInfo || { 
          firstname: selectedOrg.name.split(' ')[0],
          fullName: selectedOrg.name 
        };
        selectedOrganizerInfoRef.current = info;
        setSelectedOrganizerInfo(info);
        
        setDashboardPeopleFilters((prev: any) => ({ 
          ...prev, 
          organizer: selectedOrg.name 
        }));
      }
    } else {
      setDashboardPeopleFilters((prev: any) => ({ 
        ...prev, 
        organizer: '' 
      }));
    }
  }, [selectedOrganizerId, dashboardOrganizers]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Filters for Dashboard's My People PeoplePanel - pre-filtered by current user as organizer
  const [dashboardPeopleFilters, setDashboardPeopleFilters] = React.useState<any>({
    organizer: currentUserInfo?.fullName || currentUserInfo?.firstname || '',
    chapter: '',
    searchText: '',
    loeStatus: [],
    memberStatus: [],
    lastContactFilter: 'all',
    meetingCountFilter: 'all',
    actionStatus: 'all'
  });
  
  // Update organizer filter when user info loads
  React.useEffect(() => {
    const orgName = currentUserInfo?.fullName || currentUserInfo?.firstname || '';
    if (orgName && !dashboardPeopleFilters.organizer) {
      setDashboardPeopleFilters((prev: any) => ({ ...prev, organizer: orgName }));
    }
  }, [currentUserInfo]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Initialize filters from URL on mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Initialize listAudienceFilter from URL
    const urlListAudience = params.get('listAudience') as 'constituent' | 'leadership' | null;
    if (urlListAudience && (urlListAudience === 'constituent' || urlListAudience === 'leadership')) {
      setListAudienceFilter(urlListAudience);
    }
    
    // Initialize actionStatusFilter from URL
    const urlActionStatus = params.get('actionStatus') as 'live' | 'archived' | null;
    if (urlActionStatus && (urlActionStatus === 'live' || urlActionStatus === 'archived')) {
      setActionStatusFilter(urlActionStatus);
    }
    
    // Initialize dashboardPeopleFilters from URL
    const urlChapter = params.get('chapter');
    const urlSearchText = params.get('searchText');
    const urlLoeStatus = params.get('loeStatus');
    const urlMemberStatus = params.get('memberStatus');
    const urlLastContact = params.get('lastContact');
    const urlMeetingCount = params.get('meetingCount');
    const urlPeopleActionStatus = params.get('peopleActionStatus');
    
    if (urlChapter || urlSearchText || urlLoeStatus || urlMemberStatus || urlLastContact || urlMeetingCount || urlPeopleActionStatus) {
      setDashboardPeopleFilters((prev: any) => ({
        ...prev,
        ...(urlChapter && { chapter: urlChapter }),
        ...(urlSearchText && { searchText: urlSearchText }),
        ...(urlLoeStatus && { loeStatus: urlLoeStatus.split(',') }),
        ...(urlMemberStatus && { memberStatus: urlMemberStatus.split(',') }),
        ...(urlLastContact && { lastContactFilter: urlLastContact }),
        ...(urlMeetingCount && { meetingCountFilter: urlMeetingCount }),
        ...(urlPeopleActionStatus && { actionStatus: urlPeopleActionStatus })
      }));
    }
  }, []); // Run only on mount
  
  // Update URL when filters change
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Update listAudienceFilter in URL
    if (turfTab === 'lists') {
      params.set('listAudience', listAudienceFilter);
    } else {
      params.delete('listAudience');
    }
    
    // Update actionStatusFilter in URL
    if (turfTab === 'actions') {
      params.set('actionStatus', actionStatusFilter);
    } else {
      params.delete('actionStatus');
    }
    
    // Update dashboardPeopleFilters in URL (only when on My People tab)
    if (turfTab === 'people') {
      if (dashboardPeopleFilters.chapter) {
        params.set('chapter', dashboardPeopleFilters.chapter);
      } else {
        params.delete('chapter');
      }
      
      if (dashboardPeopleFilters.searchText) {
        params.set('searchText', dashboardPeopleFilters.searchText);
      } else {
        params.delete('searchText');
      }
      
      if (dashboardPeopleFilters.loeStatus?.length > 0) {
        params.set('loeStatus', dashboardPeopleFilters.loeStatus.join(','));
      } else {
        params.delete('loeStatus');
      }
      
      if (dashboardPeopleFilters.memberStatus?.length > 0) {
        params.set('memberStatus', dashboardPeopleFilters.memberStatus.join(','));
      } else {
        params.delete('memberStatus');
      }
      
      if (dashboardPeopleFilters.lastContactFilter && dashboardPeopleFilters.lastContactFilter !== 'all') {
        params.set('lastContact', dashboardPeopleFilters.lastContactFilter);
      } else {
        params.delete('lastContact');
      }
      
      if (dashboardPeopleFilters.meetingCountFilter && dashboardPeopleFilters.meetingCountFilter !== 'all') {
        params.set('meetingCount', dashboardPeopleFilters.meetingCountFilter);
      } else {
        params.delete('meetingCount');
      }
      
      if (dashboardPeopleFilters.actionStatus && dashboardPeopleFilters.actionStatus !== 'all') {
        params.set('peopleActionStatus', dashboardPeopleFilters.actionStatus);
      } else {
        params.delete('peopleActionStatus');
      }
    } else {
      // Clean up people filters from URL when not on people tab
      params.delete('chapter');
      params.delete('searchText');
      params.delete('loeStatus');
      params.delete('memberStatus');
      params.delete('lastContact');
      params.delete('meetingCount');
      params.delete('peopleActionStatus');
    }
    
    // Remove deprecated 'actions' parameter
    params.delete('actions');
    
    // Update URL
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, [turfTab, listAudienceFilter, actionStatusFilter, dashboardPeopleFilters]);
  
  const [showQuickAddDialog, setShowQuickAddDialog] = React.useState(false);
  const [personToQuickAdd, setPersonToQuickAdd] = React.useState<any>(null);
  const [quickAddActionId, setQuickAddActionId] = React.useState<string>('sign_pledge');
  const [showMyPeopleFilters, setShowMyPeopleFilters] = React.useState(false);
  
  // State for managing leaders
  const [leadersList, setLeadersList] = React.useState<MyLeader[]>([]);
  // Leader hierarchy now comes from MainApp as a prop (leaderHierarchyProp)
  const [showAddLeaderDialog, setShowAddLeaderDialog] = React.useState(false);
  const [selectedParentLeader, setSelectedParentLeader] = React.useState<string | null>(null); // For Add Leader dialog
  
  // State for managing teams
  const [showAddTeamDialog, setShowAddTeamDialog] = React.useState(false);
  const [showEditTeamDialog, setShowEditTeamDialog] = React.useState(false);
  const [teamToEdit, setTeamToEdit] = React.useState<any>(null);
  
  // Search state for dialogs
  const [turfSearchText, setTurfSearchText] = React.useState('');
  const [leaderSearchText, setLeaderSearchText] = React.useState('');
  const [conversationSearchText, setConversationSearchText] = React.useState('');
  const [conversationSortOrder, setConversationSortOrder] = React.useState<'newest' | 'oldest'>('newest');
  
  // State for adding people to a leader's organizing list
  // State for adding leader to MY leadership action list
  const [showAddLeaderToMyListDialog, setShowAddLeaderToMyListDialog] = React.useState(false);
  const [selectedLeaderToAdd, setSelectedLeaderToAdd] = React.useState<LeaderProgress | null>(null);
  const [selectedMyLeadershipAction, setSelectedMyLeadershipAction] = React.useState<string>('');
  const [leaderListReloadTrigger, setLeaderListReloadTrigger] = React.useState<{[key: string]: number}>({});

  // Copy to clipboard functions
  const copyMyPeopleToClipboard = async () => {
    try {
      // SIMPLER APPROACH: Filter sharedAllContacts using the EXACT same logic as PeoplePanel
      // Start with all contacts that match the current organizer
      const allVanIds = getAllOrganizerVanIds;
      const organizerNamesToMatch = getAllOrganizerNames;
      
      let filteredPeople: any[] = [];
      
      // Build list of people organized by this organizer (using meetings data, same as PeoplePanel)
      if (sharedAllContacts && sharedAllContacts.length > 0 && dashboardPeopleFilters.organizer) {
        // Get all people who have meetings with this organizer
        const peopleVanidsOrganizedByThisOrganizer = new Set<string>();
        
        sharedCachedMeetings.forEach((meeting: any) => {
          // Check if this meeting's organizer matches our selected organizer
          const meetingOrganizerName = meeting.organizer || 
            `${meeting.organizer_first_name || meeting.organizer_firstname || ''} ${meeting.organizer_last_name || meeting.organizer_lastname || ''}`.trim();
          
          const meetingOrganizerVanid = meeting.organizer_vanid?.toString();
          
          // Check if organizer matches by name or VAN ID
          const matchesOrganizer = organizerNamesToMatch.some(name => 
            meetingOrganizerName.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(meetingOrganizerName.toLowerCase())
          ) || allVanIds.includes(meetingOrganizerVanid);
          
          if (matchesOrganizer) {
            const personVanid = meeting.participant_vanid || meeting.vanid;
            if (personVanid) {
              peopleVanidsOrganizedByThisOrganizer.add(personVanid.toString());
            }
          }
        });
        
        // Filter sharedAllContacts to only those people AND compute their most recent contact date
        filteredPeople = sharedAllContacts.filter((contact: any) => {
          const contactVanid = (contact.vanid || contact.van_id)?.toString();
          return peopleVanidsOrganizedByThisOrganizer.has(contactVanid);
        }).map((contact: any) => {
          // Compute most recent contact date from meetings
          const contactVanid = (contact.vanid || contact.van_id)?.toString();
          const personMeetings = sharedCachedMeetings.filter((m: any) => {
            const meetingPersonVanid = (m.participant_vanid || m.vanid)?.toString();
            return meetingPersonVanid === contactVanid;
          });
          
          let mostRecentContactDate: Date | null = null;
          if (personMeetings.length > 0) {
            // Find the most recent meeting date
            personMeetings.forEach((meeting: any) => {
              const meetingDate = meeting.date_contacted?.value || meeting.date_contacted || meeting.date_canvassed;
              if (meetingDate) {
                const dateObj = new Date(meetingDate);
                if (!mostRecentContactDate || dateObj > mostRecentContactDate) {
                  mostRecentContactDate = dateObj;
                }
              }
            });
          }
          
          // Return contact with computed date
          return {
            ...contact,
            mostRecentContactAllTime: mostRecentContactDate,
            mostRecentContact: mostRecentContactDate
          };
        });
      } else {
        // No organizer filter or no data - use all contacts
        filteredPeople = sharedAllContacts && sharedAllContacts.length > 0 
          ? sharedAllContacts 
          : Array.from(userMap.values());
      }
      
      // Now apply all the OTHER filters
      const finalFilteredPeople: any[] = [];
      
      filteredPeople.forEach((person: any) => {
        const personVanid = person.vanid || person.van_id;
        
        // NOTE: The date range filter (currentDateRange) is NOT used to filter people out
        // It's only used to filter which meetings to display for each person
        // The actual filtering is done by the lastContactFilter below
        
        // Apply chapter filter (only if explicitly set)
        if (dashboardPeopleFilters.chapter && dashboardPeopleFilters.chapter.trim() !== '') {
          if (person.chapter !== dashboardPeopleFilters.chapter) {
            return;
          }
        }
        
        // Apply search text filter (only if explicitly set)
        if (dashboardPeopleFilters.searchText && dashboardPeopleFilters.searchText.trim() !== '') {
          const searchLower = dashboardPeopleFilters.searchText.toLowerCase();
          const name = `${person.firstname || person.first_name || ''} ${person.lastname || person.last_name || ''}`.toLowerCase();
          if (!name.includes(searchLower)) {
            return;
          }
        }
        
        // Apply LOE filter (only if array has items)
        if (dashboardPeopleFilters.loeStatus?.length > 0) {
          const personLOE = person.loeStatus || person.loe_status;
          if (!personLOE || !dashboardPeopleFilters.loeStatus.includes(personLOE)) {
            return;
          }
        }
        
        // Apply member status filter (only if array has items)
        if (dashboardPeopleFilters.memberStatus?.length > 0) {
          const personMemberStatus = person.memberStatus || person.member_status;
          if (!personMemberStatus || !dashboardPeopleFilters.memberStatus.includes(personMemberStatus)) {
            return;
          }
        }
        
        // Apply last contact filter (only if not 'all')
        if (dashboardPeopleFilters.lastContactFilter && dashboardPeopleFilters.lastContactFilter !== 'all') {
          const lastContactDate = person.mostRecentContactAllTime || person.mostRecentContact || person.lastContactDate || person.last_contact_date;
          
          if (!lastContactDate) {
            // No contact date
            if (dashboardPeopleFilters.lastContactFilter === 'never' || dashboardPeopleFilters.lastContactFilter.startsWith('over_')) {
              // Include people with no contact if filter is 'never' or 'over_X'
            } else {
              return; // Exclude if filter requires contact within a time period
            }
          } else {
            const daysSinceContact = Math.floor((new Date().getTime() - new Date(lastContactDate).getTime()) / (1000 * 60 * 60 * 24));
            
            switch (dashboardPeopleFilters.lastContactFilter) {
              case 'within_7_days':
                if (daysSinceContact > 7) {
                  return;
                }
                break;
              case 'within_30_days':
                if (daysSinceContact > 30) return;
                break;
              case 'within_3_months':
                if (daysSinceContact > 90) return;
                break;
              case 'over_30_days':
                if (daysSinceContact <= 30) return;
                break;
              case 'over_3_months':
                if (daysSinceContact <= 90) return;
                break;
              case 'never':
                return; // Has contact, but filter is "never"
            }
          }
        }
        
        // Apply meeting count filter (only if not 'all')
        if (dashboardPeopleFilters.meetingCountFilter && dashboardPeopleFilters.meetingCountFilter !== 'all') {
          const personVanid = person.vanid || person.van_id;
          const meetingCount = sharedCachedMeetings.filter((m: any) => 
            m.vanid === personVanid?.toString() || m.vanid === personVanid
          ).length;
          
          switch (dashboardPeopleFilters.meetingCountFilter) {
            case 'zero':
              if (meetingCount > 0) return;
              break;
            case 'hasAny':
              if (meetingCount === 0) return;
              break;
          }
        }
        
        finalFilteredPeople.push(person);
      });
      
      // Build text output with meeting notes
      let output = `My People - ${finalFilteredPeople.length} contacts\n`;
      output += `Exported: ${format(new Date(), 'MMM dd, yyyy h:mm a')}\n`;
      output += `Filters Applied:\n`;
      output += `  Organizer: ${dashboardPeopleFilters.organizer || 'All'}\n`;
      if (currentDateRange && currentDateRange.start && currentDateRange.end) {
        output += `  Date Range: ${format(currentDateRange.start, 'MMM dd, yyyy')} - ${format(currentDateRange.end, 'MMM dd, yyyy')}\n`;
      }
      if (dashboardPeopleFilters.chapter) output += `  Chapter: ${dashboardPeopleFilters.chapter}\n`;
      if (dashboardPeopleFilters.searchText) output += `  Search: ${dashboardPeopleFilters.searchText}\n`;
      if (dashboardPeopleFilters.loeStatus?.length > 0) output += `  LOE Status: ${dashboardPeopleFilters.loeStatus.join(', ')}\n`;
      if (dashboardPeopleFilters.memberStatus?.length > 0) output += `  Member Status: ${dashboardPeopleFilters.memberStatus.join(', ')}\n`;
      if (dashboardPeopleFilters.lastContactFilter && dashboardPeopleFilters.lastContactFilter !== 'all') {
        output += `  Last Contact: ${dashboardPeopleFilters.lastContactFilter}\n`;
      }
      if (dashboardPeopleFilters.meetingCountFilter && dashboardPeopleFilters.meetingCountFilter !== 'all') {
        output += `  Meeting Count: ${dashboardPeopleFilters.meetingCountFilter}\n`;
      }
      output += `${'='.repeat(80)}\n\n`;
      
      for (const person of finalFilteredPeople) {
        const firstName = person.firstname || person.first_name || '';
        const lastName = person.lastname || person.last_name || '';
        output += `${firstName} ${lastName}\n`;
        output += `  Chapter: ${person.chapter || 'N/A'}\n`;
        output += `  LOE: ${person.loeStatus || person.loe_status || 'Unknown'}\n`;
        output += `  Member Status: ${person.memberStatus || person.member_status || 'Unknown'}\n`;
        
        // Get meetings for this person from sharedCachedMeetings
        const personVanid = person.vanid || person.van_id;
        let personMeetings = sharedCachedMeetings.filter((m: any) => 
          m.vanid === personVanid?.toString() || m.vanid === personVanid
        );
        
        // Filter meetings by date range if set
        if (currentDateRange && currentDateRange.start && currentDateRange.end) {
          personMeetings = personMeetings.filter((m: any) => {
            const meetingDate = new Date(m.date_canvassed);
            return meetingDate >= currentDateRange.start && meetingDate <= currentDateRange.end;
          });
        }
        
        if (personMeetings.length > 0) {
          output += `  Meetings (${personMeetings.length}):\n`;
          personMeetings.forEach((meeting: any) => {
            output += `    - ${format(new Date(meeting.date_canvassed), 'MMM dd, yyyy')}: ${meeting.result_text || 'No notes'}\n`;
          });
        }
        
        output += `\n`;
      }
      
      await navigator.clipboard.writeText(output);
      alert(`Copied ${finalFilteredPeople.length} people to clipboard!`);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      alert('Failed to copy to clipboard. Please try again.');
    }
  };

  const copyMyListsToClipboard = async () => {
    try {
      const filteredActions = availableActions.filter((a: any) => {
        if (a.status !== 'live') return false;
        
        // Match by target_audience
        if (a.target_audience === listAudienceFilter) return true;
        
        // If target_audience is not set, show in both tabs
        // (could be either constituent or leadership action)
        if (!a.target_audience) return true;
        
        return false;
      });
      
      const filteredActionIds = new Set(filteredActions.map((a: any) => a.action_id));
      
      // Use myTurf (the merged data with pledges) instead of just turfList
      const relevantTurfEntries = myTurf.filter(p => filteredActionIds.has(p.action));
      
      // Group by person
      const peopleInList = Array.from(new Set(relevantTurfEntries.map(p => p.vanid)));
      
      if (peopleInList.length === 0) {
        await navigator.clipboard.writeText('No people on lists yet.');
        alert('Copied empty list view to clipboard.');
        return;
      }
      
      let output = '';
      
      // ===== SUMMARY SECTION =====
      const audienceLabel = listAudienceFilter === 'constituent' ? 'Constituent' : 'Leadership';
      output += `MY LISTS (${audienceLabel})\n`;
      output += `${peopleInList.length} people • ${filteredActions.length} actions\n\n`;
      
      // Calculate completion stats for each action
      const actionStats: Record<string, { total: number; completed: Record<string, number> }> = {};
      filteredActions.forEach((action: any) => {
        actionStats[action.action_id] = {
          total: 0,
          completed: {}
        };
        action.fields.forEach((field: any) => {
          actionStats[action.action_id].completed[field.key] = 0;
        });
      });
      
      // Count people and completions
      peopleInList.forEach(vanid => {
        const personEntries = relevantTurfEntries.filter(p => p.vanid === vanid);
        
        filteredActions.forEach((action: any) => {
          const entry = personEntries.find(e => e.action === action.action_id);
          if (entry) {
            actionStats[action.action_id].total++;
            action.fields.forEach((field: any) => {
              if (entry.fields?.[field.key]) {
                actionStats[action.action_id].completed[field.key]++;
              }
            });
          }
        });
      });
      
      // Output action summaries
      filteredActions.forEach((action: any) => {
        const stats = actionStats[action.action_id];
        output += `${action.action_name}: ${stats.total} people\n`;
        action.fields.forEach((field: any) => {
          const count = stats.completed[field.key];
          const percentage = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
          output += `  ${field.label}: ${count}/${stats.total} (${percentage}%)\n`;
        });
      });
      
      output += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      
      // ===== DATA SECTION =====
      // Format each person with their action progress
      let personIndex = 0;
      for (const vanid of peopleInList) {
        personIndex++;
        const personEntries = relevantTurfEntries.filter(p => p.vanid === vanid);
        const firstEntry = personEntries[0];
        const num = personIndex.toString().padStart(3, '0');
        
        output += `${num}. ${firstEntry.firstName || ''} ${firstEntry.lastName || ''}\n`;
        
        filteredActions.forEach((action: any) => {
          const entry = personEntries.find(e => e.action === action.action_id);
          if (entry) {
            output += `     ${action.action_name}:\n`;
            action.fields.forEach((field: any) => {
              const fieldValue = entry?.fields?.[field.key];
              const status = fieldValue ? '✓' : '○';
              output += `       ${status} ${field.label}\n`;
            });
          }
        });
        
        output += '\n';
      }
      
      await navigator.clipboard.writeText(output);
      alert(`✓ Copied ${peopleInList.length} people from lists to clipboard!`);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      alert('Failed to copy to clipboard. Please try again.');
    }
  };

  const copyMyLeadersToClipboard = async () => {
    try {
      if (myLeaders.length === 0) {
        await navigator.clipboard.writeText('No leaders added yet.');
        alert('Copied empty leaders view to clipboard.');
        return;
      }
      
      // Flatten the hierarchy for table format
      const flattenLeaders = (leaders: LeaderProgress[], depth: number = 0): any[] => {
        const result: any[] = [];
        leaders.forEach(leader => {
          result.push({ ...leader, depth });
          if (leader.subLeaders && leader.subLeaders.length > 0) {
            result.push(...flattenLeaders(leader.subLeaders, depth + 1));
          }
        });
        return result;
      };
      
      const flatLeaders = flattenLeaders(myLeaders);
      
      // Build headers from available actions with goals
      const actionsWithGoals = availableActions.filter((a: any) => {
        // Check if any leader has this action with a goal
        return myLeaders.some(leader => {
          const progress = leader.actionProgress?.[a.action_id];
          return progress && progress.goal > 0;
        });
      });
      
      let output = '';
      
      // ===== SUMMARY SECTION =====
      const leadersAtGoal = myLeaders.filter(leader => {
        if (!leader.actionProgress) return false;
        return Object.values(leader.actionProgress).some((p: any) => p.hasMetGoal);
      }).length;
      
      // Calculate aggregate stats across all leaders
      const actionAggregates: Record<string, { totalProgress: number; totalGoal: number; leadersWithGoal: number; leadersAtGoal: number }> = {};
      
      actionsWithGoals.forEach((action: any) => {
        actionAggregates[action.action_id] = {
          totalProgress: 0,
          totalGoal: 0,
          leadersWithGoal: 0,
          leadersAtGoal: 0
        };
      });
      
      // Only count top-level leaders (not sub-leaders) for aggregate stats
      myLeaders.forEach(leader => {
        if (leader.actionProgress) {
          actionsWithGoals.forEach((action: any) => {
            const progress = leader.actionProgress?.[action.action_id];
            if (progress && progress.goal > 0) {
              actionAggregates[action.action_id].totalProgress += progress.count;
              actionAggregates[action.action_id].totalGoal += progress.goal;
              actionAggregates[action.action_id].leadersWithGoal++;
              if (progress.hasMetGoal) {
                actionAggregates[action.action_id].leadersAtGoal++;
              }
            }
          });
        }
      });
      
      output += `MY LEADERS\n`;
      output += `${myLeaders.length} leaders (${flatLeaders.length} total with sub-leaders) • ${leadersAtGoal} at goal\n\n`;
      
      // Output action-by-action summary
      actionsWithGoals.forEach((action: any) => {
        const agg = actionAggregates[action.action_id];
        if (agg.leadersWithGoal > 0) {
          const percentage = agg.totalGoal > 0 ? Math.round((agg.totalProgress / agg.totalGoal) * 100) : 0;
          output += `${action.action_name}:\n`;
          output += `  Progress: ${agg.totalProgress}/${agg.totalGoal} (${percentage}%)\n`;
          output += `  Leaders: ${agg.leadersAtGoal}/${agg.leadersWithGoal} at goal\n`;
        }
      });
      
      output += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      
      // ===== DATA SECTION =====
      // Format each leader with their progress
      for (const leader of flatLeaders) {
        const indent = '  '.repeat(leader.depth);
        const subLeaderCount = leader.subLeaders?.length || 0;
        
        output += `${indent}${leader.name}\n`;
        
        if (subLeaderCount > 0) {
          output += `${indent}  Sub-Leaders: ${subLeaderCount}\n`;
        }
        
        // Show action progress
        let hasProgress = false;
        actionsWithGoals.forEach((action: any) => {
          const progress = leader.actionProgress?.[action.action_id];
          if (progress && progress.goal > 0) {
            hasProgress = true;
            const percentage = Math.round((progress.count / progress.goal) * 100);
            const status = progress.hasMetGoal ? '✓' : '○';
            output += `${indent}  ${status} ${action.action_name}: ${progress.count}/${progress.goal} (${percentage}%)\n`;
          }
        });
        
        if (!hasProgress && leader.depth > 0) {
          output += `${indent}  (No goals set)\n`;
        }
        
        output += '\n';
      }
      
      await navigator.clipboard.writeText(output);
      alert(`✓ Copied ${flatLeaders.length} leaders to clipboard!`);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      alert('Failed to copy to clipboard. Please try again.');
    }
  };

  const copyMyActionsToClipboard = async () => {
    try {
      const filteredActions = availableActions.filter((a: any) => a.status === actionStatusFilter);
      
      if (filteredActions.length === 0) {
        await navigator.clipboard.writeText(`No ${actionStatusFilter} actions yet.`);
        alert('Copied empty actions view to clipboard.');
        return;
      }
      
      let output = '';
      
      // ===== SUMMARY SECTION =====
      const statusLabel = actionStatusFilter.charAt(0).toUpperCase() + actionStatusFilter.slice(1);
      const constituentCount = filteredActions.filter((a: any) => a.target_audience !== 'leadership').length;
      const leadershipCount = filteredActions.filter((a: any) => a.target_audience === 'leadership').length;
      
      output += `MY ACTIONS (${statusLabel})\n`;
      output += `${filteredActions.length} actions • ${constituentCount} constituent • ${leadershipCount} leadership\n\n`;
      output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      
      // ===== DATA SECTION =====
      filteredActions.forEach((action: any, index: number) => {
        const num = (index + 1).toString().padStart(3, '0');
        const name = action.action_name || 'Untitled';
        const type = action.target_audience === 'leadership' ? 'Leadership' : 'Constituent';
        const scope = action.organizer_vanid ? 'Personal' : 'Federation-wide';
        
        output += `${num}. ${name}\n`;
        output += `     Type: ${type}\n`;
        output += `     Scope: ${scope}\n`;
        
        if (action.has_goal !== false) {
          const goalValue = organizerGoals[action.action_id];
          if (goalValue) {
            output += `     Goal: ${goalValue}\n`;
          }
        } else {
          output += `     Goal: None (count-based action)\n`;
        }
        
        if (action.fields && action.fields.length > 0) {
          output += `     Fields:\n`;
          action.fields.forEach((field: any) => {
            output += `       • ${field.label}\n`;
          });
        }
        
        output += '\n';
      });
      
      await navigator.clipboard.writeText(output);
      alert(`✓ Copied ${filteredActions.length} actions to clipboard!`);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      alert('Failed to copy to clipboard. Please try again.');
    }
  };

  // Load lists for the SELECTED organizer (not just from MainApp prop)
  React.useEffect(() => {
    const loadListsForSelectedOrganizer = async () => {
      if (!selectedOrganizerId) {
        setTurfList([]);
        return;
      }
      
      try {
        const lists = await fetchLists(selectedOrganizerId);
        
        // Convert to TurfPerson format
        const turfPeople: TurfPerson[] = lists.map(item => ({
          vanid: parseInt(item.vanid),
          firstName: item.contact_name.split(' ')[0] || '',
          lastName: item.contact_name.split(' ').slice(1).join(' ') || '',
          desiredChange: item.desired_change || '',
          action: item.action_id,
          fields: item.progress || {},
          datePledged: item.date_pledged,
          list_id: item.list_id
        }));
        
        setTurfList(turfPeople);
      } catch (error) {
        setTurfList([]);
      }
    };
    
    loadListsForSelectedOrganizer();
  }, [selectedOrganizerId]); // Reload whenever the selected organizer changes

  // Load available actions for the selected organizer
  const actionsLoadingRef = React.useRef(false);
  
  useEffect(() => {
    const loadActions = async () => {
      if (!selectedOrganizerId || actionsLoadingRef.current) return;
      actionsLoadingRef.current = true;
      setLoadingActions(true);
      try {
        const orgInfo = selectedOrganizerInfoRef.current;
        const organizerChapter = orgInfo?.chapter || currentUserInfoRef.current?.chapter;
        
        const actions = await fetchActions(selectedOrganizerId, organizerChapter);
        setAvailableActions(actions);
        if (actions.length > 0) {
          setSelectedActionForAdd(prev => prev || actions[0].action_id);
        }
      } catch (error) {
        console.error('Error loading actions:', error);
        setAvailableActions([]);
      } finally {
        setLoadingActions(false);
        actionsLoadingRef.current = false;
      }
    };
    
    actionsLoadingRef.current = false;
    loadActions();
  }, [selectedOrganizerId, reloadTrigger]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Cache for actions to prevent duplicate API calls
  const actionsCache = React.useRef<Map<string, any[]>>(new Map());
  
  // Clear cache when data changes
  useEffect(() => {
    actionsCache.current.clear();
  }, [reloadTrigger]);
  
  // Load live actions and goals for all leaders (from both hierarchy AND teams)
  const leaderActionsLoadedRef = React.useRef(false);
  
  useEffect(() => {
    if (leaderActionsLoadedRef.current) return;
    leaderActionsLoadedRef.current = true;
    
    const loadLeaderActionsAndGoals = async () => {
      const leaderVanids = new Set<string>();
      
      const hierarchy = leaderHierarchyPropRef.current;
      if (hierarchy && hierarchy.length > 0) {
        hierarchy.forEach(entry => {
          if (entry.leader_vanid) leaderVanids.add(entry.leader_vanid);
        });
      }
      
      if (leaderVanids.size === 0) return;
      
      const actionsMap: Record<string, string[]> = {};
      const goalsMap: Record<string, Record<string, number>> = {};
      
      await Promise.all(
        Array.from(leaderVanids).map(async (vanid) => {
          try {
            const leaderInfo = userMapRef.current.get(vanid);
            const leaderChapter = leaderInfo?.chapter || 'unknown';
            
            const cacheKey = `${vanid}:${leaderChapter}`;
            let actions;
            
            if (actionsCache.current.has(cacheKey)) {
              actions = actionsCache.current.get(cacheKey);
            } else {
              actions = await fetchActions(vanid, leaderChapter);
              actionsCache.current.set(cacheKey, actions);
            }
            
            const liveActions = actions
              ? actions.filter((a: any) => (a.status || 'live') === 'live')
                       .map((a: any) => a.action_id)
              : [];
            actionsMap[vanid] = liveActions;
            
            const goals = await fetchOrganizerGoals(vanid);
            const goalsForOrganizer: Record<string, number> = {};
            goals.forEach((goal: any) => {
              goalsForOrganizer[goal.action_id] = goal.goal_value;
            });
            goalsMap[vanid] = goalsForOrganizer;
          } catch (error) {
            console.error(`[Dashboard] Error loading data for leader ${vanid}:`, error);
            actionsMap[vanid] = [];
            goalsMap[vanid] = {};
          }
        })
      );
      
      setLeaderActionsMap(actionsMap);
      setLeaderGoalsMap(goalsMap);
    };
    
    loadLeaderActionsAndGoals();
  }, [reloadTrigger, selectedOrganizerId]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Load organizer goals
  useEffect(() => {
    const loadGoals = async () => {
      if (selectedOrganizerId) {
        const goals = await fetchOrganizerGoals(selectedOrganizerId);
        const goalsMap: Record<string, number> = {};
        goals.forEach((goal: any) => {
          goalsMap[goal.action_id] = goal.goal_value;
        });
        setOrganizerGoals(goalsMap);
      }
    };
    
    loadGoals();
  }, [selectedOrganizerId, reloadTrigger]);

  // Use leader hierarchy from MainApp prop
  // Extract unique leaders for leadersList (backward compatibility)
  React.useEffect(() => {
    const uniqueLeaders = new Map<string, MyLeader>();
    leaderHierarchyProp.forEach(entry => {
      if (!uniqueLeaders.has(entry.leader_vanid)) {
        uniqueLeaders.set(entry.leader_vanid, {
          vanid: parseInt(entry.leader_vanid),
          // Use name from API join if available; peopleRecords lookup may fill it in later
          name: (entry as any).leader_name || ''
        });
      }
    });
    setLeadersList(Array.from(uniqueLeaders.values()));
  }, [leaderHierarchyProp]);

  // Save leaders to localStorage (keeping this for now - can move to DB later)
  useEffect(() => {
    if (currentUserId && leadersList.length > 0) {
      localStorage.setItem(`leaders-${currentUserId}`, JSON.stringify(leadersList));
    }
  }, [leadersList, currentUserId]);

  // Filter teams to show only those where the selected organizer is a member or lead
  const myTeamsData = useMemo(() => {
    if (!teamsData || !selectedOrganizerInfo) return [];
    
    const userFullName = selectedOrganizerInfo?.fullName;
    const userFirstName = selectedOrganizerInfo?.firstname;
    
    return teamsData.filter(team => {
      // Check if selected organizer is the team lead
      const isLead = team.bigQueryData?.teamLead === userFullName || 
                     team.bigQueryData?.teamLead === userFirstName;
      
      // Check if user is in team members
      const isMember = team.bigQueryData?.teamMembers?.some((memberName: string) => {
        const memberNameLower = memberName.toLowerCase();
        const userFullNameLower = userFullName?.toLowerCase();
        const userFirstNameLower = userFirstName?.toLowerCase();
        
        return memberNameLower === userFullNameLower ||
               memberNameLower.includes(userFirstNameLower || '') ||
               memberNameLower.split(' ')[0] === userFirstNameLower;
      });
      
      return isLead || isMember;
    });
  }, [teamsData, selectedOrganizerInfo]);

  // Find selected organizer's team (where they're the leader)
  const myTeam = useMemo(() => {
    if (!selectedOrganizerId || !teamsData) return null;
    
    const userFullName = selectedOrganizerInfo?.fullName || selectedOrganizerInfo?.firstname;
    const firstName = selectedOrganizerInfo?.firstname;
    
    return teamsData.find(team => 
      team.bigQueryData?.teamLead === userFullName ||
      team.bigQueryData?.teamLead === firstName ||
      (firstName && team.bigQueryData?.teamLead?.toLowerCase().includes(firstName.toLowerCase()))
    );
  }, [teamsData, selectedOrganizerId, selectedOrganizerInfo]);
  
  // Helper: Get goal for rate-based actions
  const calculateAdjustedGoal = (
    action: CampaignAction | any,
    baseGoal: number,
    dateRange?: { start: Date; end: Date } | null
  ): number => {
    // If rate-based, use the recurrence_count as the goal
    if (action.actionType === 'rate_based' || action.action_type === 'rate_based') {
      const recurrenceCount = action.recurrenceCount || action.recurrence_count;
      if (recurrenceCount) {
        return recurrenceCount;
      }
    }
    
    // Otherwise return the base goal
    return baseGoal;
  };

  // Load goals for all leaders (for My Leaders view) - load once
  const allLeaderGoalsLoadedRef = React.useRef(false);
  
  useEffect(() => {
    if (!selectedOrganizerId || allLeaderGoalsLoadedRef.current) return;
    allLeaderGoalsLoadedRef.current = true;
    
    const loadAllLeaderGoals = async () => {
      const uniqueLeaderIds = new Set<string>();
      
      const hierarchy = leaderHierarchyPropRef.current;
      hierarchy.forEach(entry => {
        uniqueLeaderIds.add(entry.leader_vanid);
        if (entry.parent_leader_vanid) {
          uniqueLeaderIds.add(entry.parent_leader_vanid);
        }
      });
      
      if (uniqueLeaderIds.size === 0) return;
      
      const goalsPromises = Array.from(uniqueLeaderIds).map(vanid => 
        fetchOrganizerGoals(vanid).catch(err => {
          console.error(`Failed to fetch goals for leader ${vanid}:`, err);
          return [];
        })
      );
      
      const allGoalsArrays = await Promise.all(goalsPromises);
      
      const goalsMap = new Map<string, Map<string, number>>();
      allGoalsArrays.forEach((goalsArray, index) => {
        const vanid = Array.from(uniqueLeaderIds)[index];
        const leaderGoalsMap = new Map<string, number>();
        goalsArray.forEach(goal => {
          leaderGoalsMap.set(goal.action_id, goal.goal_value);
        });
        if (leaderGoalsMap.size > 0) {
          goalsMap.set(vanid, leaderGoalsMap);
        }
      });
      
      setAllLeaderGoalsMap(goalsMap);
    };
    
    loadAllLeaderGoals();
  }, [selectedOrganizerId, reloadTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Selected organizer's chapter
  const userChapter = selectedOrganizerInfo?.chapter || currentUserInfo?.chapter || 'Unknown';

  // Helper: Get ALL VAN IDs for the selected organizer (primary + alternates from mapping table)
  const getAllOrganizerVanIds = useMemo(() => {
    if (!selectedOrganizerId || !organizerMappings) return [selectedOrganizerId];
    
    // Find the mapping for this organizer
    const mapping = organizerMappings.find(m => m.primary_vanid === selectedOrganizerId);
    
    if (!mapping) return [selectedOrganizerId];
    
    // Return primary + all alternates
    const allIds = [mapping.primary_vanid];
    if (mapping.alternate_vanids && Array.isArray(mapping.alternate_vanids)) {
      allIds.push(...mapping.alternate_vanids);
    }
    
    return allIds;
  }, [selectedOrganizerId]); // Removed organizerMappings to prevent infinite loop

  // Helper: Get ALL name variations for the selected organizer
  const getAllOrganizerNames = useMemo(() => {
    if (!selectedOrganizerId || !organizerMappings) {
      const organizerInfo = selectedOrganizerInfo || currentUserInfo;
      return [
        organizerInfo?.fullName,
        organizerInfo?.firstname,
        organizerInfo?.firstname && organizerInfo?.lastname 
          ? `${organizerInfo.firstname} ${organizerInfo.lastname}`
          : null
      ].filter(Boolean);
    }
    
    // Find the mapping for this organizer
    const mapping = organizerMappings.find(m => m.primary_vanid === selectedOrganizerId);
    
    const names = [
      selectedOrganizerInfo?.fullName,
      selectedOrganizerInfo?.firstname,
      mapping?.preferred_name
    ].filter(Boolean);
    
    if (mapping?.name_variations && Array.isArray(mapping.name_variations)) {
      names.push(...mapping.name_variations);
    }
    
    return names;
  }, [selectedOrganizerId, selectedOrganizerInfo, currentUserInfo]); // Removed organizerMappings to prevent infinite loop

  // MY TURF: People organized by the selected organizer (pledges + manual additions)
  const myTurf = useMemo(() => {
    if (!selectedOrganizerId) return [];
    
    const allVanIds = getAllOrganizerVanIds;
    const allNames = getAllOrganizerNames;
    
    const turfPeople: TurfPerson[] = [];
    
    // Helper to get LOE and membership status from contacts
    const getContactInfo = (vanid: number) => {
      const contact = sharedAllContacts?.find((c: any) => 
        c.vanid?.toString() === vanid.toString() || 
        c.van_id?.toString() === vanid.toString()
      );
      return {
        loeStatus: contact?.loeStatus || contact?.loe_status,
        memberStatus: contact?.memberStatus || contact?.member_status
      };
    };
    
    
    // Merge with manual turf list (people added but not yet pledged/completed action)
    turfList.forEach(turfPerson => {
      if (!turfPeople.find(p => p.vanid === turfPerson.vanid && p.action === turfPerson.action)) {
        const contactInfo = getContactInfo(turfPerson.vanid);
        turfPeople.push({
          ...turfPerson,
          loeStatus: turfPerson.loeStatus || contactInfo.loeStatus,
          memberStatus: turfPerson.memberStatus || contactInfo.memberStatus
        });
      }
    });
    
    // Debug logging - commented out for production
    // console.log('[Dashboard] myTurf computed:', {
    //   totalPeople: turfPeople.length,
    //   actions: Array.from(new Set(turfPeople.map(p => p.action))),
    //   turfListLength: turfList.length,
    //   pledgeSubmissionsLength: pledgeSubmissions.length,
    //   sample: turfPeople.slice(0, 3)
    // });
    
    return turfPeople;
  }, [selectedOrganizerId, turfList, getAllOrganizerVanIds, getAllOrganizerNames, sharedAllContacts]);

  // MY PEOPLE: People organized by the selected organizer (from peopleRecords/meetings + primary organizer)
  const myPeople = useMemo(() => {
    if (!selectedOrganizerId) return [];
    
    const allVanIds = getAllOrganizerVanIds;
    const allNames = getAllOrganizerNames;
    
    console.log('[Dashboard] Computing myPeople for organizer:', selectedOrganizerId);
    
    // Use sharedAllContacts for comprehensive list (includes primary organizer field)
    const allContactsList = sharedAllContacts && sharedAllContacts.length > 0 
      ? sharedAllContacts 
      : (peopleRecords || []);
    
    console.log('[Dashboard] Total contacts to check:', allContactsList.length);
    
    // Filter people where EITHER:
    // 1. I was the organizer in a meeting, OR
    // 2. I'm set as their primary organizer
    let filtered = allContactsList
      .filter((person: any) => {
        // Check primary organizer field (from lumoviz_contacts table)
        const primaryOrganizerVanid = person.primary_organizer_vanid?.toString();
        const hasPrimaryOrganizer = primaryOrganizerVanid && allVanIds.includes(primaryOrganizerVanid);
        
        if (hasPrimaryOrganizer) {
          return true;
        }
        
        // Check if this person has any meetings where I was the organizer
        const organizers = person.organizers || [];
        
        if (organizers.length === 0) {
          return false;
        }
        
        const isMyContact = organizers.some((organizer: string) => {
          const orgStr = organizer?.toString().trim();
          // Check against ALL VAN IDs and ALL name variations
          const matchesVanId = allVanIds.includes(orgStr);
          const matchesName = allNames.some(name => name && orgStr === name);
          
          return matchesVanId || matchesName;
        });
        
        return isMyContact;
      })
      .sort((a: any, b: any) => {
        // Sort by most recent contact, descending
        const aDate = a.mostRecentContact || a.last_contact_date;
        const bDate = b.mostRecentContact || b.last_contact_date;
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
    
    console.log('[Dashboard] myPeople filtered result:', filtered.length, 'people');
    if (filtered.length > 0) {
      console.log('[Dashboard] Sample person:', {
        name: `${filtered[0].first_name || filtered[0].firstname || ''} ${filtered[0].last_name || filtered[0].lastname || ''}`.trim(),
        vanid: filtered[0].vanid,
        primary_organizer_vanid: filtered[0].primary_organizer_vanid
      });
    }
    return filtered;
  }, [sharedAllContacts, peopleRecords, selectedOrganizerId, getAllOrganizerVanIds, getAllOrganizerNames]);

  // Auto-add Team Leaders from myPeople to leadersList
  // DISABLED: This was auto-adding all Team Leaders, preventing manual addition
  // Users should be able to manually add anyone, including Team Leaders
  // React.useEffect(() => {
  //   if (!myPeople || myPeople.length === 0) return;
  //   
  //   // Find all Team Leaders in myPeople
  //   const teamLeaders = myPeople.filter(person => 
  //     person.loeStatus === 'TeamLeader' || person.loeStatus === '02_TeamLeader'
  //   );
  //   
  //   // Add any Team Leaders not already in leadersList
  //   setLeadersList(prev => {
  //     const leadersToAdd: MyLeader[] = [];
  //     teamLeaders.forEach(leader => {
  //       const alreadyExists = prev.some(l => l.vanid.toString() === leader.id);
  //       if (!alreadyExists) {
  //         leadersToAdd.push({
  //           vanid: parseInt(leader.id),
  //           name: leader.name
  //         });
  //       }
  //     });
  //     
  //     // Only update if there are new leaders to add
  //     return leadersToAdd.length > 0 ? [...prev, ...leadersToAdd] : prev;
  //   });
  // }, [myPeople]);

  // People available for turf (broader than just meetings)
  // USES sharedAllContacts for comprehensive list (not just people with meetings)
  const conversationPeopleForTurf = useMemo((): SelectablePerson[] => {
    if (!selectedOrganizerId) {
      return [];
    }
    
    // Use sharedAllContacts for comprehensive list of ALL people in system
    const allContactsList = sharedAllContacts && sharedAllContacts.length > 0 
      ? sharedAllContacts 
      : (peopleRecords || []);
    
    // Convert to consistent format and sort
    const allPeople: SelectablePerson[] = allContactsList
      .map((contact: any): SelectablePerson | null => {
        const vanid = (contact.vanid || contact.van_id)?.toString();
        if (!vanid) return null;
        
        return {
          id: vanid,
          name: contact.fullName || 
                `${contact.firstname || ''} ${contact.lastname || ''}`.trim() || 
                contact.name || 
                'Unknown',
          chapter: contact.chapter || 'Unknown',
          totalMeetings: contact.totalMeetings || 0
        };
      })
      .filter((person): person is SelectablePerson => person !== null)
      .sort((a, b) => {
        // Priority 1: Same chapter
        if (a.chapter === userChapter && b.chapter !== userChapter) return -1;
        if (a.chapter !== userChapter && b.chapter === userChapter) return 1;
        
        // Priority 2: People with meetings
        if (a.totalMeetings > 0 && b.totalMeetings === 0) return -1;
        if (a.totalMeetings === 0 && b.totalMeetings > 0) return 1;
        
        // Otherwise alphabetical
        return a.name.localeCompare(b.name);
      });
    
    return allPeople;
  }, [sharedAllContacts, peopleRecords, selectedOrganizerId, userChapter]);

  // People available to add as leaders (not already in leaders list)
  // Priority: 1) Team members, 2) Same chapter, 3) Anyone with meetings, 4) Everyone else
  // INCLUDES pledge-only people (not in VAN yet)
  // USES sharedAllContacts for comprehensive list (not just people with meetings)
  const conversationPeopleForLeaders = useMemo((): SelectablePerson[] => {
    if (!selectedOrganizerId) return [];
    
    const teamMemberNames = myTeam?.bigQueryData?.teamMembers || [];
    
    // Get all leader IDs that are currently in the hierarchy (from any source)
    const existingLeaderIds = new Set<string>();
    
    // Add from leadersList (explicit hierarchy entries)
    leadersList.forEach(l => existingLeaderIds.add(l.vanid.toString()));
    
    // Add team members (who are automatically tracked as leaders)
    if (myTeam?.bigQueryData?.teamMembers && peopleRecords) {
      myTeam.bigQueryData.teamMembers.forEach((memberName: string) => {
        const person = peopleRecords.find(p => p.name.toLowerCase() === memberName.toLowerCase());
        if (person) {
          existingLeaderIds.add(person.id);
        }
      });
    }
    
    // Use sharedAllContacts for comprehensive list of ALL people in system
    // (not just people with meeting records)
    const allContactsList = sharedAllContacts && sharedAllContacts.length > 0 
      ? sharedAllContacts 
      : (peopleRecords || []);
    
    // Convert sharedAllContacts to consistent format
    const vanPeople: SelectablePerson[] = allContactsList
      .map((contact: any): SelectablePerson | null => {
        const vanid = (contact.vanid || contact.van_id)?.toString();
        if (!vanid) return null;
        
        return {
          id: vanid,
          name: contact.fullName || 
                `${contact.firstname || ''} ${contact.lastname || ''}`.trim() || 
                contact.name || 
                'Unknown',
          chapter: contact.chapter || 'Unknown',
          totalMeetings: contact.totalMeetings || 0,
          inVan: true
        };
      })
      .filter((person): person is SelectablePerson => person !== null && !existingLeaderIds.has(person.id));
    
    // Get pledge-only people (not in VAN yet)
    const pledgePeopleMap = new Map<string, any>();
    const allVanIds = getAllOrganizerVanIds;
    const allNames = getAllOrganizerNames;
    
    
    const pledgePeople = Array.from(pledgePeopleMap.values());
    const allPeople = [...vanPeople, ...pledgePeople];
    
    return allPeople.sort((a, b) => {
      // Priority 1: Team members first
      const aIsTeamMember = teamMemberNames.some((memberName: string) => {
        const memberLastName = memberName.split(' ').pop()?.toLowerCase();
        const aLastName = a.name.split(' ').pop()?.toLowerCase();
        return memberLastName && aLastName && memberLastName === aLastName;
      });
      const bIsTeamMember = teamMemberNames.some((memberName: string) => {
        const memberLastName = memberName.split(' ').pop()?.toLowerCase();
        const bLastName = b.name.split(' ').pop()?.toLowerCase();
        return memberLastName && bLastName && memberLastName === bLastName;
      });
      if (aIsTeamMember && !bIsTeamMember) return -1;
      if (!aIsTeamMember && bIsTeamMember) return 1;
      
      // Priority 2: People in VAN first
      if (a.inVan && !b.inVan) return -1;
      if (!a.inVan && b.inVan) return 1;
      
      // Priority 3: Same chapter
      if (a.chapter === userChapter && b.chapter !== userChapter) return -1;
      if (a.chapter !== userChapter && b.chapter === userChapter) return 1;
      
      // Priority 4: People with meetings
      if (a.totalMeetings > 0 && b.totalMeetings === 0) return -1;
      if (a.totalMeetings === 0 && b.totalMeetings > 0) return 1;
      
      // Otherwise alphabetical
      return a.name.localeCompare(b.name);
    });
  }, [sharedAllContacts, peopleRecords, leadersList, selectedOrganizerId, myTeam, userChapter, getAllOrganizerVanIds, getAllOrganizerNames]);

  // Filter conversation people by search text
  const filteredTurfPeople = useMemo(() => {
    if (!turfSearchText) return conversationPeopleForTurf;
    const searchLower = turfSearchText.toLowerCase();
    return conversationPeopleForTurf.filter(person => 
      person && person.name.toLowerCase().includes(searchLower) ||
      person && person.chapter.toLowerCase().includes(searchLower)
    );
  }, [conversationPeopleForTurf, turfSearchText]);

  const filteredLeaderPeople = useMemo(() => {
    if (!leaderSearchText) return conversationPeopleForLeaders;
    const searchLower = leaderSearchText.toLowerCase();
    return conversationPeopleForLeaders.filter(person => 
      person.name.toLowerCase().includes(searchLower) ||
      person.chapter.toLowerCase().includes(searchLower)
    );
  }, [conversationPeopleForLeaders, leaderSearchText]);

  // Handle bulk adding selected people to turf
  const handleAddSelectedToTurf = async () => {
    if (!selectedOrganizerId || selectedPeopleForAdd.length === 0) return;
    
    const selectedAction = availableActions.find((a: any) => a.action_id === selectedActionForAdd);
    if (!selectedAction) return;
    
    // Initialize fields for this action (all false)
    const initialFields: Record<string, boolean> = {};
    selectedAction.fields.forEach((field: any) => {
      initialFields[field.key] = false;
    });
    
    try {
      // Add each selected person to the list
      const addPromises = selectedPeopleForAdd.map(async (personId) => {
        const person = filteredTurfPeople.find(p => p.id === personId);
        if (!person) return false;
        
        return await addToList({
          organizer_vanid: selectedOrganizerId,
          contact_vanid: parseInt(person.id),
          contact_name: person.name,
          action_id: selectedActionForAdd,
          action: selectedAction.action_name,
          desired_change: '',
          progress: initialFields
        });
      });
      
      const results = await Promise.all(addPromises);
      const successCount = results.filter(r => r).length;
      
      if (successCount > 0) {
        // Reload list from database
        const lists = await fetchLists(selectedOrganizerId);
        const turfPeople: TurfPerson[] = lists.map(item => ({
          vanid: parseInt(item.vanid),
          firstName: item.contact_name.split(' ')[0] || '',
          lastName: item.contact_name.split(' ').slice(1).join(' ') || '',
          desiredChange: item.desired_change || '',
          action: item.action_id,
          fields: item.progress || {},
          datePledged: item.date_pledged,
          list_id: item.list_id
        }));
        setTurfList(turfPeople);
        
        alert(`✓ ${successCount} ${successCount === 1 ? 'person' : 'people'} added to list!`);
        
        // Clear selections and close dialog
        setSelectedPeopleForAdd([]);
        setShowAddTurfDialog(false);
        setTurfSearchText('');
      }
    } catch (error) {
      console.error('Error adding to turf:', error);
      alert('Failed to add people to list. Please try again.');
    }
  };
  
  const handleOpenAddLeaderToMyList = (leader: LeaderProgress) => {
    setSelectedLeaderToAdd(leader);
    // Find first available leadership action
    const leadershipActions = availableActions.filter((a: any) => 
      a.status === 'live' && (a.target_audience === 'leadership' || !a.target_audience)
    );
    if (leadershipActions.length > 0) {
      setSelectedMyLeadershipAction(leadershipActions[0].action_id);
    }
    setShowAddLeaderToMyListDialog(true);
  };
  
  const handleAddLeaderToMyList = async () => {
    if (!selectedLeaderToAdd || !selectedMyLeadershipAction) return;
    
    const selectedAction = availableActions.find((a: any) => a.action_id === selectedMyLeadershipAction);
    if (!selectedAction) return;
    
    // Initialize fields for this action (all false)
    const initialFields: Record<string, boolean> = {};
    selectedAction.fields.forEach((field: any) => {
      initialFields[field.key] = false;
    });
    
    try {
      // Add leader to MY list (I am the organizer)
      const success = await addToList({
        organizer_vanid: selectedOrganizerId,
        organizer_name: selectedOrganizerInfo?.fullName || selectedOrganizerInfo?.firstname || '',
        contact_vanid: parseInt(selectedLeaderToAdd.id),
        contact_name: selectedLeaderToAdd.name,
        action_id: selectedMyLeadershipAction,
        action: selectedAction.action_name,
        desired_change: '',
        progress: initialFields
      });
      
      if (success) {
        // Close dialog
        setShowAddLeaderToMyListDialog(false);
        
        // Refresh lists data
        if (onListsDataChange) {
          onListsDataChange();
        }
      }
    } catch (error) {
      console.error('Error adding leader to my list:', error);
      alert('Failed to add leader to list. Please try again.');
    }
  };

  const handleToggleTurfCheckbox = async (vanid: number, action: string, fieldKey: string) => {
    // Find the person
    const person = turfList.find(p => p.vanid === vanid && p.action === action);
    if (!person || !person.list_id) return;
    
    const newValue = !person.fields[fieldKey];
    
    // Optimistic update
    setTurfList(prev => prev.map(p => 
      p.vanid === vanid && p.action === action
        ? { 
            ...p, 
            fields: {
              ...p.fields,
              [fieldKey]: newValue
            }
          }
        : p
    ));
    
    // Save to database
    try {
      const updatedFields = { ...person.fields, [fieldKey]: newValue };
      await updateListItem(person.list_id, {
        progress: updatedFields,
        is_completed: Object.values(updatedFields).every(v => v === true)
      });
    } catch (error) {
      console.error('Error updating checkbox:', error);
      // Revert on error
      setTurfList(prev => prev.map(p => 
        p.vanid === vanid && p.action === action
          ? { ...p, fields: { ...p.fields, [fieldKey]: !newValue } }
          : p
      ));
    }
  };

  const handleRemoveTurfPerson = async (vanid: number) => {
    // Find all list entries for this person
    const personsToRemove = turfList.filter(person => person.vanid === vanid);
    
    // Optimistic update
    setTurfList(prev => prev.filter(person => person.vanid !== vanid));
    
    // Remove from database
    try {
      for (const person of personsToRemove) {
        if (person.list_id) {
          await removeFromList(person.list_id);
        }
      }
    } catch (error) {
      console.error('Error removing from list:', error);
      // Trigger list reload in MainApp
      if (onListsDataChange) {
        onListsDataChange();
      }
    }
  };

  const handleQuickAddClick = (person: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click from opening dialog
    setPersonToQuickAdd(person);
    setQuickAddActionId(currentOrganizerLiveActions[0] || 'sign_pledge');
    setShowQuickAddDialog(true);
  };

  const handleQuickAddConfirm = async () => {
    if (!personToQuickAdd || !selectedOrganizerId) return;
    
    const action = ACTIONS.find((a: any) => a.id === quickAddActionId);
    if (!action) return;
    
    // Create initial fields object with all fields set to false
    const initialFields: { [key: string]: boolean } = {};
    action.fields.forEach((field: any) => {
      initialFields[field.key] = false;
    });
    
    try {
      // Add to database using the SELECTED organizer's VAN ID
      const success = await addToList({
        organizer_vanid: selectedOrganizerId, // Use selected organizer from dashboard dropdown
        contact_vanid: parseInt(personToQuickAdd.id),
        contact_name: personToQuickAdd.name,
        action_id: quickAddActionId,
        action: action.name,
        desired_change: personToQuickAdd.latestNotes || '',
        progress: initialFields
      });
      
      if (success) {
        // Reload lists for the selected organizer
        const lists = await fetchLists(selectedOrganizerId);
        const turfPeople: TurfPerson[] = lists.map(item => ({
          vanid: parseInt(item.vanid),
          firstName: item.contact_name.split(' ')[0] || '',
          lastName: item.contact_name.split(' ').slice(1).join(' ') || '',
          desiredChange: item.desired_change || '',
          action: item.action_id,
          fields: item.progress || {},
          datePledged: item.date_pledged,
          list_id: item.list_id
        }));
        setTurfList(turfPeople);
        
        // Close dialog and switch to lists tab
        setShowQuickAddDialog(false);
        setPersonToQuickAdd(null);
        setTurfTab('lists');
      }
    } catch (error) {
      console.error('Error adding person to list:', error);
      alert('Failed to add person to list. Please try again.');
    }
  };

  const handleAddPerson = async (person: NewPerson) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(person)
      });

      if (!response.ok) {
        throw new Error('Failed to add person');
      }

      const result = await response.json();
      alert(`✓ ${person.firstname} ${person.lastname} added successfully!`);
      
      // Trigger a reload of contacts if needed
      if (onPersonAdd) {
        onPersonAdd();
      }
    } catch (error) {
      console.error('Error adding person:', error);
      throw error;
    }
  };

  const handleLogConversation = async (conversation: NewConversation) => {
    try {
      // Include action_id if this is linked to an action
      const conversationData = {
        ...conversation,
        action_id: selectedActionForConversation?.actionId || null
      };

      const response = await fetch(`${API_BASE_URL}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversationData)
      });

      if (!response.ok) {
        throw new Error('Failed to log conversation');
      }

      alert(`✓ Conversation logged successfully!`);
      
      // If this was linked to an action, mark the field as complete
      if (selectedActionForConversation) {
        const { listId, fieldKey } = selectedActionForConversation;
        await updateListItem(listId, {
          progress: { [fieldKey]: true }
        });
        
        // Update local state to show it's logged
        setTurfList(prev => prev.map(p => 
          p.list_id === listId 
            ? { ...p, fields: { ...p.fields, [fieldKey]: true } }
            : p
        ));
      }
      
      // Trigger a reload of meetings if needed
      if (onConversationLog) {
        onConversationLog();
      }
    } catch (error) {
      console.error('Error logging conversation:', error);
      throw error;
    }
  };

  const handleUpdateConversation = async (meetingId: string, conversation: NewConversation) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/meetings/${meetingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversation)
      });

      if (!response.ok) {
        throw new Error('Failed to update conversation');
      }

      alert('✓ Conversation updated successfully!');
      setEditingConversation(null);
      
      if (onConversationLog) {
        onConversationLog();
      }
    } catch (error) {
      console.error('Error updating conversation:', error);
      throw error;
    }
  };

  const handleEditConversationFromMeeting = (meeting: any) => {
    const rawDate = meeting.date_contacted?.value || meeting.date_contacted || meeting.datestamp?.value || meeting.datestamp;
    const dateStr = rawDate ? new Date(rawDate).toISOString().split('T')[0] : '';
    const contactName = [meeting.participant_first_name, meeting.participant_last_name].filter(Boolean).join(' ') || '';
    const contactVanId = String(meeting.participant_vanid || meeting.vanid || '');

    const editable: EditableConversation = {
      meeting_id: meeting.meeting_id,
      contact_vanid: contactVanId,
      contact_name: contactName,
      organizer_vanid: String(meeting.organizer_vanid || ''),
      meeting_type: meeting.meeting_type || meeting.conversation_type || 'Constituency One-on-One',
      date: dateStr,
      notes: meeting.lmtg_notes || '',
      person_type: meeting.meeting_type || meeting.person_type || 'Constituent',
      purpose: meeting.notes_purpose || '',
      values: meeting.lmtg_values || '',
      difference: meeting.lmtg_difference || '',
      resources: meeting.lmtg_resources || '',
      commitment_asked_yn: meeting.lmtg_commitment_asked || '',
      commitment_made_yn: meeting.lmtg_commitment_made || '',
      commitment_what: meeting.lmtg_commitment_what || '',
      catapults: meeting.lmtg_catapults ? meeting.lmtg_catapults.split(', ').filter(Boolean) : [],
      shared_purpose_constituency_stance: meeting.lmtg_sp_constituency_stance || '',
      shared_purpose_constituency_how: meeting.lmtg_sp_constituency_how || '',
      shared_purpose_change_stance: meeting.lmtg_sp_change_stance || '',
      shared_purpose_change_how: meeting.lmtg_sp_change_how || '',
      leadership_tag: meeting.lmtg_leadership_tag || meeting.leadership_tag || '',
      did_share_story: meeting.lmtg_did_share_story || false,
      what_shared: meeting.lmtg_what_shared || ''
    };
    setEditingConversation(editable);
    setShowLogConversationDialog(true);
  };

  const handleEditPerson = async (personId: string, updates: PersonUpdate) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts/${personId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update person');
      }

      alert(`✓ Person updated successfully!`);
      
      // Trigger a reload of contacts
      if (onPersonAdd) {
        onPersonAdd();
      }
    } catch (error) {
      console.error('Error updating person:', error);
      throw error;
    }
  };

  // Handler to open edit dialog for a person (from PersonDetailsDialog)
  const handleOpenEditPerson = (personId: string) => {
    const person = allPeople.find(p => p.id === personId);
    if (person) {
      setSelectedPersonForEdit(person);
      setShowEditPersonDialog(true);
    }
  };

  // Handler to open log conversation dialog for a person (from PersonDetailsDialog)
  const handleOpenLogConversation = (personId: string) => {
    const person = allPeople.find(p => p.id === personId);
    if (person) {
      setSelectedPersonForConversation(person);
      setShowLogConversationDialog(true);
    }
  };

  // Handler to open add to action dialog for a person (from PersonDetailsDialog)
  const handleOpenAddToAction = (personId: string) => {
    const person = allPeople.find(p => p.id === personId);
    if (person) {
      setSelectedPersonForAction(person);
      setShowAddTurfDialog(true);
      // Pre-populate the person in the search
      setTurfSearchText(`${person.name}`);
    }
  };
  
  const handleCloseAddTurfDialog = () => {
    setShowAddTurfDialog(false);
    setSelectedPersonForAction(null);
    setTurfSearchText('');
  };

  // Update handleAddToTurf to work with pre-selected person
  const handleAddToTurfEnhanced = async (person?: any) => {
    const targetPerson = person || selectedPersonForAction;
    if (!targetPerson || !selectedActionForAdd) {
      alert('Please select a person and an action');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vanid: targetPerson.id,
          action_id: selectedActionForAdd,
          chapter: targetPerson.chapter
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add person to action');
      }

      alert(`✓ ${targetPerson.name} added to action!`);
      handleCloseAddTurfDialog();
      setReloadTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error adding person to action:', error);
      alert('Failed to add person to action. Please try again.');
    }
  };

  const handleAddLeader = async (person: any) => {
    if (!selectedOrganizerId) return;
    
    const newLeader: MyLeader = {
      vanid: parseInt(person.id),
      name: person.name
    };
    
    try {
      // Save to BigQuery hierarchy
      // If "Direct report to me" is selected (selectedParentLeader is empty),
      // set parent_leader_vanid to the selected organizer (you)
      await saveLeaderHierarchy({
        organizer_vanid: selectedOrganizerId,
        leader_vanid: person.id,
        parent_leader_vanid: selectedParentLeader && selectedParentLeader !== '' ? selectedParentLeader : selectedOrganizerId
      });
      
      // Add to local state
      setLeadersList(prev => [...prev, newLeader]);
      
      // Trigger hierarchy refresh in MainApp
      if (onLeaderHierarchyChange) {
        onLeaderHierarchyChange();
      }
      
      // Close dialog and clear search
      setShowAddLeaderDialog(false);
      setLeaderSearchText('');
      setSelectedParentLeader(null);
    } catch (error) {
      console.error('Error adding leader:', error);
      alert('Failed to add leader. Please try again.');
    }
  };

  const handleRemoveLeader = async (vanid: number) => {
    if (!selectedOrganizerId) return;
    
    try {
      // Remove from BigQuery hierarchy
      const result = await removeLeaderHierarchy(selectedOrganizerId, vanid.toString());
      
      // Remove from local state
      setLeadersList(prev => prev.filter(leader => leader.vanid !== vanid));
      
      // Trigger hierarchy refresh in MainApp
      if (onLeaderHierarchyChange) {
        onLeaderHierarchyChange();
      }
    } catch (error) {
      console.error('[handleRemoveLeader] Error removing leader:', error);
      alert('Failed to remove leader. Please try again.');
    }
  };

  // Team management handlers
  const handleAddTeam = async (newTeam: any) => {
    try {
      const result = await teamsService.createTeam({
        teamName: newTeam.teamName,
        teamLead: newTeam.teamLead.name,
        teamLeadData: newTeam.teamLead, // Pass full team lead object with roles
        chapter: newTeam.chapter,
        teamMembers: newTeam.teamMembers.map((member: any) => member.name),
        teamMembersData: newTeam.teamMembers, // Pass full team members array with roles
        turf: newTeam.turf,
        color: newTeam.color,
        sharedPurpose: newTeam.sharedPurpose,
        norms: newTeam.norms,
        normCorrection: newTeam.normCorrection,
        constituency: newTeam.constituency
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create team');
      }
      
      // Update chapter color if provided
      if (newTeam.color && newTeam.chapter) {
        updateChapterColor(newTeam.chapter, newTeam.color);
      }
      
      setShowAddTeamDialog(false);
      
      // Refresh teams
      if (onRefreshTeams) {
        await onRefreshTeams();
      }
    } catch (error) {
      console.error('Error creating team:', error);
      throw error;
    }
  };

  const handleEditTeam = (team: any) => {
    setTeamToEdit(team);
    setShowEditTeamDialog(true);
  };

  const handleSaveEditedTeam = async (updatedTeam: any) => {
    try {
      if (!teamToEdit) return;

      const result = await teamsService.updateTeam(teamToEdit.id, {
        teamName: updatedTeam.teamName,
        teamLead: updatedTeam.teamLead,
        chapter: updatedTeam.chapter,
        teamMembers: updatedTeam.teamMembers,
        turf: updatedTeam.turf,
        color: updatedTeam.color,
        version: updatedTeam.version,
        dateCreated: updatedTeam.dateCreated
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update team');
      }
      
      // Update chapter color if changed
      if (updatedTeam.color && updatedTeam.chapter) {
        await updateChapterColor(updatedTeam.chapter, updatedTeam.color);
      }
      
      setShowEditTeamDialog(false);
      setTeamToEdit(null);
      
      // Refresh teams
      if (onRefreshTeams) {
        await onRefreshTeams();
      }
    } catch (error) {
      console.error('Error updating team:', error);
      throw error;
    }
  };

  // MY LEADERS: Manually curated list with pledge progress
  const myLeaders = useMemo(() => {
    if (!selectedOrganizerId) return [];
    
    // Calculate pledge counts for each leader in the manual list
    const calculateLeaderProgress = (leaderId: string, leaderNameFromList: string, depth: number = 0): LeaderProgress | null => {
      if (depth > 3) return null; // Prevent infinite recursion
      
      // PRIORITY 1: Check organizer mappings (most reliable source)
      const mappedName = getCanonicalOrganizerName(leaderId, organizerMappings || []);
      const nameFromMapping = mappedName !== leaderId ? mappedName : null; // Only use if it resolved to something
      
      // PRIORITY 2: Try to find node
      const node = nodes.find(n => n.id === leaderId);
      
      // PRIORITY 3: Try userMap
      const leaderInfo = userMap.get(leaderId);
      
      // Use the best name available, with mapping taking priority
      const leaderName = nameFromMapping || leaderNameFromList || node?.name || leaderInfo?.fullName || leaderInfo?.name || `Contact ${leaderId}`;
      
      // Get membership status from peopleRecords
      const leaderPerson = peopleRecords?.find(p => p.id === leaderId);
      const memberStatus = leaderPerson?.memberStatus;
      
      const leaderFirstName = leaderInfo?.firstname || leaderName.split(' ')[0];
      const leaderAlternateIds = Array.isArray(leaderInfo?.alternateIds) ? leaderInfo.alternateIds : [];
      
      // Build all possible name variations for matching
      const nameParts = leaderName.split(' ');
      const possibleMatches = [
        leaderId,
        leaderName.toLowerCase(),
        leaderFirstName.toLowerCase(),
        ...leaderAlternateIds.map((id: string) => id.toLowerCase()),
        ...nameParts.map((part: string) => part.toLowerCase()) // Individual name parts
      ];
      
      // SPECIAL: For team members, also check against team member names
      let teamMemberName: string | null = null;
      if (myTeam?.bigQueryData?.teamMembers) {
        teamMemberName = myTeam.bigQueryData.teamMembers.find((memberName: string) => {
          const memberLastName = memberName.split(' ').pop()?.toLowerCase();
          const nodeLastName = leaderName.split(' ').pop()?.toLowerCase();
          return memberLastName && nodeLastName && memberLastName === nodeLastName;
        });
        
        if (teamMemberName) {
          possibleMatches.push(teamMemberName.toLowerCase());
          teamMemberName.split(' ').forEach((part: string) => possibleMatches.push(part.toLowerCase()));
        }
      }
      
      // No pledge processing needed
      const pledgeCount = 0;
      
      // Build sub-leaders from TWO sources:
      // 1. Explicit hierarchy from lumoviz_leader_hierarchy table
      // 2. Team relationships (team lead → team members)
      const subLeaders: LeaderProgress[] = [];
      const processedSubLeaderIds = new Set<string>();
      
      if (depth < 3) { // Still limit depth to prevent infinite recursion
        // SOURCE 1: Explicit hierarchy entries where parent_leader_vanid === this leaderId
        const childHierarchyEntries = leaderHierarchyProp.filter(
          entry => entry.parent_leader_vanid === leaderId
        );
        
        childHierarchyEntries.forEach(entry => {
          const subLeaderId = entry.leader_vanid;
          if (processedSubLeaderIds.has(subLeaderId)) return;
          processedSubLeaderIds.add(subLeaderId);
          
          // Look up sub-leader info
          const subNode = nodes.find(n => n.id === subLeaderId);
          const subInfo = userMap.get(subLeaderId);
          const subPerson = peopleRecords?.find(p => p.id === subLeaderId);
          
          const subLeaderName = subPerson?.name || subInfo?.name || subNode?.name || (entry as any).leader_name || `Contact ${subLeaderId}`;
          
          // Recursively calculate progress for this sub-leader
          const subLeaderProgress = calculateLeaderProgress(subLeaderId, subLeaderName, depth + 1);
          
          if (subLeaderProgress) {
            subLeaders.push(subLeaderProgress);
          }
        });
        
        // SOURCE 2: Team relationships - if this leader is a team lead, their team members are sub-leaders
        const leaderTeams = teamsData.filter(team => {
          const teamLead = team.bigQueryData?.teamLead;
          if (!teamLead) return false;
          
          // Match by name or ID
          return teamLead === leaderName || 
                 teamLead.toLowerCase() === leaderName.toLowerCase() ||
                 (leaderInfo?.fullName && teamLead === leaderInfo.fullName);
        });
        
        leaderTeams.forEach(team => {
          const teamMembers = team.bigQueryData?.teamMembers || [];
          teamMembers.forEach((memberName: string) => {
            // Find member's VAN ID
            const memberEntry = Array.from(userMap.entries()).find(([id, info]) => {
              const fullName = (info.fullName || `${info.firstname || ''} ${info.lastname || ''}`.trim()).toLowerCase();
              return fullName === memberName.toLowerCase() || 
                     (info.firstname || '').toLowerCase() === memberName.toLowerCase();
            });
            
            if (memberEntry) {
              const [memberVanId, memberInfo] = memberEntry;
              const subLeaderId = memberVanId.toString();
              
              // Skip if already processed or if it's the leader themselves
              if (processedSubLeaderIds.has(subLeaderId) || subLeaderId === leaderId) return;
              processedSubLeaderIds.add(subLeaderId);
              
              // Recursively calculate progress for this team member
              const subLeaderProgress = calculateLeaderProgress(subLeaderId, memberName, depth + 1);
              if (subLeaderProgress) {
                subLeaders.push(subLeaderProgress);
              }
            }
          });
        });
      }
      
      // Calculate progress for each action type based on the leader's live actions
      const actionProgress: { [actionId: string]: { count: number; goal: number; hasMetGoal: boolean } } = {};
      
      // Get this leader's live actions from the map
      const leaderLiveActions = leaderActionsMap[leaderId] || [];
      
      leaderLiveActions.forEach(actionId => {
        let actionCount = 0;
        
        // Find the action definition
        const action = ACTIONS.find(a => a.id === actionId);
        
        // For Sign Pledge: use pledgeCount (already calculated above)
        if (actionId === 'sign_pledge') {
          actionCount = pledgeCount;
        } else if (action) {
          // For other actions: count from listsData (turf) for this leader
          // Count completed items for this action where this leader is the organizer
          if (listsDataProp && Array.isArray(listsDataProp)) {
            const leaderListItems = listsDataProp.filter(item => 
              item.organizer_vanid === leaderId && 
              item.action_id === actionId
            );
            
            leaderListItems.forEach(item => {
              // Check if action is completed (all fields are true)
              if (action.fields && action.fields.length > 0) {
                const allFieldsCompleted = action.fields.every((field: any) => 
                  item.progress?.[field.key] === true
                );
                if (allFieldsCompleted) {
                  actionCount++;
                }
              } else {
                // No fields defined, count as 1 if on list
                actionCount++;
              }
            });
          }
        }
        
        // Get goal from allLeaderGoalsMap, or default to 5
        const leaderGoalsForAction = allLeaderGoalsMap.get(leaderId);
        
        // Try to find the full action definition from availableActions (has database fields)
        const fullAction = availableActions.find(a => a.action_id === actionId);
        const defaultGoal = fullAction?.default_individual_goal || 5;
        
        const baseGoal = leaderGoalsForAction?.get(actionId) || defaultGoal;
        
        // Adjust goal for rate-based actions using the full action definition
        const adjustedGoal = fullAction ? calculateAdjustedGoal(fullAction, baseGoal, currentDateRange) : baseGoal;
        
        actionProgress[actionId] = {
          count: actionCount,
          goal: adjustedGoal,
          hasMetGoal: actionCount >= adjustedGoal
        };
      });
      
      // Get pledge goal from allLeaderGoalsMap, or default to 5
      const leaderGoalsForPledges = allLeaderGoalsMap.get(leaderId);
      const basePledgeGoal = leaderGoalsForPledges?.get('sign_pledge') || 5;
      
      // Adjust pledge goal for rate-based actions using full action from availableActions
      const pledgeAction = availableActions.find(a => a.action_id === 'sign_pledge');
      const pledgeGoal = pledgeAction ? calculateAdjustedGoal(pledgeAction, basePledgeGoal, currentDateRange) : basePledgeGoal;
      
      const result = {
        id: leaderId,
        name: leaderName,
        pledgeCount,
        pledgeGoal,
        hasMetGoal: pledgeCount >= pledgeGoal,
        subLeaders,
        memberStatus,
        actionProgress
      };
      
      return result;
    };
    
    const leaders: LeaderProgress[] = [];
    const processedIds = new Set<string>();
    
    // SOURCE 1: Team Members (from teams BigQuery table)
    // Team members are stored as names, so we need to find their VAN IDs
    if (myTeam?.bigQueryData?.teamMembers && Array.isArray(myTeam.bigQueryData.teamMembers)) {
      myTeam.bigQueryData.teamMembers.forEach((memberName: string) => {
        // Find the person by exact name match in peopleRecords or nodes
        const person = peopleRecords?.find(p => 
          p.name.toLowerCase() === memberName.toLowerCase()
        );
        const node = !person ? nodes.find(n => 
          n.name?.toLowerCase() === memberName.toLowerCase()
        ) : null;
        
        const memberId = person?.id || node?.id;
        
        if (memberId && !processedIds.has(memberId)) {
          const leaderProgress = calculateLeaderProgress(memberId, memberName);
          if (leaderProgress) {
            leaders.push({ ...leaderProgress, isAutomatic: true });
            processedIds.add(memberId);
          }
        }
      });
    }
    
    // SOURCE 2: Leader Hierarchy (from lumoviz_leader_hierarchy BigQuery table)
    // Show leaders where parent_leader_vanid === selectedOrganizerId (direct reports)
    // OR where organizer_vanid === selectedOrganizerId AND no parent (top-level entries this person created)
    leaderHierarchyProp.forEach(entry => {
      const leaderId = entry.leader_vanid;
      
      // Include this leader if:
      // 1. They report directly to the selected organizer (parent_leader_vanid === selectedOrganizerId)
      // 2. OR this organizer created this entry and it has no parent (top-level)
      const isDirectReport = entry.parent_leader_vanid === selectedOrganizerId;
      const isTopLevelEntry = entry.organizer_vanid === selectedOrganizerId && !entry.parent_leader_vanid;
      
      if (!isDirectReport && !isTopLevelEntry) {
        return;
      }
      
      if (processedIds.has(leaderId)) return;
      
      // Find person info
      const person = peopleRecords?.find(p => p.id === leaderId);
      const node = nodes.find(n => n.id === leaderId);
      const userInfo = userMap.get(leaderId);
      
      const leaderName = person?.name || node?.name || userInfo?.name || (entry as any).leader_name || `Person ${leaderId}`;
      
      const leaderProgress = calculateLeaderProgress(leaderId, leaderName);
      if (leaderProgress) {
        leaders.push(leaderProgress);
        processedIds.add(leaderId);
      }
    });
    
    // Debug logging - commented out for production
    // console.log('📊 My Leaders (simplified):', {
    //   teamMemberNamesCount: myTeam?.bigQueryData?.teamMembers?.length || 0,
    //   hierarchyCount: leaderHierarchyProp.length,
    //   totalLeaders: leaders.length,
    //   leaders: leaders.map((l: any) => ({ name: l.name, id: l.id, pledgeCount: l.pledgeCount, isAutomatic: l.isAutomatic }))
    // });
    
  
    
    // Sort leaders by total progress across all actions, then by pledge count
    const sortLeaders = (a: LeaderProgress, b: LeaderProgress) => {
      // Calculate total progress for each leader
      const getTotalProgress = (leader: LeaderProgress) => {
        let total = 0;
        if (leader.actionProgress) {
          Object.values(leader.actionProgress).forEach(progress => {
            total += progress.count;
          });
        }
        return total;
      };
      
      const aTotal = getTotalProgress(a);
      const bTotal = getTotalProgress(b);
      
      // Sort by total progress descending, then by pledge count descending
      if (bTotal !== aTotal) {
        return bTotal - aTotal;
      }
      return (b.pledgeCount ?? 0) - (a.pledgeCount ?? 0);
    };
    
    // Sort leaders and their sub-leaders recursively
    const sortLeadersRecursive = (leadersList: LeaderProgress[]): LeaderProgress[] => {
      return leadersList.sort(sortLeaders).map(leader => ({
        ...leader,
        subLeaders: leader.subLeaders.length > 0 ? sortLeadersRecursive(leader.subLeaders) : []
      }));
    };
    
    return sortLeadersRecursive(leaders);
  }, [selectedOrganizerId, selectedOrganizerInfo, nodes, links, userMap, myTeam, teamsData, leadersList, peopleRecords, leaderHierarchyProp, leaderActionsMap, listsDataProp, ACTIONS, allLeaderGoalsMap]); // Removed organizerMappings to prevent infinite loop

  // No longer need these - simplified leader-to-my-list flow

  // Calculate selected organizer's pledge count (as the leader who collected them)
  const userPledgeCount = useMemo(() => {
    if (!selectedOrganizerId) return 0;
    
    const organizerInfo = selectedOrganizerInfo || currentUserInfo;
    // Build possible name variations for matching
    const userFullName = organizerInfo?.fullName;
    const userFirstLast = organizerInfo?.firstname && organizerInfo?.lastname 
      ? `${organizerInfo.firstname} ${organizerInfo.lastname}`
      : null;
    const userFirstName = organizerInfo?.firstname;
    const alternateIds = Array.isArray(organizerInfo?.alternateIds) ? organizerInfo.alternateIds : [];
    
    return 0; // No pledge processing needed
  }, [selectedOrganizerId, selectedOrganizerInfo, currentUserInfo]);

  // Calculate individual goals for each action (using live actions only)
  const individualActionGoals = useMemo(() => {
    // Filter to only show live actions
    const liveActions = availableActions.filter((a: any) => a.status === 'live');
    
    // Get current period boundaries based on recurrence type
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Go back to Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    
    return liveActions.map((action: any) => {
      const goalFieldKey = action.goal_field_key || null;
      const isRateBased = action.action_type === 'rate_based';
      const recurrencePeriod = action.recurrence_period;
      
      let completedCount = 0;
      let periodLabel = '';
      let periodSuffix = '';
      
      // Helper to check if entry is from current period
      const isFromCurrentPeriod = (entry: any) => {
        if (!isRateBased) return true; // Don't filter if not rate-based
        
        const entryDate = entry.updated_at ? new Date(entry.updated_at) : new Date(entry.date_added || entry.created_at);
        
        switch (recurrencePeriod) {
          case 'daily':
            periodLabel = 'today';
            periodSuffix = '/day';
            return entryDate >= startOfDay;
          case 'weekly':
            periodLabel = 'this week';
            periodSuffix = '/wk';
            return entryDate >= startOfWeek;
          case 'monthly':
            periodLabel = 'this month';
            periodSuffix = '/mo';
            return entryDate >= startOfMonth;
          case 'quarterly':
            periodLabel = 'this quarter';
            periodSuffix = '/qtr';
            return entryDate >= startOfQuarter;
          case 'annual':
            periodLabel = 'this year';
            periodSuffix = '/yr';
            return entryDate >= startOfYear;
          default:
            return true;
        }
      };
      
      // For Sign Pledge: use the calculated userPledgeCount from pledgeSubmissions
      if (action.action_id === 'sign_pledge') {
        // If goal field is specified, count people with that field = true
        if (goalFieldKey) {
          completedCount = turfList.filter((entry: any) => 
            entry.action === 'sign_pledge' && 
            entry.fields && 
            entry.fields[goalFieldKey] === true &&
            isFromCurrentPeriod(entry)
          ).length;
        } else {
          // Default: use last field or userPledgeCount
          // For rate-based recurring, filter pledges from current period
          if (isRateBased) {
            completedCount = turfList.filter((entry: any) => 
              entry.action === 'sign_pledge' &&
              isFromCurrentPeriod(entry)
            ).length;
          } else {
            completedCount = userPledgeCount;
          }
        }
      }
      // For other actions: count from turfList using the goal field
      else {
        let actionEntries = turfList.filter((entry: any) => entry.action === action.action_id);
        
        // Filter to current period if rate-based
        if (isRateBased) {
          actionEntries = actionEntries.filter(isFromCurrentPeriod);
        }
        
        if (goalFieldKey) {
          // Count entries where the goal field is true
          completedCount = actionEntries.filter((entry: any) => 
            entry.fields && entry.fields[goalFieldKey] === true
          ).length;
        } else {
          // Default: use the last field in action.fields
          const lastField = action.fields[action.fields.length - 1];
          if (lastField) {
            completedCount = actionEntries.filter((entry: any) => 
              entry.fields && entry.fields[lastField.key] === true
            ).length;
          }
        }
      }
      
      // Determine goal based on action type
      let baseGoal: number;
      if (organizerGoals[action.action_id]) {
        // Use personal goal if set
        baseGoal = organizerGoals[action.action_id];
      } else if (action.default_individual_goal) {
        // Use default individual goal from action template
        baseGoal = action.default_individual_goal;
      } else if (isRateBased && action.recurrence_count) {
        // Use recurrence_count for rate-based actions as base
        baseGoal = action.recurrence_count;
      } else {
        // Fallback to 5
        baseGoal = 5;
      }
      
      // Adjust goal for rate-based actions based on date range
      const goal = calculateAdjustedGoal(action, baseGoal, currentDateRange);
      
      const percentage = goal > 0 ? (completedCount / goal) * 100 : 0;
      const hasMetGoal = completedCount >= goal;
      const hasGoal = action.has_goal !== false; // Default to true if not set
      
      return {
        actionId: action.action_id,
        actionName: action.action_name,
        current: completedCount,
        goal: goal,
        percentage: Math.min(percentage, 100),
        hasMetGoal,
        hasGoal,
        targetAudience: action.target_audience || 'constituent',
        isRateBased: isRateBased,
        periodLabel: periodLabel,
        periodSuffix: periodSuffix
      };
    });
  }, [turfList, userPledgeCount, availableActions, organizerGoals]);

  // Calculate conversion metrics for each action
  const conversionMetrics = useMemo(() => {
    return ACTIONS.map(action => {
      const actionPeople = myTurf.filter(p => p.action === action.id);
      const totalInTurf = actionPeople.length;
      
      // Calculate counts for each stage
      const stageCounts: Record<string, number> = {};
      const conversions: Array<{ from: string; to: string; rate: number; count: number; total: number }> = [];
      
      action.fields.forEach((field: any) => {
        stageCounts[field.key] = actionPeople.filter(p => p.fields[field.key]).length;
      });
      
      // Calculate conversion rates between sequential stages
      for (let i = 0; i < action.fields.length - 1; i++) {
        const fromField = action.fields[i];
        const toField = action.fields[i + 1];
        
        const fromCount = stageCounts[fromField.key];
        const toCount = stageCounts[toField.key];
        const rate = fromCount > 0 ? (toCount / fromCount) * 100 : 0;
        
        conversions.push({
          from: fromField.label,
          to: toField.label,
          rate: Math.round(rate),
          count: toCount,
          total: fromCount
        });
      }
      
      return {
        actionId: action.id,
        actionName: action.name,
        totalInTurf,
        stageCounts: action.fields.map(f => ({
          key: f.key,
          label: f.label,
          count: stageCounts[f.key]
        })),
        conversions
      };
    });
  }, [myTurf]);

  // Goal for leadership summit eligibility
  const pledgeGoal = 5;
  const pledgeProgress = Math.min((userPledgeCount / pledgeGoal) * 100, 100);
  const hasMetGoal = userPledgeCount >= pledgeGoal;

  // Get user's chapter
  // Find user's campaign(s)
  const userCampaigns = useMemo(() => {
    return parentCampaigns.filter(campaign => 
      campaign.chapters.includes(userChapter) || 
      campaign.chapters.includes('All Chapters')
    );
  }, [parentCampaigns, userChapter]);

  // Calculate action goals for My Campaigns - showing federation and team progress (LIVE ACTIONS ONLY)
  const actionGoals = useMemo(() => {
    const goals: Record<string, ActionGoal[]> = {};
    
    // Filter to only live, non-personal actions (federation/chapter-wide only)
    const liveActions = availableActions.filter((a: any) => {
      if (a.status !== 'live') return false;
      
      // Exclude personal actions (actions with organizer_vanid and limited visibility)
      // Include only federation-wide actions (no organizer_vanid OR visible to everyone)
      const isFederationWide = !a.organizer_vanid || 
                               !a.visible_to_organizers || 
                               a.visible_to_organizers.length === 0;
      
      return isFederationWide;
    });
    
    // For each campaign, calculate progress for each action
    userCampaigns.forEach(campaign => {
      const campaignGoals: ActionGoal[] = [];
      
      liveActions.forEach((action: any) => {
        // Federation-wide count (from pledgeSubmissions)
        let federationCount = 0;
        
        // No pledge processing needed
        
        // No pledge processing needed
        let teamCount = 0;
        
        // Use federation count as the main metric, with team as secondary
        // Goals are aspirational (e.g., 1000 pledges federation-wide)
        const goal = action.action_id === 'sign_pledge' ? 1000 : 100;
        
        campaignGoals.push({
          actionId: action.action_id,
          actionName: action.action_name,
          current: federationCount,
          goal: goal,
          percentage: goal > 0 ? (federationCount / goal) * 100 : 0
        });
      });
      
      goals[campaign.id] = campaignGoals;
    });
    
    // Also add team-specific goals if user has a team
    if (myTeam) {
      const teamGoals: ActionGoal[] = [];
      
      liveActions.forEach((action: any) => {
        let teamCount = 0;
        
        // No pledge processing needed
        
        // Team goals (smaller than federation-wide)
        const goal = action.action_id === 'sign_pledge' ? 100 : 20;
        
        teamGoals.push({
          actionId: action.action_id,
          actionName: action.action_name,
          current: teamCount,
          goal: goal,
          percentage: goal > 0 ? (teamCount / goal) * 100 : 0
        });
      });
      
      goals[myTeam.id] = teamGoals;
    }
    
    return goals;
  }, [userCampaigns, myTeam, availableActions]);

  // Calculate overall campaign progress (average of all actions)
  const campaignProgress = useMemo(() => {
    const progress: Record<string, number> = {};
    
    userCampaigns.forEach(campaign => {
      const goals = actionGoals[campaign.id] || [];
      if (goals.length === 0) {
        progress[campaign.id] = 0;
      } else {
        const avgPercentage = goals.reduce((sum, goal) => sum + goal.percentage, 0) / goals.length;
        progress[campaign.id] = avgPercentage;
      }
    });
    
    return progress;
  }, [userCampaigns, actionGoals]);

  // Filter network to show organizing relationships
  const userNodes = useMemo(() => {
    if (!currentUserId) return [];
    
    const connectedNodeIds = new Set<string>();
    connectedNodeIds.add(currentUserId); // Include me (Ashley)
    
    // Find people I organize (my direct reports)
    const myDirectReports = new Set<string>();
    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      
      if (sourceId === currentUserId) {
        connectedNodeIds.add(targetId); // Add people I organize
        myDirectReports.add(targetId);
      }
    });
    
    // Find people that my direct reports organize (2 levels deep)
    myDirectReports.forEach(reportId => {
      links.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        
        if (sourceId === reportId) {
          connectedNodeIds.add(targetId); // Add people my reports organize
        }
      });
    });
    
    return nodes.filter(node => connectedNodeIds.has(node.id));
  }, [nodes, links, currentUserId]);

  const userLinks = useMemo(() => {
    if (!currentUserId) return [];
    
    const connectedNodeIds = new Set(userNodes.map(n => n.id));
    
    return links.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId);
    });
  }, [links, userNodes, currentUserId]);

  if (!currentUserId) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          Please log in to view your dashboard
        </Typography>
      </Box>
    );
  }

  // Show empty state if no organizer selected
  if (!selectedOrganizerId) {
    return (
      <Box sx={{ p: 2, height: '100%', overflow: 'auto', bgcolor: '#fafafa' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#1976d2' }}>
              My Dashboard
            </Typography>
            
            {/* Organizer Selector */}
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select
                value={selectedOrganizerId}
                onChange={(e) => {
                  const newOrganizerId = e.target.value;
                  setSelectedOrganizerId(newOrganizerId);
                  
                  // Cache in localStorage
                  if (newOrganizerId) {
                    localStorage.setItem('dashboard_selected_organizer', newOrganizerId);
                  } else {
                    localStorage.removeItem('dashboard_selected_organizer');
                  }
                  
                  // Update URL with organizer name only
                  const params = new URLSearchParams(window.location.search);
                  if (newOrganizerId) {
                    const selectedOrg = dashboardOrganizers.find(org => org.vanid === newOrganizerId);
                    if (selectedOrg) {
                      params.set('organizer', selectedOrg.name);
                    }
                  } else {
                    params.delete('organizer');
                  }
                  window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
                }}
                displayEmpty
                sx={{ 
                  fontSize: '0.875rem',
                  '& .MuiSelect-select': { py: 0.75 }
                }}
              >
                <MenuItem value="" sx={{ fontSize: '0.875rem', fontStyle: 'italic', color: 'text.secondary' }}>
                  Click your name to see your dashboard
                </MenuItem>
                {dashboardOrganizers.length > 0 && dashboardOrganizers.map(org => (
                  <MenuItem key={org.vanid} value={org.vanid} sx={{ fontSize: '0.875rem' }}>
                    {org.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>
        
        {/* Empty state message */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          height: 'calc(100% - 100px)',
          textAlign: 'center'
        }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            Select your name from the dropdown above
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your selection will be saved for next time
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto', bgcolor: '#fafafa' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#1976d2' }}>
            {selectedOrganizerInfo?.firstname || currentUserInfo?.firstname 
              ? `${selectedOrganizerInfo?.firstname || currentUserInfo?.firstname} View`
              : 'Dashboard'}
          </Typography>
          
          {/* Organizer Selector */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              value={selectedOrganizerId}
              onChange={(e) => {
                const newOrganizerId = e.target.value;
                setSelectedOrganizerId(newOrganizerId);
                
                // Find the organizer name for URL
                const selectedOrg = dashboardOrganizers.find(org => org.vanid === newOrganizerId);
                
                // Cache in localStorage
                if (newOrganizerId) {
                  localStorage.setItem('dashboard_selected_organizer', newOrganizerId);
                } else {
                  localStorage.removeItem('dashboard_selected_organizer');
                }
                
                // Update URL with organizer name only
                const params = new URLSearchParams(window.location.search);
                if (newOrganizerId && selectedOrg) {
                  params.set('organizer', selectedOrg.name);
                } else {
                  params.delete('organizer');
                }
                window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
              }}
              displayEmpty
              sx={{ 
                fontSize: '0.875rem',
                '& .MuiSelect-select': { py: 0.75 }
              }}
            >
              <MenuItem value="" sx={{ fontSize: '0.875rem', fontStyle: 'italic', color: 'text.secondary' }}>
                Select an organizer to view dashboard
              </MenuItem>
              {dashboardOrganizers.length > 0 && dashboardOrganizers.map(org => (
                <MenuItem key={org.vanid} value={org.vanid} sx={{ fontSize: '0.875rem' }}>
                  {org.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {/* Three Grouped Goal Cards */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'stretch' }}>
          {/* Card 1: My Goals (all selected actions stacked) */}
          <Card elevation={1} sx={{ flex: '1 1 250px', minWidth: '200px' }}>
            <CardContent sx={{ p: 0.75, '&:last-child': { pb: 0.75 } }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#1976d2', textTransform: 'uppercase', letterSpacing: 0.3, fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                My Goals
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: '200px', overflow: 'auto' }}>
                {individualActionGoals.map(actionGoal => (
                  <Box key={actionGoal.actionId}>
                    {actionGoal.hasGoal ? (
                      // Action has a goal - show barometer
                      <>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {actionGoal.targetAudience === 'leadership' ? (
                              <LeadershipIcon sx={{ fontSize: 10, color: '#9c27b0' }} />
                            ) : (
                              <PersonIcon sx={{ fontSize: 10, color: '#2e7d32' }} />
                            )}
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                              {actionGoal.actionName}
                              {actionGoal.isRateBased && actionGoal.periodLabel && (
                                <span style={{ color: '#1976d2', fontStyle: 'italic' }}> ({actionGoal.periodLabel})</span>
                              )}
                            </Typography>
                          </Box>
                          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.6rem' }}>
                            {actionGoal.current} / {actionGoal.goal}
                            {actionGoal.isRateBased && actionGoal.periodSuffix && (
                              <span style={{ color: '#1976d2' }}>{actionGoal.periodSuffix}</span>
                            )}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={actionGoal.percentage}
                          sx={{
                            height: 6,
                            borderRadius: 1,
                            backgroundColor: '#e0e0e0',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: actionGoal.hasMetGoal ? '#4caf50' : '#1976d2'
                            }
                          }}
                        />
                      </>
                    ) : (
                      // Action doesn't have a goal - just show count
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {actionGoal.targetAudience === 'leadership' ? (
                            <LeadershipIcon sx={{ fontSize: 10, color: '#9c27b0' }} />
                          ) : (
                            <PersonIcon sx={{ fontSize: 10, color: '#2e7d32' }} />
                          )}
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                            {actionGoal.actionName}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.6rem' }}>
                          {actionGoal.current} {actionGoal.current === 1 ? 'item' : 'items'}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
          
          {/* Card 2: My Leaders (only show if there are leaders) */}
          {myLeaders.length > 0 && (() => {
            // Calculate leader metrics
            const totalLeaders = myLeaders.length;
            const leadersAtGoal = myLeaders.filter(leader => {
              // Check if leader has met at least one of their action goals
              if (!leader.actionProgress) return false;
              return Object.values(leader.actionProgress).some((progress: any) => progress.hasMetGoal);
            }).length;
            
            // Calculate total aggregate across all actions for all leaders
            const aggregateStats = myLeaders.reduce((acc, leader) => {
              if (leader.actionProgress) {
                Object.entries(leader.actionProgress).forEach(([actionId, progress]: [string, any]) => {
                  if (!acc[actionId]) {
                    acc[actionId] = { count: 0, goal: 0 };
                  }
                  acc[actionId].count += progress.count || 0;
                  acc[actionId].goal += progress.goal || 0;
                });
              }
              return acc;
            }, {} as Record<string, { count: number; goal: number }>);
            
            const percentage = totalLeaders > 0 ? (leadersAtGoal / totalLeaders) * 100 : 0;
            
            return (
              <Card elevation={1} sx={{ flex: '1 1 250px', minWidth: '200px' }}>
                <CardContent sx={{ p: 0.75, '&:last-child': { pb: 0.75 } }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#1976d2', textTransform: 'uppercase', letterSpacing: 0.3, fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                    My Leaders
                  </Typography>
                  
                  {/* Leaders at Goal Summary */}
                  <Box sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                        Leaders Hitting Goals
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.6rem', color: leadersAtGoal === totalLeaders ? '#4caf50' : 'inherit' }}>
                        {leadersAtGoal} / {totalLeaders}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={percentage}
                      sx={{
                        height: 6,
                        borderRadius: 1,
                        backgroundColor: '#e0e0e0',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: leadersAtGoal === totalLeaders ? '#4caf50' : '#1976d2'
                        }
                      }}
                    />
                  </Box>
                  
                  {/* Aggregate Action Stats */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: '140px', overflow: 'auto' }}>
                    {Object.entries(aggregateStats).map(([actionId, stats]) => {
                      const action = ACTIONS.find((a: any) => a.id === actionId);
                      if (!action) return null;
                      
                      const actionPercentage = stats.goal > 0 ? (stats.count / stats.goal) * 100 : 0;
                      
                      return (
                        <Box key={actionId}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.55rem' }}>
                              {action.name}
                            </Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.secondary' }}>
                              {stats.count} / {stats.goal}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </CardContent>
              </Card>
            );
          })()}
          
          {/* Card 3: My Team (filtered actions stacked) */}
          {myTeam && (
            <Card elevation={1} sx={{ flex: '1 1 250px', minWidth: '200px' }}>
              <CardContent sx={{ p: 0.75, '&:last-child': { pb: 0.75 } }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#1976d2', textTransform: 'uppercase', letterSpacing: 0.3, fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                  {myTeam.teamName}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: '200px', overflow: 'auto' }}>
                  {actionGoals[myTeam.id]?.map(goal => (
                    <Box key={goal.actionId}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                          {goal.actionName}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.6rem' }}>
                          {goal.current.toLocaleString()}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(goal.percentage, 100)}
                        sx={{
                          height: 6,
                          borderRadius: 1,
                          backgroundColor: '#e0e0e0',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: goal.percentage >= 100 ? '#4caf50' : '#1976d2'
                          }
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}
          
          {/* Card 3: Full Federation (filtered actions stacked) - exclude team campaign */}
          {userCampaigns.length > 0 && userCampaigns
            .filter(campaign => campaign.id !== myTeam?.id) // Don't show team campaign here (already shown in Card 2)
            .slice(0, 1) // Only show the first campaign
            .map(campaign => {
              const overallProgress = campaignProgress[campaign.id] || 0;
              
              return (
                <Card key={campaign.id} elevation={1} sx={{ flex: '1 1 250px', minWidth: '200px' }}>
                  <CardContent sx={{ p: 0.75, '&:last-child': { pb: 0.75 } }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#1976d2', textTransform: 'uppercase', letterSpacing: 0.3, fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                      {campaign.name} ({Math.round(overallProgress)}%)
                    </Typography>
                    
                    {/* Action Progress Bars - Vertical stacked (filtered by selected actions) */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: '200px', overflow: 'auto' }}>
                      {actionGoals[campaign.id]?.map(goal => (
                        <Box key={goal.actionId}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                              {goal.actionName}
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.6rem' }}>
                              {goal.current.toLocaleString()}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(goal.percentage, 100)}
                            sx={{
                              height: 6,
                              borderRadius: 1,
                              backgroundColor: '#e0e0e0',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: goal.percentage >= 100 ? '#4caf50' : '#1976d2'
                              }
                            }}
                          />
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
        </Box>

        {/* My Teams Section */}
        {myTeamsData.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <GroupsIcon sx={{ fontSize: 18 }} /> My Teams
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setShowAddTeamDialog(true)}
                sx={{ fontSize: '0.75rem', textTransform: 'none' }}
              >
                Add Team
              </Button>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 1.5 }}>
              {myTeamsData.map((team: any) => {
                const isLead = team.lead && selectedOrganizerId &&
                  (String(team.lead.id) === String(selectedOrganizerId));
                const members = team.organizers || [];

                // Aggregate affirm/challenge counts from team members' conversations
                const memberIds = new Set(members.map((m: any) => String(m.id)));
                const teamMeetings = sharedCachedMeetings.filter((m: any) => {
                  const participantId = String(m.participant_vanid || m.vanid || '');
                  const organizerId = String(m.organizer_vanid || '');
                  return memberIds.has(participantId) || memberIds.has(organizerId);
                });
                const constCounts = { affirm: 0, challenge: 0 };
                const changeCounts = { affirm: 0, challenge: 0 };
                teamMeetings.forEach((m: any) => {
                  const cs = m.lmtg_sp_constituency_stance || '';
                  const ch = m.lmtg_sp_change_stance || '';
                  if (cs === 'affirm') constCounts.affirm++;
                  if (cs === 'challenge') constCounts.challenge++;
                  if (ch === 'affirm') changeCounts.affirm++;
                  if (ch === 'challenge') changeCounts.challenge++;
                });
                const hasConstData = constCounts.affirm > 0 || constCounts.challenge > 0;
                const hasChangeData = changeCounts.affirm > 0 || changeCounts.challenge > 0;

                return (
                  <Card key={team.id} elevation={1} sx={{
                    border: '1px solid',
                    borderColor: isLead ? 'primary.main' : 'divider',
                    borderLeft: isLead ? '3px solid' : '1px solid',
                    borderLeftColor: isLead ? 'primary.main' : 'divider',
                  }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            {team.teamName || 'Unnamed Team'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                            {team.chapter} &middot; {members.length} member{members.length !== 1 ? 's' : ''}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => handleEditTeam(team)}
                          sx={{ mt: -0.5 }}
                        >
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>

                      {/* Constituency / Turf */}
                      {team.constituency && (
                        <Box sx={{ mt: 0.75, p: 0.75, borderRadius: 1, bgcolor: '#f8f9fa', border: '1px solid #e9ecef' }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', display: 'block', mb: 0.25 }}>
                            Constituency / Turf
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', lineHeight: 1.3 }}>
                            {team.constituency}
                          </Typography>
                          {hasConstData && (
                            <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5 }}>
                              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.75, py: 0.25, borderRadius: 1, bgcolor: '#f0fdf9', border: '1px solid #99f6e4' }}>
                                <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#0f766e' }}>Affirm {constCounts.affirm}</Typography>
                              </Box>
                              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.75, py: 0.25, borderRadius: 1, bgcolor: '#fef2f2', border: '1px solid #fca5a5' }}>
                                <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#b91c1c' }}>Challenge {constCounts.challenge}</Typography>
                              </Box>
                            </Box>
                          )}
                        </Box>
                      )}

                      {/* Shared Purpose */}
                      {team.sharedPurpose && (
                        <Box sx={{ mt: 0.75, p: 0.75, borderRadius: 1, bgcolor: '#f8f9fa', border: '1px solid #e9ecef' }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', display: 'block', mb: 0.25 }}>
                            Shared Purpose
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem', lineHeight: 1.3, fontStyle: 'italic' }}>
                            {team.sharedPurpose}
                          </Typography>
                          {hasChangeData && (
                            <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5 }}>
                              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.75, py: 0.25, borderRadius: 1, bgcolor: '#f0fdf9', border: '1px solid #99f6e4' }}>
                                <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#0f766e' }}>Affirm {changeCounts.affirm}</Typography>
                              </Box>
                              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.75, py: 0.25, borderRadius: 1, bgcolor: '#fef2f2', border: '1px solid #fca5a5' }}>
                                <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#b91c1c' }}>Challenge {changeCounts.challenge}</Typography>
                              </Box>
                            </Box>
                          )}
                        </Box>
                      )}

                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
                        {members.slice(0, 8).map((member: any) => (
                          <Chip
                            key={member.id}
                            label={member.name}
                            size="small"
                            variant={member.id === team.lead?.id ? 'filled' : 'outlined'}
                            color={member.id === team.lead?.id ? 'primary' : 'default'}
                            onClick={() => onPersonDetailsOpen?.(member.id)}
                            sx={{ height: 22, fontSize: '0.7rem', cursor: 'pointer' }}
                          />
                        ))}
                        {members.length > 8 && (
                          <Chip
                            label={`+${members.length - 8} more`}
                            size="small"
                            variant="outlined"
                            sx={{ height: 22, fontSize: '0.65rem' }}
                          />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Organizing Section */}
        <Box>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {/* Your People Card - Lists, People, and Leaders */}
          <Box sx={{ flex: '1 1 450px', minWidth: '350px', display: 'flex' }}>
            <Card elevation={1} sx={{ width: '100%', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 280px)', minHeight: '600px' }}>
              <CardContent sx={{ py: 1, px: 1.5, flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
                  {/* Header row with title and actions */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Your People
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {turfTab === 'people' && (
                        <IconButton
                          size="small"
                          onClick={() => setShowMyPeopleFilters(!showMyPeopleFilters)}
                          sx={{ 
                            color: showMyPeopleFilters || dashboardPeopleFilters.loeStatus.length > 0 || dashboardPeopleFilters.memberStatus.length > 0 || dashboardPeopleFilters.chapter || dashboardPeopleFilters.searchText || dashboardPeopleFilters.lastContactFilter !== 'all' || dashboardPeopleFilters.meetingCountFilter !== 'all' || dashboardPeopleFilters.actionStatus !== 'all'
                              ? 'primary.main' 
                              : 'text.secondary',
                            position: 'relative'
                          }}
                        >
                          <FilterListIcon fontSize="small" />
                          {(dashboardPeopleFilters.loeStatus.length > 0 || dashboardPeopleFilters.memberStatus.length > 0 || dashboardPeopleFilters.chapter || dashboardPeopleFilters.searchText || dashboardPeopleFilters.lastContactFilter !== 'all' || dashboardPeopleFilters.meetingCountFilter !== 'all' || dashboardPeopleFilters.actionStatus !== 'all') && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: -4,
                                right: -4,
                                backgroundColor: 'primary.main',
                                color: 'white',
                                borderRadius: '50%',
                                width: 16,
                                height: 16,
                                fontSize: '0.7rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold'
                              }}
                            >
                              {[
                                dashboardPeopleFilters.chapter,
                                dashboardPeopleFilters.searchText,
                                dashboardPeopleFilters.loeStatus.length > 0,
                                dashboardPeopleFilters.memberStatus.length > 0,
                                dashboardPeopleFilters.lastContactFilter !== 'all',
                                dashboardPeopleFilters.meetingCountFilter !== 'all',
                                dashboardPeopleFilters.actionStatus !== 'all'
                              ].filter(Boolean).length}
                            </Box>
                          )}
                        </IconButton>
                      )}
                    </Box>
                  </Box>

                  {/* Filter Chips Row - directly under header for My People */}
                  {turfTab === 'people' && (dashboardPeopleFilters.chapter || dashboardPeopleFilters.loeStatus.length > 0 || dashboardPeopleFilters.memberStatus.length > 0 || dashboardPeopleFilters.lastContactFilter !== 'all' || dashboardPeopleFilters.meetingCountFilter !== 'all' || dashboardPeopleFilters.actionStatus !== 'all') && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                      {dashboardPeopleFilters.chapter && (
                        <Chip
                          label={`Chapter: ${dashboardPeopleFilters.chapter}`}
                          size="small"
                          onDelete={() => setDashboardPeopleFilters((prev: any) => ({ ...prev, chapter: '' }))}
                        />
                      )}
                      {dashboardPeopleFilters.loeStatus.map((status: string) => (
                        <Chip
                          key={`loe-${status}`}
                          label={`LOE: ${status.replace(/^\d+[_.]/, '')}`}
                          size="small"
                          onDelete={() => setDashboardPeopleFilters((prev: any) => ({ 
                            ...prev, 
                            loeStatus: prev.loeStatus.filter((s: string) => s !== status) 
                          }))}
                        />
                      ))}
                      {dashboardPeopleFilters.memberStatus.map((status: string) => (
                        <Chip
                          key={`member-${status}`}
                          label={`Member: ${status}`}
                          size="small"
                          onDelete={() => setDashboardPeopleFilters((prev: any) => ({ 
                            ...prev, 
                            memberStatus: prev.memberStatus.filter((s: string) => s !== status) 
                          }))}
                          color={status === 'Active' ? 'success' : status === 'Lapsed' ? 'warning' : 'default'}
                        />
                      ))}
                      {dashboardPeopleFilters.lastContactFilter !== 'all' && (
                        <Chip
                          label={`Last Contact: ${dashboardPeopleFilters.lastContactFilter}`}
                          size="small"
                          onDelete={() => setDashboardPeopleFilters((prev: any) => ({ ...prev, lastContactFilter: 'all' }))}
                        />
                      )}
                      {dashboardPeopleFilters.meetingCountFilter !== 'all' && (
                        <Chip
                          label={`Meetings: ${dashboardPeopleFilters.meetingCountFilter}`}
                          size="small"
                          onDelete={() => setDashboardPeopleFilters((prev: any) => ({ ...prev, meetingCountFilter: 'all' }))}
                        />
                      )}
                      {dashboardPeopleFilters.actionStatus !== 'all' && (
                        <Chip
                          label={`Action: ${dashboardPeopleFilters.actionStatus}`}
                          size="small"
                          onDelete={() => setDashboardPeopleFilters((prev: any) => ({ ...prev, actionStatus: 'all' }))}
                        />
                      )}
                    </Box>
                  )}
                </Box>

                {/* Tabs row */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Tabs 
                    value={turfTab} 
                    onChange={(_, newValue) => {
                      setTurfTab(newValue);
                      const params = new URLSearchParams(window.location.search);
                      params.set('dashboardTab', newValue);
                      window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
                    }}
                    sx={{ 
                      minHeight: 36,
                      flex: 1,
                      '& .MuiTab-root': { 
                        minHeight: 36, 
                        py: 0.5,
                        fontSize: '0.8rem'
                      }
                    }}
                  >
                    <Tab 
                      label={
                        (dashboardPeopleFilters.loeStatus.length > 0 || dashboardPeopleFilters.memberStatus.length > 0 || dashboardPeopleFilters.chapter || dashboardPeopleFilters.searchText || dashboardPeopleFilters.lastContactFilter !== 'all' || dashboardPeopleFilters.meetingCountFilter !== 'all' || dashboardPeopleFilters.actionStatus !== 'all')
                          ? `My People (filtered)`
                          : `My People`
                      } 
                      value="people" 
                    />
                    <Tab label={`My Leaders (${myLeaders.length})`} value="leaders" />
                    <Tab 
                      label={`My Conversations (${sharedCachedMeetings.filter((m: any) => getAllOrganizerVanIds.includes(m.organizer_vanid?.toString())).length})`}
                      value="conversations" 
                    />
                    <Tab label="My Lists" value="lists" />
                    <Tab label="My Actions" value="actions" />
                  </Tabs>
                </Box>

                {/* Action buttons + search bar row */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PersonIcon />}
                    onClick={() => setShowBatchAddDialog(true)}
                    sx={{ fontSize: '0.75rem', px: 1.5 }}
                  >
                    Add People
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setShowAddTurfDialog(true)}
                    sx={{ fontSize: '0.75rem', px: 1.5 }}
                  >
                    Add to List
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ChatIcon />}
                    onClick={() => setShowLogConversationDialog(true)}
                    sx={{ fontSize: '0.75rem', px: 1.5 }}
                  >
                    Log Conversation
                  </Button>
                  <Box sx={{ flex: 1 }} />
                  {turfTab === 'people' && (
                    <TextField
                      size="small"
                      placeholder="Search..."
                      value={dashboardPeopleFilters.searchText || ''}
                      onChange={(e) => setDashboardPeopleFilters((prev: any) => ({ ...prev, searchText: e.target.value }))}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                          </InputAdornment>
                        ),
                        endAdornment: dashboardPeopleFilters.searchText && (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              onClick={() => setDashboardPeopleFilters((prev: any) => ({ ...prev, searchText: '' }))}
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                      sx={{
                        width: 200,
                        bgcolor: 'background.paper',
                        '& .MuiOutlinedInput-root': {
                          fontSize: '0.8rem',
                          height: 36
                        }
                      }}
                    />
                  )}
                </Box>

                {/* My Lists Tab Content */}
                <Box sx={{ display: turfTab === 'lists' ? 'block' : 'none', flex: 1, overflow: 'hidden' }}>
                  {/* Target Audience Sub-Tabs with Copy Button */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs 
                    value={listAudienceFilter} 
                    onChange={(e, newValue) => setListAudienceFilter(newValue)}
                    sx={{ minHeight: 40, flex: 1 }}
                  >
                    <Tab label="Constituents" value="constituent" sx={{ minHeight: 40, py: 1 }} />
                    <Tab label="Leaders" value="leadership" sx={{ minHeight: 40, py: 1 }} />
                  </Tabs>
                  <Tooltip title="Copy this view to clipboard">
                    <IconButton 
                      onClick={copyMyListsToClipboard}
                      size="small"
                      sx={{ mr: 1 }}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* Status Filter Chips */}
                {listStatusFilter !== 'all' && (
                  <Box sx={{ mb: 1 }}>
                    <Chip
                      label={`Status: ${listStatusFilter === 'complete' ? 'Complete' : 'In Progress'}`}
                      size="small"
                      onDelete={() => setListStatusFilter('all')}
                      onClick={() => setListStatusFilter('all')}
                    />
                  </Box>
                )}
                {/* Table - Each Action as a Column - Show ALL live actions */}
                {myTurf.filter(p => availableActions.some((a: any) => {
                  if (a.action_id !== p.action || a.status !== 'live') return false;
                  // Show if target_audience matches or is null
                  return a.target_audience === listAudienceFilter || !a.target_audience;
                })).length > 0 ? (
                  <TableContainer sx={{ maxHeight: 'calc(100vh - 360px)', minHeight: '500px' }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        {/* Single header row with action groups and field names */}
                        <TableRow>
                          <TableCell 
                            sx={{ 
                              fontWeight: 600,
                              py: 1,
                              position: 'sticky', 
                              left: 0, 
                              bgcolor: 'background.paper', 
                              zIndex: 3,
                              minWidth: 150
                            }}
                          >
                            Name
                          </TableCell>
                          {/* Leader Performance column - only show if viewing leadership actions */}
                          {listAudienceFilter === 'leadership' && availableActions.some((a: any) => 
                            a.status === 'live' && 
                            a.target_audience === 'leadership'
                          ) && (
                            <TableCell 
                              sx={{ 
                                fontWeight: 600,
                                py: 1,
                                minWidth: 200,
                                borderLeft: '2px solid #9c27b0',
                                bgcolor: '#f3e5f5'
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <LeadershipIcon sx={{ fontSize: 14, color: '#9c27b0' }} />
                                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                  Leader Performance
                                </Typography>
                              </Box>
                            </TableCell>
                          )}
                          {availableActions
                            .filter((a: any) => {
                              if (a.status !== 'live') return false;
                              // Show if target_audience matches or is null
                              return a.target_audience === listAudienceFilter || !a.target_audience;
                            })
                            .map((action: any) => {
                              if (!action || !action.fields) return null;
                              
                              // Calculate conversion stats for this action
                              const actionEntries = myTurf.filter(p => p.action === action.action_id);
                              const totalNamed = actionEntries.length;
                              
                              return action.fields.map((field: any, fieldIndex: number) => {
                                // Calculate conversion rate for this field
                                let conversionRate = 0;
                                let conversionText = '';
                                
                                if (totalNamed > 0 && action.fields.length > 1) {
                                  const completed = actionEntries.filter(p => p.fields?.[field.key] === true).length;
                                  
                                  if (fieldIndex === 0) {
                                    // First step: conversion from "named" (total on list)
                                    conversionRate = (completed / totalNamed) * 100;
                                    conversionText = `${Math.round(conversionRate)}% of ${totalNamed}`;
                                  } else {
                                    // Subsequent steps: conversion from previous step
                                    const prevField = action.fields[fieldIndex - 1];
                                    const prevCompleted = actionEntries.filter(p => p.fields?.[prevField.key] === true).length;
                                    if (prevCompleted > 0) {
                                      conversionRate = (completed / prevCompleted) * 100;
                                      conversionText = `${Math.round(conversionRate)}% from ${prevField.label}`;
                                    }
                                  }
                                }
                                
                                return (
                                  <TableCell 
                                    key={`${action.action_id}-${field.key}`}
                                    align="center"
                                    sx={{ 
                                      fontWeight: 600,
                                      py: 1,
                                      minWidth: 100,
                                      bgcolor: fieldIndex === 0 ? '#f5f5f5' : 'background.paper',
                                      borderLeft: fieldIndex === 0 ? '2px solid #e0e0e0' : '1px solid #e0e0e0'
                                    }}
                                  >
                                    <Box>
                                      {fieldIndex === 0 && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.25 }}>
                                          {action.target_audience === 'leadership' ? (
                                            <LeadershipIcon sx={{ fontSize: 12, color: '#9c27b0' }} />
                                          ) : (
                                            <PersonIcon sx={{ fontSize: 12, color: '#2e7d32' }} />
                                          )}
                                          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                                            {action.action_name}
                                          </Typography>
                                        </Box>
                                      )}
                                      <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                                        {field.label}
                                      </Typography>
                                      {conversionText && (
                                        <Typography 
                                          variant="caption" 
                                          sx={{ 
                                            display: 'block',
                                            fontSize: '0.65rem',
                                            color: conversionRate >= 50 ? 'success.main' : 'warning.main',
                                            fontWeight: 500,
                                            mt: 0.25
                                          }}
                                        >
                                          {conversionText}
                                        </Typography>
                                      )}
                                    </Box>
                                  </TableCell>
                                );
                              });
                            })
                          }
                          <TableCell 
                            align="center"
                            width={50}
                            sx={{ 
                              fontWeight: 600,
                              py: 1
                            }}
                          >
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {/* Group by person - one row per person */}
                        {Array.from(new Set(myTurf
                          .filter(p => availableActions.some((a: any) => {
                            if (a.action_id !== p.action || a.status !== 'live') return false;
                            // Show if target_audience matches or is null
                            return a.target_audience === listAudienceFilter || !a.target_audience;
                          }))
                          .map(p => p.vanid)
                        ))
                        .map(vanid => {
                          // Get all live actions for this person
                          const liveActionIds = availableActions
                            .filter((a: any) => {
                              if (a.status !== 'live') return false;
                              // Show if target_audience matches or is null
                              return a.target_audience === listAudienceFilter || !a.target_audience;
                            })
                            .map((a: any) => a.action_id);
                          const personEntries = myTurf.filter(p => p.vanid === vanid && liveActionIds.includes(p.action));
                          const firstEntry = personEntries[0];
                          
                          return (
                            <TableRow
                              key={vanid}
                              sx={{ 
                                '&:hover': { bgcolor: '#f5f5f5' }
                              }}
                            >
                              <TableCell 
                                sx={{ 
                                  py: 0.75,
                                  position: 'sticky', 
                                  left: 0, 
                                  bgcolor: 'background.paper', 
                                  zIndex: 1 
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                  <PersonChip
                                    name={`${firstEntry.firstName} ${firstEntry.lastName}`}
                                    vanId={vanid.toString()}
                                    allMappings={organizerMappings}
                                    onViewDetails={(_, vanId) => {
                                      onPersonDetailsOpen?.(vanId || vanid.toString());
                                    }}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.8rem' }}
                                  />
                                  {/* LOE Chip */}
                                  {firstEntry.loeStatus && (
                                    <Chip
                                      label={firstEntry.loeStatus.replace(/_/g, ' ').replace(/^\d+\s*/, '')}
                                      size="small"
                                      sx={{
                                        height: 18,
                                        fontSize: '0.65rem',
                                        bgcolor: getLOEColor(firstEntry.loeStatus),
                                        color: 'white',
                                        fontWeight: 500,
                                        '& .MuiChip-label': { px: 0.5 }
                                      }}
                                    />
                                  )}
                                  {/* Membership Chip */}
                                  {firstEntry.memberStatus && (
                                    <Chip
                                      label={firstEntry.memberStatus}
                                      size="small"
                                      sx={{
                                        height: 18,
                                        fontSize: '0.65rem',
                                        bgcolor: firstEntry.memberStatus === 'Active' ? '#4caf50' : 
                                                firstEntry.memberStatus === 'Lapsed' ? '#ff9800' : '#757575',
                                        color: 'white',
                                        fontWeight: 500,
                                        '& .MuiChip-label': { px: 0.5 }
                                      }}
                                    />
                                  )}
                                </Box>
                              </TableCell>
                              
                              {/* Leader Performance cell - show constituent action progress if viewing leadership actions */}
                              {listAudienceFilter === 'leadership' && availableActions.some((a: any) => 
                                a.status === 'live' && 
                                a.target_audience === 'leadership'
                              ) && (() => {
                                // Find this person in myLeaders to get their action progress
                                const findLeaderRecursive = (leaders: LeaderProgress[], targetId: string): LeaderProgress | null => {
                                  for (const leader of leaders) {
                                    if (leader.id === targetId.toString()) return leader;
                                    if (leader.subLeaders && leader.subLeaders.length > 0) {
                                      const found = findLeaderRecursive(leader.subLeaders, targetId);
                                      if (found) return found;
                                    }
                                  }
                                  return null;
                                };
                                
                                const leaderData = findLeaderRecursive(myLeaders, vanid.toString());
                                
                                // Get constituent actions to display
                                const constituentActions = availableActions.filter((a: any) => 
                                  a.status === 'live' && 
                                  (a.target_audience === 'constituent' || !a.target_audience)
                                );
                                
                                return (
                                  <TableCell 
                                    sx={{ 
                                      py: 0.75,
                                      borderLeft: '2px solid #9c27b0',
                                      bgcolor: '#fafafa',
                                      verticalAlign: 'top'
                                    }}
                                  >
                                    {leaderData ? (
                                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                        {constituentActions.map((constAction: any) => {
                                          const progress = leaderData.actionProgress?.[constAction.action_id];
                                          if (!progress) return null;
                                          
                                          const hasGoal = constAction.has_goal !== false;
                                          const percentage = progress.goal > 0 ? (progress.count / progress.goal) * 100 : 0;
                                          
                                          return (
                                            <Box key={constAction.action_id} sx={{ minWidth: 180 }}>
                                              {hasGoal ? (
                                                <>
                                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                                                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                                                      {constAction.action_name}
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600 }}>
                                                      {progress.count} / {progress.goal}
                                                    </Typography>
                                                  </Box>
                                                  <LinearProgress
                                                    variant="determinate"
                                                    value={Math.min(percentage, 100)}
                                                    sx={{
                                                      height: 4,
                                                      borderRadius: 1,
                                                      backgroundColor: '#e0e0e0',
                                                      '& .MuiLinearProgress-bar': {
                                                        backgroundColor: progress.hasMetGoal ? '#4caf50' : '#2e7d32'
                                                      }
                                                    }}
                                                  />
                                                </>
                                              ) : (
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                  <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                                                    {constAction.action_name}
                                                  </Typography>
                                                  <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600 }}>
                                                    {progress.count}
                                                  </Typography>
                                                </Box>
                                              )}
                                            </Box>
                                          );
                                        })}
                                        {constituentActions.length === 0 && (
                                          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', fontStyle: 'italic' }}>
                                            No constituent actions
                                          </Typography>
                                        )}
                                      </Box>
                                    ) : (
                                      <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', fontStyle: 'italic' }}>
                                        Not in My Leaders
                                      </Typography>
                                    )}
                                  </TableCell>
                                );
                              })()}
                              
                              {/* One cell per field of each live action */}
                              {availableActions
                                .filter((a: any) => {
                                  if (a.status !== 'live') return false;
                                  // Show if target_audience matches or is null
                                  return a.target_audience === listAudienceFilter || !a.target_audience;
                                })
                                .map((action: any) => {
                                  const actionId = action.action_id;
                                  const entry = personEntries.find(e => e.action === actionId);
                                
                                if (!entry) {
                                  // Single merged cell with add button when person not on this list
                                  return (
                                    <TableCell 
                                      key={`${actionId}-add`}
                                      colSpan={action.fields?.length || 1}
                                      align="center"
                                      sx={{ 
                                        py: 0.75,
                                        borderLeft: '2px solid #e0e0e0',
                                        bgcolor: '#f9f9f9'
                                      }}
                                    >
                                      <Tooltip title={`Add to ${action.action_name} list`}>
                                        <IconButton
                                          size="small"
                                          onClick={async () => {
                                            try {
                                              // Initialize fields for this action (all false)
                                              const initialFields: Record<string, boolean> = {};
                                              action.fields.forEach((field: any) => {
                                                initialFields[field.key] = false;
                                              });
                                              
                                              // Add to database
                                              const success = await addToList({
                                                organizer_vanid: selectedOrganizerId,
                                                contact_vanid: vanid,
                                                contact_name: `${firstEntry.firstName} ${firstEntry.lastName}`,
                                                action_id: actionId,
                                                action: action.action_name,
                                                desired_change: '',
                                                progress: initialFields
                                              });
                                              
                                              if (success) {
                                                // Reload list from database
                                                const lists = await fetchLists(selectedOrganizerId);
                                                const turfPeople: TurfPerson[] = lists.map(item => ({
                                                  vanid: parseInt(item.vanid),
                                                  firstName: item.contact_name.split(' ')[0] || '',
                                                  lastName: item.contact_name.split(' ').slice(1).join(' ') || '',
                                                  desiredChange: item.desired_change || '',
                                                  action: item.action_id,
                                                  fields: item.progress || {},
                                                  datePledged: item.date_pledged,
                                                  list_id: item.list_id
                                                }));
                                                setTurfList(turfPeople);
                                              }
                                            } catch (error) {
                                              console.error('Error adding to list:', error);
                                              alert('Failed to add person to list. Please try again.');
                                            }
                                          }}
                                          sx={{
                                            color: '#1976d2',
                                            '&:hover': {
                                              bgcolor: '#e3f2fd',
                                              color: '#1565c0'
                                            }
                                          }}
                                        >
                                          <AddIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    </TableCell>
                                  );
                                }
                                
                                // Render each field in its own cell
                                return action.fields && action.fields.map((field: any, fieldIndex: number) => {
                                  const fieldType = field.type || 'boolean';
                                  
                                  return (
                                    <TableCell 
                                      key={`${actionId}-${field.key}`}
                                      align="center"
                                      sx={{ 
                                        py: 0.75,
                                        borderLeft: fieldIndex === 0 ? '2px solid #e0e0e0' : '1px solid #e0e0e0'
                                      }}
                                    >
                                      {/* Boolean field - checkbox */}
                                      {fieldType === 'boolean' && (
                                        <Checkbox
                                          size="small"
                                          checked={entry.fields[field.key] || false}
                                          onChange={async (e) => {
                                            if (!entry.list_id) return;
                                            
                                            const newValue = e.target.checked;
                                            const newFields = { ...entry.fields, [field.key]: newValue };
                                            await updateListItem(entry.list_id, {
                                              progress: newFields
                                            });
                                            setTurfList(prev => prev.map(p => 
                                              p.list_id === entry.list_id 
                                                ? { ...p, fields: newFields }
                                                : p
                                            ));
                                          }}
                                          sx={{ 
                                            p: 0,
                                            '& .MuiSvgIcon-root': { fontSize: 20 }
                                          }}
                                        />
                                      )}
                                      
                                      {/* Select field - dropdown */}
                                      {fieldType === 'select' && (
                                        <Select
                                          size="small"
                                          value={entry.fields[field.key] || ''}
                                          onChange={async (e) => {
                                            if (!entry.list_id) return;
                                            
                                            const newValue = e.target.value;
                                            const newFields = { ...entry.fields, [field.key]: newValue };
                                            await updateListItem(entry.list_id, {
                                              progress: newFields
                                            });
                                            setTurfList(prev => prev.map(p => 
                                              p.list_id === entry.list_id 
                                                ? { ...p, fields: newFields }
                                                : p
                                            ));
                                          }}
                                          displayEmpty
                                          sx={{ 
                                            minWidth: 120,
                                            '& .MuiSelect-select': {
                                              fontSize: '0.75rem',
                                              py: 0.5
                                            }
                                          }}
                                        >
                                          <MenuItem value="" sx={{ fontSize: '0.75rem' }}><em>—</em></MenuItem>
                                          {field.options && field.options.map((option: string) => (
                                            <MenuItem key={option} value={option} sx={{ fontSize: '0.75rem' }}>
                                              {option}
                                            </MenuItem>
                                          ))}
                                        </Select>
                                      )}
                                      
                                      {/* Text field - input */}
                                      {fieldType === 'text' && (
                                        <TextField
                                          size="small"
                                          value={entry.fields[field.key] || ''}
                                          onChange={(e) => {
                                            const newValue = e.target.value;
                                            const newFields = { ...entry.fields, [field.key]: newValue };
                                            setTurfList(prev => prev.map(p => 
                                              p.list_id === entry.list_id 
                                                ? { ...p, fields: newFields }
                                                : p
                                            ));
                                          }}
                                          onBlur={async (e) => {
                                            if (!entry.list_id) return;
                                            
                                            const newValue = e.target.value;
                                            const newFields = { ...entry.fields, [field.key]: newValue };
                                            await updateListItem(entry.list_id, {
                                              progress: newFields
                                            });
                                          }}
                                          placeholder="Enter..."
                                          sx={{ 
                                            minWidth: 150,
                                            '& .MuiInputBase-input': { 
                                              fontSize: '0.75rem',
                                              py: 0.5
                                            }
                                          }}
                                        />
                                      )}
                                      
                                      {/* Conversation field - log conversation button */}
                                      {fieldType === 'conversation' && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                          {entry.fields[field.key] ? (
                                            <Chip
                                              label="Logged"
                                              size="small"
                                              color="success"
                                              sx={{ height: 20, fontSize: '0.7rem' }}
                                            />
                                          ) : (
                                            <Button
                                              size="small"
                                              variant="outlined"
                                              startIcon={<ChatIcon />}
                                              onClick={() => {
                                                if (!entry.list_id) return;
                                                const person = allPeople.find(p => p.id === vanid.toString());
                                                if (person) {
                                                  setSelectedPersonForConversation(person);
                                                  setSelectedActionForConversation({
                                                    actionId,
                                                    listId: entry.list_id,
                                                    fieldKey: field.key
                                                  });
                                                  setShowLogConversationDialog(true);
                                                }
                                              }}
                                              sx={{ 
                                                fontSize: '0.7rem',
                                                py: 0.25,
                                                px: 1
                                              }}
                                            >
                                              Log
                                            </Button>
                                          )}
                                        </Box>
                                      )}
                                    </TableCell>
                                  );
                                });
                              })}
                              
                              <TableCell align="center" sx={{ py: 0.75 }}>
                                <Tooltip title="Remove from all lists">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleRemoveTurfPerson(vanid)}
                                    sx={{ 
                                      p: 0.5,
                                      color: 'text.secondary',
                                      '&:hover': { color: 'error.main' }
                                    }}
                                  >
                                    <DeleteIcon sx={{ fontSize: 18 }} />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No people for selected actions. Add people you're reaching out to!
                  </Typography>
                )}
                </Box>

                {/* My People Tab Content - Reuse PeoplePanel */}
                <Box sx={{ display: turfTab === 'people' ? 'flex' : 'none', flexDirection: 'column', height: 'calc(100vh - 360px)', minHeight: '500px', overflow: 'hidden' }}>
                  <Box sx={{ flex: 1, overflow: 'hidden' }}>
                    <PeoplePanel
                      showCopyButton={true}
                      meetings={sharedCachedMeetings}
                      contacts={sharedAllContacts}
                      selectedNodeId={null}
                      currentDateRange={currentDateRange ? [currentDateRange.start, currentDateRange.end] : null}
                      userMap={peopleUserMap as any}
                      orgIds={[]}
                      selectedChapter={selectedChapter || 'All Chapters'}
                      onNodeHover={() => {}}
                      nodes={[]}
                      onClearFilter={() => {}}
                      onAddConnection={() => {}}
                      currentVisualization="people"
                      peopleFilters={dashboardPeopleFilters}
                      onFiltersChange={setDashboardPeopleFilters}
                      selectedActions={currentOrganizerLiveActions}
                      currentUserId={currentUserId || undefined}
                      currentUserName={currentUserInfo?.fullName || currentUserInfo?.firstname || ''}
                      actions={actionsProp}
                      turfLists={turfList}
                      hideColumns={['chapter', 'organizer']}
                      externalFilterOpen={showMyPeopleFilters}
                      onExternalFilterOpenChange={setShowMyPeopleFilters}
                      sharedAllContacts={sharedAllContacts}
                      sharedCachedMeetings={sharedCachedMeetings}
                      organizerMappings={organizerMappings}
                      onEditPerson={handleOpenEditPerson}
                      onAddConversation={handleOpenLogConversation}
                      onAddToAction={handleOpenAddToAction}
                      hideActionButtons={true}
                      onEditConversation={handleEditConversationFromMeeting}
                    />
                  </Box>
                </Box>

                {/* My Leaders Tab Content */}
                <Box sx={{ display: turfTab === 'leaders' ? 'block' : 'none', flex: 1, overflow: 'auto' }}>
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Button
                        startIcon={<AddIcon />}
                        size="small"
                        variant="outlined"
                        onClick={() => setShowAddLeaderDialog(true)}
                        disabled={conversationPeopleForLeaders.length === 0}
                      >
                        Add Leader
                      </Button>
                      <Tooltip title="Copy this view to clipboard">
                        <IconButton 
                          onClick={copyMyLeadersToClipboard}
                          size="small"
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    {myLeaders.length > 0 ? (
                      <>
                        {(() => {
                          // Calculate unified action IDs for the table
                          const allActionIds = new Set<string>();
                          myLeaders.forEach(leader => {
                            const actions = leaderActionsMap[leader.id] || [];
                            actions.forEach(actionId => allActionIds.add(actionId));
                          });
                          
                          const federationActions = ['sign_pledge', 'registration_real'];
                          const unifiedActionIdsForTable = Array.from(allActionIds).sort((a, b) => {
                            const aIsFederation = federationActions.includes(a);
                            const bIsFederation = federationActions.includes(b);
                            
                            if (aIsFederation && !bIsFederation) return -1;
                            if (!aIsFederation && bIsFederation) return 1;
                            return a.localeCompare(b);
                          });
                          
                          // Calculate summary stats
                          const directLeaders = myLeaders;
                          const totalDirectLeaders = directLeaders.length;
                          const directLeadersAtGoal = directLeaders.filter(leader => leader.hasMetGoal).length;
                          
                          const allSubLeaders: any[] = [];
                          directLeaders.forEach(leader => {
                            if (leader.subLeaders && leader.subLeaders.length > 0) {
                              allSubLeaders.push(...leader.subLeaders);
                            }
                          });
                          const totalSecondLevelLeaders = allSubLeaders.length;
                          const secondLevelLeadersAtGoal = allSubLeaders.filter(sl => sl.hasMetGoal).length;
                          
                          return (
                            <>
                              {/* Team Summary Cards - Clean Minimal Design */}
                              <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                                {/* My Leaders Summary */}
                                <Box sx={{ 
                                  p: 1.5, 
                                  flex: '1 1 200px',
                                  border: '1px solid #e0e0e0',
                                  borderRadius: 1,
                                  bgcolor: 'background.paper'
                                }}>
                                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    My Leaders
                                  </Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mt: 0.5, mb: 1 }}>
                                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                                      {directLeadersAtGoal}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      / {totalDirectLeaders}
                                    </Typography>
                                    <Typography variant="caption" sx={{ ml: 0.5, color: 'text.secondary', fontSize: '0.7rem' }}>
                                      at goal
                                    </Typography>
                                  </Box>
                                  {/* Minimal Dot Grid */}
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
                                    {Array.from({ length: totalDirectLeaders }).map((_, idx) => (
                                      <Box
                                        key={idx}
                                        sx={{
                                          width: 10,
                                          height: 10,
                                          borderRadius: '50%',
                                          bgcolor: idx < directLeadersAtGoal ? 'primary.main' : '#e0e0e0',
                                          transition: 'all 0.2s'
                                        }}
                                      />
                                    ))}
                                  </Box>
                                </Box>
                                
                                {/* Their Leaders Summary - Only show if there are sub-leaders */}
                                {totalSecondLevelLeaders > 0 && (
                                  <Box sx={{ 
                                    p: 1.5, 
                                    flex: '1 1 200px',
                                    border: '1px solid #e0e0e0',
                                    borderRadius: 1,
                                    bgcolor: 'background.paper'
                                  }}>
                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                      Their Leaders
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mt: 0.5, mb: 1 }}>
                                      <Typography variant="h5" sx={{ fontWeight: 600 }}>
                                        {secondLevelLeadersAtGoal}
                                      </Typography>
                                      <Typography variant="body2" color="text.secondary">
                                        / {totalSecondLevelLeaders}
                                      </Typography>
                                      <Typography variant="caption" sx={{ ml: 0.5, color: 'text.secondary', fontSize: '0.7rem' }}>
                                        at goal
                                      </Typography>
                                    </Box>
                                    {/* Minimal Dot Grid */}
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
                                      {Array.from({ length: totalSecondLevelLeaders }).map((_, idx) => (
                                        <Box
                                          key={idx}
                                          sx={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: '50%',
                                            bgcolor: idx < secondLevelLeadersAtGoal ? 'secondary.main' : '#e0e0e0',
                                            transition: 'all 0.2s'
                                          }}
                                        />
                                      ))}
                                    </Box>
                                  </Box>
                                )}
                              </Box>
                              
                              <LeaderMetricsTable
                                leaders={myLeaders}
                                leaderActionsMap={leaderActionsMap}
                                leaderGoalsMap={leaderGoalsMap}
                                unifiedActionIds={unifiedActionIdsForTable}
                                ACTIONS={ACTIONS}
                                availableActions={availableActions}
                                currentUserId={currentUserId || undefined}
                                peopleRecords={peopleRecords}
                                reloadTriggers={leaderListReloadTrigger}
                                showSummary={false}
                                onRemoveLeader={(leaderId) => handleRemoveLeader(parseInt(leaderId))}
                                onAddToList={handleOpenAddLeaderToMyList}
                                onPersonDetailsOpen={onPersonDetailsOpen}
                                onFilterByOrganizer={onFilterByOrganizer}
                                listsData={myTurf.map(t => ({
                                  vanid: t.vanid,
                                  contact_name: `${t.firstName} ${t.lastName}`,
                                  action_id: t.action,
                                  progress: t.fields,
                                  fields: t.fields,
                                  list_id: t.list_id,
                                  organizer_vanid: selectedOrganizerId
                                }))}
                                onEditOrganizerMapping={onEditOrganizerMapping}
                                cachedMeetings={sharedCachedMeetings}
                                userMap={userMap as any}
                                allContacts={sharedAllContacts}
                                showConversions={showConversions}
                                onToggleConversions={setShowConversions}
                                currentDateRange={currentDateRange}
                              />
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          No leaders added yet. Add leaders above to track their progress.
                        </Typography>
                      </Box>
                    )}
                  </>
                </Box>

                {/* My Conversations Tab Content */}
                <Box sx={{ display: turfTab === 'conversations' ? 'flex' : 'none', flex: 1, overflow: 'hidden', flexDirection: 'column' }}>
                  <Box sx={{ p: 2, flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                    {/* Header row */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">My Conversations</Typography>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Select
                          size="small"
                          value={conversationSortOrder}
                          onChange={(e) => setConversationSortOrder(e.target.value as 'newest' | 'oldest')}
                          sx={{ fontSize: '0.8rem', height: 32 }}
                        >
                          <MenuItem value="newest">Newest first</MenuItem>
                          <MenuItem value="oldest">Oldest first</MenuItem>
                        </Select>
                      </Box>
                    </Box>

                    {/* Search bar */}
                    <TextField
                      size="small"
                      placeholder="Search by person name or notes…"
                      value={conversationSearchText}
                      onChange={(e) => setConversationSearchText(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                        endAdornment: conversationSearchText ? (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setConversationSearchText('')}>
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </InputAdornment>
                        ) : null,
                      }}
                      sx={{ mb: 2 }}
                      fullWidth
                    />

                    {/* Conversations table */}
                    {(() => {
                      const orgVanIds = getAllOrganizerVanIds;

                      const myConversations = sharedCachedMeetings
                        .filter((m: any) => orgVanIds.includes(m.organizer_vanid?.toString()))
                        .filter((m: any) => {
                          if (!conversationSearchText.trim()) return true;
                          const q = conversationSearchText.toLowerCase();
                          const contactName = [m.participant_first_name, m.participant_last_name].filter(Boolean).join(' ').toLowerCase();
                          const notes = [m.lmtg_notes, m.notes_purpose, m.lmtg_values, m.lmtg_difference, m.lmtg_resources, m.notes_stakes, m.notes_commitments, m.notes_evaluation].filter(Boolean).join(' ').toLowerCase();
                          return contactName.includes(q) || notes.includes(q);
                        })
                        .sort((a: any, b: any) => {
                          const dateA = new Date(a.date_contacted?.value || a.date_contacted || a.datestamp?.value || a.datestamp || 0).getTime();
                          const dateB = new Date(b.date_contacted?.value || b.date_contacted || b.datestamp?.value || b.datestamp || 0).getTime();
                          return conversationSortOrder === 'newest' ? dateB - dateA : dateA - dateB;
                        });

                      if (myConversations.length === 0) {
                        return (
                          <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                              {conversationSearchText ? 'No conversations match your search.' : 'No conversations logged yet. Use the button above to log your first conversation!'}
                            </Typography>
                          </Paper>
                        );
                      }

                      const stanceChipStyle = (stance: string): React.CSSProperties => {
                        const map: Record<string, { color: string; backgroundColor: string }> = {
                          affirm:    { color: '#0f766e', backgroundColor: '#ccfbf1' },
                          challenge: { color: '#b91c1c', backgroundColor: '#fee2e2' },
                          neither:   { color: '#9ca3af', backgroundColor: '#f3f4f6' },
                        };
                        const s = map[stance] || { color: '#9ca3af', backgroundColor: '#f3f4f6' };
                        return {
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          backgroundColor: s.backgroundColor,
                          color: s.color,
                          border: `1px solid ${s.color}`,
                          whiteSpace: 'nowrap' as const,
                        };
                      };
                      const stanceLabel = (s: string) =>
                        s === 'affirm' ? 'Affirm' : s === 'challenge' ? 'Challenge' : s === 'neither' ? 'Neither' : s;

                      const thStyle: React.CSSProperties = {
                        fontWeight: 600,
                        backgroundColor: '#fafafa',
                        fontSize: '0.75rem',
                        padding: '4px 12px',
                        textAlign: 'left',
                        borderBottom: '1px solid rgba(224,224,224,1)',
                        whiteSpace: 'nowrap',
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                      };
                      const tdStyle: React.CSSProperties = {
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        borderBottom: '1px solid rgba(224,224,224,1)',
                        verticalAlign: 'top',
                      };
                      const dash = <span style={{ color: '#bdbdbd' }}>—</span>;

                      return (
                        <Box sx={{ flex: 1, overflowX: 'auto', backgroundColor: '#fff', border: '1px solid rgba(224,224,224,1)', borderRadius: 1 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', backgroundColor: '#fff' }}>
                            <thead>
                              <tr>
                                <th style={{ ...thStyle, width: 90 }}>Date</th>
                                <th style={{ ...thStyle, width: 140 }}>Person</th>
                                <th style={{ ...thStyle, minWidth: 160 }}>Purpose</th>
                                <th style={{ ...thStyle, minWidth: 140 }}>Values</th>
                                <th style={{ ...thStyle, minWidth: 140 }}>Stakes</th>
                                <th style={{ ...thStyle, minWidth: 140 }}>Resources</th>
                                <th style={{ ...thStyle, minWidth: 140 }}>Commitments</th>
                                <th style={{ ...thStyle, minWidth: 140 }}>Constituency</th>
                                <th style={{ ...thStyle, minWidth: 140 }}>Change</th>
                                <th style={{ ...thStyle, width: 80 }}>Committed?</th>
                                <th style={{ ...thStyle, width: 40 }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {myConversations.map((m: any, idx: number) => {
                                const firstName = m.participant_first_name || '';
                                const lastName = m.participant_last_name || '';
                                const contactName = [firstName, lastName].filter(Boolean).join(' ') || `VAN ID ${m.participant_vanid || m.vanid || '?'}`;

                                const rawDate = m.date_contacted?.value || m.date_contacted || m.datestamp?.value || m.datestamp;
                                const displayDate = rawDate
                                  ? new Date(rawDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                  : '—';
                                const convType = m.meeting_type || m.conversation_type || '';
                                const leadershipTag = m.lmtg_leadership_tag || m.leadership_tag || '';
                                const loeColors = leadershipTag ? getLOEColor(leadershipTag) : null;

                                const isNewMeeting = m.data_source === 'lumoviz_meetings';
                                const purpose = m.notes_purpose || '';
                                const values = isNewMeeting ? (m.lmtg_values || '') : '';
                                const stakes = isNewMeeting ? (m.lmtg_difference || '') : (m.notes_stakes || '');
                                const resources = isNewMeeting ? (m.lmtg_resources || '') : '';
                                const commitments = isNewMeeting
                                  ? [m.lmtg_commitment_what, m.lmtg_notes].filter(Boolean).join(' / ')
                                  : [m.notes_commitments, m.notes_evaluation].filter(Boolean).join(' / ');

                                const constituencyStance = m.lmtg_sp_constituency_stance || '';
                                const constituencyHow = m.lmtg_sp_constituency_how || '';
                                const changeStance = m.lmtg_sp_change_stance || '';
                                const changeHow = m.lmtg_sp_change_how || '';
                                const commitmentMade = m.lmtg_commitment_made || m.commitment_made_yn || '';

                                return (
                                  <tr
                                    key={m.meeting_id || idx}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                  >
                                    <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: '#616161' }}>{displayDate}</td>

                                    <td style={tdStyle}>
                                      <div style={{ fontWeight: 600, fontSize: '0.82rem', lineHeight: 1.3 }}>{contactName}</div>
                                      <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                                        {convType && (
                                          <span style={{
                                            display: 'inline-block', padding: '1px 7px', borderRadius: 12,
                                            fontSize: '0.62rem', fontWeight: 600,
                                            backgroundColor: '#f0f4ff', color: '#3b5bdb',
                                            border: '1px solid #c5d0fc',
                                          }}>{convType}</span>
                                        )}
                                        {leadershipTag && loeColors && (
                                          <span style={{
                                            display: 'inline-block', padding: '1px 7px', borderRadius: 12,
                                            fontSize: '0.62rem', fontWeight: 700,
                                            backgroundColor: loeColors.backgroundColor,
                                            color: loeColors.color,
                                            border: `1px solid ${loeColors.color}`,
                                          }}>{leadershipTag}</span>
                                        )}
                                      </div>
                                    </td>

                                    <td style={tdStyle}>{purpose || dash}</td>
                                    <td style={tdStyle}>{values || dash}</td>
                                    <td style={tdStyle}>{stakes || dash}</td>
                                    <td style={tdStyle}>{resources || dash}</td>
                                    <td style={tdStyle}>{commitments || dash}</td>

                                    <td style={tdStyle}>
                                      {constituencyStance ? (
                                        <div>
                                          <span style={stanceChipStyle(constituencyStance)}>{stanceLabel(constituencyStance)}</span>
                                          {constituencyHow && <div style={{ marginTop: 4, fontSize: '0.72rem', color: '#616161', fontStyle: 'italic' }}>{constituencyHow}</div>}
                                        </div>
                                      ) : dash}
                                    </td>

                                    <td style={tdStyle}>
                                      {changeStance ? (
                                        <div>
                                          <span style={stanceChipStyle(changeStance)}>{stanceLabel(changeStance)}</span>
                                          {changeHow && <div style={{ marginTop: 4, fontSize: '0.72rem', color: '#616161', fontStyle: 'italic' }}>{changeHow}</div>}
                                        </div>
                                      ) : dash}
                                    </td>

                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                      {commitmentMade ? (
                                        <span style={{
                                          display: 'inline-block', padding: '2px 8px', borderRadius: 12,
                                          fontSize: '0.65rem', fontWeight: 700,
                                          backgroundColor: commitmentMade === 'yes' ? '#dcfce7' : '#f3f4f6',
                                          color: commitmentMade === 'yes' ? '#166534' : '#9ca3af',
                                          border: `1px solid ${commitmentMade === 'yes' ? '#86efac' : '#d1d5db'}`,
                                        }}>{commitmentMade === 'yes' ? '✓ Yes' : '✗ No'}</span>
                                      ) : dash}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center', padding: '4px' }}>
                                      {isNewMeeting && m.meeting_id && (
                                        <IconButton
                                          size="small"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditConversationFromMeeting(m);
                                          }}
                                          sx={{ p: 0.5 }}
                                        >
                                          <EditIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                        </IconButton>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </Box>
                      );
                    })()}
                  </Box>
                </Box>

                {/* My Actions Tab Content */}
                <Box sx={{ display: turfTab === 'actions' ? 'flex' : 'none', flex: 1, overflow: 'hidden', flexDirection: 'column' }}>
                  <Box sx={{ p: 2, flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">
                        My Actions
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Tooltip title="Copy this view to clipboard">
                          <IconButton 
                            onClick={copyMyActionsToClipboard}
                            size="small"
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Button
                          startIcon={<AddIcon />}
                          size="small"
                          variant="contained"
                          onClick={() => setShowAddActionDialog(true)}
                        >
                          Create Action
                        </Button>
                      </Box>
                    </Box>
                    
                    {/* Status Tabs: Live / Archived */}
                    <Tabs 
                      value={actionStatusFilter} 
                      onChange={(e, newValue) => setActionStatusFilter(newValue)}
                      sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
                    >
                      <Tab label="Live Actions" value="live" />
                      <Tab label="Archived" value="archived" />
                    </Tabs>
                    
                    {/* List of available actions - filtered by status */}
                    {loadingActions ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <LinearProgress sx={{ width: '50%' }} />
                      </Box>
                    ) : availableActions.filter(a => (a.status || 'live') === actionStatusFilter).length === 0 ? (
                      <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          {actionStatusFilter === 'live' 
                            ? 'No live actions available yet. Create your first action to get started!'
                            : 'No archived actions.'}
                        </Typography>
                      </Paper>
                    ) : (
                      <Box sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                        gap: 2, 
                        overflow: 'auto', 
                        pb: 2 
                      }}>
                        {availableActions
                          .filter(a => (a.status || 'live') === actionStatusFilter)
                          .map((action) => (
                          <Card key={action.action_id} variant="outlined" sx={{ display: 'flex', flexDirection: 'column' }}>
                            <CardContent sx={{ p: 1.5, flex: 1, display: 'flex', flexDirection: 'column', '&:last-child': { pb: 1.5 } }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                <Typography variant="subtitle1" sx={{ fontSize: '0.95rem', fontWeight: 600, lineHeight: 1.3, flex: 1, mr: 1 }}>
                                  {action.action_name}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                  {/* Target Audience Chip */}
                                  <Chip 
                                    icon={action.target_audience === 'leadership' ? <LeadershipIcon /> : <PersonIcon />}
                                    label={action.target_audience === 'leadership' ? 'Leaders' : 'Constituents'}
                                    size="small"
                                    color={action.target_audience === 'leadership' ? 'secondary' : 'success'}
                                    variant="filled"
                                    sx={{ 
                                      fontSize: '0.65rem', 
                                      height: 20,
                                      fontWeight: 600
                                    }}
                                  />
                                  {/* Visibility Chip */}
                                  <Chip 
                                    icon={action.organizer_vanid ? <PeopleIcon /> : <GroupsIcon />}
                                    label={action.organizer_vanid ? 'Personal' : 'Federation'}
                                    size="small"
                                    color={action.organizer_vanid ? 'primary' : 'default'}
                                    variant="outlined"
                                    sx={{ fontSize: '0.65rem', height: 20 }}
                                  />
                                </Box>
                              </Box>
                              
                              {/* Fields - show first 3 */}
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                                {action.fields && action.fields.slice(0, 3).map((field: any, idx: number) => (
                                  <Chip 
                                    key={idx}
                                    label={field.label} 
                                    size="small" 
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem', height: 20 }}
                                  />
                                ))}
                                {action.fields && action.fields.length > 3 && (
                                  <Chip 
                                    label={`+${action.fields.length - 3}`}
                                    size="small" 
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem', height: 20 }}
                                  />
                                )}
                              </Box>
                              
                              {/* Goal Display */}
                              {organizerGoals[action.action_id] && (
                                <Box sx={{ mb: 1, p: 0.75, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                                  <Typography variant="caption" sx={{ fontSize: '0.7rem' }} color="text.secondary">
                                    Goal: <strong>{organizerGoals[action.action_id]}</strong>
                                  </Typography>
                                </Box>
                              )}
                              
                              {/* Spacer */}
                              <Box sx={{ flex: 1 }} />
                              
                              {/* Action Buttons */}
                              <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                                {actionStatusFilter === 'live' && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => {
                                      setGoalActionId(action.action_id);
                                      setGoalValue(organizerGoals[action.action_id] || 5);
                                      setShowSetGoalDialog(true);
                                    }}
                                    sx={{ fontSize: '0.7rem', py: 0.25, px: 0.75 }}
                                  >
                                    {organizerGoals[action.action_id] ? 'Goal' : '+Goal'}
                                  </Button>
                                )}
                                
                                <>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                                    onClick={() => {
                                      // Map action object to CampaignAction format expected by dialog
                                      setEditingAction({
                                        id: action.action_id,
                                        name: action.action_name,
                                        fields: action.fields || [],
                                        goalFieldKey: action.goal_field_key,
                                        parentCampaignId: action.parent_campaign_id,
                                        goalTypeId: action.goal_type,
                                        chapters: action.chapters || [],
                                        creatorOrganizerVanid: action.organizer_vanid,
                                        visibleToOrganizers: action.visible_to_organizers,
                                        hasGoal: action.has_goal,
                                        targetAudience: action.target_audience,
                                        isTemplate: action.is_template,
                                        templateActionId: action.template_action_id,
                                        defaultIndividualGoal: action.default_individual_goal,
                                        // Rate-based and deadline fields
                                        actionType: action.action_type,
                                        recurrencePeriod: action.recurrence_period,
                                        recurrenceCount: action.recurrence_count,
                                        deadlineDate: action.deadline_date,
                                        deadlineType: action.deadline_type
                                      });
                                      setShowAddActionDialog(true);
                                    }}
                                    sx={{ fontSize: '0.7rem', py: 0.25, px: 0.75, flex: 1 }}
                                  >
                                    Edit
                                  </Button>
                                  
                                  <Tooltip title={actionStatusFilter === 'live' ? 'Archive' : 'Restore'}>
                                    <IconButton
                                      size="small"
                                      color={actionStatusFilter === 'live' ? 'warning' : 'success'}
                                      onClick={async () => {
                                        const newStatus = actionStatusFilter === 'live' ? 'archived' : 'live';
                                        try {
                                          await updateActionStatus(action.action_id, newStatus);
                                          const updatedActions = await fetchActions(selectedOrganizerId);
                                          setAvailableActions(updatedActions);
                                        } catch (error) {
                                          console.error('Error updating action status:', error);
                                        }
                                      }}
                                      sx={{ p: 0.5 }}
                                    >
                                      {actionStatusFilter === 'live' ? 
                                        <ArchiveIcon sx={{ fontSize: 16 }} /> : 
                                        <UnarchiveIcon sx={{ fontSize: 16 }} />
                                      }
                                    </IconButton>
                                  </Tooltip>
                                </>
                              </Box>
                            </CardContent>
                          </Card>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>
      </Box>
      
      {/* Dialogs below this point */}
      
      {/* Add to Turf Dialog */}
      <Dialog 
        open={showAddTurfDialog} 
        onClose={() => {
          setShowAddTurfDialog(false);
          setTurfSearchText('');
          setSelectedPeopleForAdd([]);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Add People to Your Turf</span>
            {selectedPeopleForAdd.length > 0 && (
              <Chip 
                label={`${selectedPeopleForAdd.length} selected`}
                color="primary"
                size="small"
              />
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {/* Action Selector */}
          <FormControl fullWidth sx={{ mb: 3, mt: 1 }}>
            <InputLabel>Action</InputLabel>
            <Select
              value={selectedActionForAdd}
              onChange={(e) => setSelectedActionForAdd(e.target.value)}
              label="Action"
            >
              {availableActions.map(action => (
                <MenuItem key={action.action_id} value={action.action_id}>
                  {action.action_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Select people to add:
            </Typography>
            {filteredTurfPeople.length > 0 && (
              <Button
                size="small"
                onClick={() => {
                  if (selectedPeopleForAdd.length === filteredTurfPeople.length) {
                    setSelectedPeopleForAdd([]);
                  } else {
                    setSelectedPeopleForAdd(filteredTurfPeople.map(p => p.id));
                  }
                }}
              >
                {selectedPeopleForAdd.length === filteredTurfPeople.length ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </Box>
          
          <TextField
            fullWidth
            size="small"
            placeholder="Search by name or chapter..."
            value={turfSearchText}
            onChange={(e) => setTurfSearchText(e.target.value)}
            sx={{ mb: 2 }}
          />
          
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredTurfPeople.length > 0 ? (
              filteredTurfPeople.map((person) => (
                <ListItem
                  key={person.id}
                  sx={{
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    mb: 1,
                    cursor: 'pointer',
                    bgcolor: selectedPeopleForAdd.includes(person.id) ? '#e3f2fd' : 'inherit',
                    '&:hover': { bgcolor: selectedPeopleForAdd.includes(person.id) ? '#e3f2fd' : '#f5f5f5' }
                  }}
                  onClick={() => {
                    setSelectedPeopleForAdd(prev => 
                      prev.includes(person.id)
                        ? prev.filter(id => id !== person.id)
                        : [...prev, person.id]
                    );
                  }}
                >
                  <Checkbox
                    checked={selectedPeopleForAdd.includes(person.id)}
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  <ListItemText
                    primary={
                      <PersonChip
                        name={person.name}
                        vanId={person.id}
                        allMappings={organizerMappings}
                        showMenu={false}
                        size="small"
                        variant="outlined"
                      />
                    }
                    secondary={person.chapter}
                  />
                </ListItem>
              ))
            ) : (
              <Box sx={{ py: 3, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {turfSearchText ? 'No matching people found.' : 'No available people for this action.'}
                </Typography>
                {turfSearchText && (
                  <Button
                    variant="outlined"
                    startIcon={<PersonIcon />}
                    onClick={() => {
                      setShowAddTurfDialog(false);
                      setShowAddPersonDialog(true);
                    }}
                  >
                    Add New Person
                  </Button>
                )}
              </Box>
            )}
          </List>
          
          {/* Add New Person button at bottom */}
          {filteredTurfPeople.length > 0 && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0', textAlign: 'center' }}>
              <Button
                variant="text"
                startIcon={<PersonIcon />}
                onClick={() => {
                  setShowAddTurfDialog(false);
                  setShowAddPersonDialog(true);
                }}
                size="small"
              >
                Add New Person Not Listed
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setShowAddTurfDialog(false);
              setTurfSearchText('');
              setSelectedPeopleForAdd([]);
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleAddSelectedToTurf}
            variant="contained"
            disabled={selectedPeopleForAdd.length === 0}
          >
            Add {selectedPeopleForAdd.length > 0 ? `${selectedPeopleForAdd.length} ` : ''}
            {selectedPeopleForAdd.length === 1 ? 'Person' : 'People'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Leader to My Leadership Action List Dialog */}
      <Dialog 
        open={showAddLeaderToMyListDialog} 
        onClose={() => setShowAddLeaderToMyListDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Add {selectedLeaderToAdd?.name} to My List</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 1 }}>
            Select which leadership action list to add {selectedLeaderToAdd?.name} to:
          </Typography>
          
          {/* Action Selector */}
          <FormControl fullWidth>
            <InputLabel>Leadership Action</InputLabel>
            <Select
              value={selectedMyLeadershipAction}
              onChange={(e) => setSelectedMyLeadershipAction(e.target.value)}
              label="Leadership Action"
            >
              {availableActions
                .filter((a: any) => a.status === 'live' && (a.target_audience === 'leadership' || !a.target_audience))
                .map(action => (
                  <MenuItem key={action.action_id} value={action.action_id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {action.action_name}
                      {action.target_audience === 'leadership' && (
                        <Chip label="Leaders" size="small" color="secondary" sx={{ height: 18, fontSize: '0.65rem' }} />
                      )}
                    </Box>
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddLeaderToMyListDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleAddLeaderToMyList} 
            variant="contained"
            disabled={!selectedMyLeadershipAction}
          >
            Add to List
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Leader Dialog */}
      <Dialog 
        open={showAddLeaderDialog} 
        onClose={() => {
          setShowAddLeaderDialog(false);
          setLeaderSearchText('');
          setSelectedParentLeader(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Leader</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: 1 }}>
            Select people you're developing as leaders. <strong>Team members</strong> and people in your chapter appear first:
          </Typography>
          
          {/* Reports To Dropdown */}
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Reports To</InputLabel>
            <Select
              value={selectedParentLeader || ''}
              onChange={(e) => setSelectedParentLeader(e.target.value || null)}
              label="Reports To"
            >
              <MenuItem value="">Direct report to me</MenuItem>
              {myLeaders.map(leader => (
                <MenuItem key={leader.id} value={leader.id}>
                  {leader.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <TextField
            fullWidth
            size="small"
            placeholder="Search by name or chapter..."
            value={leaderSearchText}
            onChange={(e) => setLeaderSearchText(e.target.value)}
            sx={{ mb: 2 }}
          />
          
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredLeaderPeople.length > 0 ? (
              filteredLeaderPeople.map((person) => (
                <ListItem
                  key={person.id}
                  sx={{
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    mb: 1,
                    cursor: 'pointer',
                    bgcolor: person.isPledgeOnly ? '#fff8e1' : 'inherit',
                    '&:hover': { bgcolor: person.isPledgeOnly ? '#fff59d' : '#f5f5f5' }
                  }}
                  onClick={() => handleAddLeader(person)}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PersonChip
                          name={person.name}
                          vanId={person.id}
                          allMappings={organizerMappings}
                          showMenu={false}
                          size="small"
                          variant="outlined"
                        />
                        {person.isPledgeOnly && (
                          <Chip 
                            label="Pledge Only" 
                            size="small" 
                            color="warning" 
                            sx={{ height: 18, fontSize: '0.6rem' }} 
                          />
                        )}
                      </Box>
                    }
                    secondary={person.chapter}
                  />
                  <IconButton size="small" color="primary">
                    <AddIcon />
                  </IconButton>
                </ListItem>
              ))
            ) : (
              <Box sx={{ py: 3, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {leaderSearchText ? 'No matching people found.' : 'No available people. Everyone is already in your leaders list!'}
                </Typography>
                {leaderSearchText && (
                  <Button
                    variant="outlined"
                    startIcon={<PersonIcon />}
                    onClick={() => {
                      setShowAddLeaderDialog(false);
                      setShowAddPersonDialog(true);
                    }}
                  >
                    Add New Person
                  </Button>
                )}
              </Box>
            )}
          </List>
          
          {/* Add New Person button at bottom */}
          {filteredLeaderPeople.length > 0 && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0', textAlign: 'center' }}>
              <Button
                variant="text"
                startIcon={<PersonIcon />}
                onClick={() => {
                  setShowAddLeaderDialog(false);
                  setShowAddPersonDialog(true);
                }}
                size="small"
              >
                Add New Person Not Listed
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowAddLeaderDialog(false);
            setLeaderSearchText('');
          }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add Team Dialog */}
      <AddTeamDialog
        open={showAddTeamDialog}
        onClose={() => setShowAddTeamDialog(false)}
        onSave={handleAddTeam}
        organizers={organizers}
        allPeople={allPeople}
        chapters={chapters}
        onSearchPeople={async (query: string) => {
          // Use sharedAllContacts (same data source as People Panel)
          console.log('[Dashboard.onSearchPeople] Called with query:', query);
          console.log('[Dashboard.onSearchPeople] sharedAllContacts:', sharedAllContacts);
          console.log('[Dashboard.onSearchPeople] sharedAllContacts length:', sharedAllContacts?.length);
          
          if (!sharedAllContacts || sharedAllContacts.length === 0) {
            console.warn('[Dashboard.onSearchPeople] No contacts available');
            return [];
          }
          
          // Sample first contact to see structure
          if (sharedAllContacts.length > 0) {
            console.log('[Dashboard.onSearchPeople] Sample contact:', sharedAllContacts[0]);
          }
          
          // Filter contacts by search query
          const queryLower = query.toLowerCase().trim();
          let filtered = sharedAllContacts;
          
          if (queryLower) {
            filtered = sharedAllContacts.filter((contact: any) => {
              const name = `${contact.firstname || ''} ${contact.lastname || ''}`.toLowerCase();
              const email = (contact.email || '').toLowerCase();
              return name.includes(queryLower) || email.includes(queryLower);
            });
          }
          
          // Map to expected format
          const results = filtered.slice(0, 100).map((contact: any) => ({
            id: contact.vanid?.toString() || contact.id,
            name: `${contact.firstname || ''} ${contact.lastname || ''}`.trim(),
            type: contact.type || 'contact',
            chapter: contact.chapter,
            email: contact.email,
            phone: contact.phone
          }));
          
          console.log('[Dashboard.onSearchPeople] Filtered contacts:', filtered.length);
          console.log('[Dashboard.onSearchPeople] Mapped results:', results);
          console.log('[Dashboard.onSearchPeople] Returning', results.length, 'people');
          return results;
        }}
      />

      {/* Edit Team Dialog */}
      <EditTeamDialog
        open={showEditTeamDialog}
        onClose={() => {
          setShowEditTeamDialog(false);
          setTeamToEdit(null);
        }}
        onSave={handleSaveEditedTeam}
        organizers={organizers}
        allPeople={allPeople}
        chapters={chapters}
        teamToEdit={teamToEdit}
        onSearchPeople={async (query: string) => {
          // Use sharedAllContacts (same data source as People Panel)
          console.log('[Dashboard.onSearchPeople] Called with query:', query);
          console.log('[Dashboard.onSearchPeople] sharedAllContacts:', sharedAllContacts);
          console.log('[Dashboard.onSearchPeople] sharedAllContacts length:', sharedAllContacts?.length);
          
          if (!sharedAllContacts || sharedAllContacts.length === 0) {
            console.warn('[Dashboard.onSearchPeople] No contacts available');
            return [];
          }
          
          // Sample first contact to see structure
          if (sharedAllContacts.length > 0) {
            console.log('[Dashboard.onSearchPeople] Sample contact:', sharedAllContacts[0]);
          }
          
          // Filter contacts by search query
          const queryLower = query.toLowerCase().trim();
          let filtered = sharedAllContacts;
          
          if (queryLower) {
            filtered = sharedAllContacts.filter((contact: any) => {
              const name = `${contact.firstname || ''} ${contact.lastname || ''}`.toLowerCase();
              const email = (contact.email || '').toLowerCase();
              return name.includes(queryLower) || email.includes(queryLower);
            });
          }
          
          // Map to expected format
          const results = filtered.slice(0, 100).map((contact: any) => ({
            id: contact.vanid?.toString() || contact.id,
            name: `${contact.firstname || ''} ${contact.lastname || ''}`.trim(),
            type: contact.type || 'contact',
            chapter: contact.chapter,
            email: contact.email,
            phone: contact.phone
          }));
          
          console.log('[Dashboard.onSearchPeople] Filtered contacts:', filtered.length);
          console.log('[Dashboard.onSearchPeople] Mapped results:', results);
          console.log('[Dashboard.onSearchPeople] Returning', results.length, 'people');
          return results;
        }}
      />

      {/* Add Action Dialog */}
      <CampaignActionDialog
        open={showAddActionDialog}
        onClose={() => {
          setShowAddActionDialog(false);
          setEditingAction(null);
        }}
        editingAction={editingAction}
        onSave={async (action) => {
          try {
            if (editingAction) {
              // Update existing action
              await updateAction(editingAction.id, {
                action_name: action.name,
                fields: action.fields,
                goal_field_key: action.goalFieldKey,
                parent_campaign_id: action.parentCampaignId,
                goal_type_id: action.goalTypeId,
                chapters: action.chapters,
                organizer_vanid: action.creatorOrganizerVanid,
                visible_to_organizers: action.visibleToOrganizers,
                has_goal: action.hasGoal,
                target_audience: action.targetAudience,
                is_template: action.isTemplate,
                template_action_id: action.templateActionId,
                default_individual_goal: action.defaultIndividualGoal,
                // Rate-based and deadline fields
                action_type: action.actionType,
                recurrence_period: action.recurrencePeriod,
                recurrence_count: action.recurrenceCount,
                deadline_date: action.deadlineDate,
                deadline_type: action.deadlineType,
                time_tracking_enabled: action.timeTrackingEnabled
              });
              
              alert(`Action "${action.name}" updated successfully!`);
              setShowAddActionDialog(false);
              setEditingAction(null);
              setReloadTrigger(prev => prev + 1);
            } else {
              // Create new action
              const result = await createAction({
                action_name: action.name,
                fields: action.fields,
                goal_field_key: action.goalFieldKey,
                parent_campaign_id: action.parentCampaignId,
                goal_type_id: action.goalTypeId,
                chapters: action.chapters,
                organizer_vanid: action.creatorOrganizerVanid,
                visible_to_organizers: action.visibleToOrganizers,
                has_goal: action.hasGoal,
                target_audience: action.targetAudience,
                is_template: action.isTemplate,
                template_action_id: action.templateActionId,
                default_individual_goal: action.defaultIndividualGoal,
                // Rate-based and deadline fields
                action_type: action.actionType,
                recurrence_period: action.recurrencePeriod,
                recurrence_count: action.recurrenceCount,
                deadline_date: action.deadlineDate,
                deadline_type: action.deadlineType,
                time_tracking_enabled: action.timeTrackingEnabled
              });
              
              alert(`Action "${action.name}" created successfully!`);
              setShowAddActionDialog(false);
              
              // Refresh actions list
              setReloadTrigger(prev => prev + 1);
            }
          } catch (error) {
            console.error('Error saving action:', error);
            alert('Failed to save action. Please try again.');
          }
        }}
        chapters={chapters}
        selectedChapter={selectedChapter || 'All Chapters'}
        existingCampaigns={[]}
        parentCampaigns={parentCampaigns}
        currentUserId={selectedOrganizerId}
        currentUserName={selectedOrganizerInfo?.fullName || selectedOrganizerInfo?.firstname}
        availableOrganizers={dashboardOrganizers}
      />

      {/* Quick Add to List Dialog */}
      <Dialog 
        open={showQuickAddDialog} 
        onClose={() => {
          setShowQuickAddDialog(false);
          setPersonToQuickAdd(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Add to Action List</DialogTitle>
        <DialogContent>
          {personToQuickAdd && (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Add <strong>{personToQuickAdd.name}</strong> to which action list?
              </Typography>
              <FormControl fullWidth sx={{ mt: 1 }}>
                <InputLabel>Action</InputLabel>
                <Select
                  value={quickAddActionId}
                  onChange={(e) => setQuickAddActionId(e.target.value)}
                  label="Action"
                >
                  {ACTIONS
                    .filter(action => {
                      const actionDef = availableActions.find((a: any) => a.action_id === action.id);
                      // Show action if target_audience matches or is null
                      return actionDef?.target_audience === listAudienceFilter || !actionDef?.target_audience;
                    })
                    .map(action => (
                      <MenuItem key={action.id} value={action.id}>
                        {action.name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowQuickAddDialog(false);
            setPersonToQuickAdd(null);
          }}>
            Cancel
          </Button>
          <Button onClick={handleQuickAddConfirm} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Set Goal Dialog */}
      <Dialog open={showSetGoalDialog} onClose={() => setShowSetGoalDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Set Goal</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              label="Goal Value"
              type="number"
              value={goalValue}
              onChange={(e) => setGoalValue(parseInt(e.target.value) || 0)}
              fullWidth
              helperText="How many people do you want to reach?"
              inputProps={{ min: 0 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSetGoalDialog(false)}>Cancel</Button>
          <Button 
            onClick={async () => {
              if (!selectedOrganizerId || !goalActionId) return;
              
              const success = await saveOrganizerGoal({
                organizer_vanid: selectedOrganizerId,
                action_id: goalActionId,
                goal_value: goalValue
              });
              
              if (success) {
                // Update local state
                setOrganizerGoals(prev => ({
                  ...prev,
                  [goalActionId]: goalValue
                }));
                setShowSetGoalDialog(false);
              } else {
                alert('Failed to save goal. Please try again.');
              }
            }}
            variant="contained"
            color="primary"
          >
            Save Goal
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Person Dialog */}
      <AddPersonDialog
        open={showAddPersonDialog}
        onClose={() => setShowAddPersonDialog(false)}
        onSave={handleAddPerson}
        availableChapters={chapters}
        availableOrganizers={dashboardOrganizers.map(org => ({ id: org.vanid, name: org.name }))}
        currentUserId={selectedOrganizerId || ''}
      />

      {/* Edit Person Dialog */}
      <EditPersonDialog
        open={showEditPersonDialog}
        onClose={() => {
          setShowEditPersonDialog(false);
          setSelectedPersonForEdit(null);
        }}
        onSave={handleEditPerson}
        person={selectedPersonForEdit}
        availableChapters={chapters}
        availableOrganizers={dashboardOrganizers.map(org => ({ id: org.vanid, name: org.name }))}
      />

      {/* Log Conversation Dialog */}
      <LogConversationDialog
        open={showLogConversationDialog}
        onClose={() => {
          setShowLogConversationDialog(false);
          setSelectedPersonForConversation(null);
          setSelectedActionForConversation(null);
          setEditingConversation(null);
        }}
        onSave={handleLogConversation}
        onUpdate={handleUpdateConversation}
        editingConversation={editingConversation}
        availableContacts={allPeople.map(p => ({
          vanid: p.id,
          name: p.name,
          chapter: p.chapter
        }))}
        currentUserVanId={selectedOrganizerId || ''}
        preselectedContact={selectedPersonForConversation ? {
          vanid: selectedPersonForConversation.id,
          name: selectedPersonForConversation.name,
          chapter: selectedPersonForConversation.chapter
        } : null}
        availableChapters={chapters}
        availableOrganizers={dashboardOrganizers.map(org => ({ id: org.vanid, name: org.name }))}
        onPersonAdd={onPersonAdd}
      />

      {/* Batch Add People Dialog */}
      <BatchAddPeopleDialog
        open={showBatchAddDialog}
        onClose={() => setShowBatchAddDialog(false)}
        onSaved={(_count) => {
          setShowBatchAddDialog(false);
          if (onPersonAdd) onPersonAdd();
        }}
        availableSections={chapters}
        availableOrganizers={dashboardOrganizers.map(org => ({ id: org.vanid, name: org.name }))}
        availableActions={ACTIONS}
        currentUserId={currentUserId || undefined}
      />
    </Box>
  );
};

// Nested leader component as table row

export default Dashboard;
