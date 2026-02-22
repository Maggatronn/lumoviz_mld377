import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Typography,
  IconButton,
  Collapse,
  Chip,
  Tooltip,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  Tabs,
  Tab,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  KeyboardArrowDown,
  KeyboardArrowRight,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Groups as GroupsIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon
} from '@mui/icons-material';
import { OrganizerChip } from '../ui/OrganizerChip';
import OrganizerDetailsDialog from '../dialogs/OrganizerDetailsDialog';
import type { LeaderProgress } from '../visualizations/Dashboard';
import { fetchLists } from '../../services/api';

// Types

interface PledgeSubmission {
  submissions?: Array<{
    vanid: number;
    first_name: string;
    last_name: string;
    leader?: string;
    desired_change: string;
  }>;
  date_submitted: string;
}

interface CampaignGoalType {
  id: string;
  name: string;
  totalTarget: number;
  unit: string;
}

interface ParentCampaign {
  id: string;
  name: string;
  goalTypes: CampaignGoalType[];
}

interface LeaderMetricsTableProps {
  leaders: LeaderProgress[];
  leaderActionsMap: Record<string, string[]>;
  leaderGoalsMap: Record<string, Record<string, number>>;
  unifiedActionIds: string[];
  ACTIONS: any[];
  availableActions?: any[];
  pledgeSubmissions?: PledgeSubmission[];
  currentUserId?: string;
  peopleRecords?: any[];
  reloadTriggers?: {[key: string]: number};
  showSummary?: boolean;
  flatView?: boolean; // If true, hide hierarchy controls and Leaders column
  onRemoveLeader?: (leaderId: string) => void;
  onAddToList?: (leader: LeaderProgress) => void;
  onPersonDetailsOpen?: (personId: string) => void;
  onFilterByOrganizer?: (name: string, vanId?: string) => void;
  onEditOrganizerMapping?: (name: string, vanId?: string) => void;
  onViewOrganizerDetails?: (name: string, vanId?: string) => void;
  listsData?: any[]; // Lists data to show which actions leaders are on
  cachedMeetings?: any[]; // Cached meetings for organizer details dialog
  userMap?: Map<number, any>; // User map for organizer details dialog
  allContacts?: any[]; // All contacts for organizer details dialog
  showConversions?: boolean; // Kept for backward compat — prefer displayMode
  displayMode?: 'progress' | 'conversions'; // 2-way display toggle
  hideDisplayToggle?: boolean; // Hide internal toggle (when parent controls it)
  onToggleConversions?: (show: boolean) => void; // Kept for backward compat
  onDisplayModeChange?: (mode: 'progress' | 'conversions') => void;
  initialSortColumn?: string | null; // Initial sort column (from URL)
  initialSortDirection?: 'asc' | 'desc'; // Initial sort direction (from URL)
  onSortChange?: (column: string | null, direction: 'asc' | 'desc') => void; // Callback when sort changes
  parentCampaigns?: ParentCampaign[]; // Parent campaigns with goal types
  useCampaignGoals?: boolean; // If true, use campaign goal targets instead of personal goals
  selectedChapter?: string; // Selected chapter for filtering summary
  teamsData?: any[]; // Teams data to get chapter info
  currentDateRange?: { start: Date; end: Date } | null; // Date range for rate-based goal adjustments
  canonicalTotalGoals?: Record<string, number>; // Pre-computed canonical total goals per action (overrides sum of leaders)
}

const EMPTY_RELOAD_TRIGGERS: {[key: string]: number} = {};

const LeaderTableRow: React.FC<{ 
  leader: LeaderProgress; 
  depth: number;
  leaderActionsMap: Record<string, string[]>;
  leaderGoalsMap: Record<string, Record<string, number>>;
  unifiedActionIds: string[];
  onRemove?: () => void;
  onRemoveLeader?: (leaderId: string) => void;
  currentUserId?: string;
  pledgeSubmissions?: PledgeSubmission[];
  onAddToList?: (leader: LeaderProgress) => void;
  reloadTriggers?: {[key: string]: number};
  peopleRecords?: any[];
  onPersonDetailsOpen?: (personId: string) => void;
  onFilterByOrganizer?: (name: string, vanId?: string) => void;
  onEditOrganizerMapping?: (name: string, vanId?: string) => void;
  onViewOrganizerDetails?: (name: string, vanId?: string) => void;
  ACTIONS: any[];
  availableActions?: any[];
  flatView?: boolean;
  listsData?: any[];
  displayMode?: 'progress' | 'conversions';
  calculateCheckpointConversion?: (leaderId: string, actionId: string, fromFieldKey: string, toFieldKey: string) => number;
  calculateCheckpointCount?: (leaderId: string, actionId: string, fieldKey: string) => number;
  getGoalForAction?: (leaderId: string, actionId: string) => number;
}> = ({ leader, depth, leaderActionsMap, leaderGoalsMap, unifiedActionIds, onRemove, onRemoveLeader, currentUserId, pledgeSubmissions = [], onAddToList, reloadTriggers = EMPTY_RELOAD_TRIGGERS, peopleRecords = [], onPersonDetailsOpen, onFilterByOrganizer, onEditOrganizerMapping, onViewOrganizerDetails, ACTIONS, availableActions = [], flatView = false, listsData, displayMode = 'progress', calculateCheckpointConversion, calculateCheckpointCount, getGoalForAction }) => {
  const showConversions = displayMode === 'conversions';
  const showProgress = displayMode === 'progress';
  const [expanded, setExpanded] = useState(false);
  const [organizingListExpanded, setOrganizingListExpanded] = useState(false);
  const [organizingList, setOrganizingList] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [organizingListAudienceFilter, setOrganizingListAudienceFilter] = useState<'constituent' | 'leadership'>('constituent');
  
  const hasSubLeaders = leader.subLeaders.length > 0;
  const isLoL = hasSubLeaders; // Leader of Leaders if they have sub-leaders
  
  // Get this leader's live actions and goals from the maps
  const leaderActions = leaderActionsMap[leader.id] || [];
  const leaderGoals = leaderGoalsMap[leader.id] || {};
  
  // Calculate pledges collected by this leader from pledgeSubmissions
  const pledgesCollected = useMemo(() => {
    const pledges: Array<{
      vanid: number;
      first_name: string;
      last_name: string;
      desired_change: string;
      date_submitted: string;
    }> = [];
    
    pledgeSubmissions.forEach(submission => {
      if (submission.submissions && Array.isArray(submission.submissions)) {
        submission.submissions.forEach(sub => {
          const leaderStr = sub.leader?.toString().trim().toLowerCase();
          
          // Skip if no leader string
          if (!leaderStr) return;
          
          const leaderNameLower = leader.name.toLowerCase();
          
          // Use stricter matching - prioritize exact matches and full name matches
          let matched = false;
          
          // 1. Exact match with leaderId
          if (leaderStr === leader.id.toLowerCase()) {
            matched = true;
          }
          // 2. Exact match with full name
          else if (leaderStr === leaderNameLower) {
            matched = true;
          }
          // 3. Full name contains match (but require at least 2 parts to match)
          else {
            const leaderNameParts = leaderNameLower.split(' ');
            if (leaderNameParts.length >= 2) {
              const firstName = leaderNameParts[0];
              const lastName = leaderNameParts[leaderNameParts.length - 1];
              
              // Both first and last name must be in the leader string
              if (leaderStr.includes(firstName) && leaderStr.includes(lastName)) {
                matched = true;
              }
            }
          }
          
          if (matched) {
            pledges.push({
              vanid: sub.vanid,
              first_name: sub.first_name,
              last_name: sub.last_name,
              desired_change: sub.desired_change,
              date_submitted: submission.date_submitted
            });
          }
        });
      }
    });
    
    return pledges;
  }, [leader.id, leader.name, pledgeSubmissions]);
  
  // Calculate sub-leader stats
  const subLeaderCount = leader.subLeaders.length;
  const subLeadersMetGoal = leader.subLeaders.filter(sl => sl.hasMetGoal).length;
  const totalSubLeaderPledges = leader.subLeaders.reduce((sum, sl) => sum + (sl.pledgeCount ?? 0), 0);
  const totalSubLeaderGoal = leader.subLeaders.length * 5; // Each sub-leader has goal of 5
  
  // Load organizing list when expanded
  useEffect(() => {
    if (organizingListExpanded && leader.id) {
      setLoadingList(true);
      
      // Fetch lists for this specific leader
      fetchLists(leader.id)
        .then(data => {
          setOrganizingList(data || []);
          setLoadingList(false);
        })
        .catch(err => {
          console.error('Error loading organizing list for leader:', leader.id, err);
          setOrganizingList([]);
          setLoadingList(false);
        });
    }
  }, [organizingListExpanded, leader.id, reloadTriggers]);
  
  // Merge organizing list with pledge submissions (like myTurf in Dashboard)
  const combinedOrganizingList = useMemo(() => {
    const combined: any[] = [];
    
    // First, add people from pledge submissions for this leader
    if (pledgeSubmissions && Array.isArray(pledgeSubmissions)) {
      pledgeSubmissions.forEach(submission => {
        if (submission.submissions && Array.isArray(submission.submissions)) {
          submission.submissions.forEach(sub => {
            const leaderStr = sub.leader?.toString().trim();
            
            // Check if this pledge belongs to the current leader
            const isMyPledge = leaderStr === leader.id.toString() || 
                              leaderStr === leader.name;
            
            if (isMyPledge) {
              // Check if already in manual list
              const existingInList = organizingList.find((item: any) => 
                item.vanid === sub.vanid && item.action_id === 'sign_pledge'
              );
              
              combined.push({
                vanid: sub.vanid,
                contact_name: `${sub.first_name} ${sub.last_name}`,
                action_id: 'sign_pledge',
                action: 'Sign Pledge',
                progress: {
                  asked: existingInList?.progress?.asked ?? true,
                  signed: existingInList?.progress?.signed ?? true,
                  willGetOthers: existingInList?.progress?.willGetOthers ?? false
                },
                date_pledged: submission.date_submitted
              });
            }
          });
        }
      });
    }
    
    // Then, merge with manual organizing list (people added but not yet completed)
    organizingList.forEach((item: any) => {
      if (!combined.find(p => p.vanid === item.vanid && p.action_id === item.action_id)) {
        combined.push(item);
      }
    });
    
    return combined;
  }, [organizingList, pledgeSubmissions, leader.id, leader.name]);
  
  // Determine if this leader row should be highlighted
  const shouldHighlight = isLoL 
    ? (subLeadersMetGoal === subLeaderCount && subLeaderCount > 0)
    : leader.hasMetGoal;
  
  return (
    <>
      {/* Main Leader Row */}
      <TableRow 
        sx={{ 
          bgcolor: shouldHighlight ? '#e8f5e9' : 'inherit',
          '&:hover': { bgcolor: shouldHighlight ? '#e8f5e9' : '#f5f5f5' }
        }}
      >
        {/* Name Column */}
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: depth * 3 }}>
            {!flatView && hasSubLeaders && (
              <IconButton
                size="small"
                onClick={() => setExpanded(!expanded)}
                sx={{ p: 0.25 }}
              >
                {expanded ? <KeyboardArrowDown /> : <KeyboardArrowRight />}
              </IconButton>
            )}
            {!flatView && !hasSubLeaders && <Box sx={{ width: 28 }} />}
            
            {/* Show tooltip with names if this is the "Others" aggregate */}
            {(leader as any).metadata?.isOthersAggregate ? (
              <Tooltip 
                title={
                  <Box sx={{ maxWidth: 400 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                      {(leader as any).metadata.othersCount} {(leader as any).metadata.othersCount === 1 ? 'Person' : 'People'} not in formal team structure:
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', lineHeight: 1.4 }}>
                      {(leader as any).metadata.othersNames}
                    </Typography>
                  </Box>
                }
              >
                <Chip
                  label={leader.name}
                  size="small"
                  sx={{ 
                    bgcolor: '#f5f5f5',
                    color: '#666',
                    fontStyle: 'italic',
                    cursor: 'help',
                    '&:hover': {
                      bgcolor: '#e0e0e0'
                    }
                  }}
                />
              </Tooltip>
            ) : (
              <OrganizerChip
                name={leader.name}
                vanId={leader.id}
                onFilterBy={onFilterByOrganizer}
                onEditMapping={onEditOrganizerMapping}
                onViewDetails={onViewOrganizerDetails}
                size="small"
              />
            )}
            
            {!flatView && isLoL && (
              <Tooltip 
                title={
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                      Developing {subLeaderCount} {subLeaderCount === 1 ? 'leader' : 'leaders'}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', display: 'block', mt: 0.5 }}>
                      {subLeadersMetGoal} at goal • {totalSubLeaderPledges} total pledges
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', display: 'block', mt: 0.5, fontStyle: 'italic' }}>
                      Expand to see their leaders
                    </Typography>
                  </Box>
                }
              >
                <Chip
                  icon={<GroupsIcon />}
                  label="LoL"
                  size="small"
                  sx={{ 
                    height: 20, 
                    fontSize: '0.65rem',
                    cursor: 'pointer',
                    bgcolor: shouldHighlight ? '#4caf50' : '#e3f2fd',
                    color: shouldHighlight ? 'white' : '#1976d2',
                    fontWeight: 600
                  }}
                  onClick={() => setExpanded(!expanded)}
                />
              </Tooltip>
            )}
            
            {leader.isAutomatic && (
              <Chip
                label="Auto"
                size="small"
                onClick={(e) => e.stopPropagation()}
                sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#fff3e0', color: '#e65100', cursor: 'default' }}
              />
            )}
          </Box>
        </TableCell>

        {/* Leaders Column - Hidden in flat view */}
        {!flatView && (
          <TableCell align="center">
            {hasSubLeaders ? (
              <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {subLeaderCount}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                —
              </Typography>
            )}
          </TableCell>
        )}

        {/* Status Column - Hidden in flat view */}
        {!flatView && (
          <TableCell>
            {isLoL ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
                {subLeadersMetGoal}/{subLeaderCount} at goal
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                {totalSubLeaderPledges} / {totalSubLeaderGoal} pledges
              </Typography>
            </Box>
          ) : leader.hasMetGoal ? (
            <Chip
              label="At Goal"
              size="small"
              sx={{ bgcolor: '#4caf50', color: 'white', fontWeight: 600, height: 20, fontSize: '0.65rem' }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              In Progress
            </Typography>
          )}
          </TableCell>
        )}

        {/* Action Columns - Personal Progress */}
        {unifiedActionIds.map(actionId => {
          const action = ACTIONS.find((a: any) => a.id === actionId);
          const actionHasGoal = action?.has_goal !== false;
          const fullActionForConv = availableActions?.find((a: any) => a.action_id === actionId);
          const boolFields = (f: any) => f.type === 'boolean' || !f.type;
          const actionHasConversions = (action?.fields && action.fields.filter(boolFields).length >= 2) || 
                                      (fullActionForConv?.fields && fullActionForConv.fields.filter(boolFields).length >= 2);
          
          // Personal stats - same for everyone (LoL or not)
          const hasAction = leaderActions.includes(actionId);
          const progress = leader.actionProgress?.[actionId];
          const count = progress?.count || 0;
          // namedCount = raw total on list; falls back to count if no goal field set
          const namedCount = (progress as any)?.namedCount ?? count;
          const goal = getGoalForAction ? getGoalForAction(leader.id, actionId) : (leaderGoals[actionId] || 5);
          const hasMetGoal = count >= goal;
          
          // Calculate team stats for LoLs (includes leader's own count + their sub-leaders)
          let teamTotalCount = 0;
          let teamTotalGoal = 0;
          let teamLeadersWithAction = 0;
          let teamLeadersAtGoal = 0;
          
          if (isLoL) {
            // Include leader's own count and goal
            if (hasAction) {
              teamTotalCount += count;
              teamTotalGoal += goal;
              teamLeadersWithAction++;
              if (hasMetGoal) {
                teamLeadersAtGoal++;
              }
            }
            
            // Add sub-leaders' counts
            leader.subLeaders.forEach(subLeader => {
              const subProgress = subLeader.actionProgress?.[actionId];
              if (subProgress) {
                teamLeadersWithAction++;
                teamTotalCount += subProgress.count || 0;
                teamTotalGoal += subProgress.goal || 5;
                if (subProgress.hasMetGoal) {
                  teamLeadersAtGoal++;
                }
              }
            });
          }
          
          // Render personal columns
          let personalColumns;
          if (!hasAction) {
            if (actionHasGoal) {
              personalColumns = (
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={0}
                      sx={{
                        flex: 1,
                        height: 8,
                        borderRadius: 1,
                        backgroundColor: '#e0e0e0',
                        '& .MuiLinearProgress-bar': { backgroundColor: '#1976d2' }
                      }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 40, whiteSpace: 'nowrap' }}>
                      0/{goal}
                    </Typography>
                  </Box>
                </TableCell>
              );
            } else {
              personalColumns = (
                <TableCell>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', textAlign: 'center', display: 'block' }}>
                    —
                  </Typography>
                </TableCell>
              );
            }
          } else if (!actionHasGoal) {
            // Action doesn't have a goal - just show count
            personalColumns = (
              <TableCell align="center">
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                  {count} {count === 1 ? 'item' : 'items'}
                </Typography>
              </TableCell>
            );
          } else if (showProgress) {
            const pct = goal > 0 ? Math.min((count / goal) * 100, 100) : 0;
            personalColumns = (
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{
                      flex: 1,
                      height: 8,
                      borderRadius: 1,
                      backgroundColor: '#e0e0e0',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: hasMetGoal ? '#4caf50' : '#1976d2'
                      }
                    }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 40, whiteSpace: 'nowrap' }}>
                    {count}/{goal}
                  </Typography>
                </Box>
              </TableCell>
            );
          } else {
            // Conversions mode: show barometer with count/goal
            personalColumns = (
              <TableCell>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min((count / goal) * 100, 100)}
                      sx={{
                        flex: 1,
                        height: 8,
                        borderRadius: 1,
                        backgroundColor: '#e0e0e0',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: hasMetGoal ? '#4caf50' : '#1976d2'
                        }
                      }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 40 }}>
                      {count}/{goal}
                    </Typography>
                  </Box>
                </Box>
              </TableCell>
            );
          }
          
          // Render team columns (only in hierarchical view)
          let teamColumns = null;
          if (!flatView) {
            if (!isLoL || teamLeadersWithAction === 0) {
              // Not a LoL or no team members with this action
              teamColumns = (
                <TableCell sx={{ bgcolor: '#fafafa' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', textAlign: 'center', display: 'block' }}>
                    —
                  </Typography>
                </TableCell>
              );
            } else if (!actionHasGoal) {
              // Team action without goal
              teamColumns = (
                <TableCell align="center" sx={{ bgcolor: '#fafafa' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                    {teamTotalCount} {teamTotalCount === 1 ? 'item' : 'items'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block' }}>
                    ({teamLeadersWithAction} {teamLeadersWithAction === 1 ? 'leader' : 'leaders'})
                  </Typography>
                </TableCell>
              );
            } else {
              // Team action with goal - show aggregate with count/goal format
              const teamPercentage = teamTotalGoal > 0 ? (teamTotalCount / teamTotalGoal) * 100 : 0;
              teamColumns = (
                <TableCell sx={{ bgcolor: '#fafafa' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(teamPercentage, 100)}
                        sx={{
                          flex: 1,
                          height: 6,
                          borderRadius: 1,
                          backgroundColor: '#e0e0e0',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: teamLeadersAtGoal === teamLeadersWithAction ? '#4caf50' : '#1976d2'
                          }
                        }}
                      />
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, minWidth: 40 }}>
                        {teamTotalCount}/{teamTotalGoal}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                      {teamLeadersAtGoal}/{teamLeadersWithAction} at goal
                    </Typography>
                  </Box>
                </TableCell>
              );
            }
          }
          
          // Extra columns for Conversions mode (counts + ratios + barometer)
          let conversionColumns = null;
          if (showConversions && actionHasConversions) {
            const fullAction = availableActions?.find((a: any) => a.action_id === actionId);
            const rawFields = action?.fields || fullAction?.fields || [];
            const fields = rawFields.filter((f: any) => f.type === 'boolean' || !f.type);

            if (!hasAction) {
              const numCols = 1 + fields.length * 2;
              conversionColumns = Array.from({ length: numCols }).map((_, i) => (
                <TableCell key={`extra-${actionId}-${i}`} align="center" sx={{ bgcolor: '#f8f9fa' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>—</Typography>
                </TableCell>
              ));
            } else {
              // Conversions mode: interleave counts and conversion ratios
              // Pattern: Named count | Named→f1 % | f1 count | f1→f2 % | f2 count | ...
              const fieldCounts = fields.map((f: any) =>
                calculateCheckpointCount ? calculateCheckpointCount(leader.id, actionId, f.key) : 0
              );
              const cols: React.ReactNode[] = [];

              // Named count
              cols.push(
                <TableCell key={`prog-${actionId}-named`} align="center" sx={{ bgcolor: '#f0f4ff' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'primary.main' }}>
                    {namedCount}
                  </Typography>
                </TableCell>
              );

              fields.forEach((f: any, i: number) => {
                // Conversion from previous stage → this stage
                const fromCount = i === 0 ? namedCount : fieldCounts[i - 1];
                const toCount = fieldCounts[i];
                const rate = fromCount > 0 ? (toCount / fromCount) * 100 : 0;
                cols.push(
                  <TableCell key={`prog-${actionId}-conv-${f.key}`} align="center" sx={{ bgcolor: '#fffef0' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.7rem', color: rate >= 50 ? '#4caf50' : rate >= 25 ? '#ff9800' : '#f44336' }}>
                      {rate > 0 ? `${Math.round(rate)}%` : '—'}
                    </Typography>
                  </TableCell>
                );
                // Count for this stage
                cols.push(
                  <TableCell key={`prog-${actionId}-cnt-${f.key}`} align="center" sx={{ bgcolor: '#f0f4ff' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                      {fieldCounts[i]}
                    </Typography>
                  </TableCell>
                );
              });

              conversionColumns = cols;
            }
          }
          
          return (
            <React.Fragment key={actionId}>
              {personalColumns}
              {conversionColumns}
              {teamColumns}
            </React.Fragment>
          );
        })}
        
        {/* Leadership Actions Column */}
        {!flatView && listsData && (() => {
          // Find all leadership actions this leader is on
          const leadershipActionsForLeader = listsData
            .filter((item: any) => item.vanid === leader.id)
            .filter((item: any) => {
              // Check if the action is a leadership action
              const action = availableActions?.find((a: any) => a.action_id === item.action_id);
              return action?.target_audience === 'leadership';
            });
          
          // Group by action_id
          const actionCounts = leadershipActionsForLeader.reduce((acc: any, item: any) => {
            const actionId = item.action_id;
            const action = availableActions?.find((a: any) => a.action_id === actionId);
            if (action) {
              if (!acc[actionId]) {
                acc[actionId] = {
                  name: action.action_name,
                  count: 0
                };
              }
              acc[actionId].count++;
            }
            return acc;
          }, {});
          
          return (
            <TableCell>
              {Object.keys(actionCounts).length > 0 ? (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {Object.entries(actionCounts).map(([actionId, data]: [string, any]) => (
                    <Chip
                      key={actionId}
                      label={data.name}
                      size="small"
                      color="secondary"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 22 }}
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  —
                </Typography>
              )}
            </TableCell>
          );
        })()}
        
        {/* Action buttons */}
        <TableCell>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="View their organizing lists">
              <IconButton
                size="small"
                onClick={() => setOrganizingListExpanded(!organizingListExpanded)}
                sx={{ color: organizingListExpanded ? 'primary.main' : 'text.secondary' }}
              >
                {organizingListExpanded ? <ExpandMoreIcon fontSize="small" /> : <KeyboardArrowRight fontSize="small" />}
              </IconButton>
            </Tooltip>
            {onAddToList && (
              <Tooltip title="Add to action">
                <IconButton
                  size="small"
                  onClick={() => onAddToList(leader)}
                  sx={{ color: 'primary.main' }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </TableCell>
        <TableCell>
          {onRemove && !leader.isAutomatic && (
            <IconButton
              size="small"
              onClick={onRemove}
              sx={{ color: 'error.main' }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </TableCell>
      </TableRow>

      {/* Organizing List Section - Show their lists */}
      {organizingListExpanded && (
        <TableRow>
          <TableCell colSpan={100} sx={{ py: 0, bgcolor: '#f5f5f5' }}>
            <Collapse in={organizingListExpanded}>
              <Box sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  {leader.name}'s Organizing Lists
                </Typography>
                
                {/* Target Audience Tabs */}
                <Box sx={{ mb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs 
                    value={organizingListAudienceFilter} 
                    onChange={(e, newValue) => setOrganizingListAudienceFilter(newValue)}
                    sx={{ minHeight: 36 }}
                  >
                    <Tab label="Constituents" value="constituent" sx={{ minHeight: 36, py: 0.5, fontSize: '0.8rem' }} />
                    <Tab label="Leaders" value="leadership" sx={{ minHeight: 36, py: 0.5, fontSize: '0.8rem' }} />
                  </Tabs>
                </Box>
                
                {loadingList ? (
                  <Typography variant="body2" color="text.secondary">Loading...</Typography>
                ) : (() => {
                    // Use ALL live actions filtered by target audience
                    const liveActions = (availableActions || [])
                      .filter((a: any) => 
                        a.status === 'live' && 
                        (a.target_audience === organizingListAudienceFilter || (!a.target_audience && organizingListAudienceFilter === 'constituent'))
                      )
                      .map((a: any) => ({
                        action_id: a.action_id,
                        action_name: a.action_name,
                        target_audience: a.target_audience,
                        fields: a.fields || []
                      }));
                    
                    // Group by person (vanid) - show people from both organizing list and pledge submissions
                    const peopleInList = Array.from(new Set(combinedOrganizingList.map((item: any) => item.vanid)));
                    
                    return peopleInList.length > 0 ? (
                      <TableContainer sx={{ maxHeight: 400, overflowY: 'auto' }}>
                        <Table size="small">
                          <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600, py: 0.75, minWidth: 120 }}>
                              Name
                            </TableCell>
                            {liveActions.map(action => 
                              action.fields.map((field: any, fieldIndex: number) => (
                                <TableCell 
                                  key={`${action.action_id}-${field.key}`}
                                  align="center"
                                  sx={{ 
                                    fontWeight: 600,
                                    py: 0.75,
                                    minWidth: 80,
                                    bgcolor: fieldIndex === 0 ? '#f5f5f5' : 'background.paper',
                                    borderLeft: fieldIndex === 0 ? '2px solid #e0e0e0' : '1px solid #e0e0e0'
                                  }}
                                >
                                  <Box>
                                    {fieldIndex === 0 && (
                                      <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', display: 'block', mb: 0.25 }}>
                                        {action.action_name}
                                      </Typography>
                                    )}
                                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                                      {field.label}
                                    </Typography>
                                  </Box>
                                </TableCell>
                              ))
                            )}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {peopleInList.map(vanid => {
                            const personEntries = combinedOrganizingList.filter((item: any) => item.vanid === vanid);
                            const firstEntry = personEntries[0];
                            
                            return (
                              <TableRow key={vanid}>
                                <TableCell sx={{ py: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                    {firstEntry.contact_name}
                                  </Typography>
                                </TableCell>
                                {liveActions.map(action => {
                                  const entry = personEntries.find((item: any) => item.action_id === action.action_id);
                                  
                                  return action.fields.map((field: any) => {
                                    const fieldValue = entry?.progress?.[field.key];
                                    
                                    return (
                                      <TableCell 
                                        key={`${action.action_id}-${field.key}`}
                                        align="center"
                                        sx={{ 
                                          py: 0.5,
                                          borderLeft: action.fields[0] === field ? '2px solid #e0e0e0' : '1px solid #e0e0e0'
                                        }}
                                      >
                                        {entry ? (
                                          <Checkbox 
                                            checked={fieldValue === true || fieldValue === 'true' || fieldValue === 1 || fieldValue === '1'}
                                            disabled
                                            size="small"
                                            sx={{ p: 0 }}
                                          />
                                        ) : (
                                          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                                            —
                                          </Typography>
                                        )}
                                      </TableCell>
                                    );
                                  });
                                })}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No organizing lists yet
                      </Typography>
                    );
                  })()}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}

      {/* Expanded Section for LoL - Show sub-leaders directly */}
      {!flatView && isLoL && expanded && (
        <>
          {leader.subLeaders?.map((subLeader: any) => (
            <LeaderTableRow
              key={subLeader.id}
              leader={subLeader}
              depth={depth + 1}
              leaderActionsMap={leaderActionsMap}
              leaderGoalsMap={leaderGoalsMap}
              unifiedActionIds={unifiedActionIds}
              onRemove={onRemoveLeader ? () => onRemoveLeader(subLeader.id) : undefined}
              currentUserId={currentUserId}
              pledgeSubmissions={pledgeSubmissions}
              onAddToList={onAddToList}
              listsData={listsData}
              reloadTriggers={reloadTriggers}
              peopleRecords={peopleRecords}
              onFilterByOrganizer={onFilterByOrganizer}
              onEditOrganizerMapping={onEditOrganizerMapping}
              getGoalForAction={getGoalForAction}
              onViewOrganizerDetails={onViewOrganizerDetails}
              ACTIONS={ACTIONS}
              availableActions={availableActions}
              onPersonDetailsOpen={onPersonDetailsOpen}
              flatView={flatView}
              displayMode={displayMode}
              calculateCheckpointConversion={calculateCheckpointConversion}
              calculateCheckpointCount={calculateCheckpointCount}
            />
          ))}
        </>
      )}
    </>
  );
};

export const LeaderMetricsTable: React.FC<LeaderMetricsTableProps> = ({
  leaders,
  leaderActionsMap,
  leaderGoalsMap,
  unifiedActionIds,
  ACTIONS,
  availableActions = [],
  pledgeSubmissions = [],
  currentUserId,
  peopleRecords = [],
  reloadTriggers = EMPTY_RELOAD_TRIGGERS,
  showSummary = false,
  flatView = false,
  onRemoveLeader,
  onAddToList,
  onPersonDetailsOpen,
  onFilterByOrganizer,
  onEditOrganizerMapping,
  listsData,
  cachedMeetings = [],
  userMap = new Map(),
  allContacts = [],
  showConversions: externalShowConversions,
  displayMode: externalDisplayMode,
  hideDisplayToggle = false,
  onToggleConversions,
  onDisplayModeChange,
  initialSortColumn = 'total',
  initialSortDirection = 'desc',
  onSortChange,
  parentCampaigns = [],
  useCampaignGoals = false,
  selectedChapter = 'All Chapters',
  teamsData = [],
  currentDateRange = null,
  canonicalTotalGoals
}) => {
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(initialSortColumn); // 'name', 'leaders', 'status', 'total', 'conversion-{actionId}', or actionId
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection);
  
  // Filter state
  const [showOnlyLoLs, setShowOnlyLoLs] = useState(false);
  
  // 2-way display mode: 'progress' | 'conversions'
  const initialDisplayMode: 'progress' | 'conversions' =
    externalDisplayMode || (externalShowConversions ? 'conversions' : 'progress');
  const [internalDisplayMode, setInternalDisplayMode] = useState<'progress' | 'conversions'>(initialDisplayMode);
  const displayMode = externalDisplayMode ?? internalDisplayMode;
  const showConversions = displayMode === 'conversions';
  
  // Organizer details dialog state
  const [organizerDialogOpen, setOrganizerDialogOpen] = useState(false);
  const [selectedOrganizerName, setSelectedOrganizerName] = useState<string>('');
  const [selectedOrganizerVanId, setSelectedOrganizerVanId] = useState<string | undefined>(undefined);
  
  // Helper: Get goal for rate-based actions
  const calculateAdjustedGoal = (
    action: any,
    baseGoal: number,
    dateRange?: { start: Date; end: Date } | null
  ): number => {
    // If rate-based, use the recurrence_count as the goal
    if (action.action_type === 'rate_based' || action.actionType === 'rate_based') {
      const recurrenceCount = action.recurrence_count || action.recurrenceCount;
      if (recurrenceCount) {
        return recurrenceCount;
      }
    }
    
    // Otherwise return the base goal
    return baseGoal;
  };
  
  // Calculate conversion rate between two specific checkpoints for a leader and action
  const calculateCheckpointConversion = (leaderId: string, actionId: string, fromFieldKey: string, toFieldKey: string): number => {
    if (!listsData || !availableActions) return 0;
    
    const action = availableActions.find((a: any) => a.action_id === actionId);
    if (!action || !action.fields) return 0;
    
    // Get all list entries for this leader's people and this action
    const leaderEntries = listsData.filter((item: any) => {
      const organizerVanid = item.organizer_vanid || item.list_organizer_vanid;
      return (organizerVanid?.toString() === leaderId.toString() || organizerVanid === parseInt(leaderId)) 
        && item.action_id === actionId;
    });
    
    if (leaderEntries.length === 0) return 0;
    
    const isTruthy = (v: any) => v === true || v === 'true' || v === 1 || v === '1';
    
    const fromCheckpointCount = leaderEntries.filter((entry: any) => 
      isTruthy(entry.fields?.[fromFieldKey]) || isTruthy(entry.progress?.[fromFieldKey])
    ).length;
    
    const toCheckpointCount = leaderEntries.filter((entry: any) => 
      isTruthy(entry.fields?.[toFieldKey]) || isTruthy(entry.progress?.[toFieldKey])
    ).length;
    
    if (fromCheckpointCount === 0) return 0;
    
    return (toCheckpointCount / fromCheckpointCount) * 100;
  };

  // Count how many of a leader's list entries have a specific checkpoint checked
  const calculateCheckpointCount = (leaderId: string, actionId: string, fieldKey: string): number => {
    if (!listsData) return 0;
    const leaderEntries = listsData.filter((item: any) => {
      const organizerVanid = item.organizer_vanid || item.list_organizer_vanid;
      return (organizerVanid?.toString() === leaderId.toString() || organizerVanid === parseInt(leaderId))
        && item.action_id === actionId;
    });
    const isTruthy = (v: any) => v === true || v === 'true' || v === 1 || v === '1';
    return leaderEntries.filter((entry: any) =>
      isTruthy(entry.fields?.[fieldKey]) || isTruthy(entry.progress?.[fieldKey])
    ).length;
  };

  // Get goal for an action - either from campaign goal type, action's default, or personal goal
  const getGoalForAction = (leaderId: string, actionId: string): number => {
    // Find the action definition first (needed for rate-based calculation)
    const actionDef = availableActions?.find((a: any) => a.action_id === actionId);
    
    // Determine base goal
    let baseGoal = 5; // Default fallback
    
    // If using campaign goals, look up the campaign goal target
    if (useCampaignGoals && actionDef) {
      if (actionDef.goal_type && actionDef.parent_campaign_id) {
        // Find the campaign
        const campaign = parentCampaigns.find(c => c.id === actionDef.parent_campaign_id);
        
        if (campaign) {
          // Find the goal type within the campaign
          const goalType = campaign.goalTypes.find(gt => gt.id === actionDef.goal_type);
          
          if (goalType && goalType.totalTarget) {
            baseGoal = goalType.totalTarget;
          }
        }
      }
    }
    // Otherwise fall back to personal goal from leaderGoalsMap
    else {
      const leaderGoals = leaderGoalsMap[leaderId] || {};
      if (leaderGoals[actionId]) {
        baseGoal = leaderGoals[actionId];
      }
      else if (actionDef && actionDef.default_individual_goal) {
        baseGoal = Number(actionDef.default_individual_goal);
      }
    }
    
    // Adjust goal for rate-based actions based on date range
    if (actionDef) {
      return calculateAdjustedGoal(actionDef, baseGoal, currentDateRange);
    }
    
    return baseGoal;
  };

  // Handle column header click
  const handleSort = (column: string) => {
    let newDirection: 'asc' | 'desc';
    let newColumn: string | null;
    
    if (sortColumn === column) {
      // Toggle direction
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      newColumn = column;
    } else {
      // New column, default to descending (highest first)
      newColumn = column;
      newDirection = 'desc';
    }
    
    setSortColumn(newColumn);
    setSortDirection(newDirection);
    
    // Call callback to update URL
    if (onSortChange) {
      onSortChange(newColumn, newDirection);
    }
  };
  
  // 2-way display mode handler
  const handleDisplayModeChange = (_: React.MouseEvent<HTMLElement>, newMode: 'progress' | 'conversions' | null) => {
    const mode = newMode ?? 'progress';
    setInternalDisplayMode(mode);
    if (onDisplayModeChange) onDisplayModeChange(mode);
    if (onToggleConversions) onToggleConversions(mode === 'conversions');
  };

  // Handle organizer details dialog
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

  // Filter leaders to only show LoLs if filter is active
  const filteredLeaders = useMemo(() => {
    if (!showOnlyLoLs) return leaders;
    
    // Recursively filter to only include LoLs and their sub-leaders
    const filterLoLs = (leadersList: LeaderProgress[]): LeaderProgress[] => {
      return leadersList
        .filter(leader => leader.subLeaders.length > 0) // Only LoLs
        .map(leader => ({
          ...leader,
          subLeaders: leader.subLeaders // Keep all their sub-leaders
        }));
    };
    
    return filterLoLs(leaders);
  }, [leaders, showOnlyLoLs]);
  
  // Count total LoLs
  const totalLoLs = useMemo(() => {
    const countLoLs = (leadersList: LeaderProgress[]): number => {
      return leadersList.reduce((count, leader) => {
        const isLoL = leader.subLeaders.length > 0;
        const subCount = countLoLs(leader.subLeaders);
        return count + (isLoL ? 1 : 0) + subCount;
      }, 0);
    };
    return countLoLs(leaders);
  }, [leaders]);
  
  // Sort leaders based on current sort settings
  const sortedLeaders = useMemo(() => {
    const sortLeaders = (leadersList: LeaderProgress[]): LeaderProgress[] => {
      const sorted = [...leadersList].sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        switch (sortColumn) {
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            return sortDirection === 'asc' 
              ? aValue.localeCompare(bValue)
              : bValue.localeCompare(aValue);
          
          case 'leaders':
            aValue = a.subLeaders.length;
            bValue = b.subLeaders.length;
            break;
          
          case 'status':
            // Sort by whether at goal, then by goal percentage
            const aAtGoal = a.hasMetGoal ? 1 : 0;
            const bAtGoal = b.hasMetGoal ? 1 : 0;
            if (aAtGoal !== bAtGoal) {
              return sortDirection === 'asc' ? aAtGoal - bAtGoal : bAtGoal - aAtGoal;
            }
            aValue = (a.pledgeCount ?? 0) / (a.pledgeGoal || 1);
            bValue = (b.pledgeCount ?? 0) / (b.pledgeGoal || 1);
            break;
          
          case 'total':
            // Total progress across all actions
            aValue = 0;
            bValue = 0;
            if (a.actionProgress) {
              Object.values(a.actionProgress).forEach(progress => {
                aValue += progress.count;
              });
            }
            if (b.actionProgress) {
              Object.values(b.actionProgress).forEach(progress => {
                bValue += progress.count;
              });
            }
            break;
          
          default:
            if (sortColumn && sortColumn.startsWith('conversion::')) {
              const parts = sortColumn.split('::');
              if (parts.length === 4) {
                const actionId = parts[1];
                const fromFieldKey = parts[2];
                const toFieldKey = parts[3];
                const getConvRate = (leader: LeaderProgress) => {
                  if (fromFieldKey === 'named') {
                    const namedCount = (leader.actionProgress?.[actionId] as any)?.namedCount ?? leader.actionProgress?.[actionId]?.count ?? 0;
                    const toCount = calculateCheckpointCount(leader.id, actionId, toFieldKey);
                    return namedCount > 0 ? (toCount / namedCount) * 100 : 0;
                  }
                  return calculateCheckpointConversion(leader.id, actionId, fromFieldKey, toFieldKey);
                };
                aValue = getConvRate(a);
                bValue = getConvRate(b);
              } else {
                aValue = 0;
                bValue = 0;
              }
            }
            else if (sortColumn && sortColumn.startsWith('count::')) {
              const parts = sortColumn.split('::');
              if (parts.length === 3) {
                const actionId = parts[1];
                const fieldKey = parts[2];
                if (fieldKey === 'named') {
                  aValue = (a.actionProgress?.[actionId] as any)?.namedCount ?? a.actionProgress?.[actionId]?.count ?? 0;
                  bValue = (b.actionProgress?.[actionId] as any)?.namedCount ?? b.actionProgress?.[actionId]?.count ?? 0;
                } else {
                  aValue = calculateCheckpointCount(a.id, actionId, fieldKey);
                  bValue = calculateCheckpointCount(b.id, actionId, fieldKey);
                }
              } else {
                aValue = 0;
                bValue = 0;
              }
            }
            // Legacy format support (conversion-{actionId}-{fromKey}-{toKey})
            else if (sortColumn && sortColumn.startsWith('conversion-')) {
              const match = sortColumn.match(/^conversion-(.+)-([^-]+)-([^-]+)$/);
              if (match) {
                const actionId = match[1];
                const fromFieldKey = match[2];
                const toFieldKey = match[3];
                const getConvRate = (leader: LeaderProgress) => {
                  if (fromFieldKey === 'named') {
                    const namedCount = (leader.actionProgress?.[actionId] as any)?.namedCount ?? leader.actionProgress?.[actionId]?.count ?? 0;
                    const toCount = calculateCheckpointCount(leader.id, actionId, toFieldKey);
                    return namedCount > 0 ? (toCount / namedCount) * 100 : 0;
                  }
                  return calculateCheckpointConversion(leader.id, actionId, fromFieldKey, toFieldKey);
                };
                aValue = getConvRate(a);
                bValue = getConvRate(b);
              } else {
                aValue = 0;
                bValue = 0;
              }
            }
            else if (sortColumn) {
              aValue = a.actionProgress?.[sortColumn]?.count || 0;
              bValue = b.actionProgress?.[sortColumn]?.count || 0;
            } else {
              aValue = 0;
              bValue = 0;
            }
            break;
        }
        
        // Numeric comparison
        if (sortDirection === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      });
      
      // Recursively sort sub-leaders
      return sorted.map(leader => ({
        ...leader,
        subLeaders: leader.subLeaders.length > 0 ? sortLeaders(leader.subLeaders) : []
      }));
    };
    
    return sortLeaders(filteredLeaders);
  }, [filteredLeaders, sortColumn, sortDirection]);
  
  if (filteredLeaders.length === 0 && showOnlyLoLs) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No Leaders of Leaders to display. Clear the LoL filter to see all leaders.
        </Typography>
      </Box>
    );
  }
  
  if (leaders.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No leaders to display
        </Typography>
      </Box>
    );
  }

  // Sort indicator component
  const SortIndicator = ({ column }: { column: string }) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' ? (
      <ArrowUpwardIcon sx={{ fontSize: '0.9rem', ml: 0.5 }} />
    ) : (
      <ArrowDownwardIcon sx={{ fontSize: '0.9rem', ml: 0.5 }} />
    );
  };

  return (
    <>
      {/* Filter Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, px: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
          {leaders.length} {leaders.length === 1 ? 'leader' : 'leaders'}
        </Typography>
        
        {/* 2-way display toggle — hidden when parent controls it */}
        {!hideDisplayToggle && (
          <ToggleButtonGroup
            value={displayMode}
            exclusive
            onChange={handleDisplayModeChange}
            size="small"
            sx={{ height: 28 }}
          >
            <ToggleButton value="progress" sx={{ fontSize: '0.65rem', px: 1, py: 0.25, textTransform: 'none' }}>
              Progress
            </ToggleButton>
            <ToggleButton value="conversions" sx={{ fontSize: '0.65rem', px: 1, py: 0.25, textTransform: 'none' }}>
              Conversions
            </ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>
      
      <TableContainer sx={{ maxHeight: 'calc(100vh - 360px)', minHeight: '500px' }}>
        <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell 
              sx={{ fontWeight: 600, py: 1, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'action.hover' } }}
              onClick={() => handleSort('name')}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                Name
                <SortIndicator column="name" />
              </Box>
            </TableCell>
            {!flatView && (
              <TableCell 
                sx={{ fontWeight: 600, py: 1, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'action.hover' } }}
                onClick={() => handleSort('leaders')}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Leaders
                  <SortIndicator column="leaders" />
                </Box>
              </TableCell>
            )}
            {!flatView && (
              <TableCell 
                sx={{ fontWeight: 600, py: 1, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'action.hover' } }}
                onClick={() => handleSort('status')}
              >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  Status
                  <SortIndicator column="status" />
                </Box>
              </TableCell>
            )}
            {unifiedActionIds.map(actionId => {
              const action = ACTIONS.find((a: any) => a.id === actionId);
              const actionHasGoal = action?.has_goal !== false;
              const fullAction = availableActions?.find((a: any) => a.action_id === actionId);
              const boolFieldFilter = (f: any) => f.type === 'boolean' || !f.type;
              const actionHasConversions = (action?.fields && action.fields.filter(boolFieldFilter).length >= 2) || 
                                          (fullAction?.fields && fullAction.fields.filter(boolFieldFilter).length >= 2);
              
              if (!actionHasGoal) {
                return (
                  <React.Fragment key={actionId}>
                    <TableCell 
                      align="center" 
                      sx={{ fontWeight: 600, py: 1, minWidth: 120, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'action.hover' } }}
                      onClick={() => handleSort(actionId)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {action?.name || actionId}
                        <SortIndicator column={actionId} />
                      </Box>
                    </TableCell>
                    {displayMode === 'conversions' && actionHasConversions && (() => {
                      const fullAction = availableActions?.find((a: any) => a.action_id === actionId);
                      const fields = (action?.fields || fullAction?.fields || []).filter((f: any) => f.type === 'boolean' || !f.type);
                      const headers: React.ReactNode[] = [];
                      headers.push(
                        <TableCell key={`prog-header-${actionId}-named`} align="center"
                          sx={{ fontWeight: 600, py: 1, minWidth: 60, bgcolor: '#f0f4ff', cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#e3eafc' } }}
                          onClick={() => handleSort(`count::${actionId}::named`)}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>Named</Typography>
                            <SortIndicator column={`count::${actionId}::named`} />
                          </Box>
                        </TableCell>
                      );
                      fields.forEach((field: any, idx: number) => {
                        const fromLabel = idx === 0 ? 'Named' : fields[idx - 1].label;
                        const fromKey = idx === 0 ? 'named' : fields[idx - 1].key;
                        headers.push(
                          <TableCell key={`prog-header-${actionId}-conv-${fromKey}-${field.key}`} align="center"
                            sx={{ fontWeight: 600, py: 1, minWidth: 70, bgcolor: '#fffef0', cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#fff9c4' } }}
                            onClick={() => handleSort(`conversion::${actionId}::${fromKey}::${field.key}`)}>
                            <Tooltip title={`${fromLabel} → ${field.label}`}>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                                <Typography variant="caption" sx={{ fontSize: '0.6rem', lineHeight: 1.2 }}>→{field.label}</Typography>
                                <SortIndicator column={`conversion::${actionId}::${fromKey}::${field.key}`} />
                              </Box>
                            </Tooltip>
                          </TableCell>
                        );
                        headers.push(
                          <TableCell key={`prog-header-${actionId}-cnt-${field.key}`} align="center"
                            sx={{ fontWeight: 600, py: 1, minWidth: 60, bgcolor: '#f0f4ff', cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#e3eafc' } }}
                            onClick={() => handleSort(`count::${actionId}::${field.key}`)}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{field.label}</Typography>
                              <SortIndicator column={`count::${actionId}::${field.key}`} />
                            </Box>
                          </TableCell>
                        );
                      });
                      return headers;
                    })()}
                    {!flatView && (
                      <TableCell 
                        align="center" 
                        sx={{ fontWeight: 600, py: 1, minWidth: 140, bgcolor: '#f8f9fa', color: 'text.secondary', fontSize: '0.85rem' }}
                      >
                        Team {action?.name || actionId}
                      </TableCell>
                    )}
                  </React.Fragment>
                );
              }
              
              return (
                <React.Fragment key={actionId}>
                  {/* Personal progress column (combined count + goal) */}
                  <TableCell 
                    sx={{ fontWeight: 600, py: 1, minWidth: 140, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: 'action.hover' } }}
                    onClick={() => handleSort(actionId)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {action?.name || actionId}
                      <SortIndicator column={actionId} />
                    </Box>
                  </TableCell>
                  
                  {displayMode === 'conversions' && actionHasConversions && (() => {
                    const fullAction = availableActions?.find((a: any) => a.action_id === actionId);
                    const fields = (action?.fields || fullAction?.fields || []).filter((f: any) => f.type === 'boolean' || !f.type);
                    const headers: React.ReactNode[] = [];
                    headers.push(
                      <TableCell key={`prog-hdr2-${actionId}-named`} align="center"
                        sx={{ fontWeight: 600, py: 1, minWidth: 60, bgcolor: '#f0f4ff', cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#e3eafc' } }}
                        onClick={() => handleSort(`count::${actionId}::named`)}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>Named</Typography>
                          <SortIndicator column={`count::${actionId}::named`} />
                        </Box>
                      </TableCell>
                    );
                    fields.forEach((field: any, idx: number) => {
                      const fromLabel = idx === 0 ? 'Named' : fields[idx - 1].label;
                      const fromKey = idx === 0 ? 'named' : fields[idx - 1].key;
                      headers.push(
                        <TableCell key={`prog-hdr2-${actionId}-conv-${fromKey}-${field.key}`} align="center"
                          sx={{ fontWeight: 600, py: 1, minWidth: 70, bgcolor: '#fffef0', cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#fff9c4' } }}
                          onClick={() => handleSort(`conversion::${actionId}::${fromKey}::${field.key}`)}>
                          <Tooltip title={`${fromLabel} → ${field.label}`}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                              <Typography variant="caption" sx={{ fontSize: '0.6rem', lineHeight: 1.2 }}>→{field.label}</Typography>
                              <SortIndicator column={`conversion::${actionId}::${fromKey}::${field.key}`} />
                            </Box>
                          </Tooltip>
                        </TableCell>
                      );
                      headers.push(
                        <TableCell key={`prog-hdr2-${actionId}-cnt-${field.key}`} align="center"
                          sx={{ fontWeight: 600, py: 1, minWidth: 60, bgcolor: '#f0f4ff', cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#e3eafc' } }}
                          onClick={() => handleSort(`count::${actionId}::${field.key}`)}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{field.label}</Typography>
                            <SortIndicator column={`count::${actionId}::${field.key}`} />
                          </Box>
                        </TableCell>
                      );
                    });
                    return headers;
                  })()}
                  
                  {/* Team progress column (only in hierarchical view) */}
                  {!flatView && (
                    <TableCell 
                      sx={{ fontWeight: 600, py: 1, minWidth: 140, bgcolor: '#f8f9fa', color: 'text.secondary', fontSize: '0.85rem' }}
                    >
                      Team {action?.name || actionId}
                    </TableCell>
                  )}
                </React.Fragment>
              );
            })}
            {!flatView && listsData && (
              <TableCell sx={{ fontWeight: 600, py: 1, minWidth: 150 }}>
                Leadership Actions
              </TableCell>
            )}
            <TableCell width={50}></TableCell>
            <TableCell width={50}></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {showSummary && (() => {
            // Filter leaders by chapter if a specific chapter is selected
            let directLeaders = sortedLeaders;
            
            if (selectedChapter && !selectedChapter.startsWith('All ')) {
              // Filter to only leaders in the selected chapter
              directLeaders = directLeaders.filter(leader => {
                // Find the leader's team to get their chapter
                const leaderTeam = teamsData?.find(team => {
                  const teamLead = team.bigQueryData?.teamLead;
                  const teamMembers = team.bigQueryData?.teamMembers || [];
                  
                  // Check if leader is the team lead
                  if (teamLead === leader.name || teamLead.toLowerCase() === leader.name.toLowerCase()) {
                    return true;
                  }
                  
                  // Check if leader is a team member
                  return teamMembers.some((member: string) => 
                    member.toLowerCase() === leader.name.toLowerCase()
                  );
                });
                
                const leaderChapter = leaderTeam?.bigQueryData?.chapter;
                return leaderChapter === selectedChapter;
              });
            }
            
            // Recursively collect ALL leaders (direct + nested at all levels)
            const getAllLeaders = (leadersList: LeaderProgress[]): LeaderProgress[] => {
              const allLeaders: LeaderProgress[] = [];
              leadersList.forEach(leader => {
                allLeaders.push(leader);
                if (leader.subLeaders && leader.subLeaders.length > 0) {
                  allLeaders.push(...getAllLeaders(leader.subLeaders));
                }
              });
              return allLeaders;
            };
            
            const allLeaders = getAllLeaders(directLeaders);
            const totalAllLeaders = allLeaders.length;
            
            const totalLeadersAtGoal = allLeaders.filter(leader => {
              if (!leader.actionProgress) return false;
              return Object.values(leader.actionProgress).some((progress: any) => progress.hasMetGoal);
            }).length;
            
            // Calculate combined stats for ALL leaders (all levels combined)
            const totalStats: Record<string, { leadersAtGoal: number; totalLeaders: number; totalCount: number; totalGoal: number }> = {};
            
            unifiedActionIds.forEach(actionId => {
              let leadersWithAction = 0;
              let leadersAtGoalForAction = 0;
              let totalCount = 0;
              let totalGoal = 0;
              
              allLeaders.forEach(leader => {
                const progress = leader.actionProgress?.[actionId];
                if (!canonicalTotalGoals) {
                  totalGoal += getGoalForAction(leader.id, actionId);
                }
                if (progress) {
                  leadersWithAction++;
                  totalCount += progress.count || 0;
                  if (progress.hasMetGoal) {
                    leadersAtGoalForAction++;
                  }
                }
              });

              if (canonicalTotalGoals && canonicalTotalGoals[actionId] !== undefined) {
                totalGoal = canonicalTotalGoals[actionId];
              }
              
              totalStats[actionId] = {
                leadersAtGoal: leadersAtGoalForAction,
                totalLeaders: leadersWithAction,
                totalCount,
                totalGoal
              };
            });
            
            return (
              <>
                {/* Single Summary Row - Total across ALL levels */}
                <TableRow sx={{ bgcolor: '#e3f2fd', borderBottom: '2px solid #1976d2' }}>
                  <TableCell sx={{ py: 1, fontSize: '0.85rem', fontWeight: 700, color: 'primary.main' }}>
                    {selectedChapter && !selectedChapter.startsWith('All ')
                      ? `${selectedChapter} Total`
                      : 'Total'
                    }
                  </TableCell>
                  {!flatView && (
                    <TableCell align="center" sx={{ py: 1 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'primary.main' }}>
                        {totalAllLeaders}
                      </Typography>
                    </TableCell>
                  )}
                  {!flatView && (
                    <TableCell sx={{ py: 1 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'primary.main' }}>
                        {totalLeadersAtGoal}/{totalAllLeaders} at goal
                      </Typography>
                    </TableCell>
                  )}
                  {unifiedActionIds.map(actionId => {
                    const action = ACTIONS.find((a: any) => a.id === actionId);
                    const stats = totalStats[actionId];
                    const actionHasGoal = action?.has_goal !== false;
                    const percentage = stats.totalGoal > 0 ? (stats.totalCount / stats.totalGoal) * 100 : 0;
                    
                    let personalColumns;
                    if (!actionHasGoal) {
                      personalColumns = (
                        <TableCell align="center" sx={{ py: 1 }}>
                          <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'primary.main' }}>
                            {stats.totalCount}
                          </Typography>
                        </TableCell>
                      );
                    } else {
                      personalColumns = (
                        <TableCell sx={{ py: 1 }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(percentage, 100)}
                                sx={{
                                  flex: 1,
                                  height: 6,
                                  borderRadius: 1,
                                  backgroundColor: '#e0e0e0',
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor: stats.leadersAtGoal === stats.totalLeaders ? '#4caf50' : '#1976d2'
                                  }
                                }}
                              />
                              <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 700, minWidth: 50, color: 'primary.main' }}>
                                {stats.totalCount}/{stats.totalGoal}
                              </Typography>
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
                              {stats.leadersAtGoal}/{stats.totalLeaders} at goal
                            </Typography>
                          </Box>
                        </TableCell>
                      );
                    }
                    
                    const fullActionForConv2 = availableActions?.find((a: any) => a.action_id === actionId);
                    const summaryBoolFilter = (f: any) => f.type === 'boolean' || !f.type;
                    const actionHasConversions = (action?.fields && action.fields.filter(summaryBoolFilter).length >= 2) ||
                                                (fullActionForConv2?.fields && fullActionForConv2.fields.filter(summaryBoolFilter).length >= 2);
                    let conversionColumns = null;
                    if (displayMode === 'conversions' && actionHasConversions) {
                      const fullAction = availableActions?.find((a: any) => a.action_id === actionId);
                      const fields = (action?.fields || fullAction?.fields || []).filter((f: any) => f.type === 'boolean' || !f.type);
                      const totalNamed = allLeaders.reduce((sum, l) => {
                        const p = l.actionProgress?.[actionId] as any;
                        return sum + ((p?.namedCount ?? p?.count) || 0);
                      }, 0);
                      const fieldTotals = fields.map((f: any) =>
                        allLeaders.reduce((sum, leader) => {
                          return sum + (calculateCheckpointCount ? calculateCheckpointCount(leader.id, actionId, f.key) : 0);
                        }, 0)
                      );

                      const cols: React.ReactNode[] = [];
                      cols.push(
                        <TableCell key={`prog-sum-${actionId}-named`} align="center" sx={{ py: 1, bgcolor: '#f0f4ff' }}>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'primary.main' }}>
                            {totalNamed}
                          </Typography>
                        </TableCell>
                      );
                      fields.forEach((f: any, i: number) => {
                        const fromCount = i === 0 ? totalNamed : fieldTotals[i - 1];
                        const toCount = fieldTotals[i];
                        const rate = fromCount > 0 ? (toCount / fromCount) * 100 : 0;
                        cols.push(
                          <TableCell key={`prog-sum-${actionId}-conv-${f.key}`} align="center" sx={{ py: 1, bgcolor: '#fffef0' }}>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 700, color: rate >= 50 ? '#4caf50' : rate >= 25 ? '#ff9800' : '#f44336' }}>
                              {rate > 0 ? `${Math.round(rate)}%` : '—'}
                            </Typography>
                          </TableCell>
                        );
                        cols.push(
                          <TableCell key={`prog-sum-${actionId}-cnt-${f.key}`} align="center" sx={{ py: 1, bgcolor: '#f0f4ff' }}>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 700 }}>
                              {fieldTotals[i]}
                            </Typography>
                          </TableCell>
                        );
                      });
                      conversionColumns = cols;
                    }
                    
                    // Empty team column for summary row
                    const teamColumns = !flatView ? (
                      <TableCell sx={{ py: 1, bgcolor: '#fafafa' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', textAlign: 'center', display: 'block' }}>
                          —
                        </Typography>
                      </TableCell>
                    ) : null;
                    
                    return (
                      <React.Fragment key={actionId}>
                        {personalColumns}
                        {conversionColumns}
                        {teamColumns}
                      </React.Fragment>
                    );
                  })}
                  {!flatView && listsData && <TableCell />}
                  <TableCell />
                  <TableCell />
                </TableRow>
              </>
            );
          })()}
          
          {/* Leader Rows */}
          {sortedLeaders.map((leader) => (
            <LeaderTableRow 
              key={leader.id} 
              leader={leader} 
              depth={0}
              leaderActionsMap={leaderActionsMap}
              leaderGoalsMap={leaderGoalsMap}
              unifiedActionIds={unifiedActionIds}
              onRemove={onRemoveLeader ? () => onRemoveLeader(leader.id) : undefined}
              onRemoveLeader={onRemoveLeader}
              currentUserId={currentUserId}
              pledgeSubmissions={pledgeSubmissions}
              onAddToList={onAddToList}
              reloadTriggers={reloadTriggers}
              peopleRecords={peopleRecords}
              ACTIONS={ACTIONS}
              availableActions={availableActions}
              onPersonDetailsOpen={onPersonDetailsOpen}
              onFilterByOrganizer={onFilterByOrganizer}
              onEditOrganizerMapping={onEditOrganizerMapping}
              onViewOrganizerDetails={handleViewOrganizerDetails}
              flatView={flatView}
              listsData={listsData}
              displayMode={displayMode}
              calculateCheckpointConversion={calculateCheckpointConversion}
              calculateCheckpointCount={calculateCheckpointCount}
              getGoalForAction={getGoalForAction}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>

    {/* Organizer Details Dialog */}
    <OrganizerDetailsDialog
      open={organizerDialogOpen}
      onClose={handleCloseOrganizerDialog}
      organizerName={selectedOrganizerName}
      organizerVanId={selectedOrganizerVanId}
      cachedMeetings={cachedMeetings}
      userMap={userMap}
      allContacts={allContacts}
    />
    </>
  );
};

export default LeaderMetricsTable;
