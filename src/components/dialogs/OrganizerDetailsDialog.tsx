import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  CircularProgress,
  Divider,
  Chip,
  TextField,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { fetchOrganizerDetails, updateOrganizerDetails, OrganizerDetails } from '../../services/api';

interface MeetingNote {
  organizer_vanid: number;
  vanid?: number;
  participant_vanid?: number;
  organizer?: string;
  contact?: string;
  datestamp?: { value: string } | string;
  date_contacted?: { value: string } | string;
  chapter?: string;
  meeting_type?: string;
  conversation_type?: string;
  notes_purpose?: string;
  notes_commitments?: string;
  notes_stakes?: string;
  notes_development?: string;
  notes_evaluation?: string;
  purpose?: string;
  commitments?: string;
  stakes?: string;
  development?: string;
  evaluation?: string;
  organizer_first_name?: string;
  organizer_last_name?: string;
  organizer_firstname?: string;
  organizer_lastname?: string;
  [key: string]: any;
}

interface UserInfo {
  name?: string;
  firstname?: string;
  lastname?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  type?: string;
  chapter?: string;
  loe_status?: string;
  turf?: string;
  team_role?: string;
}

interface OrganizerDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  organizerName: string;
  organizerVanId?: string;
  cachedMeetings: MeetingNote[];
  userMap: Map<number, UserInfo>;
  allContacts?: any[];
}

const OrganizerDetailsDialog: React.FC<OrganizerDetailsDialogProps> = ({
  open,
  onClose,
  organizerName,
  organizerVanId,
  cachedMeetings,
  userMap,
  allContacts = []
}) => {
  // State for organizer details
  const [organizerDetails, setOrganizerDetails] = useState<OrganizerDetails | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editedTurf, setEditedTurf] = useState('');
  const [editedTeamRole, setEditedTeamRole] = useState('');
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsSuccess, setDetailsSuccess] = useState<string | null>(null);

  // Load organizer details when dialog opens
  useEffect(() => {
    const loadOrganizerDetails = async () => {
      if (open && organizerVanId) {
        try {
          const details = await fetchOrganizerDetails(organizerVanId);
          setOrganizerDetails(details);
          setEditedTurf(details.turf || '');
          setEditedTeamRole(details.team_role || '');
        } catch (error) {
          console.error('Error loading organizer details:', error);
        }
      }
    };
    
    loadOrganizerDetails();
  }, [open, organizerVanId]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setIsEditingDetails(false);
      setDetailsError(null);
      setDetailsSuccess(null);
    }
  }, [open]);

  const handleEditDetails = () => {
    setIsEditingDetails(true);
    setDetailsError(null);
    setDetailsSuccess(null);
  };

  const handleCancelEdit = () => {
    setIsEditingDetails(false);
    setEditedTurf(organizerDetails?.turf || '');
    setEditedTeamRole(organizerDetails?.team_role || '');
    setDetailsError(null);
  };

  const handleSaveDetails = async () => {
    if (!organizerVanId) return;
    
    setIsSavingDetails(true);
    setDetailsError(null);
    setDetailsSuccess(null);
    
    try {
      await updateOrganizerDetails(organizerVanId, {
        turf: editedTurf || undefined,
        team_role: editedTeamRole || undefined
      });
      
      setOrganizerDetails({
        vanid: organizerVanId,
        turf: editedTurf || null,
        team_role: editedTeamRole || null
      });
      
      setIsEditingDetails(false);
      setDetailsSuccess('Organizer details updated successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => setDetailsSuccess(null), 3000);
    } catch (error: any) {
      setDetailsError(error.message || 'Failed to update organizer details');
    } finally {
      setIsSavingDetails(false);
    }
  };

  // Split meetings into two groups
  const meetingsData = React.useMemo(() => {
    if (!open || !organizerVanId) return { asOrganizer: [], asParticipant: [] };
    
    const vanIdNum = Number(organizerVanId);
    
    // Meetings where this person was the organizer
    const asOrganizer = cachedMeetings.filter(meeting => 
      Number(meeting.organizer_vanid) === vanIdNum
    );
    
    // Meetings where this person was the participant
    const asParticipant = cachedMeetings.filter(meeting => {
      const participantVanid = meeting.participant_vanid || meeting.vanid;
      return Number(participantVanid) === vanIdNum;
    });
    
    // Sort both arrays by date (most recent first)
    const sortByDate = (a: MeetingNote, b: MeetingNote) => {
      const dateA = (typeof a.date_contacted === 'object' ? a.date_contacted?.value : a.date_contacted) ||
                    (typeof a.datestamp === 'object' ? a.datestamp?.value : a.datestamp) || '';
      const dateB = (typeof b.date_contacted === 'object' ? b.date_contacted?.value : b.date_contacted) ||
                    (typeof b.datestamp === 'object' ? b.datestamp?.value : b.datestamp) || '';
      return dateB.localeCompare(dateA);
    };
    
    return {
      asOrganizer: asOrganizer.sort(sortByDate),
      asParticipant: asParticipant.sort(sortByDate)
    };
  }, [open, organizerVanId, cachedMeetings]);

  // Helper function to get person name
  const getPersonName = (vanId: number | undefined, apiName: string | undefined): string => {
    if (vanId) {
      const userInfo = userMap.get(Number(vanId));
      if (userInfo) {
        if (userInfo.name && userInfo.name.trim() && userInfo.name !== 'null null') {
          return userInfo.name.trim();
        }
        if (userInfo.fullName && userInfo.fullName.trim() && userInfo.fullName !== 'null null') {
          return userInfo.fullName.trim();
        }
        if ((userInfo.firstname && userInfo.firstname !== 'null') || (userInfo.lastname && userInfo.lastname !== 'null')) {
          const firstName = userInfo.firstname && userInfo.firstname !== 'null' ? userInfo.firstname.trim() : '';
          const lastName = userInfo.lastname && userInfo.lastname !== 'null' ? userInfo.lastname.trim() : '';
          const fullName = `${firstName} ${lastName}`.trim();
          if (fullName) return fullName;
        }
      }
      
      // Try allContacts
      const contact = allContacts.find(c => Number(c.vanid) === Number(vanId));
      if (contact) {
        if (contact.firstname || contact.lastname) {
          const firstName = contact.firstname && contact.firstname !== 'null' ? contact.firstname.trim() : '';
          const lastName = contact.lastname && contact.lastname !== 'null' ? contact.lastname.trim() : '';
          const fullName = `${firstName} ${lastName}`.trim();
          if (fullName) return fullName;
        }
      }
    }
    
    if (apiName && apiName.trim() && apiName !== 'null null') {
      return apiName.trim();
    }
    
    return vanId ? `Person ${vanId}` : 'Unknown';
  };

  const renderMeetingCard = (meeting: MeetingNote, index: number, isOrganizer: boolean) => {
    const meetingDateStr = (typeof meeting.date_contacted === 'object' ? meeting.date_contacted?.value : meeting.date_contacted) ||
                          (typeof meeting.datestamp === 'object' ? meeting.datestamp?.value : meeting.datestamp) || '';
    const meetingDate = meetingDateStr ? new Date(meetingDateStr) : null;
    
    // Get the other person's name
    const otherPersonVanId = isOrganizer 
      ? (meeting.participant_vanid || meeting.vanid)
      : meeting.organizer_vanid;
    const otherPersonName = isOrganizer
      ? getPersonName(otherPersonVanId, meeting.contact)
      : getPersonName(otherPersonVanId, meeting.organizer);
    
    // Collect all note fields
    const noteFields: Array<{label: string, content: string}> = [];
    const fieldMap: Record<string, string> = {
      purpose: 'Purpose',
      notes_purpose: 'Purpose',
      commitments: 'Commitments',
      notes_commitments: 'Commitments',
      stakes: 'Stakes',
      notes_stakes: 'Stakes',
      development: 'Development',
      notes_development: 'Development',
      evaluation: 'Evaluation',
      notes_evaluation: 'Evaluation',
      notes_next_steps: 'Next Steps',
      next_steps: 'Next Steps',
      notes_action_items: 'Action Items',
      action_items: 'Action Items'
    };
    
    const seenLabels = new Set<string>();
    Object.keys(meeting).forEach(key => {
      if (fieldMap[key]) {
        const value = (meeting as any)[key];
        const label = fieldMap[key];
        if (value && typeof value === 'string' && value.trim() && !seenLabels.has(label)) {
          noteFields.push({ label, content: value.trim() });
          seenLabels.add(label);
        }
      }
    });
    
    const hasNotes = noteFields.length > 0;

    return (
      <Box 
        key={index} 
        sx={{ 
          p: 1.5, 
          border: '1px solid #e0e0e0', 
          borderRadius: 1,
          backgroundColor: '#fafafa'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: hasNotes ? 1 : 0 }}>
          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
            <strong>{meeting.meeting_type || meeting.conversation_type || 'Meeting'}</strong> with {otherPersonName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {meetingDate ? format(meetingDate, 'MMM dd, yyyy') : 'Unknown Date'}
          </Typography>
        </Box>
        
        {meeting.chapter && (
          <Chip 
            label={meeting.chapter} 
            size="small"
            sx={{ height: 18, fontSize: '0.7rem', mb: hasNotes ? 1 : 0 }}
          />
        )}
        
        {hasNotes && (
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {noteFields.map((field, idx) => (
              <Typography 
                key={idx} 
                variant="body2" 
                sx={{ fontSize: '0.8rem', lineHeight: 1.4 }}
              >
                <strong>{field.label}:</strong> {field.content}
              </Typography>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh', maxHeight: '90vh' }
      }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h6" fontWeight={600}>
              {organizerName}'s Conversations
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary">
                {meetingsData.asOrganizer.length + meetingsData.asParticipant.length} total conversations
              </Typography>
              <Typography variant="body2" color="text.secondary">•</Typography>
              <Typography variant="body2" color="text.secondary">
                {meetingsData.asOrganizer.length} organized
              </Typography>
              <Typography variant="body2" color="text.secondary">•</Typography>
              <Typography variant="body2" color="text.secondary">
                {meetingsData.asParticipant.length} participated in
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Organizer Details Section */}
          <Box sx={{ 
            backgroundColor: '#f8f9fa', 
            borderRadius: 1, 
            p: 2,
            border: '1px solid #e0e0e0'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Organizer Details
              </Typography>
              {!isEditingDetails && (
                <IconButton size="small" onClick={handleEditDetails} sx={{ color: 'primary.main' }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
            </Box>

            {detailsError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {detailsError}
              </Alert>
            )}

            {detailsSuccess && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {detailsSuccess}
              </Alert>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Turf Field */}
              {isEditingDetails ? (
                <TextField
                  label="Turf"
                  value={editedTurf}
                  onChange={(e) => setEditedTurf(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="Enter organizing territory/area"
                />
              ) : (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Turf
                  </Typography>
                  <Typography variant="body2">
                    {organizerDetails?.turf || <em style={{ color: '#999' }}>Not set</em>}
                  </Typography>
                </Box>
              )}

              {/* Team Role Field */}
              {isEditingDetails ? (
                <TextField
                  label="Team Role"
                  value={editedTeamRole}
                  onChange={(e) => setEditedTeamRole(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="e.g., Lead Organizer, Deputy, Member"
                />
              ) : (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Team Role
                  </Typography>
                  <Typography variant="body2">
                    {organizerDetails?.team_role || <em style={{ color: '#999' }}>Not set</em>}
                  </Typography>
                </Box>
              )}

              {/* Edit Actions */}
              {isEditingDetails && (
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  <Button
                    size="small"
                    startIcon={<CancelIcon />}
                    onClick={handleCancelEdit}
                    disabled={isSavingDetails}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={isSavingDetails ? <CircularProgress size={16} /> : <SaveIcon />}
                    onClick={handleSaveDetails}
                    disabled={isSavingDetails}
                  >
                    {isSavingDetails ? 'Saving...' : 'Save'}
                  </Button>
                </Box>
              )}
            </Box>
          </Box>

          <Divider />

          {/* Conversations as Organizer */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', fontSize: '0.875rem', fontWeight: 600 }}>
              Conversations Organized by {organizerName} ({meetingsData.asOrganizer.length})
            </Typography>
            
            <Box sx={{ 
              maxHeight: '300px', 
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5
            }}>
              {meetingsData.asOrganizer.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center', fontSize: '0.875rem' }}>
                  No conversations organized
                </Typography>
              ) : (
                meetingsData.asOrganizer.map((meeting, index) => 
                  renderMeetingCard(meeting, index, true)
                )
              )}
            </Box>
          </Box>

          <Divider />

          {/* Conversations as Participant */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', fontSize: '0.875rem', fontWeight: 600 }}>
              Conversations {organizerName} Participated In ({meetingsData.asParticipant.length})
            </Typography>
            
            <Box sx={{ 
              maxHeight: '300px', 
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5
            }}>
              {meetingsData.asParticipant.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center', fontSize: '0.875rem' }}>
                  No conversations participated in
                </Typography>
              ) : (
                meetingsData.asParticipant.map((meeting, index) => 
                  renderMeetingCard(meeting, index, false)
                )
              )}
            </Box>
          </Box>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined" size="small">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OrganizerDetailsDialog;
