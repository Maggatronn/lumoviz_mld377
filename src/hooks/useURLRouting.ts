import { useState, useEffect, useCallback } from 'react';
import { VisualizationType } from '../types';

type NetworkViewType = 'team-members' | 'by-loe' | 'connections';
type ViewModeType = 'federation' | 'dashboard';

const getViewModeFromPath = (): ViewModeType => {
  const path = window.location.pathname;
  if (path.includes('/dashboard')) return 'dashboard';
  return 'federation';
};

const getVisualizationFromPath = (): VisualizationType => {
  const path = window.location.pathname;
  if (path.includes('/people')) return 'people';
  if (path.includes('/teams')) return 'teams';
  if (path.includes('/campaign')) return 'campaign';
  // Note: 'goals' view has been removed - redirect to people if somehow accessed
  return 'people'; // Default to people page
};

const getNetworkViewFromPath = (): NetworkViewType => {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  if (view === 'team-members') return 'team-members';
  if (view === 'by-loe') return 'by-loe';
  return 'connections'; // Default to connections
};

const getSelectedActionsFromURL = (): string[] | null => {
  const params = new URLSearchParams(window.location.search);
  const actions = params.get('actions');
  if (actions) {
    return actions.split(',');
  }
  return null; // No default - will be set by MainApp based on loaded actions
};

// Get filters from URL query parameters
const getFiltersFromURL = () => {
  const params = new URLSearchParams(window.location.search);
  
  const filters: any = {};
  
  // Common filters across views
  if (params.has('chapter')) filters.chapter = params.get('chapter');
  if (params.has('organizer')) filters.organizer = params.get('organizer');
  if (params.has('search')) filters.searchText = params.get('search');
  
  // LOE and member status (comma-separated)
  if (params.has('loe')) filters.loeStatus = params.get('loe')!.split(',').filter(Boolean);
  if (params.has('member')) filters.memberStatus = params.get('member')!.split(',').filter(Boolean);
  
  // People view specific
  if (params.has('lastContact')) filters.lastContactFilter = params.get('lastContact');
  if (params.has('meetingCount')) filters.meetingCountFilter = params.get('meetingCount');
  if (params.has('actionStatus')) filters.actionStatus = params.get('actionStatus');
  
  // Campaign view specific
  if (params.has('campaignTab')) filters.campaignViewTab = params.get('campaignTab');
  if (params.has('campaignMetric')) filters.campaignMetric = params.get('campaignMetric');
  if (params.has('barometerActions')) filters.barometerActions = params.get('barometerActions')!.split(',').filter(a => Boolean(a) && a !== 'pledges');
  if (params.has('barometerSort')) filters.barometerSort = params.get('barometerSort');
  if (params.has('barometerSortDir')) filters.barometerSortDir = params.get('barometerSortDir');
  
  // Teams view specific
  if (params.has('teamType')) filters.teamType = params.get('teamType');
  
  // Dashboard view specific
  if (params.has('dashboardTab')) filters.dashboardTab = params.get('dashboardTab');
  
  return filters;
};

export const useURLRouting = () => {
  const [viewMode, setViewMode] = useState<ViewModeType>(getViewModeFromPath());
  const [currentVisualization, setCurrentVisualization] = useState<VisualizationType>(getVisualizationFromPath());
  const [networkView, setNetworkView] = useState<NetworkViewType>(getNetworkViewFromPath());
  const [selectedActions, setSelectedActions] = useState<string[]>(getSelectedActionsFromURL() || []);
  const [urlFilters, setUrlFilters] = useState<any>(getFiltersFromURL());

  // Function to update URL when state changes
  const updateURL = useCallback((
    mode: ViewModeType, 
    visualization?: VisualizationType, 
    view?: NetworkViewType, 
    actions?: string[],
    filters?: any
  ) => {
    let path = '/dashboard'; // Default to dashboard
    
    if (mode === 'federation' && visualization) {
      path = `/${visualization}`;
    }
    
    const params = new URLSearchParams();
    
    // Add view parameter for teams visualization
    if (visualization === 'teams' && view) {
      params.set('view', view);
    }
    
    // Add selected actions parameter (for dashboard)
    if (mode === 'dashboard' && actions && actions.length > 0) {
      params.set('actions', actions.join(','));
    }
    
    // Add filters to URL
    if (filters) {
      if (filters.chapter) params.set('chapter', filters.chapter);
      if (filters.organizer) params.set('organizer', filters.organizer);
      if (filters.searchText) params.set('search', filters.searchText);
      if (filters.loeStatus && filters.loeStatus.length > 0) params.set('loe', filters.loeStatus.join(','));
      if (filters.memberStatus && filters.memberStatus.length > 0) params.set('member', filters.memberStatus.join(','));
      if (filters.lastContactFilter && filters.lastContactFilter !== 'all') params.set('lastContact', filters.lastContactFilter);
      if (filters.meetingCountFilter && filters.meetingCountFilter !== 'all') params.set('meetingCount', filters.meetingCountFilter);
      if (filters.actionStatus && filters.actionStatus !== 'all') params.set('actionStatus', filters.actionStatus);
      if (filters.campaignViewTab && filters.campaignViewTab !== 'barometer') params.set('campaignTab', filters.campaignViewTab);
      if (filters.campaignMetric && filters.campaignMetric !== 'federation') params.set('campaignMetric', filters.campaignMetric);
      if (filters.barometerActions && filters.barometerActions.length > 0) params.set('barometerActions', filters.barometerActions.join(','));
      if (filters.barometerSort) params.set('barometerSort', filters.barometerSort);
      if (filters.barometerSortDir && filters.barometerSortDir !== 'desc') params.set('barometerSortDir', filters.barometerSortDir);
      if (filters.teamType) params.set('teamType', filters.teamType);
      if (filters.dashboardTab && filters.dashboardTab !== 'people') params.set('dashboardTab', filters.dashboardTab);
    }
    
    const url = params.toString() ? `${path}?${params.toString()}` : path;
    window.history.pushState({ mode, visualization, view, actions, filters }, '', url);
  }, []);

  // Handle browser back/forward buttons and initial URL setup
  useEffect(() => {
    // Set initial URL if we're at root path - default to dashboard
    if (window.location.pathname === '/') {
      setViewMode('dashboard');
      updateURL('dashboard', undefined, undefined, selectedActions);
    }

    const handlePopState = () => {
      const newViewMode = getViewModeFromPath();
      const newVisualization = getVisualizationFromPath();
      const newNetworkView = getNetworkViewFromPath();
      const newSelectedActions = getSelectedActionsFromURL();
      const newFilters = getFiltersFromURL();
      
      setViewMode(newViewMode);
      setCurrentVisualization(newVisualization);
      setNetworkView(newNetworkView);
      setUrlFilters(newFilters);
      if (newSelectedActions !== null) {
        setSelectedActions(newSelectedActions);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [updateURL, selectedActions]);

  // Handler for view mode changes
  const handleViewModeChange = useCallback((newMode: ViewModeType) => {
    setViewMode(newMode);
    updateURL(newMode, newMode === 'federation' ? currentVisualization : undefined, networkView, selectedActions, urlFilters);
  }, [currentVisualization, networkView, selectedActions, urlFilters, updateURL]);

  // Handler for visualization changes
  const handleVisualizationChange = useCallback((newVisualization: VisualizationType) => {
    setCurrentVisualization(newVisualization);
    updateURL('federation', newVisualization, newVisualization === 'teams' ? networkView : undefined, undefined, urlFilters);
  }, [networkView, urlFilters, updateURL]);

  // Handler for network view changes
  const handleNetworkViewChange = useCallback((newView: NetworkViewType) => {
    setNetworkView(newView);
    updateURL(viewMode, currentVisualization, newView, selectedActions, urlFilters);
  }, [viewMode, currentVisualization, selectedActions, urlFilters, updateURL]);

  // Handler for selected actions changes
  const handleSelectedActionsChange = useCallback((newActions: string[]) => {
    setSelectedActions(newActions);
    if (viewMode === 'dashboard') {
      updateURL('dashboard', undefined, undefined, newActions, urlFilters);
    }
  }, [viewMode, urlFilters, updateURL]);

  // Handler for filter changes
  const handleFiltersChange = useCallback((newFilters: any) => {
    setUrlFilters(newFilters);
    updateURL(viewMode, currentVisualization, networkView, selectedActions, newFilters);
  }, [viewMode, currentVisualization, networkView, selectedActions, updateURL]);

  return {
    viewMode,
    setViewMode,
    currentVisualization,
    setCurrentVisualization,
    networkView,
    setNetworkView,
    selectedActions,
    urlFilters,
    updateURL,
    handleViewModeChange,
    handleVisualizationChange,
    handleNetworkViewChange,
    handleSelectedActionsChange,
    handleFiltersChange
  };
};

export type { NetworkViewType, ViewModeType };
