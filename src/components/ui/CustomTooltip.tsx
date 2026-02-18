import React from 'react';

interface TooltipNodeData {
  name: string;
  leadershipStatus: string;
  supervisorOrOrganizer?: string;
  dateLastContacted?: string;
  nodeType: 'organizer' | 'organizee';
}

interface CustomTooltipProps {
  visible?: boolean;
  content?: string; // Keep for backward compatibility
  nodeData?: TooltipNodeData; // New structured data
  x?: number;
  y?: number;
  isStaffNode?: boolean;
  organizerLinkCounts?: { name: string; count: number }[];
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ 
  visible = false, 
  content = '', 
  nodeData,
  x = 0, 
  y = 0,
  isStaffNode = false,
  organizerLinkCounts = []
}) => {
  if (!visible) return null;
  
  // If we have structured node data, use the new format
  if (nodeData) {
    return (
      <div 
        style={{
          position: 'absolute',
          left: `${x + 15}px`,
          top: `${y + 15}px`,
          backgroundColor: nodeData.nodeType === 'organizer' ? 'rgba(31, 119, 180, 0.9)' : 'rgba(44, 160, 44, 0.9)',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '6px',
          fontSize: '14px',
          pointerEvents: 'none',
          zIndex: 1000,
          maxWidth: '320px',
          wordWrap: 'break-word',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          fontFamily: 'Arial, sans-serif',
          lineHeight: '1.4'
        }}
      >
        <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px', color: '#fff' }}>
          {nodeData.name}
        </div>
        
        <div style={{ marginBottom: '6px' }}>
          <strong>Status:</strong> {nodeData.leadershipStatus}
        </div>
        
        {nodeData.supervisorOrOrganizer && (
          <div style={{ marginBottom: '6px' }}>
            <strong>{nodeData.nodeType === 'organizer' ? 'Supervisor:' : 'Organizer:'}</strong> {nodeData.supervisorOrOrganizer}
          </div>
        )}
        
        <div style={{ marginBottom: '6px' }}>
          <strong>Last Contacted:</strong> {nodeData.dateLastContacted || 'Never'}
        </div>
        
        <div style={{ 
          marginTop: '10px', 
          fontSize: '12px', 
          fontStyle: 'italic', 
          opacity: 0.9,
          borderTop: '1px solid rgba(255, 255, 255, 0.3)',
          paddingTop: '8px'
        }}>
          (click to filter by this node)
        </div>
      </div>
    );
  }
  
  // Fallback to old format for backward compatibility
  const maxCount = Math.max(...organizerLinkCounts.map(item => item.count), 1);
  const contentLines = content.trim().split('\n');
  const name = contentLines[0]?.trim() || '';
  const uniqueLinksCount = contentLines[1]?.trim() || '';
  const connections = contentLines.slice(2).map(line => line.trim()).filter(line => line);
  
  return (
    <div 
      style={{
        position: 'absolute',
        left: `${x + 15}px`,
        top: `${y + 15}px`,
        backgroundColor: isStaffNode ? 'rgba(31, 119, 180, 0.9)' : 'rgba(44, 160, 44, 0.9)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '14px',
        pointerEvents: 'none',
        zIndex: 1000,
        maxWidth: '300px',
        wordWrap: 'break-word',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      {isStaffNode ? (
        // For blue nodes, use the pre-line formatting
        <div style={{ whiteSpace: 'pre-line' }}>{content}</div>
      ) : (
        // For green nodes, use more structured formatting
        <>
          <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{name}</div>
          <div>{uniqueLinksCount}</div>
          <div style={{ marginTop: '4px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Connections:</div>
            {connections.map((connection, index) => (
              <div key={index} style={{ marginLeft: '8px', marginBottom: '2px' }}>
                {connection}
              </div>
            ))}
          </div>
        </>
      )}
      
      {organizerLinkCounts.length > 0 && (
        <div style={{ 
          marginTop: '8px',
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          paddingTop: '8px'
        }}>
          <div style={{ marginBottom: '4px', fontWeight: 'bold' }}>Organizer Link Counts:</div>
          {organizerLinkCounts.map((item, index) => (
            <div key={index} style={{ 
              display: 'flex', 
              alignItems: 'center',
              marginBottom: '4px',
              gap: '8px'
            }}>
              <div style={{ 
                width: '100px',
                height: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${(item.count / maxCount) * 100}%`,
                  height: '100%',
                  backgroundColor: '#4CAF50',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <div style={{ 
                minWidth: '40px',
                textAlign: 'right',
                fontSize: '12px'
              }}>
                {item.count}
              </div>
              <div style={{ 
                fontSize: '12px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100px'
              }}>
                {item.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomTooltip; 