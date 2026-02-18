import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Typography, 
  Button, 
  Chip, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme
} from '@mui/material';
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns';
import { 
  CalendarToday as CalendarIcon,
  Today as TodayIcon,
  DateRange as DateRangeIcon
} from '@mui/icons-material';

interface DateRangePickerProps {
  availableDateRange: { min: Date; max: Date } | null;
  currentDateRange: { start: Date; end: Date } | null;
  onDateRangeChange: (startDate: Date, endDate: Date) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  availableDateRange,
  currentDateRange,
  onDateRangeChange
}) => {
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<string>(
    currentDateRange ? format(currentDateRange.start, 'yyyy-MM-dd') : ''
  );
  const [tempEndDate, setTempEndDate] = useState<string>(
    currentDateRange ? format(currentDateRange.end, 'yyyy-MM-dd') : ''
  );

  const handleDialogOpen = () => {
    // Reset temp values to current values when opening
    if (currentDateRange) {
      setTempStartDate(format(currentDateRange.start, 'yyyy-MM-dd'));
      setTempEndDate(format(currentDateRange.end, 'yyyy-MM-dd'));
    }
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
  };

  const handleApply = () => {
    if (tempStartDate && tempEndDate) {
      const startDate = new Date(tempStartDate);
      const endDate = new Date(tempEndDate);
      
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        onDateRangeChange(startDate, endDate);
        setDialogOpen(false);
      }
    }
  };

  const handlePresetClick = (preset: 'last7' | 'last30' | 'last90' | 'last3months' | 'thisYear' | 'allTime') => {
    const today = new Date();
    let startDate: Date;
    let endDate: Date = today;

    switch (preset) {
      case 'last7':
        startDate = startOfDay(subDays(today, 7));
        break;
      case 'last30':
        startDate = startOfDay(subDays(today, 30));
        break;
      case 'last90':
        startDate = startOfDay(subDays(today, 90));
        break;
      case 'last3months':
        startDate = startOfDay(subMonths(today, 3));
        break;
      case 'thisYear':
        startDate = new Date(2025, 0, 1); // January 1, 2025
        break;
      case 'allTime':
        startDate = availableDateRange?.min || new Date('2024-01-01');
        endDate = availableDateRange?.max || today;
        break;
      default:
        return;
    }

    setTempStartDate(formatDateForInput(startDate));
    setTempEndDate(formatDateForInput(endDate));
  };

  const handleReset = () => {
    if (currentDateRange) {
      setTempStartDate(format(currentDateRange.start, 'yyyy-MM-dd'));
      setTempEndDate(format(currentDateRange.end, 'yyyy-MM-dd'));
    }
  };

  const getPresetLabel = (preset: string) => {
    switch (preset) {
      case 'last7': return 'Last 7 Days';
      case 'last30': return 'Last 30 Days';
      case 'last90': return 'Last 90 Days';
      case 'last3months': return 'Last 3 Months';
      case 'thisYear': return 'This Year';
      case 'allTime': return 'All Time';
      default: return preset;
    }
  };

  const formatDateForInput = (date: Date) => {
    return format(date, 'yyyy-MM-dd');
  };

  const formatDateRange = () => {
    if (!currentDateRange) return 'Loading...';
    
    const startDate = currentDateRange.start.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
    const endDate = currentDateRange.end.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
    
    return `${startDate} - ${endDate}`;
  };

  const minDateStr = availableDateRange ? formatDateForInput(availableDateRange.min) : '2024-01-01';
  const maxDateStr = availableDateRange ? formatDateForInput(availableDateRange.max) : formatDateForInput(new Date());

  return (
    <>
      {/* Date Range Chip Button */}
      <Chip
        icon={<CalendarIcon />}
        label={formatDateRange()}
        onClick={handleDialogOpen}
        variant="outlined"
        sx={{ 
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: theme.palette.action.hover
          }
        }}
      />

      {/* Date Range Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleDialogClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            margin: 2
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          pb: 1
        }}>
          <DateRangeIcon color="primary" />
          <Typography variant="h6" component="span">
            Select Date Range
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          {/* Quick Presets */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 'bold' }}>
              QUICK SELECT
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: 1
            }}>
              {['last7', 'last30', 'last90', 'last3months', 'thisYear', 'allTime'].map((preset) => (
                <Chip
                  key={preset}
                  label={getPresetLabel(preset)}
                  onClick={() => handlePresetClick(preset as any)}
                  variant="outlined"
                  color="primary"
                  icon={preset === 'allTime' ? <CalendarIcon /> : <TodayIcon />}
                  sx={{
                    '&:hover': {
                      backgroundColor: theme.palette.primary.light,
                      color: 'white'
                    }
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Custom Date Selection */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 'bold' }}>
              CUSTOM RANGE
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Start Date"
                type="date"
                value={tempStartDate}
                onChange={(e) => setTempStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  min: minDateStr,
                  max: maxDateStr
                }}
                fullWidth
                variant="outlined"
              />
              
              <TextField
                label="End Date"
                type="date"
                value={tempEndDate}
                onChange={(e) => setTempEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  min: tempStartDate || minDateStr,
                  max: maxDateStr
                }}
                fullWidth
                variant="outlined"
              />
            </Box>
          </Box>

          {/* Current Selection Display */}
          {tempStartDate && tempEndDate && (
            <Box sx={{
              mt: 2,
              p: 2,
              bgcolor: theme.palette.grey[50],
              borderRadius: 1,
              border: `1px solid ${theme.palette.divider}`
            }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Selected Range:
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {new Date(tempStartDate).toLocaleDateString()} - {new Date(tempEndDate).toLocaleDateString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {Math.ceil((new Date(tempEndDate).getTime() - new Date(tempStartDate).getTime()) / (1000 * 60 * 60 * 24))} days
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={handleReset} color="inherit">
            Reset
          </Button>
          <Button onClick={handleDialogClose} color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={handleApply} 
            variant="contained" 
            disabled={!tempStartDate || !tempEndDate}
            sx={{ minWidth: 80 }}
          >
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DateRangePicker; 