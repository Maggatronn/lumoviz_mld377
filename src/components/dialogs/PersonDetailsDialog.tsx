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
  Chip,
  IconButton,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Email as EmailIcon,
  Phone as PhoneIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Chat as ChatIcon,
  Add as AddIcon
} from '@mui/icons-material';

interface MeetingNote {
  organizer_vanid: number;
  vanid?: number;
  participant_vanid?: number;
  organizer?: string;
  contact?: string;
  datestamp?: { value: string } | string;
  date_contacted?: { value: string } | string; // From /meetings/by-contacts API
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
  // lumoviz_meetings actual fields (prefixed lmtg_ to avoid collisions)
  lmtg_values?: string;
  lmtg_difference?: string;
  lmtg_resources?: string;
  lmtg_commitment_what?: string;
  lmtg_commitment_asked?: string;
  lmtg_commitment_made?: string;
  lmtg_leadership_tag?: string;
  lmtg_catapults?: string;
  lmtg_notes?: string;
  data_source?: string;
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
}

interface PersonRecord {
  id: string;
  name: string;
  type?: string;
  chapter: string;
  mostRecentContact: Date | null;
  mostRecentContactAllTime?: Date | null;
  totalMeetings: number;
  totalMeetingsAllTime?: number;
  latestNotes: string;
  email?: string;
  phone?: string;
  organizers: string[];
  loeStatus?: string;
  memberStatus?: string;
  allMeetings: MeetingNote[];
  allMeetingsAllTime?: MeetingNote[];
}

interface PersonDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  person: any;
  userMap: Map<number, UserInfo>;
  orgIds?: any[];
  pledgeSubmissions?: any[];
  cachedMeetings?: MeetingNote[]; // Pre-loaded meetings from MainApp
  allContacts?: any[]; // All contacts for name lookup
  sx?: any;
  onEditPerson?: (personId: string) => void;
  onAddConversation?: (personId: string) => void;
  onAddToAction?: (personId: string) => void;
}

const PersonDetailsDialog: React.FC<PersonDetailsDialogProps> = ({
  open,
  onClose,
  person,
  userMap,
  orgIds = [],
  pledgeSubmissions = [],
  cachedMeetings = [],
  allContacts = [],
  sx,
  onEditPerson,
  onAddConversation,
  onAddToAction
}) => {
  // Use cached meetings instead of state
  const personMeetings = React.useMemo(() => {
    if (!open || !person) return [];
    
    // Filter cached meetings for this person
    const personVanid = person.id?.toString();
    
    // Debug: Check organizer name resolution
    if (cachedMeetings.length > 0 && cachedMeetings[0].organizer_vanid) {
      const sampleOrganizerVanid = cachedMeetings[0].organizer_vanid;
      const resolvedName = userMap.get(Number(sampleOrganizerVanid));
      console.log('[PersonDetailsDialog] Organizer name check:', {
        organizer_vanid: sampleOrganizerVanid,
        api_organizer_name: cachedMeetings[0].organizer,
        userMap_exists: !!resolvedName,
        userMap_name: resolvedName?.name || `${resolvedName?.firstname || ''} ${resolvedName?.lastname || ''}`.trim()
      });
    }
    
    console.log('[PersonDetailsDialog] Filtering meetings for person:', {
      personId: person.id,
      personName: person.name,
      cachedMeetingsCount: cachedMeetings.length,
      sampleCachedMeeting: cachedMeetings[0] ? {
        participant_vanid: cachedMeetings[0].participant_vanid,
        organizer: cachedMeetings[0].organizer,
        organizer_vanid: cachedMeetings[0].organizer_vanid,
        has_purpose: !!(cachedMeetings[0].purpose || cachedMeetings[0].notes_purpose)
      } : null
    });
    
    const filteredMeetings = cachedMeetings.filter(meeting => {
      const meetingVanid = meeting.participant_vanid?.toString() || meeting.vanid?.toString();
      return meetingVanid === personVanid;
    });
    
    console.log('[PersonDetailsDialog] Filtered result:', {
      matchCount: filteredMeetings.length,
      sampleMatch: filteredMeetings[0]
    });
    
    // Sort by date (most recent first) - handle both date_contacted and datestamp
    return filteredMeetings.sort((a, b) => {
      const dateA = (typeof a.date_contacted === 'object' ? a.date_contacted?.value : a.date_contacted) ||
                    (typeof a.datestamp === 'object' ? a.datestamp?.value : a.datestamp) || '';
      const dateB = (typeof b.date_contacted === 'object' ? b.date_contacted?.value : b.date_contacted) ||
                    (typeof b.datestamp === 'object' ? b.datestamp?.value : b.datestamp) || '';
      return dateB.localeCompare(dateA);
    });
  }, [open, person, cachedMeetings]);
  
  const loadingMeetings = false; // No loading since we use cached data
  
  // Find pledges for this person
  const personPledges = React.useMemo(() => {
    if (!person || !pledgeSubmissions) return [];
    
    const pledges: any[] = [];
    pledgeSubmissions.forEach(pledgeGroup => {
      if (!pledgeGroup.submissions) return;
      
      pledgeGroup.submissions.forEach((submission: any) => {
        if (submission.vanid?.toString() === person.id) {
          pledges.push({
            ...submission,
            date_submitted: pledgeGroup.date_submitted,
            chapter: pledgeGroup.chapter
          });
        }
      });
    });
    
    // Sort by date (most recent first)
    return pledges.sort((a, b) => {
      const aDate = new Date(a.date_submitted);
      const bDate = new Date(b.date_submitted);
      return bDate.getTime() - aDate.getTime();
    });
  }, [person, pledgeSubmissions]);
  
  // Calculate most recent contact including pledges
  const mostRecentContactWithActions = React.useMemo(() => {
    const meetingDate = person?.mostRecentContactAllTime || person?.mostRecentContact;
    const pledgeDate = personPledges.length > 0 ? new Date(personPledges[0].date_submitted) : null;
    
    if (!meetingDate && !pledgeDate) return null;
    if (!meetingDate) return pledgeDate;
    if (!pledgeDate) return meetingDate;
    
    return pledgeDate > meetingDate ? pledgeDate : meetingDate;
  }, [person, personPledges]);


  // Helper function for consistent name resolution
  const getConsistentName = (vanId: number | undefined, apiBuiltName: string | undefined, role: 'organizer' | 'contact'): string => {
    // Debug log for troubleshooting
    const debugInfo = { vanId, apiBuiltName, role };
    
    // Priority 1: Check userMap first (most reliable)
    if (vanId) {
      const userInfo = userMap.get(Number(vanId));
      if (userInfo) {
        console.log('[getConsistentName] Found in userMap:', { vanId, userInfo });
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
          if (fullName) {
            return fullName;
          }
        }
      } else {
        console.log('[getConsistentName] NOT found in userMap:', { vanId, userMapSize: userMap.size, sampleKeys: Array.from(userMap.keys()).slice(0, 5) });
      }
    }
    
    // Priority 2: Check orgIds array directly
    if (vanId) {
      const vanIdNum = Number(vanId);
      const orgInfo = orgIds.find(p => Number(p.vanid) === vanIdNum);
      if (orgInfo) {
        console.log('[getConsistentName] Found in orgIds:', { vanId, orgInfo });
        if ((orgInfo.firstname && orgInfo.firstname !== 'null') || (orgInfo.lastname && orgInfo.lastname !== 'null')) {
          const firstName = orgInfo.firstname && orgInfo.firstname !== 'null' ? orgInfo.firstname.trim() : '';
          const lastName = orgInfo.lastname && orgInfo.lastname !== 'null' ? orgInfo.lastname.trim() : '';
          const fullName = `${firstName} ${lastName}`.trim();
          if (fullName) {
            return fullName;
          }
        }
        if (orgInfo.name && orgInfo.name.trim() && orgInfo.name !== 'null null') {
          return orgInfo.name.trim();
        }
      }
    }

    // Priority 3: Check allContacts array
    if (vanId) {
      const vanIdNum = Number(vanId);
      const contact = allContacts.find(c => Number(c.vanid) === vanIdNum);
      if (contact) {
        console.log('[getConsistentName] Found in allContacts:', { vanId, contact });
        if ((contact.firstname && contact.firstname !== 'null') || (contact.lastname && contact.lastname !== 'null')) {
          const firstName = contact.firstname && contact.firstname !== 'null' ? contact.firstname.trim() : '';
          const lastName = contact.lastname && contact.lastname !== 'null' ? contact.lastname.trim() : '';
          const fullName = `${firstName} ${lastName}`.trim();
          if (fullName) {
            return fullName;
          }
        }
        if (contact.name && contact.name.trim() && contact.name !== 'null null') {
          return contact.name.trim();
        }
      }
    }

    // Priority 4: Use API-provided name
    if (apiBuiltName && apiBuiltName.trim() && apiBuiltName !== 'null null') {
      console.log('[getConsistentName] Using API name:', { vanId, apiBuiltName });
      return apiBuiltName.trim();
    }

    // Fallback
    console.log('[getConsistentName] Using fallback:', debugInfo);
    if (!vanId) {
      return `Unknown ${role === 'organizer' ? 'Organizer' : 'Contact'}`;
    }
    
    return `${role === 'organizer' ? 'Organizer' : 'Contact'} ${vanId}`;
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      sx={sx}
      PaperProps={{
        sx: { minHeight: '70vh', maxHeight: '90vh' }
      }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" fontWeight={600}>
                {person ? person.name : 'Person Details'}
              </Typography>
              {person && onEditPerson && (
                <IconButton 
                  size="small" 
                  onClick={() => onEditPerson(person.id)}
                  sx={{ color: 'primary.main' }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
            {person && (
              <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="body2" color="text.secondary">
                  {person.chapter}
                </Typography>
                <Typography variant="body2" color="text.secondary">•</Typography>
                {person.loeStatus && (
                  <>
                    <Chip 
                      label={person.loeStatus} 
                      size="small"
                      sx={{ height: 20, fontSize: '0.75rem' }}
                    />
                    <Typography variant="body2" color="text.secondary">•</Typography>
                  </>
                )}
                {person.memberStatus && (
                  <>
                    <Chip 
                      label={person.memberStatus} 
                      size="small"
                      sx={{ height: 20, fontSize: '0.75rem' }}
                    />
                    <Typography variant="body2" color="text.secondary">•</Typography>
                  </>
                )}
                <Typography variant="body2" color="text.secondary">
                  {person.totalMeetingsAllTime || personMeetings.length} meetings
                </Typography>
                {mostRecentContactWithActions && (
                  <>
                    <Typography variant="body2" color="text.secondary">•</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Last: {format(mostRecentContactWithActions, 'MMM dd, yyyy')}
                    </Typography>
                  </>
                )}
              </Box>
            )}
            {person && (person.email || person.phone) && (
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                {person.email && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">{person.email}</Typography>
                  </Box>
                )}
                {person.phone && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">{person.phone}</Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      {person && (
        <DialogContent sx={{ pt: 0 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Recent Actions */}
            {personPledges.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                    Actions ({personPledges.length})
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {personPledges.map((pledge, index) => (
                      <Box 
                        key={index} 
                        sx={{ 
                          p: 1.5, 
                          border: '1px solid #e0e0e0', 
                          borderRadius: 1,
                          backgroundColor: '#fafafa'
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip 
                              label="Pledge Signed" 
                              size="small" 
                              color="success"
                              sx={{ height: 20, fontSize: '0.75rem' }}
                            />
                            {pledge.leader && (
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                                with {pledge.leader}
                              </Typography>
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {format(new Date(pledge.date_submitted), 'MMM dd, yyyy')}
                          </Typography>
                        </Box>
                        
                        {pledge.desired_change && (
                          <Typography variant="body2" sx={{ mt: 1, fontSize: '0.875rem' }}>
                            {pledge.desired_change}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Box>
              </>
            )}

            {/* Meeting History */}
            <Box>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', fontSize: '0.875rem' }}>
                One-on-Ones ({personMeetings.length})
              </Typography>
              
              <Box sx={{ 
                maxHeight: '400px', 
                overflowY: 'auto'
              }}>
                {loadingMeetings ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 4 }}>
                    <CircularProgress size={32} />
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                      Loading meetings...
                    </Typography>
                  </Box>
                ) : personMeetings.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center', fontSize: '0.875rem' }}>
                    No meetings found
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {personMeetings
                      .sort((a, b) => {
                        const aDate = (typeof a.date_contacted === 'object' ? a.date_contacted?.value : a.date_contacted) ||
                                     (typeof a.datestamp === 'object' ? a.datestamp?.value : a.datestamp) || '';
                        const bDate = (typeof b.date_contacted === 'object' ? b.date_contacted?.value : b.date_contacted) ||
                                     (typeof b.datestamp === 'object' ? b.datestamp?.value : b.datestamp) || '';
                        return bDate.localeCompare(aDate);
                      })
                      .map((meeting, index) => {
                        const meetingDateStr = (typeof meeting.date_contacted === 'object' ? meeting.date_contacted?.value : meeting.date_contacted) ||
                                              (typeof meeting.datestamp === 'object' ? meeting.datestamp?.value : meeting.datestamp) || '';
                        const meetingDate = meetingDateStr ? new Date(meetingDateStr) : null;
                        
                        const organizer = getConsistentName(meeting.organizer_vanid, meeting.organizer, 'organizer');
                        
                        // Dynamically collect all note fields.
                        // lumoviz_meetings rows carry lmtg_* fields with proper labels;
                        // historical conversations rows carry the old notes_* / raw fields.
                        const noteFields: Array<{label: string, content: string}> = [];

                        const isLumovizMeeting = (meeting as any).data_source === 'lumoviz_meetings';

                        if (isLumovizMeeting) {
                          // Use the actual lumoviz_meetings field labels in the order they appear in the log dialog
                          const lumovizFieldMap: Array<{key: string, label: string}> = [
                            { key: 'notes_purpose',           label: 'Purpose' },
                            { key: 'lmtg_values',             label: 'Values' },
                            { key: 'lmtg_difference',         label: 'Differences' },
                            { key: 'lmtg_resources',          label: 'Resources' },
                            { key: 'lmtg_commitment_asked',   label: 'Commitment Asked' },
                            { key: 'lmtg_commitment_made',    label: 'Commitment Made' },
                            { key: 'lmtg_commitment_what',    label: 'Commitment Details' },
                            { key: 'lmtg_leadership_tag',     label: 'Leadership Assessment' },
                            { key: 'lmtg_catapults',          label: 'Catapults' },
                            { key: 'lmtg_notes',              label: 'Notes' },
                          ];
                          lumovizFieldMap.forEach(({ key, label }) => {
                            const value = (meeting as any)[key];
                            if (value && typeof value === 'string' && value.trim()) {
                              noteFields.push({ label, content: value.trim() });
                            }
                          });
                        } else {
                          // Historical conversations: use original field map
                          const legacyFieldMap: Record<string, string> = {
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
                            action_items: 'Action Items',
                          };
                          const seenLabels = new Set<string>();
                          Object.keys(meeting).forEach(key => {
                            if (legacyFieldMap[key]) {
                              const value = (meeting as any)[key];
                              const label = legacyFieldMap[key];
                              if (value && typeof value === 'string' && value.trim() && !seenLabels.has(label)) {
                                noteFields.push({ label, content: value.trim() });
                                seenLabels.add(label);
                              }
                            }
                          });
                        }
                        
                        const hasNotes = noteFields.length > 0;

                        const constituencyStance = (meeting as any).lmtg_sp_constituency_stance || '';
                        const constituencyHow    = (meeting as any).lmtg_sp_constituency_how    || '';
                        const changeStance       = (meeting as any).lmtg_sp_change_stance       || '';
                        const changeHow          = (meeting as any).lmtg_sp_change_how          || '';
                        const hasSharedPurpose   = !!(constituencyStance || changeStance);

                        const stanceEmoji = (stance: string) =>
                          stance === 'affirm' ? '✅' : stance === 'challenge' ? '⚠️' : stance === 'neither' ? '➖' : '';
                        const stanceLabel = (stance: string) =>
                          stance === 'affirm' ? 'Affirm' : stance === 'challenge' ? 'Challenge' : stance === 'neither' ? 'Neither' : stance;
                        const stanceStyle = (stance: string): React.CSSProperties => {
                          const map: Record<string, { color: string; background: string; border: string }> = {
                            affirm:    { color: '#0f766e', background: '#f0fdf9', border: '#99f6e4' },
                            challenge: { color: '#b91c1c', background: '#fef2f2', border: '#fca5a5' },
                            neither:   { color: '#6b7280', background: '#f9fafb', border: '#d1d5db' },
                          };
                          const s = map[stance] || map.neither;
                          return {
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', borderRadius: 10,
                            fontSize: '0.7rem', fontWeight: 700,
                            color: s.color, backgroundColor: s.background,
                            border: `1px solid ${s.border}`,
                          };
                        };

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
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: (hasNotes || hasSharedPurpose) ? 1 : 0 }}>
                              <Box>
                                <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                                  <strong>{meeting.conversation_type || meeting.meeting_type || 'Meeting'}</strong> with {organizer}
                                </Typography>
                                {meeting.chapter && (
                                  <Chip 
                                    label={meeting.chapter} 
                                    size="small"
                                    sx={{ height: 18, fontSize: '0.7rem', mt: 0.5 }}
                                  />
                                )}
                              </Box>
                              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                                {meetingDate ? format(meetingDate, 'MMM dd, yyyy') : 'Unknown Date'}
                              </Typography>
                            </Box>
                            
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

                            {hasSharedPurpose && (
                              <Box sx={{
                                mt: 1.25,
                                p: 1,
                                borderRadius: 1,
                                border: '1px solid #e0e0e0',
                                backgroundColor: '#fff',
                              }}>
                                <Typography variant="caption" sx={{
                                  display: 'block', mb: 0.75,
                                  fontSize: '0.65rem', fontWeight: 700,
                                  textTransform: 'uppercase', letterSpacing: 0.5,
                                  color: 'text.secondary',
                                }}>
                                  Shared Purpose
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                  {constituencyStance && (
                                    <Box>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                        <Typography variant="caption" sx={{ fontSize: '0.72rem', color: 'text.secondary', minWidth: 80 }}>
                                          Constituency
                                        </Typography>
                                        <span style={stanceStyle(constituencyStance)}>
                                          {stanceEmoji(constituencyStance)} {stanceLabel(constituencyStance)}
                                        </span>
                                      </Box>
                                      {constituencyHow && (
                                        <Typography variant="body2" sx={{ mt: 0.4, ml: '88px', fontSize: '0.75rem', color: 'text.secondary', fontStyle: 'italic' }}>
                                          {constituencyHow}
                                        </Typography>
                                      )}
                                    </Box>
                                  )}
                                  {changeStance && (
                                    <Box>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                        <Typography variant="caption" sx={{ fontSize: '0.72rem', color: 'text.secondary', minWidth: 80 }}>
                                          Change
                                        </Typography>
                                        <span style={stanceStyle(changeStance)}>
                                          {stanceEmoji(changeStance)} {stanceLabel(changeStance)}
                                        </span>
                                      </Box>
                                      {changeHow && (
                                        <Typography variant="body2" sx={{ mt: 0.4, ml: '88px', fontSize: '0.75rem', color: 'text.secondary', fontStyle: 'italic' }}>
                                          {changeHow}
                                        </Typography>
                                      )}
                                    </Box>
                                  )}
                                </Box>
                              </Box>
                            )}
                          </Box>
                        );
                      })}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </DialogContent>
      )}
      
      <DialogActions sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {person && onAddConversation && (
            <Button 
              onClick={() => {
                onAddConversation(person.id);
                onClose();
              }} 
              variant="outlined" 
              size="small"
              startIcon={<ChatIcon />}
            >
              Log Conversation
            </Button>
          )}
          {person && onAddToAction && (
            <Button 
              onClick={() => {
                onAddToAction(person.id);
                onClose();
              }} 
              variant="outlined" 
              size="small"
              startIcon={<AddIcon />}
            >
              Add to Action
            </Button>
          )}
        </Box>
        <Button onClick={onClose} variant="contained" size="small">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PersonDetailsDialog;
