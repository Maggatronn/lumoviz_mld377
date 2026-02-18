import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import MobileBottomSheet from '../mobile/MobileBottomSheet';
import { useMobile } from '../../hooks/useMobile';

interface RightPanelProps {
  isCollapsed: boolean;
  onToggle: () => void;
  panelWidth: number;
  title: string;
  children: React.ReactNode;
  navigationHeight?: number; // Height of top navigation
  onMouseDown?: (event: React.MouseEvent) => void;
  onDoubleClick?: () => void;
  isResizing?: boolean;
}

const RightPanel: React.FC<RightPanelProps> = ({
  isCollapsed,
  onToggle,
  panelWidth,
  title,
  children,
  navigationHeight = 64, // Default navigation height
  onMouseDown,
  onDoubleClick,
  isResizing = false
}) => {
  const isMobile = useMobile();

  // On mobile, always render as bottom sheet (never show desktop panel)
  if (isMobile) {
    return (
      <MobileBottomSheet
        open={true} // Always show the bottom sheet on mobile
        onClose={onToggle}
        title={title}
        isCollapsed={isCollapsed}
      >
        {children}
      </MobileBottomSheet>
    );
  }

  // Desktop render
  return (
    <>
      {/* Resize handle */}
      {!isCollapsed && onMouseDown && (
        <Box
          onMouseDown={onMouseDown}
          onDoubleClick={onDoubleClick}
          title="Drag to resize panel (double-click to toggle full screen)"
          sx={{
            position: 'absolute',
            top: navigationHeight,
            right: panelWidth - 6,
            width: '6px',
            height: `calc(100vh - ${navigationHeight}px)`,
            cursor: 'col-resize',
            bgcolor: isResizing ? 'primary.main' : 'divider',
            transition: 'background-color 0.2s',
            '&:hover': {
              bgcolor: 'primary.main',
              opacity: 0.8,
              width: '8px'
            },
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {/* Visual resize indicator */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              opacity: 0.6
            }}
          >
            {[1, 2, 3].map((i) => (
              <Box
                key={i}
                sx={{
                  width: '2px',
                  height: '2px',
                  bgcolor: 'background.paper',
                  borderRadius: '50%'
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Panel content */}
      {!isCollapsed && (
        <Box
          sx={{
            position: 'absolute',
            top: navigationHeight,
            right: 0,
            height: `calc(100vh - ${navigationHeight}px)`,
            width: `${panelWidth}px`,
            zIndex: 1000,
            pointerEvents: 'auto'
          }}
        >
          <Box sx={{ 
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            boxShadow: '-4px 0 8px rgba(0, 0, 0, 0.1)',
            bgcolor: 'background.paper'
          }}>
            {children}
          </Box>
        </Box>
      )}

      {/* Collapsed panel indicator */}
      {isCollapsed && (
        <Box
          sx={{
            position: 'absolute',
            top: navigationHeight,
            right: 0,
            width: '40px',
            height: `calc(100vh - ${navigationHeight}px)`,
            bgcolor: 'background.paper',
            borderLeft: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            zIndex: 1000,
            '&:hover': {
              bgcolor: 'action.hover',
              width: '50px'
            }
          }}
          onClick={onToggle}
          title={`Click to expand ${title} (Ctrl/Cmd + \\ keyboard shortcut)`}
        >
          <Box
            sx={{
              transform: 'rotate(-90deg)',
              color: 'text.secondary',
              fontSize: '12px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              mb: 1
            }}
          >
            {title}
          </Box>
          <Box
            sx={{
              fontSize: '18px',
              color: 'primary.main',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              bgcolor: 'action.hover',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: 'primary.light',
                transform: 'scale(1.1)'
              }
            }}
          >
            ▶
          </Box>
          <Box
            sx={{
              mt: 1,
              color: 'text.secondary',
              fontSize: '10px',
              transform: 'rotate(-90deg)',
              whiteSpace: 'nowrap',
              userSelect: 'none'
            }}
          >
            Ctrl+\
          </Box>
        </Box>
      )}
    </>
  );
};

export default RightPanel;
