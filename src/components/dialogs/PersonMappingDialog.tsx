import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  Typography,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Autocomplete,
  Alert,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  Merge as MergeIcon,
  PersonAdd as PersonAddIcon,
  Sync as SyncIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { OrganizerMapping } from '../../services/organizerMappingService';

interface PersonMappingDialogProps {
  open: boolean;
  onClose: () => void;
  allMappings: OrganizerMapping[];
  allPeople: Array<{ name: string; vanid: string }>; // All contacts from system
  onMergePeople: (primaryVanid: string, mergeVanid: string) => Promise<void>;
  onRefresh: () => void;
  onCreatePerson?: () => void; // Callback to open AddPersonDialog
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

export const PersonMappingDialog: React.FC<PersonMappingDialogProps> = ({
  open,
  onClose,
  allMappings,
  allPeople,
  onMergePeople,
  onRefresh,
  onCreatePerson
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedPrimary, setSelectedPrimary] = useState<{ name: string; vanid: string } | null>(null);
  const [selectedMerge, setSelectedMerge] = useState<{ name: string; vanid: string } | null>(null);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState('');

  // Get pending people (not in VAN yet)
  const pendingPeople = useMemo(() => {
    return allMappings.filter(m => 
      (m as any).in_van === false || 
      (m as any).van_sync_status !== 'synced'
    );
  }, [allMappings]);

  // Get potential duplicates (same name, different IDs)
  const potentialDuplicates = useMemo(() => {
    const nameMap = new Map<string, OrganizerMapping[]>();
    
    allMappings.forEach(mapping => {
      const normalizedName = mapping.preferred_name.toLowerCase().trim();
      if (!nameMap.has(normalizedName)) {
        nameMap.set(normalizedName, []);
      }
      nameMap.get(normalizedName)!.push(mapping);
    });
    
    // Return only names with multiple entries
    return Array.from(nameMap.entries())
      .filter(([_, mappings]) => mappings.length > 1)
      .map(([name, mappings]) => ({ name, mappings }));
  }, [allMappings]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleMerge = async () => {
    if (!selectedPrimary || !selectedMerge) {
      setError('Please select both people to merge');
      return;
    }

    if (selectedPrimary.vanid === selectedMerge.vanid) {
      setError('Cannot merge a person with themselves');
      return;
    }

    setMerging(true);
    setError('');

    try {
      await onMergePeople(selectedPrimary.vanid, selectedMerge.vanid);
      setMergeDialogOpen(false);
      setSelectedPrimary(null);
      setSelectedMerge(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to merge people');
    } finally {
      setMerging(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Person Mapping Management</Typography>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label={`Pending VAN Sync (${pendingPeople.length})`} />
            <Tab label={`Potential Duplicates (${potentialDuplicates.length})`} />
            <Tab label="All Mappings" />
          </Tabs>

          {/* Pending People Tab */}
          <TabPanel value={tabValue} index={0}>
            {pendingPeople.length === 0 ? (
              <Alert severity="success">
                All people are synced with VAN! No pending entries.
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Temporary ID</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Source</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingPeople.map((person) => (
                      <TableRow key={person.primary_vanid}>
                        <TableCell>
                          <Chip 
                            label={person.primary_vanid} 
                            size="small" 
                            color="warning"
                            icon={<WarningIcon />}
                          />
                        </TableCell>
                        <TableCell>{person.preferred_name}</TableCell>
                        <TableCell>{(person as any).email || '-'}</TableCell>
                        <TableCell>{(person as any).phone || '-'}</TableCell>
                        <TableCell>
                          <Chip 
                            label={(person as any).source || 'unknown'} 
                            size="small" 
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={(person as any).van_sync_status || 'pending'} 
                            size="small"
                            color="warning"
                          />
                        </TableCell>
                        <TableCell>
                          {person.created_at 
                            ? new Date(person.created_at).toLocaleDateString()
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            <Box sx={{ mt: 2 }}>
              <Alert severity="info">
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>These people need to be added to VAN:</strong>
                </Typography>
                <Typography variant="body2">
                  1. Export this list<br/>
                  2. Add them to VAN manually<br/>
                  3. Update their records in BigQuery with the new VAN ID
                </Typography>
              </Alert>
            </Box>
          </TabPanel>

          {/* Potential Duplicates Tab */}
          <TabPanel value={tabValue} index={1}>
            {potentialDuplicates.length === 0 ? (
              <Alert severity="success">
                No potential duplicates found! All names are unique.
              </Alert>
            ) : (
              <>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  These people have the same name but different VAN IDs. They might be duplicates that need merging.
                </Alert>
                {potentialDuplicates.map(({ name, mappings }) => (
                  <Paper key={name} variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      {name} ({mappings.length} entries)
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {mappings.map((mapping) => (
                        <Chip
                          key={mapping.primary_vanid}
                          label={`${mapping.preferred_name} (${mapping.primary_vanid})`}
                          variant="outlined"
                          sx={{ minWidth: 200 }}
                        />
                      ))}
                    </Box>
                    <Button
                      size="small"
                      startIcon={<MergeIcon />}
                      onClick={() => setMergeDialogOpen(true)}
                      sx={{ mt: 1 }}
                    >
                      Merge These
                    </Button>
                  </Paper>
                ))}
              </>
            )}
          </TabPanel>

          {/* All Mappings Tab */}
          <TabPanel value={tabValue} index={2}>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>VAN ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Alternate IDs</TableCell>
                    <TableCell>Name Variations</TableCell>
                    <TableCell>In VAN</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allMappings.map((mapping) => (
                    <TableRow key={mapping.primary_vanid}>
                      <TableCell>{mapping.primary_vanid}</TableCell>
                      <TableCell>{mapping.preferred_name}</TableCell>
                      <TableCell>
                        <Chip 
                          label={(mapping as any).person_type || 'organizer'} 
                          size="small"
                          color={(mapping as any).person_type === 'organizer' ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        {mapping.alternate_vanids?.length || 0}
                      </TableCell>
                      <TableCell>
                        {mapping.name_variations?.length || 0}
                      </TableCell>
                      <TableCell>
                        {(mapping as any).in_van !== false ? (
                          <Chip label="Yes" size="small" color="success" />
                        ) : (
                          <Chip label="No" size="small" color="warning" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>
        </DialogContent>
        
        <DialogActions>
          {onCreatePerson && (
            <Button 
              onClick={() => {
                onCreatePerson();
                onClose();
              }} 
              startIcon={<PersonAddIcon />}
              variant="outlined"
              sx={{ mr: 'auto' }}
            >
              Create New Person
            </Button>
          )}
          <Button onClick={onRefresh} startIcon={<SyncIcon />}>
            Refresh
          </Button>
          <Button onClick={onClose} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={mergeDialogOpen} onClose={() => setMergeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Merge People</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Alert severity="warning">
              This will merge two people into one. The secondary person will be deleted and all references will point to the primary person.
            </Alert>

            <Autocomplete
              options={allPeople}
              getOptionLabel={(option) => `${option.name} (${option.vanid})`}
              value={selectedPrimary}
              onChange={(_, newValue) => setSelectedPrimary(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Keep This Person (Primary)"
                  required
                  helperText="This person will be kept"
                />
              )}
            />

            <Autocomplete
              options={allPeople}
              getOptionLabel={(option) => `${option.name} (${option.vanid})`}
              value={selectedMerge}
              onChange={(_, newValue) => setSelectedMerge(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Merge This Person (Will Be Deleted)"
                  required
                  helperText="This person will be merged into the primary and deleted"
                />
              )}
            />

            {error && <Alert severity="error">{error}</Alert>}

            {selectedPrimary && selectedMerge && (
              <Box sx={{ bgcolor: 'grey.50', p: 1.5, borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  <strong>What will happen:</strong><br/>
                  • {selectedMerge.name} ({selectedMerge.vanid}) will be deleted<br/>
                  • All references will point to {selectedPrimary.name} ({selectedPrimary.vanid})<br/>
                  • {selectedMerge.vanid} will be added as an alternate ID
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMergeDialogOpen(false)} disabled={merging}>
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            variant="contained"
            color="warning"
            startIcon={<MergeIcon />}
            disabled={merging || !selectedPrimary || !selectedMerge}
          >
            {merging ? 'Merging...' : 'Merge People'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
