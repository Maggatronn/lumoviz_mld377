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
  FormControlLabel,
  Switch,
  Autocomplete,
  Chip
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

export interface TeamGoal {
  id: string;
  level: 'federation' | 'chapter' | 'organizer'; // Goal level
  target: string; // Federation name, Chapter name, or Organizer name
  goalType: 'new_teams' | 'team_coordinators' | 'team_members' | 'team_events';
  description: string; // Description of the goal
  targetCount: number; // How many teams/people/events
  turf: string[]; // Geographic areas or turfs
  byWhen: string; // Target completion date
  timeWindow: string; // Recurring time window
  createdDate: string;
  startDate: string;
  endDate?: string; // Optional - if not set, goal runs indefinitely
  isIndefinite: boolean; // True if goal runs indefinitely
  notes?: string; // Additional notes
}

interface TeamGoalsDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (goal: Omit<TeamGoal, 'id' | 'createdDate'>) => void;
  organizers: string[];
  chapters: string[];
  editingGoal?: TeamGoal; // If provided, we're editing an existing goal
}

const TeamGoalsDialog: React.FC<TeamGoalsDialogProps> = ({
  open,
  onClose,
  onSave,
  organizers,
  chapters,
  editingGoal
}) => {
  const [level, setLevel] = useState<'federation' | 'chapter' | 'organizer'>('organizer');
  const [target, setTarget] = useState<string>('');
  const [goalType, setGoalType] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [targetCount, setTargetCount] = useState<string>('');
  const [turf, setTurf] = useState<string[]>([]);
  const [byWhen, setByWhen] = useState<string>('');
  const [timeWindow, setTimeWindow] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isIndefinite, setIsIndefinite] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Common turf options for North Carolina
  const turfOptions = [
    'Durham County',
    'Wake County', 
    'Mecklenburg County',
    'Guilford County',
    'Forsyth County',
    'New Hanover County',
    'Cumberland County',
    'Gaston County',
    'Orange County',
    'Buncombe County',
    'Iredell County',
    'Cabarrus County',
    'Johnston County',
    'Alamance County',
    'Nash County',
    'Wilson County',
    'Pitt County',
    'Rowan County',
    'Union County',
    'Catawba County',
    'Statewide',
    'Rural Areas',
    'Urban Centers',
    'College Campuses'
  ];

  // Populate form when editing an existing goal
  useEffect(() => {
    if (editingGoal && open) {
      setLevel(editingGoal.level);
      setTarget(editingGoal.target);
      setGoalType(editingGoal.goalType);
      setDescription(editingGoal.description);
      setTargetCount(editingGoal.targetCount.toString());
      setTurf(editingGoal.turf);
      setByWhen(editingGoal.byWhen);
      setTimeWindow(editingGoal.timeWindow);
      setStartDate(editingGoal.startDate);
      setEndDate(editingGoal.endDate || '');
      setIsIndefinite(editingGoal.isIndefinite);
      setNotes(editingGoal.notes || '');
      setError('');
    } else if (open && !editingGoal) {
      // Reset form for new goal
      setLevel('organizer');
      setTarget('');
      setGoalType('');
      setDescription('');
      setTargetCount('');
      setTurf([]);
      setByWhen('');
      setTimeWindow('');
      setStartDate(new Date().toISOString().split('T')[0]); // Default to today
      setEndDate('');
      setIsIndefinite(true);
      setNotes('');
      setError('');
    }
  }, [editingGoal, open]);

  // Auto-select federation when level is federation
  useEffect(() => {
    if (level === 'federation') {
      setTarget('Carolina Federation');
    }
  }, [level]);

  const goalTypes = [
    { value: 'new_teams', label: 'Create New Teams', description: 'Build new organizing teams in target areas' },
    { value: 'team_coordinators', label: 'Recruit Team Coordinators', description: 'Find and train new team coordinators' },
    { value: 'team_members', label: 'Add Team Members', description: 'Recruit new members to existing teams' },
    { value: 'team_events', label: 'Organize Team Events', description: 'Host team building and organizing events' }
  ];

  const timeWindowOptions = [
    { value: '1week', label: '1 Week' },
    { value: '2weeks', label: '2 Weeks' },
    { value: '1month', label: '1 Month' },
    { value: '3months', label: '3 Months' },
    { value: '6months', label: '6 Months' },
    { value: '1year', label: '1 Year' }
  ];

  const handleSave = () => {
    // Validation
    if (!target.trim()) {
      const levelLabel = level === 'federation' ? 'federation' : level === 'chapter' ? 'chapter' : 'organizer';
      setError(`Please select a ${levelLabel}`);
      return;
    }
    if (!goalType.trim()) {
      setError('Please select a goal type');
      return;
    }
    if (!description.trim()) {
      setError('Please enter a goal description');
      return;
    }
    if (!targetCount.trim() || isNaN(Number(targetCount)) || Number(targetCount) <= 0) {
      setError('Please enter a valid target count');
      return;
    }
    if (turf.length === 0) {
      setError('Please select at least one turf area');
      return;
    }
    if (!byWhen.trim()) {
      setError('Please select a target completion date');
      return;
    }
    if (!timeWindow.trim()) {
      setError('Please select a time window');
      return;
    }
    if (!startDate.trim()) {
      setError('Please select a start date');
      return;
    }
    if (!isIndefinite && !endDate.trim()) {
      setError('Please provide an end date or select "Indefinitely"');
      return;
    }
    if (!isIndefinite && endDate && new Date(endDate) <= new Date(startDate)) {
      setError('End date must be after start date');
      return;
    }
    if (new Date(byWhen) <= new Date(startDate)) {
      setError('Target completion date must be after start date');
      return;
    }

    // Save the goal
    onSave({
      level,
      target: target.trim(),
      goalType: goalType as 'new_teams' | 'team_coordinators' | 'team_members' | 'team_events',
      description: description.trim(),
      targetCount: Number(targetCount),
      turf,
      byWhen: byWhen.trim(),
      timeWindow: timeWindow.trim(),
      startDate: startDate.trim(),
      endDate: isIndefinite ? undefined : endDate.trim(),
      isIndefinite,
      notes: notes.trim()
    });

    // Reset form
    setLevel('organizer');
    setTarget('');
    setGoalType('');
    setDescription('');
    setTargetCount('');
    setTurf([]);
    setByWhen('');
    setTimeWindow('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setIsIndefinite(true);
    setNotes('');
    setError('');
    onClose();
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  const selectedGoalType = goalTypes.find(type => type.value === goalType);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">{editingGoal ? 'Edit Team Goal' : 'Add Team Building Goal'}</Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
          {error && (
            <Typography color="error" variant="body2" sx={{ backgroundColor: '#ffebee', p: 2, borderRadius: 1 }}>
              {error}
            </Typography>
          )}

          {/* Goal Level and Target */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
            {/* Goal Level */}
            <FormControl fullWidth>
              <InputLabel>Goal Level</InputLabel>
              <Select
                value={level}
                onChange={(e) => {
                  setLevel(e.target.value as 'federation' | 'chapter' | 'organizer');
                  setTarget(''); // Reset target when level changes
                }}
                label="Goal Level"
              >
                <MenuItem value="federation">Carolina Federation</MenuItem>
                <MenuItem value="chapter">Chapter</MenuItem>
                <MenuItem value="organizer">Individual Organizer</MenuItem>
              </Select>
            </FormControl>

            {/* Target Selection */}
            <FormControl fullWidth>
              <InputLabel>
                {level === 'federation' ? 'Federation' : 
                 level === 'chapter' ? 'Chapter' : 'Organizer'}
              </InputLabel>
              <Select
                value={target}
                onChange={(e) => setTarget(e.target.value as string)}
                label={level === 'federation' ? 'Federation' : 
                       level === 'chapter' ? 'Chapter' : 'Organizer'}
                disabled={level === 'federation'}
              >
                {level === 'federation' ? (
                  <MenuItem value="Carolina Federation">Carolina Federation</MenuItem>
                ) : level === 'chapter' ? (
                  chapters.map((chapter) => (
                    <MenuItem key={chapter} value={chapter}>
                      {chapter}
                    </MenuItem>
                  ))
                ) : (
                  organizers.map((org) => (
                    <MenuItem key={org} value={org}>
                      {org}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </Box>

          {/* Goal Type and Description */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
            {/* Goal Type */}
            <FormControl fullWidth>
              <InputLabel>Goal Type</InputLabel>
              <Select
                value={goalType}
                onChange={(e) => setGoalType(e.target.value as string)}
                label="Goal Type"
              >
                {goalTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {type.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {type.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Target Count */}
            <TextField
              label={selectedGoalType ? `Number of ${selectedGoalType.label}` : "Target Count"}
              type="number"
              value={targetCount}
              onChange={(e) => setTargetCount(e.target.value)}
              placeholder="e.g., 5"
              fullWidth
              inputProps={{ min: 1 }}
              helperText={selectedGoalType ? `How many ${selectedGoalType.label.toLowerCase()} to achieve` : ''}
            />
          </Box>

          {/* Goal Description */}
          <TextField
            label="Goal Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Build organizing teams in rural Durham County focused on housing justice"
            fullWidth
            multiline
            rows={2}
            helperText="Provide a clear description of what you want to accomplish"
          />

          {/* Turf and Timeline */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
            {/* Turf Selection */}
            <Autocomplete
              multiple
              options={turfOptions}
              value={turf}
              onChange={(_, newValue) => setTurf(newValue)}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={option}
                    {...getTagProps({ index })}
                    key={option}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Turf Areas"
                  placeholder="Select geographic areas"
                  helperText="Choose the areas where this goal will be pursued"
                />
              )}
            />

            {/* By When (Target Completion) */}
            <TextField
              label="Target Completion Date"
              type="date"
              value={byWhen}
              onChange={(e) => setByWhen(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
              helperText="When should this goal be completed?"
              inputProps={{ min: startDate }}
            />
          </Box>

          {/* Time Window */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Time Window</InputLabel>
              <Select
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value as string)}
                label="Time Window"
              >
                {timeWindowOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Date Range Section */}
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'text.primary', mt: 2 }}>
            Goal Duration
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
            {/* Start Date */}
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />

            {/* Indefinite Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={isIndefinite}
                  onChange={(e) => {
                    setIsIndefinite(e.target.checked);
                    if (e.target.checked) {
                      setEndDate('');
                    }
                  }}
                />
              }
              label="Runs Indefinitely"
              sx={{ justifySelf: 'flex-start' }}
            />

            {/* End Date - only show if not indefinite */}
            {!isIndefinite && (
              <TextField
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                required={!isIndefinite}
                inputProps={{ min: startDate }}
              />
            )}
          </Box>

          {/* Notes */}
          <TextField
            label="Additional Notes (Optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional context, strategies, or considerations..."
            fullWidth
            multiline
            rows={3}
          />
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} color="secondary">
          Cancel
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained">
          {editingGoal ? 'Update Goal' : 'Add Goal'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TeamGoalsDialog;
