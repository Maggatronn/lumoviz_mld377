import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Alert,
  Divider,
  Chip,
  Checkbox,
  FormControlLabel,
  Radio,
  RadioGroup,
  FormLabel
} from '@mui/material';
import { createFilterOptions } from '@mui/material/Autocomplete';
import { Chat as ChatIcon, PersonAdd as PersonAddIcon } from '@mui/icons-material';
import AddPersonDialog, { NewPerson } from './AddPersonDialog';
import { API_BASE_URL } from '../../config';

type ContactOption = { vanid: string; name: string; chapter?: string; inputValue?: string };

export interface EditableConversation {
  meeting_id: string;
  contact_vanid: string;
  contact_name: string;
  organizer_vanid: string;
  meeting_type: string;
  date: string;
  notes?: string;
  person_type?: string;
  purpose?: string;
  values?: string;
  difference?: string;
  resources?: string;
  commitment_asked_yn?: string;
  commitment_made_yn?: string;
  commitment_what?: string;
  catapults?: string[];
  shared_purpose_constituency_stance?: string;
  shared_purpose_constituency_how?: string;
  shared_purpose_change_stance?: string;
  shared_purpose_change_how?: string;
  leadership_tag?: string;
  did_share_story?: boolean;
  what_shared?: string;
}

interface LogConversationDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (conversation: NewConversation) => Promise<void>;
  onUpdate?: (meetingId: string, conversation: NewConversation) => Promise<void>;
  editingConversation?: EditableConversation | null;
  availableContacts?: ContactOption[];
  currentUserVanId?: string;
  preselectedContact?: ContactOption | null;
  availableChapters?: string[];
  availableOrganizers?: Array<{ id: string; name: string }>;
  onPersonAdd?: () => void;
}

const filterContacts = createFilterOptions<ContactOption>();

export interface NewConversation {
  contact_vanid: string;
  contact_name: string;
  organizer_vanid: string;
  meeting_type: string;
  date: string;
  notes?: string;
  chapter?: string;
  // Extended fields
  person_type?: string;
  purpose?: string;
  values?: string;
  difference?: string;
  resources?: string;
  commitment_asked_yn?: string; // 'yes' | 'no'
  commitment_made_yn?: string; // 'yes' | 'no'
  commitment_what?: string;
  catapults?: string[]; // VAN IDs of new people introduced
  shared_purpose_constituency_stance?: string; // 'challenge' | 'neither' | 'affirm'
  shared_purpose_constituency_how?: string;
  shared_purpose_change_stance?: string; // 'challenge' | 'neither' | 'affirm'
  shared_purpose_change_how?: string;
  leadership_tag?: string;
  did_share_story?: boolean;
  what_shared?: string;
}

const LogConversationDialog: React.FC<LogConversationDialogProps> = ({
  open,
  onClose,
  onSave,
  onUpdate,
  editingConversation = null,
  availableContacts = [],
  currentUserVanId = '',
  preselectedContact = null,
  availableChapters = [],
  availableOrganizers = [],
  onPersonAdd
}) => {
  const isEditing = !!editingConversation;
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(preselectedContact);
  const [meetingType, setMeetingType] = useState('Constituency One-on-One');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Extended fields
  const [personType, setPersonType] = useState('Constituent');
  const [purpose, setPurpose] = useState('');
  const [values, setValues] = useState('');
  const [difference, setDifference] = useState('');
  const [resources, setResources] = useState('');
  const [commitmentAskedYN, setCommitmentAskedYN] = useState('');
  const [commitmentMadeYN, setCommitmentMadeYN] = useState('');
  const [commitmentWhat, setCommitmentWhat] = useState('');
  const [catapults, setCatapults] = useState<ContactOption[]>([]);
  const [sharedPurposeConstituencyStance, setSharedPurposeConstituencyStance] = useState('');
  const [sharedPurposeConstituencyHow, setSharedPurposeConstituencyHow] = useState('');
  const [sharedPurposeChangeStance, setSharedPurposeChangeStance] = useState('');
  const [sharedPurposeChangeHow, setSharedPurposeChangeHow] = useState('');
  const [leadershipTag, setLeadershipTag] = useState('Unknown');
  const [didShareStory, setDidShareStory] = useState(false);
  const [whatShared, setWhatShared] = useState('');

  // Add Person dialog state
  const [showAddPersonDialog, setShowAddPersonDialog] = useState(false);
  const [addPersonType, setAddPersonType] = useState<'main' | 'catapult'>('main');
  const [catapultPrefillFirst, setCatapultPrefillFirst] = useState('');
  const [catapultPrefillLast, setCatapultPrefillLast] = useState('');
  const [contactSearchText, setContactSearchText] = useState('');
  const [catapultSearchText, setCatapultSearchText] = useState('');

  // Pre-populate fields when editing
  useEffect(() => {
    if (open && editingConversation) {
      const ec = editingConversation;
      const contact = availableContacts.find(c => c.vanid === ec.contact_vanid) ||
        { vanid: ec.contact_vanid, name: ec.contact_name };
      setSelectedContact(contact);
      setMeetingType(ec.meeting_type || 'Constituency One-on-One');
      setDate(ec.date || new Date().toISOString().split('T')[0]);
      setNotes(ec.notes || '');
      setPersonType(ec.person_type || 'Constituent');
      setPurpose(ec.purpose || '');
      setValues(ec.values || '');
      setDifference(ec.difference || '');
      setResources(ec.resources || '');
      setCommitmentAskedYN(ec.commitment_asked_yn || '');
      setCommitmentMadeYN(ec.commitment_made_yn || '');
      setCommitmentWhat(ec.commitment_what || '');
      setSharedPurposeConstituencyStance(ec.shared_purpose_constituency_stance || '');
      setSharedPurposeConstituencyHow(ec.shared_purpose_constituency_how || '');
      setSharedPurposeChangeStance(ec.shared_purpose_change_stance || '');
      setSharedPurposeChangeHow(ec.shared_purpose_change_how || '');
      setLeadershipTag(ec.leadership_tag || 'Unknown');
      setDidShareStory(ec.did_share_story || false);
      setWhatShared(ec.what_shared || '');
      // Resolve catapult VAN IDs to contact options
      if (ec.catapults && ec.catapults.length > 0) {
        const resolved = ec.catapults
          .map(id => availableContacts.find(c => c.vanid === id))
          .filter(Boolean) as ContactOption[];
        setCatapults(resolved);
      } else {
        setCatapults([]);
      }
    } else if (open && preselectedContact) {
      setSelectedContact(preselectedContact);
    }
  }, [open, editingConversation, preselectedContact, availableContacts]);

  const handleClose = () => {
    setSelectedContact(null);
    setMeetingType('Constituency One-on-One');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setPersonType('Constituent');
    setPurpose('');
    setValues('');
    setDifference('');
    setResources('');
    setCommitmentAskedYN('');
    setCommitmentMadeYN('');
    setCommitmentWhat('');
    setCatapults([]);
    setSharedPurposeConstituencyStance('');
    setSharedPurposeConstituencyHow('');
    setSharedPurposeChangeStance('');
    setSharedPurposeChangeHow('');
    setLeadershipTag('Unknown');
    setDidShareStory(false);
    setWhatShared('');
    setError('');
    onClose();
  };

  const handleSave = async () => {
    if (!selectedContact) {
      setError('Please select a person');
      return;
    }

    if (!date) {
      setError('Please select a date');
      return;
    }

    setSaving(true);
    try {
      const conversationData: NewConversation = {
        contact_vanid: selectedContact.vanid,
        contact_name: selectedContact.name,
        organizer_vanid: currentUserVanId,
        meeting_type: meetingType,
        date,
        notes: notes.trim() || undefined,
        chapter: selectedContact.chapter,
        person_type: personType,
        purpose: purpose.trim() || undefined,
        values: values.trim() || undefined,
        difference: difference.trim() || undefined,
        resources: resources.trim() || undefined,
        commitment_asked_yn: commitmentAskedYN || undefined,
        commitment_made_yn: commitmentMadeYN || undefined,
        commitment_what: commitmentWhat.trim() || undefined,
        catapults: catapults.map(c => c.vanid),
        shared_purpose_constituency_stance: sharedPurposeConstituencyStance || undefined,
        shared_purpose_constituency_how: sharedPurposeConstituencyHow.trim() || undefined,
        shared_purpose_change_stance: sharedPurposeChangeStance || undefined,
        shared_purpose_change_how: sharedPurposeChangeHow.trim() || undefined,
        leadership_tag: leadershipTag,
        did_share_story: didShareStory,
        what_shared: whatShared.trim() || undefined
      };

      if (isEditing && editingConversation && onUpdate) {
        await onUpdate(editingConversation.meeting_id, conversationData);
      } else {
        await onSave(conversationData);
      }
      handleClose();
    } catch (err) {
      setError(isEditing ? 'Failed to update conversation. Please try again.' : 'Failed to log conversation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const meetingTypes = [
    'Constituency One-on-One',
    'Team One-on-One',
    'Other',
  ];

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { maxHeight: '90vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ChatIcon />
        {isEditing ? 'Edit Conversation' : 'Log Conversation'}
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary">
            {isEditing ? 'Edit the details of this conversation' : 'Record a detailed conversation with a contact'}
          </Typography>

          {/* Basic Information */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold">Basic Information</Typography>
            
            <Autocomplete
              value={selectedContact}
              onChange={(event, newValue) => setSelectedContact(newValue)}
              inputValue={contactSearchText}
              onInputChange={(event, newInputValue) => setContactSearchText(newInputValue)}
              options={availableContacts}
              getOptionLabel={(option) => option.name}
              filterOptions={(options, state) => {
                const filtered = options.filter(option =>
                  option.name.toLowerCase().includes(state.inputValue.toLowerCase())
                );
                return filtered;
              }}
              noOptionsText={
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    No matches found
                  </Typography>
                  <Button
                    startIcon={<PersonAddIcon />}
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setAddPersonType('main');
                      setShowAddPersonDialog(true);
                    }}
                  >
                    Add New Person
                  </Button>
                </Box>
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Person"
                  required
                  placeholder="Search for a person..."
                />
              )}
              renderOption={({ key, ...props }, option) => (
                <Box key={key} component="li" {...props}>
                  <Box>
                    <Typography variant="body2">{option.name}</Typography>
                    {option.chapter && (
                      <Typography variant="caption" color="text.secondary">
                        {option.chapter}
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth required>
                <InputLabel>Type of Conversation</InputLabel>
                <Select
                  value={meetingType}
                  label="Type of Conversation"
                  onChange={(e) => setMeetingType(e.target.value)}
                >
                  {meetingTypes.map(type => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                InputLabelProps={{
                  shrink: true,
                }}
                sx={{ minWidth: '180px' }}
              />
            </Box>

            <FormControl fullWidth>
              <InputLabel>Type of Person</InputLabel>
              <Select
                value={personType}
                label="Type of Person"
                onChange={(e) => setPersonType(e.target.value)}
              >
                <MenuItem value="Constituent">Constituent</MenuItem>
                <MenuItem value="Gatekeeper">Gatekeeper</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Divider />

          {/* Conversation Details */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold">Conversation Details</Typography>
            
            <TextField
              label="Purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="What was the purpose of this conversation?"
            />

            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                VALUES: What moves them? As in, what do they care about and why?
              </Typography>
              <TextField
                value={values}
                onChange={(e) => setValues(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="Describe their values and what they care about..."
              />
            </Box>

            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                CHANGE: What change would make a difference in their life? Why does it matter to them?
              </Typography>
              <TextField
                value={difference}
                onChange={(e) => setDifference(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="What change would matter to them and why..."
              />
            </Box>

            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                RESOURCES: What do you think they could contribute?
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Do they have relationships with or lead others? Are they bringing certain skills?
              </Typography>
              <TextField
                value={resources}
                onChange={(e) => setResources(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="Their relationships, skills, resources..."
              />
            </Box>
          </Box>

          <Divider />

          {/* Commitment */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold">Commitment</Typography>
            
            <FormControl>
              <FormLabel>Did you ask them to commit to anything?</FormLabel>
              <RadioGroup
                row
                value={commitmentAskedYN}
                onChange={(e) => setCommitmentAskedYN(e.target.value)}
              >
                <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                <FormControlLabel value="no" control={<Radio />} label="No" />
              </RadioGroup>
            </FormControl>

            <FormControl>
              <FormLabel>Did they commit?</FormLabel>
              <RadioGroup
                row
                value={commitmentMadeYN}
                onChange={(e) => setCommitmentMadeYN(e.target.value)}
              >
                <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                <FormControlLabel value="no" control={<Radio />} label="No" />
              </RadioGroup>
            </FormControl>

            <TextField
              label="What was discussed about commitment?"
              value={commitmentWhat}
              onChange={(e) => setCommitmentWhat(e.target.value)}
              fullWidth
              multiline
              rows={3}
              placeholder="Describe what you asked, what they committed to, or any discussion about commitment..."
            />
          </Box>

          <Divider />

          {/* Catapults (New People) */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold">Catapults</Typography>
            <Typography variant="caption" color="text.secondary">
              Who did this person introduce you to? Search existing contacts or type a new name to add them.
            </Typography>

            <Autocomplete
              multiple
              value={catapults}
              onChange={(event, newValue) => {
                // Check if the last-added item is the "create new" sentinel
                const last = newValue[newValue.length - 1];
                if (last?.vanid === '__new__') {
                  // Parse typed name into first / last
                  const parts = (last.inputValue || '').trim().split(/\s+/);
                  setCatapultPrefillFirst(parts[0] || '');
                  setCatapultPrefillLast(parts.slice(1).join(' ') || '');
                  setAddPersonType('catapult');
                  setShowAddPersonDialog(true);
                  // Strip the sentinel from selection
                  setCatapults((newValue as ContactOption[]).filter(v => v.vanid !== '__new__'));
                } else {
                  setCatapults(newValue as ContactOption[]);
                }
              }}
              inputValue={catapultSearchText}
              onInputChange={(_, v) => setCatapultSearchText(v)}
              options={availableContacts.filter(c => c.vanid !== selectedContact?.vanid)}
              getOptionLabel={(option) =>
                option.inputValue ? `Add "${option.inputValue}"` : option.name
              }
              filterOptions={(options, params) => {
                const filtered = filterContacts(options, params);
                const { inputValue } = params;
                // Always show "Add 'name'" when user has typed something
                if (inputValue.trim()) {
                  const alreadyExists = options.some(
                    o => o.name.toLowerCase() === inputValue.trim().toLowerCase()
                  );
                  if (!alreadyExists) {
                    filtered.push({
                      vanid: '__new__',
                      name: `Add "${inputValue.trim()}"`,
                      inputValue: inputValue.trim(),
                    });
                  }
                }
                return filtered;
              }}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index });
                  return (
                    <Chip
                      key={key}
                      label={option.name}
                      size="small"
                      {...tagProps}
                    />
                  );
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="New People Introduced"
                  placeholder="Search or type a name to add…"
                />
              )}
              renderOption={({ key, ...props }, option) =>
                option.vanid === '__new__' ? (
                  <Box
                    key={key}
                    component="li"
                    {...props}
                    sx={{ color: 'primary.main', fontStyle: 'italic' }}
                  >
                    <PersonAddIcon fontSize="small" sx={{ mr: 1, opacity: 0.7 }} />
                    <Typography variant="body2">{option.name}</Typography>
                  </Box>
                ) : (
                  <Box key={key} component="li" {...props}>
                    <Box>
                      <Typography variant="body2">{option.name}</Typography>
                      {option.chapter && (
                        <Typography variant="caption" color="text.secondary">
                          {option.chapter}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )
              }
            />
          </Box>

          <Divider />

          {/* Shared Purpose */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold">Shared Purpose</Typography>
            
            <Box>
              <FormControl>
                <FormLabel>Constituency: Did this affirm or challenge who our constituency is?</FormLabel>
                <RadioGroup
                  row
                  value={sharedPurposeConstituencyStance}
                  onChange={(e) => setSharedPurposeConstituencyStance(e.target.value)}
                >
                  <FormControlLabel value="challenge" control={<Radio />} label="Challenge" />
                  <FormControlLabel value="neither" control={<Radio />} label="Neither" />
                  <FormControlLabel value="affirm" control={<Radio />} label="Affirm" />
                </RadioGroup>
              </FormControl>
              
              {sharedPurposeConstituencyStance && (
                <TextField
                  label="How?"
                  value={sharedPurposeConstituencyHow}
                  onChange={(e) => setSharedPurposeConstituencyHow(e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Explain how this conversation affected your understanding..."
                  sx={{ mt: 1 }}
                />
              )}
            </Box>

            <Box>
              <FormControl>
                <FormLabel>Change: Did this affirm or challenge the change we seek?</FormLabel>
                <RadioGroup
                  row
                  value={sharedPurposeChangeStance}
                  onChange={(e) => setSharedPurposeChangeStance(e.target.value)}
                >
                  <FormControlLabel value="challenge" control={<Radio />} label="Challenge" />
                  <FormControlLabel value="neither" control={<Radio />} label="Neither" />
                  <FormControlLabel value="affirm" control={<Radio />} label="Affirm" />
                </RadioGroup>
              </FormControl>
              
              {sharedPurposeChangeStance && (
                <TextField
                  label="How?"
                  value={sharedPurposeChangeHow}
                  onChange={(e) => setSharedPurposeChangeHow(e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Explain how this conversation affected your understanding..."
                  sx={{ mt: 1 }}
                />
              )}
            </Box>
          </Box>

          <Divider />

          {/* Leadership Tag */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold">Leadership Assessment</Typography>
            <Typography variant="caption" color="text.secondary">
              Based on this conversation, how would you assess their leadership level?
            </Typography>

            <FormControl>
              <RadioGroup
                row
                value={leadershipTag}
                onChange={(e) => setLeadershipTag(e.target.value)}
              >
                <FormControlLabel value="Leader" control={<Radio size="small" />} label="Leader" />
                <FormControlLabel value="Potential Leader" control={<Radio size="small" />} label="Potential Leader" />
                <FormControlLabel value="Supporter" control={<Radio size="small" />} label="Supporter" />
                <FormControlLabel value="Unknown" control={<Radio size="small" />} label="Unknown" />
              </RadioGroup>
            </FormControl>
          </Box>

          <Divider />

          {/* Personal Sharing */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold">Your Story</Typography>
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={didShareStory}
                  onChange={(e) => setDidShareStory(e.target.checked)}
                />
              }
              label="Did you share something/story about yourself?"
            />

            <TextField
              label="What did you share?"
              value={whatShared}
              onChange={(e) => setWhatShared(e.target.value)}
              fullWidth
              multiline
              rows={3}
              placeholder="Describe what you shared about yourself..."
            />
          </Box>

          <Divider />

          {/* General Notes */}
          <TextField
            label="Additional Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={3}
            placeholder="Any other notes or follow-ups?"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={saving}
        >
          {saving ? (isEditing ? 'Saving...' : 'Logging...') : (isEditing ? 'Save Changes' : 'Log Conversation')}
        </Button>
      </DialogActions>

      {/* Add Person Dialog */}
      <AddPersonDialog
        open={showAddPersonDialog}
        onClose={() => {
          setShowAddPersonDialog(false);
          setCatapultPrefillFirst('');
          setCatapultPrefillLast('');
        }}
        initialFirstName={addPersonType === 'catapult' ? catapultPrefillFirst : ''}
        initialLastName={addPersonType === 'catapult' ? catapultPrefillLast : ''}
        onSave={async (person: NewPerson) => {
          try {
            const response = await fetch(`${API_BASE_URL}/api/contacts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(person)
            });

            if (!response.ok) throw new Error('Failed to add person');

            const result = await response.json();
            const newPerson: ContactOption = {
              vanid: result.vanid,
              name: `${person.firstname} ${person.lastname}`,
              chapter: person.chapter,
            };

            if (addPersonType === 'main') {
              setSelectedContact(newPerson);
            } else {
              setCatapults(prev => [...prev, newPerson]);
            }

            if (onPersonAdd) onPersonAdd();
          } catch (error) {
            console.error('Error adding person:', error);
            throw error;
          }
        }}
        availableChapters={availableChapters}
        availableOrganizers={availableOrganizers}
        currentUserId={currentUserVanId}
      />
    </Dialog>
  );
};

export default LogConversationDialog;
