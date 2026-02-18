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
  displayMode?: 'nothing' | 'conversions' | 'counts'; // 3-way display toggle
  hideDisplayToggle?: boolean; // Hide internal toggle (when parent controls it)
  onToggleConversions?: (show: boolean) => void; // Kept for backward compat
  onDisplayModeChange?: (mode: 'nothing' | 'conversions' | 'counts') => void;
  initialSortColumn?: string | null; // Initial sort column (from URL)
  initialSortDirection?: 'asc' | 'desc'; // Initial sort direction (from URL)
  onSortChange?: (column: string | null, direction: 'asc' | 'desc') => void; // Callback when sort changes
  parentCampaigns?: ParentCampaign[]; // Parent campaigns with goal types
  useCampaignGoals?: boolean; // If true, use campaign goal targets instead of personal goals
  selectedChapter?: string; // Selected chapter for filtering summary
  teamsData?: any[]; // Teams data to get chapter info
  currentDateRange?: { start: Date; end: Date } | null; // Date range for rate-based goal adjustments
}

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
  displayMode?: 'nothing' | 'conversions' | 'counts';
  calculateCheckpointConversion?: (leaderId: string, actionId: string, fromFieldKey: string, toFieldKey: string) => number;
  calculateCheckpointCount?: (leaderId: string, actionId: string, fieldKey: string) => number;
  getGoalForAction?: (leaderId: string, actionId: string) => number;
}> = ({ leader, depth, leaderActionsMap, leaderGoalsMap, unifiedActionIds, onRemove, onRemoveLeader, currentUserId, pledgeSubmissions = [], onAddToList, reloadTriggers = {}, peopleRecords = [], onPersonDetailsOpen, onFilterByOrganizer, onEditOrganizerMapping, onViewOrganizerDetails, ACTIONS, availableActions = [], flatView = false, listsData, displayMode = 'nothing', calculateCheckpointConversion, calculateCheckpointCount, getGoalForAction }) => {
  const showConversions = displayMode === 'conversions';
  const showCounts = displayMode === 'counts';
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
          const actionHasConversions = action && action.fields && action.fields.length >= 2;
          
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
            // Leader doesn't have this action
            personalColumns = (
              <TableCell>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', textAlign: 'center', display: 'block' }}>
                  —
                </Typography>
              </TableCell>
            );
          } else if (!actionHasGoal) {
            // Action doesn't have a goal - just show count
            personalColumns = (
              <TableCell align="center">
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                  {count} {count === 1 ? 'item' : 'items'}
                </Typography>
              </TableCell>
            );
          } else {
            // Action has a goal - show barometer with count/goal
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
          
          // Conversion / Counts columns
          let conversionColumns = null;
          if ((showConversions || showCounts) && actionHasConversions) {
            const fullAction = availableActions?.find((a: any) => a.action_id === actionId);
            const fields = action?.fields || fullAction?.fields || [];

            if (!hasAction) {
              // No action — dashes for all extra columns
              // Conversions: Named→first + pairs; Counts: named + each field
              const numCols = showConversions ? fields.length : fields.length + 1;
              conversionColumns = Array.from({ length: numCols }).map((_, i) => (
                <TableCell key={`extra-${actionId}-${i}`} align="center" sx={{ bgcolor: showCounts ? '#f0f4ff' : '#fffef0' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>—</Typography>
                </TableCell>
              ));
            } else if (showConversions) {
              // Named → first field, then each consecutive pair
              // namedCount = raw total on list (before any goal-field filtering)
              const pairs: Array<{ fromLabel: string; toLabel: string; rate: number }> = [];

              // Named → first checkpoint
              if (fields.length > 0) {
                const firstField = fields[0];
                const askedCount = calculateCheckpointCount
                  ? calculateCheckpointCount(leader.id, actionId, firstField.key)
                  : 0;
                pairs.push({
                  fromLabel: 'Named',
                  toLabel: firstField.label,
                  rate: namedCount > 0 ? (askedCount / namedCount) * 100 : 0,
                });
              }

              // Each consecutive checkpoint pair
              fields.slice(0, -1).forEach((field: any, idx: number) => {
                const nextField = fields[idx + 1];
                const convRate = calculateCheckpointConversion
                  ? calculateCheckpointConversion(leader.id, actionId, field.key, nextField.key)
                  : 0;
                pairs.push({ fromLabel: field.label, toLabel: nextField.label, rate: convRate });
              });

              conversionColumns = pairs.map(({ fromLabel, toLabel, rate }, i) => (
                <TableCell key={`conv-${actionId}-${i}`} align="center" sx={{ bgcolor: '#fffef0' }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      color: rate >= 50 ? '#4caf50' : rate >= 25 ? '#ff9800' : '#f44336',
                    }}
                  >
                    {rate > 0 ? `${Math.round(rate)}%` : '—'}
                  </Typography>
                </TableCell>
              ));
            } else {
              // Counts mode: Named/goal (raw total), then each checkpoint count/goal
              const fieldCounts = fields.map((f: any) =>
                calculateCheckpointCount ? calculateCheckpointCount(leader.id, actionId, f.key) : 0
              );

              const cols = [
                <TableCell key={`cnt-${actionId}-named`} align="center" sx={{ bgcolor: '#f0f4ff' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'primary.main' }}>
                    {namedCount}/{goal}
                  </Typography>
                </TableCell>,
                ...fields.map((f: any, i: number) => (
                  <TableCell key={`cnt-${actionId}-${f.key}`} align="center" sx={{ bgcolor: '#f0f4ff' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>
                      {fieldCounts[i]}/{goal}
                    </Typography>
                  </TableCell>
                )),
              ];
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
                                            checked={fieldValue === true}
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
  reloadTriggers = {},
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
  currentDateRange = null
}) => {
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(initialSortColumn); // 'name', 'leaders', 'status', 'total', 'conversion-{actionId}', or actionId
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection);
  
  // Filter state
  const [showOnlyLoLs, setShowOnlyLoLs] = useState(false);
  
  // 3-way display mode: 'nothing' | 'conversions' | 'counts'
  const initialDisplayMode: 'nothing' | 'conversions' | 'counts' =
    externalDisplayMode || (externalShowConversions ? 'conversions' : 'nothing');
  const [internalDisplayMode, setInternalDisplayMode] = useState<'nothing' | 'conversions' | 'counts'>(initialDisplayMode);
  const displayMode = externalDisplayMode ?? internalDisplayMode;
  const showConversions = displayMode === 'conversions'; // kept for backward compat checks
  
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
    
    // Count people at the "from" checkpoint
    const fromCheckpointCount = leaderEntries.filter((entry: any) => 
      entry.fields?.[fromFieldKey] === true || entry.progress?.[fromFieldKey] === true
    ).length;
    
    // Count people at the "to" checkpoint
    const toCheckpointCount = leaderEntries.filter((entry: any) => 
      entry.fields?.[toFieldKey] === true || entry.progress?.[toFieldKey] === true
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
    return leaderEntries.filter((entry: any) =>
      entry.fields?.[fieldKey] === true || entry.progress?.[fieldKey] === true
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
      // Or use action's default individual goal if available
      else if (actionDef && actionDef.default_individual_goal) {
        baseGoal = actionDef.default_individual_goal;
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
  
  // 3-way display mode handler
  const handleDisplayModeChange = (_: React.MouseEvent<HTMLElement>, newMode: 'nothing' | 'conversions' | 'counts' | null) => {
    const mode = newMode ?? 'nothing';
    setInternalDisplayMode(mode);
    if (onDisplayModeChange) onDisplayModeChange(mode);
    if (onToggleConversions) onToggleConversions(mode !== 'nothing');
  };

  // Toggle conversions display (backward compat)
  const handleToggleConversions = () => {
    const newMode = displayMode !== 'nothing' ? 'nothing' : 'conversions';
    setInternalDisplayMode(newMode);
    if (onDisplayModeChange) onDisplayModeChange(newMode);
    if (onToggleConversions) onToggleConversions(newMode !== 'nothing');
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
            // Check if sorting by conversion rate (format: conversion-{actionId}-{fromKey}-{toKey})
            if (sortColumn && sortColumn.startsWith('conversion-')) {
              const parts = sortColumn.split('-');
              if (parts.length >= 4) {
                // conversion-actionId-fromKey-toKey
                const actionId = parts[1];
                const fromFieldKey = parts[2];
                const toFieldKey = parts[3];
                aValue = calculateCheckpointConversion(a.id, actionId, fromFieldKey, toFieldKey);
                bValue = calculateCheckpointConversion(b.id, actionId, fromFieldKey, toFieldKey);
              } else {
                aValue = 0;
                bValue = 0;
              }
            }
            // Sorting by specific action
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
        
        {/* 3-way display toggle — hidden when parent controls it */}
        {!hideDisplayToggle && (
          <ToggleButtonGroup
            value={displayMode}
            exclusive
            onChange={handleDisplayModeChange}
            size="small"
            sx={{ height: 28 }}
          >
            <ToggleButton value="nothing" sx={{ fontSize: '0.65rem', px: 1, py: 0.25, textTransform: 'none' }}>
              None
            </ToggleButton>
            <ToggleButton value="conversions" sx={{ fontSize: '0.65rem', px: 1, py: 0.25, textTransform: 'none' }}>
              Conversions
            </ToggleButton>
            <ToggleButton value="counts" sx={{ fontSize: '0.65rem', px: 1, py: 0.25, textTransform: 'none' }}>
              Counts
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
              // Also check in availableActions for the full action definition with fields
              const fullAction = availableActions?.find((a: any) => a.action_id === actionId);
              const actionHasConversions = (action?.fields && action.fields.length >= 2) || 
                                          (fullAction?.fields && fullAction.fields.length >= 2);
              
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
                    {(displayMode === 'conversions' || displayMode === 'counts') && actionHasConversions && (() => {
                      const fullAction = availableActions?.find((a: any) => a.action_id === actionId);
                      const fields = action?.fields || fullAction?.fields || [];

                      if (displayMode === 'conversions') {
                        // Named→first, then each consecutive pair
                        const headers: React.ReactNode[] = [];
                        if (fields.length > 0) {
                          headers.push(
                            <TableCell key={`conv-header-${actionId}-named-${fields[0].key}`} align="center"
                              sx={{ fontWeight: 600, py: 1, minWidth: 90, bgcolor: '#fffef0', cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#fff9c4' } }}
                              onClick={() => handleSort(`conversion-${actionId}-named-${fields[0].key}`)}>
                              <Tooltip title={`Named → ${fields[0].label}`}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                                  <Typography variant="caption" sx={{ fontSize: '0.65rem', lineHeight: 1.2 }}>Named→{fields[0].label}</Typography>
                                  <SortIndicator column={`conversion-${actionId}-named-${fields[0].key}`} />
                                </Box>
                              </Tooltip>
                            </TableCell>
                          );
                        }
                        fields.slice(0, -1).forEach((field: any, idx: number) => {
                          const nextField = fields[idx + 1];
                          headers.push(
                            <TableCell key={`conv-header-${actionId}-${field.key}-${nextField.key}`} align="center"
                              sx={{ fontWeight: 600, py: 1, minWidth: 90, bgcolor: '#fffef0', cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#fff9c4' } }}
                              onClick={() => handleSort(`conversion-${actionId}-${field.key}-${nextField.key}`)}>
                              <Tooltip title={`${field.label} → ${nextField.label}`}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                                  <Typography variant="caption" sx={{ fontSize: '0.65rem', lineHeight: 1.2 }}>{field.label}→{nextField.label}</Typography>
                                  <SortIndicator column={`conversion-${actionId}-${field.key}-${nextField.key}`} />
                                </Box>
                              </Tooltip>
                            </TableCell>
                          );
                        });
                        return headers;
                      } else {
                        // Counts mode: Named, then each checkpoint label
                        return [
                          <TableCell key={`cnt-header-${actionId}-named`} align="center"
                            sx={{ fontWeight: 600, py: 1, minWidth: 80, bgcolor: '#f0f4ff' }}>
                            <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>Named</Typography>
                          </TableCell>,
                          ...fields.map((f: any) => (
                            <TableCell key={`cnt-header-${actionId}-${f.key}`} align="center"
                              sx={{ fontWeight: 600, py: 1, minWidth: 80, bgcolor: '#f0f4ff' }}>
                              <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{f.label}</Typography>
                            </TableCell>
                          )),
                        ];
                      }
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
                  
                  {/* Conversion / Counts header columns */}
                  {(displayMode === 'conversions' || displayMode === 'counts') && actionHasConversions && (() => {
                    const fullAction = availableActions?.find((a: any) => a.action_id === actionId);
                    const fields = action?.fields || fullAction?.fields || [];

                    if (displayMode === 'conversions') {
                      const headers: React.ReactNode[] = [];
                      if (fields.length > 0) {
                        headers.push(
                          <TableCell key={`conv-hdr2-${actionId}-named`} align="center"
                            sx={{ fontWeight: 600, py: 1, minWidth: 90, bgcolor: '#fffef0', cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#fff9c4' } }}
                            onClick={() => handleSort(`conversion-${actionId}-named-${fields[0].key}`)}>
                            <Tooltip title={`Named → ${fields[0].label}`}>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                                <Typography variant="caption" sx={{ fontSize: '0.65rem', lineHeight: 1.2 }}>Named→{fields[0].label}</Typography>
                                <SortIndicator column={`conversion-${actionId}-named-${fields[0].key}`} />
                              </Box>
                            </Tooltip>
                          </TableCell>
                        );
                      }
                      fields.slice(0, -1).forEach((field: any, idx: number) => {
                        const nextField = fields[idx + 1];
                        headers.push(
                          <TableCell key={`conv-hdr2-${actionId}-${field.key}-${nextField.key}`} align="center"
                            sx={{ fontWeight: 600, py: 1, minWidth: 90, bgcolor: '#fffef0', cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: '#fff9c4' } }}
                            onClick={() => handleSort(`conversion-${actionId}-${field.key}-${nextField.key}`)}>
                            <Tooltip title={`${field.label} → ${nextField.label}`}>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                                <Typography variant="caption" sx={{ fontSize: '0.65rem', lineHeight: 1.2 }}>{field.label}→{nextField.label}</Typography>
                                <SortIndicator column={`conversion-${actionId}-${field.key}-${nextField.key}`} />
                              </Box>
                            </Tooltip>
                          </TableCell>
                        );
                      });
                      return headers;
                    } else {
                      return [
                        <TableCell key={`cnt-hdr2-${actionId}-named`} align="center" sx={{ fontWeight: 600, py: 1, minWidth: 80, bgcolor: '#f0f4ff' }}>
                          <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>Named</Typography>
                        </TableCell>,
                        ...fields.map((f: any) => (
                          <TableCell key={`cnt-hdr2-${actionId}-${f.key}`} align="center" sx={{ fontWeight: 600, py: 1, minWidth: 80, bgcolor: '#f0f4ff' }}>
                            <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{f.label}</Typography>
                          </TableCell>
                        )),
                      ];
                    }
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
                if (progress) {
                  leadersWithAction++;
                  totalCount += progress.count || 0;
                  totalGoal += progress.goal || 5;
                  if (progress.hasMetGoal) {
                    leadersAtGoalForAction++;
                  }
                }
              });
              
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
                    
                    // Extra columns for conversions/counts display in summary row
                    const actionHasConversions = action && action.fields && action.fields.length >= 2;
                    let conversionColumns = null;
                    if ((displayMode === 'conversions' || displayMode === 'counts') && actionHasConversions) {
                      const fullAction = availableActions?.find((a: any) => a.action_id === actionId);
                      const fields = action?.fields || fullAction?.fields || [];
                      if (displayMode === 'conversions') {
                        // Named→first + pairs: show dashes in summary (can't aggregate rates)
                        const numCols = fields.length; // Named→first + (fields-1) pairs
                        conversionColumns = Array.from({ length: numCols }).map((_, i) => (
                          <TableCell key={`conv-sum-${actionId}-${i}`} align="center" sx={{ py: 1, bgcolor: '#fffef0' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>—</Typography>
                          </TableCell>
                        ));
                      } else {
                        // Counts mode: sum Named (raw) and each checkpoint count across all leaders
                        const totalNamed = allLeaders.reduce((sum, l) => {
                          const p = l.actionProgress?.[actionId] as any;
                          return sum + ((p?.namedCount ?? p?.count) || 0);
                        }, 0);
                        const fieldTotals = fields.map((f: any) =>
                          allLeaders.reduce((sum, leader) => {
                            return sum + (calculateCheckpointCount ? calculateCheckpointCount(leader.id, actionId, f.key) : 0);
                          }, 0)
                        );
                        conversionColumns = [
                          <TableCell key={`cnt-sum-${actionId}-named`} align="center" sx={{ py: 1, bgcolor: '#f0f4ff' }}>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'primary.main' }}>
                              {totalNamed}/{stats.totalGoal}
                            </Typography>
                          </TableCell>,
                          ...fields.map((f: any, i: number) => (
                            <TableCell key={`cnt-sum-${actionId}-${f.key}`} align="center" sx={{ py: 1, bgcolor: '#f0f4ff' }}>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'text.secondary' }}>
                                {fieldTotals[i]}/{stats.totalGoal}
                              </Typography>
                            </TableCell>
                          )),
                        ];
                      }
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
