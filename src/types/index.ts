export interface UserMapData {
  userid: string;
  username: string;
  firstname: string;
  lastname: string;
  canvassername: string;
  email: string;
  api_user: boolean;
}

export interface NodeData {
  id: string;
  name: string;
  chapter: string;
  type: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  color?: string;
  is_external?: boolean;
  degree?: number;
}

export type DataSource = 'contacts' | 'meetings';

// MainApp types
export interface GraphNode {
  id: string;
  name: string;
  chapter: string;
  type?: string;
  color?: string;
  role?: string;
  vanid?: number;
  loeStatus?: string;
  teams?: string[];
  x: number;
  y: number;
  fx?: number | null;
  fy?: number | null;
  degree?: number;
  is_external?: boolean;
}

// Action template that defines a reusable action type for tracking people through steps
export interface CampaignActionField {
  key: string;
  label: string;
  type: 'boolean' | 'select' | 'text' | 'conversation';  // Field type
  options?: string[];  // For select fields
}

export interface CampaignAction {
  id: string;
  name: string;  // Action name (e.g., "Sign Pledge", "Join Team")
  fields: CampaignActionField[];  // Flexible fields with different types
  goalFieldKey?: string;      // Which field key to track for goal progress (e.g., "signed")
  parentCampaignId?: string;  // Optional - linked to parent campaign (can be null for standalone actions)
  goalTypeId?: string;        // Optional - linked to goal type (can be null)
  chapters: string[];         // Which chapters can use this action (empty = all chapters)
  creatorOrganizerVanid?: string;     // Who created this action
  visibleToOrganizers?: string[];     // Who can see/use this action (empty/null = everyone)
  hasGoal?: boolean;          // Whether this action has a goal/barometer (false = just a count)
  targetAudience?: 'constituent' | 'leadership';  // Whether this action tracks constituents or leaders
  isTemplate?: boolean;       // If true, this is a campaign-level action template
  templateActionId?: string;  // If set, this personal action is based on a template
  defaultIndividualGoal?: number;  // Default goal for individuals (e.g., 5)
  // Rate-based and deadline fields
  actionType?: 'one_time' | 'rate_based';  // Whether this is a one-time action or recurring
  recurrencePeriod?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';  // How often it recurs
  recurrenceCount?: number;  // How many per period (e.g., 5 per week)
  deadlineDate?: string;  // Optional deadline (ISO date string)
  deadlineType?: 'soft' | 'hard';  // Whether deadline is flexible or strict
  timeTrackingEnabled?: boolean;  // Whether to track completion times
}

// Campaign timeline event/milestone (used by CampaignLineGraph for visualization)
export interface CampaignEvent {
  id: string;
  date: string;
  purpose: string;
  campaign: string;
  goal: number;
  chapter: string;
  parentCampaignId?: string;
  goalType?: string;
  isParentCampaign?: boolean;
  milestone?: string;
}

export interface GraphLink {
  id?: string;
  source: GraphNode | string;
  target: GraphNode | string;
  date?: Date;
  type?: string;
  result?: string;
  utc_datecanvassed?: string;
  contact_type?: string;
  contact_result?: string;
  linkSource?: 'meetings' | 'teams' | 'contacts' | 'org' | 'people_table';
  meetingId?: string;
  meetingCount?: number;
  twoOnOneRole?: 'organizer' | 'host';
  teamName?: string;
  teams?: string[];
}

export type VisualizationType = 'people' | 'teams' | 'campaign';
export type ViewModeType = 'federation' | 'dashboard';
export type RightPanelViewType = 'meetings' | 'people' | 'teams' | 'campaigns'; 