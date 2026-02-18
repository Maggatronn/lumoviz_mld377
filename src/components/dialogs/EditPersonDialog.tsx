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
import { Edit as EditIcon } from '@mui/icons-material';

interface EditPersonDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (personId: string, updates: PersonUpdate) => Promise<void>;
  person: any; // Person data to edit
  availableChapters?: string[];
  availableOrganizers?: Array<{ id: string; name: string }>;
}

export interface PersonUpdate {
  firstname?: string;
  lastname?: string;
  chapter?: string;
  phone?: string;
  email?: string;
  vanid?: string;
  primary_organizer_vanid?: string;
}

const EditPersonDialog: React.FC<EditPersonDialogProps> = ({
  open,
  onClose,
  onSave,
  person,
  availableChapters = [],
  availableOrganizers = []
}) => {
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [chapter, setChapter] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [vanid, setVanid] = useState('');
  const [primaryOrganizer, setPrimaryOrganizer] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Populate form when person changes
  useEffect(() => {
    if (person && open) {
      // Parse name if not already split
      const nameParts = person.name ? person.name.split(' ') : ['', ''];
      setFirstname(person.firstname || nameParts[0] || '');
      setLastname(person.lastname || nameParts.slice(1).join(' ') || '');
      setChapter(person.chapter || '');
      setPhone(person.phone || '');
      setEmail(person.email || '');
      setVanid(person.id || person.vanid || '');
      setPrimaryOrganizer(person.primary_organizer_vanid || '');
    }
  }, [person, open]);

  const handleClose = () => {
    setError('');
    onClose();
  };

  const handleSave = async () => {
    if (!firstname.trim() || !lastname.trim()) {
      setError('First name and last name are required');
      return;
    }

    if (!chapter) {
      setError('Please select a chapter');
      return;
    }

    setSaving(true);
    try {
      await onSave(person.id, {
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        chapter,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        vanid: vanid.trim() || undefined,
        primary_organizer_vanid: primaryOrganizer || undefined
      });
      handleClose();
    } catch (err) {
      setError('Failed to update person. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EditIcon />
        Edit Person
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary">
            Update information for {person?.name}
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

          {/* Chapter */}
          <FormControl fullWidth required>
            <InputLabel>Chapter</InputLabel>
            <Select
              value={chapter}
              label="Chapter"
              onChange={(e) => setChapter(e.target.value)}
            >
              {availableChapters
                .filter(c => c !== 'All Chapters')
                .map(ch => (
                  <MenuItem key={ch} value={ch}>{ch}</MenuItem>
                ))}
            </Select>
          </FormControl>

          {/* Primary Organizer */}
          {availableOrganizers.length > 0 && (
            <FormControl fullWidth>
              <InputLabel>Primary Organizer</InputLabel>
              <Select
                value={primaryOrganizer}
                label="Primary Organizer"
                onChange={(e) => setPrimaryOrganizer(e.target.value)}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {availableOrganizers.map(org => (
                  <MenuItem key={org.id} value={org.id}>
                    {org.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Optional Contact Info */}
          <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
            Contact Information
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
            label="VAN ID"
            value={vanid}
            onChange={(e) => setVanid(e.target.value)}
            fullWidth
            disabled
            helperText="VAN ID cannot be changed"
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
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditPersonDialog;
