import React, { useState, useEffect, useRef } from 'react';
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
  CircularProgress,
  Chip
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

interface OrganizerOption {
  vanid: string;
  name: string;
  chapter?: string;
}

interface AssignOrganizerDialogProps {
  open: boolean;
  onClose: () => void;
  onAssign: (organizerVanid: string, organizerName: string) => Promise<void>;
  contactName: string;
  orgIds: Array<{ vanid?: string | number; firstname?: string; lastname?: string; chapter?: string }>;
}

const AssignOrganizerDialog: React.FC<AssignOrganizerDialogProps> = ({
  open,
  onClose,
  onAssign,
  contactName,
  orgIds
}) => {
  const [selected, setSelected] = useState<OrganizerOption | null>(null);
  const [saving, setSaving] = useState(false);

  const options: OrganizerOption[] = React.useMemo(() => {
    return orgIds
      .filter(o => o.vanid && (o.firstname || o.lastname))
      .map(o => ({
        vanid: o.vanid!.toString(),
        name: `${o.firstname || ''} ${o.lastname || ''}`.trim(),
        chapter: o.chapter
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orgIds]);

  useEffect(() => {
    if (open) {
      setSelected(null);
      setSaving(false);
    }
  }, [open]);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await onAssign(selected.vanid, selected.name);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonAddIcon color="primary" />
        <Typography variant="h6" component="span">
          Assign Organizer to {contactName}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 2, minHeight: 120 }}>
        <Autocomplete
          options={options}
          getOptionLabel={(o) => o.name}
          value={selected}
          onChange={(_, v) => setSelected(v)}
          filterOptions={(opts, { inputValue }) => {
            if (!inputValue.trim()) return opts.slice(0, 50);
            const terms = inputValue.toLowerCase().split(/\s+/);
            return opts.filter(o =>
              terms.every(t => o.name.toLowerCase().includes(t))
            ).slice(0, 50);
          }}
          isOptionEqualToValue={(a, b) => a.vanid === b.vanid}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search organizers"
              placeholder="Type a name..."
              autoFocus
              sx={{ mt: 1 }}
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} key={option.vanid}>
              <Box>
                <Typography variant="body2" fontWeight="bold">{option.name}</Typography>
                {option.chapter && (
                  <Typography variant="caption" color="text.secondary">{option.chapter}</Typography>
                )}
              </Box>
            </Box>
          )}
        />
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!selected || saving}
          startIcon={saving ? <CircularProgress size={16} /> : <PersonAddIcon />}
        >
          {saving ? 'Assigning...' : 'Assign'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssignOrganizerDialog;
