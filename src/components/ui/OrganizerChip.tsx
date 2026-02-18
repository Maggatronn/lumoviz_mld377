import React, { useState } from 'react';
import {
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import EditIcon from '@mui/icons-material/Edit';
import InfoIcon from '@mui/icons-material/Info';
import { OrganizerMapping } from '../../services/organizerMappingService';

interface OrganizerChipProps {
  name: string;
  vanId?: string;
  onFilterBy?: (name: string, vanId?: string) => void;
  onEditMapping?: (name: string, vanId?: string) => void;
  onViewDetails?: (name: string, vanId?: string) => void;
  size?: 'small' | 'medium';
  sx?: any;
  color?: any;
  variant?: 'filled' | 'outlined';
  showMenu?: boolean; // Whether to show the Filter/Edit/Details menu
  teamRole?: string; // Team role (displayed separately, not in chip)
}

/**
 * A chip component for organizer names with optional Filter/Edit menu
 */
export const OrganizerChip: React.FC<OrganizerChipProps> = ({
  name,
  vanId,
  onFilterBy,
  onEditMapping,
  onViewDetails,
  size = 'small',
  sx = {},
  color,
  variant = 'filled',
  showMenu = true
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation(); // Prevent triggering parent row clicks
    if (showMenu && (onFilterBy || onEditMapping || onViewDetails)) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleFilterBy = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering parent row clicks
    if (onFilterBy) {
      onFilterBy(name, vanId);
    }
    handleClose();
  };

  const handleEdit = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering parent row clicks
    if (onEditMapping) {
      onEditMapping(name, vanId);
    }
    handleClose();
  };

  const handleViewDetails = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering parent row clicks
    if (onViewDetails) {
      onViewDetails(name, vanId);
    }
    handleClose();
  };

  const chipElement = (
    <Chip
      label={name}
      size={size}
      color={color}
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

  return (
    <>
      {showMenu && (onFilterBy || onEditMapping || onViewDetails) ? (
        <Tooltip title="Click for options">
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
            <ListItemText>View conversation details</ListItemText>
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
            <ListItemText>Edit mapping...</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
};
