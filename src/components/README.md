# Component Organization

This directory contains all React components organized into logical folders.

## Structure

### `/dialogs/`
Dialog and modal components:
- `AddConnectionDialog.tsx` - Dialog for adding new connections
- `AddTeamDialog.tsx` - Dialog for adding team members  
- `CampaignActionDialog.tsx` - Dialog for creating campaign actions

### `/layout/`
Layout and structural components:
- `AppLayout.tsx` - Main application layout wrapper
- `RightPanel.tsx` - Collapsible right sidebar panel

### `/mobile/`
Mobile-specific components:
- `MobileBottomNavigation.tsx` - Bottom navigation for mobile
- `MobileBottomSheet.tsx` - Mobile bottom sheet component
- `MobileDateRangePicker.tsx` - Date picker optimized for mobile
- `MobileListView.tsx` - Mobile-optimized list view
- `MobileNavigation.tsx` - Top navigation for mobile
- `MobileVisualizationView.tsx` - Mobile visualization container

### `/panels/`
Panel components for the right sidebar:
- `CampaignPanel.tsx` - Campaign management panel
- `NotesPanel.tsx` - Notes and details panel
- `PeoplePanel.tsx` - People information panel

### `/ui/`
Reusable UI components:
- `CustomTooltip.tsx` - Custom tooltip component
- `DateRangePicker.tsx` - Date range selection component
- `FilterCheckboxes.tsx` - Filter checkboxes component

### `/visualizations/`
Data visualization components:
- `CampaignLineGraph.tsx` - Campaign progress line chart
- `GoalsVisualization.tsx` - Goals and conversations analytics

## Main Application

- `MainApp.tsx` - Main application container that manages state and renders different views

## Notes

- The actual D3.js network graph visualization is currently embedded within `MainApp.tsx` and should be extracted into its own component in `/visualizations/network/` in a future refactoring.
- All unused/legacy components have been removed to keep the codebase clean.
