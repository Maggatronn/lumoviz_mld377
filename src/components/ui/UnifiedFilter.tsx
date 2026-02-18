import React, { useState } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Popover,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Chip,
  Divider,
  Button,
  Autocomplete
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { LOE_LEVELS, SPECIAL_LOE_COLORS } from '../../theme/loeColors';
import { type DynamicLOELevel } from '../../theme/dynamicLoeColors';
import { TERMS } from '../../config/appConfig';

export interface FilterState {
  searchText: string;
  chapter: string;
  organizer: string;
  loeStatus: string[];
  memberStatus: string[];
  lastContactFilter: 'all' | 'within_7_days' | 'within_30_days' | 'within_3_months' | 'over_30_days' | 'over_3_months' | 'over_6_months' | 'never';
  meetingCountFilter: 'all' | 'zero' | 'hasAny';
  actionStatus: 'all' | 'completed' | 'onList' | 'notOnList';
  teamType: string;
  goalType: string[];
  dateRange: { start: Date | null; end: Date | null };
}

interface UnifiedFilterProps {
  currentView: 'goals' | 'people' | 'teams' | 'campaign' | 'dashboard';
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  availableOptions: {
    chapters: string[];
    organizers: string[];
    teamTypes?: string[];
    goalTypes?: string[];
    loeLevels?: DynamicLOELevel[]; // Dynamic LOE levels from data
  };
  placeholder?: string;
}

const UnifiedFilter: React.FC<UnifiedFilterProps> = ({
  currentView,
  filters,
  onFiltersChange,
  availableOptions,
  placeholder = "Search..."
}) => {
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLButtonElement | null>(null);
  const filterOpen = Boolean(filterAnchorEl);

  const handleFilterClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
  };

  const handleSearchChange = (value: string) => {
    onFiltersChange({ searchText: value });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      searchText: '',
      chapter: '',
      organizer: '',
      loeStatus: [],
      memberStatus: [],
      lastContactFilter: 'all',
      meetingCountFilter: 'all',
      actionStatus: 'all',
      teamType: '',
      goalType: [],
      dateRange: { start: null, end: null }
    });
    handleFilterClose();
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.searchText) count++;
    if (filters.chapter) count++;
    if (filters.organizer) count++;
    if (filters.loeStatus.length > 0) count++;
    if (filters.memberStatus.length > 0) count++;
    if (filters.lastContactFilter !== 'all') count++;
    if (filters.meetingCountFilter !== 'all') count++;
    if (filters.actionStatus !== 'all') count++;
    if (filters.teamType) count++;
    if (filters.goalType.length > 0) count++;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    return count;
  };

  const renderFilterOptions = () => {
    switch (currentView) {
      case 'people':
        return (
          <>
            {/* Chapter/Section Filter */}
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>{TERMS.chapter}</InputLabel>
              <Select
                value={filters.chapter}
                onChange={(e) => onFiltersChange({ chapter: e.target.value })}
                label={TERMS.chapter}
              >
                <MenuItem value="">{`All ${TERMS.chapters}`}</MenuItem>
                {availableOptions.chapters.map((chapter) => (
                  <MenuItem key={chapter} value={chapter}>
                    {chapter}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Organizer Filter - Autocomplete with text input */}
            <Autocomplete
              freeSolo
              options={availableOptions.organizers}
              value={filters.organizer}
              onChange={(event, newValue) => {
                onFiltersChange({ organizer: newValue || '' });
              }}
              onInputChange={(event, newInputValue) => {
                onFiltersChange({ organizer: newInputValue });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Organizer"
                  size="small"
                  placeholder="Type or select..."
                />
              )}
              sx={{ mb: 2 }}
            />

            {/* LOE Status Filter - Dynamic from data */}
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              LOE Status
            </Typography>
            <Box sx={{ mb: 2 }}>
              {(availableOptions.loeLevels || []).map((loeLevel) => {
                return (
                  <FormControlLabel
                    key={loeLevel.rawValue}
                    control={
                      <Checkbox
                        checked={filters.loeStatus.includes(loeLevel.rawValue)}
                        onChange={(e) => {
                          const newLoeStatus = e.target.checked
                            ? [...filters.loeStatus, loeLevel.rawValue]
                            : filters.loeStatus.filter(s => s !== loeLevel.rawValue);
                          onFiltersChange({ loeStatus: newLoeStatus });
                        }}
                        size="small"
                        sx={{
                          color: loeLevel.color,
                          '&.Mui-checked': {
                            color: loeLevel.color,
                          }
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ color: loeLevel.color, fontWeight: 500 }}>
                          {loeLevel.label}
                        </Typography>
                        {loeLevel.level && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                            (Level {loeLevel.level})
                          </Typography>
                        )}
                      </Box>
                    }
                    sx={{ display: 'block', mb: 0.5 }}
                  />
                );
              })}
            </Box>

            {/* Action Status Filter */}
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Action Status</InputLabel>
              <Select
                value={filters.actionStatus}
                onChange={(e) => onFiltersChange({ actionStatus: e.target.value as any })}
                label="Action Status"
              >
                <MenuItem value="all">All People</MenuItem>
                <MenuItem value="completed">Completed Action</MenuItem>
                <MenuItem value="onList">On List (Not Completed)</MenuItem>
                <MenuItem value="notOnList">Not on Any List</MenuItem>
              </Select>
            </FormControl>

            {/* Membership Status Filter */}
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Membership Status
            </Typography>
            <Box sx={{ mb: 2 }}>
              {['Active', 'Lapsed', 'Former', 'Unknown'].map((status) => (
                <FormControlLabel
                  key={status}
                  control={
                    <Checkbox
                      checked={filters.memberStatus.includes(status)}
                      onChange={(e) => {
                        const newMemberStatus = e.target.checked
                          ? [...filters.memberStatus, status]
                          : filters.memberStatus.filter(s => s !== status);
                        onFiltersChange({ memberStatus: newMemberStatus });
                      }}
                      size="small"
                    />
                  }
                  label={status}
                  sx={{ display: 'block', mb: 0.5 }}
                />
              ))}
            </Box>

            {/* Last Contact Filter */}
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Last Contact</InputLabel>
              <Select
                value={filters.lastContactFilter}
                onChange={(e) => onFiltersChange({ lastContactFilter: e.target.value as any })}
                label="Last Contact"
              >
                <MenuItem value="all">Any Time</MenuItem>
                <MenuItem value="within_7_days">Within 7 Days</MenuItem>
                <MenuItem value="within_30_days">Within 30 Days</MenuItem>
                <MenuItem value="within_3_months">Within 3 Months</MenuItem>
                <MenuItem value="over_30_days">Over 30 Days</MenuItem>
                <MenuItem value="over_3_months">Over 3 Months</MenuItem>
                <MenuItem value="over_6_months">Over 6 Months</MenuItem>
                <MenuItem value="never">Never Contacted</MenuItem>
              </Select>
            </FormControl>
          </>
        );

      case 'teams':
        return (
          <>
            {/* Chapter/Section Filter */}
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>{TERMS.chapter}</InputLabel>
              <Select
                value={filters.chapter}
                onChange={(e) => onFiltersChange({ chapter: e.target.value })}
                label={TERMS.chapter}
              >
                <MenuItem value="">{`All ${TERMS.chapters}`}</MenuItem>
                {availableOptions.chapters.map((chapter) => (
                  <MenuItem key={chapter} value={chapter}>
                    {chapter}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Team Type Filter */}
            {availableOptions.teamTypes && (
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Team Type</InputLabel>
                <Select
                  value={filters.teamType}
                  onChange={(e) => onFiltersChange({ teamType: e.target.value })}
                  label="Team Type"
                >
                  <MenuItem value="">All Types</MenuItem>
                  {availableOptions.teamTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </>
        );

      case 'campaign':
        return (
          <>
            {/* Chapter/Section Filter */}
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>{TERMS.chapter}</InputLabel>
              <Select
                value={filters.chapter}
                onChange={(e) => onFiltersChange({ chapter: e.target.value })}
                label={TERMS.chapter}
              >
                <MenuItem value="">{`All ${TERMS.chapters}`}</MenuItem>
                {availableOptions.chapters.map((chapter) => (
                  <MenuItem key={chapter} value={chapter}>
                    {chapter}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Goal Type Filter */}
            {availableOptions.goalTypes && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Goal Types
                </Typography>
                <Box sx={{ mb: 2 }}>
                  {availableOptions.goalTypes.map((type) => (
                    <FormControlLabel
                      key={type}
                      control={
                        <Checkbox
                          checked={filters.goalType.includes(type)}
                          onChange={(e) => {
                            const newGoalTypes = e.target.checked
                              ? [...filters.goalType, type]
                              : filters.goalType.filter(t => t !== type);
                            onFiltersChange({ goalType: newGoalTypes });
                          }}
                          size="small"
                        />
                      }
                      label={type}
                      sx={{ display: 'block', mb: 0.5 }}
                    />
                  ))}
                </Box>
              </>
            )}
          </>
        );

      case 'goals':
        return (
          <>
            {/* Chapter/Section Filter */}
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>{TERMS.chapter}</InputLabel>
              <Select
                value={filters.chapter}
                onChange={(e) => onFiltersChange({ chapter: e.target.value })}
                label={TERMS.chapter}
              >
                <MenuItem value="">{`All ${TERMS.chapters}`}</MenuItem>
                {availableOptions.chapters.map((chapter) => (
                  <MenuItem key={chapter} value={chapter}>
                    {chapter}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Organizer Filter - Autocomplete with text input */}
            <Autocomplete
              freeSolo
              options={availableOptions.organizers}
              value={filters.organizer}
              onChange={(event, newValue) => {
                onFiltersChange({ organizer: newValue || '' });
              }}
              onInputChange={(event, newInputValue) => {
                onFiltersChange({ organizer: newInputValue });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Organizer"
                  size="small"
                  placeholder="Type or select..."
                />
              )}
              sx={{ mb: 2 }}
            />
          </>
        );

      default:
        return null;
    }
  };

  const getActiveFilterChips = () => {
    const chips: JSX.Element[] = [];

    if (filters.searchText) {
      chips.push(
        <Chip
          key="search"
          label={`Search: "${filters.searchText}"`}
          size="small"
          onClick={() => onFiltersChange({ searchText: '' })}
          onDelete={() => onFiltersChange({ searchText: '' })}
          deleteIcon={<CloseIcon />}
        />
      );
    }

    if (filters.chapter) {
      chips.push(
        <Chip
          key="chapter"
          label={`${TERMS.chapter}: ${filters.chapter}`}
          size="small"
          onClick={() => onFiltersChange({ chapter: '' })}
          onDelete={() => onFiltersChange({ chapter: '' })}
          deleteIcon={<CloseIcon />}
        />
      );
    }

    if (filters.organizer) {
      chips.push(
        <Chip
          key="organizer"
          label={`Organizer: ${filters.organizer}`}
          size="small"
          onClick={() => onFiltersChange({ organizer: '' })}
          onDelete={() => onFiltersChange({ organizer: '' })}
          deleteIcon={<CloseIcon />}
        />
      );
    }

    if (filters.loeStatus.length > 0) {
      filters.loeStatus.forEach((status) => {
        // Remove the number prefix for display (e.g., "1_TeamLeader" -> "TeamLeader")
        const displayStatus = status.replace(/^\d+[_.]/, '');
        const removeFilter = () => onFiltersChange({ 
          loeStatus: filters.loeStatus.filter(s => s !== status) 
        });
        chips.push(
          <Chip
            key={`loe-${status}`}
            label={`LOE: ${displayStatus}`}
            size="small"
            onClick={removeFilter}
            onDelete={removeFilter}
            deleteIcon={<CloseIcon />}
          />
        );
      });
    }

    if (filters.memberStatus.length > 0) {
      filters.memberStatus.forEach((status) => {
        const removeFilter = () => onFiltersChange({ 
          memberStatus: filters.memberStatus.filter(s => s !== status) 
        });
        chips.push(
          <Chip
            key={`member-${status}`}
            label={`Member: ${status}`}
            size="small"
            onClick={removeFilter}
            onDelete={removeFilter}
            deleteIcon={<CloseIcon />}
            color={status === 'Active' ? 'success' : status === 'Lapsed' ? 'warning' : 'default'}
          />
        );
      });
    }

    if (filters.lastContactFilter !== 'all') {
      const labels: Record<string, string> = {
        within_7_days: 'Last 7 days',
        within_30_days: 'Last 30 days',
        within_3_months: 'Last 3 months',
        over_30_days: 'Over 30 days',
        over_3_months: 'Over 3 months',
        over_6_months: 'Over 6 months',
        never: 'Never contacted'
      };
      chips.push(
        <Chip
          key="lastContact"
          label={labels[filters.lastContactFilter] || filters.lastContactFilter}
          size="small"
          onClick={() => onFiltersChange({ lastContactFilter: 'all' })}
          onDelete={() => onFiltersChange({ lastContactFilter: 'all' })}
          deleteIcon={<CloseIcon />}
        />
      );
    }

    if (filters.teamType) {
      chips.push(
        <Chip
          key="teamType"
          label={`Team: ${filters.teamType}`}
          size="small"
          onClick={() => onFiltersChange({ teamType: '' })}
          onDelete={() => onFiltersChange({ teamType: '' })}
          deleteIcon={<CloseIcon />}
        />
      );
    }

    if (filters.goalType.length > 0) {
      filters.goalType.forEach((type) => {
        const removeFilter = () => onFiltersChange({ 
          goalType: filters.goalType.filter(t => t !== type) 
        });
        chips.push(
          <Chip
            key={`goal-${type}`}
            label={`Goal: ${type}`}
            size="small"
            onClick={removeFilter}
            onDelete={removeFilter}
            deleteIcon={<CloseIcon />}
          />
        );
      });
    }

    return chips;
  };

  const activeFilterCount = getActiveFilterCount();
  const activeChips = getActiveFilterChips();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Single Row: Filter Chips → Filter Button → Search Bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {/* Active Filter Chips (leftmost) */}
        {activeChips.length > 0 && (
          <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 0.5,
            alignItems: 'center'
          }}>
            {activeChips}
          </Box>
        )}

        {/* Filter Button */}
        <IconButton
          onClick={handleFilterClick}
          size="small"
          sx={{
            backgroundColor: activeFilterCount > 0 ? 'primary.light' : 'transparent',
            color: activeFilterCount > 0 ? 'primary.main' : 'text.secondary',
            border: '1px solid',
            borderColor: activeFilterCount > 0 ? 'primary.main' : 'divider',
            '&:hover': {
              backgroundColor: 'primary.light',
              color: 'primary.main',
              borderColor: 'primary.main'
            }
          }}
        >
          <FilterIcon fontSize="small" />
          {activeFilterCount > 0 && (
            <Box
              sx={{
                position: 'absolute',
                top: -4,
                right: -4,
                backgroundColor: 'primary.main',
                color: 'white',
                borderRadius: '50%',
                width: 16,
                height: 16,
                fontSize: '0.7rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}
            >
              {activeFilterCount}
            </Box>
          )}
        </IconButton>

        {/* Search Bar (rightmost, takes remaining space) */}
        <TextField
          size="small"
          placeholder={placeholder}
          value={filters.searchText}
          onChange={(e) => handleSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: filters.searchText && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => handleSearchChange('')}
                  edge="end"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            minWidth: 200,
            flex: 1,
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#f8f9fa',
              '&:hover': { backgroundColor: '#e9ecef' },
              '&.Mui-focused': { backgroundColor: '#fff' }
            }
          }}
        />
      </Box>

      {/* Filter Popover */}
      <Popover
        open={filterOpen}
        anchorEl={filterAnchorEl}
        onClose={handleFilterClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Paper sx={{ p: 3, minWidth: 280, maxWidth: 320 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Filters
            </Typography>
            {activeFilterCount > 0 && (
              <Button
                size="small"
                onClick={clearAllFilters}
                sx={{ textTransform: 'none' }}
              >
                Clear All
              </Button>
            )}
          </Box>
          
          <Divider sx={{ mb: 2 }} />
          
          {renderFilterOptions()}
        </Paper>
      </Popover>
    </Box>
  );
};

export default UnifiedFilter;