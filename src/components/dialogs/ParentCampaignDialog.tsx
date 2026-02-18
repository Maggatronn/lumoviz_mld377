import React, { useState } from 'react';
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
  Chip,
  Card,
  CardContent,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete
} from '@mui/material';
import { 
  Close as CloseIcon, 
  Add as AddIcon, 
  Delete as DeleteIcon,
  Campaign as CampaignIcon 
} from '@mui/icons-material';

export interface ParentCampaign {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  goalTypes: CampaignGoalType[];
  milestones: CampaignMilestone[];
  createdDate: string;
  chapters: string[]; // List of chapters this campaign applies to, or ["All Chapters"]
  // Campaign relationships
  parentCampaignId?: string; // Links to another parent campaign
  relatedCampaignIds?: string[]; // Related campaigns
  campaignType?: 'standalone' | 'parent' | 'child' | 'phase'; // Type of campaign
  sequenceOrder?: number; // Order in a sequence of campaigns
}

export type GoalDataSource = 'manual' | 'pledges' | 'meetings_membership' | 'meetings_leadership' | 'team_conversations';
export type GoalLevel = 'individual' | 'team' | 'organization';

export interface CampaignGoalType {
  id: string;
  name: string; // e.g., "Pledges", "Team Members"
  description: string;
  totalTarget: number; // Organization-wide target
  unit: string; // e.g., "pledges", "members"
  /** Which data source feeds this goal (pledges API, meetings, etc.). Manual = only from campaign actions. */
  dataSource?: GoalDataSource;
  /** Whether this goal is tracked at individual, team, or organization level */
  level?: GoalLevel;
  /** Chapter-specific goals (chapter name -> target) */
  chapterGoals?: Record<string, number>;
}

export interface CampaignMilestone {
  id: string;
  date: string;
  description: string;
  goalTypeTargets: { [goalTypeId: string]: number }; // Target for each goal type at this milestone
}

interface ParentCampaignDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (campaign: Omit<ParentCampaign, 'id' | 'createdDate'>) => void;
  editingCampaign?: ParentCampaign | null;
  allCampaigns?: ParentCampaign[];
  availableChapters?: string[]; // List of available chapters
}

const ParentCampaignDialog: React.FC<ParentCampaignDialogProps> = ({
  open,
  onClose,
  onSave,
  editingCampaign = null,
  allCampaigns = [],
  availableChapters = []
}) => {
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [goalTypes, setGoalTypes] = useState<CampaignGoalType[]>([]);
  const [milestones, setMilestones] = useState<CampaignMilestone[]>([]);
  const [error, setError] = useState<string>('');
  const [selectedChapters, setSelectedChapters] = useState<string[]>(['All Chapters']);
  
  // Campaign relationships
  const [parentCampaignId, setParentCampaignId] = useState<string>('');
  const [relatedCampaignIds, setRelatedCampaignIds] = useState<string[]>([]);
  const [campaignType, setCampaignType] = useState<'standalone' | 'parent' | 'child' | 'phase'>('standalone');
  const [sequenceOrder, setSequenceOrder] = useState<string>('');

  // Goal type form state
  const [newGoalType, setNewGoalType] = useState<{
    name: string;
    description: string;
    totalTarget: string;
    unit: string;
    dataSource?: GoalDataSource;
    level?: GoalLevel;
  }>({
    name: '',
    description: '',
    totalTarget: '',
    unit: '',
    dataSource: 'manual',
    level: 'organization'
  });
  
  // Chapter goals editing state
  const [editingChapterGoals, setEditingChapterGoals] = useState<string | null>(null); // goalTypeId being edited
  const [chapterGoalInputs, setChapterGoalInputs] = useState<Record<string, string>>({}); // chapter -> value

  // Milestone form state
  const [newMilestone, setNewMilestone] = useState({
    date: '',
    description: ''
  });

  // Populate form when editing
  React.useEffect(() => {
    if (editingCampaign) {
      setName(editingCampaign.name);
      setDescription(editingCampaign.description);
      setStartDate(editingCampaign.startDate);
      setEndDate(editingCampaign.endDate);
      setGoalTypes(editingCampaign.goalTypes);
      setMilestones(editingCampaign.milestones);
      setSelectedChapters(editingCampaign.chapters || ['All Chapters']);
      setParentCampaignId(editingCampaign.parentCampaignId || '');
      setRelatedCampaignIds(editingCampaign.relatedCampaignIds || []);
      setCampaignType(editingCampaign.campaignType || 'standalone');
      setSequenceOrder(editingCampaign.sequenceOrder?.toString() || '');
    } else {
      // Reset form when not editing
      setName('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setGoalTypes([]);
      setMilestones([]);
      setSelectedChapters(['All Chapters']);
      setParentCampaignId('');
      setRelatedCampaignIds([]);
      setCampaignType('standalone');
      setSequenceOrder('');
    }
  }, [editingCampaign, open]);

  const handleAddGoalType = () => {
    if (!newGoalType.name.trim() || !newGoalType.totalTarget.trim()) {
      setError('Please fill in goal type name and target');
      return;
    }

    const goalType: CampaignGoalType = {
      id: `goal_type_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newGoalType.name.trim(),
      description: newGoalType.description.trim(),
      totalTarget: Number(newGoalType.totalTarget),
      unit: newGoalType.unit.trim() || 'items',
      dataSource: newGoalType.dataSource || 'manual',
      level: newGoalType.level || 'organization'
    };

    setGoalTypes([...goalTypes, goalType]);
    setNewGoalType({ name: '', description: '', totalTarget: '', unit: '', dataSource: 'manual', level: 'organization' });
    setError('');
  };

  const handleAddChapterGoal = (goalTypeId: string, chapter: string, value: string) => {
    setGoalTypes(goalTypes.map(gt => {
      if (gt.id === goalTypeId) {
        return {
          ...gt,
          chapterGoals: {
            ...(gt.chapterGoals || {}),
            [chapter]: Number(value)
          }
        };
      }
      return gt;
    }));
  };
  
  const handleRemoveChapterGoal = (goalTypeId: string, chapter: string) => {
    setGoalTypes(goalTypes.map(gt => {
      if (gt.id === goalTypeId && gt.chapterGoals) {
        const newChapterGoals = { ...gt.chapterGoals };
        delete newChapterGoals[chapter];
        return {
          ...gt,
          chapterGoals: Object.keys(newChapterGoals).length > 0 ? newChapterGoals : undefined
        };
      }
      return gt;
    }));
  };
  
  const handleStartEditingChapterGoals = (goalTypeId: string) => {
    setEditingChapterGoals(goalTypeId);
    setChapterGoalInputs({});
  };
  
  const handleSaveChapterGoals = () => {
    if (editingChapterGoals) {
      // Add all non-empty chapter goals
      Object.entries(chapterGoalInputs).forEach(([chapter, value]) => {
        if (value.trim() && Number(value) > 0) {
          handleAddChapterGoal(editingChapterGoals, chapter, value);
        }
      });
    }
    setEditingChapterGoals(null);
    setChapterGoalInputs({});
  };

  const handleRemoveGoalType = (goalTypeId: string) => {
    setGoalTypes(goalTypes.filter(gt => gt.id !== goalTypeId));
    // Remove this goal type from all milestones
    setMilestones(milestones.map(milestone => ({
      ...milestone,
      goalTypeTargets: Object.fromEntries(
        Object.entries(milestone.goalTypeTargets).filter(([id]) => id !== goalTypeId)
      )
    })));
  };

  const handleAddMilestone = () => {
    if (!newMilestone.date || !newMilestone.description.trim()) {
      setError('Please fill in milestone date and description');
      return;
    }

    const milestone: CampaignMilestone = {
      id: `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date: newMilestone.date,
      description: newMilestone.description.trim(),
      goalTypeTargets: {}
    };

    setMilestones([...milestones, milestone]);
    setNewMilestone({ date: '', description: '' });
    setError('');
  };

  const handleRemoveMilestone = (milestoneId: string) => {
    setMilestones(milestones.filter(m => m.id !== milestoneId));
  };

  const handleMilestoneTargetChange = (milestoneId: string, goalTypeId: string, target: string) => {
    setMilestones(milestones.map(milestone => 
      milestone.id === milestoneId 
        ? {
            ...milestone,
            goalTypeTargets: {
              ...milestone.goalTypeTargets,
              [goalTypeId]: Number(target) || 0
            }
          }
        : milestone
    ));
  };

  const handleSave = () => {
    // Validation
    if (!name.trim()) {
      setError('Please enter a campaign name');
      return;
    }
    if (!startDate) {
      setError('Please select a start date');
      return;
    }
    if (!endDate) {
      setError('Please select an end date');
      return;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      setError('End date must be after start date');
      return;
    }
    if (goalTypes.length === 0) {
      setError('Please add at least one goal type');
      return;
    }

    // Save the campaign
    onSave({
      name: name.trim(),
      description: description.trim(),
      startDate,
      endDate,
      goalTypes,
      milestones: milestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      chapters: selectedChapters,
      parentCampaignId: parentCampaignId || undefined,
      relatedCampaignIds: relatedCampaignIds.length > 0 ? relatedCampaignIds : undefined,
      campaignType,
      sequenceOrder: sequenceOrder ? Number(sequenceOrder) : undefined
    });

    // Reset form
    setName('');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setGoalTypes([]);
    setMilestones([]);
    setNewGoalType({ name: '', description: '', totalTarget: '', unit: '', dataSource: 'manual', level: 'organization' });
    setNewMilestone({ date: '', description: '' });
    setError('');
    onClose();
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CampaignIcon color="primary" />
          <Typography variant="h6">{editingCampaign ? 'Edit Campaign' : 'Create Parent Campaign'}</Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}

          {/* Basic Information */}
          <Box>
            <Typography variant="h6" gutterBottom>Basic Information</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Campaign Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., The Pledge Drive 2024"
                fullWidth
                required
              />
              <TextField
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the overall campaign goals and purpose"
                fullWidth
                multiline
                rows={2}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Start Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="End Date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
              
              {/* Chapter Selection */}
              <Autocomplete
                multiple
                options={['All Chapters', ...availableChapters.filter(c => c !== 'All Chapters')]}
                value={selectedChapters}
                onChange={(event, newValue) => {
                  if (newValue.length === 0) {
                    // If nothing selected, default to "All Chapters"
                    setSelectedChapters(['All Chapters']);
                  } else if (newValue.includes('All Chapters') && !selectedChapters.includes('All Chapters')) {
                    // "All Chapters" was just added, so select only it
                    setSelectedChapters(['All Chapters']);
                  } else if (newValue.includes('All Chapters') && selectedChapters.includes('All Chapters') && newValue.length > 1) {
                    // "All Chapters" was already selected, user is adding specific chapters, so remove "All Chapters"
                    setSelectedChapters(newValue.filter(v => v !== 'All Chapters'));
                  } else {
                    // Normal selection
                    setSelectedChapters(newValue);
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Chapters"
                    placeholder="Select chapters or All Chapters"
                    helperText="Select which chapters this campaign applies to"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    return (
                      <Chip
                        key={key}
                        label={option}
                        {...tagProps}
                        color={option === 'All Chapters' ? 'error' : 'primary'}
                        size="small"
                      />
                    );
                  })
                }
              />
            </Box>
          </Box>

          <Divider />

          {/* Campaign Relationships */}
          <Box>
            <Typography variant="h6" gutterBottom>Campaign Relationships (Optional)</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Link this campaign to other campaigns or organize them in a hierarchy
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Campaign Type</InputLabel>
                <Select
                  value={campaignType}
                  onChange={(e) => setCampaignType(e.target.value as any)}
                  label="Campaign Type"
                >
                  <MenuItem value="standalone">Standalone - Independent campaign</MenuItem>
                  <MenuItem value="parent">Parent - Has sub-campaigns</MenuItem>
                  <MenuItem value="child">Child - Part of a larger campaign</MenuItem>
                  <MenuItem value="phase">Phase - Sequential campaign phase</MenuItem>
                </Select>
              </FormControl>

              {campaignType === 'child' && (
                <FormControl fullWidth>
                  <InputLabel>Parent Campaign</InputLabel>
                  <Select
                    value={parentCampaignId}
                    onChange={(e) => setParentCampaignId(e.target.value as string)}
                    label="Parent Campaign"
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {allCampaigns
                      .filter(c => c.id !== editingCampaign?.id && c.campaignType !== 'child')
                      .map((campaign) => (
                        <MenuItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              )}

              <Autocomplete
                multiple
                options={allCampaigns.filter(c => c.id !== editingCampaign?.id)}
                getOptionLabel={(option) => option.name}
                value={allCampaigns.filter(c => relatedCampaignIds.includes(c.id))}
                onChange={(_, newValue) => {
                  setRelatedCampaignIds(newValue.map(c => c.id));
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Related Campaigns"
                    placeholder="Select related campaigns"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={option.name}
                      {...getTagProps({ index })}
                      size="small"
                    />
                  ))
                }
              />

              {campaignType === 'phase' && (
                <TextField
                  label="Sequence Order"
                  type="number"
                  value={sequenceOrder}
                  onChange={(e) => setSequenceOrder(e.target.value)}
                  placeholder="e.g., 1 for first phase, 2 for second"
                  fullWidth
                  helperText="Order in the campaign sequence (1, 2, 3...)"
                />
              )}
            </Box>
          </Box>

          <Divider />

          {/* Goal Types */}
          <Box>
            <Typography variant="h6" gutterBottom>Goal Types</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Define the types of goals for this campaign (e.g., Pledges, Team Members)
            </Typography>
            
            {/* Add Goal Type Form */}
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>Add Goal Type</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="Goal Type Name"
                      value={newGoalType.name}
                      onChange={(e) => setNewGoalType({ ...newGoalType, name: e.target.value })}
                      placeholder="e.g., Pledges"
                      size="small"
                      fullWidth
                      sx={{ flex: 2 }}
                    />
                    <TextField
                      label="Total Target"
                      type="number"
                      value={newGoalType.totalTarget}
                      onChange={(e) => setNewGoalType({ ...newGoalType, totalTarget: e.target.value })}
                      placeholder="e.g., 1000"
                      size="small"
                      fullWidth
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Unit"
                      value={newGoalType.unit}
                      onChange={(e) => setNewGoalType({ ...newGoalType, unit: e.target.value })}
                      placeholder="e.g., pledges"
                      size="small"
                      fullWidth
                      sx={{ flex: 1 }}
                    />
                  </Box>
                  <TextField
                    label="Description (optional)"
                    value={newGoalType.description}
                    onChange={(e) => setNewGoalType({ ...newGoalType, description: e.target.value })}
                    placeholder="Describe this goal type"
                    size="small"
                    fullWidth
                  />
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>Data source</InputLabel>
                      <Select
                        value={newGoalType.dataSource ?? 'manual'}
                        label="Data source"
                        onChange={(e) => setNewGoalType({ ...newGoalType, dataSource: e.target.value as GoalDataSource })}
                      >
                        <MenuItem value="manual">Manual (campaign actions only)</MenuItem>
                        <MenuItem value="pledges">Pledges</MenuItem>
                        <MenuItem value="meetings_membership">Meetings: Membership One-on-One</MenuItem>
                        <MenuItem value="meetings_leadership">Meetings: Leadership One-on-One</MenuItem>
                        <MenuItem value="team_conversations">Team conversations</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <InputLabel>Goal level</InputLabel>
                      <Select
                        value={newGoalType.level ?? 'organization'}
                        label="Goal level"
                        onChange={(e) => setNewGoalType({ ...newGoalType, level: e.target.value as GoalLevel })}
                      >
                        <MenuItem value="individual">Individual</MenuItem>
                        <MenuItem value="team">Team</MenuItem>
                        <MenuItem value="organization">Organization</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={handleAddGoalType}
                    size="small"
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    Add Goal Type
                  </Button>
                </Box>
              </CardContent>
            </Card>

            {/* Existing Goal Types */}
            {goalTypes.map((goalType) => (
              <Box key={goalType.id} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip
                    label={`${goalType.name}: ${goalType.totalTarget} ${goalType.unit}`}
                    onDelete={() => handleRemoveGoalType(goalType.id)}
                    deleteIcon={<DeleteIcon />}
                    color="primary"
                    variant="outlined"
                  />
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => handleStartEditingChapterGoals(goalType.id)}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    {goalType.chapterGoals && Object.keys(goalType.chapterGoals).length > 0 
                      ? '✏️ Edit Chapter Goals' 
                      : '+ Add Chapter Goals'}
                  </Button>
                </Box>
                
                {/* Show existing chapter goals */}
                {goalType.chapterGoals && Object.keys(goalType.chapterGoals).length > 0 && (
                  <Box sx={{ ml: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {Object.entries(goalType.chapterGoals).map(([chapter, target]) => (
                      <Chip
                        key={chapter}
                        label={`${chapter}: ${target}`}
                        size="small"
                        onDelete={() => handleRemoveChapterGoal(goalType.id, chapter)}
                        sx={{ fontSize: '0.7rem' }}
                      />
                    ))}
                  </Box>
                )}
                
                {/* Chapter goals editing form */}
                {editingChapterGoals === goalType.id && (
                  <Card variant="outlined" sx={{ ml: 2, mt: 1, p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Set Chapter Goals for {goalType.name}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {availableChapters.filter(ch => ch !== 'All Chapters').map((chapter) => (
                        <Box key={chapter} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ minWidth: '150px', fontSize: '0.875rem' }}>
                            {chapter}:
                          </Typography>
                          <TextField
                            type="number"
                            size="small"
                            placeholder="Target"
                            value={chapterGoalInputs[chapter] || goalType.chapterGoals?.[chapter] || ''}
                            onChange={(e) => setChapterGoalInputs({ 
                              ...chapterGoalInputs, 
                              [chapter]: e.target.value 
                            })}
                            sx={{ width: '120px' }}
                            inputProps={{ min: 0 }}
                          />
                        </Box>
                      ))}
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Button 
                          size="small" 
                          variant="contained" 
                          onClick={handleSaveChapterGoals}
                        >
                          Save
                        </Button>
                        <Button 
                          size="small" 
                          variant="outlined" 
                          onClick={() => {
                            setEditingChapterGoals(null);
                            setChapterGoalInputs({});
                          }}
                        >
                          Cancel
                        </Button>
                      </Box>
                    </Box>
                  </Card>
                )}
              </Box>
            ))}
          </Box>

          <Divider />

          {/* Milestones */}
          <Box>
            <Typography variant="h6" gutterBottom>Milestones (Optional)</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Set intermediate checkpoints with specific targets for each goal type
            </Typography>
            
            {/* Add Milestone Form */}
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>Add Milestone</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="Milestone Date"
                      type="date"
                      value={newMilestone.date}
                      onChange={(e) => setNewMilestone({ ...newMilestone, date: e.target.value })}
                      size="small"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      label="Description"
                      value={newMilestone.description}
                      onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
                      placeholder="e.g., Q1 Checkpoint"
                      size="small"
                      fullWidth
                    />
                  </Box>
                  <Box>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={handleAddMilestone}
                      size="small"
                      disabled={goalTypes.length === 0}
                    >
                      Add Milestone
                    </Button>
                    {goalTypes.length === 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        Add goal types first
                      </Typography>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Existing Milestones */}
            {milestones.map((milestone) => (
              <Card key={milestone.id} variant="outlined" sx={{ mb: 1 }}>
                <CardContent sx={{ py: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2">
                      {milestone.description} - {new Date(milestone.date).toLocaleDateString()}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveMilestone(milestone.id)}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {goalTypes.map((goalType) => (
                      <TextField
                        key={goalType.id}
                        label={`${goalType.name} Target`}
                        type="number"
                        value={milestone.goalTypeTargets[goalType.id] || ''}
                        onChange={(e) => handleMilestoneTargetChange(milestone.id, goalType.id, e.target.value)}
                        placeholder={`Target ${goalType.unit}`}
                        size="small"
                        sx={{ flex: '1 1 200px', minWidth: '150px' }}
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name.trim() || !startDate || !endDate || goalTypes.length === 0}
        >
          Create Campaign
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ParentCampaignDialog;
