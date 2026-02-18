import React from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';

interface ActionListItem {
  vanid: number;
  firstName: string;
  lastName: string;
  desiredChange: string;
  action: string;
  fields: Record<string, boolean>;
  datePledged?: string;
}

interface ActionDefinition {
  id: string;
  name: string;
  fields: { key: string; label: string }[];
}

interface ActionListTableProps {
  items: ActionListItem[];
  actions: ActionDefinition[];
  selectedActions: string[];
  onPersonClick?: (vanid: string) => void;
  onRemove?: (vanid: number) => void;
  showDeleteButton?: boolean;
}

const ActionListTable: React.FC<ActionListTableProps> = ({
  items,
  actions,
  selectedActions,
  onPersonClick,
  onRemove,
  showDeleteButton = true
}) => {
  // Filter items by selected actions and get unique people
  const filteredItems = items.filter(p => selectedActions.includes(p.action));
  const uniqueVanids = Array.from(new Set(filteredItems.map(p => p.vanid)));

  if (uniqueVanids.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
        No one on this list yet.
      </Typography>
    );
  }

  return (
    <TableContainer sx={{ maxHeight: 500 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>Name</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>Action</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>Date</TableCell>
            <TableCell sx={{ fontWeight: 600, py: 0.75, fontSize: '0.8rem' }}>Notes</TableCell>
            {showDeleteButton && <TableCell width={40}></TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {uniqueVanids.map(vanid => {
            const personEntries = filteredItems.filter(p => p.vanid === vanid);
            const firstEntry = personEntries[0];
            
            // Get action for this person (showing first matching action)
            const personAction = personEntries[0];
            const action = actions.find((a: any) => a.id === personAction.action);
            
            // Check completion status
            const lastField = action?.fields[action.fields.length - 1];
            const isCompleted = lastField && personAction.fields[lastField.key];
            
            return (
              <TableRow
                key={vanid}
                sx={{ 
                  bgcolor: isCompleted ? '#e8f5e9' : 'inherit',
                  '&:hover': { bgcolor: isCompleted ? '#e8f5e9' : '#f5f5f5' }
                }}
              >
                <TableCell sx={{ py: 0.5 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontSize: '0.8rem',
                      cursor: onPersonClick ? 'pointer' : 'default',
                      '&:hover': onPersonClick ? { color: 'primary.main', textDecoration: 'underline' } : {}
                    }}
                    onClick={(e) => {
                      if (onPersonClick) {
                        e.stopPropagation();
                        onPersonClick(vanid.toString());
                      }
                    }}
                  >
                    {firstEntry.firstName} {firstEntry.lastName}
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 0.5 }}>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                    {action?.name || personAction.action}
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 0.5 }}>
                  <Chip
                    label={isCompleted ? 'Complete' : 'In Progress'}
                    size="small"
                    color={isCompleted ? 'success' : 'default'}
                    sx={{ height: 18, fontSize: '0.7rem' }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    {(() => {
                      if (!firstEntry.datePledged) return '—';
                      try {
                        const date = new Date(firstEntry.datePledged);
                        return isNaN(date.getTime()) ? '—' : format(date, 'MMM dd');
                      } catch {
                        return '—';
                      }
                    })()}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: '0.8rem',
                      maxWidth: 200,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {firstEntry.desiredChange ? 
                      (firstEntry.desiredChange.length > 40 
                        ? firstEntry.desiredChange.substring(0, 40) + '...' 
                        : firstEntry.desiredChange
                      ) : '—'}
                  </Typography>
                </TableCell>
                {showDeleteButton && (
                  <TableCell align="center" sx={{ py: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => onRemove?.(vanid)}
                      sx={{ color: 'text.secondary', p: 0.5 }}
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ActionListTable;
