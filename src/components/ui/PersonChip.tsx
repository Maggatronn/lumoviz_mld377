import React, { useState } from 'react';
import {
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip
} from '@mui/material';
import {
  FilterList as FilterListIcon,
  Info as InfoIcon
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

  const showWarning = false;

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (showMenu && (onFilterBy || onViewDetails)) {
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

  const handleViewDetails = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onViewDetails) {
      onViewDetails(name, vanId);
    }
    handleClose();
  };

  const chipLabel = name;

  const chipElement = (
    <Chip
      label={chipLabel}
      size={size}
      color={color}
      variant={variant}
      onClick={handleClick}
      sx={{
        cursor: showMenu && (onFilterBy || onViewDetails) ? 'pointer' : 'default',
        '&:hover': showMenu && (onFilterBy || onViewDetails) ? {
          opacity: 0.8
        } : {},
        ...sx
      }}
    />
  );

  const tooltipTitle = showMenu && (onFilterBy || onViewDetails)
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
      </Menu>
    </>
  );
};
