// Service for handling teams data from BigQuery
export interface TeamMemberWithRoles {
  id: string;
  name: string;
  constituentRole?: string;
  functionalRole?: string;
  dateAdded?: string;
  isActive: boolean;
}

export interface BigQueryTeam {
  id: string;
  teamName: string;
  teamLead: string;
  chapter: string;
  teamMembers: string[];
  teamMembersWithRoles?: TeamMemberWithRoles[]; // New field with role data
  turf: string;
  dateCreated: string;
  dateDisbanded: string;
  color: string;
  sharedPurpose?: string;
  norms?: string;
  normCorrection?: string;
  constituency?: string;
  isActive: boolean;
  rowNumber: number;
}

export interface TeamChangeLogEntry {
  change_id: string;
  team_id: string;
  changed_at: string;
  changed_by_vanid?: string;
  changed_by_name: string;
  field_name: string;
  old_value?: string;
  new_value?: string;
  change_reason?: string;
  change_type: 'create' | 'update' | 'disband' | 'delete';
}

export interface TeamsResponse {
  success: boolean;
  teams: BigQueryTeam[];
  count: number;
}

export interface PersonRecord {
  id: string;
  name: string;
  type?: string;
  chapter: string; // Required to match local PersonRecord
  mostRecentContact: Date | null;
  totalMeetings: number;
  latestNotes: string;
  email?: string;
  phone?: string;
  organizers: string[];
  loeStatus?: string;
  allMeetings: any[];
  // Additional properties for compatibility
  vanId?: string;
  userId?: string;
  // Team role properties
  constituentRole?: string;
  functionalRole?: string;
}

export interface EnhancedTeamData {
  id: string;
  teamName: string;
  chapter: string;
  organizers: PersonRecord[];
  lead: PersonRecord | null;
  turf?: string;
  sharedPurpose?: string;
  norms?: string;
  normCorrection?: string;
  constituency?: string;
  isCustom: boolean;
  dateCreated?: string;
  isActive: boolean;
  bigQueryData: BigQueryTeam;
}

class TeamsService {
  /**
   * Fetch teams from BigQuery via API
   */
  async fetchTeamsFromBigQuery(): Promise<BigQueryTeam[]> {
    try {
      const response = await fetch('/api/teams');
      const data: TeamsResponse = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to fetch teams from API');
      }
      
      return data.teams;
    } catch (error) {
      return [];
    }
  }

  /**
   * Match a person name with available people data
   * Tries to find by exact name match first, then partial matches
   */
  findPersonByName(
    name: string,
    allPeople: PersonRecord[],
    contacts: any[] = [],
    orgIds: any[] = []
  ): PersonRecord | null {
    if (!name || !name.trim()) return null;
    
    const searchName = name.trim().toLowerCase();
    
    // Try exact match in allPeople first
    let person = allPeople.find(p => 
      p.name && p.name.toLowerCase() === searchName
    );
    
    if (person) return person;
    
    // Try partial match in allPeople
    person = allPeople.find(p => 
      p.name && (
        p.name.toLowerCase().includes(searchName) ||
        searchName.includes(p.name.toLowerCase())
      )
    );
    
    if (person) return person;
    
    // Try to find in contacts data
    const contact = contacts.find(c => {
      const fullName = `${c.firstname || ''} ${c.lastname || ''}`.trim().toLowerCase();
      return fullName === searchName || 
             fullName.includes(searchName) || 
             searchName.includes(fullName);
    });
    
    if (contact) {
      return {
        id: contact.id || contact.vanid || `contact_${Math.random()}`,
        name: `${contact.firstname || ''} ${contact.lastname || ''}`.trim() || name,
        type: 'contact',
        chapter: contact.chapter || 'Unknown',
        vanId: contact.vanid?.toString(),
        email: contact.email,
        phone: contact.phone,
        mostRecentContact: null,
        totalMeetings: 0,
        latestNotes: '',
        organizers: [],
        loeStatus: contact.loe || 'Unknown',
        allMeetings: []
      };
    }
    
    // Try to find in orgIds data
    const orgPerson = orgIds.find(o => {
      const fullName = `${o.firstname || ''} ${o.lastname || ''}`.trim().toLowerCase();
      return fullName === searchName || 
             fullName.includes(searchName) || 
             searchName.includes(fullName);
    });
    
    if (orgPerson) {
      return {
        id: orgPerson.userid || orgPerson.vanid || `org_${Math.random()}`,
        name: `${orgPerson.firstname || ''} ${orgPerson.lastname || ''}`.trim() || name,
        type: orgPerson.type || 'organizer',
        vanId: orgPerson.vanid?.toString(),
        userId: orgPerson.userid?.toString(),
        chapter: orgPerson.chapter || 'Unknown',
        email: orgPerson.email,
        phone: orgPerson.phone,
        mostRecentContact: null,
        totalMeetings: 0,
        latestNotes: '',
        organizers: [],
        loeStatus: orgPerson.loe_status || 'Unknown',
        allMeetings: []
      };
    }
    
    // If no match found, create a placeholder person
    return {
      id: `unknown_${Math.random().toString(36).substr(2, 9)}`,
      name: name,
      type: 'unknown',
      chapter: 'Unknown',
      mostRecentContact: null,
      totalMeetings: 0,
      latestNotes: '',
      organizers: [],
      loeStatus: 'Unknown',
      allMeetings: []
    };
  }

  /**
   * Convert BigQuery teams to enhanced team data
   */
  convertBigQueryTeamsToTeamData(
    bigQueryTeams: BigQueryTeam[],
    allPeople: PersonRecord[],
    contacts: any[] = [],
    orgIds: any[] = []
  ): EnhancedTeamData[] {
    return bigQueryTeams
      .filter(team => team.isActive)
      .map(team => {
        const withRoles = team.teamMembersWithRoles ?? [];

        // Helper: find richer person data by vanid from allPeople/contacts/orgIds
        const enrichById = (vanid: string): Partial<PersonRecord> => {
          const byId = allPeople.find(p => p.id === vanid || p.vanId === vanid);
          if (byId) return byId;
          const c = contacts.find(c => c.vanid?.toString() === vanid);
          if (c) return {
            id: vanid,
            chapter: c.chapter || 'Unknown',
            email: c.email,
            loeStatus: c.loe || 'Unknown',
            type: 'contact',
          };
          const o = orgIds.find((o: any) => o.vanid?.toString() === vanid);
          if (o) return {
            id: vanid,
            chapter: o.chapter || 'Unknown',
            email: o.email,
            type: o.type || 'organizer',
          };
          return {};
        };

        let uniqueOrganizers: PersonRecord[];
        let teamLead: PersonRecord | null;

        if (withRoles.length > 0) {
          // Primary path: build organizers directly from lumoviz_team_members rows.
          // This is reliable because it uses the stored vanid, not a fragile name match.
          uniqueOrganizers = withRoles.map(member => {
            const extra = enrichById(member.id);
            return {
              id: member.id,
              name: member.name,
              type: extra.type || 'contact',
              chapter: extra.chapter || 'Unknown',
              email: extra.email,
              loeStatus: (extra as any).loeStatus || 'Unknown',
              mostRecentContact: null,
              totalMeetings: 0,
              latestNotes: '',
              organizers: [],
              allMeetings: [],
              // Roles always come from the DB record — never overridden by enrichById
              constituentRole: member.constituentRole,
              functionalRole: member.functionalRole,
            } as PersonRecord;
          });

          // Team lead: only set if the DB has an explicit team_leader value
          if (team.teamLead?.trim()) {
            const leadFromRoles = withRoles.find(m =>
              m.name.toLowerCase() === team.teamLead.toLowerCase()
            ) || withRoles.find(m =>
              m.functionalRole?.toLowerCase().includes('lead')
            );
            teamLead = leadFromRoles
              ? (uniqueOrganizers.find(o => o.id === leadFromRoles.id) ?? null)
              : this.findPersonByName(team.teamLead, allPeople, contacts, orgIds);
          } else {
            teamLead = null;
          }

        } else {
          // Fallback path: no lumoviz_team_members data yet — use name-based lookup.
          teamLead = this.findPersonByName(team.teamLead, allPeople, contacts, orgIds);
          const teamMembers = team.teamMembers
            .filter(name => name?.trim())
            .map(name => this.findPersonByName(name, allPeople, contacts, orgIds))
            .filter(Boolean) as PersonRecord[];
          const allOrganizers = teamLead ? [teamLead, ...teamMembers] : teamMembers;
          uniqueOrganizers = allOrganizers.filter(
            (person, idx, arr) => arr.findIndex(p => p.id === person.id) === idx
          );
        }

        return {
          id: team.id,
          teamName: team.teamName,
          chapter: team.chapter,
          organizers: uniqueOrganizers,
          lead: teamLead,
          turf: team.turf,
          sharedPurpose: team.sharedPurpose,
          norms: team.norms,
          normCorrection: team.normCorrection,
          constituency: team.constituency,
          isCustom: false,
          dateCreated: team.dateCreated,
          isActive: team.isActive,
          bigQueryData: team
        };
      });
  }

  /**
   * Main method to load and enhance teams from BigQuery
   */
  async loadEnhancedTeams(
    allPeople: PersonRecord[],
    contacts: any[] = [],
    orgIds: any[] = []
  ): Promise<EnhancedTeamData[]> {
    try {
      
      const bigQueryTeams = await this.fetchTeamsFromBigQuery();
      const enhancedTeams = this.convertBigQueryTeamsToTeamData(
        bigQueryTeams,
        allPeople,
        contacts,
        orgIds
      );
      
      return enhancedTeams;
      
    } catch (error) {
      return [];
    }
  }

  /**
   * Create a new team via API
   */
  async createTeam(teamData: {
    teamName: string;
    teamLead: string;
    teamLeadData?: { id: string; name: string; constituentRole?: string; functionalRole?: string };
    chapter: string;
    teamMembers: string[];
    teamMembersData?: Array<{ id: string; name: string; constituentRole?: string; functionalRole?: string }>;
    turf?: string;
    color?: string;
    sharedPurpose?: string;
    norms?: string;
    normCorrection?: string;
    constituency?: string;
    createdBy?: { vanid?: string; name?: string };
    changeReason?: string;
  }): Promise<{ success: boolean; teamId?: string; error?: string }> {
    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(teamData),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create team');
      }

      return { success: true, teamId: result.teamId };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update an existing team via API
   */
  async updateTeam(
    teamId: string, 
    teamData: {
      teamName?: string;
      teamLead?: string;
      chapter?: string;
      teamMembers?: string[];
      turf?: string;
      color?: string;
      sharedPurpose?: string;
      norms?: string;
      normCorrection?: string;
      constituency?: string;
      organizerDetails?: Array<{ id: string; name: string; constituentRole?: string; functionalRole?: string }>;
      version?: string;
      dateCreated?: string;
      updatedBy?: { vanid?: string; name?: string };
      changeReason?: string;
    }
  ): Promise<{ success: boolean; version?: string; error?: string }> {
    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(teamData),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update team');
      }

      return { success: true, version: result.version };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Disband a team (sets date_disbanded to today)
   */
  async disbandTeam(
    teamId: string, 
    options?: {
      disbandedBy?: { vanid?: string; name?: string };
      changeReason?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`/api/teams/${teamId}/disband`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options || {}),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to disband team');
      }

      return { success: true };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch changelog for a team
   */
  async fetchTeamChangelog(teamId: string): Promise<{ 
    success: boolean; 
    changelog?: TeamChangeLogEntry[]; 
    error?: string 
  }> {
    try {
      const response = await fetch(`/api/teams/${teamId}/changelog`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch changelog');
      }

      return { success: true, changelog: result.changelog };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete a team completely (cannot be undone)
   */
  async deleteTeam(teamId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete team');
      }

      return { success: true };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update chapter color via API
   */
  async updateChapterColor(
    chapterName: string,
    color: string
  ): Promise<{ success: boolean; updatedCount?: number; teams?: string[]; error?: string }> {
    try {
      const response = await fetch(`/api/chapters/${encodeURIComponent(chapterName)}/color`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ color }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update chapter color');
      }

      return { 
        success: true, 
        updatedCount: result.updatedCount,
        teams: result.teams
      };
      
    } catch (error) {
      console.error('❌ Error updating chapter color:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const teamsService = new TeamsService();
export default teamsService;
