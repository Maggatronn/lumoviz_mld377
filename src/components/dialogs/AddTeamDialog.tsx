import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  IconButton
} from '@mui/material';
import {
  Close as CloseIcon,
  Palette as PaletteIcon
} from '@mui/icons-material';
import { useChapterColors, getCustomChapterColor } from '../../contexts/ChapterColorContext';

interface TeamMember {
  id: string;
  name: string;
  type?: string;
  email?: string;
  phone?: string;
  constituentRole?: string;
  functionalRole?: string;
}

interface NewTeam {
  teamLead: TeamMember | null;
  teamMembers: TeamMember[];
  chapter: string;
  turf: string;
  color?: string;
  sharedPurpose?: string;
  norms?: string;
  normCorrection?: string;
  constituency?: string;
  // Backend integration fields
  id?: string;
  teamName?: string;
  backendSynced?: boolean;
  syncError?: string;
  dateCreated?: string;
}

interface AddTeamDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (team: NewTeam) => void | Promise<void>;
  organizers: TeamMember[];
  allPeople: TeamMember[];
  chapters: string[];
  /** When provided, Team Lead and Team Members use search (e.g. Contacts API) instead of filtering allPeople. Same list as People table, sorted by most recent contact. */
  onSearchPeople?: (query: string) => Promise<TeamMember[]>;
}

const DEBOUNCE_MS = 300;

const AddTeamDialog: React.FC<AddTeamDialogProps> = ({
  open,
  onClose,
  onSave,
  organizers,
  allPeople,
  chapters,
  onSearchPeople
}) => {
  const { customColors } = useChapterColors();
  const [teamLead, setTeamLead] = useState<TeamMember | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [chapter, setChapter] = useState<string>('');
  const [turf, setTurf] = useState<string>('');
  
  // Debug logging for chapters prop
  useEffect(() => {
    console.log('[AddTeamDialog] Received chapters prop:', chapters);
  }, [chapters]);
  const [teamName, setTeamName] = useState<string>('');
  const [color, setColor] = useState<string>('#2563eb'); // Default blue color
  const [sharedPurpose, setSharedPurpose] = useState<string>('');
  const [norms, setNorms] = useState<string>('');
  const [normCorrection, setNormCorrection] = useState<string>('');
  const [constituency, setConstituency] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>('');
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [leadSearchResults, setLeadSearchResults] = useState<TeamMember[]>([]);
  const [leadSearchLoading, setLeadSearchLoading] = useState(false);
  const [membersSearchQuery, setMembersSearchQuery] = useState('');
  const [membersSearchResults, setMembersSearchResults] = useState<TeamMember[]>([]);
  const [membersSearchLoading, setMembersSearchLoading] = useState(false);
  const leadSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const membersSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load initial people when dialog opens (no debounce for initial load)
  React.useEffect(() => {
    console.log('[AddTeamDialog] useEffect triggered:', { hasSearchFn: !!onSearchPeople, open });
    
    if (!onSearchPeople || !open) {
      setLeadSearchResults([]);
      return;
    }
    
    // Immediately load all people when dialog opens
    console.log('[AddTeamDialog] Dialog opened, loading initial people...');
    setLeadSearchLoading(true);
    
    onSearchPeople('')
      .then((results) => {
        console.log('[AddTeamDialog] Initial load SUCCESS, returned', results.length, 'people:', results);
        setLeadSearchResults(results);
      })
      .catch((error) => {
        console.error('[AddTeamDialog] Error loading initial people:', error);
        setLeadSearchResults([]);
      })
      .finally(() => {
        console.log('[AddTeamDialog] Initial load complete');
        setLeadSearchLoading(false);
      });
  }, [open, onSearchPeople]);

  // When using search API: run search when query changes (debounced)
  React.useEffect(() => {
    if (!onSearchPeople || !leadSearchQuery.trim()) {
      return;
    }
    
    if (leadSearchDebounceRef.current) clearTimeout(leadSearchDebounceRef.current);
    leadSearchDebounceRef.current = setTimeout(() => {
      setLeadSearchLoading(true);
      onSearchPeople(leadSearchQuery.trim())
        .then(setLeadSearchResults)
        .finally(() => setLeadSearchLoading(false));
      leadSearchDebounceRef.current = null;
    }, DEBOUNCE_MS);
    return () => {
      if (leadSearchDebounceRef.current) clearTimeout(leadSearchDebounceRef.current);
    };
  }, [leadSearchQuery, onSearchPeople]);

  // Load initial members when dialog opens (no debounce for initial load)
  React.useEffect(() => {
    console.log('[AddTeamDialog] Members useEffect triggered:', { hasSearchFn: !!onSearchPeople, open });
    
    if (!onSearchPeople || !open) {
      setMembersSearchResults([]);
      return;
    }
    
    // Immediately load all people when dialog opens
    console.log('[AddTeamDialog] Loading initial members...');
    setMembersSearchLoading(true);
    
    onSearchPeople('')
      .then((results) => {
        const filtered = results.filter((p) => p.id !== teamLead?.id);
        console.log('[AddTeamDialog] Initial members load SUCCESS, returned', filtered.length, 'people (after filtering lead)');
        setMembersSearchResults(filtered);
      })
      .catch((error) => {
        console.error('[AddTeamDialog] Error loading initial members:', error);
        setMembersSearchResults([]);
      })
      .finally(() => {
        console.log('[AddTeamDialog] Members load complete');
        setMembersSearchLoading(false);
      });
  }, [open, onSearchPeople, teamLead?.id]);

  // When using search API: run search when members query changes (debounced)
  React.useEffect(() => {
    if (!onSearchPeople || !membersSearchQuery.trim()) {
      return;
    }
    
    if (membersSearchDebounceRef.current) clearTimeout(membersSearchDebounceRef.current);
    membersSearchDebounceRef.current = setTimeout(() => {
      setMembersSearchLoading(true);
      onSearchPeople(membersSearchQuery.trim()).then((list) => {
        setMembersSearchResults(list.filter((p) => p.id !== teamLead?.id));
      }).finally(() => setMembersSearchLoading(false));
      membersSearchDebounceRef.current = null;
    }, DEBOUNCE_MS);
    return () => {
      if (membersSearchDebounceRef.current) clearTimeout(membersSearchDebounceRef.current);
    };
  }, [membersSearchQuery, onSearchPeople, teamLead?.id]);

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
    setIsSaving(false);
    setSaveError('');
    setLeadSearchQuery('');
    setLeadSearchResults([]);
    setMembersSearchQuery('');
    setMembersSearchResults([]);
    onClose();
  };

  const handleChapterChange = (newChapter: string) => {
    setChapter(newChapter);
    // Auto-set color based on existing chapter color if available
    if (newChapter) {
      const existingColor = getCustomChapterColor(newChapter, customColors);
      setColor(existingColor);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!teamName.trim()) {
      setSaveError('Team name is required');
      return;
    }
    if (!chapter.trim()) {
      setSaveError('Chapter is required');
      return;
    }

    setIsSaving(true);
    setSaveError('');

    try {
      // Create team object to pass to parent (TeamsPanel handles backend save)
      const newTeam: NewTeam = {
        teamLead,
        teamMembers,
        chapter: chapter.trim(),
        turf: turf.trim(),
        color: color,
        teamName: teamName.trim(),
        sharedPurpose: sharedPurpose.trim(),
        norms: norms.trim(),
        normCorrection: normCorrection.trim(),
        constituency: constituency.trim()
      };

      // Call onSave - TeamsPanel will handle the backend save via teamsService
      // Wait for completion so errors are caught
      await Promise.resolve(onSave(newTeam));
      handleClose();
    } catch (error) {
      console.error('❌ Error saving team:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save team');
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid = teamName.trim() && chapter.trim();

  // Available team members (exclude the selected team lead)
  const availableMembers = useMemo(() => {
    return allPeople.filter(person => person.id !== teamLead?.id);
  }, [allPeople, teamLead]);

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px' }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1
      }}>
        <Typography variant="h6" fontWeight="bold">
          Add New Team
        </Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {/* Team Name Field */}
          <TextField
            label="Team Name *"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g., Durham Housing Justice Team"
            fullWidth
            error={!!saveError && !teamName.trim()}
            helperText={!!saveError && !teamName.trim() ? 'Team name is required' : ''}
          />
          
          {/* Team Coordinator – optional */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              Team Coordinator
            </Typography>
            <Autocomplete
              value={teamLead}
              onChange={(_, newValue) => setTeamLead(newValue)}
              onInputChange={(_, value) => setLeadSearchQuery(value)}
              options={onSearchPeople ? leadSearchResults : allPeople}
              getOptionLabel={(person) => person.name || ''}
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
                  placeholder="Type a name to search (same list as People table)..."
                  variant="outlined"
                  helperText={onSearchPeople ? 'Searches Contacts table, sorted by most recent contact' : 'Type to search contacts and people'}
                  InputProps={params.InputProps}
                />
              )}
              renderOption={(props, person) => (
                <li {...props} key={person.id}>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {person.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {person.type || 'contact'}
                      {person.email && ` • ${person.email}`}
                    </Typography>
                  </Box>
                </li>
              )}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#f8f9fa',
                  '&:hover': { backgroundColor: '#e9ecef' },
                  '&.Mui-focused': { backgroundColor: '#fff' }
                }
              }}
            />
            
            {/* Team Coordinator Roles */}
            {teamLead && (
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Constituent Role"
                  placeholder="e.g., Leader, Potential Leader, Member, Supporter"
                  value={teamLead.constituentRole || ''}
                  onChange={(e) => setTeamLead({ ...teamLead, constituentRole: e.target.value })}
                />
                
                <TextField
                  fullWidth
                  size="small"
                  label="Functional Role"
                  placeholder="e.g., Team Lead, Co-Lead, Facilitator, Communications"
                  value={teamLead.functionalRole || ''}
                  onChange={(e) => setTeamLead({ ...teamLead, functionalRole: e.target.value })}
                />
              </Box>
            )}
          </Box>

          {/* Team Members – type to search; same Contacts/People list when onSearchPeople provided */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              Team Members
            </Typography>
            <Autocomplete
              multiple
              options={onSearchPeople ? membersSearchResults : availableMembers}
              getOptionLabel={(person) => person.name || ''}
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
              renderTags={(value, getTagProps) =>
                value.map((person, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={person.id}
                    label={person.name}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Type a name to search (same list as People table)..."
                  variant="outlined"
                  helperText={onSearchPeople ? 'Searches Contacts table, sorted by most recent contact' : 'Type to search contacts and people'}
                />
              )}
              renderOption={(props, person) => (
                <li {...props} key={person.id}>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {person.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {person.type || 'contact'}
                      {person.email && ` • ${person.email}`}
                    </Typography>
                  </Box>
                </li>
              )}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#f8f9fa',
                  '&:hover': { backgroundColor: '#e9ecef' },
                  '&.Mui-focused': { backgroundColor: '#fff' }
                }
              }}
            />
            
            {/* Team Member Roles */}
            {teamMembers.length > 0 && (
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight="bold">
                  Assign Roles to Team Members:
                </Typography>
                {teamMembers.map((member, index) => (
                  <Box key={member.id} sx={{ 
                    p: 2, 
                    border: '1px solid #e0e0e0', 
                    borderRadius: 1,
                    bgcolor: '#fafafa'
                  }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ mb: 1.5 }}>
                      {member.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Constituent Role"
                        placeholder="e.g., Leader, Potential Leader, Member, Supporter"
                        value={member.constituentRole || ''}
                        onChange={(e) => {
                          const updatedMembers = [...teamMembers];
                          updatedMembers[index] = { ...member, constituentRole: e.target.value };
                          setTeamMembers(updatedMembers);
                        }}
                      />
                      
                      <TextField
                        fullWidth
                        size="small"
                        label="Functional Role"
                        placeholder="e.g., Member, Co-Lead, Facilitator, Communications"
                        value={member.functionalRole || ''}
                        onChange={(e) => {
                          const updatedMembers = [...teamMembers];
                          updatedMembers[index] = { ...member, functionalRole: e.target.value };
                          setTeamMembers(updatedMembers);
                        }}
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          {/* Chapter Dropdown */}
          <FormControl fullWidth>
            <InputLabel>Chapter *</InputLabel>
            <Select
              value={chapter}
              onChange={(e) => handleChapterChange(e.target.value as string)}
              label="Chapter *"
            >
              {chapters.map((chapterName) => (
                <MenuItem key={chapterName} value={chapterName}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        backgroundColor: getCustomChapterColor(chapterName, customColors),
                        border: '1px solid #ddd'
                      }}
                    />
                    {chapterName}
                  </Box>
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
                This color will be used for the chapter throughout the application
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

          {/* Preview */}
          {teamLead && teamName && (
            <Box sx={{ 
              p: 2, 
              backgroundColor: '#f0f7ff', 
              borderRadius: 1,
              border: '1px solid #e3f2fd'
            }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Team Preview:
              </Typography>
              <Typography variant="body2">
                <strong>Name:</strong> {teamName}
              </Typography>
              <Typography variant="body2">
                <strong>Coordinator:</strong> {teamLead.name}
              </Typography>
              {teamMembers.length > 0 && (
                <Typography variant="body2">
                  <strong>Members:</strong> {teamMembers.map(m => m.name).join(', ')}
                </Typography>
              )}
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <strong>Chapter:</strong> 
                {chapter ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        backgroundColor: color,
                        border: '1px solid #ddd'
                      }}
                    />
                    {chapter}
                  </Box>
                ) : (
                  'Not selected'
                )}
              </Typography>
              {turf && (
                <Typography variant="body2">
                  <strong>Turf:</strong> {turf}
                </Typography>
              )}
              {constituency && (
                <Typography variant="body2">
                  <strong>Constituency:</strong> {constituency}
                </Typography>
              )}
              {sharedPurpose && (
                <Typography variant="body2">
                  <strong>Purpose:</strong> {sharedPurpose}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2 }}>
        {/* Error Display */}
        {saveError && (
          <Box sx={{ 
            flex: 1, 
            mr: 2,
            p: 2,
            backgroundColor: '#ffebee',
            borderRadius: 1,
            border: '1px solid #ffcdd2'
          }}>
            <Typography variant="body2" color="error">
              {saveError}
            </Typography>
          </Box>
        )}
        
        <Button 
          onClick={handleClose} 
          color="secondary"
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={!isFormValid || isSaving}
          sx={{
            backgroundColor: '#1976d2',
            '&:hover': { backgroundColor: '#1565c0' }
          }}
        >
          {isSaving ? 'Saving...' : 'Add Team'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddTeamDialog;
