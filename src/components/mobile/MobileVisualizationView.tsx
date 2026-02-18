import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Stack,
  Divider
} from '@mui/material';
import {
  AccountTree as NetworkIcon,
  BarChart as ChartIcon,
  Campaign as CampaignIcon,
  Construction as ConstructionIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';

// Import campaign components
import CampaignLineGraph from '../visualizations/CampaignLineGraph';
import CampaignPanel from '../panels/CampaignPanel';
import { CampaignAction, CampaignEvent } from '../../types';

export interface MobileVisualizationViewProps {
  currentVisualization: 'people' | 'teams' | 'goals' | 'campaign';
  children?: React.ReactNode;
  meetings?: any[];
  contacts?: any[];
  currentDateRange?: { start: Date; end: Date } | null;
  userMap?: Map<string, any>;
  orgIds?: any[];
  actions?: CampaignAction[];
  events?: CampaignEvent[];
  selectedChapter?: string;
  onCampaignClick?: (campaignName: string) => void;
  onAddCampaignAction?: (action: Omit<CampaignAction, 'id'>) => void;
  onEditCampaignAction?: (actionId: string, action: Omit<CampaignAction, 'id'>) => void;
  onDeleteCampaignAction?: (actionId: string) => void;
  onArchiveCampaignAction?: (actionId: string) => void;
  chapters?: string[];
  parentCampaigns?: any[];
  onAddParentCampaign?: (campaign: any) => void;
  onUpdateParentCampaign?: (campaignId: string, campaign: any) => void;
  onDeleteParentCampaign?: (campaignId: string) => void;
  selectedParentCampaigns?: string[];
  onParentCampaignClick?: (campaignId: string | null) => void;
  pledgeSubmissions?: any[];
}

type OrganizationalView = 'federation' | 'chapters' | 'organizers';

const MobileVisualizationView: React.FC<MobileVisualizationViewProps> = ({
  currentVisualization,
  children,
  meetings = [],
  contacts = [],
  currentDateRange,
  userMap = new Map(),
  orgIds = [],
  actions = [],
  events = [],
  selectedChapter,
  onCampaignClick,
  onAddCampaignAction,
  onEditCampaignAction,
  onDeleteCampaignAction,
  onArchiveCampaignAction,
  chapters = [],
  parentCampaigns = [],
  onAddParentCampaign,
  onUpdateParentCampaign,
  onDeleteParentCampaign,
  selectedParentCampaigns = [],
  onParentCampaignClick,
  pledgeSubmissions = []
}) => {
  const [organizationalView, setOrganizationalView] = useState<OrganizationalView>('federation');

  // Helper function to get organizer name
  const getOrganizerName = (meeting: any) => {
    // Try API's pre-built organizer name first
    if (meeting.organizer && meeting.organizer.trim() && meeting.organizer !== 'null null') {
      return meeting.organizer.trim();
    }
    
    const organizerInfo = userMap.get(meeting.organizer_vanid) || {};
    const organizerOrgInfo = orgIds.find(p => p.vanid && p.vanid.toString() === meeting.organizer_vanid?.toString());
    
    if (organizerInfo.name && organizerInfo.name.trim() && organizerInfo.name !== 'null null') {
      return organizerInfo.name.trim();
    } else if ((organizerInfo.firstname && organizerInfo.firstname !== 'null') || (organizerInfo.lastname && organizerInfo.lastname !== 'null')) {
      const firstName = organizerInfo.firstname && organizerInfo.firstname !== 'null' ? organizerInfo.firstname.trim() : '';
      const lastName = organizerInfo.lastname && organizerInfo.lastname !== 'null' ? organizerInfo.lastname.trim() : '';
      return `${firstName} ${lastName}`.trim();
    } else if (organizerOrgInfo && ((organizerOrgInfo.firstname && organizerOrgInfo.firstname !== 'null') || (organizerOrgInfo.lastname && organizerOrgInfo.lastname !== 'null'))) {
      const firstName = organizerOrgInfo.firstname && organizerOrgInfo.firstname !== 'null' ? organizerOrgInfo.firstname.trim() : '';
      const lastName = organizerOrgInfo.lastname && organizerOrgInfo.lastname !== 'null' ? organizerOrgInfo.lastname.trim() : '';
      return `${firstName} ${lastName}`.trim();
    }
    
    return `Organizer ${meeting.organizer_vanid}`;
  };

  // Filter and deduplicate meetings
  const filteredMeetings = useMemo(() => {
    // First filter by date range
    let dateFilteredMeetings = meetings;
    if (currentDateRange) {
      dateFilteredMeetings = meetings.filter(meeting => {
        const meetingDate = new Date(typeof meeting.datestamp === 'object' ? meeting.datestamp.value : meeting.datestamp);
        return meetingDate >= currentDateRange.start && meetingDate <= currentDateRange.end;
      });
    }

    // Then deduplicate
    return dateFilteredMeetings.reduce((acc, meeting) => {
      const dateStr = typeof meeting.datestamp === 'object' ? meeting.datestamp.value : meeting.datestamp;
      const uniqueKey = `${meeting.organizer_vanid}-${meeting.vanid}-${dateStr}-${meeting.meeting_type || 'Meeting'}`;
      
      if (!acc.some((existingMeeting: any) => {
        const existingDateStr = typeof existingMeeting.datestamp === 'object' ? existingMeeting.datestamp.value : existingMeeting.datestamp;
        const existingKey = `${existingMeeting.organizer_vanid}-${existingMeeting.vanid}-${existingDateStr}-${existingMeeting.meeting_type || 'Meeting'}`;
        return existingKey === uniqueKey;
      })) {
        acc.push(meeting);
      }
      
      return acc;
    }, [] as any[]);
  }, [meetings, currentDateRange]);

  // Calculate conversation counts based on organizational view
  const conversationData = useMemo(() => {
    const counts = new Map<string, number>();

    if (organizationalView === 'federation') {
      // Group by meeting type
      filteredMeetings.forEach((meeting: any) => {
        const type = meeting.meeting_type || 'Meeting';
        counts.set(type, (counts.get(type) || 0) + 1);
      });
    } else if (organizationalView === 'chapters') {
      // Group by chapter
      filteredMeetings.forEach((meeting: any) => {
        const chapter = meeting.chapter || 'Unknown Chapter';
        counts.set(chapter, (counts.get(chapter) || 0) + 1);
      });
    } else if (organizationalView === 'organizers') {
      // Group by organizer
      filteredMeetings.forEach((meeting: any) => {
        const organizer = getOrganizerName(meeting);
        counts.set(organizer, (counts.get(organizer) || 0) + 1);
      });
    }

    // Sort by count and return top results
    return Array.from(counts.entries())
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 10); // Show top 10
  }, [filteredMeetings, organizationalView, userMap, orgIds]);

  const totalConversations = filteredMeetings.length;
  const maxCount = Math.max(...conversationData.map(([, count]) => count as number), 1);

  const formatDateRange = () => {
    if (!currentDateRange) return 'Loading...';
    
    const startDate = currentDateRange.start.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    const endDate = currentDateRange.end.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    return `${startDate} - ${endDate}`;
  };

  const getViewInfo = () => {
    switch (organizationalView) {
      case 'federation':
        return {
          title: 'Carolina Federation',
          subtitle: 'Conversations by Type',
          icon: <AssessmentIcon color="primary" />
        };
      case 'chapters':
        return {
          title: 'Chapters',
          subtitle: 'Conversations by Chapter',
          icon: <BusinessIcon color="primary" />
        };
      case 'organizers':
        return {
          title: 'Organizers',
          subtitle: 'Conversations by Organizer',
          icon: <PersonIcon color="primary" />
        };
      default:
        return {
          title: 'Conversations',
          subtitle: 'Meeting Analytics',
          icon: <ChartIcon color="primary" />
        };
    }
  };

  const getVisualizationInfo = () => {
    switch (currentVisualization) {
      case 'people':
        return {
          title: 'People View',
          subtitle: 'Coming Soon to Mobile',
          description: 'Individual people analytics will be available on mobile devices in a future update. For now, use the List View to explore people and meetings.',
          icon: <PersonIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
        };
      case 'teams':
        return {
          title: 'Teams Network View',
          subtitle: 'Coming Soon to Mobile',
          description: 'The interactive network graph will be available on mobile devices in a future update. For now, use the List View to explore people and meetings.',
          icon: <NetworkIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
        };
      case 'goals':
        return {
          title: 'Conversation Analytics',
          subtitle: 'Mobile View',
          description: 'Mobile-optimized conversation analytics.',
          icon: <ChartIcon sx={{ fontSize: 48, color: 'primary.main' }} />
        };
      case 'campaign':
        return {
          title: 'Campaign Timeline',
          subtitle: 'Campaign Actions and Progress',
          description: 'Track campaign actions, timeline events, and strategic progress.',
          icon: <CampaignIcon sx={{ fontSize: 48, color: 'secondary.main' }} />
        };
      default:
        return {
          title: 'Visualization',
          subtitle: 'Coming Soon',
          description: 'This visualization will be available soon.',
          icon: <ConstructionIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
        };
    }
  };

  // For goals/conversations view, show the mobile-optimized analytics
  if (currentVisualization === 'goals') {
    const viewInfo = getViewInfo();
    
    return (
      <Box sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        pb: 8 // Space for bottom navigation
      }}>
        {/* Header with View Switcher */}
        <Box sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          {/* Title and Date Range */}
          <Box sx={{ p: 2, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {viewInfo.icon}
              <Typography variant="h6" fontWeight="bold">
                Conversation Analytics
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {formatDateRange()} • {totalConversations} total conversations
            </Typography>
          </Box>

          {/* Mobile-Optimized View Switcher */}
          <Box sx={{ px: 2, pb: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
              {[
                { value: 'federation', label: 'Federation', icon: <AssessmentIcon fontSize="small" /> },
                { value: 'chapters', label: 'Chapters', icon: <BusinessIcon fontSize="small" /> },
                { value: 'organizers', label: 'Organizers', icon: <PersonIcon fontSize="small" /> }
              ].map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  icon={option.icon}
                  onClick={() => setOrganizationalView(option.value as OrganizationalView)}
                  variant={organizationalView === option.value ? 'filled' : 'outlined'}
                  color={organizationalView === option.value ? 'primary' : 'default'}
                  sx={{
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                    minWidth: 'auto',
                    whiteSpace: 'nowrap',
                    '& .MuiChip-icon': {
                      fontSize: '1rem'
                    }
                  }}
                />
              ))}
            </Box>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2, pb: 4 }}>
          <Stack spacing={2}>
            {/* Summary Card */}
            <Card sx={{ border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  {viewInfo.icon}
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      {viewInfo.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {viewInfo.subtitle}
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 3, justifyContent: 'space-around' }}>
                  <Box sx={{ textAlign: 'center', flex: 1 }}>
                    <Typography variant="h3" fontWeight="bold" color="primary.main">
                      {totalConversations}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight="medium">
                      Total Conversations
                    </Typography>
                  </Box>
                  <Divider orientation="vertical" flexItem />
                  <Box sx={{ textAlign: 'center', flex: 1 }}>
                    <Typography variant="h3" fontWeight="bold" color="secondary.main">
                      {conversationData.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight="medium">
                      Active {organizationalView === 'federation' ? 'Types' : organizationalView === 'chapters' ? 'Chapters' : 'Organizers'}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Conversation Data */}
            {conversationData.length === 0 ? (
              <Card sx={{ border: '1px solid', borderColor: 'divider' }}>
                <CardContent sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="body1" color="text.secondary">
                    No conversation data available for the selected time period.
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <Card sx={{ border: '1px solid', borderColor: 'divider' }}>
                <CardContent sx={{ p: 0 }}>
                  <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" fontWeight="bold">
                      Top {organizationalView === 'federation' ? 'Meeting Types' : organizationalView === 'chapters' ? 'Chapters' : 'Organizers'}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      {conversationData.map(([name, count], index) => (
                        <Card key={name} sx={{ 
                          p: 2, 
                          backgroundColor: index < 3 ? 'primary.light' : 'background.paper',
                          color: index < 3 ? 'primary.contrastText' : 'text.primary',
                          border: '1px solid',
                          borderColor: index < 3 ? 'primary.main' : 'divider'
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                            {/* Rank Number */}
                            <Box sx={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              backgroundColor: index < 3 ? 'primary.dark' : 'primary.main',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              fontSize: '1rem'
                            }}>
                              #{index + 1}
                            </Box>
                            
                            {/* Name and Count */}
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="h6" fontWeight="bold" sx={{ 
                                fontSize: '1rem',
                                color: index < 3 ? 'primary.contrastText' : 'text.primary'
                              }}>
                                {name}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                <Typography variant="body2" sx={{ 
                                  color: index < 3 ? 'primary.contrastText' : 'text.secondary'
                                }}>
                                  {count} conversations
                                </Typography>
                                <Typography variant="caption" sx={{ 
                                  color: index < 3 ? 'primary.contrastText' : 'text.secondary'
                                }}>
                                  ({((count / totalConversations) * 100).toFixed(1)}%)
                                </Typography>
                              </Box>
                            </Box>
                            
                            {/* Count Badge */}
                            <Box sx={{
                              backgroundColor: index < 3 ? 'primary.dark' : 'primary.main',
                              color: 'white',
                              px: 2,
                              py: 1,
                              borderRadius: 2,
                              fontWeight: 'bold',
                              fontSize: '1.25rem'
                            }}>
                              {count}
                            </Box>
                          </Box>
                          
                          {/* Progress Bar */}
                          <Box sx={{ mb: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={(count / maxCount) * 100} 
                              sx={{ 
                                height: 12, 
                                borderRadius: 6,
                                bgcolor: index < 3 ? 'primary.dark' : 'grey.200',
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 6,
                                  backgroundColor: index < 3 ? 'white' : 'primary.main'
                                }
                              }}
                            />
                          </Box>
                          
                          {/* Relative Performance */}
                          <Typography variant="caption" sx={{ 
                            color: index < 3 ? 'primary.contrastText' : 'text.secondary',
                            fontSize: '0.75rem'
                          }}>
                            {index === 0 ? 'Highest activity' : 
                             index < 3 ? 'High activity' : 
                             index < 5 ? 'Moderate activity' : 'Lower activity'}
                          </Typography>
                        </Card>
                      ))}
                    </Stack>
                  </Box>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Box>
      </Box>
    );
  }

  const vizInfo = getVisualizationInfo();

  // For people and teams view, show placeholder
  if (currentVisualization === 'people' || currentVisualization === 'teams') {
    return (
      <Box sx={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        p: 4,
        pb: 10 // Space for bottom navigation
      }}>
        <Card sx={{ textAlign: 'center', maxWidth: 400 }}>
          <CardContent sx={{ p: 4 }}>
            {vizInfo.icon}
            <Typography variant="h5" gutterBottom sx={{ mt: 2, fontWeight: 'bold' }}>
              {vizInfo.title}
            </Typography>
            <Typography variant="subtitle1" color="primary" gutterBottom>
              {vizInfo.subtitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {vizInfo.description}
            </Typography>
            <Box sx={{ mt: 3 }}>
              <Typography variant="caption" color="text.secondary">
                💡 Tip: Use the List View to explore connections and meeting details
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  
  // For campaign view, show mobile-optimized campaign management with actual components
  if (currentVisualization === 'campaign') {
    console.error('🚨 MobileVisualizationView Campaign Mode TRIGGERED:', { 
      currentVisualization, 
      actionsLength: actions.length, 
      selectedChapter,
      chaptersLength: chapters.length 
    });
    
    try {
      // Handler to convert CampaignAction click to campaign name click
      const handleActionClick = (action: any) => {
        if (onCampaignClick && action.campaign) {
          onCampaignClick(action.campaign);
        }
      };
      
      return (
        <Box sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          pb: 8 // Space for bottom navigation
        }}>
          {/* Debug info */}
          <Box sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
            <Typography variant="caption">
              ✅ Campaign View Rendering - Actions: {actions.length}, Chapter: {selectedChapter}
            </Typography>
          </Box>

          {/* Campaign Timeline Graph */}
          <Box sx={{ 
            flex: 1, 
            minHeight: 300,
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider'
          }}>
            <CampaignLineGraph
              actions={events || []}
              width={window.innerWidth - 32} // Account for padding
              height={300}
              selectedChapter={selectedChapter || 'All Chapters'}
              onActionClick={handleActionClick}
              onResetZoom={() => onCampaignClick && onCampaignClick('')}
              parentCampaigns={parentCampaigns}
              selectedParentCampaigns={selectedParentCampaigns}
              pledgeSubmissions={pledgeSubmissions}
              meetingsData={meetings}
            />
          </Box>

          {/* Campaign Panel */}
          <Box sx={{ 
            flex: 1,
            minHeight: 400,
            overflow: 'hidden'
          }}>
            <CampaignPanel
              actions={actions}
              onAddAction={onAddCampaignAction || (() => {})}
              onEditAction={onEditCampaignAction || (() => {})}
              onDeleteAction={onDeleteCampaignAction || (() => {})}
              onArchiveAction={onArchiveCampaignAction || (() => {})}
              chapters={chapters}
              selectedChapter={selectedChapter || 'All Chapters'}
              onCampaignClick={onCampaignClick}
              parentCampaigns={parentCampaigns}
              onAddParentCampaign={onAddParentCampaign || (() => {})}
              onUpdateParentCampaign={onUpdateParentCampaign || (() => {})}
              onDeleteParentCampaign={onDeleteParentCampaign || (() => {})}
              selectedParentCampaigns={selectedParentCampaigns}
              onParentCampaignClick={onParentCampaignClick}
            />
          </Box>
        </Box>
      );
    } catch (error) {
      console.error('💥 Error in campaign view:', error);
      return (
        <Box sx={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          pb: 8,
          p: 4
        }}>
          <Typography variant="h6" color="error" gutterBottom>
            Campaign View Error
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {error instanceof Error ? error.message : String(error)}
          </Typography>
        </Box>
      );
    }
  }

  
  // For other visualizations, just show placeholder for now
  // Goals and Campaign views need to be properly implemented with mobile-optimized components
  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      p: 4,
      pb: 10 // Space for bottom navigation
    }}>
      <Card sx={{ textAlign: 'center', maxWidth: 400 }}>
        <CardContent sx={{ p: 4 }}>
          {vizInfo.icon}
          <Typography variant="h5" gutterBottom sx={{ mt: 2, fontWeight: 'bold' }}>
            {vizInfo.title}
          </Typography>
          <Typography variant="subtitle1" color="primary" gutterBottom>
            {vizInfo.subtitle}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Mobile-optimized {currentVisualization} view coming soon!
          </Typography>
          <Box sx={{ mt: 3 }}>
            <Typography variant="caption" color="text.secondary">
              💡 Use the List View to explore data in detail
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default MobileVisualizationView;
