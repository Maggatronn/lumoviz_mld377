import React, { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  useTheme,
  Chip
} from '@mui/material';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  AccountTree as SnowflakeIcon,
  Chat as ConversationsIcon,
  Campaign as CampaignIcon,
  CalendarToday as CalendarIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';

interface MobileNavigationProps {
  currentVisualization: 'people' | 'teams' | 'campaign';
  onVisualizationChange: (viz: 'people' | 'teams' | 'campaign') => void;
  selectedChapter: string;
  chapters: string[];
  onChapterChange: (chapter: string) => void;
  currentDateRange: { start: Date; end: Date } | null;
  onDateRangeClick: () => void;
  onFilterClick?: () => void;
  children?: React.ReactNode;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({
  currentVisualization,
  onVisualizationChange,
  selectedChapter,
  chapters,
  onChapterChange,
  currentDateRange,
  onDateRangeClick,
  onFilterClick,
  children
}) => {
  const theme = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleVisualizationChange = (viz: 'people' | 'teams' | 'campaign') => {
    onVisualizationChange(viz);
    setDrawerOpen(false);
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

  const getVisualizationTitle = () => {
    switch (currentVisualization) {
      case 'people': return 'People';
      case 'teams': return 'Teams';
      // case 'goals': return 'Conversations';
      case 'campaign': return 'Campaign';
      default: return 'LumoViz';
    }
  };

  const getVisualizationIcon = () => {
    switch (currentVisualization) {
      case 'people': return <SnowflakeIcon />;
      case 'teams': return <SnowflakeIcon />;
      // case 'goals': return <ConversationsIcon />;
      case 'campaign': return <CampaignIcon />;
      default: return <SnowflakeIcon />;
    }
  };

  return (
    <>
      {/* Mobile App Bar */}
      <AppBar 
        position="sticky" 
        elevation={1}
        sx={{ 
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Toolbar sx={{ minHeight: '56px !important', px: 2 }}>
          {/* Menu Button */}
          <IconButton
            edge="start"
            onClick={toggleDrawer}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>

          {/* Current View Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            {getVisualizationIcon()}
            <Typography variant="h6" sx={{ ml: 1, fontWeight: 'bold' }}>
              {getVisualizationTitle()}
            </Typography>
          </Box>

          {/* Date Range Chip */}
          <Chip
            icon={<CalendarIcon />}
            label={formatDateRange()}
            onClick={onDateRangeClick}
            size="small"
            variant="outlined"
            sx={{ mr: 1 }}
          />

          {/* Filter Button */}
          {onFilterClick && (
            <IconButton
              onClick={onFilterClick}
              size="small"
            >
              <FilterIcon />
            </IconButton>
          )}
        </Toolbar>

        {/* Chapter Filter Bar */}
        <Box sx={{ 
          px: 2, 
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundColor: theme.palette.grey[50]
        }}>
          <Box sx={{ 
            display: 'flex', 
            gap: 1, 
            overflowX: 'auto',
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none'
          }}>
            {chapters.map((chapter) => (
              <Chip
                key={chapter}
                label={chapter}
                onClick={() => onChapterChange(chapter)}
                variant={selectedChapter === chapter ? 'filled' : 'outlined'}
                color={selectedChapter === chapter ? 'primary' : 'default'}
                size="small"
                sx={{ 
                  minWidth: 'fit-content',
                  whiteSpace: 'nowrap'
                }}
              />
            ))}
          </Box>
        </Box>
      </AppBar>

      {/* Navigation Drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={toggleDrawer}
        sx={{
          '& .MuiDrawer-paper': {
            width: 280,
            boxSizing: 'border-box',
          }
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            LumoViz
          </Typography>
          <IconButton onClick={toggleDrawer}>
            <CloseIcon />
          </IconButton>
        </Box>

        <List sx={{ flex: 1 }}>
          {/* Visualization Options */}
          <ListItem>
            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 'bold' }}>
              VISUALIZATIONS
            </Typography>
          </ListItem>
          
          <ListItemButton
            // selected={currentVisualization === 'goals'}
            // onClick={() => handleVisualizationChange('goals')}
          >
            <ListItemIcon>
              {/* <ConversationsIcon color={currentVisualization === 'goals' ? 'primary' : 'inherit'} /> */}
            </ListItemIcon>
            <ListItemText primary="Conversations" secondary="Meeting analytics and summaries" />
          </ListItemButton>

          <ListItemButton
            selected={currentVisualization === 'people'}
            onClick={() => handleVisualizationChange('people')}
          >
            <ListItemIcon>
              <SnowflakeIcon color={currentVisualization === 'people' ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText primary="People" secondary="Individual profiles and connections" />
          </ListItemButton>

          <ListItemButton
            disabled
            title="Coming Soon"
            sx={{ 
              opacity: 0.5,
              cursor: 'not-allowed !important'
            }}
          >
            <ListItemIcon>
              <SnowflakeIcon color="disabled" />
            </ListItemIcon>
            <ListItemText 
              primary="Teams" 
              secondary="Coming Soon" 
              sx={{ 
                '& .MuiListItemText-primary': { color: 'text.disabled' },
                '& .MuiListItemText-secondary': { color: 'text.disabled' }
              }}
            />
          </ListItemButton>

          <ListItemButton
            selected={currentVisualization === 'campaign'}
            onClick={() => handleVisualizationChange('campaign')}
          >
            <ListItemIcon>
              <CampaignIcon color={currentVisualization === 'campaign' ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText 
              primary="Campaign" 
              secondary="Campaign timeline and actions"
            />
          </ListItemButton>

          <Divider sx={{ my: 2 }} />

          {/* Additional Navigation Items */}
          <ListItem>
            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 'bold' }}>
              FILTERS
            </Typography>
          </ListItem>

          <ListItemButton onClick={onDateRangeClick}>
            <ListItemIcon>
              <CalendarIcon />
            </ListItemIcon>
            <ListItemText 
              primary="Date Range" 
              secondary={formatDateRange()}
            />
          </ListItemButton>

          {/* Chapter Selection */}
          <ListItem>
            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 'bold' }}>
              CHAPTER: {selectedChapter}
            </Typography>
          </ListItem>
        </List>

        {/* Additional Content */}
        {children && (
          <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            {children}
          </Box>
        )}
      </Drawer>
    </>
  );
};

export default MobileNavigation;
