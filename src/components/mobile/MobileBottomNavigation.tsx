import React from 'react';
import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  useTheme
} from '@mui/material';
import {
  List as ListIcon,
  BarChart as ChartIcon,
  AccountTree as NetworkIcon
} from '@mui/icons-material';

export type MobileView = 'list' | 'visualization';

interface MobileBottomNavigationProps {
  currentView: MobileView;
  onViewChange: (view: MobileView) => void;
  currentVisualization: 'people' | 'teams' | 'goals' | 'campaign';
}

const MobileBottomNavigation: React.FC<MobileBottomNavigationProps> = ({
  currentView,
  onViewChange,
  currentVisualization
}) => {
  const theme = useTheme();

  const getVisualizationLabel = () => {
    switch (currentVisualization) {
      case 'people': return 'People';
      case 'teams': return 'Network';
      case 'goals': return 'Charts';
      case 'campaign': return 'Timeline';
      default: return 'Visualization';
    }
  };

  const getVisualizationIcon = () => {
    switch (currentVisualization) {
      case 'people': return <ChartIcon />;
      case 'teams': return <NetworkIcon />;
      case 'goals': return <ChartIcon />;
      case 'campaign': return <ChartIcon />;
      default: return <ChartIcon />;
    }
  };

  return (
    <Box sx={{ 
      position: 'fixed', 
      bottom: 0, 
      left: 0, 
      right: 0, 
      zIndex: 1000,
      backgroundColor: theme.palette.background.paper,
      borderTop: '1px solid',
      borderColor: 'divider',
      boxShadow: '0 -2px 8px rgba(0,0,0,0.1)'
    }}>
      <BottomNavigation
        value={currentView}
        onChange={(event, newValue) => {
          onViewChange(newValue as MobileView);
        }}
        sx={{
          '& .MuiBottomNavigationAction-root': {
            minWidth: 0,
            paddingTop: '6px'
          }
        }}
      >
        <BottomNavigationAction
          label="List View"
          value="list"
          icon={<ListIcon />}
        />
        <BottomNavigationAction
          label={getVisualizationLabel()}
          value="visualization"
          icon={getVisualizationIcon()}
        />
      </BottomNavigation>
    </Box>
  );
};

export default MobileBottomNavigation;

