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
  FormControlLabel,
  Checkbox,
  Alert
} from '@mui/material';
import { OrganizerMapping, saveOrganizerMapping, addOrganizerVariation, resolveOrganizer } from '../../services/organizerMappingService';

interface EditOrganizerMappingDialogProps {
  open: boolean;
  onClose: () => void;
  nameOrId: string; // The name/ID being mapped
  vanId?: string; // Optional VAN ID if known
  allMappings: OrganizerMapping[];
  allOrganizers: Array<{ name: string; vanid: string }>; // All known organizers for dropdown
  onMappingSaved: () => void; // Callback to refresh data
}

export const EditOrganizerMappingDialog: React.FC<EditOrganizerMappingDialogProps> = ({
  open,
  onClose,
  nameOrId,
  vanId,
  allMappings,
  allOrganizers,
  onMappingSaved
}) => {
  const [selectedOrganizer, setSelectedOrganizer] = useState<{ name: string; vanid: string } | null>(null);
  const [isNewOrganizer, setIsNewOrganizer] = useState(false);
  const [newOrganizerName, setNewOrganizerName] = useState('');
  const [newOrganizerVanId, setNewOrganizerVanId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Additional person details
  const [editPersonInfo, setEditPersonInfo] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [chapter, setChapter] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Filter organizers that already exist in mappings (for the dropdown)
  const organizerOptions = useMemo(() => {
    // Include all organizers, prioritizing those already in mappings
    const mappingOrganizers = allMappings.map(m => ({
      name: m.preferred_name,
      vanid: m.primary_vanid
    }));
    
    // Add other known organizers
    const allOptions = [...mappingOrganizers];
    allOrganizers.forEach(org => {
      if (!allOptions.some(o => o.vanid === org.vanid)) {
        allOptions.push(org);
      }
    });
    
    return allOptions.sort((a, b) => a.name.localeCompare(b.name));
  }, [allMappings, allOrganizers]);
  
  // Check if this name/ID is already mapped to a canonical organizer
  const existingMapping = useMemo(() => {
    // First check by the name
    const byName = resolveOrganizer(nameOrId, allMappings);
    if (byName) return byName;
    
    // Also check by VAN ID if provided
    if (vanId) {
      const byVanId = resolveOrganizer(vanId, allMappings);
      if (byVanId) return byVanId;
    }
    
    return null;
  }, [nameOrId, vanId, allMappings]);
  
  // Pre-select existing mapping in dropdown when dialog opens
  useEffect(() => {
    if (open && existingMapping) {
      const matchingOption = organizerOptions.find(
        opt => opt.vanid === existingMapping.primary_vanid
      );
      if (matchingOption) {
        setSelectedOrganizer(matchingOption);
      }
      
      // Pre-fill person details if they exist
      if (existingMapping.chapter) setChapter(existingMapping.chapter);
      if (existingMapping.phone) setPhone(existingMapping.phone);
      if (existingMapping.email) setEmail(existingMapping.email);
      
      // Try to parse name into first/last if possible
      const nameParts = existingMapping.preferred_name.split(' ');
      if (nameParts.length >= 2) {
        setFirstName(nameParts[0]);
        setLastName(nameParts.slice(1).join(' '));
      } else {
        setFirstName(existingMapping.preferred_name);
        setLastName('');
      }
      
      onMappingSaved();
    }
  }, [open, existingMapping, organizerOptions, onMappingSaved]);

  const handleSave = async () => {
    setError('');
    setSaving(true);

    try {
      if (isNewOrganizer) {
        // Create a new mapping entry
        if (!newOrganizerName || !newOrganizerVanId) {
          setError('Please provide both name and VAN ID for new organizer');
          setSaving(false);
          return;
        }

        const newMapping: OrganizerMapping = {
          primary_vanid: String(newOrganizerVanId), // Ensure string
          preferred_name: newOrganizerName,
          alternate_vanids: vanId && vanId !== newOrganizerVanId ? [String(vanId)] : [],
          name_variations: [nameOrId],
          notes: notes || `Created from mapping: ${nameOrId}`,
          chapter: chapter || undefined,
          phone: phone || undefined,
          email: email || undefined
        };

        await saveOrganizerMapping(newMapping);
      } else if (editPersonInfo) {
        // Update person details for existing mapping
        if (!vanId) {
          setError('Cannot update person info without a VAN ID');
          setSaving(false);
          return;
        }
        
        const targetMapping = existingMapping || allMappings.find(m => m.primary_vanid === vanId);
        
        if (!targetMapping) {
          // Create new entry if it doesn't exist
          const fullName = `${firstName} ${lastName}`.trim() || nameOrId;
          const newMapping: OrganizerMapping = {
            primary_vanid: String(vanId),
            preferred_name: fullName,
            chapter: chapter || undefined,
            phone: phone || undefined,
            email: email || undefined,
            notes: notes || `Contact info added on ${new Date().toLocaleDateString()}`
          };
          
          await saveOrganizerMapping(newMapping);
        } else {
          // Update existing
          const fullName = `${firstName} ${lastName}`.trim() || targetMapping.preferred_name;
          const updatedMapping: OrganizerMapping = {
            ...targetMapping,
            preferred_name: fullName,
            chapter: chapter || targetMapping.chapter,
            phone: phone || targetMapping.phone,
            email: email || targetMapping.email,
            notes: targetMapping.notes ? 
              `${targetMapping.notes}\nUpdated on ${new Date().toLocaleDateString()}` : 
              `Contact info updated on ${new Date().toLocaleDateString()}`
          };
          
          await saveOrganizerMapping(updatedMapping);
        }
      } else {
        // Add to existing organizer
        if (!selectedOrganizer) {
          setError('Please select an organizer');
          setSaving(false);
          return;
        }
        
        // Check if this is already mapped to the selected organizer
        if (existingMapping && existingMapping.primary_vanid === selectedOrganizer.vanid) {
          // Check if the specific name/ID variation already exists
          const isVanId = vanId && vanId !== selectedOrganizer.vanid;
          const variationValue = isVanId ? vanId : nameOrId;
          const alreadyExists = isVanId 
            ? existingMapping.alternate_vanids?.includes(String(variationValue))
            : (existingMapping.name_variations?.includes(String(variationValue)) || 
               existingMapping.preferred_name === variationValue);
          
          if (alreadyExists) {
            setError('This name/ID is already mapped to the selected organizer. No changes needed.');
            setSaving(false);
            return;
          }
        }

        // Determine if we're adding a VAN ID or name variation
        const isVanId = vanId && vanId !== selectedOrganizer.vanid;
        await addOrganizerVariation(
          String(selectedOrganizer.vanid), // Ensure string
          isVanId ? String(vanId) : nameOrId, // Ensure string
          !!isVanId,
          allMappings,
          selectedOrganizer.name // Pass preferred name for auto-creation
        );
      }

      onMappingSaved();
      onClose();
    } catch (err: any) {
      console.error('Error saving organizer mapping:', err);
      setError(`Failed to save mapping: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedOrganizer(null);
    setIsNewOrganizer(false);
    setNewOrganizerName('');
    setNewOrganizerVanId('');
    setNotes('');
    setError('');
    setEditPersonInfo(false);
    setFirstName('');
    setLastName('');
    setChapter('');
    setPhone('');
    setEmail('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Map Organizer Identity</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Alert severity="info">
            Mapping <strong>{nameOrId}</strong>
            {vanId && ` (VAN ID: ${vanId})`} to a canonical organizer identity.
          </Alert>
          
          {existingMapping && (
            <Alert severity="success" icon="✓">
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Already Mapped
                </Typography>
                <Typography variant="body2">
                  This name/ID is already mapped to <strong>{existingMapping.preferred_name}</strong> (VAN ID: {existingMapping.primary_vanid}).
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  You can still create an additional mapping if needed, or close this dialog if the existing mapping is correct.
                </Typography>
              </Box>
            </Alert>
          )}

          <FormControlLabel
            control={
              <Checkbox
                checked={isNewOrganizer}
                onChange={(e) => {
                  setIsNewOrganizer(e.target.checked);
                  if (e.target.checked) setEditPersonInfo(false);
                }}
              />
            }
            label="This is a new organizer (not in system yet)"
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={editPersonInfo}
                onChange={(e) => {
                  setEditPersonInfo(e.target.checked);
                  if (e.target.checked) setIsNewOrganizer(false);
                }}
              />
            }
            label="Edit person's contact information"
          />

          {isNewOrganizer ? (
            <>
              <TextField
                label="Preferred Name"
                value={newOrganizerName}
                onChange={(e) => setNewOrganizerName(e.target.value)}
                fullWidth
                required
                helperText="The canonical display name for this organizer"
              />
              <TextField
                label="Primary VAN ID"
                value={newOrganizerVanId}
                onChange={(e) => setNewOrganizerVanId(e.target.value)}
                fullWidth
                required
                helperText="The main VAN ID for this organizer"
              />
              <TextField
                label="Chapter"
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                fullWidth
                helperText="Which chapter are they in?"
              />
              <TextField
                label="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                fullWidth
                helperText="Contact phone number"
              />
              <TextField
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                helperText="Contact email address"
              />
            </>
          ) : editPersonInfo ? (
            <>
              <Alert severity="info">
                Editing contact information for {nameOrId}
                {vanId && ` (VAN ID: ${vanId})`}
              </Alert>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  label="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  fullWidth
                  required
                />
              </Box>
              <TextField
                label="Chapter"
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                fullWidth
                helperText="Which chapter are they in?"
              />
              <TextField
                label="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                fullWidth
                helperText="Contact phone number"
              />
              <TextField
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                helperText="Contact email address"
              />
            </>
          ) : (
            <Autocomplete
              options={organizerOptions}
              getOptionLabel={(option) => `${option.name} (${option.vanid})`}
              value={selectedOrganizer}
              onChange={(_, newValue) => setSelectedOrganizer(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Canonical Organizer"
                  required
                  helperText="Choose which organizer this name/ID should map to"
                />
              )}
            />
          )}

          <TextField
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={2}
            helperText="Why this mapping was created"
          />

          {error && (
            <Alert severity="error">{error}</Alert>
          )}

          <Box sx={{ bgcolor: 'grey.50', p: 1.5, borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              <strong>What happens:</strong>{' '}
              {editPersonInfo ? (
                <>
                  The contact information for {nameOrId} will be updated with the details you provided.
                  This will help display their full name, chapter, and contact info throughout the app.
                </>
              ) : (
                <>
                  "{nameOrId}" will be recognized as{' '}
                  {isNewOrganizer 
                    ? newOrganizerName || '[new organizer]'
                    : selectedOrganizer?.name || '[selected organizer]'
                  } throughout the app.
                  {vanId && ` VAN ID ${vanId} will be linked to this identity.`}
                </>
              )}
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={saving || (!isNewOrganizer && !editPersonInfo && !selectedOrganizer)}
        >
          {saving ? 'Saving...' : editPersonInfo ? 'Save Contact Info' : 'Save Mapping'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
