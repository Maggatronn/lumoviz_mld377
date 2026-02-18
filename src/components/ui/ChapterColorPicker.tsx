import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Popover,
  Typography,
  Button,
  Tooltip
} from '@mui/material';
import {
  Palette as PaletteIcon,
  Refresh as ResetIcon
} from '@mui/icons-material';

interface ChapterColorPickerProps {
  chapterName: string;
  currentColor: string;
  onColorChange: (color: string) => void;
  onReset: () => void;
}

// Predefined color palette
const colorPalette = [
  '#dc2626', // red
  '#2563eb', // blue
  '#7c3aed', // violet
  '#ea580c', // orange
  '#059669', // emerald
  '#be185d', // pink
  '#0891b2', // cyan
  '#7c2d12', // brown
  '#6b7280', // gray
  '#1f2937', // dark gray
  '#f59e0b', // amber
  '#10b981', // green
  '#8b5cf6', // purple
  '#ef4444', // red-500
  '#3b82f6', // blue-500
  '#06b6d4', // sky
];

const ChapterColorPicker: React.FC<ChapterColorPickerProps> = ({
  chapterName,
  currentColor,
  onColorChange,
  onReset
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleColorSelect = (color: string) => {
    onColorChange(color);
    handleClose();
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <Tooltip title="Change chapter color">
        <IconButton
          size="small"
          onClick={handleClick}
          sx={{
            color: currentColor,
            '&:hover': {
              backgroundColor: `${currentColor}22`
            }
          }}
        >
          <PaletteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        <Box sx={{ p: 2, maxWidth: 240 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
            Choose color for {chapterName}
          </Typography>
          
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: 1, 
            mb: 2 
          }}>
            {colorPalette.map((color) => (
              <Box
                key={color}
                onClick={() => handleColorSelect(color)}
                sx={{
                  width: 32,
                  height: 32,
                  backgroundColor: color,
                  borderRadius: 1,
                  cursor: 'pointer',
                  border: currentColor === color ? '3px solid #000' : '1px solid #ddd',
                  '&:hover': {
                    transform: 'scale(1.1)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                  },
                  transition: 'all 0.2s ease'
                }}
              />
            ))}
          </Box>
          
          <Button
            size="small"
            startIcon={<ResetIcon />}
            onClick={() => {
              onReset();
              handleClose();
            }}
            sx={{ width: '100%' }}
          >
            Reset to Default
          </Button>
        </Box>
      </Popover>
    </>
  );
};

export default ChapterColorPicker;
