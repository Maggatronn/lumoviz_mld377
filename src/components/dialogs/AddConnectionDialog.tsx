import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip
} from '@mui/material';
import { 
  PersonAdd as PersonAddIcon,
  Close as CloseIcon
} from '@mui/icons-material';

interface OrgData {
  vanid: string;
  userid?: string;
  firstname?: string;
  lastname?: string;
  type?: string;
  email?: string;
  chapter?: string;
  phone?: string;
  isNewPerson?: boolean; // Flag for newly created people
  [key: string]: any;
}

interface MeetingNote {
  organizer_vanid?: number;
  vanid?: number;
  contact_firstname?: string;
  contact_lastname?: string;
  chapter?: string;
  [key: string]: any;
}

interface AddConnectionDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (connection: NewConnection) => void;
  orgIds: OrgData[];
  meetings?: MeetingNote[];
}

interface NewConnection {
  organizer: OrgData;
  organizee: OrgData;
  meetingType: string;
  notes?: string;
}

const meetingTypes = [
  '1:1',
  'Two-on-One',
  'Group Meeting',
  'Training',
  'Event',
  'Phone Call',
  'Other'
];

const AddConnectionDialog: React.FC<AddConnectionDialogProps> = ({
  open,
  onClose,
  onSave,
  orgIds,
  meetings = []
}) => {
  // Only log when dialog opens
  useEffect(() => {
    if (open) {
      // console.log('AddConnectionDialog: orgIds prop received:', orgIds.length, 'people');
      // console.log('AddConnectionDialog: meetings prop received:', meetings.length, 'meetings');
    }
  }, [open, orgIds.length, meetings.length]);
  const [selectedOrganizer, setSelectedOrganizer] = useState<OrgData | null>(null);
  const [selectedOrganizee, setSelectedOrganizee] = useState<OrgData | null>(null);
  const [meetingType, setMeetingType] = useState<string>('1:1');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  // Create new person states
  const [showCreatePerson, setShowCreatePerson] = useState<boolean>(false);
  const [newPersonData, setNewPersonData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    phone: '',
    chapter: '',
    type: 'Contact'
  });

  // Filter people into potential organizers and organizees
  const { organizers, organizees } = useMemo(() => {
    // Only do expensive calculations when dialog is open
    if (!open) {
      return { organizers: [], organizees: [] };
    }
    
    // console.log('🔄 AddConnectionDialog useMemo running - recalculating organizers and organizees');
    
    // Get people from orgIds (staff, organizers)
    const peopleFromOrgIds = orgIds.filter(org => 
      org.firstname && org.lastname && org.vanid
    );
    
    // Extract people from meetings data (organizees/contacts)
    const peopleFromMeetings = new Map<string, OrgData>();
    meetings.forEach(meeting => {
      if (meeting.contact_firstname && meeting.contact_lastname && meeting.vanid) {
        const personId = meeting.vanid.toString();
        if (!peopleFromMeetings.has(personId)) {
          peopleFromMeetings.set(personId, {
            vanid: personId,
            firstname: meeting.contact_firstname,
            lastname: meeting.contact_lastname,
            chapter: meeting.chapter,
            type: 'contact'
          });
        }
      }
    });
    
    // Combine both sources, avoiding duplicates
    const allPeopleMap = new Map<string, OrgData>();
    
    // Add people from orgIds first (they might have more complete data)
    peopleFromOrgIds.forEach(person => {
      allPeopleMap.set(person.vanid, person);
    });
    
    // Add people from meetings (only if not already present)
    peopleFromMeetings.forEach((person, vanid) => {
      if (!allPeopleMap.has(vanid)) {
        allPeopleMap.set(vanid, person);
      }
    });
    
    const allPeople = Array.from(allPeopleMap.values());

    // console.log('Total orgIds received:', orgIds.length);
    // console.log('All people after filtering (has firstname, lastname, vanid):', allPeople.length);
    // console.log('All people data sample:', allPeople.slice(0, 3));
    // console.log('Available types:', Array.from(new Set(allPeople.map(p => p.type).filter(Boolean))));

    // For organizers, include people who are likely to be organizers
    // Check for various possible organizer indicators
    const organizers = allPeople.filter(person => {
      // Check multiple possible ways someone might be marked as an organizer
      const isStaff = person.type === 'staff' || person.type === 'Staff';
      const isVolunteer = person.type === 'volunteer' || person.type === 'Volunteer';
      const isOrganizer = person.type === 'organizer' || person.type === 'Organizer';
      const hasOrganizerRole = person.role === 'organizer' || person.role === 'Organizer';
      const isLeader = person.type === 'leader' || person.type === 'Leader';
      
      // Also include people who have organized others (found in meeting data)
      // This would require checking if they appear as organizer_vanid in meetings
      
      return isStaff || isVolunteer || isOrganizer || hasOrganizerRole || isLeader;
    });

    // Include everyone as potential organizers (both staff/volunteers AND organizees)
    // First get the people marked as organizers by role/type
    const markedOrganizers = organizers.length > 0 ? organizers : [];
    
    // Then include everyone as potential organizers (anyone can organize someone else)
    const finalOrganizers = allPeople;

    // For organizees, we'll use ALL people (let the user search and select anyone)
    const allPossibleOrganizees = allPeople;

    // console.log(`Found ${finalOrganizers.length} potential organizers, ${allPossibleOrganizees.length} total people for organizee search`);
    // console.log('Organizer types found:', finalOrganizers.slice(0, 3).map(p => `${p.firstname} ${p.lastname} (${p.type || 'no type'})`));
    // console.log('All people available for organizee search:', allPossibleOrganizees.length);
    
    // Check if there are people without types (potential contacts)
    const peopleWithoutTypes = allPeople.filter(p => !p.type || p.type === '');
    // console.log('People without type field (potential contacts):', peopleWithoutTypes.length);
    if (peopleWithoutTypes.length > 0) {
      // console.log('Sample people without types:', peopleWithoutTypes.slice(0, 3).map(p => `${p.firstname} ${p.lastname}`));
    }
    
    return { 
      organizers: finalOrganizers, 
      organizees: allPossibleOrganizees 
    };
  }, [orgIds, meetings, open]);

  // Filter organizees to exclude the selected organizer
  const filteredOrganizees = useMemo(() => {
    if (!open) return []; // Don't filter when dialog is closed
    
    if (!selectedOrganizer) {
      return organizees;
    }
    
    const filtered = organizees.filter(person => person.vanid !== selectedOrganizer.vanid);
    // console.log('Filtered organizees:', filtered.length, 'people (excluding selected organizer)');
    return filtered;
  }, [organizees, selectedOrganizer, open]);

  const handleSave = () => {
    // Validation
    if (!selectedOrganizer) {
      setError('Please select an organizer');
      return;
    }
    if (!selectedOrganizee) {
      setError('Please select an organizee');
      return;
    }
    if (selectedOrganizer.vanid === selectedOrganizee.vanid) {
      setError('Organizer and organizee cannot be the same person');
      return;
    }

    setError('');
    
    const newConnection: NewConnection = {
      organizer: selectedOrganizer,
      organizee: selectedOrganizee,
      meetingType,
      notes: notes.trim() || undefined
    };

    onSave(newConnection);
    handleClose();
  };

  const handleClose = () => {
    setSelectedOrganizer(null);
    setSelectedOrganizee(null);
    setMeetingType('1:1');
    setNotes('');
    setError('');
    setShowCreatePerson(false);
    setNewPersonData({
      firstname: '',
      lastname: '',
      email: '',
      phone: '',
      chapter: '',
      type: 'Contact'
    });
    onClose();
  };

  // Handle creating a new person
  const handleCreateNewPerson = () => {
    // Validation
    if (!newPersonData.firstname || !newPersonData.lastname) {
      setError('First name and last name are required for new person');
      return;
    }

    // Generate a temporary vanid for the new person (negative to distinguish from real IDs)
    const tempVanid = `temp_${Date.now()}`;
    
    const newPerson: OrgData = {
      vanid: tempVanid,
      firstname: newPersonData.firstname,
      lastname: newPersonData.lastname,
      email: newPersonData.email || undefined,
      phone: newPersonData.phone || undefined,
      chapter: newPersonData.chapter || 'Unknown',
      type: newPersonData.type,
      isNewPerson: true // Flag to indicate this is a newly created person
    };

    // Set as selected organizee
    setSelectedOrganizee(newPerson);
    setShowCreatePerson(false);
    setError('');
  };

  const handleNewPersonFieldChange = (field: string, value: string) => {
    setNewPersonData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatPersonName = (person: OrgData): string => {
    return `${person.firstname} ${person.lastname}`;
  };

  const formatPersonOption = (person: OrgData): string => {
    const name = formatPersonName(person);
    const chapter = person.chapter ? ` (${person.chapter})` : '';
    return `${name}${chapter}`;
  };

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
        alignItems: 'center', 
        gap: 1,
        pb: 1,
        borderBottom: '1px solid #e0e0e0'
      }}>
        <PersonAddIcon color="primary" />
        <Typography variant="h6" component="div" sx={{ flex: 1 }}>
          Add New Connection
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Instructions */}
          <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Create a new meeting connection between any two people in your network. 
              Anyone can organize someone else. This will add a new link to the network graph.
            </Typography>
          </Box>

          {/* Organizer Selection */}
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
              Search for Organizer
            </Typography>
            <Autocomplete
              value={selectedOrganizer}
              onChange={(_, newValue) => {
                setSelectedOrganizer(newValue);
                // Clear organizee if it's the same person as the new organizer
                if (selectedOrganizee && newValue && selectedOrganizee.vanid === newValue.vanid) {
                  setSelectedOrganizee(null);
                }
              }}
              options={organizers}
              getOptionLabel={formatPersonOption}
              getOptionKey={(person) => person.vanid}
              filterOptions={(options, params) => {
                const filtered = options.filter(option => {
                  const name = formatPersonName(option).toLowerCase();
                  const chapter = (option.chapter || '').toLowerCase();
                  const email = (option.email || '').toLowerCase();
                  const searchTerm = params.inputValue.toLowerCase();
                  
                  return name.includes(searchTerm) || 
                         chapter.includes(searchTerm) || 
                         email.includes(searchTerm);
                });
                
                // Limit results to first 50 for performance
                return filtered.slice(0, 50);
              }}
              freeSolo={false}
              autoHighlight
              openOnFocus={false}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Type name, chapter, or email to search..."
                  variant="outlined"
                  fullWidth
                  helperText="Start typing to see suggestions"
                />
              )}
              renderOption={(props, person) => {
                const { key, ...otherProps } = props;
                return (
                  <Box component="li" key={person.vanid} {...otherProps}>
                    <Box sx={{ width: '100%' }}>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {formatPersonName(person)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {person.chapter && `Chapter: ${person.chapter}`}
                        {person.type && ` • Type: ${person.type}`}
                      </Typography>
                      {person.email && (
                        <Typography variant="caption" color="primary" sx={{ display: 'block' }}>
                          {person.email}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              }}
              noOptionsText="No people found - try a different search term"
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Search from {organizers.length} people (anyone can be an organizer)
            </Typography>
          </Box>

          {/* Organizee Selection */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Search for Organizee
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<PersonAddIcon />}
                onClick={() => setShowCreatePerson(true)}
                sx={{ ml: 2 }}
              >
                Create New Person
              </Button>
            </Box>
            
            {!showCreatePerson ? (
              <Box>
                <Autocomplete
                  value={selectedOrganizee}
                  onChange={(_, newValue) => setSelectedOrganizee(newValue)}
                  options={filteredOrganizees}
                  getOptionLabel={formatPersonOption}
                  getOptionKey={(person) => person.vanid}
                  filterOptions={(options, params) => {
                    const filtered = options.filter(option => {
                      const name = formatPersonName(option).toLowerCase();
                      const chapter = (option.chapter || '').toLowerCase();
                      const email = (option.email || '').toLowerCase();
                      const searchTerm = params.inputValue.toLowerCase();
                      
                      return name.includes(searchTerm) || 
                             chapter.includes(searchTerm) || 
                             email.includes(searchTerm);
                    });
                    
                    // Limit results to first 50 for performance
                    return filtered.slice(0, 1000);
                  }}
                  freeSolo={false}
                  autoHighlight
                  openOnFocus={false}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Type name, chapter, or email to search..."
                      variant="outlined"
                      fullWidth
                      helperText="Start typing to see suggestions"
                    />
                  )}
                  renderOption={(props, person) => {
                    const { key, ...otherProps } = props;
                    return (
                      <Box component="li" key={person.vanid} {...otherProps}>
                        <Box sx={{ width: '100%' }}>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {formatPersonName(person)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {person.chapter && `Chapter: ${person.chapter}`}
                            {person.type && ` • Type: ${person.type}`}
                          </Typography>
                          {person.email && (
                            <Typography variant="caption" color="primary" sx={{ display: 'block' }}>
                              {person.email}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  }}
                  noOptionsText="No people found - try a different search term"
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Search from {filteredOrganizees.length} people {selectedOrganizer ? '(excluding selected organizer)' : ''}
                </Typography>
              </Box>
            ) : (
              // Create New Person Form
              <Box sx={{ 
                border: '2px solid #1976d2', 
                borderRadius: 2, 
                p: 2, 
                backgroundColor: '#f3f8ff' 
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>
                    Create New Person
                  </Typography>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => {
                      setShowCreatePerson(false);
                      setError('');
                    }}
                    startIcon={<CloseIcon />}
                  >
                    Cancel
                  </Button>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Name Fields */}
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="First Name"
                      value={newPersonData.firstname}
                      onChange={(e) => handleNewPersonFieldChange('firstname', e.target.value)}
                      fullWidth
                      required
                      size="small"
                    />
                    <TextField
                      label="Last Name"
                      value={newPersonData.lastname}
                      onChange={(e) => handleNewPersonFieldChange('lastname', e.target.value)}
                      fullWidth
                      required
                      size="small"
                    />
                  </Box>

                  {/* Contact Info */}
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="Email"
                      value={newPersonData.email}
                      onChange={(e) => handleNewPersonFieldChange('email', e.target.value)}
                      fullWidth
                      size="small"
                      type="email"
                    />
                    <TextField
                      label="Phone"
                      value={newPersonData.phone}
                      onChange={(e) => handleNewPersonFieldChange('phone', e.target.value)}
                      fullWidth
                      size="small"
                    />
                  </Box>

                  {/* Chapter and Type */}
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="Chapter"
                      value={newPersonData.chapter}
                      onChange={(e) => handleNewPersonFieldChange('chapter', e.target.value)}
                      fullWidth
                      size="small"
                      placeholder="e.g., Durham, Wake, etc."
                    />
                    <FormControl fullWidth size="small">
                      <InputLabel>Type</InputLabel>
                      <Select
                        value={newPersonData.type}
                        onChange={(e) => handleNewPersonFieldChange('type', e.target.value)}
                        label="Type"
                      >
                        <MenuItem value="Contact">Contact</MenuItem>
                        <MenuItem value="Volunteer">Volunteer</MenuItem>
                        <MenuItem value="Prospect">Prospect</MenuItem>
                        <MenuItem value="Member">Member</MenuItem>
                        <MenuItem value="Staff">Staff</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  {/* Create Button */}
                  <Button
                    variant="contained"
                    onClick={handleCreateNewPerson}
                    disabled={!newPersonData.firstname || !newPersonData.lastname}
                    startIcon={<PersonAddIcon />}
                    sx={{ mt: 1 }}
                  >
                    Create Person & Select
                  </Button>
                </Box>
              </Box>
            )}
          </Box>

          {/* Meeting Type */}
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
              Meeting Type
            </Typography>
            <FormControl fullWidth>
              <Select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value)}
                variant="outlined"
              >
                {meetingTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Notes */}
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
              Notes (Optional)
            </Typography>
            <TextField
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this connection..."
              multiline
              rows={3}
              variant="outlined"
              fullWidth
            />
          </Box>

          {/* Preview */}
          {selectedOrganizer && selectedOrganizee && (
            <Box sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: 1, border: '1px solid #2196f3' }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#1976d2' }}>
                Connection Preview:
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Chip 
                  label={formatPersonName(selectedOrganizer)} 
                  color="primary" 
                  size="small"
                />
                <Typography variant="body2">
                  organized
                </Typography>
                <Chip 
                  label={`${formatPersonName(selectedOrganizee)}${selectedOrganizee.isNewPerson ? ' (NEW)' : ''}`} 
                  color={selectedOrganizee.isNewPerson ? 'success' : 'secondary'} 
                  size="small"
                  sx={selectedOrganizee.isNewPerson ? { 
                    fontWeight: 'bold',
                    '& .MuiChip-label': {
                      color: 'white'
                    }
                  } : {}}
                />
                <Typography variant="body2">
                  in a
                </Typography>
                <Chip 
                  label={meetingType} 
                  variant="outlined" 
                  size="small"
                />
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e0e0e0' }}>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          color="primary"
          disabled={!selectedOrganizer || !selectedOrganizee}
          startIcon={<PersonAddIcon />}
        >
          Add Connection
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddConnectionDialog;
