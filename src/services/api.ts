export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3003/api';

export interface ActionDefinition {
  action_id: string;
  action_name: string;
  goal_type: string;
  description?: string;
  fields: { key: string; label: string; type?: string; options?: string[] }[];
  goal_field_key?: string;  // Which field counts toward the goal (null = Named/total)
  is_active: boolean;
  has_goal?: boolean;
  target_audience?: 'constituent' | 'leadership';
  status?: string;
  archived_date?: string;
  parent_campaign_id?: string;
  is_template?: boolean;
  template_action_id?: string;
  organizer_vanid?: string;
  visible_to_organizers?: string[];
  default_individual_goal?: number;
}

export interface Contact {
  vanid: string;
  firstname: string;
  lastname: string;
  chapter: string;
  email: string;
  member_status: string;
  loe: string;
  last_contact_date?: string; // Date of most recent contact from API
  total_meetings_all_time?: number; // Total meetings count from API
  organizers?: string[]; // List of organizer names from API
  primary_organizer_vanid?: string; // Primary organizer VAN ID from lumoviz_contacts
}

export interface IdMapping {
  UserID?: string;
  VANID?: string;
  firstName?: string;
  lastName?: string;
}

export interface Link {
  source?: string;
  target?: string;
  count: string;
  source_chapter?: string;
  target_chapter?: string;
  contact_type: string;
  contact_result: string;
  vanId: string;
  userId: string;
  Id?: string; // For consistency with BigQuery schema
  utc_datecanvassed: string;
}

export interface OrgIdData {
  vanid: string;
  userid?: string;
  firstname?: string;
  lastname?: string;
  supervisorid?: string;
  type?: string;
  email?: string;
  chapter?: string;
  [key: string]: any; // Allow for other ID fields we might discover
}

// Maps BigQuery fields to our expected format
const mapContact = (data: any): Contact => {
  return {
    vanid: data.vanid?.toString() || '',
    firstname: data.firstname || data.first_name || '',
    lastname: data.lastname || data.last_name || '',
    chapter: data.chapter || '',
    email: data.email || '',
    member_status: data.member_status || data.status || '',
    loe: data.loe || '',
    last_contact_date: data.last_contact_date || undefined,
    total_meetings_all_time: data.total_meetings_all_time || 0,
    organizers: data.organizers ? data.organizers.split(', ').filter((o: string) => o.trim()) : [],
    primary_organizer_vanid: data.primary_organizer_vanid || undefined
  };
};

// Maps BigQuery fields to our expected format
const mapIdMapping = (data: any): IdMapping => {
  return {
    UserID: data.UserID || data.user_id || '',
    VANID: data.VANID || data.Id || '',
    firstName: data.firstName || data.first_name || '',
    lastName: data.lastName || data.last_name || ''
  };
};

// Maps BigQuery fields to our expected format
const mapLink = (data: any): Link => {
  return {
    source: data.source || '', 
    target: data.target || '',
    count: data.count?.toString() || '1',
    source_chapter: data.source_chapter || '',
    target_chapter: data.target_chapter || '',
    contact_type: data.contact_type || 'Unknown',
    contact_result: data.contact_result || 'Unknown',
    vanId: data.vanId || data.Id || '',
    userId: data.userId || data.user_id || '',
    Id: data.Id || data.vanId || '', // Support for direct Id field
    utc_datecanvassed: data.utc_datecanvassed || new Date().toISOString()
  };
};

export const fetchChapters = async (): Promise<string[]> => {
  try {
    console.log('[fetchChapters] Fetching from:', `${API_URL}/chapters`);
    const response = await fetch(`${API_URL}/chapters`);
    if (!response.ok) {
      throw new Error(`Failed to fetch chapters: ${response.statusText}`);
    }
    const data = await response.json();
    console.log('[fetchChapters] Received chapters:', data);
    return data;
  } catch (error) {
    console.error('Error fetching chapters:', error);
    throw error;
  }
};

export interface ContactsParams {
  chapter?: string;
  member_status?: string | string[];
  loe?: string | string[];
  search?: string;
  organizer?: string; // Filter by organizer name
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
  start_date?: string; // For time window prioritization (format: YYYY-MM-DD)
  end_date?: string;   // For time window prioritization (format: YYYY-MM-DD)
}

export interface ContactsResponse {
  data: Contact[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export const fetchContacts = async (params: ContactsParams = {}): Promise<ContactsResponse> => {
  try {
    const queryParams = new URLSearchParams();
    
    if (params.chapter && params.chapter !== 'All Chapters') {
      queryParams.append('chapter', params.chapter);
    }
    // Handle member_status as string or array
    if (params.member_status) {
      const memberStatusValue = Array.isArray(params.member_status) 
        ? params.member_status.join(',') 
        : params.member_status;
      if (memberStatusValue) queryParams.append('member_status', memberStatusValue);
    }
    // Handle loe as string or array
    if (params.loe) {
      const loeValue = Array.isArray(params.loe) 
        ? params.loe.join(',') 
        : params.loe;
      if (loeValue) queryParams.append('loe', loeValue);
    }
    if (params.search) queryParams.append('search', params.search);
    if (params.organizer) queryParams.append('organizer', params.organizer);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
    if (params.offset !== undefined) queryParams.append('offset', params.offset.toString());
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    
    const url = `${API_URL}/contacts?${queryParams.toString()}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch contacts: ${response.statusText}`);
    }
    const result = await response.json();
    
    return {
      data: result.data.map(mapContact),
      pagination: result.pagination
    };
  } catch (error) {
    console.error('Error fetching contacts:', error);
    throw error;
  }
};

export interface LOECounts {
  total: number;
  by_loe: {
    [key: string]: number;
  };
}

export const fetchLOECounts = async (params: ContactsParams = {}): Promise<LOECounts> => {
  try {
    const queryParams = new URLSearchParams();
    
    if (params.chapter && params.chapter !== 'All Chapters') {
      queryParams.append('chapter', params.chapter);
    }
    // Handle member_status as string or array
    if (params.member_status) {
      const memberStatusValue = Array.isArray(params.member_status) 
        ? params.member_status.join(',') 
        : params.member_status;
      if (memberStatusValue) queryParams.append('member_status', memberStatusValue);
    }
    if (params.search) queryParams.append('search', params.search);
    
    const url = `${API_URL}/contacts/loe-counts?${queryParams.toString()}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch LOE counts: ${response.statusText}`);
    }
    const result = await response.json();
    
    return result;
  } catch (error) {
    console.error('Error fetching LOE counts:', error);
    throw error;
  }
};

export const fetchIdMappings = async (): Promise<IdMapping[]> => {
  try {
    const response = await fetch(`${API_URL}/idmappings`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ID mappings: ${response.statusText}`);
    }
    const data = await response.json();
    
    // Make sure we normalize the mapping data to account for different field names
    return data.map((mapping: any) => ({
      UserID: mapping.UserID || mapping.userid,
      VANID: mapping.VANID || mapping.Id || mapping.vanid,
      firstName: mapping.firstName || mapping.first_name || '',
      lastName: mapping.lastName || mapping.last_name || ''
    }));
  } catch (error) {
    console.error('Error fetching ID mappings:', error);
    throw error;
  }
};

export const fetchLinks = async (
  startDate?: string, 
  endDate?: string, 
  contactTypes?: string[],
  contactResults?: string[]
): Promise<Link[]> => {
  try {
    let url = `${API_URL}/links`;
    const params = new URLSearchParams();
    
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (contactTypes && contactTypes.length > 0) params.append('contactTypes', JSON.stringify(contactTypes));
    if (contactResults && contactResults.length > 0) params.append('contactResults', JSON.stringify(contactResults));
    
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch links: ${response.statusText}`);
    }
    const data = await response.json();
    return data.map(mapLink);
  } catch (error) {
    console.error('Error fetching links:', error);
    throw error;
  }
};

export const fetchContactTypes = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${API_URL}/contactTypes`);
    if (!response.ok) {
      throw new Error(`Failed to fetch contact types: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching contact types:', error);
    throw error;
  }
};

export const fetchContactResults = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${API_URL}/contactResults`);
    if (!response.ok) {
      throw new Error(`Failed to fetch contact results: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching contact results:', error);
    throw error;
  }
};

export const fetchOrgIds = async (): Promise<OrgIdData[]> => {
  try {
    // Try the new simpler endpoint
    const response = await fetch(`${API_URL}/org-ids-simple`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error('Error fetching org_ids:', error);
    return [];
  }
};

// Fetch meetings for specific contact IDs (efficient for people panel)
export const fetchMeetingsByContacts = async (
  contact_ids: string[],
  include_notes: boolean = false
): Promise<any[]> => {
  try {
    const response = await fetch(`${API_URL}/meetings/by-contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_ids, include_notes })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch meetings by contacts: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching meetings by contacts:', error);
    return [];
  }
};

export const fetchMeetings = async (startDate: string, endDate: string, chapter?: string, page?: number, limit?: number): Promise<any[]> => {
  try {
    const url = new URL(`${API_URL}/conversations`, window.location.origin);
    url.searchParams.append('startDate', startDate);
    url.searchParams.append('endDate', endDate);
    if (chapter) {
      url.searchParams.append('chapter', chapter);
    }
    if (page !== undefined) {
      url.searchParams.append('page', page.toString());
    }
    if (limit !== undefined) {
      url.searchParams.append('limit', limit.toString());
    }
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch meetings: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching meetings:', error);
    throw error;
  }
};

export interface HistogramParams {
  granularity?: 'day' | 'week' | 'month';
  scope?: 'federation' | 'chapter' | 'person' | 'type';
  start_date?: string;
  end_date?: string;
  chapter?: string;
  organizer?: string;
  meeting_types?: string[]; // Will be joined as comma-separated
}

export interface HistogramDataPoint {
  time_bucket: string; // ISO date string
  time_label: string; // Formatted label (e.g., "Jan 15")
  scope_key: string; // Chapter name, person name, or "Carolina Federation"
  meeting_count: number;
}

export interface HistogramResponse {
  success: boolean;
  data: HistogramDataPoint[];
  params: HistogramParams;
}

export const fetchMeetingsHistogram = async (params: HistogramParams = {}): Promise<HistogramResponse> => {
  try {
    const url = new URL(`${API_URL}/meetings/histogram`, window.location.origin);
    
    if (params.granularity) url.searchParams.append('granularity', params.granularity);
    if (params.scope) url.searchParams.append('scope', params.scope);
    if (params.start_date) url.searchParams.append('start_date', params.start_date);
    if (params.end_date) url.searchParams.append('end_date', params.end_date);
    if (params.chapter && params.chapter !== 'All Chapters') url.searchParams.append('chapter', params.chapter);
    if (params.organizer) url.searchParams.append('organizer', params.organizer);
    if (params.meeting_types && params.meeting_types.length > 0) {
      url.searchParams.append('meeting_types', params.meeting_types.join(','));
    }
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch histogram data: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching meetings histogram:', error);
    throw error;
  }
};

export const fetchConversations = async (startDate: string, endDate: string, chapter?: string, page?: number, limit?: number): Promise<any[]> => {
  try {
    const url = new URL(`${API_URL}/conversations`, window.location.origin);
    url.searchParams.append('startDate', startDate);
    url.searchParams.append('endDate', endDate);
    if (chapter) {
      url.searchParams.append('chapter', chapter);
    }
    if (page !== undefined) {
      url.searchParams.append('page', page.toString());
    }
    if (limit !== undefined) {
      url.searchParams.append('limit', limit.toString());
    }
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch conversations: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }
};

// New function to fetch debug data for a specific node
export const fetchNodeDebugData = async (nodeId: string): Promise<any> => {
  try {
    const response = await fetch(`${API_URL}/node-debug/${encodeURIComponent(nodeId)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch node debug data: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching node debug data:', error);
    throw error;
  }
};

// New function to fetch debug data for a link between two nodes
export const fetchLinkDebugData = async (nodeId1: string, nodeId2: string): Promise<any> => {
  try {
    const response = await fetch(`${API_URL}/link-debug/${encodeURIComponent(nodeId1)}/${encodeURIComponent(nodeId2)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch link debug data: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching link debug data:', error);
    throw error;
  }
};

// New function to fetch current user info from IAP headers
export const fetchCurrentUserInfo = async (): Promise<any> => {
  try {
    const response = await fetch(`${API_URL}/user-info`);
    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching user info:', error);
    throw error;
  }
};

// Pledge submission data interface
export interface PledgeSubmission {
  date_submitted: string;
  chapter?: string;
  pledge_count: number;
  submissions?: Array<{
    vanid: number;
    first_name: string;
    last_name: string;
    leader: string;
    desired_change: string;
  }>;
  [key: string]: any; // Allow for additional fields from BigQuery
}

// Fetch pledge submissions for campaign actuals
export const fetchPledgeSubmissions = async (
  startDate?: string,
  endDate?: string,
  chapter?: string
): Promise<PledgeSubmission[]> => {
  try {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (chapter && chapter !== 'All Chapters') params.append('chapter', chapter);
    
    const url = `${API_URL}/pledge-submissions${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch pledge submissions: ${response.statusText}`);
    }
    
    const result = await response.json();
    // Normalize date_submitted from BigQuery's {value: "date"} format to plain string
    return (result.data || []).map((item: any) => ({
      ...item,
      date_submitted: typeof item.date_submitted === 'object' ? item.date_submitted.value : item.date_submitted
    }));
  } catch (error) {
    console.error('Error fetching pledge submissions:', error);
    return [];
  }
};

// ============================================================================
// DASHBOARD API - Lists, Leaders, Goals
// ============================================================================

export interface ListItem {
  list_id: string;
  organizer_vanid: string;
  vanid: string;
  contact_name: string;
  action: string;
  action_id: string;
  campaign_id?: string;
  progress: Record<string, boolean>;
  notes?: string;
  desired_change?: string;
  date_added: string;
  date_pledged?: string;
  last_updated: string;
  is_completed: boolean;
  is_active: boolean;
}

export interface OrganizerGoal {
  goal_id: string;
  organizer_vanid: number;
  action_id: string;
  goal_value: number;
  campaign_id?: string;
  created_at: string;
  updated_at: string;
}

// Fetch organizer's turf lists
export const fetchLists = async (organizer_vanid: string): Promise<ListItem[]> => {
  try {
    const response = await fetch(`${API_URL}/lists?organizer_vanid=${organizer_vanid}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Error fetching lists:', error);
    return [];
  }
};

// Fetch active actions (optionally filtered by organizer visibility and chapter)
export const fetchActions = async (organizer_vanid?: string, organizer_chapter?: string): Promise<ActionDefinition[]> => {
  try {
    const params = new URLSearchParams();
    if (organizer_vanid) params.append('organizer_vanid', organizer_vanid);
    if (organizer_chapter) params.append('organizer_chapter', organizer_chapter);
    
    const url = params.toString() 
      ? `${API_URL}/actions?${params.toString()}`
      : `${API_URL}/actions`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const actions = await response.json();
    return actions;
  } catch (error) {
    console.error('Error fetching actions:', error);
    return [];
  }
};

// Add person to a list
export const addToList = async (data: {
  organizer_vanid: string;
  organizer_name?: string;
  contact_vanid: number;
  contact_name: string;
  action_id: string;
  action: string;
  desired_change?: string;
  progress?: Record<string, boolean>;
}): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Error adding to list:', error);
    return false;
  }
};

// Update list item
export const updateListItem = async (
  list_id: string,
  updates: {
    progress?: Record<string, boolean>;
    notes?: string;
    desired_change?: string;
    is_completed?: boolean;
  }
): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/lists/${list_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Error updating list item:', error);
    return false;
  }
};

// Remove person from list
export const removeFromList = async (list_id: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/lists/${list_id}`, {
      method: 'DELETE'
    });
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Error removing from list:', error);
    return false;
  }
};

// Fetch organizer's personal goals
// NOTE: Goals are no longer stored separately - they're managed through the turf/action system
// Returning empty array to prevent errors in Dashboard
export const fetchOrganizerGoals = async (organizer_vanid: string): Promise<OrganizerGoal[]> => {
  try {
    const response = await fetch(`${API_URL}/organizer-goals?organizer_vanid=${organizer_vanid}`);
    
    if (!response.ok) {
      console.error('Error fetching organizer goals');
      return [];
    }
    
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Error fetching organizer goals:', error);
    return [];
  }
};

// Save/update organizer's personal goal
// NOTE: Goals are no longer stored separately - they're managed through the turf/action system
// Returning true to prevent errors in Dashboard
export const saveOrganizerGoal = async (data: {
  organizer_vanid: string;
  action_id: string;
  goal_value: number;
  campaign_id?: string;
}): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/organizer-goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error saving organizer goal:', errorData.error);
      return false;
    }
    
    const result = await response.json();
    console.log('[saveOrganizerGoal] Goal saved successfully:', result);
    return true;
  } catch (error) {
    console.error('Error saving organizer goal:', error);
    return false;
  }
};

// ============================================
// LEADER HIERARCHY API
// ============================================

export interface LeaderHierarchy {
  leader_vanid: string;
  parent_leader_vanid: string | null;
  organizer_vanid: string;
  created_date?: string;
  updated_date?: string;
  leader_name?: string;
  parent_leader_name?: string;
  organizer_name?: string;
}

// Fetch leader hierarchy for an organizer
export const fetchLeaderHierarchy = async (organizer_vanid?: string): Promise<LeaderHierarchy[]> => {
  try {
    // Fetch ALL hierarchy entries (not filtered by organizer) so we can traverse the full tree
    // This allows us to show nested leaders (e.g., if Sam adds Courtney, and Courtney leads Cedric,
    // we can show Cedric under Courtney even though Cedric's entry has organizer_vanid=Courtney)
    const response = await fetch(`${API_URL}/leader-hierarchy`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch leader hierarchy');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching leader hierarchy:', error);
    return [];
  }
};

// Save leader hierarchy entry (add or update)
export const saveLeaderHierarchy = async (data: {
  organizer_vanid: string;
  leader_vanid: string;
  parent_leader_vanid?: string | null;
}): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_URL}/leader-hierarchy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error('Failed to save leader hierarchy');
  }
  
  return response.json();
};

// Remove leader from hierarchy
export const removeLeaderHierarchy = async (organizer_vanid: string, leader_vanid: string): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_URL}/leader-hierarchy`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizer_vanid, leader_vanid })
  });
  
  if (!response.ok) {
    throw new Error('Failed to remove leader from hierarchy');
  }
  
  return response.json();
};

// Create a new action
export const createAction = async (actionData: {
  action_name: string;
  fields: { key: string; label: string }[];
  goal_field_key?: string;
  parent_campaign_id?: string;
  goal_type_id?: string;
  chapters: string[];
  organizer_vanid?: string;
  visible_to_organizers?: string[];
  has_goal?: boolean;
  target_audience?: 'constituent' | 'leadership';
  is_template?: boolean;
  template_action_id?: string;
  default_individual_goal?: number;
  // Rate-based and deadline fields
  action_type?: 'one_time' | 'rate_based';
  recurrence_period?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  recurrence_count?: number;
  deadline_date?: string;
  deadline_type?: 'soft' | 'hard';
  time_tracking_enabled?: boolean;
}): Promise<{ success: boolean; message: string; action_id?: string }> => {
  try {
    const response = await fetch(`${API_URL}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actionData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create action');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error creating action:', error);
    throw error;
  }
};

// Update action status (archive/restore)
export const updateActionStatus = async (
  actionId: string,
  status: 'live' | 'archived'
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${API_URL}/actions/${actionId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update action status');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error updating action status:', error);
    throw error;
  }
};

// Update an existing action
export const updateAction = async (
  actionId: string,
  actionData: {
    action_name?: string;
    fields?: { key: string; label: string }[];
    goal_field_key?: string;
    parent_campaign_id?: string;
    goal_type_id?: string;
    chapters?: string[];
    organizer_vanid?: string;
    visible_to_organizers?: string[];
    has_goal?: boolean;
    target_audience?: 'constituent' | 'leadership';
    is_template?: boolean;
    template_action_id?: string;
    default_individual_goal?: number;
    // Rate-based and deadline fields
    action_type?: 'one_time' | 'rate_based';
    recurrence_period?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
    recurrence_count?: number;
    deadline_date?: string;
    deadline_type?: 'soft' | 'hard';
    time_tracking_enabled?: boolean;
  }
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${API_URL}/actions/${actionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actionData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update action');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error updating action:', error);
    throw error;
  }
};

// Organizer details (turf, team_role)
export interface OrganizerDetails {
  vanid: string;
  turf?: string | null;
  team_role?: string | null;
}

export const fetchOrganizerDetails = async (vanid: string): Promise<OrganizerDetails> => {
  try {
    const response = await fetch(`${API_URL}/organizer-details/${vanid}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch organizer details');
    }
    
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching organizer details:', error);
    throw error;
  }
};

export const updateOrganizerDetails = async (vanid: string, details: { turf?: string | null; team_role?: string | null }): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/organizer-details/${vanid}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(details),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update organizer details');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error updating organizer details:', error);
    throw error;
  }
};

// Campaigns
export type GoalDataSource = 'manual' | 'pledges' | 'meetings_membership' | 'meetings_leadership' | 'team_conversations';
export type GoalLevel = 'individual' | 'team' | 'organization';

export interface CampaignFromAPI {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  chapters: string[];
  parentCampaignId?: string;
  campaignType?: string;
  createdDate: string;
  goalTypes: Array<{
    id: string;
    name: string;
    description: string;
    totalTarget: number;
    unit: string;
    dataSource?: GoalDataSource;
    level?: GoalLevel;
  }>;
  milestones: Array<{
    id: string;
    date: string;
    description: string;
    goalTypeTargets: { [goalType: string]: number };
  }>;
}

export const fetchCampaigns = async (): Promise<CampaignFromAPI[]> => {
  try {
    const response = await fetch(`${API_URL}/campaigns`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch campaigns');
    }
    
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return []; // Return empty array on error, don't crash the app
  }
};

export const createCampaign = async (campaignData: any): Promise<{ campaign_id: string }> => {
  try {
    const response = await fetch(`${API_URL}/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(campaignData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create campaign');
    }
    
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error creating campaign:', error);
    throw error;
  }
};

export const updateCampaign = async (campaignId: string, campaignData: any): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/campaigns/${campaignId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(campaignData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update campaign');
    }
  } catch (error) {
    console.error('Error updating campaign:', error);
    throw error;
  }
};

export const deleteCampaign = async (campaignId: string): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/campaigns/${campaignId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete campaign');
    }
  } catch (error) {
    console.error('Error deleting campaign:', error);
    throw error;
  }
}; 