import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Button,
  List,
  ListItem,
  ListItemText,
  Avatar,
  ListItemAvatar,
  CircularProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  PersonAdd as PersonAddIcon,
  Flag as GoalIcon,
  Group as TeamGoalIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  RemoveCircle as DisbandIcon
} from '@mui/icons-material';
import AddTeamDialog from '../dialogs/AddTeamDialog';
import EditTeamDialog from '../dialogs/EditTeamDialog';
import { OrganizerChip } from '../ui/OrganizerChip';
import TeamGoalsDialog, { TeamGoal } from '../dialogs/TeamGoalsDialog';
import teamsService, { type EnhancedTeamData } from '../../services/teamsService';
import { fetchContacts } from '../../services/api';
import { getChapterColor, getChapterColorTheme } from '../../theme/chapterColors';
import { useChapterColors, getCustomChapterColor, getCustomChapterColorTheme } from '../../contexts/ChapterColorContext';

interface MeetingNote {
  organizer_vanid: number;
  vanid: number;
  participant_vanid?: number;
  organizer?: string;
  contact?: string;
  datestamp: { value: string } | string;
  chapter: string;
  meeting_type?: string;
  notes_purpose?: string;
  notes_commitments?: string;
  notes_stakes?: string;
  notes_development?: string;
  notes_evaluation?: string;
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
  allMeetings: MeetingNote[];
  turf?: string;
  team_role?: string;
  constituentRole?: string;
  functionalRole?: string;
}

interface TeamData {
  id?: string; // Team ID from database (for editing)
  chapter: string;
  organizers: PersonRecord[];
  lead: PersonRecord | null;
  turf?: string;
  isCustom?: boolean;
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

interface TeamsPanelProps {
  meetings: MeetingNote[];
  contacts?: any[];
  userMap: Map<number, UserInfo>;
  orgIds: any[];
  selectedChapter: string;
  organizerMappings?: any[];
  onFilterByOrganizer?: (name: string, vanId?: string) => void;
  onEditOrganizerMapping?: (name: string, vanId?: string) => void;
  nodes: NodeData[];
  peopleRecords: PersonRecord[];
  onTeamsDataChange?: (teams: TeamData[]) => void;
  existingTeamsData?: any[]; // Teams data already loaded by parent
  compact?: boolean; // Compact mode for floating overlay
  chapters?: string[]; // Available chapters/sections from API
}

const TeamsPanel: React.FC<TeamsPanelProps> = ({
  meetings,
  contacts = [],
  userMap = new Map(),
  orgIds = [],
  selectedChapter,
  organizerMappings = [],
  onFilterByOrganizer,
  onEditOrganizerMapping,
  nodes = [],
  peopleRecords,
  onTeamsDataChange,
  existingTeamsData = [],
  compact = false,
  chapters = []
}) => {
  const { customColors, updateChapterColor, resetChapterColor, loadColorsFromTeams } = useChapterColors();
  const [teamsSearchText, setTeamsSearchText] = useState('');
  const [addTeamDialogOpen, setAddTeamDialogOpen] = useState(false);
  const [editTeamDialogOpen, setEditTeamDialogOpen] = useState(false);
  const [teamToEdit, setTeamToEdit] = useState<EnhancedTeamData | null>(null);
  const [teamGoalsDialogOpen, setTeamGoalsDialogOpen] = useState(false);
  const [teamGoals, setTeamGoals] = useState<TeamGoal[]>([]);
  const [customTeams, setCustomTeams] = useState<TeamData[]>([]);
  const [bigQueryTeams, setBigQueryTeams] = useState<EnhancedTeamData[]>([]);
  const [loadingTeams, setLoadingTeams] = useState<boolean>(false);
  const [confirmDisbandOpen, setConfirmDisbandOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [teamToAction, setTeamToAction] = useState<EnhancedTeamData | null>(null);

  // Teams data - organize chapters with their organizers and leads
  const teamsData = useMemo(() => {
    const chapterTeams = new Map<string, TeamData>();

    // Initialize chapters
    const chapters = Array.from(new Set(nodes.map(node => node.chapter).filter(Boolean)));
    chapters.forEach(chapter => {
      chapterTeams.set(chapter, {
        chapter,
        organizers: [],
        lead: null
      });
    });

    // Get all people data first
    const peopleMap = new Map() as Map<string, PersonRecord>;
    
    // Add org chart people
    orgIds.forEach((person: any) => {
      if (person.vanid && person.chapter) {
        const personRecord: PersonRecord = {
          id: person.vanid.toString(),
          name: `${person.firstname || ''} ${person.lastname || ''}`.trim() || 'Unknown',
          type: person.type || 'contact',
          chapter: person.chapter,
          email: person.email,
          phone: person.phone,
          totalMeetings: 0,
          mostRecentContact: null,
          latestNotes: '',
          organizers: [],
          loeStatus: person.loe_status || 'Unknown',
          allMeetings: [],
          turf: person.turf,
          team_role: person.team_role
        };
        peopleMap.set(person.vanid.toString(), personRecord);
      }
    });

    // Organize people by chapter and identify leads
    peopleMap.forEach(person => {
      const team = chapterTeams.get(person.chapter);
      if (team) {
        // Add to organizers if they're staff or have organizer role
        if (person.type === 'staff' || person.type === 'organizer') {
          team.organizers.push(person);
          
          // Identify lead - could be based on title, type, or meetings
          if (!team.lead && (
            person.type === 'staff' || 
            person.name.toLowerCase().includes('director') ||
            person.name.toLowerCase().includes('lead') ||
            person.name.toLowerCase().includes('coordinator')
          )) {
            team.lead = person;
          }
        }
      }
    });

    // Sort organizers by name and ensure lead is first if available
    chapterTeams.forEach(team => {
      team.organizers.sort((a, b) => a.name.localeCompare(b.name));
      if (team.lead && team.organizers.includes(team.lead)) {
        team.organizers = [team.lead, ...team.organizers.filter(o => o.id !== team.lead!.id)];
      }
    });

    const autoGeneratedTeams = Array.from(chapterTeams.values()).filter(team => team.organizers.length > 0);
    
    // Convert BigQuery teams to TeamData format, excluding disbanded teams
    const convertedBigQueryTeams: TeamData[] = bigQueryTeams
      .filter(bqTeam => !bqTeam.bigQueryData?.dateDisbanded) // Exclude disbanded teams
      .map(bqTeam => ({
        id: bqTeam.id, // Include the team ID for editing
        chapter: bqTeam.chapter,
        organizers: bqTeam.organizers,
        lead: bqTeam.lead,
        turf: bqTeam.turf,
        isCustom: false // These come from BigQuery, not custom
      }));
    
    // Combine all teams: auto-generated, custom, and BigQuery (excluding disbanded)
    return [...autoGeneratedTeams, ...customTeams, ...convertedBigQueryTeams];
  }, [nodes, orgIds, userMap, customTeams, bigQueryTeams]);

  // Filtered teams data for search with root teams prioritized
  const filteredTeamsData = useMemo(() => {
    let teams = teamsData;
    
    console.log('[TeamsPanel] Filtering teams - selectedChapter:', selectedChapter, 'teamsData:', teams.length);
    
    // Filter by chapter
    if (selectedChapter && selectedChapter !== 'All Chapters' && selectedChapter !== 'All Sections') {
      console.log('[TeamsPanel] Applying chapter filter:', selectedChapter);
      teams = teams.filter(team => team.chapter === selectedChapter);
      console.log('[TeamsPanel] After chapter filter:', teams.length);
    }
    
    if (teamsSearchText) {
      const searchLower = teamsSearchText.toLowerCase();
      teams = teams.filter(team => 
        team.chapter.toLowerCase().includes(searchLower) ||
        team.organizers.some(organizer => 
          organizer.name.toLowerCase().includes(searchLower) ||
          (organizer.email && organizer.email.toLowerCase().includes(searchLower)) ||
          (organizer.phone && organizer.phone.toLowerCase().includes(searchLower))
        )
      );
    }
    
    // Sort teams to prioritize root teams (like 'Lead Organizers') at the top
    const sortedTeams = teams.sort((a, b) => {
      // Check if team is a root team based on chapter name or team name
      const aIsRoot = a.chapter.toLowerCase().includes('lead') || 
                     a.chapter.toLowerCase().includes('organizer') ||
                     (bigQueryTeams.find(bq => bq.chapter === a.chapter)?.teamName?.toLowerCase().includes('lead'));
      const bIsRoot = b.chapter.toLowerCase().includes('lead') || 
                     b.chapter.toLowerCase().includes('organizer') ||
                     (bigQueryTeams.find(bq => bq.chapter === b.chapter)?.teamName?.toLowerCase().includes('lead'));
      
      if (aIsRoot && !bIsRoot) return -1;
      if (!aIsRoot && bIsRoot) return 1;
      return a.chapter.localeCompare(b.chapter);
    });
    
    console.log('[TeamsPanel] Final filteredTeamsData:', sortedTeams.length, 'teams');
    if (sortedTeams.length > 0) {
      console.log('[TeamsPanel] Sample team:', sortedTeams[0]);
    }
    
    return sortedTeams;
  }, [teamsData, teamsSearchText, bigQueryTeams, selectedChapter]);

  // Notify parent component when teams data changes
  const lastTeamsDataRef = React.useRef<string>('');
  React.useEffect(() => {
    if (onTeamsDataChange && filteredTeamsData) {
      // Only update if TeamsPanel has better data than parent
      // This prevents overwriting auto-loaded BigQuery teams with empty/sparse data
      const hasBetterData = bigQueryTeams.length > 0 || 
        filteredTeamsData.length > existingTeamsData.length;
      
      if (!hasBetterData && existingTeamsData.length > 0) {
        // Parent already has good data, don't overwrite
        return;
      }
      
      // Only update if the data actually changed (prevent infinite loops)
      const currentDataString = JSON.stringify(filteredTeamsData.map(t => ({ 
        chapter: t.chapter, 
        organizers: t.organizers?.length || 0,
        teamName: (t as any).teamName 
      })));
      
      if (currentDataString !== lastTeamsDataRef.current) {
        lastTeamsDataRef.current = currentDataString;
        onTeamsDataChange(filteredTeamsData);
      }
    }
  }, [filteredTeamsData, onTeamsDataChange, bigQueryTeams.length, existingTeamsData.length]);

  // Compute peopleRecords from meetings for BigQuery integration
  const computedPeopleRecords = useMemo(() => {
    const peopleMap = new Map<string, PersonRecord>();

    meetings.forEach((meeting) => {
      // Skip meetings with missing essential data
      if (!meeting.vanid || !meeting.organizer_vanid) {
        return;
      }
      
      const organizeeId = meeting.vanid.toString();
      
      // Process organizee
      if (!peopleMap.has(organizeeId)) {
        const userInfo = userMap.get(meeting.vanid) || {};
        const orgInfo = orgIds.find(p => p.vanid && p.vanid.toString() === organizeeId);
        
        // Use API's pre-built contact name first, then fallback
        let name = '';
        if (meeting.contact && meeting.contact.trim() && meeting.contact !== 'null null') {
          name = meeting.contact.trim();
        } else if (userInfo.name && userInfo.name.trim() && userInfo.name !== 'null null') {
          name = userInfo.name.trim();
        } else if ((userInfo.firstname && userInfo.firstname !== 'null') || (userInfo.lastname && userInfo.lastname !== 'null')) {
          const firstName = userInfo.firstname && userInfo.firstname !== 'null' ? userInfo.firstname.trim() : '';
          const lastName = userInfo.lastname && userInfo.lastname !== 'null' ? userInfo.lastname.trim() : '';
          name = `${firstName} ${lastName}`.trim();
        } else if (orgInfo) {
          if ((orgInfo.firstname && orgInfo.firstname !== 'null') || (orgInfo.lastname && orgInfo.lastname !== 'null')) {
            const firstName = orgInfo.firstname && orgInfo.firstname !== 'null' ? orgInfo.firstname.trim() : '';
            const lastName = orgInfo.lastname && orgInfo.lastname !== 'null' ? orgInfo.lastname.trim() : '';
            name = `${firstName} ${lastName}`.trim();
          }
        }
        
        if (!name || name === 'null null' || name.trim() === '') {
          name = `Contact ${organizeeId}`;
        }

        const personRecord: PersonRecord = {
          id: organizeeId,
          name: name,
          type: userInfo.type || orgInfo?.type || 'contact',
          chapter: meeting.chapter || userInfo.chapter || orgInfo?.chapter || 'Unknown',
          email: userInfo.email || orgInfo?.email,
          phone: userInfo.phone || orgInfo?.phone,
          mostRecentContact: null,
          totalMeetings: 0,
          latestNotes: '',
          organizers: [],
          loeStatus: orgInfo?.loe_status || 'Unknown',
          allMeetings: []
        };
        peopleMap.set(organizeeId, personRecord);
      }

      const person = peopleMap.get(organizeeId)!;
      person.totalMeetings += 1;
      person.allMeetings.push(meeting);

      // Update most recent contact
      const meetingDate = typeof meeting.datestamp === 'string' 
        ? new Date(meeting.datestamp) 
        : new Date(meeting.datestamp.value);
      
      if (!person.mostRecentContact || meetingDate > person.mostRecentContact) {
        person.mostRecentContact = meetingDate;
      }
    });

    return Array.from(peopleMap.values());
  }, [meetings, userMap, orgIds]);

  // Use existing teams data from parent (load once strategy)
  const teamsLoadedFromParentRef = React.useRef(false);
  
  useEffect(() => {
    // If parent provided teams data, use it (only once)
    if (existingTeamsData && existingTeamsData.length > 0 && !teamsLoadedFromParentRef.current) {
      console.log('[TeamsPanel] Using existing teams data from parent:', existingTeamsData.length, 'teams');
      teamsLoadedFromParentRef.current = true;
      
      setBigQueryTeams(existingTeamsData);
      
      // Load colors from teams data
      const teamsWithColors = existingTeamsData.map((team: any) => ({
        chapter: team.chapter,
        color: team.bigQueryData?.color
      })).filter((team: any) => team.color);
      
      if (teamsWithColors.length > 0) {
        loadColorsFromTeams(teamsWithColors);
      }
      
      return; // Don't load teams ourselves
    }
    
    // Fallback: Load teams independently if parent didn't provide them
    const loadBigQueryTeams = async () => {
      if (loadingTeams) return;
      
      setLoadingTeams(true);
      try {
        const enhancedTeams = await teamsService.loadEnhancedTeams(
          computedPeopleRecords,
          contacts,
          orgIds
        );
        setBigQueryTeams(enhancedTeams);
        
        // Load colors from teams data
        if (enhancedTeams.length > 0) {
          const teamsWithColors = enhancedTeams.map(team => ({
            chapter: team.chapter,
            color: team.bigQueryData?.color
          })).filter(team => team.color);
          
          if (teamsWithColors.length > 0) {
            loadColorsFromTeams(teamsWithColors);
          }
        }
      } catch (error) {
        console.error('❌ Error loading BigQuery teams:', error);
      } finally {
        setLoadingTeams(false);
      }
    };

    const shouldLoadTeams = computedPeopleRecords.length > 0 && 
                           !loadingTeams && 
                           bigQueryTeams.length === 0 &&
                           (!existingTeamsData || existingTeamsData.length === 0);

    if (shouldLoadTeams) {
      const timeoutId = setTimeout(() => {
        loadBigQueryTeams();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [existingTeamsData.length, computedPeopleRecords.length, contacts.length, orgIds.length, loadingTeams, bigQueryTeams.length]);

  // Prepare data for AddTeamDialog - any org chart person can be team lead (not just staff)
  const availableOrganizers = useMemo(() => {
    const organizerSet = new Map<string, PersonRecord>();
    
    // Add everyone from org chart so any organizer can be selected as team lead
    orgIds.forEach((person: any) => {
      if (person.vanid) {
        const name = `${person.firstname || ''} ${person.lastname || ''}`.trim();
        if (name && name !== 'Unknown') {
          organizerSet.set(person.vanid.toString(), {
            id: person.vanid.toString(),
            name: name,
            type: person.type,
            chapter: person.chapter || 'Unknown',
            email: person.email,
            phone: person.phone,
            mostRecentContact: null,
            totalMeetings: 0,
            latestNotes: '',
            organizers: [],
            loeStatus: person.loe_status || 'Unknown',
            allMeetings: [],
            turf: person.turf,
            team_role: person.team_role
          });
        }
      }
    });
    
    // Add people from meeting data who appear to be organizers
    const organizerIds = new Set<number>();
    meetings.forEach(meeting => {
      if (meeting.organizer_vanid) {
        organizerIds.add(meeting.organizer_vanid);
      }
    });
    
    organizerIds.forEach(organizerId => {
      const organizerIdStr = organizerId.toString();
      if (!organizerSet.has(organizerIdStr)) {
        const userInfo = userMap.get(organizerId);
        if (userInfo) {
          const name = userInfo.name || `${userInfo.firstname || ''} ${userInfo.lastname || ''}`.trim();
          if (name && name !== 'Unknown') {
            organizerSet.set(organizerIdStr, {
              id: organizerIdStr,
              name: name,
              type: userInfo.type || 'organizer',
              chapter: userInfo.chapter || 'Unknown',
              email: userInfo.email,
              phone: userInfo.phone,
              mostRecentContact: null,
              totalMeetings: 0,
              latestNotes: '',
              organizers: [],
              loeStatus: userInfo.loe_status || 'Unknown',
              allMeetings: []
            });
          }
        }
      }
    });
    
    // Fallback - if we still have no organizers, include some people from the people records
    if (organizerSet.size === 0) {
      peopleRecords.slice(0, 10).forEach(person => {
        organizerSet.set(person.id, person);
      });
    }
    
    return Array.from(organizerSet.values());
  }, [orgIds, meetings, userMap, peopleRecords]);

  // Everyone from the database: org chart + meeting people + contacts API (for Team Lead & Team Members)
  const allAvailablePeople = useMemo(() => {
    const allPeopleMap = new Map<string, PersonRecord>();
    
    // Add from org chart
    orgIds.forEach((person: any) => {
      if (person.vanid) {
        allPeopleMap.set(person.vanid.toString(), {
          id: person.vanid.toString(),
          name: `${person.firstname || ''} ${person.lastname || ''}`.trim() || 'Unknown',
          type: person.type || 'contact',
          chapter: person.chapter || 'Unknown',
          email: person.email,
          phone: person.phone,
          mostRecentContact: null,
          totalMeetings: 0,
          latestNotes: '',
          organizers: [],
          loeStatus: person.loe_status || 'Unknown',
          allMeetings: [],
          turf: person.turf,
          team_role: person.team_role
        });
      }
    });
    
    // Add from people records (organizees from meetings)
    peopleRecords.forEach(person => {
      if (!allPeopleMap.has(person.id)) {
        allPeopleMap.set(person.id, person);
      }
    });
    
    // Add from computed people (meetings) in case peopleRecords prop was empty
    computedPeopleRecords.forEach(person => {
      if (!allPeopleMap.has(person.id)) {
        allPeopleMap.set(person.id, person);
      }
    });
    
    // Add from contacts API (database) so Team Lead and Team Members can be anybody in the DB
    (contacts || []).forEach((contact: any) => {
      const id = (contact.vanid || contact.id || '').toString();
      if (!id) return;
      const name = `${contact.firstname || contact.first_name || ''} ${contact.lastname || contact.last_name || ''}`.trim();
      if (!name || name === 'Unknown') return;
      if (!allPeopleMap.has(id)) {
        allPeopleMap.set(id, {
          id,
          name,
          type: contact.type || 'contact',
          chapter: contact.chapter || 'Unknown',
          email: contact.email,
          phone: contact.phone,
          mostRecentContact: null,
          totalMeetings: 0,
          latestNotes: '',
          organizers: [],
          loeStatus: contact.loe || contact.loe_status || 'Unknown',
          allMeetings: []
        });
      }
    });
    
    return Array.from(allPeopleMap.values());
  }, [orgIds, peopleRecords, computedPeopleRecords, contacts]);

  const availableChapters = useMemo(() => {
    // Use chapters from API if provided (preferred), otherwise compute from existing data
    if (chapters && chapters.length > 0) {
      console.log('[TeamsPanel] Using chapters prop from API:', chapters);
      // Filter out "All Sections" / "All Chapters" from the passed chapters
      const filtered = chapters.filter(ch => !ch.startsWith('All '));
      console.log('[TeamsPanel] Filtered availableChapters:', filtered);
      return filtered;
    }
    
    console.log('[TeamsPanel] Computing chapters from existing data (fallback)');
    // Fallback: Get chapters from multiple sources to ensure we have options
    const chaptersFromNodes = nodes.map(node => node.chapter).filter(Boolean);
    const chaptersFromOrgIds = orgIds.map((person: any) => person.chapter).filter(Boolean);
    const chaptersFromMeetings = meetings.map(meeting => meeting.chapter).filter(Boolean);
    
    const allChapters = [
      ...chaptersFromNodes,
      ...chaptersFromOrgIds, 
      ...chaptersFromMeetings
    ];
    
    const uniqueChapters = Array.from(new Set(allChapters));
    console.log('[TeamsPanel] Computed chapters from data:', uniqueChapters);
    
    return uniqueChapters;
  }, [chapters, nodes, orgIds, meetings]);

  // Search Contacts table (same source as People table), sorted by most recent contact
  const onSearchPeople = useCallback(async (query: string): Promise<PersonRecord[]> => {
    const trimmed = query.trim();
    const res = await fetchContacts({
      search: trimmed || undefined, // undefined fetches all contacts
      limit: 150,
      sortBy: 'mostRecentContact',
      sortOrder: 'DESC',
      chapter: selectedChapter === 'All Chapters' ? undefined : selectedChapter
    });
    return (res.data || []).map((c: any) => ({
      id: c.vanid?.toString() || '',
      name: `${c.firstname || ''} ${c.lastname || ''}`.trim() || 'Unknown',
      type: 'contact',
      chapter: c.chapter || 'Unknown',
      email: c.email,
      phone: undefined,
      mostRecentContact: null,
      totalMeetings: 0,
      latestNotes: '',
      organizers: [],
      loeStatus: c.loe || 'Unknown',
      allMeetings: []
    }));
  }, [selectedChapter]);

  const handleTeamsSearchChange = (value: string) => {
    setTeamsSearchText(value);
  };

  const handleAddTeam = async (newTeam: any) => {
    // Use the new teamsService to create team via API
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

    // Update chapter color immediately if provided
    if (newTeam.color && newTeam.chapter) {
      updateChapterColor(newTeam.chapter, newTeam.color);
    }
    
    setAddTeamDialogOpen(false);
    
    // Refresh BigQuery teams to show the new team
    await refreshTeams();
  };

  const handleEditTeam = (team: EnhancedTeamData) => {
    setTeamToEdit(team);
    setEditTeamDialogOpen(true);
  };

  const handleSaveEditedTeam = async (updatedTeam: any) => {
    try {
      if (!teamToEdit) return;

      // Use the new teamsService to update team via API
      const result = await teamsService.updateTeam(teamToEdit.id, {
        teamName: updatedTeam.teamName,
        teamLead: updatedTeam.teamLead,
        chapter: updatedTeam.chapter,
        teamMembers: updatedTeam.teamMembers,
        turf: updatedTeam.turf,
        color: updatedTeam.color,
        sharedPurpose: updatedTeam.sharedPurpose,
        norms: updatedTeam.norms,
        normCorrection: updatedTeam.normCorrection,
        constituency: updatedTeam.constituency,
        organizerDetails: updatedTeam.organizerDetails, // Pass organizer roles and turfs
        changeReason: updatedTeam.changeReason,
        updatedBy: {
          // TODO: Pass current user from parent component
          vanid: undefined,
          name: 'System'
        },
        version: updatedTeam.version,
        dateCreated: updatedTeam.dateCreated
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update team');
      }

      // Update chapter color if it changed - this will update ALL teams in this chapter
      if (updatedTeam.color && updatedTeam.chapter) {
        await updateChapterColor(updatedTeam.chapter, updatedTeam.color);
      }
      
      setEditTeamDialogOpen(false);
      setTeamToEdit(null);
      
      // Refresh BigQuery teams to show the updated team
      await refreshTeams();
      
    } catch (error) {
      console.error('❌ Error updating team:', error);
      throw error; // Re-throw so the dialog can show the error
    }
  };

  const handleDisbandTeam = (team: EnhancedTeamData) => {
    setTeamToAction(team);
    setConfirmDisbandOpen(true);
  };

  const handleDeleteTeam = (team: EnhancedTeamData) => {
    setTeamToAction(team);
    setConfirmDeleteOpen(true);
  };

  const confirmDisbandTeam = async () => {
    if (!teamToAction) return;
    
    try {
      const result = await teamsService.disbandTeam(teamToAction.id);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to disband team');
      }
      
      
      setConfirmDisbandOpen(false);
      setTeamToAction(null);
      
      // Refresh teams to update the list
      await refreshTeams();
      
    } catch (error) {
      console.error('❌ Error disbanding team:', error);
      alert(`Error disbanding team: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const confirmDeleteTeam = async () => {
    if (!teamToAction) return;
    
    try {
      const result = await teamsService.deleteTeam(teamToAction.id);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete team');
      }
      
      
      setConfirmDeleteOpen(false);
      setTeamToAction(null);
      
      // Refresh teams to update the list
      await refreshTeams();
      
    } catch (error) {
      console.error('❌ Error deleting team:', error);
      alert(`Error deleting team: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const refreshTeams = async () => {
    try {
      const enhancedTeams = await teamsService.loadEnhancedTeams(
        peopleRecords,
        contacts,
        orgIds
      );
      setBigQueryTeams(enhancedTeams);
      
      // Load colors from teams data into ChapterColorContext
      if (enhancedTeams.length > 0) {
        const teamsWithColors = enhancedTeams.map(team => ({
          chapter: team.chapter,
          color: team.bigQueryData?.color
        })).filter(team => team.color); // Only include teams with colors
        
        if (teamsWithColors.length > 0) {
          loadColorsFromTeams(teamsWithColors);
        }
      }
    } catch (error) {
      console.error('❌ Error refreshing teams:', error);
    }
  };

  const handleAddTeamGoal = (newGoal: Omit<TeamGoal, 'id' | 'createdDate'>) => {
    const goalWithId: TeamGoal = {
      ...newGoal,
      id: `team_goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdDate: new Date().toISOString()
    };
    
    setTeamGoals(prev => [...prev, goalWithId]);
    setTeamGoalsDialogOpen(false);
  };

  return (
    <Box sx={{
      width: '100%',
      height: '100%',
      backgroundColor: '#f8f9fa',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Teams Content */}
      <Box sx={{
        flex: 1,
        overflowY: 'auto',
        backgroundColor: '#fff',
        p: 2
      }}>
        {loadingTeams && filteredTeamsData.length === 0 ? (
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px',
            color: '#666'
          }}>
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="body1">
              Loading teams...
            </Typography>
          </Box>
        ) : (
          // Always show the Add Team card, even when there are no teams
          teamsSearchText && filteredTeamsData.length === 0 ? (
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              color: '#666'
            }}>
              <Typography variant="body1">
                No teams match your search
              </Typography>
              <Button
                size="small"
                onClick={() => handleTeamsSearchChange('')}
                sx={{ mt: 1 }}
              >
                Clear search
              </Button>
            </Box>
          ) : (
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: 2,
            maxWidth: '100%'
          }}>
            {/* Add Team Card */}
            <Card 
              sx={{ 
                border: '2px dashed #ccc',
                boxShadow: 'none',
                minHeight: '200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'rgba(25, 118, 210, 0.04)'
                }
              }}
              onClick={() => setAddTeamDialogOpen(true)}
            >
              <CardContent sx={{ textAlign: 'center' }}>
                <IconButton
                  sx={{
                    backgroundColor: 'primary.light',
                    color: 'primary.main',
                    mb: 1,
                    '&:hover': {
                      backgroundColor: 'primary.main',
                      color: 'white'
                    }
                  }}
                >
                  <PersonAddIcon />
                </IconButton>
                <Typography variant="body2" color="text.secondary">
                  Add New Team
                </Typography>
              </CardContent>
            </Card>

            {filteredTeamsData.map((team, index) => {
              // Find the actual BigQuery team by ID for editing
              const bigQueryTeam = bigQueryTeams.find(bqTeam => bqTeam.id === team.id);
              
              return (
                <Card key={team.id || `${team.chapter}-${index}`} sx={{ 
                  border: `1px solid ${getCustomChapterColorTheme(team.chapter, customColors).light}`,
                  boxShadow: compact ? '0 2px 6px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.1)',
                  minHeight: compact ? 'auto' : '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: compact ? 'rgba(255, 255, 255, 0.8)' : 'white',
                  backdropFilter: compact ? 'blur(8px)' : 'none',
                  mb: compact ? 1 : 2,
                  '&:hover': {
                    boxShadow: compact ? '0 3px 8px rgba(0,0,0,0.2)' : `0 2px 8px ${getCustomChapterColorTheme(team.chapter, customColors).primary}22`
                  }
                }}>
                  <CardContent sx={{ p: compact ? 1.25 : 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Card Header — team name prominent, chapter subtle */}
                    <Box sx={{
                      mb: 1.5,
                      pb: 1.25,
                      borderBottom: `2px solid ${getCustomChapterColor(team.chapter, customColors)}22`,
                    }}>
                      {/* Row 1: team name + edit button */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography
                          variant={compact ? 'subtitle2' : 'h6'}
                          sx={{
                            fontWeight: 700,
                            lineHeight: 1.2,
                            color: 'text.primary',
                            flex: 1,
                            fontSize: compact ? '0.85rem' : '1rem',
                          }}
                        >
                          {bigQueryTeam?.teamName || team.chapter}
                        </Typography>
                        {bigQueryTeam && (
                          <IconButton
                            size="small"
                            onClick={() => handleEditTeam(bigQueryTeam)}
                            title="Edit Team"
                            sx={{
                              p: compact ? 0.25 : 0.5,
                              mt: -0.25,
                              color: 'text.disabled',
                              '&:hover': { color: getCustomChapterColor(team.chapter, customColors) }
                            }}
                          >
                            <EditIcon sx={{ fontSize: compact ? 13 : 16 }} />
                          </IconButton>
                        )}
                      </Box>

                      {/* Row 2: chapter dot + name (subtle), member count */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                        <Box sx={{
                          width: 8, height: 8, borderRadius: '50%',
                          backgroundColor: getCustomChapterColor(team.chapter, customColors),
                          flexShrink: 0,
                        }} />
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                          {team.chapter}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem', ml: 0.25 }}>
                          · {team.organizers.length} {team.organizers.length === 1 ? 'member' : 'members'}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Constituency + Shared Purpose — always shown when present */}
                    {(bigQueryTeam?.constituency || bigQueryTeam?.sharedPurpose) && (
                      <Box sx={{ mb: 1.25, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                        {bigQueryTeam?.constituency && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                            <Box component="span" sx={{ color: 'text.disabled', mr: 0.5 }}>Constituency:</Box>
                            {bigQueryTeam.constituency}
                          </Typography>
                        )}
                        {bigQueryTeam?.sharedPurpose && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', fontStyle: 'italic' }}>
                            <Box component="span" sx={{ color: 'text.disabled', fontStyle: 'normal', mr: 0.5 }}>Purpose:</Box>
                            {bigQueryTeam.sharedPurpose}
                          </Typography>
                        )}
                      </Box>
                    )}

                    {/* Norms & norm correction (non-compact only) */}
                    {!compact && (bigQueryTeam?.norms || bigQueryTeam?.normCorrection) && (
                      <Box sx={{ mb: 1.5 }}>
                        {bigQueryTeam?.norms && (
                          <Box sx={{ mb: 0.75 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.disabled', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Norms
                            </Typography>
                            <Box component="ul" sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.25, mb: 0, pl: 2.5 }}>
                              {bigQueryTeam.norms.split('\n').filter(n => n.trim()).map((norm, idx) => (
                                <li key={idx}>{norm}</li>
                              ))}
                            </Box>
                          </Box>
                        )}
                        {bigQueryTeam?.normCorrection && (
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.disabled', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Norm Correction
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }}>
                              {bigQueryTeam.normCorrection}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}

                    {/* Team Members List */}
                    {team.organizers.length > 0 && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: compact ? 0.25 : 0.5, flex: 1 }}>
                        {team.organizers.map((organizer) => {
                          const isLead = team.lead ? organizer.id === team.lead.id : false;
                          return (
                          <Box key={organizer.id} sx={{
                            display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap',
                            ...(isLead && {
                              backgroundColor: `${getCustomChapterColor(team.chapter, customColors)}10`,
                              borderRadius: 0.75,
                              px: 0.75,
                              py: 0.25,
                              mx: -0.75,
                            })
                          }}>
                            <OrganizerChip
                              name={organizer.name}
                              vanId={organizer.id}
                              size="small"
                              variant="outlined"
                              color="default"
                              onFilterBy={onFilterByOrganizer}
                              onEditMapping={onEditOrganizerMapping}
                              teamRole={organizer.team_role}
                              sx={{
                                fontSize: compact ? '0.70rem' : '0.75rem',
                                height: compact ? 20 : 24,
                                fontWeight: isLead ? 700 : 400,
                                borderColor: isLead
                                  ? getCustomChapterColor(team.chapter, customColors)
                                  : undefined,
                                color: isLead
                                  ? getCustomChapterColor(team.chapter, customColors)
                                  : undefined,
                              }}
                            />
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                              {organizer.constituentRole && (
                                <Chip
                                  label={organizer.constituentRole}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    fontSize: '0.63rem',
                                    height: '18px',
                                    backgroundColor: 'rgba(25, 118, 210, 0.06)',
                                    borderColor: 'rgba(25, 118, 210, 0.25)',
                                    color: 'primary.dark'
                                  }}
                                />
                              )}
                              {organizer.functionalRole && (
                                <Chip
                                  label={organizer.functionalRole}
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    fontSize: '0.63rem',
                                    height: '18px',
                                    backgroundColor: 'rgba(76, 175, 80, 0.06)',
                                    borderColor: 'rgba(76, 175, 80, 0.25)',
                                    color: 'success.dark'
                                  }}
                                />
                              )}
                              {organizer.team_role && (
                                <Typography variant="caption" sx={{
                                  fontSize: '0.7rem',
                                  color: 'text.secondary',
                                  fontStyle: 'italic'
                                }}>
                                  {organizer.team_role}
                                </Typography>
                              )}
                              {organizer.turf && (
                                <Chip 
                                  label={organizer.turf} 
                                  size="small" 
                                  variant="outlined"
                                  sx={{ 
                                    fontSize: '0.65rem', 
                                    height: '18px',
                                    backgroundColor: 'rgba(0,0,0,0.02)',
                                    borderColor: 'rgba(0,0,0,0.15)'
                                  }} 
                                />
                              )}
                            </Box>
                          </Box>
                          );
                        })}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </Box>
          )
        )}
      </Box>

      {/* Add Team Dialog */}
      <AddTeamDialog
        open={addTeamDialogOpen}
        onClose={() => setAddTeamDialogOpen(false)}
        onSave={handleAddTeam}
        organizers={availableOrganizers}
        allPeople={allAvailablePeople}
        chapters={availableChapters}
        onSearchPeople={onSearchPeople}
      />

      {/* Edit Team Dialog */}
      <EditTeamDialog
        open={editTeamDialogOpen}
        onClose={() => {
          setEditTeamDialogOpen(false);
          setTeamToEdit(null);
        }}
        onSave={handleSaveEditedTeam}
        organizers={availableOrganizers}
        allPeople={allAvailablePeople}
        chapters={availableChapters}
        onSearchPeople={onSearchPeople}
        teamToEdit={teamToEdit}
      />

      {/* Team Goals Dialog */}
      <TeamGoalsDialog
        open={teamGoalsDialogOpen}
        onClose={() => setTeamGoalsDialogOpen(false)}
        onSave={handleAddTeamGoal}
        organizers={availableOrganizers.map(org => org.name)}
        chapters={availableChapters}
      />

      {/* Disband Team Confirmation Dialog */}
      <Dialog
        open={confirmDisbandOpen}
        onClose={() => {
          setConfirmDisbandOpen(false);
          setTeamToAction(null);
        }}
      >
        <DialogTitle>Disband Team?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to disband <strong>{teamToAction?.teamName}</strong>?
            <br /><br />
            This will set the disband date to today. The team will be hidden from visualizations and the Teams/Network panels,
            but the data will remain in the database for record-keeping.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setConfirmDisbandOpen(false);
              setTeamToAction(null);
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmDisbandTeam} 
            color="warning"
            variant="contained"
          >
            Disband Team
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Team Confirmation Dialog */}
      <Dialog
        open={confirmDeleteOpen}
        onClose={() => {
          setConfirmDeleteOpen(false);
          setTeamToAction(null);
        }}
      >
        <DialogTitle>Delete Team?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete <strong>{teamToAction?.teamName}</strong>?
            <br /><br />
            <strong style={{ color: '#f44336' }}>This action cannot be undone!</strong> The team will be completely removed from the database.
            <br /><br />
            If the team was disbanded by choice, consider using "Disband" instead to keep the data for records.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setConfirmDeleteOpen(false);
              setTeamToAction(null);
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmDeleteTeam} 
            color="error"
            variant="contained"
          >
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeamsPanel;
