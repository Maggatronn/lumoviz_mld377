import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { Box } from '@mui/material';
import { getChapterColor } from '../../theme/chapterColors';
import { getCustomChapterColor } from '../../contexts/ChapterColorContext';
import { getLOEColor } from '../../theme/loeColors';

const PENGUIN_GIF = 'https://cdn3.emoji.gg/emojis/5709-dancing-penguin.gif';

// Types
interface Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  chapter: string;
  type?: string;
  color?: string;
  role?: string;
  vanid?: number;
  loeStatus?: string;
  teams?: string[];
  is_external?: boolean;
  degree?: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link {
  source: Node;
  target: Node;
  value: number;
  date: Date;
  type: string;
  result: string;
  utc_datecanvassed: string | undefined;
  contact_type: string | undefined;
  contact_result: string | undefined;
}

interface GraphLink {
  id?: string;
  source: Node | string;
  target: Node | string;
  date?: Date;
  type?: string;
  result?: string;
  utc_datecanvassed?: string;
  contact_type?: string;
  contact_result?: string;
  linkSource?: 'meetings' | 'teams' | 'contacts' | 'org' | 'people_table' | 'section_leader';
  meetingId?: string;
  meetingCount?: number;
  twoOnOneRole?: 'organizer' | 'host';
  teamName?: string;
  teams?: string[];
}

interface NetworkGraphProps {
  nodes: Node[];
  links: GraphLink[];
  allLinks: GraphLink[];
  colorMode: 'status' | 'loe' | 'chapter';
  selectedChapter: string;
  currentDateRange?: { start: Date; end: Date } | null;
  meetingsData?: any[];
  userMap: Map<string, any>;
  adminUserIds: Set<string>;
  dataSource: 'contacts' | 'meetings' | 'teams';
  selectedNodeId?: string | null;
  onNodeClick?: (nodeId: string | null) => void;
  onNodeHover?: (nodeId: string | null) => void;
  hoveredMeetingId?: string | null;
  nodeFilters?: any;
  onNodesChange?: (nodes: Node[]) => void;
  teamCenters?: Array<{ team: any, x: number, y: number, nodes: Node[] }>;
  customColors?: Record<string, any>;
  searchText?: string;
}

// Helper function to create LOE-based shades of team colors
const getLOEShadeOfTeamColor = (baseColor: string, loeStatus: string): string => {
  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  // Convert RGB to hex
  const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  const rgb = hexToRgb(baseColor);
  
  // Define shade multipliers based on LOE status
  let shadeMultiplier = 1.0; // Default (no change)
  
  if (!loeStatus || loeStatus === 'Unknown') {
    shadeMultiplier = 0.3; // Very light (30% of original)
  } else if (loeStatus.toLowerCase().includes('staff') || loeStatus.toLowerCase().includes('organizer')) {
    shadeMultiplier = 1.0; // Full color for staff
  } else if (loeStatus.includes('1.') || loeStatus.toLowerCase().includes('leader')) {
    shadeMultiplier = 0.85; // 85% for leaders
  } else if (loeStatus.includes('2.') || loeStatus.toLowerCase().includes('activist')) {
    shadeMultiplier = 0.7; // 70% for activists
  } else if (loeStatus.includes('3.') || loeStatus.toLowerCase().includes('member')) {
    shadeMultiplier = 0.55; // 55% for members
  } else if (loeStatus.includes('4.') || loeStatus.toLowerCase().includes('supporter')) {
    shadeMultiplier = 0.4; // 40% for supporters
  } else if (loeStatus.includes('5.') || loeStatus.toLowerCase().includes('prospect')) {
    shadeMultiplier = 0.25; // 25% for prospects (very light)
  }
  
  // Apply shade multiplier by darkening the color
  const shadedR = Math.round(rgb.r * shadeMultiplier);
  const shadedG = Math.round(rgb.g * shadeMultiplier);
  const shadedB = Math.round(rgb.b * shadeMultiplier);
  
  const result = rgbToHex(shadedR, shadedG, shadedB);
  
  return result;
};

const NetworkGraph: React.FC<NetworkGraphProps> = ({
  nodes,
  links,
  allLinks,
  colorMode,
  selectedChapter,
  currentDateRange,
  meetingsData,
  userMap,
  adminUserIds,
  dataSource,
  selectedNodeId,
  onNodeClick,
  onNodeHover,
  hoveredMeetingId,
  nodeFilters,
  onNodesChange,
  teamCenters,
  customColors = {},
  searchText = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const animationFrameRef = useRef<number | null>(null);
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);
  const [tooltip, setTooltip] = React.useState<{ x: number; y: number; name: string } | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const shakeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startShaking = useCallback(() => {
    setIsShaking(true);
    const sim = simulationRef.current;
    if (!sim) return;
    sim.alpha(1).restart();
    shakeIntervalRef.current = setInterval(() => {
      if (simulationRef.current) {
        simulationRef.current.alpha(0.8);
      }
    }, 100);
  }, []);

  const stopShaking = useCallback(() => {
    setIsShaking(false);
    if (shakeIntervalRef.current) {
      clearInterval(shakeIntervalRef.current);
      shakeIntervalRef.current = null;
    }
    if (simulationRef.current) {
      simulationRef.current.alphaTarget(0);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (shakeIntervalRef.current) clearInterval(shakeIntervalRef.current);
    };
  }, []);

  // Function to find node under mouse cursor
  const findNodeAtPosition = useCallback((mouseX: number, mouseY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const transform = transformRef.current;
    
    // Convert screen coordinates to canvas coordinates
    const canvasX = (mouseX - rect.left - transform.x) / transform.k;
    const canvasY = (mouseY - rect.top - transform.y) / transform.k;

    // Find the closest node within a reasonable distance
    for (const node of nodes) {
      if (!node.x || !node.y) continue;
      
      const distance = Math.sqrt(
        Math.pow(canvasX - node.x, 2) + Math.pow(canvasY - node.y, 2)
      );
      
      // Check if mouse is within node radius (with some padding)
      const nodeSize = Math.min(25, Math.max(5, 5 + Math.log2(node.degree || 1) * 3));
      if (distance <= nodeSize + 5) {
        return node;
      }
    }
    
    return null;
  }, [nodes]);

  // Handle mouse move for tooltips
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const node = findNodeAtPosition(event.clientX, event.clientY);
    
    if (node) {
      setTooltip({
        x: event.clientX,
        y: event.clientY,
        name: node.name
      });
    } else {
      setTooltip(null);
    }
  }, [findNodeAtPosition]);

  // Handle mouse leave to hide tooltip
  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // Canvas rendering function
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const transform = transformRef.current;
    
    // Clear the canvas completely
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.save();
    
    // Apply zoom/pan transform
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // Aggregate links by endpoints to count meetings and determine properties
    const linkAggregates = new Map<string, {
      source: Node;
      target: Node;
      meetingCount: number;
      teamName?: string;
      linkSource?: string;
      type: string;
      isHighlighted: boolean;
      meetingIds: string[];
    }>();

    allLinks.forEach(link => {
      if (!link.source || !link.target) return;
      
      // Handle both string IDs and Node objects
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      
      // Look up actual node objects
      const source = typeof link.source === 'string' ? nodes.find(n => n.id === sourceId) : link.source as Node;
      const target = typeof link.target === 'string' ? nodes.find(n => n.id === targetId) : link.target as Node;
      
      // Skip if nodes not found
      if (!source || !target) return;
      
      // Create a consistent key for the link (bidirectional)
      const linkKey = [source.id, target.id].sort().join('-');
      
      const isHighlighted = hoveredMeetingId && link.meetingId === hoveredMeetingId;
      
      if (!linkAggregates.has(linkKey)) {
        linkAggregates.set(linkKey, {
          source,
          target,
          meetingCount: 0,
          teamName: link.teamName,
          linkSource: link.linkSource,
          type: (link as any).type || 'default',
          isHighlighted: false,
          meetingIds: []
        });
      }
      
      const aggregate = linkAggregates.get(linkKey)!;
      aggregate.meetingCount++;
      if (isHighlighted) aggregate.isHighlighted = true;
      if (link.meetingId) aggregate.meetingIds.push(link.meetingId);
      
      // Prefer team information if available
      if (link.teamName && !aggregate.teamName) {
        aggregate.teamName = link.teamName;
      }
      if (link.linkSource && !aggregate.linkSource) {
        aggregate.linkSource = link.linkSource;
      }
    });


    // Render aggregated links first (so they appear behind nodes)
    ctx.globalAlpha = 0.6;
    linkAggregates.forEach(aggregate => {
      const { source, target, meetingCount, teamName, linkSource, type, isHighlighted } = aggregate;
      
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      
      // Calculate edge width based on meeting count with more pronounced scaling
      const baseWidth = 1;
      const maxWidth = 8;
      // Use logarithmic scaling for better visual distinction
      // 1 meeting = 1px, 2 meetings = 2px, 5 meetings = 3.5px, 10 meetings = 5px, 20+ meetings = 8px
      const edgeWidth = meetingCount === 0 
        ? baseWidth 
        : Math.min(baseWidth + Math.log2(meetingCount) * 1.2, maxWidth);
      
      // Determine edge color and style
      if (isHighlighted) {
        ctx.strokeStyle = '#ff6b35';
        ctx.lineWidth = Math.max(edgeWidth, 3);
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
      } else if (type === 'section_leader' || linkSource === 'section_leader') {
        // Section leader → team representative: dashed line in receiving team's color
        const sectionChapter = target.chapter || source.chapter;
        let sectionColor = '#7c4dff';
        if (sectionChapter && customColors) {
          sectionColor = getCustomChapterColor(sectionChapter, customColors);
        }
        ctx.strokeStyle = sectionColor;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.75;
        ctx.setLineDash([10, 5]);
      } else if (type === 'inter_team_connection') {
        // Inter-team connections: Orange dashed lines
        ctx.strokeStyle = '#ff9800';
        ctx.lineWidth = Math.max(edgeWidth, 2);
        ctx.globalAlpha = 0.8;
        ctx.setLineDash([5, 5]); // Dashed line
      } else if (type === 'team_connection' || linkSource === 'teams') {
        // Team connections: Use team/chapter color
        let teamColor = '#1976d2'; // Default blue
        
        if (teamName) {
          const nodeChapter = source.chapter || target.chapter;
          if (nodeChapter && customColors) {
            teamColor = getCustomChapterColor(nodeChapter, customColors);
          }
        }
        
        ctx.strokeStyle = teamColor;
        ctx.lineWidth = Math.max(edgeWidth, 1.5);
        ctx.globalAlpha = 0.7;
        ctx.setLineDash([]);
      } else if (type === 'constituent') {
        // Constituent → organizer: thin, light line in organizer's chapter color
        const orgChapter = source.chapter || target.chapter;
        let constituentColor = '#bbb';
        if (orgChapter && customColors) {
          constituentColor = getCustomChapterColor(orgChapter, customColors);
        }
        ctx.strokeStyle = constituentColor;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.25;
        ctx.setLineDash([]);
      } else {
        // Default style
        ctx.strokeStyle = '#999';
        ctx.lineWidth = edgeWidth;
        ctx.globalAlpha = 0.6;
        ctx.setLineDash([]); // Solid line
      }
      
      ctx.stroke();
    });

    // Render nodes
    ctx.globalAlpha = 1;
    nodes.forEach(node => {
      if (!node.x || !node.y) return;

      const isSelected = selectedNodeId === node.id;
      const isMultiTeam = node.type === 'multi_team_member';
      const isLead = node.type === 'team_lead';
      const isSectionLeader = node.type === 'section_leader';
      const isConstituent = node.type === 'constituent';
      
      // Calculate base node size from degree (centrality), with bonuses for special types
      let nodeSize = Math.min(25, Math.max(5, 5 + Math.log2(node.degree || 1) * 3));
      if (isMultiTeam) nodeSize += 3;
      if (isLead) nodeSize += 2;
      if (isSectionLeader) nodeSize = Math.max(nodeSize + 10, 18);
      if (isConstituent) nodeSize = Math.max(4, nodeSize - 2);

      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
      
      // Node fill - determine color based on type and LOE
      let nodeColor: string;
      let nodeStrokeColor: string = isSelected ? '#ff6b35' : '#fff';
      let nodeStrokeWidth: number = isSelected ? 3 : 1.5;
      
      if (isConstituent) {
        const chapterColor = getCustomChapterColor(node.chapter, customColors);
        const loe = (node.loeStatus || '').toLowerCase();
        
        if (loe.includes('teamleader') || loe.includes('1_')) {
          // Leaders: full chapter color
          nodeColor = chapterColor;
          nodeStrokeColor = isSelected ? '#ff6b35' : chapterColor;
        } else if (loe.includes('teammember') || loe.includes('member') || loe.includes('2_') || loe.includes('3_')) {
          // Potential Leaders (TeamMember/Member): 40% opacity via alpha blend with white
          const r = parseInt(chapterColor.slice(1, 3), 16);
          const g = parseInt(chapterColor.slice(3, 5), 16);
          const b = parseInt(chapterColor.slice(5, 7), 16);
          nodeColor = `rgba(${r}, ${g}, ${b}, 0.4)`;
          nodeStrokeColor = isSelected ? '#ff6b35' : chapterColor;
          nodeStrokeWidth = isSelected ? 3 : 1.5;
        } else if (loe.includes('supporter') || loe.includes('4_')) {
          // Supporters: white fill with chapter color stroke
          nodeColor = '#ffffff';
          nodeStrokeColor = isSelected ? '#ff6b35' : chapterColor;
          nodeStrokeWidth = isSelected ? 3 : 1.5;
        } else {
          // Unknown / null: grey
          nodeColor = '#cccccc';
          nodeStrokeColor = isSelected ? '#ff6b35' : '#999999';
        }
      } else if (colorMode === 'loe') {
        const baseTeamColor = getCustomChapterColor(node.chapter, customColors);
        const loeStatus = (node as any).loeStatus || 'Unknown';
        nodeColor = getLOEShadeOfTeamColor(baseTeamColor, loeStatus);
      } else {
        nodeColor = getCustomChapterColor(node.chapter, customColors);
      }
      
      ctx.fillStyle = isSelected ? '#ff6b35' : nodeColor;
      ctx.fill();
      
      // Special border for multi-team members
      if (isMultiTeam && !isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeSize + 1, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ff9800';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      
      // Regular node border
      ctx.strokeStyle = nodeStrokeColor;
      ctx.lineWidth = nodeStrokeWidth;
      ctx.setLineDash([]);
      ctx.stroke();

      // Gold double-ring for section leaders (Teaching Team members)
      if (isSectionLeader && !isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeSize + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeSize + 8, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }


      // Check if node matches search criteria
      const matchesSearch = !searchText || 
        node.name.toLowerCase().includes(searchText.toLowerCase()) ||
        node.teams?.some(team => team.toLowerCase().includes(searchText.toLowerCase())) ||
        node.chapter.toLowerCase().includes(searchText.toLowerCase());
      
      // Dim non-matching nodes when search is active
      const hasActiveSearch = searchText && searchText.length > 0;
      if (hasActiveSearch && !matchesSearch && !isSelected) {
        ctx.globalAlpha = 0.25; // Make non-matching nodes very dim
      }
      
      // Draw search highlight ring if matches search - make it very prominent
      if (hasActiveSearch && matchesSearch && !isSelected) {
        // Outer glow ring
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)'; // Gold with transparency
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeSize + 8, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Middle ring
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.7)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeSize + 5, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Inner bright ring
        ctx.strokeStyle = '#FFD700'; // Solid gold
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeSize + 2, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // Node label - always show labels, with enhanced visibility for search matches
      const shouldShowLabel = nodeSize > 4 || matchesSearch || isSelected || isSectionLeader;
      if (shouldShowLabel) {
        const fontSize = matchesSearch || isSelected || isSectionLeader ? 13 : Math.min(12, nodeSize);
        const fontWeight = matchesSearch || isSelected || isSectionLeader ? 'bold' : 'normal';
        
        // Add background box for search match labels to make them stand out
        if (hasActiveSearch && matchesSearch && !isSelected) {
          ctx.globalAlpha = 1.0; // Full opacity for label background
          const textWidth = ctx.measureText(node.name).width;
          const padding = 4;
          ctx.fillStyle = '#FFD700'; // Gold background
          ctx.fillRect(
            node.x - textWidth / 2 - padding,
            node.y + nodeSize + 6 - padding,
            textWidth + padding * 2,
            fontSize + padding * 2
          );
        }
        
        ctx.fillStyle = matchesSearch ? '#000' : '#333';
        ctx.font = `${fontWeight} ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const text = node.name || node.id;
        const maxWidth = matchesSearch || isSectionLeader ? nodeSize * 5 : nodeSize * 3;
        
        // Truncate text if too long
        let displayText = text;
        if (ctx.measureText(text).width > maxWidth) {
          displayText = text.substring(0, Math.floor(text.length * maxWidth / ctx.measureText(text).width)) + '...';
        }
        
        // Add prominent background to label for search matches
        ctx.globalAlpha = 1.0; // Full opacity for label
        if (hasActiveSearch && matchesSearch) {
          const textWidth = ctx.measureText(displayText).width;
          // Black text on bright gold background for maximum contrast
          ctx.fillStyle = '#FFD700';
          ctx.fillRect(
            node.x - textWidth / 2 - 6,
            node.y + nodeSize + 6,
            textWidth + 12,
            fontSize + 8
          );
          ctx.fillStyle = '#000000'; // Black text
        } else if (matchesSearch || isSelected) {
          const textWidth = ctx.measureText(displayText).width;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(
            node.x - textWidth / 2 - 4,
            node.y + nodeSize + 6,
            textWidth + 8,
            fontSize + 6
          );
          ctx.fillStyle = matchesSearch ? '#000' : '#333';
        }
        
        ctx.fillText(displayText, node.x, node.y + nodeSize + 12);
      }
      
      // Reset alpha after each node
      ctx.globalAlpha = 1.0;
    });

    // Team name labels at the centroid of each team's nodes
    if (dataSource === 'teams') {
      const teamPositions = new Map<string, { sumX: number; sumY: number; count: number; color: string }>();
      
      nodes.forEach(node => {
        if (!node.x || !node.y || !node.teams) return;
        node.teams.forEach(teamName => {
          if (!teamPositions.has(teamName)) {
            teamPositions.set(teamName, { sumX: 0, sumY: 0, count: 0, color: getCustomChapterColor(node.chapter, customColors) });
          }
          const pos = teamPositions.get(teamName)!;
          pos.sumX += node.x;
          pos.sumY += node.y;
          pos.count++;
        });
      });

      teamPositions.forEach((pos, teamName) => {
        if (pos.count < 2) return;
        const cx = pos.sumX / pos.count;
        const cy = pos.sumY / pos.count;

        const fontSize = 14;
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textWidth = ctx.measureText(teamName).width;

        // Semi-transparent background pill
        const padX = 8, padY = 4;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        const rx = cx - textWidth / 2 - padX;
        const ry = cy - fontSize / 2 - padY;
        const rw = textWidth + padX * 2;
        const rh = fontSize + padY * 2;
        const radius = rh / 2;
        ctx.beginPath();
        ctx.moveTo(rx + radius, ry);
        ctx.lineTo(rx + rw - radius, ry);
        ctx.arcTo(rx + rw, ry, rx + rw, ry + radius, radius);
        ctx.lineTo(rx + rw, ry + rh - radius);
        ctx.arcTo(rx + rw, ry + rh, rx + rw - radius, ry + rh, radius);
        ctx.lineTo(rx + radius, ry + rh);
        ctx.arcTo(rx, ry + rh, rx, ry + rh - radius, radius);
        ctx.lineTo(rx, ry + radius);
        ctx.arcTo(rx, ry, rx + radius, ry, radius);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = pos.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = pos.color;
        ctx.globalAlpha = 0.9;
        ctx.fillText(teamName, cx, cy);
        ctx.globalAlpha = 1.0;
      });
    }

    ctx.restore();
  }, [nodes, allLinks, selectedNodeId, hoveredMeetingId, teamCenters, customColors, searchText, dataSource]);

  // Setup D3 force simulation
  // Track whether canvas was hidden so we can re-initialize on becoming visible
  const wasHiddenRef = useRef(false);
  const [visibilityTrigger, setVisibilityTrigger] = useState(0);

  // Resize observer to handle container size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const devicePixelRatio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      // Skip if container is hidden (display:none gives 0x0) — don't corrupt the canvas
      if (rect.width === 0 || rect.height === 0) {
        wasHiddenRef.current = true;
        return;
      }

      // If we were hidden and now visible, trigger re-initialization
      if (wasHiddenRef.current) {
        wasHiddenRef.current = false;
        setVisibilityTrigger(v => v + 1);
        return;
      }

      // Only update if size actually changed
      if (canvas.width !== rect.width * devicePixelRatio || canvas.height !== rect.height * devicePixelRatio) {
        canvas.width = rect.width * devicePixelRatio;
        canvas.height = rect.height * devicePixelRatio;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        ctx.scale(devicePixelRatio, devicePixelRatio);

        // Re-render with new dimensions
        renderCanvas();
      }
    });

    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
    };
  }, [renderCanvas]);

  useEffect(() => {
    // For teams visualization, we can show nodes even without links
    const requiresLinks = dataSource !== 'teams';
    const hasMinimumData = nodes.length > 0 && (requiresLinks ? allLinks.length > 0 : true);
    
    if (!canvasRef.current || !hasMinimumData) {
      return;
    }
    
    // Stop any existing simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    // Cancel any existing animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }


    // Setup canvas
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('❌ NetworkGraph: Failed to get canvas context');
      return;
    }

    // Prevent high-DPI scaling issues
    const devicePixelRatio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    // Skip setup if container is hidden (0x0 dimensions)
    if (rect.width === 0 || rect.height === 0) {
      return;
    }
    
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Create a map of node objects by ID for quick lookup
    const nodeById = new Map(nodes.map(node => [node.id, node]));

    // Aggregate links for simulation (same logic as rendering)
    const simulationLinkAggregates = new Map<string, {
      source: string;
      target: string;
      meetingCount: number;
      teamName?: string;
      linkSource?: string;
      type: string;
    }>();

    // Filter out invalid links before processing
    const validLinks = allLinks.filter((link, linkIndex) => {
      if (!link.source || !link.target) {
        return false;
      }
      
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      
      if (!sourceId || !targetId || sourceId === targetId) {
        return false;
      }
      
      return true;
    });
    validLinks.forEach((link, linkIndex) => {
      
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      
      // Create a consistent key for the link (bidirectional)
      const linkKey = [sourceId, targetId].sort().join('-');
      
      if (!simulationLinkAggregates.has(linkKey)) {
        simulationLinkAggregates.set(linkKey, {
          source: sourceId,
          target: targetId,
          meetingCount: 0,
          teamName: link.teamName,
          linkSource: link.linkSource,
          type: (link as any).type || 'default'
        });
      }
      
      const aggregate = simulationLinkAggregates.get(linkKey)!;
      aggregate.meetingCount++;
      
      // Prefer team information if available
      if (link.teamName && !aggregate.teamName) {
        aggregate.teamName = link.teamName;
      }
      if (link.linkSource && !aggregate.linkSource) {
        aggregate.linkSource = link.linkSource;
      }
    });

    // Convert aggregated links back to array format for simulation
    const aggregatedLinksArray = Array.from(simulationLinkAggregates.values());

    // Calculate node degrees (number of connections for each node) using aggregated links
    const nodeDegrees = new Map<string, number>();
    
    // Initialize all nodes with degree 0
    nodes.forEach(node => {
      nodeDegrees.set(node.id, 0);
    });

    // Count degrees from aggregated links
    aggregatedLinksArray.forEach(link => {
      nodeDegrees.set(link.source, (nodeDegrees.get(link.source) || 0) + 1);
      nodeDegrees.set(link.target, (nodeDegrees.get(link.target) || 0) + 1);
    });

    // Update node degrees
    nodes.forEach(node => {
      node.degree = nodeDegrees.get(node.id) || 0;
    });

    // Convert aggregated links to simulation format with node references
    const simulationLinks = aggregatedLinksArray
      .map((link, index) => {
        // For aggregated links, source and target are already string IDs
        let sourceId = String(link.source || '');
        let targetId = String(link.target || '');

        if (!sourceId || !targetId) {
          return null;
        }

        // Skip links connected to API users in contacts view
        if (dataSource === 'contacts') {
          const sourceUserData = userMap.get(sourceId);
          const targetUserData = userMap.get(targetId);
          if (sourceUserData?.api_user || targetUserData?.api_user || 
              adminUserIds.has(sourceId) || adminUserIds.has(targetId)) {
            return null;
          }
        }

        // Look up actual node objects
        const source = nodeById.get(sourceId);
        const target = nodeById.get(targetId);

        if (!source || !target) {
          return null;
        }

        // Create a properly typed link object with direct references to node objects
        const typedLink: Link = {
          source, // Direct reference to source node
          target, // Direct reference to target node
          value: 1,
          date: new Date(), // Use current date for aggregated links
          type: link.type || 'default',
          result: 'aggregated',
          utc_datecanvassed: '',
          contact_type: '',
          contact_result: ''
        };
        
        // Add meeting count from aggregated data
        (typedLink as any).meetingCount = link.meetingCount;
        return typedLink;
      })
      .filter((link): link is Link => link !== null);
    
    if (simulationLinks.length === 0) {
      return;
    }
    
    const simulation = d3.forceSimulation<Node, Link>(nodes);
    simulationRef.current = simulation;

    // Link meeting counts are now handled by the aggregation above

    // Calculate density factors for link strength
    const nodeCount = nodes.length;
    const linkCount = simulationLinks.length;
    const maxNodes = 200;
    const maxLinks = 500;
    const nodeDensityFactor = Math.max(0.3, 1.0 - (nodeCount / maxNodes) * 0.7);
    const linkDensityFactor = Math.max(0.3, 1.0 - (linkCount / maxLinks) * 0.7);
    const densityFactor = Math.min(nodeDensityFactor, linkDensityFactor);
    const repulsionFactor = Math.min(2.5, 1.0 + (nodeCount / maxNodes) * 1.5);

    simulation
      .force('link', d3.forceLink<Node, Link>(simulationLinks)
        .id(d => d.id)
        .distance((d: Link) => {
          const meetingCount = (d as any).meetingCount || 1;
          const maxReduction = 100;
          const reduction = Math.min(maxReduction, Math.log2(meetingCount) * 30);
          return Math.max(100, 280 - reduction);
        })
        .strength((d: Link) => {
          const meetingCount = (d as any).meetingCount || 1;
          const baseStrength = 0.4;
          const strengthMultiplier = Math.min(2.0, 1 + Math.log2(meetingCount) * 0.3);
          return baseStrength * strengthMultiplier * densityFactor;
        }))
      .force('charge', d3.forceManyBody<Node>().strength(() => {
        return -150 * repulsionFactor;
      }))
      .force('center', d3.forceCenter(rect.width / 2, rect.height / 2).strength(0.04))
      .force('collision', d3.forceCollide().radius(40))
      // REMOVED boundary force - this was creating the square constraint!;

    // If nodes already have positions (e.g. returning to this tab), start nearly settled
    const hasPreExistingPositions = nodes.some(n => typeof n.x === 'number' && n.x !== 0 && typeof n.y === 'number' && n.y !== 0);

    simulation.alphaDecay(0.02)
             .alphaTarget(0.0)
             .alphaMin(0.05)
             .velocityDecay(0.4);

    if (hasPreExistingPositions) {
      simulation.alpha(0.05);
    }

    // Create render function
    const render = () => {
      try {
        renderCanvas();
      } catch (e) {
        // console.error("Error in render function:", e);
      }
    };

  
    simulation.on("tick", () => {
      // console.log('🔄 NetworkGraph: Simulation tick'); // Uncomment for detailed debugging
      render();
    });

    // Add simulation end handler to sync final positions back to React state
    simulation.on("end", () => {
      // Get the simulation's nodes (which have been modified by D3)
      const simulationNodes = simulation.nodes();
      
      // Update React state with final positions from simulation
      if (onNodesChange) {
        const updatedNodes = nodes.map(node => {
          // Find the corresponding simulation node
          const simNode = simulationNodes.find(sn => sn.id === node.id);
          if (simNode && typeof simNode.x === 'number' && typeof simNode.y === 'number') {
            // Update positions and preserve all other properties from simulation
            return { 
              ...node, 
              x: simNode.x, 
              y: simNode.y,
              degree: simNode.degree || node.degree,
              vx: simNode.vx,
              vy: simNode.vy,
              fx: simNode.fx,
              fy: simNode.fy
            };
          }
          return node;
        });
        
        onNodesChange(updatedNodes);
      }
    });

    // Setup mouse interactions
    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const y = (event.clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      // Find node under mouse
      const hoveredNode = nodes.find(node => {
        const nodeSize = Math.min(20, Math.max(5, 5 + Math.log2(node.degree || 1) * 2));
        const dx = x - node.x;
        const dy = y - node.y;
        return Math.sqrt(dx * dx + dy * dy) < nodeSize;
      });

      if (onNodeHover) {
        onNodeHover(hoveredNode ? hoveredNode.id : null);
      }
    };

    const handleClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const y = (event.clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      // Find node under mouse
      const clickedNode = nodes.find(node => {
        const nodeSize = Math.min(20, Math.max(5, 5 + Math.log2(node.degree || 1) * 2));
        const dx = x - node.x;
        const dy = y - node.y;
        return Math.sqrt(dx * dx + dy * dy) < nodeSize;
      });

      if (onNodeClick) {
        onNodeClick(clickedNode ? clickedNode.id : null);
      }
    };

    // Add event listeners
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);

    // Setup zoom behavior with initial zoom out
    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        transformRef.current = event.transform;
        render();
      });

    // Set initial zoom to 0.7 (zoomed out more)
    const initialTransform = d3.zoomIdentity.scale(0.7);
    transformRef.current = initialTransform;
    d3.select(canvas).call(zoom).call(zoom.transform, initialTransform);

    // Cleanup function — save positions before unmounting
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      
      // Save current positions before stopping so they persist across tab switches
      if (onNodesChange) {
        const simulationNodes = simulation.nodes();
        const updatedNodes = nodes.map(node => {
          const simNode = simulationNodes.find(sn => sn.id === node.id);
          if (simNode && typeof simNode.x === 'number' && typeof simNode.y === 'number') {
            return { ...node, x: simNode.x, y: simNode.y, degree: simNode.degree || node.degree };
          }
          return node;
        });
        onNodesChange(updatedNodes);
      }
      
      simulation.stop();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [nodes, allLinks, selectedChapter, currentDateRange, meetingsData, userMap, adminUserIds, dataSource, renderCanvas, onNodeClick, onNodeHover, onNodesChange, visibilityTrigger]);


  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%', 
      position: 'relative',
      overflow: 'hidden' // Prevent drawing outside container
    }}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'pointer',
          border: '1px solid #ddd',
          display: 'block' // Prevent canvas baseline issues
        }}
      />
      
      {/* Shake / reheat button */}
      <Box
        onMouseDown={startShaking}
        onMouseUp={stopShaking}
        onMouseLeave={stopShaking}
        onTouchStart={startShaking}
        onTouchEnd={stopShaking}
        sx={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          width: 56,
          height: 56,
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
          zIndex: 10,
          transition: 'transform 0.15s ease',
          transform: isShaking ? 'scale(1.15)' : 'scale(1)',
          filter: isShaking ? 'drop-shadow(0 0 8px rgba(100, 180, 255, 0.6))' : 'none',
          '&:hover': {
            transform: isShaking ? 'scale(1.15)' : 'scale(1.08)',
          }
        }}
      >
        <img
          src={PENGUIN_GIF}
          alt="Shake graph"
          draggable={false}
          style={{ width: 48, height: 48, pointerEvents: 'none' }}
        />
      </Box>

      {/* Tooltip */}
      {tooltip && (
        <Box
          sx={{
            position: 'fixed',
            left: tooltip.x + 10,
            top: tooltip.y - 30,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'nowrap'
          }}
        >
          {tooltip.name}
        </Box>
      )}
    </Box>
  );
};

export default NetworkGraph;
