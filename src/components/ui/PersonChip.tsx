import React, { useState } from 'react';
import {
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Box
} from '@mui/material';
import {
  FilterList as FilterListIcon,
  Edit as EditIcon,
  Info as InfoIcon,
  WarningAmber as WarningIcon
} from '@mui/icons-material';
import { OrganizerMapping } from '../../services/organizerMappingService';

interface PersonChipProps {
  name: string;
  vanId?: string;
  onFilterBy?: (name: string, vanId?: string) => void;
  onEditMapping?: (name: string, vanId?: string) => void;
  onViewDetails?: (name: string, vanId?: string) => void;
  size?: 'small' | 'medium';
  sx?: any;
  color?: any;
  variant?: 'filled' | 'outlined';
  showMenu?: boolean;
  // Person mapping specific props
  allMappings?: OrganizerMapping[];
}

/**
 * A chip component for person names with optional Filter/Edit menu
 * Shows a warning icon if person is not in VAN (has temp ID or is pending)
 */
export const PersonChip: React.FC<PersonChipProps> = ({
  name,
  vanId,
  onFilterBy,
  onEditMapping,
  onViewDetails,
  size = 'small',
  sx = {},
  color,
  variant = 'filled',
  showMenu = true,
  allMappings = []
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  // Check if person is pending (not in VAN yet)
  const isPending = vanId?.startsWith('pending_') || false;
  const mapping = allMappings.find(m => 
    m.primary_vanid === vanId || 
    m.preferred_name.toLowerCase() === name.toLowerCase()
  );
  const isNotInVan = mapping && (
    (mapping as any).in_van === false || 
    (mapping as any).van_sync_status !== 'synced'
  );

  const showWarning = isPending || isNotInVan;

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (showMenu && (onFilterBy || onEditMapping || onViewDetails)) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleFilterBy = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onFilterBy) {
      onFilterBy(name, vanId);
    }
    handleClose();
  };

  const handleEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onEditMapping) {
      onEditMapping(name, vanId);
    }
    handleClose();
  };

  const handleViewDetails = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onViewDetails) {
      onViewDetails(name, vanId);
    }
    handleClose();
  };

  const chipLabel = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {name}
      {showWarning && (
        <WarningIcon 
          sx={{ 
            fontSize: size === 'small' ? '0.875rem' : '1rem',
            color: 'warning.main'
          }} 
        />
      )}
    </Box>
  );

  const chipElement = (
    <Chip
      label={chipLabel}
      size={size}
      color={color || (showWarning ? 'warning' : undefined)}
      variant={variant}
      onClick={handleClick}
      sx={{
        cursor: showMenu && (onFilterBy || onEditMapping || onViewDetails) ? 'pointer' : 'default',
        '&:hover': showMenu && (onFilterBy || onEditMapping || onViewDetails) ? {
          opacity: 0.8
        } : {},
        ...sx
      }}
    />
  );

  const tooltipTitle = showWarning 
    ? "Not in VAN - needs to be added"
    : showMenu && (onFilterBy || onEditMapping || onViewDetails)
    ? "Click for options"
    : "";

  return (
    <>
      {tooltipTitle ? (
        <Tooltip title={tooltipTitle}>
          {chipElement}
        </Tooltip>
      ) : chipElement}

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        {onViewDetails && (
          <MenuItem onClick={handleViewDetails}>
            <ListItemIcon>
              <InfoIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>View details</ListItemText>
          </MenuItem>
        )}
        
        {onFilterBy && (
          <MenuItem onClick={handleFilterBy}>
            <ListItemIcon>
              <FilterListIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Filter by {name}</ListItemText>
          </MenuItem>
        )}
        
        {onEditMapping && (
          <MenuItem onClick={handleEdit}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              {showWarning ? 'Map to VAN ID...' : 'Edit mapping...'}
            </ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
};
