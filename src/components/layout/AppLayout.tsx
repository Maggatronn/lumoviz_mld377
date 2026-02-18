import React, { useState, useEffect, useCallback } from 'react';
import { Box, IconButton } from '@mui/material';

interface AppLayoutProps {
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
  showRightPanel?: boolean;
}

const AppLayout: React.FC<AppLayoutProps> = ({ 
  leftContent, 
  rightContent, 
  showRightPanel = true 
}) => {
  const [notesPanelWidth, setNotesPanelWidth] = useState(window.innerWidth * 0.5);
  const [isNotesPanelCollapsed, setIsNotesPanelCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [width, setWidth] = useState(window.innerWidth);
  const [height, setHeight] = useState(window.innerHeight);

  // Handle window resize to maintain panel proportions and canvas size
  useEffect(() => {
    const handleWindowResize = () => {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const minWidth = screenWidth * 0.15; // Minimum 15% of screen
      const maxWidth = screenWidth * 0.85; // Maximum 85% of screen
      
      setWidth(screenWidth);
      setHeight(screenHeight);

      // Enforce 15%-85% bounds on resize
      if (notesPanelWidth > maxWidth) {
        setNotesPanelWidth(maxWidth);
      } else if (notesPanelWidth < minWidth) {
        setNotesPanelWidth(minWidth);
      }
      // Ensure panel is never collapsed
      if (isNotesPanelCollapsed) {
        setIsNotesPanelCollapsed(false);
      }
    };
    
    handleWindowResize();
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [notesPanelWidth, isNotesPanelCollapsed]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        toggleNotesPanelCollapse();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (showRightPanel) {
      setIsResizing(true);
      e.preventDefault();
    }
  };

  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing && showRightPanel) {
      const newWidth = window.innerWidth - e.clientX;
      const screenWidth = window.innerWidth;
      const percentageWidth = (newWidth / screenWidth) * 100;

      // Minimum width is 15% of screen, maximum is 85%
      const minWidth = screenWidth * 0.15;
      const maxWidth = screenWidth * 0.85;

      if (percentageWidth >= 85) { // Cap at 85% to leave space for left panel
        setNotesPanelWidth(maxWidth);
        setIsNotesPanelCollapsed(false);
      } else {
        // Normal resize - enforce minimum 15% width (never fully collapse)
        const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        setNotesPanelWidth(constrainedWidth);
        setIsNotesPanelCollapsed(false);
      }
    }
  }, [isResizing, showRightPanel]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleResizeMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleResizeMouseMove, handleMouseUp]);

  const toggleNotesPanelCollapse = () => {
    const screenWidth = window.innerWidth;
    const minWidth = screenWidth * 0.15;
    const defaultWidth = screenWidth * 0.35; // 35% when expanding
    
    if (notesPanelWidth <= minWidth * 1.1) {
      // If at or near minimum, expand to default size
      setNotesPanelWidth(defaultWidth);
    } else {
      // Otherwise, shrink to minimum (15%)
      setNotesPanelWidth(minWidth);
    }
    setIsNotesPanelCollapsed(false);
  };

  const handleResizeDoubleClick = () => {
    if (showRightPanel) {
      const screenWidth = window.innerWidth;
      const minWidth = screenWidth * 0.15;
      
      if (notesPanelWidth >= screenWidth * 0.8) {
        setNotesPanelWidth(window.innerWidth * 0.5); // Reset to 50%
      } else {
        setNotesPanelWidth(window.innerWidth - 12); // Leave margin for handle
      }
    }
  };

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Main Content (Left Panel) */}
      <Box sx={{ 
        width: showRightPanel && !isNotesPanelCollapsed 
          ? `calc(100% - ${notesPanelWidth}px)` 
          : showRightPanel && isNotesPanelCollapsed 
            ? 'calc(100% - 40px)' 
            : '100%',
        height: '100%',
        position: 'relative',
        transition: showRightPanel ? 'width 0.2s ease' : 'none' // Only animate when panel is shown
      }}>
        {leftContent}
      </Box>

      {/* Resize overlay */}
      {isResizing && showRightPanel && (
        <Box sx={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          bgcolor: 'rgba(0, 0, 0, 0.1)', 
          zIndex: 999, 
          cursor: 'col-resize', 
          userSelect: 'none' 
        }} />
      )}

      {/* Resize handle - always show when panel is visible, even at full screen */}
      {showRightPanel && !isNotesPanelCollapsed && (
        <Box
          onMouseDown={handleMouseDown}
          onDoubleClick={handleResizeDoubleClick}
          title="Drag to resize panel (double-click to toggle full screen)"
          sx={{
            position: 'absolute',
            top: 0,
            right: notesPanelWidth >= window.innerWidth - 50 ? 6 : notesPanelWidth - 6, // When near full width, position at screen edge
            width: '6px',
            height: '100%',
            cursor: 'col-resize',
            zIndex: 1001,
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.1)'
            },
            '&:before': {
              content: '""',
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translateY(-50%) translateX(-50%)',
              width: '2px',
              height: '40px',
              backgroundColor: '#ccc',
              borderRadius: '1px'
            }
          }}
        />
      )}

      {/* Right Panel */}
      {showRightPanel && !isNotesPanelCollapsed && (
        <Box sx={{ 
          position: 'absolute', 
          top: 0, 
          right: 0, 
          height: '100%', 
          width: `${notesPanelWidth}px`, 
          zIndex: 1000, 
          pointerEvents: 'auto' 
        }}>
          {rightContent}
        </Box>
      )}

      {/* Collapsed panel indicator - both clickable and draggable */}
      {showRightPanel && isNotesPanelCollapsed && (
        <Box 
          sx={{ 
            position: 'absolute', 
            top: 0, 
            right: 0, 
            width: '40px', 
            height: '100%', 
            zIndex: 1000,
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            borderLeft: '1px solid #ddd',
            cursor: 'col-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.1)'
            }
          }} 
          onClick={toggleNotesPanelCollapse}
          onMouseDown={handleMouseDown}
          title="Click to expand panel or drag to resize (Ctrl/Cmd + \ keyboard shortcut)"
        >
          <Box sx={{
            writing: 'vertical-lr',
            textOrientation: 'mixed',
            fontSize: '12px',
            color: '#666',
            fontWeight: 'bold',
            transform: 'rotate(180deg)',
            pointerEvents: 'none' // Prevent text from interfering with drag
          }}>
            Panel
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default AppLayout;
