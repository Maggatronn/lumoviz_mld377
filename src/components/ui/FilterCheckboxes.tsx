import React, { useState, useEffect } from 'react';
import { Autocomplete, TextField, Checkbox } from '@mui/material';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';

interface NodeFilters {
  showContacts: boolean;
}

interface FilterCheckboxesProps {
  onFilterChange?: (filters: NodeFilters) => void;
  initialFilters?: NodeFilters;
  availableTypes?: string[];
  availableContactTypes?: string[];
  availableContactResults?: string[];
  selectedContactTypes?: Set<string>;
  selectedContactResults?: Set<string>;
  onContactTypeChange?: (types: Set<string>) => void;
  onContactResultChange?: (results: Set<string>) => void;
}

const FilterCheckboxes: React.FC<FilterCheckboxesProps> = ({
  onFilterChange,
  initialFilters,
  availableTypes = [],
  availableContactTypes = [],
  availableContactResults = [],
  selectedContactTypes = new Set(),
  selectedContactResults = new Set(),
  onContactTypeChange,
  onContactResultChange
}) => {
  const [filters, setFilters] = useState<NodeFilters>({
    showContacts: initialFilters?.showContacts ?? false
  });

  // Sync local state with initialFilters when they change
  useEffect(() => {
    if (initialFilters) {
      setFilters(initialFilters);
    }
  }, [initialFilters]);

  const handleChange = (filterName: keyof NodeFilters) => {
    const previousValue = filters[filterName];
    const newValue = !filters[filterName];
    
    const newFilters = {
      ...filters,
      [filterName]: newValue
    };
    
    setFilters(newFilters);
    
    // Track the filter change
    
    // Notify parent component immediately
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  // Only notify parent on initial mount (once)
  useEffect(() => {
    if (onFilterChange) {
      // Use initialFilters if provided, otherwise use the component's current state
      const filtersToSend = initialFilters || filters;
      onFilterChange(filtersToSend);
    }
  }, []); // Empty dependency array - only run once on mount

  return (
    <div style={{
      position: 'absolute',
      top: '100px',
      left: '20px',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(4px)',
      padding: '8px',
      borderRadius: '4px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
      width: '140px',
      maxHeight: '300px',
      overflowY: 'auto',
      zIndex: 100
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '10px' }}>Display Options</div>
      
      <div>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '9px', marginBottom: '2px' }}>
          <input
            type="checkbox"
            checked={filters.showContacts}
            onChange={() => handleChange('showContacts')}
            style={{ marginRight: '4px', transform: 'scale(0.8)' }}
          />
          Contact Edges
        </label>
      </div>

      {/* Contact type and result filters - only show when contacts are enabled */}
      {filters.showContacts && (
        <>
          <div style={{ marginTop: '6px', paddingTop: '4px', borderTop: '1px solid #ddd' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '9px' }}>Filters</div>
            
            {/* Contact Types */}
            <div style={{ marginBottom: '4px' }}>
              <Autocomplete
                multiple
                size="small"
                options={availableContactTypes}
                disableCloseOnSelect
                value={Array.from(selectedContactTypes)}
                onChange={(event, newValue) => {
                  const previousValue = Array.from(selectedContactTypes);
                  onContactTypeChange?.(new Set(newValue));
                }}
                renderOption={(props, option, { selected }) => (
                  <li {...props} style={{ fontSize: '8px', padding: '2px 4px' }}>
                    <Checkbox
                      icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                      checkedIcon={<CheckBoxIcon fontSize="small" />}
                      style={{ marginRight: 4 }}
                      checked={selected}
                      sx={{ transform: 'scale(0.7)' }}
                    />
                    {option}
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    variant="outlined"
                    label="Types"
                    placeholder={selectedContactTypes.size === 0 ? "All" : ""}
                    sx={{
                      '& .MuiInputLabel-root': { fontSize: '8px' },
                      '& .MuiInputBase-input': { fontSize: '8px' },
                      '& .MuiChip-label': { fontSize: '7px' },
                      '& .MuiChip-root': { height: '16px' },
                      '& .MuiOutlinedInput-root': { minHeight: '24px' }
                    }}
                  />
                )}
                sx={{ width: '100%' }}
              />
            </div>

            {/* Contact Results */}
            <div style={{ marginBottom: '2px' }}>
              <Autocomplete
                multiple
                size="small"
                options={availableContactResults}
                disableCloseOnSelect
                value={Array.from(selectedContactResults)}
                onChange={(event, newValue) => {
                  const previousValue = Array.from(selectedContactResults);
                  onContactResultChange?.(new Set(newValue));
                }}
                renderOption={(props, option, { selected }) => (
                  <li {...props} style={{ fontSize: '8px', padding: '2px 4px' }}>
                    <Checkbox
                      icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                      checkedIcon={<CheckBoxIcon fontSize="small" />}
                      style={{ marginRight: 4 }}
                      checked={selected}
                      sx={{ transform: 'scale(0.7)' }}
                    />
                    {option}
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    variant="outlined"
                    label="Results"
                    placeholder={selectedContactResults.size === 0 ? "All" : ""}
                    sx={{
                      '& .MuiInputLabel-root': { fontSize: '8px' },
                      '& .MuiInputBase-input': { fontSize: '8px' },
                      '& .MuiChip-label': { fontSize: '7px' },
                      '& .MuiChip-root': { height: '16px' },
                      '& .MuiOutlinedInput-root': { minHeight: '24px' }
                    }}
                  />
                )}
                sx={{ width: '100%' }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FilterCheckboxes; 