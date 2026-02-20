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
  Alert
} from '@mui/material';
import { Person as PersonIcon } from '@mui/icons-material';
import { TERMS } from '../../config/appConfig';

interface AddPersonDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (person: NewPerson) => Promise<void>;
  availableChapters?: string[];
  availableOrganizers?: Array<{ id: string; name: string; chapter?: string }>;
  currentUserId?: string;
  initialFirstName?: string;
  initialLastName?: string;
}

export interface NewPerson {
  firstname: string;
  lastname: string;
  chapter?: string; // Optional - can be added later via teams
  phone?: string;
  email?: string;
  vanid?: string;
  primary_organizer_vanid?: string;
}

const AddPersonDialog: React.FC<AddPersonDialogProps> = ({
  open,
  onClose,
  onSave,
  availableChapters = [],
  availableOrganizers = [],
  currentUserId = '',
  initialFirstName = '',
  initialLastName = '',
}) => {
  const [firstname, setFirstname] = useState(initialFirstName);
  const [lastname, setLastname] = useState(initialLastName);
  const [chapter, setChapter] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [vanid, setVanid] = useState('');
  const [primaryOrganizer, setPrimaryOrganizer] = useState(currentUserId);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const getOrganizerChapter = (organizerId: string) => {
    const org = availableOrganizers.find(o => o.id === organizerId);
    return org?.chapter || '';
  };

  // Keep organizer in sync with the MyView dropdown, even while dialog is closed
  useEffect(() => {
    if (currentUserId) {
      setPrimaryOrganizer(currentUserId);
      setChapter(getOrganizerChapter(currentUserId));
    }
  }, [currentUserId, availableOrganizers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset form fields when dialog opens
  useEffect(() => {
    if (open) {
      setFirstname(initialFirstName);
      setLastname(initialLastName);
      setPhone('');
      setEmail('');
      setVanid('');
      setError('');
      setPrimaryOrganizer(currentUserId || '');
      setChapter(getOrganizerChapter(currentUserId || ''));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOrganizerChange = (organizerId: string) => {
    setPrimaryOrganizer(organizerId);
    const orgChapter = getOrganizerChapter(organizerId);
    if (orgChapter) {
      setChapter(orgChapter);
    }
  };

  const handleClose = () => {
    setFirstname('');
    setLastname('');
    setChapter('');
    setPhone('');
    setEmail('');
    setVanid('');
    setPrimaryOrganizer(currentUserId);
    setError('');
    onClose();
  };

  const handleSave = async () => {
    if (!firstname.trim() || !lastname.trim()) {
      setError('First name and last name are required');
      return;
    }

    // Chapter is now optional - can be added later via teams
    setSaving(true);
    try {
      await onSave({
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        chapter: chapter.trim() || undefined, // Optional - only include if provided
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        vanid: vanid.trim() || undefined,
        primary_organizer_vanid: primaryOrganizer || undefined
      });
      handleClose();
    } catch (err) {
      setError('Failed to add person. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonIcon />
        Add New Person
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary">
            Add a new person to track in your organizing work
          </Typography>

          {/* Name Fields */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="First Name"
              value={firstname}
              onChange={(e) => setFirstname(e.target.value)}
              fullWidth
              required
              autoFocus
            />
            <TextField
              label="Last Name"
              value={lastname}
              onChange={(e) => setLastname(e.target.value)}
              fullWidth
              required
            />
          </Box>

          {/* Chapter/Section - Optional */}
          <FormControl fullWidth>
            <InputLabel>{TERMS.chapter} (optional)</InputLabel>
            <Select
              value={chapter}
              label={`${TERMS.chapter} (optional)`}
              onChange={(e) => setChapter(e.target.value)}
            >
              <MenuItem value="">
                <em>No {TERMS.chapter.toLowerCase()} yet</em>
              </MenuItem>
              {availableChapters
                .filter(c => c !== `All ${TERMS.chapters}`)
                .map(ch => (
                  <MenuItem key={ch} value={ch}>{ch}</MenuItem>
                ))}
            </Select>
          </FormControl>

          {/* Primary Organizer */}
          <FormControl fullWidth>
            <InputLabel>Primary Organizer</InputLabel>
            <Select
              value={primaryOrganizer}
              label="Primary Organizer"
              onChange={(e) => handleOrganizerChange(e.target.value)}
            >
              {availableOrganizers.map(org => (
                <MenuItem key={org.id} value={org.id}>
                  {org.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Optional Contact Info */}
          <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
            Contact Information (Optional)
          </Typography>

          <TextField
            label="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            fullWidth
            placeholder="(555) 123-4567"
          />

          <TextField
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            type="email"
            placeholder="person@example.com"
          />

          <TextField
            label="VAN ID (Optional)"
            value={vanid}
            onChange={(e) => setVanid(e.target.value)}
            fullWidth
            placeholder="If known"
            helperText="Leave blank to auto-generate"
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
          {saving ? 'Adding...' : 'Add Person'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddPersonDialog;
