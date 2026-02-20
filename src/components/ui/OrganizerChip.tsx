import React, { useState } from 'react';
import {
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Divider
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import InfoIcon from '@mui/icons-material/Info';
import DeleteIcon from '@mui/icons-material/Delete';

interface OrganizerChipProps {
  name: string;
  vanId?: string;
  contactVanId?: string;
  onFilterBy?: (name: string, vanId?: string) => void;
  onEditMapping?: (name: string, vanId?: string) => void;
  onViewDetails?: (name: string, vanId?: string) => void;
  onRemoveOrganizer?: (contactVanId: string, organizerVanId: string) => void;
  size?: 'small' | 'medium';
  sx?: any;
  color?: any;
  variant?: 'filled' | 'outlined';
  showMenu?: boolean;
  teamRole?: string;
}

export const OrganizerChip: React.FC<OrganizerChipProps> = ({
  name,
  vanId,
  contactVanId,
  onFilterBy,
  onEditMapping,
  onViewDetails,
  onRemoveOrganizer,
  size = 'small',
  sx = {},
  color,
  variant = 'filled',
  showMenu = true
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const hasMenu = showMenu && (onFilterBy || onViewDetails || onRemoveOrganizer);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (hasMenu) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleFilterBy = (event: React.MouseEvent) => {
    event.stopPropagation();
    onFilterBy?.(name, vanId);
    handleClose();
  };

  const handleViewDetails = (event: React.MouseEvent) => {
    event.stopPropagation();
    onViewDetails?.(name, vanId);
    handleClose();
  };

  const handleRemove = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onRemoveOrganizer && contactVanId && vanId) {
      onRemoveOrganizer(contactVanId, vanId);
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
        cursor: hasMenu ? 'pointer' : 'default',
        '&:hover': hasMenu ? { opacity: 0.8 } : {},
        ...sx
      }}
    />
  );

  return (
    <>
      {hasMenu ? (
        <Tooltip title="Click for options">
          {chipElement}
        </Tooltip>
      ) : chipElement}

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {onViewDetails && (
          <MenuItem onClick={handleViewDetails}>
            <ListItemIcon><InfoIcon fontSize="small" /></ListItemIcon>
            <ListItemText>View conversation details</ListItemText>
          </MenuItem>
        )}
        
        {onFilterBy && (
          <MenuItem onClick={handleFilterBy}>
            <ListItemIcon><FilterListIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Filter by {name}</ListItemText>
          </MenuItem>
        )}

        {onRemoveOrganizer && contactVanId && vanId && (
          <>
            <Divider />
            <MenuItem onClick={handleRemove} sx={{ color: 'error.main' }}>
              <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
              <ListItemText>Remove organizer</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
};
