# LumoViz Application Architecture

This document provides an overview of the application structure, data flow, and component responsibilities to help new developers understand the codebase.

---

## Table of Contents

1. [Application Overview](#application-overview)
2. [Entry Points](#entry-points)
3. [MainApp.tsx Deep Dive](#mainapptsx-deep-dive)
4. [Data Sources & API Calls](#data-sources--api-calls)
5. [Component Hierarchy](#component-hierarchy)
6. [State Management](#state-management)
7. [Visualization Components](#visualization-components)
8. [Panel Components](#panel-components)

---

## Application Overview

**LumoViz** is a data visualization tool for the Carolina Federation, designed to help organizers track:
- **People** - contacts, organizers, team members and their engagement levels (LOE - Level of Engagement)
- **Teams** - organizing teams and their members
- **Meetings/Conversations** - one-on-one meetings between organizers and contacts
- **Campaigns** - organizing drives with goals and milestones

The app has two main modes:
1. **Organize Mode** - For day-to-day organizing work (viewing conversations, people, teams)
2. **Mobilize Mode** - For campaign tracking and goal management

---

## Entry Points

### `src/index.tsx`
- React entry point, renders `<App />` wrapped in `StrictMode`
- Initializes web vitals reporting

### `src/App.tsx`
- Wraps the app in MUI's `ThemeProvider`
- Renders `<MainApp />` component

### `src/components/MainApp.tsx` (2,918 lines)
- **THE MAIN APPLICATION COMPONENT**
- Contains most of the application state and logic
- Orchestrates data fetching, processing, and passing to child components

---

## MainApp.tsx Deep Dive

### File Structure (by line numbers)

| Lines | Section | Description |
|-------|---------|-------------|
| 1-82 | **Imports** | React, MUI, API services, child components, theme utilities |
| 84-135 | **Type Definitions** | `Node`, `CampaignAction`, `GraphLink`, `VisualizationType` interfaces |
| 137-240 | **Core State** | URL routing, visualization state, chapter/date filters |
| 242-492 | **Campaign Data** | Hardcoded Spring 2026 campaign goals (per chapter) |
| 494-560 | **LocalStorage** | Functions to persist campaign data locally |
| 563-640 | **Campaign Handlers** | CRUD operations for campaigns and actions |
| 643-732 | **App Initialization** | `useEffect` that fetches chapters, date range, org data, user info |
| 734-812 | **Data Fetching** | Fetches meetings, pledge data, conversation goals |
| 814-934 | **Event Handlers** | Date range changes, chapter changes, refresh, visualization changes |
| 936-1095 | **Helper Functions** | LOE formatting, name normalization, consistent name resolution |
| 1097-1261 | **People Records** | `useMemo` that transforms meetings into people records with stats |
| 1263-1488 | **Team ID Merging** | Logic to merge duplicate people across different ID systems |
| 1490-2223 | **Network Processing** | `useMemo` that builds network graph nodes/links for 3 views |
| 2225-2246 | **Search Highlighting** | Computes which nodes to highlight based on search |
| 2248-2287 | **Mobile Render** | JSX for mobile layout |
| 2289-2400 | **Desktop Top Bar** | AppBar with logo, search, mode selector, chapter filter, date picker |
| 2402-2715 | **Left Panel (Visualizations)** | Goals chart, Leadership Kanban, Network graph |
| 2718-2891 | **Right Panel (Data)** | Teams, People, Meetings tabs with respective panels |
| 2893-2918 | **Final Render** | Wraps content in AppLayout, exports MainApp |

---

## Data Sources & API Calls

All API calls are made through `src/services/api.ts`:

| Function | Endpoint | Data Returned | Used For |
|----------|----------|---------------|----------|
| `fetchChapters()` | `/api/chapters` | `string[]` | Chapter dropdown filter |
| `fetchOrgIds()` | `/api/org-ids` | Organizer records | People lookups, name resolution |
| `fetchMeetings()` | `/api/meetings` | Meeting records | Core data for conversations |
| `fetchCurrentUserInfo()` | `/api/user-info` | Current user details | User context |
| `fetchPledgeSummary()` | `/api/pledge-summary` | Pledge counts by date | Campaign progress charts |
| `fetchConversationGoals()` | `/api/conversation-goals` | Goal definitions | Goals visualization |
| `fetchTeams()` | `/api/teams` | Team records | Teams panel |

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Backend API (BigQuery)                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
            fetchMeetings()           fetchOrgIds()
                    │                       │
                    ▼                       ▼
            meetingsData              orgIds (people lookup)
                    │                       │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
           peopleRecords              networkNodes
           (useMemo)                  (useMemo)
                    │                       │
        ┌───────────┼───────────┐           │
        ▼           ▼           ▼           ▼
   PeoplePanel  LeadershipKanban  GoalsViz  NetworkGraph
```

---

## Component Hierarchy

```
MainApp
├── ChapterColorProvider (Context)
│   └── MainAppContent
│       │
│       ├── [Mobile View]
│       │   ├── MobileNavigation
│       │   ├── MobileVisualizationView
│       │   └── MobileDateRangePicker
│       │
│       └── [Desktop View]
│           ├── AppBar (Top Bar)
│           │   ├── Logo & Title
│           │   ├── Global Search TextField
│           │   ├── Mode Selector (Organize/Mobilize)
│           │   ├── Chapter Dropdown
│           │   ├── DateRangePicker
│           │   └── Refresh Button
│           │
│           └── AppLayout (Two-panel layout)
│               │
│               ├── [Left Panel - Visualizations]
│               │   ├── Tabs: Convo Count | Leadership | Snowflake
│               │   │
│               │   ├── GoalsVisualization (bar charts)
│               │   ├── LeadershipKanban (LOE columns)
│               │   └── NetworkGraph (D3 force graph)
│               │
│               └── [Right Panel - Data]
│                   ├── Tabs: Teams | People | Meetings
│                   │
│                   ├── TeamsPanel
│                   │   └── AddTeamDialog, EditTeamDialog, TeamGoalsDialog
│                   │
│                   ├── PeoplePanel
│                   │   └── PersonDetailsDialog, AddConnectionDialog
│                   │
│                   └── NotesPanel (Meetings list)
│                       └── ConversationGoalsDialog
│
└── [Mobilize Mode Right Panel]
    └── CampaignPanel
        └── CampaignActionDialog, ParentCampaignDialog
```

---

## State Management

The app uses React's built-in `useState` and `useMemo` for state management (no Redux/Zustand).

### Key State Variables in MainApp

| State Variable | Type | Purpose |
|----------------|------|---------|
| `currentVisualization` | `'people' \| 'teams' \| 'goals' \| 'campaign'` | Active main view |
| `appMode` | `'organize' \| 'mobilize'` | App mode toggle |
| `selectedChapter` | `string` | Chapter filter |
| `currentDateRange` | `{start: Date, end: Date}` | Date range filter |
| `meetingsData` | `any[]` | Raw meetings from API |
| `orgIds` | `any[]` | Organizer/contact records |
| `peopleRecords` | (computed) | Aggregated people with meeting stats |
| `networkNodes` / `networkLinks` | (computed) | Graph data for NetworkGraph |
| `teamsData` | `any[]` | Teams from TeamsPanel callback |
| `peopleFilters` | `object` | Search text, organizer filter, LOE filter, etc. |
| `conversationGoals` | `ConversationGoal[]` | User-defined goals |
| `campaignActions` | `CampaignAction[]` | Campaign checkpoint data |

### Shared State Pattern

The `peopleFilters` state is shared between:
- **PeoplePanel** - Sets filters from UI controls
- **LeadershipKanban** - Receives filtered people
- **NetworkGraph** - Uses search text for highlighting
- **NotesPanel** - Uses search for filtering meetings

---

## Visualization Components

### `GoalsVisualization.tsx`
- **Purpose**: Shows bar charts of conversation counts over time
- **Data**: `meetingsData`, `conversationGoals`
- **Location**: Left panel, "Convo Count" tab

### `LeadershipKanban.tsx` (699 lines)
- **Purpose**: Shows people grouped by LOE (Level of Engagement) in columns
- **Data**: `filteredPeopleRecords`
- **Location**: Left panel, "Leadership" tab
- **Features**: Click to filter, drag-and-drop (future), histogram view

### `NetworkGraph.tsx`
- **Purpose**: D3 force-directed graph showing connections between people
- **Data**: `networkNodes`, `networkLinks`, `teamCenters`
- **Location**: Left panel, "Snowflake" tab
- **Views**: By Team, By LOE, Connections

### `CampaignLineGraph.tsx`
- **Purpose**: Shows campaign progress over time with milestones
- **Data**: `campaignActions`, `parentCampaigns`, `pledgeData`
- **Location**: Left panel in Mobilize mode

---

## Panel Components (Right Side)

### `TeamsPanel.tsx` (933 lines)
- **Purpose**: List and manage organizing teams
- **Data**: Fetches from `/api/teams`, uses `teamsService.ts`
- **Features**: Add/edit teams, assign members, chapter color picker
- **Dialogs**: `AddTeamDialog`, `EditTeamDialog`, `TeamGoalsDialog`

### `PeoplePanel.tsx` (1,963 lines)
- **Purpose**: Browse and filter people, view details
- **Data**: `peopleRecords`, `filteredPeopleRecords`
- **Features**: Multi-select filters, meeting history, LOE status
- **Dialogs**: `PersonDetailsDialog`, `AddConnectionDialog`

### `NotesPanel.tsx` (4,204 lines) ⚠️ VERY LARGE
- **Purpose**: View all meetings/conversations
- **Data**: `meetingsData`, `conversationGoals`
- **Features**: Meeting list, filtering, goal management
- **Note**: This file is a candidate for refactoring

### `CampaignPanel.tsx` (408 lines)
- **Purpose**: Manage campaigns and actions (Mobilize mode only)
- **Data**: `campaignActions`, `parentCampaigns`
- **Features**: Create campaigns, set milestones

---

## Key Patterns to Understand

### 1. Name Resolution Priority
The app has multiple data sources with different ID systems. Name resolution follows this priority:
1. Meeting-specific fields from backend joins
2. `orgIds` table (most authoritative)
3. API pre-built names
4. `userMap` backup
5. Fallback with VAN ID

### 2. ID Merging
People may appear with different IDs across systems. The `buildNameBasedMerges` useMemo creates a mapping to merge duplicates based on first name matching.

### 3. LOE (Level of Engagement)
People are classified into engagement levels:
- **1. Elected Leader** - Highest engagement
- **2. Team Leader**
- **3. Team Member**
- **4. Activated Prospect**
- **5. Prospect** - Lowest engagement
- **Staff** - Organizers
- **Unknown** - No classification

### 4. Network View Modes
- **Team Members**: Shows only team members and their internal connections
- **By LOE**: Same as Connections but colored by LOE and filterable
- **Connections**: Shows team members + everyone they've talked to

---

## Files That Need Refactoring

1. **MainApp.tsx** (2,918 lines) - Should be split into:
   - State management hooks
   - Data processing utilities
   - Smaller sub-components

2. **NotesPanel.tsx** (4,204 lines) - Very large, should be broken down

3. **PeoplePanel.tsx** (1,963 lines) - Could benefit from extraction

---

## Getting Started for New Developers

1. Start by reading this document
2. Look at `MainApp.tsx` lines 137-240 to understand core state
3. Follow a single data flow (e.g., meetings → peopleRecords → PeoplePanel)
4. Use React DevTools to inspect component props and state
5. Check `src/services/api.ts` for all API endpoints

---

*Last updated: January 2026*

