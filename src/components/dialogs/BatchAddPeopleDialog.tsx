import React, { useState, useCallback } from 'react';
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
  Select,
  MenuItem,
  Alert,
  IconButton,
  Divider,
  LinearProgress,
  Chip,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  GroupAdd as GroupAddIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  ContentPaste as PasteIcon,
  AssignmentTurnedIn as ActionIcon,
} from '@mui/icons-material';
import { TERMS } from '../../config/appConfig';
import { API_BASE_URL } from '../../config';

interface PersonRow {
  id: string;
  firstname: string;
  lastname: string;
  section: string;
  organizer_vanid: string;
  phone: string;
  email: string;
  status: 'idle' | 'saving' | 'success' | 'error';
  errorMsg?: string;
}

interface OrganizerOption {
  id: string;
  name: string;
  section?: string; // organizer's own section — used for auto-fill
}

interface ActionOption {
  id: string;
  name: string;
}

interface BatchAddPeopleDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: (count: number) => void;
  availableSections?: string[];
  availableOrganizers?: OrganizerOption[];
  availableActions?: ActionOption[];
  currentUserId?: string;
  currentUserName?: string;
}

const uid = () => Math.random().toString(36).slice(2);

const makeRow = (organizer_vanid = '', organizers: OrganizerOption[] = []): PersonRow => {
  const org = organizers.find(o => o.id === organizer_vanid);
  return {
    id: uid(),
    firstname: '',
    lastname: '',
    section: org?.section || '',
    organizer_vanid,
    phone: '',
    email: '',
    status: 'idle',
  };
};

function parsePasteText(
  raw: string,
  defaultOrgVanid: string,
  availableOrganizers: OrganizerOption[],
): Omit<PersonRow, 'id' | 'status' | 'errorMsg'>[] {
  const lines = raw
    .split(/\r?\n/)
    .map(l => l.trimEnd())
    .filter(l => l.trim().length > 0);

  return lines.map(line => {
    const cols = line.split('\t');
    let firstname = '', lastname = '', section = '', organizer_vanid = defaultOrgVanid;

    if (cols.length >= 2) {
      firstname = cols[0].trim();
      lastname = cols[1].trim();
      section = cols[2]?.trim() || '';
      const orgCol = cols[3]?.trim() || '';
      if (orgCol) {
        const match = availableOrganizers.find(o => o.name.toLowerCase() === orgCol.toLowerCase());
        if (match) organizer_vanid = match.id;
      }
    } else {
      const single = cols[0].trim();
      const commaParts = single.split(',').map(p => p.trim()).filter(Boolean);
      if (commaParts.length >= 2) {
        firstname = commaParts[0];
        lastname = commaParts[1];
      } else {
        const spaceParts = single.split(/\s+/);
        firstname = spaceParts[0] || '';
        lastname = spaceParts.slice(1).join(' ') || '';
      }
    }

    // Auto-fill section from organizer if not explicitly provided
    if (!section && organizer_vanid) {
      const org = availableOrganizers.find(o => o.id === organizer_vanid);
      section = org?.section || '';
    }

    return { firstname, lastname, section, organizer_vanid, phone: '', email: '' };
  });
}

const BatchAddPeopleDialog: React.FC<BatchAddPeopleDialogProps> = ({
  open,
  onClose,
  onSaved,
  availableSections = [],
  availableOrganizers = [],
  availableActions = [],
  currentUserId = '',
  currentUserName = '',
}) => {
  const [rows, setRows] = useState<PersonRow[]>([makeRow(currentUserId, availableOrganizers)]);
  const [saving, setSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [pasteHint, setPasteHint] = useState(false);
  const [addToAction, setAddToAction] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState('');

  const reset = useCallback(() => {
    setRows([makeRow(currentUserId, availableOrganizers)]);
    setSaving(false);
    setIsDone(false);
    setShowOptional(false);
    setPasteHint(false);
    setAddToAction(false);
    setSelectedActionId('');
  }, [currentUserId, availableOrganizers]);

  const handleClose = () => {
    if (!saving) { reset(); onClose(); }
  };

  const updateRow = (id: string, field: keyof PersonRow, value: string) => {
    setRows(prev =>
      prev.map(r => r.id === id ? { ...r, [field]: value, status: 'idle', errorMsg: undefined } : r),
    );
  };

  const handleOrganizerChange = (rowId: string, newOrgVanid: string) => {
    const org = availableOrganizers.find(o => o.id === newOrgVanid);
    setRows(prev =>
      prev.map(r => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          organizer_vanid: newOrgVanid,
          section: org?.section || '',
          status: 'idle',
          errorMsg: undefined,
        };
      }),
    );
  };

  const addRow = () => {
    const last = rows[rows.length - 1];
    setRows(prev => [...prev, makeRow(last?.organizer_vanid || currentUserId, availableOrganizers)]);
  };

  const removeRow = (id: string) => {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  };

  const handleFirstnamePaste = (
    e: React.ClipboardEvent<HTMLDivElement>,
    rowId: string,
    rowIndex: number,
  ) => {
    const raw = e.clipboardData.getData('text');
    const isMultiLine = raw.includes('\n') || raw.includes('\r');
    const isTabbed = raw.includes('\t');
    if (!isMultiLine && !isTabbed) return;

    e.preventDefault();
    const parsed = parsePasteText(raw, currentUserId, availableOrganizers);
    if (parsed.length === 0) return;

    setRows(prev => {
      const newRows = [...prev];
      const existing = newRows[rowIndex];
      newRows[rowIndex] = { ...existing, ...parsed[0], status: 'idle', errorMsg: undefined };
      const appended = parsed.slice(1).map(p => ({ ...makeRow(currentUserId), ...p }));
      newRows.splice(rowIndex + 1, 0, ...appended);
      return newRows;
    });

    if (parsed.length > 1) {
      setPasteHint(true);
      setTimeout(() => setPasteHint(false), 3000);
    }
  };

  const handlePasteZone = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const raw = e.clipboardData.getData('text');
    e.preventDefault();
    const parsed = parsePasteText(raw, currentUserId, availableOrganizers);
    if (parsed.length === 0) return;

    setRows(prev => {
      const allEmpty = prev.every(r => !r.firstname && !r.lastname);
      const base = allEmpty ? [] : prev;
      return [...base, ...parsed.map(p => ({ ...makeRow(currentUserId), ...p }))];
    });

    if (parsed.length > 0) {
      setPasteHint(true);
      setTimeout(() => setPasteHint(false), 3000);
    }
  };

  const validRows = rows.filter(r => r.firstname.trim() && r.lastname.trim());
  const doneCount = rows.filter(r => r.status === 'success').length;
  const errorCount = rows.filter(r => r.status === 'error').length;

  const selectedAction = availableActions.find(a => a.id === selectedActionId);

  const handleSave = async () => {
    if (validRows.length === 0) return;
    setSaving(true);

    for (const row of validRows) {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'saving' } : r));
      try {
        // 1. Create the contact
        const body: Record<string, any> = {
          firstname: row.firstname.trim(),
          lastname: row.lastname.trim(),
        };
        if (row.section) body.chapter = row.section;
        if (row.organizer_vanid) body.primary_organizer_vanid = row.organizer_vanid;
        if (row.phone.trim()) body.phone = row.phone.trim();
        if (row.email.trim()) body.email = row.email.trim();

        const res = await fetch(`${API_BASE_URL}/api/contacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());

        const result = await res.json();
        const newVanid = result.vanid;

        // 2. Optionally add to action list
        if (addToAction && selectedActionId && newVanid) {
          const orgVanid = row.organizer_vanid || currentUserId;
          const orgName = availableOrganizers.find(o => o.id === orgVanid)?.name || currentUserName;
          await fetch(`${API_BASE_URL}/api/lists`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organizer_vanid: orgVanid,
              organizer_name: orgName,
              contact_vanid: newVanid,
              contact_name: `${row.firstname.trim()} ${row.lastname.trim()}`,
              action_id: selectedActionId,
              action: selectedAction?.name || '',
              progress: {},
            }),
          }).catch(err => console.warn('Could not add to list:', err));
        }

        setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'success' } : r));
      } catch (err: any) {
        setRows(prev =>
          prev.map(r => r.id === row.id ? { ...r, status: 'error', errorMsg: err.message || 'Failed' } : r),
        );
      }
    }
    setSaving(false);
    setIsDone(true);
  };

  const handleDone = () => {
    onSaved(doneCount);
    reset();
    onClose();
  };

  const allEmpty = rows.every(r => !r.firstname && !r.lastname);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <GroupAddIcon />
        Add People
        {validRows.length > 0 && !isDone && (
          <Chip
            label={`${validRows.length} ${validRows.length === 1 ? 'person' : 'people'}`}
            size="small"
            sx={{ ml: 1 }}
          />
        )}
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {isDone && (
          <Alert severity={errorCount > 0 ? 'warning' : 'success'} sx={{ mb: 2 }}>
            {doneCount > 0 && `${doneCount} ${doneCount === 1 ? 'person' : 'people'} added successfully.`}
            {addToAction && selectedAction && doneCount > 0 && ` Added to "${selectedAction.name}".`}
            {errorCount > 0 && ` ${errorCount} failed — see below.`}
          </Alert>
        )}

        {saving && !isDone && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

        {/* Paste zone */}
        {allEmpty && !isDone && (
          <Box
            onPaste={handlePasteZone}
            tabIndex={0}
            sx={{
              mb: 2, p: 2,
              border: '2px dashed', borderColor: 'divider', borderRadius: 2,
              textAlign: 'center', cursor: 'text', outline: 'none',
              transition: 'border-color 0.2s',
              '&:focus': { borderColor: 'primary.main' },
            }}
          >
            <PasteIcon sx={{ fontSize: 22, mb: 0.5, opacity: 0.5 }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              Paste a list or spreadsheet here
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Accepts tab-separated (Excel / Sheets), comma-separated, or one name per line.
              Columns: First Name, Last Name, Organizer
            </Typography>
          </Box>
        )}

        {pasteHint && (
          <Alert severity="info" sx={{ mb: 1.5, py: 0.5 }}>
            Rows created from paste — review sections and organizers below, then save.
          </Alert>
        )}

        {/* Column headers (hidden on mobile) */}
        <Box sx={{ display: { xs: 'none', sm: 'grid' }, gridTemplateColumns: '1fr 1fr 200px 28px', gap: 1, mb: 0.5, px: 0.5 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>First Name *</Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>Last Name *</Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>Organizer</Typography>
          <span />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {rows.map((row, idx) => (
            <Box key={row.id}>
              {/* Desktop: single row grid */}
              <Box
                sx={{
                  display: { xs: 'none', sm: 'grid' },
                  gridTemplateColumns: '1fr 1fr 200px 28px',
                  gap: 1,
                  alignItems: 'center',
                  opacity: row.status === 'success' ? 0.7 : 1,
                }}
              >
                <TextField
                  size="small"
                  placeholder="First"
                  value={row.firstname}
                  onChange={e => updateRow(row.id, 'firstname', e.target.value)}
                  onPaste={e => handleFirstnamePaste(e, row.id, idx)}
                  disabled={saving || row.status === 'success'}
                  error={row.status === 'error'}
                  autoFocus={idx === 0}
                  inputProps={{ 'aria-label': 'First name' }}
                />
                <TextField
                  size="small"
                  placeholder="Last"
                  value={row.lastname}
                  onChange={e => updateRow(row.id, 'lastname', e.target.value)}
                  disabled={saving || row.status === 'success'}
                  error={row.status === 'error'}
                />
                <FormControl size="small" fullWidth>
                  <Select
                    value={row.organizer_vanid}
                    onChange={e => handleOrganizerChange(row.id, e.target.value as string)}
                    displayEmpty
                    disabled={saving || row.status === 'success'}
                    renderValue={v => {
                      const org = availableOrganizers.find(o => o.id === v);
                      return org ? org.name : <span style={{ color: '#9ca3af' }}>None</span>;
                    }}
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {availableOrganizers.map(org => (
                      <MenuItem key={org.id} value={org.id}>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <span>{org.name}</span>
                          {org.section && (
                            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                              {org.section}
                            </Typography>
                          )}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {row.status === 'success' ? (
                  <CheckCircleIcon fontSize="small" sx={{ color: 'success.main' }} />
                ) : row.status === 'error' ? (
                  <Tooltip title={row.errorMsg || 'Failed'}>
                    <ErrorIcon fontSize="small" sx={{ color: 'error.main', cursor: 'help' }} />
                  </Tooltip>
                ) : (
                  <IconButton
                    size="small"
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length === 1 || saving}
                    sx={{ color: '#9ca3af', '&:hover': { color: 'error.main' } }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>

              {/* Mobile: stacked layout */}
              <Box
                sx={{
                  display: { xs: 'flex', sm: 'none' },
                  flexDirection: 'column',
                  gap: 1,
                  opacity: row.status === 'success' ? 0.7 : 1,
                }}
              >
                <TextField
                  size="small"
                  label="First Name *"
                  placeholder="First"
                  value={row.firstname}
                  onChange={e => updateRow(row.id, 'firstname', e.target.value)}
                  onPaste={e => handleFirstnamePaste(e, row.id, idx)}
                  disabled={saving || row.status === 'success'}
                  error={row.status === 'error'}
                  autoFocus={idx === 0}
                  fullWidth
                  inputProps={{ 'aria-label': 'First name' }}
                />
                <TextField
                  size="small"
                  label="Last Name *"
                  placeholder="Last"
                  value={row.lastname}
                  onChange={e => updateRow(row.id, 'lastname', e.target.value)}
                  disabled={saving || row.status === 'success'}
                  error={row.status === 'error'}
                  fullWidth
                />
                <FormControl size="small" fullWidth>
                  <Select
                    value={row.organizer_vanid}
                    onChange={e => handleOrganizerChange(row.id, e.target.value as string)}
                    displayEmpty
                    disabled={saving || row.status === 'success'}
                    renderValue={v => {
                      const org = availableOrganizers.find(o => o.id === v);
                      return org ? org.name : <span style={{ color: '#9ca3af' }}>Organizer</span>;
                    }}
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {availableOrganizers.map(org => (
                      <MenuItem key={org.id} value={org.id}>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <span>{org.name}</span>
                          {org.section && (
                            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                              {org.section}
                            </Typography>
                          )}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {row.status === 'success' ? (
                    <CheckCircleIcon fontSize="small" sx={{ color: 'success.main' }} />
                  ) : row.status === 'error' ? (
                    <Tooltip title={row.errorMsg || 'Failed'}>
                      <ErrorIcon fontSize="small" sx={{ color: 'error.main', cursor: 'help' }} />
                    </Tooltip>
                  ) : (
                    <IconButton
                      size="small"
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length === 1 || saving}
                      sx={{ color: '#9ca3af', '&:hover': { color: 'error.main' } }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </Box>

              {showOptional && row.status !== 'success' && (
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 1, mt: 0.5 }}>
                  <TextField
                    size="small"
                    placeholder="Phone (optional)"
                    value={row.phone}
                    onChange={e => updateRow(row.id, 'phone', e.target.value)}
                    disabled={saving}
                  />
                  <TextField
                    size="small"
                    placeholder="Email (optional)"
                    value={row.email}
                    onChange={e => updateRow(row.id, 'email', e.target.value)}
                    disabled={saving}
                  />
                  <span />
                </Box>
              )}

              {row.status === 'error' && row.errorMsg && (
                <Typography variant="caption" color="error" sx={{ pl: 0.5 }}>
                  {row.errorMsg}
                </Typography>
              )}
            </Box>
          ))}
        </Box>

        {!isDone && (
          <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={addRow}
              disabled={saving}
              variant="outlined"
              sx={{ borderStyle: 'dashed' }}
            >
              Add Another Row
            </Button>
            <Button
              size="small"
              onClick={() => setShowOptional(v => !v)}
              disabled={saving}
              sx={{ color: 'text.secondary', fontSize: '0.75rem' }}
            >
              {showOptional ? 'Hide phone/email' : 'Add phone & email'}
            </Button>
          </Box>
        )}

        {/* Action list section */}
        {availableActions.length > 0 && !isDone && (
          <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={addToAction}
                  onChange={e => {
                    setAddToAction(e.target.checked);
                    if (!e.target.checked) setSelectedActionId('');
                  }}
                  disabled={saving}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <ActionIcon fontSize="small" sx={{ color: addToAction ? 'primary.main' : 'text.disabled' }} />
                  <Typography variant="body2" color={addToAction ? 'text.primary' : 'text.secondary'}>
                    Also add to an action list
                  </Typography>
                </Box>
              }
            />

            {addToAction && (
              <Box sx={{ mt: 1, ml: 4 }}>
                <FormControl size="small" sx={{ minWidth: 280 }}>
                  <Select
                    value={selectedActionId}
                    onChange={e => setSelectedActionId(e.target.value as string)}
                    displayEmpty
                    disabled={saving}
                    renderValue={v =>
                      v
                        ? availableActions.find(a => a.id === v)?.name || v
                        : <span style={{ color: '#9ca3af' }}>Choose an action…</span>
                    }
                  >
                    <MenuItem value=""><em>No action</em></MenuItem>
                    {availableActions.map(action => (
                      <MenuItem key={action.id} value={action.id}>{action.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {selectedActionId && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Each person will be added to "{selectedAction?.name}" under their assigned organizer.
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        {isDone ? (
          <Button onClick={handleDone} variant="contained">Done</Button>
        ) : (
          <>
            <Button onClick={handleClose} disabled={saving}>Cancel</Button>
            <Button
              onClick={handleSave}
              variant="contained"
              disabled={saving || validRows.length === 0 || (addToAction && !selectedActionId)}
            >
              {saving
                ? `Adding… (${doneCount + errorCount}/${validRows.length})`
                : `Add ${validRows.length > 1 ? `${validRows.length} People` : 'Person'}${addToAction && selectedActionId ? ' + List' : ''}`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BatchAddPeopleDialog;
