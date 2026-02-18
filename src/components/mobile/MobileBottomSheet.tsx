import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  useTheme,
  Slide,
  Backdrop
} from '@mui/material';
import {
  Close as CloseIcon,
  DragHandle as DragHandleIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

interface MobileBottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxHeight?: string;
  isCollapsed?: boolean;
}

const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  open,
  onClose,
  title,
  children,
  maxHeight = '80vh',
  isCollapsed = false
}) => {
  const theme = useTheme();
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [currentHeight, setCurrentHeight] = useState(isCollapsed ? '60px' : '90vh');
  const sheetRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStart === null) return;
    
    const currentY = e.touches[0].clientY;
    const deltaY = dragStart - currentY;
    const windowHeight = window.innerHeight;
    
    // Calculate new height based on drag
    const baseHeight = isCollapsed ? 60 : windowHeight * 0.9;
    const newHeight = Math.min(Math.max(baseHeight + deltaY, 60), windowHeight * 0.9);
    
    setCurrentHeight(`${newHeight}px`);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStart === null) return;
    
    const currentY = e.changedTouches[0].clientY;
    const deltaY = dragStart - currentY;
    
    // Two-state system: collapsed (60px) or expanded (90vh)
    if (deltaY > 50) {
      // Dragged up - expand
      if (isCollapsed) {
        setCurrentHeight('90vh');
        onClose(); // Toggle to expanded state
      }
    } else if (deltaY < -50) {
      // Dragged down - collapse
      if (!isCollapsed) {
        setCurrentHeight('60px');
        onClose(); // Toggle to collapsed state
      }
    } else {
      // Small drag - snap back to current state
      setCurrentHeight(isCollapsed ? '60px' : '90vh');
    }
    
    setDragStart(null);
  };

  const toggleExpand = () => {
    if (isCollapsed) {
      // If collapsed, expand to full
      setCurrentHeight('90vh');
      onClose(); // Toggle to expanded state
    } else {
      // If expanded, collapse
      setCurrentHeight('60px');
      onClose(); // Toggle to collapsed state
    }
  };

  useEffect(() => {
    if (isCollapsed) {
      setCurrentHeight('60px');
    } else if (open) {
      setCurrentHeight('90vh');
    }
  }, [open, isCollapsed]);

  return (
    <>
      {/* Only show backdrop when not collapsed */}
      {!isCollapsed && (
        <Backdrop
          open={open && !isCollapsed}
          onClick={onClose}
          sx={{
            zIndex: theme.zIndex.drawer - 1,
            backgroundColor: 'rgba(0, 0, 0, 0.3)'
          }}
        />
      )}
      
      {/* Always show the sheet on mobile */}
      <Slide direction="up" in={true} mountOnEnter unmountOnExit>
        <Paper
          ref={sheetRef}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: currentHeight,
            zIndex: theme.zIndex.drawer,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            display: 'flex',
            flexDirection: 'column',
            transition: 'height 0.3s ease',
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
            overflow: 'hidden'
          }}
        >
          {/* Drag Handle Area */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: isCollapsed ? 1 : 2,
              borderBottom: isCollapsed ? 'none' : '1px solid',
              borderColor: 'divider',
              backgroundColor: theme.palette.background.paper,
              cursor: 'pointer',
              minHeight: isCollapsed ? '60px' : 'auto'
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={isCollapsed ? toggleExpand : undefined}
          >
            {/* When collapsed, show minimal UI */}
            {isCollapsed ? (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                width: '100%',
                gap: 2
              }}>
                <Box sx={{
                  width: 40,
                  height: 4,
                  backgroundColor: theme.palette.divider,
                  borderRadius: 2
                }} />
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                  {title}
                </Typography>
                <ExpandLessIcon sx={{ color: 'text.secondary' }} />
              </Box>
            ) : (
              <>
                {/* Center - Drag handle and title */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  flex: 1,
                  justifyContent: 'center'
                }}>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    gap: 1
                  }}>
                    <Box sx={{
                      width: 40,
                      height: 4,
                      backgroundColor: theme.palette.divider,
                      borderRadius: 2
                    }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {title}
                    </Typography>
                  </Box>
                </Box>

                {/* Right side - Close button */}
                <IconButton
                  onClick={toggleExpand}
                  size="small"
                  sx={{ ml: 1 }}
                >
                  <CloseIcon />
                </IconButton>
              </>
            )}
          </Box>

          {/* Content Area - Hidden when collapsed */}
          {!isCollapsed && (
            <Box sx={{ 
              flex: 1, 
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {children}
            </Box>
          )}
        </Paper>
      </Slide>
    </>
  );
};

export default MobileBottomSheet;
