import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Campaign as CampaignIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  Archive as ArchiveIcon
} from '@mui/icons-material';
import CampaignActionDialog, { CampaignAction } from '../dialogs/CampaignActionDialog';
import ParentCampaignDialog, { ParentCampaign } from '../dialogs/ParentCampaignDialog';

interface TeamOption {
  id: string;
  name: string;
}

interface CampaignPanelProps {
  actions: CampaignAction[];
  onAddAction: (action: Omit<CampaignAction, 'id'>) => void;
  onEditAction: (actionId: string, action: Omit<CampaignAction, 'id'>) => void;
  onDeleteAction: (actionId: string) => void;
  onArchiveAction: (actionId: string) => void;
  chapters: string[];
  selectedChapter: string;
  onCampaignClick?: (campaignName: string) => void;
  parentCampaigns: ParentCampaign[];
  onAddParentCampaign: (campaign: Omit<ParentCampaign, 'id' | 'createdDate'>) => void;
  onUpdateParentCampaign: (campaignId: string, campaign: Omit<ParentCampaign, 'id' | 'createdDate'>) => void;
  onDeleteParentCampaign: (campaignId: string) => void;
  selectedParentCampaigns: string[];
  onParentCampaignClick?: (campaignId: string | null) => void;
  currentUserId?: string;
  currentUserName?: string;
  selectedOrganizerId?: string;
  selectedOrganizerName?: string;
  availableOrganizers?: Array<{ vanid: string; name: string }>;
  availableTeams?: TeamOption[];
  organizerCount?: number;
  roleCounts?: { student: number; teacher: number; constituent: number };
}

const CampaignPanel: React.FC<CampaignPanelProps> = ({
  actions,
  onAddAction,
  onEditAction,
  onDeleteAction,
  onArchiveAction,
  chapters,
  selectedChapter,
  onCampaignClick,
  parentCampaigns,
  onAddParentCampaign,
  onUpdateParentCampaign,
  onDeleteParentCampaign,
  selectedParentCampaigns,
  onParentCampaignClick,
  currentUserId,
  currentUserName,
  selectedOrganizerId,
  selectedOrganizerName,
  availableOrganizers = [],
  availableTeams = [],
  organizerCount = 0,
  roleCounts = { student: 0, teacher: 0, constituent: 0 }
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<CampaignAction | null>(null);
  const [selectedParentCampaignForAction, setSelectedParentCampaignForAction] = useState<string | undefined>(undefined);
  const [parentCampaignDialogOpen, setParentCampaignDialogOpen] = useState(false);
  const [editingParentCampaign, setEditingParentCampaign] = useState<ParentCampaign | null>(null);

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM dd, yyyy');
    } catch {
      return dateStr;
    }
  };

  // Filter campaigns by selected chapter
  const filteredParentCampaigns = selectedChapter === 'All Chapters'
    ? parentCampaigns
    : parentCampaigns.filter(campaign =>
        campaign.chapters.includes('All Chapters') || // Available to all chapters
        campaign.chapters.includes(selectedChapter) // Or specifically includes this chapter
      );

  // Filter actions by selected chapter (show all if "All Chapters" is selected)
  const filteredActions = selectedChapter === 'All Chapters' 
    ? actions 
    : actions.filter(action => 
        action.chapters.length === 0 || // Available to all chapters
        action.chapters.includes(selectedChapter) // Or specifically includes this chapter
      );

  // existingCampaigns is no longer needed since we use parentCampaigns now
  const existingCampaigns: string[] = [];

  return (
    <Box sx={{
      width: '100%',
      height: '100%',
      backgroundColor: '#fafafa',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Compact Header */}
      <Box sx={{
        padding: '12px 16px',
        backgroundColor: '#fff',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
            Campaigns
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {selectedParentCampaigns.length > 0 && (
            <IconButton
            size="small"
              onClick={() => onParentCampaignClick && onParentCampaignClick(null)}
              title="Clear selection"
              sx={{ p: 0.5 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={() => setParentCampaignDialogOpen(true)}
            title="New campaign"
            sx={{ p: 0.5 }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Campaigns Section - Compact Cards */}
      <Box sx={{
        padding: '12px',
        backgroundColor: '#fafafa',
        flex: 1,
        overflowY: 'auto'
      }}>

        {/* Compact Campaign Cards */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {filteredParentCampaigns
            .filter(campaign => !campaign.parentCampaignId) // Top-level parent campaigns
            .map((parentCampaign) => {
              const childCampaigns = filteredParentCampaigns.filter(
                c => c.parentCampaignId === parentCampaign.id
              );
              const isParentSelected = selectedParentCampaigns.includes(parentCampaign.id);
              const parentActions = actions.filter(action => action.parentCampaignId === parentCampaign.id);
              
              return (
                <Box key={parentCampaign.id}>
                  {/* Compact Parent Campaign Card */}
                <Card 
                    elevation={0}
                  sx={{ 
                    cursor: 'pointer',
                      border: '1px solid',
                      borderColor: isParentSelected ? 'primary.main' : '#e0e0e0',
                      backgroundColor: isParentSelected ? 'rgba(25, 118, 210, 0.08)' : '#fff',
                      transition: 'all 0.2s ease',
                      mb: childCampaigns.length > 0 ? 0.5 : 0,
                    '&:hover': {
                      borderColor: 'primary.main',
                        backgroundColor: 'rgba(25, 118, 210, 0.08)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }
                  }}
                  onClick={() => onParentCampaignClick && onParentCampaignClick(parentCampaign.id)}
                >
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      {/* Compact Header */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 600, 
                              fontSize: '0.85rem',
                              color: isParentSelected ? 'primary.main' : 'text.primary',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                          {parentCampaign.name}
                        </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>
                            {new Date(parentCampaign.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(parentCampaign.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Typography>
                      </Box>
                        <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingParentCampaign(parentCampaign);
                            setParentCampaignDialogOpen(true);
                          }}
                            sx={{ p: 0.5 }}
                        >
                            <EditIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteParentCampaign(parentCampaign.id);
                          }}
                            sx={{ p: 0.5, color: 'error.main' }}
                        >
                            <DeleteIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    </Box>

                      {/* Compact Goal Summary */}
                      {parentCampaign.goalTypes && parentCampaign.goalTypes.length > 0 && (
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                          {parentCampaign.goalTypes.map((gt) => {
                            const hasChapterGoals = gt.chapterGoals && Object.keys(gt.chapterGoals).length > 0;
                            const chapterBreakdown = hasChapterGoals
                              ? Object.entries(gt.chapterGoals!)
                                  .map(([chapter, target]) => `${chapter}: ${target}`)
                                  .join('\n')
                              : '';
                            
                            return (
                              <Tooltip 
                                key={gt.id}
                                title={hasChapterGoals ? (
                                  <Box sx={{ whiteSpace: 'pre-line' }}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Chapter Breakdown:</Typography>
                                    <br />
                                    {chapterBreakdown}
                                  </Box>
                                ) : ''}
                                arrow
                              >
                                <Chip
                                  label={`${gt.name}: ${gt.totalTarget}${hasChapterGoals ? ' ⓘ' : ''}`}
                                  size="small"
                                  onClick={(e) => e.stopPropagation()}
                                  sx={{ 
                                    fontSize: '0.7rem', 
                                    height: '18px',
                                    bgcolor: 'rgba(25, 118, 210, 0.08)',
                                    color: 'primary.main',
                                    cursor: hasChapterGoals ? 'help' : 'default'
                                  }}
                                />
                              </Tooltip>
                            );
                          })}
        </Box>
      )}

                      {/* Team badges */}
                      {parentCampaign.teams && parentCampaign.teams.length > 0 && (
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                          {parentCampaign.teams.map((teamId) => {
                            const team = availableTeams.find(t => t.id === teamId);
                            return (
                              <Chip
                                key={teamId}
                                label={teamId === 'All Teams' ? 'All Teams' : (team ? team.name : teamId)}
                                size="small"
                                variant="outlined"
                                onClick={(e) => e.stopPropagation()}
                                sx={{ 
                                  fontSize: '0.6rem', 
                                  height: '18px',
                                  borderColor: '#d0d0d0',
                                  color: 'text.secondary',
                                  cursor: 'default'
                                }}
                              />
                            );
                          })}
                        </Box>
                      )}

                      {/* Actions Section */}
                      <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #f0f0f0' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.6rem' }}>
                            Actions ({parentActions.length})
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedParentCampaignForAction(parentCampaign.id);
                              setDialogOpen(true);
                            }}
                            sx={{ p: 0.5 }}
                            title="Add action"
                          >
                            <AddIcon sx={{ fontSize: 12 }} />
                          </IconButton>
                        </Box>
                        {parentActions.length > 0 ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {parentActions.map((action) => {
                              const isTemplate = action.isTemplate === true;
                              
                              return (
                                <Box
                                  key={action.id}
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    py: 0.75,
                                    px: 1,
                                    borderRadius: 1,
                                    border: isTemplate ? '2px solid' : 'none',
                                    borderColor: isTemplate ? '#2196f3' : 'transparent',
                                    bgcolor: isTemplate ? 'rgba(33, 150, 243, 0.05)' : 'rgba(0,0,0,0.02)',
                                    '&:hover': {
                                      bgcolor: isTemplate ? 'rgba(33, 150, 243, 0.1)' : 'rgba(0,0,0,0.04)'
                                    }
                                  }}
                                >
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25, flexWrap: 'wrap' }}>
                                      {isTemplate && (
                                        <Chip
                                          icon={<CampaignIcon sx={{ fontSize: '12px !important' }} />}
                                          label="Campaign Template"
                                          size="small"
                                          sx={{ 
                                            fontSize: '0.6rem', 
                                            height: '18px',
                                            bgcolor: '#2196f3',
                                            color: 'white',
                                            fontWeight: 600,
                                            '& .MuiChip-icon': { color: 'white' }
                                          }}
                                        />
                                      )}
                                      {!isTemplate && action.templateActionId && (
                                        <Chip
                                          icon={<PersonIcon sx={{ fontSize: '10px !important' }} />}
                                          label="Personal"
                                          size="small"
                                          sx={{ 
                                            fontSize: '0.6rem', 
                                            height: '16px',
                                            bgcolor: '#9c27b0',
                                            color: 'white',
                                            fontWeight: 600,
                                            '& .MuiChip-icon': { color: 'white' }
                                          }}
                                        />
                                      )}
                                      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                                        {action.name}
                                      </Typography>
                                      {action.goalTypeId && (
                                        <Chip
                                          label={`→ ${action.goalTypeId}`}
                                          size="small"
                                          sx={{ 
                                            fontSize: '0.6rem', 
                                            height: '16px',
                                            bgcolor: 'rgba(76, 175, 80, 0.15)',
                                            color: '#2e7d32',
                                            fontWeight: 500
                                          }}
                                        />
                                      )}
                                    </Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block' }}>
                                      {action.fields.map(f => f.label).join(' → ')}
                                    </Typography>
                                    {isTemplate && (
                                      <Typography variant="caption" sx={{ fontSize: '0.6rem', display: 'block', mt: 0.5, color: 'primary.main', fontWeight: 500, fontStyle: 'italic' }}>
                                        Available to all organizers
                                      </Typography>
                                    )}
                                  </Box>
                                  <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center' }}>
                                    {/* Templates automatically appear in everyone's My View - no "Use" button needed */}
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingAction(action);
                                        setDialogOpen(true);
                                      }}
                                      sx={{ 
                                        color: 'text.secondary',
                                        '&:hover': { color: 'primary.main', bgcolor: 'rgba(25, 118, 210, 0.04)' }
                                      }}
                                    >
                                      <EditIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onArchiveAction(action.id);
                                      }}
                                      sx={{ 
                                        color: 'text.secondary',
                                        '&:hover': { color: 'warning.main', bgcolor: 'rgba(237, 108, 2, 0.04)' }
                                      }}
                                    >
                                      <ArchiveIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                    {!isTemplate && (
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onDeleteAction(action.id);
                                        }}
                                        sx={{ 
                                          color: 'text.secondary',
                                          '&:hover': { color: 'error.main', bgcolor: 'rgba(211, 47, 47, 0.04)' }
                                        }}
                                      >
                                        <DeleteIcon sx={{ fontSize: 14 }} />
                                      </IconButton>
                                    )}
                                  </Box>
                                </Box>
                              );
                            })}
                          </Box>
                        ) : (
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', fontStyle: 'italic', display: 'block', py: 0.5 }}>
                            No actions yet. Click + to add one.
                          </Typography>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                  {childCampaigns.length > 0 && (
      <Box sx={{
                      ml: 3, 
                      mt: 1.5,
                      pl: 2, 
                      borderLeft: '2px solid #e0e0e0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5
                    }}>
                      {childCampaigns.map((childCampaign) => {
                        const isChildSelected = selectedParentCampaigns.includes(childCampaign.id);
                        const childActions = actions.filter(action => action.parentCampaignId === childCampaign.id);

                        return (
                          <Card
                            key={childCampaign.id}
                            elevation={0}
                            sx={{
                              cursor: 'pointer',
                              border: '1px solid',
                              borderColor: isChildSelected ? 'primary.main' : '#e0e0e0',
                              backgroundColor: isChildSelected ? '#f0f7ff' : '#fafafa',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                borderColor: 'primary.main',
                                backgroundColor: '#f0f7ff'
                              }
                            }}
                            onClick={() => onParentCampaignClick && onParentCampaignClick(childCampaign.id)}
                          >
                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                              {/* Header */}
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 0.25, color: isChildSelected ? 'primary.main' : 'text.primary' }}>
                                    {childCampaign.name}
            </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                    {new Date(childCampaign.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(childCampaign.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0, ml: 1 }}>
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingParentCampaign(childCampaign);
                                      setParentCampaignDialogOpen(true);
                                    }}
                                    sx={{ 
                                      color: 'text.secondary',
                                      '&:hover': { color: 'primary.main', bgcolor: 'rgba(25, 118, 210, 0.04)' }
                                    }}
                                  >
                                    <EditIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteParentCampaign(childCampaign.id);
                                    }}
                      sx={{ 
                                      color: 'text.secondary',
                                      '&:hover': { color: 'error.main', bgcolor: 'rgba(211, 47, 47, 0.04)' }
                                    }}
                                  >
                                    <DeleteIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Box>
                              </Box>

                              {/* Team badges and goals */}
                              {childCampaign.teams && childCampaign.teams.length > 0 && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 1 }}>
                                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                    {childCampaign.teams.map((teamId) => {
                                      const team = availableTeams.find(t => t.id === teamId);
                                      return (
                                        <Chip
                                          key={teamId}
                                          label={teamId === 'All Teams' ? 'All Teams' : (team ? team.name : teamId)}
                                          size="small"
                                          variant="outlined"
                                          onClick={(e) => e.stopPropagation()}
                                          sx={{ 
                                            fontSize: '0.6rem', 
                                            height: '20px',
                                            borderColor: '#d0d0d0',
                                            color: 'text.secondary',
                                            cursor: 'default'
                                          }}
                                        />
                                      );
                                    })}
                  </Box>
                  
                                  {/* Chapter Goals */}
                                  {childCampaign.goalTypes && childCampaign.goalTypes.length > 0 && (
                                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                      {childCampaign.goalTypes.map((gt) => (
                                        <Chip
                                          key={gt.id}
                                          label={`${gt.name}: ${gt.totalTarget}`}
                                          size="small"
                                          onClick={(e) => e.stopPropagation()}
                                          sx={{ 
                                            fontSize: '0.65rem', 
                                            height: '20px',
                                            bgcolor: 'rgba(25, 118, 210, 0.08)',
                                            color: 'primary.main',
                                            fontWeight: 500,
                                            cursor: 'default'
                                          }}
                                        />
                                      ))}
                                    </Box>
                                  )}
                                </Box>
                              )}

                              {/* Child-level Actions */}
                              {childActions.length > 0 && (
                                <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #f0f0f0' }}>
                                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.6rem', mb: 0.75, display: 'block' }}>
                                    Actions ({childActions.length})
                                  </Typography>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    {childActions.map((action) => {
                                      const isTemplate = action.isTemplate === true;
                                      
                                      return (
                                        <Box
                                          key={action.id}
                                          sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            py: 0.75,
                                            px: 1,
                                            borderRadius: 1,
                                            border: isTemplate ? '2px solid' : 'none',
                                            borderColor: isTemplate ? '#2196f3' : 'transparent',
                                            bgcolor: isTemplate ? 'rgba(33, 150, 243, 0.05)' : 'transparent',
                                            '&:hover': {
                                              bgcolor: isTemplate ? 'rgba(33, 150, 243, 0.1)' : 'rgba(0,0,0,0.04)'
                                            }
                                          }}
                                        >
                                          <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25, flexWrap: 'wrap' }}>
                                              {isTemplate && (
                                                <Chip
                                                  icon={<CampaignIcon sx={{ fontSize: '12px !important' }} />}
                                                  label="Campaign Template"
                                                  size="small"
                                                  sx={{ 
                                                    fontSize: '0.6rem', 
                                                    height: '18px',
                                                    bgcolor: '#2196f3',
                                                    color: 'white',
                                                    fontWeight: 600,
                                                    '& .MuiChip-icon': { color: 'white' }
                                                  }}
                                                />
                                              )}
                                              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                                                {action.name}
                                              </Typography>
                                              {action.goalTypeId && (
                                                <Chip
                                                  label={`→ ${action.goalTypeId}`}
                                                  size="small"
                                                  sx={{ 
                                                    fontSize: '0.6rem', 
                                                    height: '16px',
                                                    bgcolor: 'rgba(76, 175, 80, 0.15)',
                                                    color: '#2e7d32',
                                                    fontWeight: 500
                                                  }}
                                                />
                                              )}
                                            </Box>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', display: 'block' }}>
                                              {action.fields.map(f => f.label).join(' → ')}
                                            </Typography>
                                            {isTemplate && (
                                              <Typography variant="caption" sx={{ fontSize: '0.6rem', display: 'block', mt: 0.5, color: 'primary.main', fontWeight: 500, fontStyle: 'italic' }}>
                                                Available to all organizers
                                              </Typography>
                                            )}
                                          </Box>
                                          <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center' }}>
                                            {/* Templates automatically appear in everyone's My View - no "Use" button needed */}
                                            <IconButton
                                              size="small"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingAction(action);
                                                setDialogOpen(true);
                                              }}
                                              sx={{ 
                                                color: 'text.secondary',
                                                '&:hover': { color: 'primary.main', bgcolor: 'rgba(25, 118, 210, 0.04)' }
                                              }}
                                            >
                                              <EditIcon sx={{ fontSize: 14 }} />
                                            </IconButton>
                                            <IconButton
                                              size="small"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onArchiveAction(action.id);
                                              }}
                                              sx={{ 
                                                color: 'text.secondary',
                                                '&:hover': { color: 'warning.main', bgcolor: 'rgba(237, 108, 2, 0.04)' }
                                              }}
                                            >
                                              <ArchiveIcon sx={{ fontSize: 14 }} />
                                            </IconButton>
                                            {!isTemplate && (
                                              <IconButton
                                                size="small"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onDeleteAction(action.id);
                                                }}
                                                sx={{ 
                                                  color: 'text.secondary',
                                                  '&:hover': { color: 'error.main', bgcolor: 'rgba(211, 47, 47, 0.04)' }
                                                }}
                                              >
                                                <DeleteIcon sx={{ fontSize: 14 }} />
                                              </IconButton>
                                            )}
                                          </Box>
                                        </Box>
                                      );
                                    })}
                                  </Box>
                                </Box>
                              )}
                </CardContent>
              </Card>
                        );
                      })}
          </Box>
        )}
                </Box>
              );
            })}
        </Box>
      </Box>

      {/* Add/Edit Action Dialog */}
      <CampaignActionDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingAction(null);
          setSelectedParentCampaignForAction(undefined);
        }}
        onSave={(actionData) => {
          if (editingAction) {
            onEditAction(editingAction.id, actionData);
          } else {
            onAddAction(actionData);
          }
          setEditingAction(null);
        }}
        chapters={chapters}
        selectedChapter={selectedChapter}
        existingCampaigns={existingCampaigns}
        parentCampaigns={parentCampaigns}
        parentCampaignId={selectedParentCampaignForAction || editingAction?.parentCampaignId}
        editingAction={editingAction || undefined}
        currentUserId={selectedOrganizerId || currentUserId}
        currentUserName={selectedOrganizerName || currentUserName}
        availableOrganizers={availableOrganizers}
      />

      {/* Parent Campaign Dialog */}
      <ParentCampaignDialog
        open={parentCampaignDialogOpen}
        onClose={() => {
          setParentCampaignDialogOpen(false);
          setEditingParentCampaign(null);
        }}
        onSave={(campaignData) => {
          if (editingParentCampaign) {
            onUpdateParentCampaign(editingParentCampaign.id, campaignData);
          } else {
            onAddParentCampaign(campaignData);
          }
          setEditingParentCampaign(null);
        }}
        editingCampaign={editingParentCampaign}
        allCampaigns={parentCampaigns}
        availableChapters={chapters}
        availableTeams={availableTeams}
        organizerCount={organizerCount}
        roleCounts={roleCounts}
      />
    </Box>
  );
};

export default CampaignPanel;
