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
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  FormControlLabel,
  Checkbox,
  Radio,
  RadioGroup,
  FormLabel,
  OutlinedInput,
  ListItemText as MuiListItemText
} from '@mui/material';
import { 
  Close as CloseIcon, 
  Add as AddIcon, 
  Delete as DeleteIcon 
} from '@mui/icons-material';
import { ParentCampaign } from './ParentCampaignDialog';

// Action template that defines a reusable action type
export interface CampaignActionField {
  key: string;
  label: string;
  type: 'boolean' | 'select' | 'text' | 'conversation';  // Field type
  options?: string[];  // For select fields
  optionsText?: string;  // Temporary storage for raw text during editing
}

export interface CampaignAction {
  id: string;
  name: string;  // Action name (e.g., "Sign Pledge", "Join Team")
  fields: CampaignActionField[];  // Flexible fields with different types
  goalFieldKey?: string;      // Which field key to track for goal progress (e.g., "signed")
  parentCampaignId?: string;  // Optional - linked to parent campaign (can be null)
  goalTypeId?: string;        // Optional - linked to goal type (can be null)
  chapters: string[];         // Which chapters can use this action (empty = all chapters)
  creatorOrganizerVanid?: string;     // Who created this action
  visibleToOrganizers?: string[];     // Who can see/use this action (empty = everyone)
  hasGoal?: boolean;          // Whether this action has a goal/barometer (false = just a count)
  targetAudience?: 'constituent' | 'leadership';  // Whether this action tracks constituents or leaders
  isTemplate?: boolean;       // If true, this is a campaign-level action template
  templateActionId?: string;  // If set, this personal action is based on a template
  defaultIndividualGoal?: number;  // Default goal for individuals (e.g., 5)
  
  // NEW: Rate-based actions
  actionType?: 'one_time' | 'rate_based';
  recurrencePeriod?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  recurrenceCount?: number;
  
  // NEW: Deadline support
  deadlineDate?: string;  // ISO date string
  deadlineType?: 'soft' | 'hard';
  timeTrackingEnabled?: boolean;
}

interface CampaignActionDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (action: Omit<CampaignAction, 'id'>) => void;
  chapters: string[];
  selectedChapter: string;
  existingCampaigns: string[];
  parentCampaigns: ParentCampaign[];
  parentCampaignId?: string; // Pre-selected parent campaign (when opened from a campaign card)
  currentUserId?: string; // Current user's VAN ID for personal actions
  currentUserName?: string; // Current user's name for display
  availableOrganizers?: Array<{ vanid: string; name: string }>; // Available organizers to share with
  editingAction?: CampaignAction; // Action being edited (if in edit mode)
}

const CampaignActionDialog: React.FC<CampaignActionDialogProps> = ({
  open,
  onClose,
  onSave,
  chapters,
  selectedChapter,
  existingCampaigns,
  parentCampaigns,
  parentCampaignId,
  currentUserId,
  currentUserName,
  availableOrganizers = [],
  editingAction
}) => {
  const [actionName, setActionName] = useState<string>('');
  const [selectedParentCampaign, setSelectedParentCampaign] = useState<string>(parentCampaignId || '');
  const [selectedGoalType, setSelectedGoalType] = useState<string>('');
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]); // Empty = all chapters
  const [visibilityMode, setVisibilityMode] = useState<'everyone' | 'only_me' | 'chapter' | 'specific'>('only_me');
  const [selectedOrganizers, setSelectedOrganizers] = useState<string[]>(currentUserId ? [currentUserId] : []);
  const [fields, setFields] = useState<CampaignActionField[]>([
    { key: 'asked', label: 'Asked', type: 'boolean' },
    { key: 'committed', label: 'Committed', type: 'boolean' }
  ]);
  const [goalFieldKey, setGoalFieldKey] = useState<string>('');
  const [hasGoal, setHasGoal] = useState<boolean>(true);
  const [targetAudience, setTargetAudience] = useState<'constituent' | 'leadership'>('constituent');
  const [defaultIndividualGoal, setDefaultIndividualGoal] = useState<string>('5');
  
  // NEW: Rate-based and deadline state
  const [actionType, setActionType] = useState<'one_time' | 'rate_based'>('one_time');
  const [recurrencePeriod, setRecurrencePeriod] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'>('weekly');
  const [recurrenceCount, setRecurrenceCount] = useState<string>('5');
  const [deadlineDate, setDeadlineDate] = useState<string>('');
  const [deadlineType, setDeadlineType] = useState<'soft' | 'hard'>('soft');
  
  // Load editing action data when dialog opens
  useEffect(() => {
    if (open && editingAction) {
      setActionName(editingAction.name);
      setSelectedParentCampaign(editingAction.parentCampaignId || '');
      setSelectedGoalType(editingAction.goalTypeId || '');
      setSelectedChapters(editingAction.chapters || []);
      setGoalFieldKey(editingAction.goalFieldKey || '');
      setHasGoal(editingAction.hasGoal !== false); // Default to true if not set
      setTargetAudience(editingAction.targetAudience || 'constituent'); // Default to constituent if not set
      setDefaultIndividualGoal(editingAction.defaultIndividualGoal?.toString() || '5');
      
      // Load rate-based and deadline fields
      setActionType(editingAction.actionType || 'one_time');
      setRecurrencePeriod(editingAction.recurrencePeriod || 'weekly');
      setRecurrenceCount(editingAction.recurrenceCount?.toString() || '5');
      setDeadlineDate(editingAction.deadlineDate || '');
      setDeadlineType(editingAction.deadlineType || 'soft');
      // Ensure all fields have required properties
      const fieldsWithTypes = (editingAction.fields || []).map((f: any) => ({
        key: f.key || '',
        label: f.label || '',
        type: f.type || 'boolean', // Default to boolean if not set
        options: f.options || [],
        optionsText: f.optionsText || (f.options ? f.options.join(', ') : '')
      }));
      setFields(fieldsWithTypes);
      
      // Set visibility mode
      if (editingAction.chapters && editingAction.chapters.length > 0) {
        // Has chapters set, so it's chapter-based visibility
        setVisibilityMode('chapter');
        setSelectedOrganizers([]);
      } else if (!editingAction.visibleToOrganizers || editingAction.visibleToOrganizers.length === 0) {
        setVisibilityMode('everyone');
        setSelectedOrganizers([]);
      } else if (editingAction.visibleToOrganizers.length === 1 && editingAction.visibleToOrganizers[0] === editingAction.creatorOrganizerVanid) {
        setVisibilityMode('only_me');
        setSelectedOrganizers(editingAction.visibleToOrganizers);
      } else {
        setVisibilityMode('specific');
        setSelectedOrganizers(editingAction.visibleToOrganizers);
      }
    } else if (open && !editingAction) {
      // Reset for new action
      setActionName('');
      setSelectedParentCampaign(parentCampaignId || '');
      setSelectedGoalType('');
      setSelectedChapters([]);
      setGoalFieldKey('');
      setHasGoal(true);
      setTargetAudience('constituent');
      setDefaultIndividualGoal('5');
      setVisibilityMode('only_me');
      setSelectedOrganizers(currentUserId ? [currentUserId] : []);
      setFields([
        { key: 'asked', label: 'Asked', type: 'boolean' },
        { key: 'committed', label: 'Committed', type: 'boolean' }
      ]);
      setGoalFieldKey('');
      
      // Reset rate-based and deadline fields
      setActionType('one_time');
      setRecurrencePeriod('weekly');
      setRecurrenceCount('5');
      setDeadlineDate('');
      setDeadlineType('soft');
    }
  }, [open, editingAction, parentCampaignId, currentUserId]);
  const [error, setError] = useState<string>('');

  // Update parent campaign if prop changes
  useEffect(() => {
    if (parentCampaignId) {
      setSelectedParentCampaign(parentCampaignId);
    }
  }, [parentCampaignId]);

  const handleAddField = () => {
    setFields([...fields, { key: '', label: '', type: 'boolean' }]);
  };

  const handleRemoveField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, fieldKey: 'key' | 'label' | 'type', value: string) => {
    const updatedFields = [...fields];
    if (fieldKey === 'type') {
      updatedFields[index].type = value as 'boolean' | 'select' | 'text' | 'conversation';
      // Clear options if switching away from select
      if (value !== 'select') {
        delete updatedFields[index].options;
      }
    } else {
      updatedFields[index][fieldKey] = value;
    }
    setFields(updatedFields);
  };
  
  const handleOptionsChange = (index: number, options: string) => {
    const updatedFields = [...fields];
    // Split by comma and trim
    updatedFields[index].options = options.split(',').map(o => o.trim()).filter(Boolean);
    setFields(updatedFields);
  };

  const handleSave = () => {
    // Validation
    if (!actionName.trim()) {
      setError('Please enter an action name');
      return;
    }
    // Campaign and goal type are now optional
    if (fields.length === 0) {
      setError('Please add at least one step field');
      return;
    }
    if (visibilityMode === 'specific' && selectedOrganizers.length === 0) {
      setError('Please select at least one organizer');
      return;
    }
    if (visibilityMode === 'chapter' && selectedChapters.length === 0) {
      setError('Please select at least one team');
      return;
    }

    // Determine visibility and ownership based on mode
    let visibleTo: string[] | undefined;
    let organizerVanid: string | undefined;
    let chaptersToSave: string[] = [];
    
    if (visibilityMode === 'everyone') {
      // Federation-wide: no owner, visible to all chapters
      visibleTo = undefined;
      organizerVanid = undefined; // NULL in database = federation-wide
      chaptersToSave = [];
    } else if (visibilityMode === 'only_me') {
      // Personal action: owned by current user, visible only to them
      visibleTo = currentUserId ? [currentUserId] : undefined;
      organizerVanid = currentUserId;
      chaptersToSave = [];
    } else if (visibilityMode === 'chapter') {
      // Chapter-based: visible to all organizers in selected chapters
      visibleTo = undefined;
      organizerVanid = undefined; // No specific owner, chapter-based
      chaptersToSave = selectedChapters;
    } else {
      // Shared action: owned by current user, visible to specific organizers
      visibleTo = selectedOrganizers;
      organizerVanid = currentUserId;
      chaptersToSave = [];
    }

    // Validate fields have key and label
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      if (!field || !field.key || typeof field.key !== 'string' || !field.key.trim()) {
        setError(`Field ${i + 1}: Please enter a field key`);
        return;
      }
      if (!field.label || typeof field.label !== 'string' || !field.label.trim()) {
        setError(`Field ${i + 1}: Please enter a field label`);
        return;
      }
    }

    // Process fields: convert optionsText to options array
    const processedFields = fields.map(field => {
      const cleanField: any = {
        key: (field.key || '').trim(),
        label: (field.label || '').trim(),
        type: field.type || 'boolean'
      };
      
      // Convert optionsText to options array for select fields
      if (field.type === 'select') {
        if (field.optionsText) {
          cleanField.options = field.optionsText.split(',').map(o => o.trim()).filter(Boolean);
        } else if (field.options) {
          cleanField.options = field.options;
        }
      }
      
      return cleanField;
    });

    // Save the action template
    // All actions created in Campaign view are templates (automatically visible to everyone)
    onSave({
      name: actionName.trim(),
      fields: processedFields,
      goalFieldKey: goalFieldKey || undefined,
      parentCampaignId: selectedParentCampaign || undefined,
      goalTypeId: selectedGoalType || undefined,
      chapters: chaptersToSave,
      creatorOrganizerVanid: organizerVanid,
      visibleToOrganizers: visibleTo,
      hasGoal: hasGoal,
      targetAudience: targetAudience,
      isTemplate: true,  // All actions in Campaign view are templates
      defaultIndividualGoal: defaultIndividualGoal ? Number(defaultIndividualGoal) : 5,
      
      // NEW: Add rate-based and deadline fields
      actionType: actionType,
      recurrencePeriod: actionType === 'rate_based' ? recurrencePeriod : undefined,
      recurrenceCount: actionType === 'rate_based' ? Number(recurrenceCount) : undefined,
      deadlineDate: deadlineDate || undefined,
      deadlineType: deadlineDate ? deadlineType : undefined,
      timeTrackingEnabled: actionType === 'rate_based'
    });

    // Reset form
    setActionName('');
    setSelectedParentCampaign(parentCampaignId || '');
    setSelectedGoalType('');
    setSelectedChapters([]);
    setGoalFieldKey('');
    setHasGoal(true);
    setTargetAudience('constituent');
    setDefaultIndividualGoal('5');
    setVisibilityMode('only_me');
    setSelectedOrganizers(currentUserId ? [currentUserId] : []);
    setFields([
      { key: 'asked', label: 'Asked', type: 'boolean' },
      { key: 'committed', label: 'Committed', type: 'boolean' }
    ]);
    setGoalFieldKey('');
    setActionType('one_time');
    setRecurrencePeriod('weekly');
    setRecurrenceCount('5');
    setDeadlineDate('');
    setDeadlineType('soft');
    setError('');
    onClose();
  };

  const handleClose = () => {
    setError('');
    setActionName('');
    setSelectedParentCampaign(parentCampaignId || '');
    setSelectedGoalType('');
    setSelectedChapters([]);
    setFields([
      { key: 'asked', label: 'Asked', type: 'boolean' },
      { key: 'committed', label: 'Committed', type: 'boolean' }
    ]);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6">{editingAction ? 'Edit Action' : 'Create Action Template'}</Typography>
          <Typography variant="caption" color="text.secondary">
            Define a reusable action that organizers can use to track people through a process
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}

          {/* Action Name */}
          <TextField
            label="Action Name"
            value={actionName}
            onChange={(e) => setActionName(e.target.value)}
            placeholder="e.g., Sign Pledge, Join Team, Attend Rally"
            fullWidth
            helperText="A descriptive name for this action"
          />

          {/* Has Goal Checkbox */}
          <FormControlLabel
            control={
              <Checkbox
                checked={hasGoal}
                onChange={(e) => setHasGoal(e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">This action has a goal/target</Typography>
                <Typography variant="caption" color="text.secondary">
                  {hasGoal 
                    ? "Will show as a progress bar with goal. Uncheck for tracking lists (e.g., 'Follow Up', 'Schedule 1:1')" 
                    : "Will show as a simple count. Good for tracking lists without specific targets"}
                </Typography>
              </Box>
            }
          />

          {/* Default Individual Goal */}
          {hasGoal && (
            <TextField
              label="Default Individual Goal"
              type="number"
              value={defaultIndividualGoal}
              onChange={(e) => setDefaultIndividualGoal(e.target.value)}
              placeholder="5"
              fullWidth
              sx={{ mt: 2 }}
              helperText="The automatic goal for each individual (e.g., 5 means each organizer aims for 5)"
              inputProps={{ min: 1, step: 1 }}
            />
          )}

          {/* Target Audience Selector */}
          <FormControl component="fieldset" sx={{ mt: 2 }}>
            <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.875rem', fontWeight: 600 }}>
              Who does this action track?
            </FormLabel>
            <RadioGroup
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value as 'constituent' | 'leadership')}
            >
              <FormControlLabel 
                value="constituent" 
                control={<Radio />} 
                label={
                  <Box>
                    <Typography variant="body2">Constituents</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Track people who are being organized (e.g., pledges, sign-ups, turnout)
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel 
                value="leadership" 
                control={<Radio />} 
                label={
                  <Box>
                    <Typography variant="body2">Leaders</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Track organizers and leaders (e.g., 1:1s, leadership development, coaching)
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>

          <Divider sx={{ my: 2 }} />

          {/* Action Type Selector */}
          <FormControl component="fieldset">
            <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.875rem', fontWeight: 600 }}>
              Action Tracking Type
            </FormLabel>
            <RadioGroup
              value={actionType}
              onChange={(e) => setActionType(e.target.value as 'one_time' | 'rate_based')}
            >
              <FormControlLabel 
                value="one_time" 
                control={<Radio />} 
                label={
                  <Box>
                    <Typography variant="body2">One-Time Goal</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Track total completions (e.g., "Sign 50 pledges", "Complete 10 1:1s")
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel 
                value="rate_based" 
                control={<Radio />} 
                label={
                  <Box>
                    <Typography variant="body2">Rate-Based (Per Week/Month)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Track completions per time period (e.g., "5 1:1s per week", "One new member per week")
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>

          {/* Rate Configuration */}
          {actionType === 'rate_based' && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'primary.50', borderRadius: 1, border: '1px solid', borderColor: 'primary.200' }}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
                Rate Configuration
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                <TextField
                  label="Count"
                  type="number"
                  value={recurrenceCount}
                  onChange={(e) => setRecurrenceCount(e.target.value)}
                  sx={{ width: 100 }}
                  inputProps={{ min: 1 }}
                  size="small"
                />
                <Typography sx={{ alignSelf: 'center', pb: 0.5 }}>per</Typography>
                <FormControl sx={{ flex: 1 }} size="small">
                  <InputLabel>Period</InputLabel>
                  <Select
                    value={recurrencePeriod}
                    onChange={(e) => setRecurrencePeriod(e.target.value as any)}
                    label="Period"
                  >
                    <MenuItem value="daily">Day</MenuItem>
                    <MenuItem value="weekly">Week</MenuItem>
                    <MenuItem value="monthly">Month</MenuItem>
                    <MenuItem value="quarterly">Quarter</MenuItem>
                    <MenuItem value="annual">Year</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              {recurrenceCount && recurrencePeriod && (
                <Typography variant="caption" color="primary.main" sx={{ mt: 1.5, display: 'block', fontWeight: 600 }}>
                  ✓ Goal: {recurrenceCount} {actionName || 'completions'} per {recurrencePeriod === 'daily' ? 'day' : recurrencePeriod === 'weekly' ? 'week' : recurrencePeriod === 'monthly' ? 'month' : recurrencePeriod === 'quarterly' ? 'quarter' : 'year'}
                </Typography>
              )}
            </Box>
          )}

          {/* Deadline Configuration */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
              Deadline (Optional)
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
              Set a target completion date for this action
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <TextField
                label="Deadline Date"
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1 }}
                helperText="Optional: Set a 'by when' date"
                size="small"
              />
              
              <FormControl sx={{ width: 150 }} size="small">
                <InputLabel>Type</InputLabel>
                <Select
                  value={deadlineType}
                  onChange={(e) => setDeadlineType(e.target.value as 'soft' | 'hard')}
                  label="Type"
                  disabled={!deadlineDate}
                >
                  <MenuItem value="soft">Target</MenuItem>
                  <MenuItem value="hard">Required</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {deadlineDate && (
              <Box sx={{ mt: 1.5, p: 1.5, bgcolor: deadlineType === 'hard' ? 'error.50' : 'info.50', borderRadius: 1 }}>
                <Typography variant="caption" color={deadlineType === 'hard' ? 'error.main' : 'info.main'} sx={{ fontWeight: 600 }}>
                  {deadlineType === 'hard' ? '⚠️ Required' : '📅 Target'} completion by {new Date(deadlineDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Action Visibility Settings */}
          {currentUserId && (
            <Box>
              <FormControl component="fieldset">
                <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.875rem', fontWeight: 600 }}>
                  Who can see and use this action?
                </FormLabel>
                <RadioGroup
                  value={visibilityMode}
                  onChange={(e) => {
                    setVisibilityMode(e.target.value as 'everyone' | 'only_me' | 'chapter' | 'specific');
                    if (e.target.value === 'only_me' && currentUserId) {
                      setSelectedOrganizers([currentUserId]);
                      setSelectedChapters([]);
                    } else if (e.target.value === 'everyone') {
                      setSelectedOrganizers([]);
                      setSelectedChapters([]);
                    } else if (e.target.value === 'chapter') {
                      setSelectedOrganizers([]);
                    } else if (e.target.value === 'specific') {
                      setSelectedChapters([]);
                    }
                  }}
                >
                  <FormControlLabel 
                    value="everyone" 
                    control={<Radio />} 
                    label={
                      <Box>
                        <Typography variant="body2">Everyone (Federation-wide)</Typography>
                        <Typography variant="caption" color="text.secondary">
                          All organizers in all chapters can see and use this action
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel 
                    value="only_me" 
                    control={<Radio />} 
                    label={
                      <Box>
                        <Typography variant="body2">Only Me ({currentUserName || 'you'})</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Only {currentUserName || 'you'} can see and use this action
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel 
                    value="chapter" 
                    control={<Radio />} 
                    label={
                      <Box>
                        <Typography variant="body2">Specific Team(s)</Typography>
                        <Typography variant="caption" color="text.secondary">
                          All organizers in selected teams can see and use this action
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel 
                    value="specific" 
                    control={<Radio />} 
                    label={
                      <Box>
                        <Typography variant="body2">Specific Organizers</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Choose which organizers can see and use this action
                        </Typography>
                      </Box>
                    }
                  />
                </RadioGroup>
              </FormControl>

              {/* Multi-select for teams */}
              {visibilityMode === 'chapter' && (
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel>Select Teams</InputLabel>
                  <Select
                    multiple
                    value={selectedChapters}
                    onChange={(e) => setSelectedChapters(typeof e.target.value === 'string' ? [e.target.value] : e.target.value)}
                    input={<OutlinedInput label="Select Teams" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((chapter) => (
                          <Chip key={chapter} label={chapter} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {chapters.map((chapterName) => (
                      <MenuItem key={chapterName} value={chapterName}>
                        <Checkbox checked={selectedChapters.indexOf(chapterName) > -1} />
                        <MuiListItemText primary={chapterName} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {/* Multi-select for specific organizers */}
              {visibilityMode === 'specific' && (
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel>Select Organizers</InputLabel>
                  <Select
                    multiple
                    value={selectedOrganizers}
                    onChange={(e) => setSelectedOrganizers(typeof e.target.value === 'string' ? [e.target.value] : e.target.value)}
                    input={<OutlinedInput label="Select Organizers" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((vanid) => {
                          const org = availableOrganizers.find(o => o.vanid === vanid);
                          return <Chip key={vanid} label={org?.name || vanid} size="small" />;
                        })}
                      </Box>
                    )}
                  >
                    {availableOrganizers.map((org) => (
                      <MenuItem key={org.vanid} value={org.vanid}>
                        <Checkbox checked={selectedOrganizers.indexOf(org.vanid) > -1} />
                        <MuiListItemText primary={org.name} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>
          )}

          <Divider sx={{ my: 1 }} />

          {/* Parent Campaign Selection */}
          <Typography variant="subtitle2" fontWeight="bold">
            Link to Campaign & Goal (Optional)
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            You can skip this if you want a standalone action not tied to any campaign
          </Typography>
          
          <FormControl fullWidth>
            <InputLabel>Parent Campaign</InputLabel>
            <Select
              value={selectedParentCampaign}
              onChange={(e) => {
                setSelectedParentCampaign(e.target.value as string);
                setSelectedGoalType(''); // Reset goal type when parent changes
              }}
              label="Parent Campaign"
              disabled={!!parentCampaignId} // Disable if pre-selected
            >
              <MenuItem value="">
                <em>None (Standalone Action)</em>
              </MenuItem>
              {parentCampaigns.map((parentCampaign) => (
                <MenuItem key={parentCampaign.id} value={parentCampaign.id}>
                  {parentCampaign.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Goal Type Selection */}
          {selectedParentCampaign && (
            <FormControl fullWidth>
              <InputLabel>Goal Type</InputLabel>
              <Select
                value={selectedGoalType}
                onChange={(e) => setSelectedGoalType(e.target.value as string)}
                label="Goal Type"
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {parentCampaigns
                  .find(pc => pc.id === selectedParentCampaign)
                  ?.goalTypes.map((goalType) => (
                    <MenuItem key={goalType.id} value={goalType.id}>
                      {goalType.name} - Target: {goalType.totalTarget} {goalType.unit}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          )}

          {/* Show selected campaign info */}
          {selectedParentCampaign && selectedGoalType && (
            <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
              <Typography variant="caption" color="text.secondary" display="block">
                <strong>Campaign:</strong> {parentCampaigns.find(pc => pc.id === selectedParentCampaign)?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                <strong>Goal Type:</strong> {parentCampaigns.find(pc => pc.id === selectedParentCampaign)?.goalTypes.find(gt => gt.id === selectedGoalType)?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                <strong>Organization Target:</strong> {parentCampaigns.find(pc => pc.id === selectedParentCampaign)?.goalTypes.find(gt => gt.id === selectedGoalType)?.totalTarget} {parentCampaigns.find(pc => pc.id === selectedParentCampaign)?.goalTypes.find(gt => gt.id === selectedGoalType)?.unit}
              </Typography>
            </Paper>
          )}

          <Divider sx={{ my: 1 }} />

          {/* Boolean Step Fields */}
          <Typography variant="subtitle2" fontWeight="bold">
            Action Steps (Boolean Fields)
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Define fields to track for each person (checkboxes, dropdowns, or notes)
          </Typography>

          {/* Current Fields */}
          {fields.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              {fields.map((field, index) => {
                const fieldType = field.type || 'boolean'; // Ensure type is set
                return (
                  <Box key={index} sx={{ mb: 2, pb: 2, borderBottom: index < fields.length - 1 ? '1px solid #e0e0e0' : 'none' }}>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <TextField
                        label="Field Key"
                        value={field.key}
                        onChange={(e) => handleFieldChange(index, 'key', e.target.value)}
                        size="small"
                        sx={{ flex: 1 }}
                        helperText="Unique identifier (e.g., 'asked', 'status')"
                      />
                      <TextField
                        label="Field Label"
                        value={field.label}
                        onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                        size="small"
                        sx={{ flex: 1 }}
                        helperText="Display name (e.g., 'Asked', 'Status')"
                      />
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Type</InputLabel>
                        <Select
                          value={fieldType}
                          onChange={(e) => handleFieldChange(index, 'type', e.target.value)}
                          label="Type"
                        >
                          <MenuItem value="boolean">Checkbox</MenuItem>
                          <MenuItem value="select">Dropdown</MenuItem>
                          <MenuItem value="text">Text Note</MenuItem>
                          <MenuItem value="conversation">Log Conversation</MenuItem>
                        </Select>
                      </FormControl>
                      <IconButton 
                        onClick={() => handleRemoveField(index)}
                        size="small"
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    
                    {/* Options for select fields */}
                    {fieldType === 'select' && (
                      <TextField
                        label="Options (comma-separated)"
                        value={field.optionsText !== undefined ? field.optionsText : field.options?.join(', ') || ''}
                        onChange={(e) => {
                          const updatedFields = [...fields];
                          // Store raw text during editing
                          updatedFields[index].optionsText = e.target.value;
                          setFields(updatedFields);
                        }}
                        size="small"
                        fullWidth
                        placeholder="e.g., Not Started, In Progress, Complete"
                        helperText="Enter options separated by commas"
                      />
                    )}
                  </Box>
                );
              })}
            </Paper>
          )}

          {/* Add New Field Button */}
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddField}
            fullWidth
          >
            Add Field
          </Button>
          
          <Divider sx={{ my: 2 }} />
          
          {/* Goal Field Selection */}
          {fields.filter(f => f.type === 'boolean').length > 0 && (
            <>
              <Typography variant="subtitle2" fontWeight="bold">
                Goal Tracking Field (Optional)
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Choose which field represents "completion" for goal tracking
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Goal Field</InputLabel>
                <Select
                  value={goalFieldKey}
                  onChange={(e) => setGoalFieldKey(e.target.value)}
                  label="Goal Field"
                >
                  <MenuItem value="">
                    <em>Count all people added (Named — no field filter)</em>
                  </MenuItem>
                  {fields.filter(f => f.key && f.label).map(field => (
                    <MenuItem key={field.key} value={field.key}>
                      {field.label}
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {field.type === 'boolean' ? '(checked)' : field.type === 'select' ? '(option selected)' : '(filled in)'}
                      </Typography>
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Checkbox fields count when checked. Text/note fields count when filled in. Select fields count when an option is chosen.
                </Typography>
              </FormControl>
            </>
          )}
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} color="secondary">
          Cancel
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained">
          {editingAction ? 'Save Changes' : 'Create Action Template'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CampaignActionDialog;
