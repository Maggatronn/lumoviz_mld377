import { useMemo } from 'react';
import { GraphNode, GraphLink } from '../types';
import { getChapterColor } from '../theme/chapterColors';
import { LOE_LEVELS } from '../theme/loeColors';

type NetworkViewType = 'team-members' | 'by-loe' | 'connections';

interface TeamData {
  organizers: Array<{ id: string; name: string; chapter?: string }>;
  lead?: { id: string };
  chapter?: string;
  teamName?: string;
}

interface MeetingData {
  organizer_vanid?: number | string;
  vanid?: number | string;
  organizer?: string;
  contact?: string;
  chapter?: string;
  datestamp?: string;
  meeting_type?: string;
}

interface NetworkResult {
  networkNodes: GraphNode[];
  networkLinks: GraphLink[];
  networkTeamCenters: Array<{ team: TeamData; x: number; y: number; nodes: GraphNode[] }>;
}

interface UseNetworkDataParams {
  teamsData: TeamData[];
  meetingsData: MeetingData[];
  networkView: NetworkViewType;
  selectedLOELevels: Set<string>;
  selectedChapter?: string;
  getLOEStatus: (personId: string) => string;
  getConsistentName: (vanId: any, fallbackName: string | undefined, role: 'organizer' | 'contact', meeting?: any) => string;
  networkStartDate?: string;
  networkEndDate?: string;
}

/**
 * Build name-based ID merges for deduplicating people across teams and meetings
 */
export const buildNameBasedMerges = (
  teamsData: TeamData[],
  meetingsData: MeetingData[]
): Map<string, string> => {
  const merges = new Map<string, string>();
  
  if (!teamsData || !meetingsData) return merges;
  
  // Name variation mapping
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
  
  // Get all team members and merge duplicates by name
  const teamMembers = new Map<string, { id: string; name: string; normalizedFirstName: string }>();
  const nameToIds = new Map<string, Set<string>>();
  
  teamsData.forEach(team => {
    if (team.organizers) {
      team.organizers.forEach((member) => {
        const memberId = String(member.id || '');
        const memberName = member.name || '';
        const firstName = memberName.split(' ')[0]?.toLowerCase().trim();
        const normalizedFirstName = normalizeFirstName(firstName);
        
        if (memberId && firstName) {
          if (!nameToIds.has(normalizedFirstName)) {
            nameToIds.set(normalizedFirstName, new Set());
          }
          nameToIds.get(normalizedFirstName)!.add(memberId);
          
          if (!teamMembers.has(normalizedFirstName)) {
            teamMembers.set(normalizedFirstName, {
              id: memberId,
              name: memberName,
              normalizedFirstName
            });
          }
        }
      });
    }
  });
  
  // Create merges for duplicate team member IDs
  nameToIds.forEach((ids, normalizedName) => {
    if (ids.size > 1) {
      const canonical = teamMembers.get(normalizedName);
      if (canonical) {
        ids.forEach(id => {
          if (id !== canonical.id) {
            merges.set(id, canonical.id);
          }
        });
      }
    }
  });
  
  // Find organizers in meetings who have same normalized first name as team members
  meetingsData.forEach((meeting) => {
    const organizerVanId = String(meeting.organizer_vanid || '');
    const organizerName = meeting.organizer || '';
    const organizerFirstName = organizerName.split(' ')[0]?.toLowerCase().trim();
    const normalizedOrganizerFirstName = normalizeFirstName(organizerFirstName);
    
    if (organizerVanId && normalizedOrganizerFirstName && teamMembers.has(normalizedOrganizerFirstName)) {
      const teamMember = teamMembers.get(normalizedOrganizerFirstName)!;
      if (organizerVanId !== teamMember.id) {
        merges.set(organizerVanId, teamMember.id);
      }
    }
  });
  
  return merges;
};

/**
 * Process network data based on selected view
 */
export const useNetworkData = ({
  teamsData,
  meetingsData,
  networkView,
  selectedLOELevels,
  selectedChapter,
  getLOEStatus,
  getConsistentName,
  networkStartDate,
  networkEndDate
}: UseNetworkDataParams): NetworkResult => {
  
  const nameMerges = useMemo(() => 
    buildNameBasedMerges(teamsData, meetingsData), 
    [teamsData, meetingsData]
  );
  
  return useMemo(() => {
    if (!teamsData || teamsData.length === 0) {
      return { networkNodes: [], networkLinks: [], networkTeamCenters: [] };
    }
    
    // Filter meetings by date range if provided (do NOT filter by chapter here - done at render time)
    const filteredMeetingsData = (meetingsData || []).filter((meeting: any) => {
      if (!networkStartDate || !networkEndDate) return true;
      if (!meeting.datestamp) return false;
      
      // Extract date string from datestamp (could be string or object with value)
      const datestamp: any = meeting.datestamp;
      const meetingDateStr = typeof datestamp === 'string' 
        ? datestamp 
        : (datestamp?.value || String(datestamp));
      
      // Extract just the date part (YYYY-MM-DD) for comparison
      const meetingDateOnly = meetingDateStr.split('T')[0];
      
      return meetingDateOnly >= networkStartDate && meetingDateOnly <= networkEndDate;
    });
    
    // console.log('🔍 Network Data Debug (ONE TIME):', {
    //   totalMeetings: meetingsData?.length || 0,
    //   filteredMeetings: filteredMeetingsData.length,
    //   dateRange: { start: networkStartDate, end: networkEndDate }
    // });
    
    // Build network with ALL teams/chapters - filtering by chapter happens in the component render
    const filteredTeamsData = teamsData;
    
    if (filteredTeamsData.length === 0) {
      return { networkNodes: [], networkLinks: [], networkTeamCenters: [] };
    }
    
    const getCanonicalId = (id: string): string => nameMerges.get(id) || id;
    
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const teamCenters: Array<{ team: TeamData; x: number; y: number; nodes: GraphNode[] }> = [];
    const globalNodeMap = new Map<string, GraphNode>();
    const personToTeams = new Map<string, Set<string>>();
    
    // Process based on view
    if (networkView === 'team-members') {
      processTeamMembersView();
    } else if (networkView === 'by-loe') {
      processByLOEView();
    } else if (networkView === 'connections') {
      processConnectionsView();
    }
    
    function processTeamMembersView() {
      // First pass: collect all unique people and their team memberships
      filteredTeamsData.forEach((team, teamIndex) => {
        if (!team.organizers || team.organizers.length === 0) return;
        
        team.organizers.forEach((member) => {
          const originalPersonId = String(member.id || `unknown-${Math.random()}`);
          const personId = getCanonicalId(originalPersonId);
          
          if (!personToTeams.has(personId)) {
            personToTeams.set(personId, new Set());
          }
          personToTeams.get(personId)!.add(`team-${teamIndex}`);
          
          if (!globalNodeMap.has(personId)) {
            const node: GraphNode = {
              id: personId,
              name: member.name || `Member ${personId}`,
              chapter: team.chapter || member.chapter || 'Unknown',
              type: member.id === team.lead?.id ? 'team_lead' : 'team_member',
              color: member.id === team.lead?.id ? '#e91e63' : '#1976d2',
              loeStatus: getLOEStatus(originalPersonId),
              x: 0,
              y: 0,
              degree: 0
            };
            
            globalNodeMap.set(personId, node);
            nodes.push(node);
          }
        });
      });

      // Position teams in a grid layout
      const teamsPerRow = Math.ceil(Math.sqrt(filteredTeamsData.length));
      const teamSpacing = 300;

      filteredTeamsData.forEach((team, teamIndex) => {
        if (!team.organizers || team.organizers.length === 0) return;

        const row = Math.floor(teamIndex / teamsPerRow);
        const col = teamIndex % teamsPerRow;
        const teamCenterX = Math.max(100, Math.min(700, 150 + col * teamSpacing));
        const teamCenterY = Math.max(100, Math.min(500, 150 + row * teamSpacing));

        const teamNodes: GraphNode[] = [];

        team.organizers.forEach((member, memberIndex) => {
          const personId = getCanonicalId(String(member.id || `unknown-${Math.random()}`));
          const node = globalNodeMap.get(personId);
          
          if (node) {
            if (node.x === 0 && node.y === 0) {
              const angle = (memberIndex / team.organizers.length) * 2 * Math.PI;
              const radius = 50 + Math.random() * 30;
              
              node.x = Math.max(50, Math.min(750, teamCenterX + Math.cos(angle) * radius));
              node.y = Math.max(50, Math.min(550, teamCenterY + Math.sin(angle) * radius));
            }
            
            teamNodes.push(node);
          }
        });

        teamCenters.push({
          team,
          x: teamCenterX,
          y: teamCenterY,
          nodes: teamNodes
        });

        // Create links between all team members
        for (let i = 0; i < teamNodes.length; i++) {
          for (let j = i + 1; j < teamNodes.length; j++) {
            const source = teamNodes[i];
            const target = teamNodes[j];
            
            if (source && target) {
              links.push({
                source: source.id,
                target: target.id,
                date: new Date(),
                type: 'team_connection',
                result: 'team_member',
                utc_datecanvassed: new Date().toISOString(),
                contact_type: 'team_connection',
                contact_result: 'team_member',
                linkSource: 'teams',
                teamName: team.teamName || team.chapter
              });
              
              source.degree = (source.degree || 0) + 1;
              target.degree = (target.degree || 0) + 1;
            }
          }
        }
      });

      // Handle multi-team members
      personToTeams.forEach((teams, personId) => {
        if (teams.size > 1) {
          const person = globalNodeMap.get(personId);
          if (person) {
            person.type = 'multi_team_member';
            person.color = '#ff9800';
          }
        }
      });
    }
    
    function processConnectionsView() {
      // Start with team members view to get all team nodes and connections
      processTeamMembersView();
      
      // Get team member IDs from filtered teams (by chapter)
      const teamMemberIds = new Set<string>();
      filteredTeamsData.forEach(team => {
        team.organizers?.forEach(member => {
          const canonicalId = getCanonicalId(String(member.id));
          teamMemberIds.add(canonicalId);
        });
      });
      
      // Store team connections to preserve them
      const teamConnections = links.filter(l => l.linkSource === 'teams' || l.type === 'team_connection');
      
      // Only add conversation data if we have meetings
      if (filteredMeetingsData && filteredMeetingsData.length > 0) {
        // Add conversation participants as nodes (without clearing existing team nodes)
        filteredMeetingsData.forEach((meeting) => {
          const organizerVanId = String(meeting.organizer_vanid || '');
          const participantVanId = String(meeting.vanid || '');
          const organizerName = getConsistentName(meeting.organizer_vanid, meeting.organizer || '', 'organizer', meeting);
          const participantName = getConsistentName(meeting.vanid, meeting.contact || '', 'contact', meeting);
          
          // Skip if chapter is filtered and neither organizer nor participant is a team member
          const organizerNodeId = getCanonicalId(organizerVanId);
          const participantNodeId = getCanonicalId(participantVanId);
          
          if (selectedChapter && selectedChapter !== 'All Chapters') {
            // Only include meetings where at least one person is from the filtered team
            const hasTeamConnection = teamMemberIds.has(organizerNodeId) || teamMemberIds.has(participantNodeId);
            if (!hasTeamConnection) {
              return; // Skip this meeting
            }
          }
          
          // Add organizer node if not already present
          if (organizerVanId && organizerName) {
            const nodeId = getCanonicalId(organizerVanId);
            if (!globalNodeMap.has(nodeId)) {
              const node: GraphNode = {
                id: nodeId,
                name: organizerName,
                chapter: meeting.chapter || 'Unknown',
                type: 'active_organizer',
                color: '#ff9800',
                loeStatus: getLOEStatus(organizerVanId),
                x: Math.random() * 800,
                y: Math.random() * 600,
                degree: 1
              };
              globalNodeMap.set(nodeId, node);
              nodes.push(node);
            } else {
              // Update degree for existing node
              const existingNode = globalNodeMap.get(nodeId);
              if (existingNode) {
                existingNode.degree = (existingNode.degree || 0) + 1;
              }
            }
          }
          
          // Add participant node if not already present
          if (participantVanId && participantName) {
            const nodeId = getCanonicalId(participantVanId);
            if (!globalNodeMap.has(nodeId)) {
              const node: GraphNode = {
                id: nodeId,
                name: participantName,
                chapter: meeting.chapter || 'Unknown',
                type: 'conversation_partner',
                color: '#9c27b0',
                loeStatus: getLOEStatus(participantVanId),
                x: Math.random() * 800,
                y: Math.random() * 600,
                degree: 0
              };
              globalNodeMap.set(nodeId, node);
              nodes.push(node);
            }
          }
        });
        
        // Create conversation links (in addition to existing team links)
        filteredMeetingsData.forEach((meeting) => {
          const organizerVanId = String(meeting.organizer_vanid || '');
          const participantVanId = String(meeting.vanid || '');
          
          if (organizerVanId && participantVanId) {
            const organizerNodeId = getCanonicalId(organizerVanId);
            const participantNodeId = getCanonicalId(participantVanId);
            
            const organizerNode = globalNodeMap.get(organizerNodeId);
            const participantNode = globalNodeMap.get(participantNodeId);
            
            if (organizerNode && participantNode) {
              // Check if this conversation link already exists
              const existingConversationLink = links.find(l => {
                const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
                const targetId = typeof l.target === 'string' ? l.target : l.target.id;
                return l.linkSource === 'meetings' && 
                       ((sourceId === organizerNodeId && targetId === participantNodeId) ||
                        (sourceId === participantNodeId && targetId === organizerNodeId));
              });
              
              if (!existingConversationLink) {
                links.push({
                  source: organizerNodeId,
                  target: participantNodeId,
                  date: new Date(meeting.datestamp || Date.now()),
                  type: 'conversation',
                  result: 'conversation',
                  utc_datecanvassed: meeting.datestamp || '',
                  contact_type: meeting.meeting_type || 'conversation',
                  contact_result: 'completed',
                  linkSource: 'meetings',
                  meetingId: `meeting-${meeting.organizer_vanid}-${meeting.vanid}-${meeting.datestamp}`
                });
              }
            }
          }
        });
      }
      
      // Ensure all team connections are still present (re-add if they were somehow lost)
      teamConnections.forEach(teamLink => {
        const sourceId = typeof teamLink.source === 'string' ? teamLink.source : teamLink.source.id;
        const targetId = typeof teamLink.target === 'string' ? teamLink.target : teamLink.target.id;
        
        const existingLink = links.find(l => {
          const lSourceId = typeof l.source === 'string' ? l.source : l.source.id;
          const lTargetId = typeof l.target === 'string' ? l.target : l.target.id;
          return l.linkSource === 'teams' &&
                 ((lSourceId === sourceId && lTargetId === targetId) ||
                  (lSourceId === targetId && lTargetId === sourceId));
        });
        
        if (!existingLink) {
          links.push(teamLink);
        }
      });
    }
    
    function processByLOEView() {
      // Get LOE category for filtering
      const getLOECategory = (nodeId: string, loeStatus: string, isTeamMember: boolean = false): string => {
        if (isTeamMember) return 'staff';
        if (!loeStatus || loeStatus === 'Unknown') return 'unknown';
        
        if (loeStatus.toLowerCase().includes('staff') || 
            loeStatus.toLowerCase().includes('organizer')) {
          return 'staff';
        }
        
        const loeLevel = LOE_LEVELS.find(level => {
          const statusLower = loeStatus.toLowerCase();
          const levelStr = level.level.toString();
          const keyLower = level.key.toLowerCase();
          const labelLower = level.label.toLowerCase();
          
          return statusLower.includes(levelStr + '.') ||
                 statusLower.includes(levelStr + '_') ||
                 statusLower.includes(keyLower) ||
                 statusLower.includes(labelLower);
        });
        
        return loeLevel ? loeLevel.key : 'unknown';
      };
      
      // Run connections view first
      processConnectionsView();
      
      // Get team member IDs
      const teamMemberIds = new Set<string>();
      filteredTeamsData?.forEach((team) => {
        if (team.organizers) {
          team.organizers.forEach((member) => {
            const canonicalId = getCanonicalId(member.id);
            teamMemberIds.add(canonicalId);
          });
        }
      });
      
      // Update LOE classification for team members
      nodes.forEach(node => {
        if (teamMemberIds.has(node.id)) {
          node.loeStatus = 'Staff/Organizer';
        }
      });
      
      // Filter nodes by LOE levels
      const filteredNodes = nodes.filter(node => {
        const isTeamMember = teamMemberIds.has(node.id);
        const loeStatus = node.loeStatus || getLOEStatus(node.id);
        const loeCategory = getLOECategory(node.id, loeStatus, isTeamMember);
        return selectedLOELevels.has(loeCategory);
      });
      
      nodes.length = 0;
      nodes.push(...filteredNodes);
      
      // Filter links
      const validNodeIds = new Set(nodes.map(node => node.id));
      const filteredLinks = links.filter(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        return validNodeIds.has(sourceId) && validNodeIds.has(targetId);
      });
      
      links.length = 0;
      links.push(...filteredLinks);
    }
    
    return { networkNodes: nodes, networkLinks: links, networkTeamCenters: teamCenters };
  }, [teamsData, meetingsData, networkView, selectedLOELevels, nameMerges, networkStartDate, networkEndDate]); // Removed selectedChapter, getLOEStatus, getConsistentName to prevent recalculation
};
