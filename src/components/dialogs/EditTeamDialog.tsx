import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Chip,
  Box,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material';
import { Edit as EditIcon, Save as SaveIcon, Cancel as CancelIcon, Palette as PaletteIcon } from '@mui/icons-material';
import { useChapterColors, getCustomChapterColor } from '../../contexts/ChapterColorContext';

interface TeamMember {
  id: string;
  name: string;
  type?: string;
  chapter?: string;
  loeStatus?: string;
  email?: string;
  team_role?: string;
  turf?: string;
  constituentRole?: string;
  functionalRole?: string;
}

const SEARCH_DEBOUNCE_MS = 300;

interface EditTeamDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (updatedTeam: any) => Promise<void>;
  organizers: TeamMember[];
  allPeople: TeamMember[];
  chapters: string[];
  onSearchPeople?: (query: string) => Promise<TeamMember[]>;
  teamToEdit: {
    id: string;
    teamName: string;
    chapter: string;
    organizers: TeamMember[];
    lead: TeamMember | null;
    turf?: string;
    sharedPurpose?: string;
    norms?: string;
    normCorrection?: string;
    constituency?: string;
    version?: number;
    dateCreated?: string;
  } | null;
}

const EditTeamDialog: React.FC<EditTeamDialogProps> = ({
  open,
  onClose,
  onSave,
  organizers,
  allPeople,
  chapters,
  onSearchPeople,
  teamToEdit
}) => {
  const { customColors } = useChapterColors();
  const [teamLead, setTeamLead] = useState<TeamMember | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [chapter, setChapter] = useState<string>('');
  const [turf, setTurf] = useState<string>('');
  const [teamName, setTeamName] = useState<string>('');
  const [color, setColor] = useState<string>('#2563eb');
  const [sharedPurpose, setSharedPurpose] = useState<string>('');
  const [norms, setNorms] = useState<string>('');
  const [normCorrection, setNormCorrection] = useState<string>('');
  const [constituency, setConstituency] = useState<string>('');
  const [changeReason, setChangeReason] = useState<string>('');
  // Track individual member roles and turfs
  const [memberConstituentRoles, setMemberConstituentRoles] = useState<Map<string, string>>(new Map());
  const [memberFunctionalRoles, setMemberFunctionalRoles] = useState<Map<string, string>>(new Map());
  const [memberTurfs, setMemberTurfs] = useState<Map<string, string>>(new Map());
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>('');
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [leadSearchResults, setLeadSearchResults] = useState<TeamMember[]>([]);
  const [leadSearchLoading, setLeadSearchLoading] = useState(false);
  const [membersSearchQuery, setMembersSearchQuery] = useState('');
  const [membersSearchResults, setMembersSearchResults] = useState<TeamMember[]>([]);
  const [membersSearchLoading, setMembersSearchLoading] = useState(false);
  const leadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const membersDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Populate form when teamToEdit changes
  useEffect(() => {
    if (open && teamToEdit) {
      console.log('📝 EditTeamDialog: Populating form with team data:', teamToEdit);
      
      setTeamName(teamToEdit.teamName || '');
      setChapter(teamToEdit.chapter || '');
      setTurf(teamToEdit.turf || '');
      setSharedPurpose(teamToEdit.sharedPurpose || '');
      setNorms(teamToEdit.norms || '');
      setNormCorrection(teamToEdit.normCorrection || '');
      setConstituency(teamToEdit.constituency || '');
      setChangeReason(''); // Reset change reason for each edit
      setTeamLead(teamToEdit.lead);
      
      // Set color based on current chapter color
      if (teamToEdit.chapter) {
        const currentColor = getCustomChapterColor(teamToEdit.chapter, customColors);
        setColor(currentColor);
      }
      
      // Set team members (excluding the lead)
      const membersExcludingLead = teamToEdit.organizers.filter(
        organizer => organizer.id !== teamToEdit.lead?.id
      );
      setTeamMembers(membersExcludingLead);
      
      // Initialize member roles and turfs from existing data
      const constituentRolesMap = new Map<string, string>();
      const functionalRolesMap = new Map<string, string>();
      const turfsMap = new Map<string, string>();
      teamToEdit.organizers.forEach(organizer => {
        if (organizer.constituentRole) {
          constituentRolesMap.set(organizer.id, organizer.constituentRole);
        }
        if (organizer.functionalRole) {
          functionalRolesMap.set(organizer.id, organizer.functionalRole);
        }
        if (organizer.turf) {
          turfsMap.set(organizer.id, organizer.turf);
        }
      });
      setMemberConstituentRoles(constituentRolesMap);
      setMemberFunctionalRoles(functionalRolesMap);
      setMemberTurfs(turfsMap);
      
      setSaveError('');
    }
  }, [open, teamToEdit]);

  // Load initial people when dialog opens
  useEffect(() => {
    if (!onSearchPeople || !open) {
      setLeadSearchResults([]);
      return;
    }
    
    setLeadSearchLoading(true);
    onSearchPeople('').then(setLeadSearchResults).finally(() => setLeadSearchLoading(false));
  }, [open, onSearchPeople]);

  // Search when query changes (debounced)
  useEffect(() => {
    if (!onSearchPeople || !leadSearchQuery.trim()) {
      return;
    }
    
    if (leadDebounceRef.current) clearTimeout(leadDebounceRef.current);
    leadDebounceRef.current = setTimeout(() => {
      setLeadSearchLoading(true);
      onSearchPeople(leadSearchQuery.trim()).then(setLeadSearchResults).finally(() => setLeadSearchLoading(false));
      leadDebounceRef.current = null;
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (leadDebounceRef.current) clearTimeout(leadDebounceRef.current); };
  }, [leadSearchQuery, onSearchPeople]);

  useEffect(() => {
    if (!onSearchPeople || !open) {
      setMembersSearchResults([]);
      return;
    }
    
    if (membersDebounceRef.current) clearTimeout(membersDebounceRef.current);
    membersDebounceRef.current = setTimeout(() => {
      setMembersSearchLoading(true);
      onSearchPeople(membersSearchQuery.trim()).then((list) => {
        setMembersSearchResults(list.filter((p) => p.id !== teamLead?.id));
      }).finally(() => setMembersSearchLoading(false));
      membersDebounceRef.current = null;
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (membersDebounceRef.current) clearTimeout(membersDebounceRef.current); };
  }, [membersSearchQuery, onSearchPeople, teamLead?.id, open]);

  const handleClose = () => {
    setTeamLead(null);
    setTeamMembers([]);
    setChapter('');
    setTurf('');
    setTeamName('');
    setColor('#2563eb');
    setSharedPurpose('');
    setNorms('');
    setNormCorrection('');
    setConstituency('');
    setChangeReason('');
    setMemberConstituentRoles(new Map());
    setMemberFunctionalRoles(new Map());
    setMemberTurfs(new Map());
    setIsSaving(false);
    setSaveError('');
    setLeadSearchQuery('');
    setLeadSearchResults([]);
    setMembersSearchQuery('');
    setMembersSearchResults([]);
    onClose();
  };

  const handleSave = async () => {
    // Validation
    if (!teamName.trim()) {
      setSaveError('Team name is required');
      return;
    }
    
    if (!chapter) {
      setSaveError('Chapter is required');
      return;
    }
    
    // teamLead (coordinator) is optional — skip validation

    setIsSaving(true);
    setSaveError('');

    try {
      // Combine all organizers (lead + members) with their roles and turfs
      const allOrganizers = [...(teamLead ? [teamLead] : []), ...teamMembers].filter(Boolean) as TeamMember[];
      const organizerDetails = allOrganizers.map(organizer => ({
        id: organizer.id,
        name: organizer.name,
        constituentRole: memberConstituentRoles.get(organizer.id) || '',
        functionalRole: memberFunctionalRoles.get(organizer.id) || '',
        turf: memberTurfs.get(organizer.id) || ''
      }));
      
      const updatedTeam = {
        id: teamToEdit?.id,
        teamName: teamName.trim(),
        teamLead: teamLead?.name ?? '',
        chapter,
        teamMembers: teamMembers.map(member => member.name),
        turf: turf.trim(),
        color: color,
        sharedPurpose: sharedPurpose.trim(),
        norms: norms.trim(),
        normCorrection: normCorrection.trim(),
        constituency: constituency.trim(),
        changeReason: changeReason.trim(),
        organizerDetails: organizerDetails, // Include member roles and turfs
        version: teamToEdit?.version,
        dateCreated: teamToEdit?.dateCreated
      };

      console.log('💾 EditTeamDialog: Saving updated team:', updatedTeam);
      console.log('📋 Current teamToEdit:', teamToEdit);
      
      await onSave(updatedTeam);
      handleClose();
      
    } catch (error) {
      console.error('❌ Error saving team updates:', error);
      console.error('❌ Full error object:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save team updates');
    } finally {
      setIsSaving(false);
    }
  };

  // Available people for selection (excluding current team lead from members)
  const availablePeople = allPeople.filter(person => 
    !teamLead || person.id !== teamLead.id
  );

  const dialogTitle = teamToEdit ? `Edit Team: ${teamToEdit.teamName}` : 'Edit Team';

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2, maxHeight: '90vh' }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #ddd'
      }}>
        <EditIcon color="primary" />
        <Typography variant="h6" component="span">
          {dialogTitle}
        </Typography>
        {teamToEdit?.version && (
          <Chip 
            label={`v${teamToEdit.version}`} 
            size="small" 
            variant="outlined" 
            color="primary"
            sx={{ ml: 'auto' }}
          />
        )}
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {saveError}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Team Name */}
          <TextField
            label="Team Name *"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g., Durham Organizers, Chapel Hill Team, etc."
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#f8f9fa',
                '&:hover': { backgroundColor: '#e9ecef' },
                '&.Mui-focused': { backgroundColor: '#fff' }
              }
            }}
          />

          {/* Team Coordinator – optional */}
          <Autocomplete
            options={onSearchPeople ? leadSearchResults : allPeople}
            getOptionLabel={(option) => option.name || ''}
            value={teamLead}
            onChange={(_, newValue) => setTeamLead(newValue)}
            onInputChange={(_, value) => setLeadSearchQuery(value)}
            filterOptions={onSearchPeople ? (opts) => opts : (options, { inputValue }) => {
              const query = inputValue.trim();
              if (query.length < 2) return [];
              const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
              return options.filter((person) => {
                const name = (person.name || '').toLowerCase();
                return terms.every((term) => name.includes(term));
              }).slice(0, 50);
            }}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            loading={onSearchPeople ? leadSearchLoading : false}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Team Coordinator"
                placeholder="Type a name to search (same list as People table)..."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#f8f9fa',
                    '&:hover': { backgroundColor: '#e9ecef' },
                    '&.Mui-focused': { backgroundColor: '#fff' }
                  }
                }}
              />
            )}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {option.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.type || 'contact'}
                    {option.chapter && ` • ${option.chapter}`}
                    {option.loeStatus && ` • ${option.loeStatus}`}
                  </Typography>
                </Box>
              </Box>
            )}
          />

          {/* Team Members – type to search; same Contacts/People list when onSearchPeople provided */}
          <Autocomplete
            multiple
            options={onSearchPeople ? membersSearchResults : availablePeople}
            getOptionLabel={(option) => option.name || ''}
            value={teamMembers}
            onChange={(_, newValue) => setTeamMembers(newValue)}
            onInputChange={(_, value) => setMembersSearchQuery(value)}
            filterOptions={onSearchPeople ? (opts) => opts : (options, { inputValue }) => {
              const query = inputValue.trim();
              if (query.length < 2) return [];
              const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
              return options.filter((person) => {
                const name = (person.name || '').toLowerCase();
                return terms.every((term) => name.includes(term));
              }).slice(0, 50);
            }}
            loading={onSearchPeople ? membersSearchLoading : false}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Team Members"
                placeholder="Type a name to search (same list as People table)..."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#f8f9fa',
                    '&:hover': { backgroundColor: '#e9ecef' },
                    '&.Mui-focused': { backgroundColor: '#fff' }
                  }
                }}
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  variant="outlined"
                  label={option.name}
                  size="small"
                  {...getTagProps({ index })}
                  key={option.id}
                />
              ))
            }
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {option.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.chapter} • {option.loeStatus || 'Unknown LOE'}
                  </Typography>
                </Box>
              </Box>
            )}
          />

          {/* Team Member Details - Roles and Turfs */}
          {(teamLead || teamMembers.length > 0) && (
            <Box sx={{ 
              p: 2, 
              borderRadius: 1, 
              backgroundColor: '#f8f9fa',
              border: '1px solid #dee2e6'
            }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main' }}>
                Member Roles & Turfs
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Team Lead */}
                {teamLead && (
                  <Box sx={{ 
                    p: 1.5, 
                    borderRadius: 1, 
                    backgroundColor: '#e3f2fd',
                    border: '1px solid #bbdefb'
                  }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main', mb: 1, display: 'block' }}>
                      {teamLead.name} (Coordinator)
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                      <TextField
                        label="Constituent Role"
                        value={memberConstituentRoles.get(teamLead.id) || ''}
                        onChange={(e) => {
                          const newRoles = new Map(memberConstituentRoles);
                          newRoles.set(teamLead.id, e.target.value);
                          setMemberConstituentRoles(newRoles);
                        }}
                        placeholder="e.g., Leader, Potential Leader"
                        size="small"
                        sx={{
                          minWidth: '200px',
                          flex: 1,
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: '#fff'
                          }
                        }}
                      />
                      <TextField
                        label="Functional Role"
                        value={memberFunctionalRoles.get(teamLead.id) || ''}
                        onChange={(e) => {
                          const newRoles = new Map(memberFunctionalRoles);
                          newRoles.set(teamLead.id, e.target.value);
                          setMemberFunctionalRoles(newRoles);
                        }}
                        placeholder="e.g., Team Lead, Coordinator"
                        size="small"
                        sx={{
                          minWidth: '200px',
                          flex: 1,
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: '#fff'
                          }
                        }}
                      />
                      <TextField
                        label="Turf"
                        value={memberTurfs.get(teamLead.id) || ''}
                        onChange={(e) => {
                          const newTurfs = new Map(memberTurfs);
                          newTurfs.set(teamLead.id, e.target.value);
                          setMemberTurfs(newTurfs);
                        }}
                        placeholder="e.g., Downtown, East Side"
                        size="small"
                        sx={{
                          minWidth: '200px',
                          flex: 1,
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: '#fff'
                          }
                        }}
                      />
                    </Box>
                  </Box>
                )}
                
                {/* Team Members */}
                {teamMembers.map((member) => (
                  <Box key={member.id} sx={{ 
                    p: 1.5, 
                    borderRadius: 1, 
                    backgroundColor: '#fff',
                    border: '1px solid #dee2e6'
                  }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1, display: 'block' }}>
                      {member.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                      <TextField
                        label="Constituent Role"
                        value={memberConstituentRoles.get(member.id) || ''}
                        onChange={(e) => {
                          const newRoles = new Map(memberConstituentRoles);
                          newRoles.set(member.id, e.target.value);
                          setMemberConstituentRoles(newRoles);
                        }}
                        placeholder="e.g., Member, Supporter"
                        size="small"
                        sx={{
                          minWidth: '200px',
                          flex: 1,
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: '#f8f9fa'
                          }
                        }}
                      />
                      <TextField
                        label="Functional Role"
                        value={memberFunctionalRoles.get(member.id) || ''}
                        onChange={(e) => {
                          const newRoles = new Map(memberFunctionalRoles);
                          newRoles.set(member.id, e.target.value);
                          setMemberFunctionalRoles(newRoles);
                        }}
                        placeholder="e.g., Deputy, Member"
                        size="small"
                        sx={{
                          minWidth: '200px',
                          flex: 1,
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: '#f8f9fa'
                          }
                        }}
                      />
                      <TextField
                        label="Turf"
                        value={memberTurfs.get(member.id) || ''}
                        onChange={(e) => {
                          const newTurfs = new Map(memberTurfs);
                          newTurfs.set(member.id, e.target.value);
                          setMemberTurfs(newTurfs);
                        }}
                        placeholder="e.g., West Side, North End"
                        size="small"
                        sx={{
                          minWidth: '200px',
                          flex: 1,
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: '#f8f9fa'
                          }
                        }}
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Chapter Dropdown */}
          <FormControl fullWidth>
            <InputLabel>Chapter *</InputLabel>
            <Select
              value={chapter}
              onChange={(e) => setChapter(e.target.value as string)}
              label="Chapter *"
            >
              {chapters.map((chapterName) => (
                <MenuItem key={chapterName} value={chapterName}>
                  {chapterName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Chapter Color Picker */}
          {chapter && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                Chapter Color
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    backgroundColor: color,
                    border: '2px solid #ddd',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    },
                    transition: 'all 0.2s ease'
                  }}
                >
                  <PaletteIcon sx={{ color: 'white', fontSize: 20 }} />
                </Box>
                
                {/* Color Palette */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, flex: 1 }}>
                  {[
                    '#dc2626', '#2563eb', '#7c3aed', '#ea580c', '#059669', 
                    '#be185d', '#0891b2', '#7c2d12', '#6b7280', '#1f2937',
                    '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#3b82f6', '#06b6d4'
                  ].map((colorOption) => (
                    <Box
                      key={colorOption}
                      onClick={() => setColor(colorOption)}
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        backgroundColor: colorOption,
                        cursor: 'pointer',
                        border: color === colorOption ? '3px solid #000' : '1px solid #ddd',
                        '&:hover': {
                          transform: 'scale(1.1)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                        },
                        transition: 'all 0.2s ease'
                      }}
                    />
                  ))}
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Changing this color will update the entire chapter's color throughout the application
              </Typography>
            </Box>
          )}

          {/* Constituency */}
          <TextField
            label="Constituency"
            value={constituency}
            onChange={(e) => setConstituency(e.target.value)}
            placeholder="e.g., Student activists, Community leaders, etc."
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#f8f9fa',
                '&:hover': { backgroundColor: '#e9ecef' },
                '&.Mui-focused': { backgroundColor: '#fff' }
              }
            }}
          />

          {/* Team Culture & Norms Section */}
          <Box sx={{ 
            p: 2, 
            borderRadius: 1, 
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6'
          }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main' }}>
              Team Culture & Norms
            </Typography>

            {/* Shared Purpose */}
            <TextField
              label="Shared Purpose"
              value={sharedPurpose}
              onChange={(e) => setSharedPurpose(e.target.value)}
              placeholder="What binds this team together? What is their collective purpose?"
              multiline
              rows={2}
              fullWidth
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#fff',
                  '&:hover': { backgroundColor: '#f8f9fa' },
                  '&.Mui-focused': { backgroundColor: '#fff' }
                }
              }}
            />

            {/* Norms */}
            <TextField
              label="Team Norms"
              value={norms}
              onChange={(e) => setNorms(e.target.value)}
              placeholder="One norm per line, e.g.&#10;• Start and end meetings on time&#10;• Actively listen without interrupting&#10;• Assume good intent"
              multiline
              rows={3}
              fullWidth
              helperText="Enter one norm per line"
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#fff',
                  '&:hover': { backgroundColor: '#f8f9fa' },
                  '&.Mui-focused': { backgroundColor: '#fff' }
                }
              }}
            />

            {/* Norm Correction */}
            <TextField
              label="Norm Correction"
              value={normCorrection}
              onChange={(e) => setNormCorrection(e.target.value)}
              placeholder="How does the team handle norm violations? What is the correction process?"
              multiline
              rows={2}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#fff',
                  '&:hover': { backgroundColor: '#f8f9fa' },
                  '&.Mui-focused': { backgroundColor: '#fff' }
                }
              }}
            />
          </Box>

          {/* Change Reason - Required for tracking */}
          <TextField
            label="Why are you making this change? *"
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            placeholder="e.g., Updated purpose after team meeting, Added new norm based on team discussion, etc."
            multiline
            rows={2}
            fullWidth
            required
            helperText="This will be logged in the team's changelog to track the learning and evolution of the team"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#fffef0',
                '&:hover': { backgroundColor: '#fff9c4' },
                '&.Mui-focused': { backgroundColor: '#fff' }
              }
            }}
          />

          {/* Team Summary Preview */}
          {teamName && (
            <Box
              sx={{
                p: 2,
                borderRadius: 1,
                backgroundColor: '#e3f2fd',
                border: '1px solid #bbdefb'
              }}
            >
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Team Summary
              </Typography>
              <Typography variant="body2">
                <strong>{teamName}</strong> in {chapter}
              </Typography>
              {teamLead && (
                <Typography variant="body2">
                  Coordinator: {teamLead.name}
                </Typography>
              )}
              <Typography variant="body2">
                Members: {teamMembers.length + 1} total
                {teamMembers.length > 0 && ` (${teamMembers.map(m => m.name).join(', ')})`}
              </Typography>
              {turf && (
                <Typography variant="body2">
                  Turf: {turf}
                </Typography>
              )}
              {constituency && (
                <Typography variant="body2">
                  Constituency: {constituency}
                </Typography>
              )}
              {sharedPurpose && (
                <Typography variant="body2">
                  Purpose: {sharedPurpose}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button
          onClick={handleClose}
          startIcon={<CancelIcon />}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
          disabled={isSaving || !teamName.trim() || !chapter || !changeReason.trim()}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditTeamDialog;
