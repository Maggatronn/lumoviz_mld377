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
  Switch
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

export interface ConversationGoal {
  id: string;
  level: 'federation' | 'chapter' | 'organizer'; // Goal level
  target: string; // Federation name, Chapter name, or Organizer name
  conversationType: string;
  goalCount: number;
  timeWindow: string;
  createdDate: string;
  startDate: string;
  endDate?: string; // Optional - if not set, goal runs indefinitely
  isIndefinite: boolean; // True if goal runs indefinitely
}

interface ConversationGoalsDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (goal: Omit<ConversationGoal, 'id' | 'createdDate'>) => void;
  organizers: string[];
  chapters: string[];
  editingGoal?: ConversationGoal; // If provided, we're editing an existing goal
}

const ConversationGoalsDialog: React.FC<ConversationGoalsDialogProps> = ({
  open,
  onClose,
  onSave,
  organizers,
  chapters,
  editingGoal
}) => {
  const [level, setLevel] = useState<'federation' | 'chapter' | 'organizer'>('organizer');
  const [target, setTarget] = useState<string>('');
  const [conversationType, setConversationType] = useState<string>('');
  const [goalCount, setGoalCount] = useState<string>('');
  const [timeWindow, setTimeWindow] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isIndefinite, setIsIndefinite] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Populate form when editing an existing goal
  useEffect(() => {
    if (editingGoal && open) {
      setLevel(editingGoal.level);
      setTarget(editingGoal.target);
      setConversationType(editingGoal.conversationType);
      setGoalCount(editingGoal.goalCount.toString());
      setTimeWindow(editingGoal.timeWindow);
      setStartDate(editingGoal.startDate);
      setEndDate(editingGoal.endDate || '');
      setIsIndefinite(editingGoal.isIndefinite);
      setError('');
    } else if (open && !editingGoal) {
      // Reset form for new goal
      setLevel('organizer');
      setTarget('');
      setConversationType('');
      setGoalCount('');
      setTimeWindow('');
      setStartDate(new Date().toISOString().split('T')[0]); // Default to today
      setEndDate('');
      setIsIndefinite(true);
      setError('');
    }
  }, [editingGoal, open]);

  // Auto-select federation when level is federation
  useEffect(() => {
    if (level === 'federation') {
      setTarget('Carolina Federation');
    }
  }, [level]);

  const conversationTypes = [
    'One-on-One',
    'Team Meeting',
    'House Party',
    'Phone Banking',
    'Canvassing',
    'Community Event',
    'Training',
    'Other'
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
    if (!conversationType.trim()) {
      setError('Please select a conversation type');
      return;
    }
    if (!goalCount.trim() || isNaN(Number(goalCount)) || Number(goalCount) <= 0) {
      setError('Please enter a valid goal count');
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

    // Save the goal
    onSave({
      level,
      target: target.trim(),
      conversationType: conversationType.trim(),
      goalCount: Number(goalCount),
      timeWindow: timeWindow.trim(),
      startDate: startDate.trim(),
      endDate: isIndefinite ? undefined : endDate.trim(),
      isIndefinite
    });

    // Reset form
    setLevel('organizer');
    setTarget('');
    setConversationType('');
    setGoalCount('');
    setTimeWindow('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setIsIndefinite(true);
    setError('');
    onClose();
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">{editingGoal ? 'Edit Conversation Goal' : 'Add Conversation Goal'}</Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}

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

            {/* Conversation Type */}
            <FormControl fullWidth>
              <InputLabel>Conversation Type</InputLabel>
              <Select
                value={conversationType}
                onChange={(e) => setConversationType(e.target.value as string)}
                label="Conversation Type"
              >
                {conversationTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Goal Count */}
            <TextField
              label="Goal Count"
              type="number"
              value={goalCount}
              onChange={(e) => setGoalCount(e.target.value)}
              placeholder="e.g., 10"
              fullWidth
              inputProps={{ min: 1 }}
            />

            {/* Time Window */}
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
                inputProps={{ min: startDate }} // Prevent selecting dates before start date
              />
            )}
          </Box>
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

export default ConversationGoalsDialog;
