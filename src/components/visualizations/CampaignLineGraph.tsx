import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Box, Typography, Paper, Chip, Button, LinearProgress, FormControl, InputLabel, Select, MenuItem, Collapse, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { Star as StarIcon, Person as PersonIcon, Business as BusinessIcon, Public as PublicIcon, Groups as GroupsIcon, KeyboardArrowRight, KeyboardArrowDown } from '@mui/icons-material';
import { CampaignEvent } from '../../types';
import { ParentCampaign, CampaignGoalType, GoalDataSource } from '../dialogs/ParentCampaignDialog';
import { useChapterColors } from '../../contexts/ChapterColorContext';
import { PledgeSubmission, fetchActions, fetchOrganizerGoals, OrganizerGoal } from '../../services/api';
import { OrganizerChip } from '../ui/OrganizerChip';
import { LeaderMetricsTable } from '../tables/LeaderMetricsTable';
import type { LeaderProgress } from '../visualizations/Dashboard';

interface MeetingData {
  organizer_vanid?: number | string;
  vanid?: number | string;
  datestamp?: { value: string } | string;
  chapter?: string;
  meeting_type?: string;
}

interface LeaderHierarchy {
  leader_vanid: string;
  parent_leader_vanid: string | null;
  organizer_vanid: string;
  created_date?: string;
  updated_date?: string;
}

interface CampaignLineGraphProps {
  actions: CampaignEvent[];
  width?: number;
  height?: number;
  selectedChapter: string;
  onActionClick?: (action: CampaignEvent) => void;
  onFilterByOrganizer?: (name: string, vanId?: string) => void;
  onEditOrganizerMapping?: (name: string, vanId?: string) => void;
  selectedCampaign?: string;
  onResetZoom?: () => void;
  parentCampaigns?: ParentCampaign[];
  selectedParentCampaigns?: string[];
  pledgeSubmissions?: PledgeSubmission[];
  meetingsData?: MeetingData[];
  showOnlyBarometer?: boolean;
  userMap?: Map<string, any>;
  barometerView?: 'federation' | 'chapters' | 'teams' | 'people' | 'leadership';
  onBarometerViewChange?: (view: 'federation' | 'chapters' | 'teams' | 'people' | 'leadership') => void;
  barometerActions?: string[]; // Selected actions for barometer (from URL)
  onBarometerActionsChange?: (actions: string[]) => void;
  barometerSort?: string; // Sort column (from URL)
  barometerSortDir?: 'asc' | 'desc'; // Sort direction (from URL)
  onBarometerSortChange?: (column: string | null, direction: 'asc' | 'desc') => void;
  leaderHierarchy?: LeaderHierarchy[];
  listsData?: any[];
  actionsFromDB?: any[]; // Database actions with full field definitions
  teamsData?: any[]; // Teams data for chapter filtering
}

const CampaignLineGraph: React.FC<CampaignLineGraphProps> = ({
  actions,
  width: propWidth = 800,
  height: propHeight = 400,
  selectedChapter,
  onActionClick,
  onFilterByOrganizer,
  onEditOrganizerMapping,
  selectedCampaign,
  onResetZoom,
  parentCampaigns = [],
  selectedParentCampaigns = [],
  pledgeSubmissions = [],
  meetingsData = [],
  showOnlyBarometer = false,
  userMap = new Map(),
  barometerView: barometerViewProp,
  onBarometerViewChange,
  barometerActions: barometerActionsProp,
  onBarometerActionsChange,
  barometerSort: barometerSortProp,
  barometerSortDir: barometerSortDirProp = 'desc',
  onBarometerSortChange,
  leaderHierarchy = [],
  listsData = [],
  actionsFromDB = [],
  teamsData = []
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [zoomExtent, setZoomExtent] = useState<{dateRange: [Date, Date], goalRange: [number, number]} | null>(null);
  const [selectedGoalTypes, setSelectedGoalTypes] = useState<string[]>([]);
  
  // Use external barometer view if provided (for URL routing), otherwise internal state
  const barometerView = barometerViewProp || 'federation';
  const setBarometerView = (view: 'federation' | 'chapters' | 'teams' | 'people' | 'leadership') => {
    if (onBarometerViewChange) {
      onBarometerViewChange(view);
    }
  };
  
  const [barometerGoalTypeFilters, setBarometerGoalTypeFilters] = useState<string[]>(
    barometerActionsProp || []
  );
  // Keep single filter for internal logic (for useMemo dependencies)
  const barometerGoalTypeFilter = barometerGoalTypeFilters[0] || '';
  
  // Update URL when barometer actions change
  useEffect(() => {
    if (onBarometerActionsChange && barometerGoalTypeFilters.length > 0) {
      onBarometerActionsChange(barometerGoalTypeFilters);
    }
  }, [barometerGoalTypeFilters, onBarometerActionsChange]);
  
  // 3-way display mode for LeaderMetricsTable
  const [displayMode, setDisplayMode] = useState<'nothing' | 'conversions' | 'counts'>('nothing');
  const showConversions = displayMode === 'conversions'; // kept for any legacy refs
  
  // State for organizer goals: Map<organizer_vanid, Map<action_id, goal_value>>
  const [organizerGoalsMap, setOrganizerGoalsMap] = useState<Map<string, Map<string, number>>>(new Map());
  
  // Get all available actions for the metric dropdown (active actions only, no Pledges)
  const [availableMetrics, setAvailableMetrics] = useState<Array<{value: string, label: string}>>([]);
  
  // Fetch available actions - filtered by selected campaigns
  useEffect(() => {
    const loadActions = async () => {
      try {
        const actionsData = await fetchActions();
        // Filter for active, non-archived actions only
        let activeActions = actionsData.filter((a: any) => 
          a.is_active && 
          a.status !== 'archived' && 
          !a.archived_date
        );
        
        // If campaigns are selected, only show actions from those campaigns
        if (selectedParentCampaigns && selectedParentCampaigns.length > 0) {
          activeActions = activeActions.filter((a: any) => 
            a.parent_campaign_id && selectedParentCampaigns.includes(a.parent_campaign_id)
          );
        }
        
        const metrics = activeActions.map((action: any) => ({
          value: `action_${action.action_id}`,
          label: action.action_name
        }));
        
        setAvailableMetrics(metrics);
      } catch (error) {
        console.error('Failed to load actions for metrics:', error);
      }
    };
    
    loadActions();
  }, [selectedParentCampaigns]);
  
  // Fetch organizer goals for all unique organizers
  useEffect(() => {
    const loadOrganizerGoals = async () => {
      try {
        // Get all unique organizer VAN IDs from all data sources
        const uniqueOrganizerIds = new Set<string>();
        
        // From pledge submissions
        pledgeSubmissions.forEach(p => {
          if (p.organizer_vanid) uniqueOrganizerIds.add(p.organizer_vanid.toString());
        });
        
        // From meetings data
        meetingsData.forEach(m => {
          if (m.organizer_vanid) uniqueOrganizerIds.add(m.organizer_vanid.toString());
        });
        
        // From lists data
        listsData.forEach(item => {
          if (item.organizer_vanid) uniqueOrganizerIds.add(item.organizer_vanid.toString());
        });
        
        // Fetch goals for all organizers in parallel
        const goalsPromises = Array.from(uniqueOrganizerIds).map(vanid => 
          fetchOrganizerGoals(vanid).catch(err => {
            console.error(`Failed to fetch goals for organizer ${vanid}:`, err);
            return [];
          })
        );
        
        const allGoalsArrays = await Promise.all(goalsPromises);
        
        // Build map: organizer_vanid -> action_id -> goal_value
        const goalsMap = new Map<string, Map<string, number>>();
        allGoalsArrays.forEach(goalsArray => {
          goalsArray.forEach(goal => {
            const vanid = goal.organizer_vanid.toString();
            if (!goalsMap.has(vanid)) {
              goalsMap.set(vanid, new Map());
            }
            goalsMap.get(vanid)!.set(goal.action_id, goal.goal_value);
          });
        });
        
        setOrganizerGoalsMap(goalsMap);
      } catch (error) {
        console.error('Failed to load organizer goals:', error);
      }
    };
    
    if (pledgeSubmissions.length > 0 || meetingsData.length > 0 || listsData.length > 0) {
      loadOrganizerGoals();
    }
  }, [pledgeSubmissions, meetingsData, listsData]);
  
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const { customColors } = useChapterColors();

  // Use actual dimensions for rendering
  // If propWidth/propHeight are provided (non-zero), use them; otherwise use container dimensions
  // Always ensure we have a reasonable minimum width to fill the space
  const width = (propWidth && propWidth > 0) ? propWidth : (containerWidth || (typeof window !== 'undefined' ? Math.max(800, window.innerWidth * 0.6) : 800));
  // For timeline view, use full available height; for barometer view, use smaller default
  const height = (propHeight && propHeight > 0) ? propHeight : (containerHeight || (showOnlyBarometer ? 400 : 600));

  // Filter campaigns that are selected (needed for useMemo hooks below)
  const selectedCampaignObjs = parentCampaigns.filter(pc => selectedParentCampaigns.includes(pc.id));

  // Leaderboard by chapter (must be at top level with other hooks)
  const chapterLeaderboard = React.useMemo(() => {
    const chapterMap = new Map<string, { count: number; goal: number }>();
    
    // Helper to normalize chapter names (e.g., "Durham" -> "Durham for All")
    const normalizeChapterName = (dataChapter: string): string => {
      // Find matching campaign chapter that starts with the data chapter name
      const matchingCampaign = selectedCampaignObjs.find(campaign => 
        campaign.chapters && 
        campaign.chapters.length > 0 && 
        campaign.chapters[0] !== 'All Chapters' &&
        (campaign.chapters[0] === dataChapter || campaign.chapters[0].startsWith(dataChapter + ' '))
      );
      return matchingCampaign?.chapters[0] || dataChapter;
    };
    
    // Get data based on selected goal type filter
    if (barometerGoalTypeFilter === 'meetings_membership') {
      (meetingsData || []).forEach(m => {
        const t = (m.meeting_type || '').toLowerCase();
        if (t.includes('membership') && t.includes('one-on-one') && m.chapter) {
          const normalizedChapter = normalizeChapterName(m.chapter);
          const existing = chapterMap.get(normalizedChapter);
          chapterMap.set(normalizedChapter, {
            count: (existing?.count || 0) + 1,
            goal: existing?.goal || 0
          });
        }
      });
    } else if (barometerGoalTypeFilter === 'meetings_leadership') {
      (meetingsData || []).forEach(m => {
        const t = (m.meeting_type || '').toLowerCase();
        if (t.includes('leadership') && t.includes('one-on-one') && m.chapter) {
          const normalizedChapter = normalizeChapterName(m.chapter);
          const existing = chapterMap.get(normalizedChapter);
          chapterMap.set(normalizedChapter, {
            count: (existing?.count || 0) + 1,
            goal: existing?.goal || 0
          });
        }
      });
    }
    
    // Add goals from campaigns
    // First, get all selected campaign IDs (including parent campaigns)
    const selectedCampaignIds = new Set(selectedCampaignObjs.map(c => c.id));
    
    // Process chapter goals from selected campaigns
    parentCampaigns.forEach(campaign => {
      const isDirectlySelected = selectedCampaignIds.has(campaign.id);
      const isChildOfSelected = campaign.parentCampaignId && selectedCampaignIds.has(campaign.parentCampaignId);
      
      if (isDirectlySelected || isChildOfSelected) {
        const goalType = campaign.goalTypes.find(gt => gt.dataSource === barometerGoalTypeFilter || gt.id === barometerGoalTypeFilter);
        
        if (goalType) {
          // Check if this is a chapter-specific campaign (child campaign)
          if (campaign.chapters && 
              campaign.chapters.length > 0 && 
              campaign.chapters[0] !== 'All Chapters') {
            const chapter = campaign.chapters[0];
            const existing = chapterMap.get(chapter);
            chapterMap.set(chapter, {
              count: existing?.count || 0,
              goal: goalType.totalTarget
            });
          }
          // Check if this is a parent campaign with chapter-specific goals
          else if (goalType.chapterGoals && Object.keys(goalType.chapterGoals).length > 0) {
            // Apply chapter-specific goals from parent campaign
            Object.entries(goalType.chapterGoals).forEach(([chapter, chapterGoal]) => {
              const existing = chapterMap.get(chapter);
              chapterMap.set(chapter, {
                count: existing?.count || 0,
                goal: chapterGoal
              });
            });
          }
        }
      }
    });
    
    const leaderboard = Array.from(chapterMap.entries())
      .map(([chapter, data]) => ({ chapter, count: data.count, goal: data.goal }))
      .sort((a, b) => b.count - a.count);
    
    // Add "Other / Canvassers" entry if there are others with data
    // This will be populated later when we have the leadersForTable data
    return leaderboard;
  }, [meetingsData, barometerGoalTypeFilter, selectedCampaignObjs, parentCampaigns]);

  // Leaderboard by person (counting by leader - who collected meetings)
  const personLeaderboard = React.useMemo(() => {
    const personMap = new Map<string, { name: string; count: number; chapter?: string }>();
    
    // Get data based on selected goal type filter
    if (barometerGoalTypeFilter === 'meetings_membership') {
      (meetingsData || []).forEach(m => {
        const t = (m.meeting_type || '').toLowerCase();
        if (t.includes('membership') && t.includes('one-on-one')) {
          const organizerVanId = m.organizer_vanid?.toString() || 'Unknown';
          const organizerUser = userMap.get(organizerVanId);
          const organizerName = organizerUser 
            ? `${organizerUser.firstname || ''} ${organizerUser.lastname || ''}`.trim() || organizerVanId
            : organizerVanId;
          
          const existing = personMap.get(organizerVanId);
          if (existing) {
            existing.count += 1;
          } else {
            personMap.set(organizerVanId, {
              name: organizerName,
              count: 1,
              chapter: m.chapter
            });
          }
        }
      });
    } else if (barometerGoalTypeFilter === 'meetings_leadership') {
      (meetingsData || []).forEach(m => {
        const t = (m.meeting_type || '').toLowerCase();
        if (t.includes('leadership') && t.includes('one-on-one')) {
          const organizerVanId = m.organizer_vanid?.toString() || 'Unknown';
          const organizerUser = userMap.get(organizerVanId);
          const organizerName = organizerUser 
            ? `${organizerUser.firstname || ''} ${organizerUser.lastname || ''}`.trim() || organizerVanId
            : organizerVanId;
          
          const existing = personMap.get(organizerVanId);
          if (existing) {
            existing.count += 1;
          } else {
            personMap.set(organizerVanId, {
              name: organizerName,
              count: 1,
              chapter: m.chapter
            });
          }
        }
      });
    }
    
    return Array.from(personMap.values())
      .sort((a, b) => b.count - a.count);
  }, [meetingsData, barometerGoalTypeFilter, userMap]);

  // Build LeaderProgress data for LeaderMetricsTable (used in "By Person" and "By Leadership" views)
  const leadersForTable = React.useMemo(() => {
    const leaderMap = new Map<string, LeaderProgress>();
    const leaderActionsMap: Record<string, string[]> = {};
    const leaderGoalsMap: Record<string, Record<string, number>> = {};
    
    // Helper to get or create leader
    const getOrCreateLeader = (vanId: string): LeaderProgress => {
      if (!leaderMap.has(vanId)) {
        let name: string;
        
        // Check if this is an unmatched leader (not in userMap)
        if (vanId.startsWith('unmatched_')) {
          // Extract the actual name from the ID
          name = vanId.replace('unmatched_', '');
        } else {
          // Try to get name from userMap
          const user = userMap.get(vanId);
          name = user 
            ? `${user.firstname || ''} ${user.lastname || ''}`.trim() || vanId
            : vanId;
        }
        
        leaderMap.set(vanId, {
          id: vanId,
          name,
          hasMetGoal: false,
          subLeaders: [],
          actionProgress: {}
        });
        leaderActionsMap[vanId] = [];
        leaderGoalsMap[vanId] = {};
      }
      return leaderMap.get(vanId)!;
    };
    
    // Process each selected metric
    barometerGoalTypeFilters.forEach(metricValue => {
      let metricCounts = new Map<string, number>();
      
      // Calculate counts based on metric type
      if (metricValue === 'meetings_membership') {
        (meetingsData || []).forEach(m => {
          const t = (m.meeting_type || '').toLowerCase();
          if (t.includes('membership') && t.includes('one-on-one')) {
            const vanId = m.organizer_vanid?.toString() || 'Unknown';
            metricCounts.set(vanId, (metricCounts.get(vanId) || 0) + 1);
          }
        });
      } else if (metricValue === 'meetings_leadership') {
        (meetingsData || []).forEach(m => {
          const t = (m.meeting_type || '').toLowerCase();
          if (t.includes('leadership') && t.includes('one-on-one')) {
            const vanId = m.organizer_vanid?.toString() || 'Unknown';
            metricCounts.set(vanId, (metricCounts.get(vanId) || 0) + 1);
          }
        });
      } else if (metricValue.startsWith('action_')) {
        // Custom action — count based on goalFieldKey if defined, otherwise count all Named
        const actionId = metricValue.replace('action_', '');
        const actionDef = (actionsFromDB || []).find((a: any) => a.action_id === actionId);
        const goalFieldKey: string | null = actionDef?.goal_field_key || null;

        (listsData || [])
          .filter((entry: any) => entry.action_id === actionId)
          .forEach((entry: any) => {
            const vanId = entry.organizer_vanid?.toString();
            const personVanId = entry.vanid?.toString();
            if (!vanId || !personVanId) return;

            // Always track raw "Named" (total on list)
            if (!metricCounts.has(vanId)) {
              metricCounts.set(vanId, 0);
              (metricCounts as any)[`${vanId}_people`] = new Set();       // goal-filtered
              (metricCounts as any)[`${vanId}_named`] = new Set();        // raw total
            }
            const namedSet = (metricCounts as any)[`${vanId}_named`] as Set<string>;
            namedSet.add(personVanId);

            // If a goal field is set, only count people who have completed that field
            const meetsGoal = goalFieldKey
              ? (entry.progress?.[goalFieldKey] === true || entry.fields?.[goalFieldKey] === true)
              : true; // no goal field → count everyone (Named = goal count)

            if (meetsGoal) {
              const peopleSet = (metricCounts as any)[`${vanId}_people`] as Set<string>;
              peopleSet.add(personVanId);
              metricCounts.set(vanId, peopleSet.size);
            }
          });
      }
      
      // Update leaders with this metric's data
      metricCounts.forEach((count, vanId) => {
        const leader = getOrCreateLeader(vanId);
        const actionId = metricValue.startsWith('action_') 
          ? metricValue.replace('action_', '') 
          : metricValue;
        
        // Add to actions list
        if (!leaderActionsMap[vanId].includes(actionId)) {
          leaderActionsMap[vanId].push(actionId);
        }
        
        const dbActionId = actionId;
        
        // Get goal from organizerGoalsMap, or default to 5
        const organizerGoals = organizerGoalsMap.get(vanId);
        const goal = organizerGoals?.get(dbActionId) || 5;
        
        leaderGoalsMap[vanId][actionId] = goal;
        
        // Update action progress
        if (!leader.actionProgress) {
          leader.actionProgress = {};
        }
        // Also store raw Named count (total on list) if available
        const namedSet = (metricCounts as any)[`${vanId}_named`] as Set<string> | undefined;
        const namedCount = namedSet ? namedSet.size : count;
        leader.actionProgress[actionId] = {
          count,
          namedCount,
          goal,
          hasMetGoal: count >= goal
        };
        
        // Update overall hasMetGoal
        leader.hasMetGoal = Object.values(leader.actionProgress).some(p => p.hasMetGoal);
        
      });
    });
    
    // Build hierarchy using RECURSIVE approach
    // ONLY show core team members at the top level (FLAT), nest everyone else
    
    // First, identify ALL team member VAN IDs (these should NEVER be nested)
    const teamMemberIds = new Set<string>();
    const teamMemberNames = new Set<string>(); // Track names too for debugging
    
    if (teamsData && Array.isArray(teamsData)) {
      teamsData.forEach(team => {
        const teamMembers = team.bigQueryData?.teamMembers || [];
        const teamLead = team.bigQueryData?.teamLead;
        
        // Find VAN IDs for team lead
        if (teamLead) {
          teamMemberNames.add(teamLead.toLowerCase());
          const leadEntry = Array.from(userMap.entries()).find(([id, info]) => {
            const fullName = (info.fullName || `${info.firstname || ''} ${info.lastname || ''}`.trim()).toLowerCase();
            const firstName = (info.firstname || '').toLowerCase();
            const lastName = (info.lastname || '').toLowerCase();
            const teamLeadLower = teamLead.toLowerCase();
            
            // Exact match only - prevent false positives
            return fullName === teamLeadLower || 
                   (firstName && lastName && teamLeadLower === `${firstName} ${lastName}`) ||
                   (firstName && teamLeadLower === firstName && !teamLeadLower.includes(' '));
          });
          if (leadEntry) {
            teamMemberIds.add(leadEntry[0]);
          }
        }
        
        // Find VAN IDs for team members
        teamMembers.forEach((memberName: string) => {
          teamMemberNames.add(memberName.toLowerCase());
          const memberEntry = Array.from(userMap.entries()).find(([id, info]) => {
            const fullName = (info.fullName || `${info.firstname || ''} ${info.lastname || ''}`.trim()).toLowerCase();
            const firstName = (info.firstname || '').toLowerCase();
            const lastName = (info.lastname || '').toLowerCase();
            const memberNameLower = memberName.toLowerCase();
            
            // Exact match only - prevent false positives
            return fullName === memberNameLower || 
                   (firstName && lastName && memberNameLower === `${firstName} ${lastName}`) ||
                   (firstName && memberNameLower === firstName && !memberNameLower.includes(' '));
          });
          if (memberEntry) {
            teamMemberIds.add(memberEntry[0]);
          }
        });
      });
    }
    
    // Recursive function to build a leader and their sub-leaders
    const buildLeaderHierarchy = (leaderId: string, leaderName: string, depth: number = 0, isTopLevel: boolean = false): LeaderProgress | null => {
      if (depth > 3) return null; // Prevent infinite recursion
      
      // Get leader's data from leaderMap (if they have any action data)
      const leaderData = leaderMap.get(leaderId);
      
      // Debug logging for missing pledge data
      // Debug: Check for specific leaders if needed
      // if (!leaderData && (leaderName.toLowerCase().includes('leo') || leaderName.toLowerCase().includes('abi'))) { ... }
      
      const leader: LeaderProgress = leaderData ? {
        ...leaderData,
        name: leaderName
      } : {
        id: leaderId,
        name: leaderName,
        hasMetGoal: false,
        subLeaders: [],
        actionProgress: {}
      };
      
      // Build sub-leaders from hierarchy entries where this leader is the parent
      const childEntries = leaderHierarchy.filter(h => h.parent_leader_vanid === leaderId);
      const subLeaders: LeaderProgress[] = [];
      const processedSubIds = new Set<string>();
      
      childEntries.forEach(entry => {
        const childId = entry.leader_vanid;
        if (processedSubIds.has(childId)) return;
        
        // CRITICAL: Skip if child is a team member (team members are ALWAYS top-level, never nested)
        if (teamMemberIds.has(childId)) {
          return; // Don't nest team members under anyone
        }
        
        processedSubIds.add(childId);
        
        // Get child's name from userMap with better fallbacks
        const childUser = userMap.get(childId);
        let childName: string;
        
        if (childUser) {
          // Try fullName first (includes mapping data), then construct from parts
          childName = childUser.fullName || 
                      `${childUser.firstname || ''} ${childUser.lastname || ''}`.trim() ||
                      childUser.name ||
                      childId;
        } else {
          // Fallback: check if ID is in userMap by string comparison
          const userEntry = Array.from(userMap.entries()).find(([id]) => id.toString() === childId.toString());
          if (userEntry) {
            const user = userEntry[1];
            childName = user.fullName || 
                        `${user.firstname || ''} ${user.lastname || ''}`.trim() ||
                        user.name ||
                        childId;
          } else {
            childName = childId;
          }
        }
        
        const subLeader = buildLeaderHierarchy(childId, childName, depth + 1, false);
        if (subLeader) {
          subLeaders.push(subLeader);
        }
      });
      
      return {
        ...leader,
        subLeaders
      };
    };
    
    // ONLY show core team members at the top level (like Dashboard does)
    const topLeaders: LeaderProgress[] = [];
    const processedTopIds = new Set<string>();
    
    // Get all team members from all teams and add them at top level
    if (teamsData && Array.isArray(teamsData)) {
      teamsData.forEach(team => {
        const teamMembers = team.bigQueryData?.teamMembers || [];
        const teamLead = team.bigQueryData?.teamLead;
        
        // Add team lead
        if (teamLead) {
          const leadEntry = Array.from(userMap.entries()).find(([id, info]) => {
            const fullName = (info.fullName || `${info.firstname || ''} ${info.lastname || ''}`.trim()).toLowerCase();
            const firstName = (info.firstname || '').toLowerCase();
            const lastName = (info.lastname || '').toLowerCase();
            const teamLeadLower = teamLead.toLowerCase();
            
            // Exact match only
            return fullName === teamLeadLower || 
                   (firstName && lastName && teamLeadLower === `${firstName} ${lastName}`) ||
                   (firstName && teamLeadLower === firstName && !teamLeadLower.includes(' '));
          });
          
          if (leadEntry && !processedTopIds.has(leadEntry[0])) {
            processedTopIds.add(leadEntry[0]);
            // Use actual name from userMap for consistency
            const leadUser = userMap.get(leadEntry[0]);
            const leadName = leadUser?.fullName || teamLead;
            const leader = buildLeaderHierarchy(leadEntry[0], leadName, 0, true);
            if (leader) {
              topLeaders.push(leader);
            }
          }
        }
        
        // Add team members
        teamMembers.forEach((memberName: string) => {
          const memberEntry = Array.from(userMap.entries()).find(([id, info]) => {
            const fullName = (info.fullName || `${info.firstname || ''} ${info.lastname || ''}`.trim()).toLowerCase();
            const firstName = (info.firstname || '').toLowerCase();
            const lastName = (info.lastname || '').toLowerCase();
            const memberNameLower = memberName.toLowerCase();
            
            // Exact match only
            return fullName === memberNameLower || 
                   (firstName && lastName && memberNameLower === `${firstName} ${lastName}`) ||
                   (firstName && memberNameLower === firstName && !memberNameLower.includes(' '));
          });
          
          if (memberEntry && !processedTopIds.has(memberEntry[0])) {
            processedTopIds.add(memberEntry[0]);
            // Use actual name from userMap for consistency
            const memberUser = userMap.get(memberEntry[0]);
            const actualMemberName = memberUser?.fullName || memberName;
            const leader = buildLeaderHierarchy(memberEntry[0], actualMemberName, 0, true);
            if (leader) {
              topLeaders.push(leader);
            }
          }
        });
      });
    }
    
    // Get all leaders flattened for "By Person" view (deduplicated by ID)
    const flattenLeaders = (leadersList: LeaderProgress[]): LeaderProgress[] => {
      const flattened: LeaderProgress[] = [];
      const seenIds = new Set<string>();
      
      const flatten = (leaders: LeaderProgress[]) => {
        leaders.forEach(leader => {
          // Only add if not already seen
          if (!seenIds.has(leader.id)) {
            seenIds.add(leader.id);
            flattened.push(leader);
          }
          
          if (leader.subLeaders.length > 0) {
            flatten(leader.subLeaders);
          }
        });
      };
      
      flatten(leadersList);
      return flattened;
    };
    
    const allLeadersInHierarchy = flattenLeaders(topLeaders);
    
    // IMPORTANT: Separate leaders into hierarchy and "others" (not in formal team structure)
    const includedIds = new Set(allLeadersInHierarchy.map(l => l.id));
    const othersLeaders: LeaderProgress[] = [];
    
    leaderMap.forEach((leaderData, vanId) => {
      if (!includedIds.has(vanId)) {
        // This leader has data but isn't in the hierarchy - they're an "other"
        othersLeaders.push(leaderData);
      }
    });
    
    // Create an aggregated "Other / Canvassers" entry (for By Team view)
    let othersAggregate: LeaderProgress | null = null;
    
    if (othersLeaders.length > 0) {
      const othersNames = othersLeaders.map(l => l.name).sort().join(', ');
      const othersActionProgress: Record<string, any> = {};
      
      // Aggregate all action progress across others
      barometerGoalTypeFilters.forEach(metricValue => {
        const actionId = metricValue.startsWith('action_') 
          ? metricValue.replace('action_', '') 
          : metricValue;
        
        let totalCount = 0;
        let totalGoal = 0;
        
        othersLeaders.forEach(leader => {
          const progress = leader.actionProgress?.[actionId];
          if (progress) {
            totalCount += progress.count || 0;
            totalGoal += progress.goal || 0;
          }
        });
        
        if (totalCount > 0 || totalGoal > 0) {
          othersActionProgress[actionId] = {
            count: totalCount,
            goal: totalGoal,
            hasMetGoal: totalCount >= totalGoal
          };
        }
      });
      
      othersAggregate = {
        id: 'others_aggregate',
        name: `Other / Canvassers (${othersLeaders.length})`,
        hasMetGoal: Object.values(othersActionProgress).some((p: any) => p.hasMetGoal),
        subLeaders: [],
        actionProgress: othersActionProgress,
        metadata: {
          isOthersAggregate: true,
          othersNames,
          othersCount: othersLeaders.length
        }
      };
    }
    
    // For "By Person" view: Include hierarchy leaders + individual "others" (NOT aggregated)
    const allLeadersWithData: LeaderProgress[] = [...allLeadersInHierarchy, ...othersLeaders];
    
    // For "By Leadership" view: Keep the hierarchy structure, but add unmatched "others" at top level
    // Note: "others" here should ONLY be people not in the hierarchy at all (like unmatched names)
    // People who ARE in the hierarchy (like Springer under Courtney) are already in topLeaders with proper nesting
    const topLeadersWithOthers: LeaderProgress[] = [...topLeaders, ...othersLeaders];
    
    // Sort by total progress across all actions descending
    const sortLeaders = (a: LeaderProgress, b: LeaderProgress) => {
      const getTotalProgress = (leader: LeaderProgress) => {
        let total = 0;
        if (leader.actionProgress) {
          Object.values(leader.actionProgress).forEach(progress => { total += progress.count; });
        }
        return total;
      };
      return getTotalProgress(b) - getTotalProgress(a);
    };
    
    // Sort all leaders (for flat view) - use allLeadersWithData to include everyone with data
    const sortedAllLeaders = [...allLeadersWithData].sort(sortLeaders);
    
    // Sort top leaders and their sub-leaders recursively (for hierarchy view)
    const sortLeadersRecursive = (leadersList: LeaderProgress[]): LeaderProgress[] => {
      return leadersList.sort(sortLeaders).map(leader => ({
        ...leader,
        subLeaders: leader.subLeaders.length > 0 ? sortLeadersRecursive(leader.subLeaders) : []
      }));
    };
    
    const sortedTopLeaders = sortLeadersRecursive([...topLeaders]);
    
    return {
      leaders: sortedTopLeaders, // For "By Leadership" view - preserves hierarchy structure (Springer under Courtney, etc.)
      leaderActionsMap,
      leaderGoalsMap,
      allLeaders: sortedAllLeaders, // Flat list for "By Person" view - includes hierarchy + individual others
      othersAggregate, // Aggregated "Other / Canvassers" entry for "By Team" view
      othersLeaders, // Individual "other" leaders (not in hierarchy)
      topLeadersWithOthers: sortLeadersRecursive([...topLeadersWithOthers]) // Alternative with others at top level if needed
    };
  }, [barometerGoalTypeFilters, meetingsData, listsData, userMap, leaderHierarchy, organizerGoalsMap, actionsFromDB]);

  // Which data-source line a goal type drives (for filter: only show line when its goal type is selected)
  const goalTypeDataSource = (gt: CampaignGoalType): 'pledges' | 'meetings_membership' | 'meetings_leadership' | null => {
    const ds = gt.dataSource;
    if (ds === 'pledges' || ds === 'meetings_membership' || ds === 'meetings_leadership') return ds;
    if (gt.id === 'pledges') return 'pledges';
    if (gt.id === 'membership_1on1s') return 'meetings_membership';
    if (gt.id === 'leadership_1on1s') return 'meetings_leadership';
    return null;
  };

  // Measure dimensions synchronously when content becomes visible
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    if (selectedParentCampaigns.length === 0) return; // Don't measure when no campaigns selected
    
    const initialWidth = Math.max(400, containerRef.current.clientWidth || 800);
    const initialHeight = Math.max(300, (containerRef.current.clientHeight || 400) - 80);
    setContainerWidth(initialWidth);
    setContainerHeight(initialHeight);
  }, [selectedParentCampaigns.length]); // Re-measure when campaigns count changes

  // Resize observer to handle container dimension changes
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Use requestAnimationFrame to ensure DOM has rendered
    const measureDimensions = () => {
      if (!containerRef.current) return;
      const initialWidth = Math.max(400, containerRef.current.clientWidth || 800);
      const initialHeight = Math.max(300, (containerRef.current.clientHeight || 400) - 80);
      setContainerWidth(initialWidth);
      setContainerHeight(initialHeight);
    };
    
    // Measure immediately
    measureDimensions();
    
    // Also measure after a frame to catch any delayed layout
    const rafId = requestAnimationFrame(measureDimensions);
    
    // And measure again after a short delay to catch any animation/transition
    const timeoutId = setTimeout(measureDimensions, 100);
    
    // Then observe for future changes
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const newWidth = Math.max(400, entry.contentRect.width || entry.target.clientWidth);
        const newHeight = Math.max(300, (entry.contentRect.height || entry.target.clientHeight) - 80); // Account for controls
        setContainerWidth(newWidth);
        setContainerHeight(newHeight);
      }
    });
    observer.observe(containerRef.current);
    
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [selectedParentCampaigns]); // Re-measure when campaigns change

  // Function to get color for a chapter
  const getChapterColor = (chapter: string): string => {
    if (chapter === 'All Chapters') return '#dc3545'; // Red for all chapters
    const color = customColors[chapter];
    if (color && typeof color === 'object' && 'main' in color) {
      return (color as any).main as string; // Extract main color from theme object
    }
    if (typeof color === 'string') {
      return color;
    }
    return '#2196f3'; // Default blue if no custom color
  };

  // Comprehensive reset function
  const handleResetZoom = () => {
    setZoomExtent(null);
    if (onResetZoom) {
      onResetZoom(); // This will clear selectedCampaign in parent
    }
  };

  // Initialize selected goal types when parent campaigns change
  useEffect(() => {
    if (selectedParentCampaigns.length > 0) {
      // Get all unique goal types from selected campaigns
      const allGoalTypes = new Set<string>();
      selectedParentCampaigns.forEach(campaignId => {
        const campaign = parentCampaigns.find(pc => pc.id === campaignId);
        if (campaign) {
          campaign.goalTypes.forEach(gt => allGoalTypes.add(gt.id));
        }
      });
      setSelectedGoalTypes(Array.from(allGoalTypes));
    } else {
      setSelectedGoalTypes([]);
    }
  }, [selectedParentCampaigns, parentCampaigns]);

  useEffect(() => {
    // Skip rendering the graph if we're in barometer-only mode
    if (showOnlyBarometer) {
      return;
    }
    
    // Filter actions by selected chapter
    const filteredActions = selectedChapter === 'All Chapters' 
      ? actions 
      : actions.filter(action => action.chapter === selectedChapter);

    // If parent campaigns are selected, show their visualization even if no actions yet
    const hasSelectedCampaigns = selectedParentCampaigns.length > 0;
    
    if (!svgRef.current || (filteredActions.length === 0 && !hasSelectedCampaigns)) {
      // Clear SVG if no data
      if (svgRef.current) {
        d3.select(svgRef.current).selectAll('*').remove();
      }
      return;
    }

    // Only skip rendering if width is unreasonably small (indicates measurement hasn't happened yet)
    if (width < 100) {
      return; // Wait for proper dimensions
    }

    // Always render the timeline graph

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const timelineHeight = height; // Use dynamic height based on container
    const margin = { top: 30, right: 20, bottom: 70, left: 60 }; // Increased margins for better label visibility
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = timelineHeight - margin.top - margin.bottom;

    // Add background rectangle for click-to-reset functionality
    svg.append('rect')
      .attr('width', width)
      .attr('height', timelineHeight)
      .attr('fill', 'transparent')
      .style('cursor', (zoomExtent || selectedCampaign) ? 'pointer' : 'default')
      .on('click', function(event) {
        // Only reset if we're currently zoomed
        if (zoomExtent || selectedCampaign) {
          event.stopPropagation();
          handleResetZoom();
        }
      });

    // Group filtered actions by campaign
    const campaignGroups = d3.group(filteredActions, d => d.campaign);
    
    // Convert to array and sort actions within each campaign by date
    const campaignData = Array.from(campaignGroups.entries()).map(([campaign, actions]) => ({
      campaign,
      actions: actions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }));

    // Create scales with zoom support
    let dateExtent: [Date, Date];
    let goalExtent: [number, number];
    
    // actuals max no longer includes pledges
    const actualsMax = 0;
    
    // Store max goal for reference line
    let maxGoalTarget = 0;

    // If parent campaigns are selected, use their combined date range and goal targets
    if (hasSelectedCampaigns) {
      const selectedCampaignObjs = parentCampaigns.filter(pc => selectedParentCampaigns.includes(pc.id));
      const allDates = selectedCampaignObjs.flatMap(c => [new Date(c.startDate), new Date(c.endDate)]);
      dateExtent = [
        new Date(Math.min(...allDates.map(d => d.getTime()))),
        new Date(Math.max(...allDates.map(d => d.getTime())))
      ];
      
      // Collect all goal targets including milestone targets
      const allGoalTargets = selectedCampaignObjs.flatMap(c => c.goalTypes.map(gt => gt.totalTarget));
      const allMilestoneTargets = selectedCampaignObjs.flatMap(c => 
        c.milestones.flatMap(m => 
          Object.values(m.goalTypeTargets).filter(t => t !== undefined) as number[]
        )
      );
      
      maxGoalTarget = Math.max(
        ...allGoalTargets,
        ...allMilestoneTargets,
        ...(filteredActions.length > 0 ? filteredActions.map(d => d.goal) : [0])
      );
      
      // SMART AUTO-ZOOM: Always zoom to actuals if they exist, with intelligent headroom
      if (actualsMax > 0) {
        // If goals are much larger than actuals (>3x), zoom to actuals with visual indicator for goals
        const isGoalFarAboveActuals = maxGoalTarget > actualsMax * 3;
        if (isGoalFarAboveActuals) {
          goalExtent = [0, actualsMax * 1.8]; // Zoom to actuals with 80% headroom
      } else {
          // Goals are reasonably close to actuals, show both
          goalExtent = [0, Math.max(maxGoalTarget, actualsMax) * 1.2];
        }
      } else {
        // No actuals yet, show goal range
        goalExtent = [0, maxGoalTarget * 1.2];
      }
    } else if (filteredActions.length > 0) {
    const allDates = filteredActions.map(d => new Date(d.date));
      dateExtent = d3.extent(allDates) as [Date, Date];
      goalExtent = [0, (d3.max(filteredActions, d => d.goal) || 100) * 1.1];
    } else {
      // Default extents when no data
      const now = new Date();
      dateExtent = [new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31)];
      goalExtent = [0, 100];
    }

    // Apply campaign-specific zoom if selected
    if (selectedCampaign && !zoomExtent) {
      const campaignActions = filteredActions.filter(action => action.campaign === selectedCampaign);
      if (campaignActions.length > 0) {
        const campaignDates = campaignActions.map(d => new Date(d.date));
        const campaignGoals = campaignActions.map(d => d.goal);
        dateExtent = d3.extent(campaignDates) as [Date, Date];
        
        // Add padding around the campaign dates
        const timePadding = (dateExtent[1].getTime() - dateExtent[0].getTime()) * 0.1;
        dateExtent = [new Date(dateExtent[0].getTime() - timePadding), new Date(dateExtent[1].getTime() + timePadding)];
        
        const goalPadding = (d3.max(campaignGoals)! - d3.min(campaignGoals)!) * 0.2;
        goalExtent = [Math.max(0, d3.min(campaignGoals)! - goalPadding), d3.max(campaignGoals)! + goalPadding];
      }
    }

    // Apply custom zoom extent if set
    if (zoomExtent) {
      dateExtent = zoomExtent.dateRange;
      goalExtent = zoomExtent.goalRange;
    }

    const xScale = d3.scaleTime()
      .domain(dateExtent)
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain(goalExtent)
      .range([innerHeight, 0]);

    // Color scale for different campaigns
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10)
      .domain(campaignData.map(d => d.campaign));

    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add axes
    const timeFormatter = d3.timeFormat('%b %Y');
    const xAxis = d3.axisBottom(xScale)
      .tickFormat((domainValue) => timeFormatter(domainValue as Date));
    
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis as any)
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');

    const yAxis = d3.axisLeft(yScale);
    g.append('g').call(yAxis as any);

    // Add subtle grid lines
    g.selectAll('.grid-line-y')
      .data(yScale.ticks())
      .enter().append('line')
      .attr('class', 'grid-line-y')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .style('stroke', '#f0f0f0')
      .style('stroke-width', 0.5);

    // Add visual indicators for goals when they're above the visible range (auto-zoom mode)
    if (hasSelectedCampaigns && maxGoalTarget > goalExtent[1]) {
      const selectedCampaignObjs = parentCampaigns.filter(pc => selectedParentCampaigns.includes(pc.id));
      const goalTypeColors = ['#2196f3', '#9c27b0', '#ff9800', '#4caf50', '#f44336'];
      
      // Add a dashed line at the top to indicate goals are above
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', 0)
        .attr('y2', 0)
        .style('stroke', '#ff6b35')
        .style('stroke-width', 2)
        .style('stroke-dasharray', '8,4');
      
      // Add goal reference markers on the right side
      const goalIndicatorGroup = g.append('g')
        .attr('transform', `translate(${innerWidth + 10}, 0)`);
      
      selectedCampaignObjs.forEach((campaign, cIndex) => {
        campaign.goalTypes.forEach((goalType, gtIndex) => {
          const goalTypeColor = goalTypeColors[gtIndex % goalTypeColors.length];
          const yPos = 10 + (cIndex * campaign.goalTypes.length + gtIndex) * 20;
          
          // Goal marker
          goalIndicatorGroup.append('rect')
            .attr('x', 0)
            .attr('y', yPos - 6)
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', goalTypeColor)
            .attr('opacity', 0.7);
          
          // Goal label
          goalIndicatorGroup.append('text')
            .attr('x', 18)
            .attr('y', yPos)
            .attr('dy', '0.35em')
            .style('font-size', '10px')
            .style('fill', '#666')
            .text(`${goalType.name}: ${goalType.totalTarget}`)
            .append('title')
            .text(`Goal: ${goalType.totalTarget} ${goalType.unit}\n(Above visible range)`);
        });
      });
      
      // Add arrow indicator at top
      goalIndicatorGroup.append('text')
        .attr('x', -5)
        .attr('y', -10)
        .style('font-size', '14px')
        .style('fill', '#ff6b35')
        .text('↑ Goals');
    }

    // Only draw regular campaign lines and points if no parent campaigns are selected
    if (!hasSelectedCampaigns) {
    // Line generator
    const line = d3.line<CampaignEvent>()
      .x(d => xScale(new Date(d.date)))
      .y(d => yScale(d.goal))
      .curve(d3.curveLinear);

    // Add lines for each campaign
    campaignData.forEach(({ campaign, actions }) => {
      if (actions.length > 1) {
        g.append('path')
          .datum(actions)
          .attr('fill', 'none')
          .attr('stroke', colorScale(campaign))
          .attr('stroke-width', 2)
          .attr('d', line);
      }
    });

    // Add points for each filtered action
    filteredActions.forEach(action => {
      const x = xScale(new Date(action.date));
      const y = yScale(action.goal);
      const actionId = `${action.campaign}-${action.date}-${action.goal}`;
      const isHovered = hoveredAction === actionId;
      
      g.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', isHovered ? 8 : 4)
        .attr('fill', colorScale(action.campaign))
        .attr('stroke', isHovered ? '#ff6b35' : 'white')
        .attr('stroke-width', isHovered ? 3 : 2)
        .style('cursor', 'pointer')
        .style('filter', isHovered ? 'drop-shadow(0px 0px 8px rgba(255, 107, 53, 0.6))' : 'none')
        .style('transition', 'all 0.2s ease')
        .on('mouseenter', function() {
          setHoveredAction(actionId);
        })
        .on('mouseleave', function() {
          setHoveredAction(null);
        })
        .on('click', function(event) {
          event.stopPropagation();
          if (onActionClick) {
            onActionClick(action);
          }
          
          // Zoom to this specific action
          const actionDate = new Date(action.date);
          const timePadding = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
          const goalPadding = Math.max(action.goal * 0.3, 10);
          
          setZoomExtent({
            dateRange: [new Date(actionDate.getTime() - timePadding), new Date(actionDate.getTime() + timePadding)],
            goalRange: [Math.max(0, action.goal - goalPadding), action.goal + goalPadding]
          });
        })
        .append('title')
        .text(`${action.campaign}\n${action.purpose}\nGoal: ${action.goal}\nChapter: ${action.chapter}\nDate: ${new Date(action.date).toLocaleDateString()}\n\nClick to zoom in\n${(zoomExtent || selectedCampaign) ? 'Click background or press Escape to reset zoom' : ''}`);
    });
    }

    // Add parent campaign milestones and aggregation lines for all selected campaigns
    if (hasSelectedCampaigns) {
      const selectedCampaignObjs = parentCampaigns.filter(pc => selectedParentCampaigns.includes(pc.id));
      
      // Define colors for different goal types (used for milestones)
      const goalTypeColors = ['#2196f3', '#9c27b0', '#ff9800', '#4caf50', '#f44336'];

      selectedCampaignObjs.forEach((parentCampaign, campaignIndex) => {
      
      // Filter actions related to this parent campaign
      const relatedActions = filteredActions.filter(action => action.parentCampaignId === parentCampaign.id);
      
      // Draw campaign timeline background
      const campaignStartX = xScale(new Date(parentCampaign.startDate));
      const campaignEndX = xScale(new Date(parentCampaign.endDate));
      
      g.append('rect')
        .attr('x', campaignStartX)
        .attr('y', 0)
        .attr('width', campaignEndX - campaignStartX)
        .attr('height', innerHeight)
        .attr('fill', '#e3f2fd')
        .attr('opacity', 0.3);
      
      // Add campaign start/end labels
      g.append('text')
        .attr('x', campaignStartX + 5)
        .attr('y', 15)
        .style('font-size', '11px')
        .style('fill', '#1976d2')
        .style('font-weight', 'bold')
        .text('Campaign Start');
      
      g.append('text')
        .attr('x', campaignEndX - 5)
        .attr('y', 15)
        .attr('text-anchor', 'end')
        .style('font-size', '11px')
        .style('fill', '#1976d2')
        .style('font-weight', 'bold')
        .text('Campaign End');
        
      // Group by goal type, chapter, and date for chapter-colored progress lines
      const aggregatedByChapterAndGoalType = new Map<string, Map<string, Array<{date: string, goal: number, chapter: string, purpose: string}>>>();
      
      relatedActions.forEach(action => {
        if (action.goalType) {
          const key = `${action.chapter}-${action.goalType}`;
          if (!aggregatedByChapterAndGoalType.has(key)) {
            aggregatedByChapterAndGoalType.set(key, new Map());
          }
          const dateMap = aggregatedByChapterAndGoalType.get(key)!;
          const dateKey = action.date;
          if (!dateMap.has(dateKey)) {
            dateMap.set(dateKey, []);
          }
          dateMap.get(dateKey)!.push({
            date: action.date,
            goal: action.goal,
            chapter: action.chapter,
            purpose: action.purpose
          });
        }
      });

      // Draw progress lines for each chapter-goal type combination (filtered by selection)
      // When no goal types selected, hide all goal lines; when some selected, show only those
      Array.from(aggregatedByChapterAndGoalType.entries()).forEach(([key, dateMap]) => {
        const lastDash = key.lastIndexOf('-');
        const chapter = lastDash >= 0 ? key.slice(0, lastDash) : key;
        const goalTypeId = lastDash >= 0 ? key.slice(lastDash + 1) : '';
        const goalType = parentCampaign.goalTypes.find(gt => gt.id === goalTypeId);
        
        if (!goalType || !selectedGoalTypes.includes(goalType.id)) {
          return;
        }

        const chapterColor = getChapterColor(chapter);
        
        if (dateMap && dateMap.size > 0) {
          // Convert to array and sort by date
          const aggregatedData = Array.from(dateMap.entries())
            .flatMap(([date, actions]) => actions)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          // Create cumulative sum
          let cumulative = 0;
          const cumulativeData = aggregatedData.map(d => {
            cumulative += d.goal;
            return { ...d, cumulative };
          });

          // Draw line for progress
          if (cumulativeData.length > 1) {
            const progressLine = d3.line<typeof cumulativeData[0]>()
              .x(d => xScale(new Date(d.date)))
              .y(d => yScale(d.cumulative))
              .curve(d3.curveMonotoneX);

            g.append('path')
              .datum(cumulativeData)
              .attr('fill', 'none')
              .attr('stroke', chapterColor)
              .attr('stroke-width', 3)
              .attr('d', progressLine)
              .style('opacity', 0.8);
          }

          // Draw points for each action
          cumulativeData.forEach((d, i) => {
            const isLatest = i === cumulativeData.length - 1;
            
            g.append('circle')
              .attr('cx', xScale(new Date(d.date)))
              .attr('cy', yScale(d.cumulative))
              .attr('r', isLatest ? 7 : 5)
              .attr('fill', chapterColor)
              .attr('stroke', 'white')
              .attr('stroke-width', 2)
              .style('filter', isLatest ? 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))' : 'none')
              .style('cursor', 'pointer')
              .on('mouseenter', function() {
                d3.select(this).attr('r', isLatest ? 9 : 7);
              })
              .on('mouseleave', function() {
                d3.select(this).attr('r', isLatest ? 7 : 5);
              })
              .append('title')
              .text(`${chapter} - ${goalType.name}\nAction: ${d.purpose}\nThis Action: ${d.goal}\nCumulative: ${d.cumulative} / ${goalType.totalTarget}\nProgress: ${Math.round((d.cumulative / goalType.totalTarget) * 100)}%\nDate: ${new Date(d.date).toLocaleDateString()}`);
          });

          // Add goal target dot at the end of campaign
          const lastData = cumulativeData.length > 0 ? cumulativeData[cumulativeData.length - 1] : null;
          const endDate = new Date(parentCampaign.endDate);
          
          g.append('circle')
            .attr('cx', xScale(endDate))
            .attr('cy', yScale(goalType.totalTarget))
            .attr('r', 10)
            .attr('fill', 'none')
            .attr('stroke', chapterColor)
            .attr('stroke-width', 3)
            .style('cursor', 'pointer')
            .on('mouseenter', function() {
              d3.select(this).attr('r', 12).attr('stroke-width', 4);
            })
            .on('mouseleave', function() {
              d3.select(this).attr('r', 10).attr('stroke-width', 3);
            })
            .append('title')
            .text(lastData 
              ? `${chapter} Goal\n${goalType.name}: ${goalType.totalTarget} ${goalType.unit}\nCurrent: ${lastData.cumulative}\nRemaining: ${goalType.totalTarget - lastData.cumulative}`
              : `${chapter} Goal\n${goalType.name}: ${goalType.totalTarget} ${goalType.unit}\nNo progress yet`
            );
        }
      });

      // Draw goal target dots for all goal types (even those without actions yet); respect filter
      const endDate = new Date(parentCampaign.endDate);
      parentCampaign.goalTypes
        .filter(goalType => selectedGoalTypes.includes(goalType.id))
        .forEach((goalType) => {
          // Check if this goal type has any chapter actions
          const hasActions = Array.from(aggregatedByChapterAndGoalType.keys())
            .some(key => key.endsWith(`-${goalType.id}`));
          
          // If no actions, draw a goal dot for the organization as a whole
          if (!hasActions) {
            const orgColor = '#6c757d'; // Gray for organization-wide goals without chapter breakdown
            
            g.append('circle')
              .attr('cx', xScale(endDate))
              .attr('cy', yScale(goalType.totalTarget))
              .attr('r', 10)
              .attr('fill', 'none')
              .attr('stroke', orgColor)
              .attr('stroke-width', 3)
              .style('cursor', 'pointer')
              .on('mouseenter', function() {
                d3.select(this).attr('r', 12).attr('stroke-width', 4);
              })
              .on('mouseleave', function() {
                d3.select(this).attr('r', 10).attr('stroke-width', 3);
              })
              .append('title')
              .text(`Organization Goal\n${goalType.name}: ${goalType.totalTarget} ${goalType.unit}\nNo chapter actions yet`);
          }
        });
      
      // Draw milestones (cleaner design without vertical lines)
      parentCampaign.milestones.forEach((milestone, mIndex) => {
        const milestoneDate = new Date(milestone.date);
        
        if (milestoneDate >= dateExtent[0] && milestoneDate <= dateExtent[1]) {
          const x = xScale(milestoneDate);

          // Get all goal types that have targets for this milestone; respect filter
          const goalTypesWithTargets = parentCampaign.goalTypes
            .filter(goalType => selectedGoalTypes.includes(goalType.id))
            .filter(goalType => milestone.goalTypeTargets[goalType.id]);

          // Draw milestone markers for each goal type
          goalTypesWithTargets.forEach((goalType, gtIndex) => {
            const target = milestone.goalTypeTargets[goalType.id];
            const goalTypeColor = goalTypeColors[gtIndex % goalTypeColors.length];
            
            if (target) {
              const y = yScale(target);
              
              // Add slight horizontal offset if multiple goal types exist at same milestone
              // This prevents overlapping when values are close
              const horizontalOffset = goalTypesWithTargets.length > 1 ? (gtIndex - (goalTypesWithTargets.length - 1) / 2) * 15 : 0;
              const adjustedX = x + horizontalOffset;

              // Milestone marker - diamond shape for distinction
              const markerSize = 8;
              const diamondPath = `M ${adjustedX},${y - markerSize} L ${adjustedX + markerSize},${y} L ${adjustedX},${y + markerSize} L ${adjustedX - markerSize},${y} Z`;
              
              g.append('path')
                .attr('d', diamondPath)
                .attr('fill', goalTypeColor)
                .attr('stroke', '#ff9800')
                .attr('stroke-width', 2)
                .style('cursor', 'pointer')
                .style('filter', 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))')
                .on('mouseenter', function() {
                  d3.select(this).attr('stroke-width', 3);
                  // Show milestone label on hover
                  g.append('text')
                    .attr('class', 'milestone-hover-label')
                    .attr('x', adjustedX)
                    .attr('y', y - markerSize - 8)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '11px')
                    .style('fill', '#ff9800')
                    .style('font-weight', 'bold')
                    .style('pointer-events', 'none')
                    .text(`${milestone.description} - ${goalType.name}`);
                })
                .on('mouseleave', function() {
                  d3.select(this).attr('stroke-width', 2);
                  // Remove hover label
                  g.selectAll('.milestone-hover-label').remove();
                })
                .append('title')
                .text(`Milestone: ${milestone.description}\n${goalType.name} Target: ${target}\nDate: ${milestoneDate.toLocaleDateString()}`);
            }
          });
        }
      });

      // Goal target lines are now replaced by goal dots at the end of each progress line
      
      }); // End of selectedCampaignObjs.forEach

      // Add "You Are Here" indicator at current date
      const today = new Date();
      if (today >= dateExtent[0] && today <= dateExtent[1]) {
        const todayX = xScale(today);
        
        // Vertical dashed line
        g.append('line')
          .attr('x1', todayX)
          .attr('x2', todayX)
          .attr('y1', 0)
          .attr('y2', innerHeight)
          .style('stroke', '#28a745')
          .style('stroke-width', 2)
          .style('stroke-dasharray', '5,5')
          .style('opacity', 0.7);
        
        // Circle at the top
        g.append('circle')
          .attr('cx', todayX)
          .attr('cy', -15)
          .attr('r', 8)
          .attr('fill', '#28a745')
          .attr('stroke', 'white')
          .attr('stroke-width', 2)
          .style('filter', 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))');
        
        // "You Are Here" label
        g.append('text')
          .attr('x', todayX)
          .attr('y', -30)
          .attr('text-anchor', 'middle')
          .style('font-size', '12px')
          .style('font-weight', 'bold')
          .style('fill', '#28a745')
          .text('You Are Here');
        
        // Date label below
        g.append('text')
          .attr('x', todayX)
          .attr('y', innerHeight + 35)
          .attr('text-anchor', 'middle')
          .style('font-size', '10px')
          .style('fill', '#28a745')
          .style('font-weight', 'bold')
          .text(today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      }
    }

    // Only show data-source lines when their goal type is selected
    const selectedCampaignObjsForFilter = parentCampaigns.filter(pc => selectedParentCampaigns.includes(pc.id));
    const showPledgeLine = false; // Pledges removed from campaign progress view
    const showMembershipLine = selectedGoalTypes.length > 0 && selectedCampaignObjsForFilter.some(pc =>
      pc.goalTypes.some(gt => selectedGoalTypes.includes(gt.id) && goalTypeDataSource(gt) === 'meetings_membership')
    );
    const showLeadershipLine = selectedGoalTypes.length > 0 && selectedCampaignObjsForFilter.some(pc =>
      pc.goalTypes.some(gt => selectedGoalTypes.includes(gt.id) && goalTypeDataSource(gt) === 'meetings_leadership')
    );

    // Add "Membership One-on-One" line from meetings data (only when that goal type is selected)
    if (meetingsData && meetingsData.length > 0 && hasSelectedCampaigns && showMembershipLine) {
      // Get selected campaign chapters for filtering (case-insensitive)
      const selectedCampaignChapters = selectedParentCampaigns
        .map(id => parentCampaigns.find(c => c.id === id))
        .filter(Boolean)
        .flatMap(c => c!.chapters)
        .map(ch => ch.toLowerCase().trim());
      const isAllChapters = selectedCampaignChapters.includes('all chapters');
      
      // Debug: Log unique chapters in meetings data
      const uniqueMeetingChapters = Array.from(new Set(meetingsData.map(m => m.chapter || 'undefined')));
      
      // Filter for Membership One-on-One meetings by meeting_type and chapter
      const membershipMeetings = meetingsData.filter(m => {
        const meetingType = (m.meeting_type || '').toLowerCase().trim();
        const isMembershipType = meetingType.includes('membership') && meetingType.includes('one-on-one');
        
        // If "All Chapters" is selected, don't filter by chapter
        if (isAllChapters) return isMembershipType;
        
        // Otherwise, filter by selected chapters (case-insensitive, partial match)
        const meetingChapter = (m.chapter || '').toLowerCase().trim();
        return isMembershipType && selectedCampaignChapters.some(ch => 
          meetingChapter.includes(ch) || ch.includes(meetingChapter)
        );
      });
      
      // Filter meetings within the campaign date range and sort by date
      const sortedMeetings = [...membershipMeetings]
        .filter(m => {
          const dateStr = typeof m.datestamp === 'object' ? m.datestamp?.value : m.datestamp;
          if (!dateStr) return false;
          const meetingDate = new Date(dateStr);
          return meetingDate >= dateExtent[0] && meetingDate <= dateExtent[1];
        })
        .sort((a, b) => {
          const dateA = typeof a.datestamp === 'object' ? a.datestamp?.value : a.datestamp;
          const dateB = typeof b.datestamp === 'object' ? b.datestamp?.value : b.datestamp;
          return new Date(dateA || '').getTime() - new Date(dateB || '').getTime();
        });

      if (sortedMeetings.length > 0) {
        // Calculate cumulative totals by date
        let cumulative = 0;
        const cumulativeData = sortedMeetings.map(meeting => {
          cumulative += 1;
          const dateStr = typeof meeting.datestamp === 'object' ? meeting.datestamp?.value : meeting.datestamp;
          return {
            date: new Date(dateStr || ''),
            value: cumulative,
            chapter: meeting.chapter
          };
        });

        // Aggregate by date for cleaner visualization
        const dailyData = new Map<string, { date: Date; value: number; count: number }>();
        cumulativeData.forEach(d => {
          const dateKey = d.date.toISOString().split('T')[0];
          dailyData.set(dateKey, {
            date: d.date,
            value: d.value,
            count: (dailyData.get(dateKey)?.count || 0) + 1
          });
        });
        const aggregatedData = Array.from(dailyData.values());

        if (aggregatedData.length > 0) {
          // Define the membership line style - solid purple line
          const membershipColor = '#7b1fa2'; // Purple color for membership
          
          // Draw the membership line
          if (aggregatedData.length > 1) {
            const membershipLine = d3.line<typeof aggregatedData[0]>()
              .x(d => xScale(d.date))
              .y(d => yScale(d.value))
              .curve(d3.curveMonotoneX);

            g.append('path')
              .datum(aggregatedData)
              .attr('fill', 'none')
              .attr('stroke', membershipColor)
              .attr('stroke-width', 3)
              .attr('stroke-dasharray', '4,4') // Different dash pattern
              .attr('d', membershipLine)
              .style('opacity', 0.9);
          }

          // Draw points for milestones (every 50 or at the end)
          aggregatedData.forEach((d, i) => {
            const isLatest = i === aggregatedData.length - 1;
            const isMilestone = d.value % 50 === 0 || isLatest;
            
            if (isMilestone || aggregatedData.length < 20) {
              g.append('circle')
                .attr('cx', xScale(d.date))
                .attr('cy', yScale(d.value))
                .attr('r', isLatest ? 8 : 4)
                .attr('fill', membershipColor)
                .attr('stroke', 'white')
                .attr('stroke-width', 2)
                .style('filter', isLatest ? 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))' : 'none')
                .style('cursor', 'pointer')
                .on('mouseenter', function() {
                  d3.select(this).attr('r', isLatest ? 10 : 6);
                })
                .on('mouseleave', function() {
                  d3.select(this).attr('r', isLatest ? 8 : 4);
                })
                .append('title')
                .text(`Membership One-on-One\nCumulative Total: ${d.value}\nDate: ${d.date.toLocaleDateString()}`);
            }
          });

        }
      }
    }

    // Add "Leadership Development One-on-One" line from meetings data (only when that goal type is selected)
    if (meetingsData && meetingsData.length > 0 && hasSelectedCampaigns && showLeadershipLine) {
      // Get selected campaign chapters for filtering (case-insensitive)
      const selectedCampaignChapters = selectedParentCampaigns
        .map(id => parentCampaigns.find(c => c.id === id))
        .filter(Boolean)
        .flatMap(c => c!.chapters)
        .map(ch => ch.toLowerCase().trim());
      const isAllChapters = selectedCampaignChapters.includes('all chapters');
      
      // Filter for Leadership Development One-on-One meetings by meeting_type and chapter
      const leadershipMeetings = meetingsData.filter(m => {
        const meetingType = (m.meeting_type || '').toLowerCase().trim();
        const isLeadershipType = meetingType.includes('leadership') && meetingType.includes('one-on-one');
        
        // If "All Chapters" is selected, don't filter by chapter
        if (isAllChapters) return isLeadershipType;
        
        // Otherwise, filter by selected chapters (case-insensitive, partial match)
        const meetingChapter = (m.chapter || '').toLowerCase().trim();
        return isLeadershipType && selectedCampaignChapters.some(ch => 
          meetingChapter.includes(ch) || ch.includes(meetingChapter)
        );
      });
      
      // Filter meetings within the campaign date range and sort by date
      const sortedLeadershipMeetings = [...leadershipMeetings]
        .filter(m => {
          const dateStr = typeof m.datestamp === 'object' ? m.datestamp?.value : m.datestamp;
          if (!dateStr) return false;
          const meetingDate = new Date(dateStr);
          return meetingDate >= dateExtent[0] && meetingDate <= dateExtent[1];
        })
        .sort((a, b) => {
          const dateA = typeof a.datestamp === 'object' ? a.datestamp?.value : a.datestamp;
          const dateB = typeof b.datestamp === 'object' ? b.datestamp?.value : b.datestamp;
          return new Date(dateA || '').getTime() - new Date(dateB || '').getTime();
        });

      if (sortedLeadershipMeetings.length > 0) {
        // Calculate cumulative totals by date
        let cumulative = 0;
        const cumulativeData = sortedLeadershipMeetings.map(meeting => {
          cumulative += 1;
          const dateStr = typeof meeting.datestamp === 'object' ? meeting.datestamp?.value : meeting.datestamp;
          return {
            date: new Date(dateStr || ''),
            value: cumulative,
            chapter: meeting.chapter
          };
        });

        // Aggregate by date for cleaner visualization
        const dailyData = new Map<string, { date: Date; value: number; count: number }>();
        cumulativeData.forEach(d => {
          const dateKey = d.date.toISOString().split('T')[0];
          dailyData.set(dateKey, {
            date: d.date,
            value: d.value,
            count: (dailyData.get(dateKey)?.count || 0) + 1
          });
        });
        const aggregatedLeadershipData = Array.from(dailyData.values());

        if (aggregatedLeadershipData.length > 0) {
          // Define the leadership line style - solid orange line
          const leadershipColor = '#e65100'; // Deep orange for leadership
          
          // Draw the leadership line
          if (aggregatedLeadershipData.length > 1) {
            const leadershipLine = d3.line<typeof aggregatedLeadershipData[0]>()
              .x(d => xScale(d.date))
              .y(d => yScale(d.value))
              .curve(d3.curveMonotoneX);

            g.append('path')
              .datum(aggregatedLeadershipData)
              .attr('fill', 'none')
              .attr('stroke', leadershipColor)
              .attr('stroke-width', 3)
              .attr('stroke-dasharray', '12,4') // Longer dash for leadership
              .attr('d', leadershipLine)
              .style('opacity', 0.9);
          }

          // Draw points for milestones (every 25 or at the end)
          aggregatedLeadershipData.forEach((d, i) => {
            const isLatest = i === aggregatedLeadershipData.length - 1;
            const isMilestone = d.value % 25 === 0 || isLatest;
            
            if (isMilestone || aggregatedLeadershipData.length < 15) {
              g.append('circle')
                .attr('cx', xScale(d.date))
                .attr('cy', yScale(d.value))
                .attr('r', isLatest ? 8 : 4)
                .attr('fill', leadershipColor)
                .attr('stroke', 'white')
                .attr('stroke-width', 2)
                .style('filter', isLatest ? 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))' : 'none')
                .style('cursor', 'pointer')
                .on('mouseenter', function() {
                  d3.select(this).attr('r', isLatest ? 10 : 6);
                })
                .on('mouseleave', function() {
                  d3.select(this).attr('r', isLatest ? 8 : 4);
                })
                .append('title')
                .text(`Leadership Development One-on-One\nCumulative Total: ${d.value}\nDate: ${d.date.toLocaleDateString()}`);
            }
          });

        }
      }
    }

  }, [actions, width, containerWidth, selectedChapter, selectedCampaign, zoomExtent, hoveredAction, parentCampaigns, selectedParentCampaigns, selectedGoalTypes, pledgeSubmissions, meetingsData, showOnlyBarometer]);

  // Add keyboard support for Escape key to reset zoom
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (zoomExtent || selectedCampaign)) {
        handleResetZoom();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [zoomExtent, selectedCampaign, handleResetZoom]);

  // Filter actions for the empty state check
  const filteredActionsForCheck = selectedChapter === 'All Chapters' 
    ? actions 
    : actions.filter(action => action.chapter === selectedChapter);

  // Don't show empty state if parent campaigns are selected (it will show the campaign structure)
  if (filteredActionsForCheck.length === 0 && selectedParentCampaigns.length === 0) {
    return (
      <Box sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        color: 'text.secondary',
        p: 4
      }}>
        <Typography variant="h5" gutterBottom>
          Campaign Progress Timeline
        </Typography>
        <Typography variant="body1" sx={{ textAlign: 'center', mb: 2 }}>
          {selectedChapter === 'All Chapters' 
            ? 'Add campaign actions to see your progress over time'
            : `No campaign actions for ${selectedChapter}. Add actions to see progress over time.`
          }
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Each campaign will appear as a separate line with connected goals
        </Typography>
      </Box>
    );
  }

  const allGoalTypes = selectedCampaignObjs.flatMap(c => c.goalTypes);
  const uniqueGoalTypes = Array.from(new Map(allGoalTypes.map(gt => [gt.id, gt])).values());

  const handleGoalTypeChange = (event: any) => {
    const value = event.target.value;
    setSelectedGoalTypes(typeof value === 'string' ? value.split(',') : value);
  };

  const hasActuals = false;
  const actualsMax = 0;

  // Barometer: current and target per goal type (for filtered goal types)
  const filteredGoalTypesForBarometer = selectedGoalTypes.length > 0
    ? uniqueGoalTypes.filter(gt => selectedGoalTypes.includes(gt.id))
    : uniqueGoalTypes;
  const getCurrentForGoalType = (gt: CampaignGoalType): number => {
    const ds = goalTypeDataSource(gt);
    if (ds === 'meetings_membership') {
      return (meetingsData || []).filter(m => {
        const t = (m.meeting_type || '').toLowerCase();
        return t.includes('membership') && t.includes('one-on-one');
      }).length;
    }
    if (ds === 'meetings_leadership') {
      return (meetingsData || []).filter(m => {
        const t = (m.meeting_type || '').toLowerCase();
        return t.includes('leadership') && t.includes('one-on-one');
      }).length;
    }
    const filteredActionsForBarometer = selectedChapter === 'All Chapters' ? actions : actions.filter(a => a.chapter === selectedChapter);
    return filteredActionsForBarometer
      .filter(a => a.parentCampaignId && selectedParentCampaigns.includes(a.parentCampaignId) && a.goalType === gt.id)
      .reduce((s, a) => s + a.goal, 0);
  };
  const getTargetForGoalType = (gt: CampaignGoalType): number => {
    const campaignsWithGoal = selectedCampaignObjs.filter(pc => pc.goalTypes.some(g => g.id === gt.id));
    if (campaignsWithGoal.length === 0) return gt.totalTarget;
    return Math.max(...campaignsWithGoal.map(pc => pc.goalTypes.find(g => g.id === gt.id)!.totalTarget));
  };
  const barometerRows = selectedCampaignObjs.length > 0 ? filteredGoalTypesForBarometer.map(gt => ({
    goalType: gt,
    current: getCurrentForGoalType(gt),
    target: getTargetForGoalType(gt)
  })) : [];

  return (
    <Paper ref={containerRef} sx={{ p: 2, width: '100%', height: '100%', overflow: 'hidden', bgcolor: 'transparent', boxShadow: 'none', display: 'flex', flexDirection: 'column' }}>
      
      {selectedCampaignObjs.length > 0 ? (
        <>
          {/* Timeline Graph - takes full height when barometer is hidden */}
          {!showOnlyBarometer && (
            <Box sx={{ 
              height: '100%',
              flex: 1,
              width: '100%',
              minHeight: 0
            }}>
              <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="xMinYMin meet"
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block'
                }}
              />
                </Box>
          )}

          {/* Barometer View - Only show when on barometer tab */}
          {showOnlyBarometer && (
          <>
          {/* Barometer View - Compact Controls */}
          <Box sx={{ mb: 2, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
              <Typography variant="h6" fontWeight="bold" color="primary">
                Campaign Progress
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {/* View Dropdown */}
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>View By</InputLabel>
            <Select
                    value={barometerView}
                    onChange={(e) => setBarometerView(e.target.value as any)}
                    label="View By"
                  >
                    <MenuItem value="federation">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PublicIcon fontSize="small" />
                        Full Class
                      </Box>
              </MenuItem>
                    <MenuItem value="chapters">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BusinessIcon fontSize="small" />
                        By Section
                      </Box>
                    </MenuItem>
                    <MenuItem value="teams">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <GroupsIcon fontSize="small" />
                        By Team
                      </Box>
                </MenuItem>
                    <MenuItem value="people">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonIcon fontSize="small" />
                        By Person
                      </Box>
                    </MenuItem>
                    <MenuItem value="leadership">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <GroupsIcon fontSize="small" />
                        By Leadership
                      </Box>
                    </MenuItem>
            </Select>
          </FormControl>

                {/* Action Dropdown - Multiple Select */}
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Action</InputLabel>
                  <Select
                    multiple
                    value={barometerGoalTypeFilters}
                    onChange={(e) => setBarometerGoalTypeFilters(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                    label="Action"
                    renderValue={(selected) => `${(selected as string[]).length} selected`}
                  >
                    {availableMetrics.map(metric => (
                      <MenuItem key={metric.value} value={metric.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <input 
                            type="checkbox" 
                            checked={barometerGoalTypeFilters.includes(metric.value)}
                            readOnly
                          />
                          {metric.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* 3-way display toggle — visible for all views */}
                <ToggleButtonGroup
                  value={displayMode}
                  exclusive
                  onChange={(_e, val) => { if (val !== null) setDisplayMode(val); }}
                  size="small"
                  sx={{ height: 40 }}
                >
                  <ToggleButton value="nothing" sx={{ fontSize: '0.65rem', px: 1.5, textTransform: 'none' }}>
                    None
                  </ToggleButton>
                  <ToggleButton value="conversions" sx={{ fontSize: '0.65rem', px: 1.5, textTransform: 'none' }}>
                    Conversions
                  </ToggleButton>
                  <ToggleButton value="counts" sx={{ fontSize: '0.65rem', px: 1.5, textTransform: 'none' }}>
                    Counts
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Box>
          </Box>

          {/* Detailed Barometer Content */}
          <Box sx={{ width: '100%', flex: 1, overflow: 'auto' }}>
            {/* For table views (people/leadership), show single table with all action columns */}
            {(barometerView === 'people' || barometerView === 'leadership') ? (
              <>
                {barometerView === 'people' && (() => {
                  // Use the unified action IDs from selected metrics
                  const unifiedActionIds = barometerGoalTypeFilters.map(metricValue => 
                    metricValue.startsWith('action_') ? metricValue.replace('action_', '') : metricValue
                  );
                  
                  // Get ACTIONS array based on selected metrics
                  const actionsForTable = unifiedActionIds.map(actionId => {
                    // First try to find the full action from the actions database
                    const fullAction: any = actionsFromDB.find((a: any) => a.action_id === actionId);
                    if (fullAction && fullAction.action_id) {
                      return {
                        id: actionId,
                        name: fullAction.action_name || fullAction.name || actionId,
                        has_goal: fullAction.has_goal !== false,
                        fields: fullAction.fields || [] // Include fields for conversion tracking
                      };
                    }
                    // Fallback to metric
                    const metric = availableMetrics.find(m => 
                      m.value === actionId || m.value === `action_${actionId}`
                    );
                    return {
                      id: actionId,
                      name: metric?.label || actionId,
                      has_goal: true // Default to true for metrics
                    };
                  });
                  
                  if (leadersForTable.allLeaders.length === 0) {
                    return (
                      <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
                        No data available for the selected metrics.
                      </Typography>
                    );
                  }
                  
                  return (
                    <LeaderMetricsTable
                      leaders={leadersForTable.allLeaders}
                      leaderActionsMap={leadersForTable.leaderActionsMap}
                      leaderGoalsMap={leadersForTable.leaderGoalsMap}
                      unifiedActionIds={unifiedActionIds}
                      ACTIONS={actionsForTable}
                      availableActions={actionsFromDB}
                      pledgeSubmissions={pledgeSubmissions}
                      peopleRecords={Array.from(userMap.values())}
                      listsData={listsData}
                      showSummary={true}
                      flatView={true}
                      onFilterByOrganizer={onFilterByOrganizer}
                      onEditOrganizerMapping={onEditOrganizerMapping}
                      displayMode={displayMode}
                      onDisplayModeChange={setDisplayMode}
                      hideDisplayToggle={true}
                      initialSortColumn={barometerSortProp || 'total'}
                      initialSortDirection={barometerSortDirProp}
                      onSortChange={onBarometerSortChange}
                      parentCampaigns={parentCampaigns}
                      useCampaignGoals={false}
                      selectedChapter={selectedChapter}
                      teamsData={teamsData}
                    />
                  );
                })()}
                
                {barometerView === 'leadership' && (() => {
                  // Use the unified action IDs from selected metrics
                  const unifiedActionIds = barometerGoalTypeFilters.map(metricValue => 
                    metricValue.startsWith('action_') ? metricValue.replace('action_', '') : metricValue
                  );
                  
                  // Get ACTIONS array based on selected metrics
                  const actionsForTable = unifiedActionIds.map(actionId => {
                    // First try to find the full action from the actions database
                    const fullAction: any = actionsFromDB.find((a: any) => a.action_id === actionId);
                    if (fullAction && fullAction.action_id) {
                      return {
                        id: actionId,
                        name: fullAction.action_name || fullAction.name || actionId,
                        has_goal: fullAction.has_goal !== false,
                        fields: fullAction.fields || [] // Include fields for conversion tracking
                      };
                    }
                    // Fallback to metric
                    const metric = availableMetrics.find(m => 
                      m.value === actionId || m.value === `action_${actionId}`
                    );
                    return {
                      id: actionId,
                      name: metric?.label || actionId,
                      has_goal: true // Default to true for metrics
                    };
                  });
                  
                  // For Leadership view: use topLeadersWithOthers to include:
                  // 1. Core team members with their sub-leaders properly nested (e.g., Springer under Courtney)
                  // 2. Individual "others" (people not in hierarchy, like unmatched names) flat at top level
                  // The hierarchy structure from step 1 should be fully preserved
                  const leadersToDisplay = leadersForTable.topLeadersWithOthers || leadersForTable.leaders;
                  
                  if (leadersToDisplay.length === 0) {
                    return (
                      <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
                        No data available for the selected metrics.
                      </Typography>
                    );
                  }
                  
                  return (
                    <LeaderMetricsTable
                      leaders={leadersToDisplay}
                      leaderActionsMap={leadersForTable.leaderActionsMap}
                      leaderGoalsMap={leadersForTable.leaderGoalsMap}
                      unifiedActionIds={unifiedActionIds}
                      ACTIONS={actionsForTable}
                      availableActions={actionsFromDB}
                      pledgeSubmissions={pledgeSubmissions}
                      peopleRecords={Array.from(userMap.values())}
                      listsData={listsData}
                      showSummary={true}
                      onFilterByOrganizer={onFilterByOrganizer}
                      onEditOrganizerMapping={onEditOrganizerMapping}
                      displayMode={displayMode}
                      onDisplayModeChange={setDisplayMode}
                      hideDisplayToggle={true}
                      initialSortColumn={barometerSortProp || 'total'}
                      initialSortDirection={barometerSortDirProp}
                      onSortChange={onBarometerSortChange}
                      parentCampaigns={parentCampaigns}
                      useCampaignGoals={false}
                      selectedChapter={selectedChapter}
                      teamsData={teamsData}
                    />
                  );
                })()}
              </>
            ) : barometerView === 'teams' ? (
              /* ── By Team view ── */
              <>
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {barometerGoalTypeFilters.map((currentMetricFilter) => {
                const isCustomMetric = currentMetricFilter.startsWith('action_');
                const customActionId = isCustomMetric ? currentMetricFilter.replace('action_', '') : null;
                const metricLabel = (() => {
                  if (currentMetricFilter === 'meetings_membership') return 'Member 1:1s';
                  if (currentMetricFilter === 'meetings_leadership') return 'Leader 1:1s';
                  const m = availableMetrics.find(m => m.value === currentMetricFilter);
                  return m?.label || currentMetricFilter;
                })();

                // For each team, aggregate progress from its members
                const actionDef = customActionId ? (actionsFromDB || []).find((a: any) => a.action_id === customActionId) : null;
                const actionFields: Array<{ key: string; label: string }> = (actionDef?.fields || []).filter((f: any) => f.type === 'boolean' || !f.type);
                const goalFieldKey: string | null = actionDef?.goal_field_key || null;

                const teamLeaderboard = (teamsData || [])
                  .filter((team: any) => team.isActive !== false)
                  .map((team: any) => {
                    const memberVanIds = new Set<string>();
                    (team.organizers || []).forEach((o: any) => { const vid = o.id || o.vanId; if (vid) memberVanIds.add(vid.toString()); });
                    if (team.lead?.id) memberVanIds.add(team.lead.id.toString());
                    (team.bigQueryData?.teamMembersWithRoles || []).forEach((m: any) => { if (m.id) memberVanIds.add(m.id.toString()); });

                    let count = 0;
                    let namedCount = 0;
                    const fieldCounts: Record<string, number> = {};
                    actionFields.forEach((f: any) => { fieldCounts[f.key] = 0; });

                    if (isCustomMetric && customActionId) {
                      const namedPeople = new Set<string>();
                      const goalPeople = new Set<string>();
                      const fieldPeople: Record<string, Set<string>> = {};
                      actionFields.forEach((f: any) => { fieldPeople[f.key] = new Set(); });

                      (listsData || [])
                        .filter((entry: any) => entry.action_id === customActionId && memberVanIds.has(entry.organizer_vanid?.toString()))
                        .forEach((entry: any) => {
                          const personVanId = entry.vanid?.toString();
                          if (!personVanId) return;
                          namedPeople.add(personVanId);
                          const meetsGoal = goalFieldKey
                            ? (entry.progress?.[goalFieldKey] === true || entry.fields?.[goalFieldKey] === true)
                            : true;
                          if (meetsGoal) goalPeople.add(personVanId);
                          actionFields.forEach((f: any) => {
                            if (entry.progress?.[f.key] === true || entry.fields?.[f.key] === true) fieldPeople[f.key].add(personVanId);
                          });
                        });
                      count = goalPeople.size;
                      namedCount = namedPeople.size;
                      actionFields.forEach((f: any) => { fieldCounts[f.key] = fieldPeople[f.key].size; });
                    } else if (currentMetricFilter === 'meetings_membership') {
                      count = (meetingsData || []).filter((m: any) => {
                        const t = (m.meeting_type || '').toLowerCase();
                        return t.includes('membership') && t.includes('one-on-one') && memberVanIds.has(m.organizer_vanid?.toString());
                      }).length;
                      namedCount = count;
                    } else {
                      count = (meetingsData || []).filter((m: any) => {
                        const t = (m.meeting_type || '').toLowerCase();
                        return t.includes('leadership') && t.includes('one-on-one') && memberVanIds.has(m.organizer_vanid?.toString());
                      }).length;
                      namedCount = count;
                    }

                    return { teamId: team.id, teamName: team.teamName, chapter: team.chapter, count, namedCount, fieldCounts, memberCount: memberVanIds.size };
                  })
                  .filter(t => t.memberCount > 0)
                  .sort((a, b) => b.count - a.count);

                const totalCount = teamLeaderboard.reduce((s, t) => s + t.count, 0);

                // Inline badges helper
                const renderTeamBadges = (namedCount: number, fieldCounts: Record<string, number>) => {
                  if (displayMode === 'nothing' || actionFields.length === 0) return null;
                  if (displayMode === 'conversions') {
                    const pairs: Array<{ from: string; to: string; rate: number }> = [];
                    if (actionFields.length > 0) {
                      const firstCount = fieldCounts[actionFields[0].key] ?? 0;
                      pairs.push({ from: 'Named', to: actionFields[0].label, rate: namedCount > 0 ? (firstCount / namedCount) * 100 : 0 });
                    }
                    actionFields.slice(0, -1).forEach((f: any, i: number) => {
                      const nextF = actionFields[i + 1];
                      const fromCount = fieldCounts[f.key] ?? 0;
                      const toCount = fieldCounts[nextF.key] ?? 0;
                      pairs.push({ from: f.label, to: nextF.label, rate: fromCount > 0 ? (toCount / fromCount) * 100 : 0 });
                    });
                    return (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {pairs.map(({ from, to, rate }) => (
                          <Chip key={`${from}-${to}`} size="small" label={`${from}→${to}: ${rate > 0 ? Math.round(rate) + '%' : '—'}`}
                            sx={{ fontSize: '0.6rem', height: 18, bgcolor: rate >= 50 ? '#e8f5e9' : rate >= 25 ? '#fff8e1' : '#ffebee',
                              color: rate >= 50 ? '#2e7d32' : rate >= 25 ? '#f57f17' : '#c62828' }} />
                        ))}
                      </Box>
                    );
                  } else {
                    const items = [{ label: 'Named', count: namedCount }, ...actionFields.map((f: any) => ({ label: f.label, count: fieldCounts[f.key] ?? 0 }))];
                    return (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {items.map(({ label, count: c }) => (
                          <Chip key={label} size="small" label={`${label}: ${c}`}
                            sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#f0f4ff', color: 'primary.main' }} />
                        ))}
                      </Box>
                    );
                  }
                };

                return (
                  <Box key={currentMetricFilter} sx={{
                    flex: barometerGoalTypeFilters.length === 1 ? '1' : '1 1 calc(50% - 12px)',
                    minWidth: barometerGoalTypeFilters.length > 1 ? '400px' : 'auto',
                    border: barometerGoalTypeFilters.length > 1 ? '1px solid' : 'none',
                    borderColor: 'divider',
                    borderRadius: barometerGoalTypeFilters.length > 1 ? 1 : 0,
                    p: barometerGoalTypeFilters.length > 1 ? 2 : 0,
                    display: 'flex', flexDirection: 'column', gap: 2, py: 1
                  }}>
                    {barometerGoalTypeFilters.length > 1 && (
                      <Typography variant="h6" fontWeight="bold" color="primary" sx={{ mb: 1 }}>{metricLabel}</Typography>
                    )}

                    {/* Total bar */}
                    <Box sx={{ width: '100%', mb: 2, pb: 2, borderBottom: '2px solid #1976d2' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>Total</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {totalCount} people
                        </Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={100}
                        sx={{ height: 16, borderRadius: 1, backgroundColor: '#e0e0e0', '& .MuiLinearProgress-bar': { borderRadius: 1, backgroundColor: '#1976d2' } }} />
                    </Box>

                    {/* Team rows */}
                    {teamLeaderboard.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">No team data available.</Typography>
                    ) : (
                      teamLeaderboard.map((team, idx) => {
                        const maxCount = teamLeaderboard[0].count || 1;
                        const pct = (team.count / maxCount) * 100;
                        const chapterColor = getChapterColor(team.chapter?.replace(' for All', '') || '');
                        return (
                          <Box key={team.teamId} sx={{ width: '100%' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                              <Box>
                                <Typography variant="body2" fontWeight="medium">#{idx + 1} {team.teamName}</Typography>
                                {team.chapter && (
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                    {team.chapter} · {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
                                  </Typography>
                                )}
                              </Box>
                              <Typography variant="body2" color="text.secondary">{team.count} people</Typography>
                            </Box>
                            <LinearProgress variant="determinate" value={Math.min(100, pct)}
                              sx={{ height: 10, borderRadius: 1, backgroundColor: 'action.hover',
                                '& .MuiLinearProgress-bar': { borderRadius: 1, backgroundColor: chapterColor || '#1976d2' } }} />
                            {renderTeamBadges(team.namedCount, team.fieldCounts)}
                          </Box>
                        );
                      })
                    )}
                  </Box>
                );
              })}
              </Box>
              </>
            ) : (
              /* For federation/chapters views, render multiple barometers side-by-side */
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {barometerGoalTypeFilters.map((currentMetricFilter, metricIndex) => {
              // Helper to get metric-specific label
              const getMetricLabel = (metric: string) => {
                if (metric === 'meetings_membership') return 'Member 1:1s';
                if (metric === 'meetings_leadership') return 'Leader 1:1s';
                const customMetric = availableMetrics.find(m => m.value === metric);
                return customMetric?.label || metric;
              };
              
              // Helper to check if this is a custom action metric
              const isCustomAction = (metric: string) => metric.startsWith('action_');
              
              // Helper to get action ID from metric value
              const getActionId = (metric: string) => metric.replace('action_', '');
              
              const metricLabel = getMetricLabel(currentMetricFilter);
              const isCustomMetric = isCustomAction(currentMetricFilter);
              const customActionId = isCustomMetric ? getActionId(currentMetricFilter) : null;
              
              return (
                <Box key={currentMetricFilter} sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 2, 
                  py: 1,
                  flex: barometerGoalTypeFilters.length === 1 ? '1' : '1 1 calc(50% - 12px)', // Full width if single, 50% if multiple
                  minWidth: barometerGoalTypeFilters.length > 1 ? '400px' : 'auto', // Minimum width for readability
                  border: barometerGoalTypeFilters.length > 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  borderRadius: barometerGoalTypeFilters.length > 1 ? 1 : 0,
                  p: barometerGoalTypeFilters.length > 1 ? 2 : 0
                }}>
              {/* Metric Title */}
              {barometerGoalTypeFilters.length > 1 && (
                <Typography variant="h6" fontWeight="bold" color="primary" sx={{ mb: 1 }}>
                  {metricLabel}
                </Typography>
              )}
              
              {/* Full Federation View */}
              {barometerView === 'federation' && (() => {
                // Calculate total across all chapters/people
                let totalCount = 0;
                
                if (isCustomMetric && customActionId) {
                  // Count unique people — filtered by goalFieldKey if set on the action
                  const actionDef = (actionsFromDB || []).find((a: any) => a.action_id === customActionId);
                  const goalFieldKey: string | null = actionDef?.goal_field_key || null;
                  const uniquePeople = new Set<string>();
                  (listsData || [])
                    .filter((entry: any) => entry.action_id === customActionId)
                    .forEach((entry: any) => {
                      const personVanId = entry.vanid?.toString();
                      if (!personVanId) return;
                      const meetsGoal = goalFieldKey
                        ? (entry.progress?.[goalFieldKey] === true || entry.fields?.[goalFieldKey] === true)
                        : true;
                      if (meetsGoal) uniquePeople.add(personVanId);
                    });
                  totalCount = uniquePeople.size;
                  
                  // Note: Custom actions already include "others" in uniquePeople count
                  // since listsData includes all entries regardless of hierarchy
                } else if (currentMetricFilter === 'meetings_membership') {
                  totalCount = (meetingsData || []).filter(m => {
                    const t = (m.meeting_type || '').toLowerCase();
                    return t.includes('membership') && t.includes('one-on-one');
                  }).length;
                } else {
                  totalCount = (meetingsData || []).filter(m => {
                    const t = (m.meeting_type || '').toLowerCase();
                    return t.includes('leadership') && t.includes('one-on-one');
                  }).length;
                }
                
                // Use campaign goal from parent campaign instead of summing chapter goals
                // Find the matching goal type from the selected campaigns
                let totalGoal = 0;
                
                // For custom actions, find the action's goal_type and match with campaign goals
                if (isCustomMetric && customActionId && actionsFromDB) {
                  const actionDef = actionsFromDB.find((a: any) => a.action_id === customActionId);
                  if (actionDef && actionDef.goal_type) {
                    // Find campaign goal that matches this action's goal_type
                    for (const campaign of selectedCampaignObjs) {
                      const matchingGoal = campaign.goalTypes.find(gt => gt.id === actionDef.goal_type);
                      if (matchingGoal) {
                        totalGoal = Math.max(totalGoal, matchingGoal.totalTarget);
                      }
                    }
                  }
                } else {
                  // For built-in metrics (pledges, meetings), match by dataSource
                  for (const campaign of selectedCampaignObjs) {
                    const matchingGoal = campaign.goalTypes.find(gt => 
                      gt.dataSource === currentMetricFilter || gt.id === currentMetricFilter
                    );
                    if (matchingGoal) {
                      totalGoal = Math.max(totalGoal, matchingGoal.totalTarget);
                    }
                  }
                }
                
                const pct = totalGoal > 0 ? Math.min(100, (totalCount / totalGoal) * 100) : 0;
                const isComplete = totalGoal > 0 && totalCount >= totalGoal;
                
                const unitLabel = metricLabel;

                return (
                  <>
                    <Typography variant="h6" fontWeight="bold" color="primary" sx={{ mb: 1 }}>
                      Full Class Progress
                    </Typography>
                    <Box sx={{ width: '100%', mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {isComplete && <StarIcon sx={{ color: '#FFD700', fontSize: 24 }} />}
                          <Typography variant="h5" fontWeight="bold">
                            {unitLabel}
                          </Typography>
                        </Box>
                        <Typography variant="h6" color="text.secondary" fontWeight="medium">
                          {totalCount.toLocaleString()} / {totalGoal.toLocaleString()} ({Math.round(pct)}%)
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{
                          height: 16,
                          borderRadius: 2,
                          backgroundColor: 'action.hover',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 2,
                            backgroundColor: isComplete ? '#4caf50' : 'primary.main'
                          }
                        }}
                      />
                      {isComplete && (
                        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip 
                            icon={<StarIcon sx={{ color: '#FFD700 !important' }} />}
                            label="Goal Achieved!"
                            onClick={(e) => e.stopPropagation()} 
                            size="small"
                            sx={{ 
                              backgroundColor: '#4caf50',
                              color: 'white',
                              fontWeight: 'bold'
                            }}
                          />
                        </Box>
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
                      This represents the combined progress across all teams and individuals in the class.
                    </Typography>
                  </>
                );
              })()}
              
              {/* Chapters Leaderboard */}
              {barometerView === 'chapters' && (() => {
                // For custom actions, calculate chapter leaderboard from listsData
                if (isCustomMetric && customActionId) {
                  const actionDef = (actionsFromDB || []).find((a: any) => a.action_id === customActionId);
                  const actionFields: Array<{ key: string; label: string }> = (actionDef?.fields || []).filter((f: any) => f.type === 'boolean' || !f.type);
                  const goalFieldKey: string | null = actionDef?.goal_field_key || null;

                  type ChapterData = { count: number; goal: number; namedPeople: Set<string>; goalPeople: Set<string>; fieldPeople: Map<string, Set<string>> };
                  const chapterMap = new Map<string, ChapterData>();

                  const mkChapter = (goal = 0): ChapterData => ({
                    count: 0, goal,
                    namedPeople: new Set(),
                    goalPeople: new Set(),
                    fieldPeople: new Map(actionFields.map((f: any) => [f.key, new Set<string>()])),
                  });

                  // Initialize with campaign chapter goals
                  if (actionDef?.goal_type) {
                    selectedCampaignObjs.forEach(campaign => {
                      const matchingGoal = campaign.goalTypes.find(gt => gt.id === actionDef.goal_type);
                      if (matchingGoal?.chapterGoals) {
                        Object.entries(matchingGoal.chapterGoals).forEach(([chapter, chapterGoal]) => {
                          chapterMap.set(chapter, mkChapter(chapterGoal as number));
                        });
                      }
                    });
                  }

                  // Aggregate per-person, per-field counts
                  (listsData || [])
                    .filter((entry: any) => entry.action_id === customActionId)
                    .forEach((entry: any) => {
                      const personVanId = entry.vanid?.toString();
                      if (!personVanId) return;
                      let chapter = 'Unknown';
                      if (entry.chapter) chapter = entry.chapter;
                      else if (userMap.has(personVanId)) chapter = userMap.get(personVanId)?.chapter || 'Unknown';
                      if (!chapterMap.has(chapter)) chapterMap.set(chapter, mkChapter());
                      const ch = chapterMap.get(chapter)!;
                      ch.namedPeople.add(personVanId);
                      const meetsGoal = goalFieldKey
                        ? (entry.progress?.[goalFieldKey] === true || entry.fields?.[goalFieldKey] === true)
                        : true;
                      if (meetsGoal) ch.goalPeople.add(personVanId);
                      actionFields.forEach((f: any) => {
                        if (entry.progress?.[f.key] === true || entry.fields?.[f.key] === true) {
                          ch.fieldPeople.get(f.key)?.add(personVanId);
                        }
                      });
                      ch.count = ch.goalPeople.size;
                    });

                  const customChapterLeaderboard = Array.from(chapterMap.entries())
                    .map(([chapter, data]) => ({
                      chapter,
                      count: data.count,
                      goal: data.goal,
                      namedCount: data.namedPeople.size,
                      fieldCounts: Object.fromEntries(Array.from(data.fieldPeople.entries()).map(([k, s]) => [k, s.size])),
                    }))
                    .sort((a, b) => b.count - a.count);

                  if (customChapterLeaderboard.length === 0) {
                    return <Typography variant="body2" color="text.secondary">No data available.</Typography>;
                  }

                  // Helper: render inline conversion/count badges for a row
                  const renderInlineBadges = (namedCount: number, fieldCounts: Record<string, number>, goal: number) => {
                    if (displayMode === 'nothing' || actionFields.length === 0) return null;
                    if (displayMode === 'conversions') {
                      const pairs: Array<{ from: string; to: string; rate: number }> = [];
                      // Named → first field
                      if (actionFields.length > 0) {
                        const firstCount = fieldCounts[actionFields[0].key] ?? 0;
                        pairs.push({ from: 'Named', to: actionFields[0].label, rate: namedCount > 0 ? (firstCount / namedCount) * 100 : 0 });
                      }
                      // Consecutive field pairs
                      actionFields.slice(0, -1).forEach((f: any, i: number) => {
                        const nextF = actionFields[i + 1];
                        const fromCount = fieldCounts[f.key] ?? 0;
                        const toCount = fieldCounts[nextF.key] ?? 0;
                        pairs.push({ from: f.label, to: nextF.label, rate: fromCount > 0 ? (toCount / fromCount) * 100 : 0 });
                      });
                      return (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                          {pairs.map(({ from, to, rate }) => (
                            <Chip key={`${from}-${to}`} size="small" label={`${from}→${to}: ${rate > 0 ? Math.round(rate) + '%' : '—'}`}
                              sx={{ fontSize: '0.6rem', height: 18, bgcolor: rate >= 50 ? '#e8f5e9' : rate >= 25 ? '#fff8e1' : '#ffebee',
                                color: rate >= 50 ? '#2e7d32' : rate >= 25 ? '#f57f17' : '#c62828' }} />
                          ))}
                        </Box>
                      );
                    } else { // counts
                      const items = [
                        { label: 'Named', count: namedCount },
                        ...actionFields.map((f: any) => ({ label: f.label, count: fieldCounts[f.key] ?? 0 })),
                      ];
                      return (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                          {items.map(({ label, count: c }) => (
                            <Chip key={label} size="small" label={`${label}: ${c}${goal > 0 ? '/' + goal : ''}`}
                              sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#f0f4ff', color: 'primary.main' }} />
                          ))}
                        </Box>
                      );
                    }
                  };
                  
                  return (
                    <>
                      {/* Total Summary */}
                      {(() => {
                        let totalCount = customChapterLeaderboard.reduce((sum, c) => sum + c.count, 0);
                        let totalGoal = customChapterLeaderboard.reduce((sum, c) => sum + c.goal, 0);
                        if (leadersForTable.othersAggregate && customActionId) {
                          const othersProgress = leadersForTable.othersAggregate.actionProgress?.[customActionId];
                          if (othersProgress) { totalCount += othersProgress.count || 0; totalGoal += othersProgress.goal || 0; }
                        }
                        const totalPct = totalGoal > 0 ? (totalCount / totalGoal) * 100 : 0;
                        return (
                          <Box sx={{ width: '100%', mb: 3, pb: 2, borderBottom: '2px solid #1976d2' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                              <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>Total</Typography>
                              <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                                {totalCount} {totalGoal > 0 ? `/ ${totalGoal} (${Math.round(totalPct)}%)` : 'people'}
                              </Typography>
                            </Box>
                            <LinearProgress variant="determinate" value={totalGoal > 0 ? Math.min(100, totalPct) : 100}
                              sx={{ height: 16, borderRadius: 1, backgroundColor: '#e0e0e0',
                                '& .MuiLinearProgress-bar': { borderRadius: 1, backgroundColor: totalGoal > 0 && totalCount >= totalGoal ? '#4caf50' : '#1976d2' } }} />
                          </Box>
                        );
                      })()}
                      
                      {/* Chapter Breakdown */}
                      {customChapterLeaderboard.map(({ chapter, count, goal, namedCount, fieldCounts }, index) => {
                        const baseChapterName = chapter.replace(' for All', '');
                        const chapterColor = getChapterColor(baseChapterName);
                        return (
                          <Box key={chapter} sx={{ width: '100%' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                              <Typography variant="body2" fontWeight="medium">#{index + 1} {chapter}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {count} {goal > 0 ? `/ ${goal}` : ''} {count === 1 ? 'person' : 'people'}
                              </Typography>
                            </Box>
                            <LinearProgress variant="determinate"
                              value={Math.min(100, (count / Math.max(...customChapterLeaderboard.map(c => c.count), 1)) * 100)}
                              sx={{ height: 12, borderRadius: 1, backgroundColor: 'action.hover',
                                '& .MuiLinearProgress-bar': { borderRadius: 1, backgroundColor: chapterColor } }} />
                            {renderInlineBadges(namedCount, fieldCounts, goal)}
                          </Box>
                        );
                      })}
                      
                      {/* Other / Canvassers Entry for Custom Actions */}
                      {leadersForTable.othersAggregate && (() => {
                        const othersData = leadersForTable.othersAggregate;
                        const actionId = customActionId;
                        const othersProgress = othersData.actionProgress?.[actionId];
                        
                        if (!othersProgress || othersProgress.count === 0) return null;
                        
                        const count = othersProgress.count;
                        
                        return (
                          <Tooltip
                            title={
                              <Box sx={{ maxWidth: 400 }}>
                                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                                  {othersData.metadata?.othersCount} {othersData.metadata?.othersCount === 1 ? 'Person' : 'People'} not in formal team structure:
                                </Typography>
                                <Typography variant="caption" sx={{ fontSize: '0.7rem', lineHeight: 1.4 }}>
                                  {othersData.metadata?.othersNames}
                                </Typography>
                              </Box>
                            }
                            placement="left"
                          >
                            <Box sx={{ width: '100%', mt: 2, pt: 2, borderTop: '1px dashed #ccc', cursor: 'help' }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                <Typography variant="body2" fontWeight="medium" sx={{ fontStyle: 'italic', color: '#666' }}>
                                  Other / Canvassers
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {count} {count === 1 ? 'person' : 'people'}
                                </Typography>
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={100}
                                sx={{
                                  height: 12,
                                  borderRadius: 1,
                                  backgroundColor: '#f5f5f5',
                                  '& .MuiLinearProgress-bar': {
                                    borderRadius: 1,
                                    backgroundColor: '#999'
                                  }
                                }}
                              />
                            </Box>
                          </Tooltip>
                        );
                      })()}
                    </>
                  );
                }
                
                // Note: chapterLeaderboard is calculated at top level using first metric only
                // For now, this works but ideally should be recalculated per metric
                // The data shown will be based on the currently selected metric filter
                return (
              <>
                {chapterLeaderboard.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No data available.
                  </Typography>
                ) : (
                  <>
                    {/* Total Summary */}
                    {(() => {
                      let totalCount = chapterLeaderboard.reduce((sum, c) => sum + c.count, 0);
                      let totalGoal = chapterLeaderboard.reduce((sum, c) => sum + c.goal, 0);
                      
                      // Add "others" count to total
                      if (leadersForTable.othersAggregate) {
                        const actionId = barometerGoalTypeFilter;
                        const othersProgress = leadersForTable.othersAggregate.actionProgress?.[actionId];
                        if (othersProgress) {
                          totalCount += othersProgress.count || 0;
                          totalGoal += othersProgress.goal || 0;
                        }
                      }
                      
                      const totalPct = totalGoal > 0 ? (totalCount / totalGoal) * 100 : 0;
                      
                      return (
                        <Box sx={{ width: '100%', mb: 3, pb: 2, borderBottom: '2px solid #1976d2' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                              Total
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                              {totalCount} / {totalGoal} ({Math.round(totalPct)}%)
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(100, totalPct)}
                            sx={{
                              height: 16,
                              borderRadius: 1,
                              backgroundColor: '#e0e0e0',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 1,
                                backgroundColor: totalCount >= totalGoal ? '#4caf50' : '#1976d2'
                              }
                            }}
                          />
                        </Box>
                      );
                    })()}
                    
                    {/* Chapter Breakdown */}
                    {chapterLeaderboard.map(({ chapter, count, goal }, index) => {
                    const pct = goal > 0 ? Math.min(100, (count / goal) * 100) : 0;
                    const isComplete = goal > 0 && count >= goal;
                    
                    // Extract base chapter name for color lookup (e.g., "Durham for All" -> "Durham")
                    const baseChapterName = chapter.replace(' for All', '');
                    const chapterColor = getChapterColor(baseChapterName);
                    
                    return (
                      <Box key={chapter} sx={{ width: '100%' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {isComplete && (
                              <StarIcon 
                                sx={{ 
                                  color: '#FFD700', 
                                  fontSize: '1.2rem',
                                  filter: 'drop-shadow(0 0 2px rgba(255, 215, 0, 0.5))'
                                }} 
                              />
                            )}
                            <Typography variant="body2" fontWeight="medium">
                              #{index + 1} {chapter}
                            </Typography>
                            {isComplete && (
                              <Chip 
            size="small"
                                label="Goal Met" 
                                onClick={(e) => e.stopPropagation()}
            sx={{ 
                                  height: 20, 
                                  fontSize: '0.7rem',
                                  backgroundColor: '#FFD700',
                                  color: '#000',
                                  fontWeight: 'bold',
                                  cursor: 'default'
                                }} 
                              />
        )}
      </Box>
                          <Typography variant="body2" color="text.secondary">
                            {count} {goal > 0 ? `/ ${goal}` : ''} ({goal > 0 ? Math.round(pct) : 0}%)
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={goal > 0 ? pct : Math.min(100, (count / Math.max(...chapterLeaderboard.map(c => c.count))) * 100)}
                          sx={{
                            height: 12,
                            borderRadius: 1,
                            backgroundColor: 'action.hover',
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 1,
                              backgroundColor: isComplete ? '#FFD700' : chapterColor
                            }
                          }}
                        />
                      </Box>
                    );
                  })}
                  
                  {/* Other / Canvassers Entry */}
                  {leadersForTable.othersAggregate && (() => {
                    const othersData = leadersForTable.othersAggregate;
                    const actionId = barometerGoalTypeFilter;
                    const othersProgress = othersData.actionProgress?.[actionId];
                    
                    if (!othersProgress || othersProgress.count === 0) return null;
                    
                    const count = othersProgress.count;
                    const goal = othersProgress.goal;
                    const pct = goal > 0 ? (count / goal) * 100 : 0;
                    
                    return (
                      <Tooltip
                        title={
                          <Box sx={{ maxWidth: 400 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                              {othersData.metadata?.othersCount} {othersData.metadata?.othersCount === 1 ? 'Person' : 'People'} not in formal team structure:
                            </Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.7rem', lineHeight: 1.4 }}>
                              {othersData.metadata?.othersNames}
                            </Typography>
                          </Box>
                        }
                        placement="left"
                      >
                        <Box sx={{ width: '100%', mt: 2, pt: 2, borderTop: '1px dashed #ccc', cursor: 'help' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="body2" fontWeight="medium" sx={{ fontStyle: 'italic', color: '#666' }}>
                              Other / Canvassers
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {count} {goal > 0 ? `/ ${goal}` : ''} {goal > 0 ? `(${Math.round(pct)}%)` : ''}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={goal > 0 ? Math.min(100, pct) : 100}
                            sx={{
                              height: 12,
                              borderRadius: 1,
                              backgroundColor: '#f5f5f5',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 1,
                                backgroundColor: '#999'
                              }
                            }}
                          />
                        </Box>
                      </Tooltip>
                    );
                  })()}
                  </>
                )}
              </>
                );
              })()}

            </Box>
              );
            })}
            </Box>
            )}
          </Box>


          </>
          )}
        </>
      ) : (
        <Box sx={{
            width: '100%',
            height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          color: 'text.secondary',
          p: 4
        }}>
          <Typography variant="h5" gutterBottom>
            Campaign Progress
          </Typography>
          <Typography variant="body1" sx={{ textAlign: 'center', mb: 2 }}>
            Select a campaign from the Campaigns panel to see progress and leaderboards
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

// Chapter Barometer Component for chapter-level display
interface ChapterBarometerProps {
  chapter: string;
  totalCount: number;
  rank: number;
  maxCount: number;
  goal: number;
  unitLabel: string;
}

const ChapterBarometer: React.FC<ChapterBarometerProps> = ({
  chapter,
  totalCount,
  rank,
  maxCount,
  goal,
  unitLabel
}) => {
  const goalPct = goal > 0 ? Math.min(100, (totalCount / goal) * 100) : 0;
  const relativePct = Math.min(100, (totalCount / maxCount) * 100);
  
  return (
    <Box sx={{ width: '100%', mb: 0.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
            #{rank} {chapter}
          </Typography>
        </Box>
        <Typography variant="body1" fontWeight={600} color="text.primary">
          {totalCount} {unitLabel}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={goal > 0 ? goalPct : relativePct}
        sx={{
          height: 16,
          borderRadius: 2,
          backgroundColor: 'action.hover',
          '& .MuiLinearProgress-bar': {
            borderRadius: 2,
            background: 'linear-gradient(90deg, #1976d2 0%, #42a5f5 100%)'
          }
          }}
        />
      </Box>
  );
};

// Leadership Barometer Component for nested hierarchy display with progress bars
interface LeaderNode {
  id: string;
  name: string;
  count: number;
  chapter?: string;
  subLeaders: LeaderNode[];
  totalCount: number;
}

interface LeadershipBarometerProps {
  leader: LeaderNode;
  rank: number;
  depth: number;
  onFilterByOrganizer?: (name: string, vanId?: string) => void;
  onEditOrganizerMapping?: (name: string, vanId?: string) => void;
  maxCount: number;
  goal: number;
  unitLabel: string;
}

const LeadershipBarometer: React.FC<LeadershipBarometerProps> = ({
  leader,
  rank,
  depth,
  onFilterByOrganizer,
  onEditOrganizerMapping,
  maxCount,
  goal,
  unitLabel
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const hasSubLeaders = leader.subLeaders && leader.subLeaders.length > 0;
  
  // Calculate percentages
  const goalPct = goal > 0 ? Math.min(100, (leader.totalCount / goal) * 100) : 0;
  const relativePct = Math.min(100, (leader.totalCount / maxCount) * 100);
  const isEligible = goal > 0 && leader.totalCount >= goal;
  
  const indentPx = depth * 24;
  
  return (
    <Box sx={{ width: '100%', pl: `${indentPx}px` }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {hasSubLeaders && (
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{ p: 0.25, mr: -0.5 }}
            >
              {expanded ? <KeyboardArrowDown fontSize="small" /> : <KeyboardArrowRight fontSize="small" />}
            </IconButton>
          )}
          {depth === 0 && (
            <Typography variant="body2" fontWeight="medium" sx={{ minWidth: 24 }}>
              #{rank}
            </Typography>
          )}
          <OrganizerChip
            name={leader.name}
            vanId={leader.id}
            onFilterBy={onFilterByOrganizer}
            onEditMapping={onEditOrganizerMapping}
            size="small"
          />
          {leader.chapter && (
            <Chip 
              size="small" 
              label={leader.chapter} 
              onClick={(e) => e.stopPropagation()}
              sx={{ height: 20, fontSize: '0.7rem', cursor: 'default' }} 
            />
          )}
          {isEligible && (
            <Chip 
              size="small" 
              label="✓ Eligible" 
              color="success"
              onClick={(e) => e.stopPropagation()}
              sx={{ height: 20, fontSize: '0.7rem', cursor: 'default' }} 
            />
          )}
          {hasSubLeaders && leader.totalCount > leader.count && (
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              (+ {leader.totalCount - leader.count} from team)
            </Typography>
          )}
        </Box>
        <Typography variant="body2" color="text.secondary">
          {leader.totalCount} {goal > 0 ? `/ ${goal}` : ''} {unitLabel} {goal > 0 ? `(${Math.round(goalPct)}%)` : ''}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={goal > 0 ? goalPct : relativePct}
        sx={{
          height: 12,
          borderRadius: 1,
          backgroundColor: 'action.hover',
          '& .MuiLinearProgress-bar': {
            borderRadius: 1,
            backgroundColor: isEligible ? '#4caf50' : 'primary.main'
          }
        }}
      />
      
      {/* Render sub-leaders recursively */}
      {hasSubLeaders && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1, borderLeft: '2px solid', borderColor: 'divider', pl: 1 }}>
            {leader.subLeaders.map((subLeader) => (
              <LeadershipBarometer
                key={subLeader.id || subLeader.name}
                leader={subLeader}
                rank={0}
                depth={depth + 1}
                onFilterByOrganizer={onFilterByOrganizer}
                onEditOrganizerMapping={onEditOrganizerMapping}
                maxCount={maxCount}
                goal={goal}
                unitLabel={unitLabel}
              />
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

export default CampaignLineGraph;
