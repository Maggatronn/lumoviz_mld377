const express = require('express');
const cors = require('cors');
const database = require('./database'); // Database abstraction layer (PostgreSQL)
const pool = require('./db'); // Direct PostgreSQL pool access
const { listAvailableDatasets, listTablesInDataset } = require('./utils');
const path = require('path');
require('dotenv').config();

// For backward compatibility, create bigquery alias
const bigquery = database;

// PostgreSQL doesn't need PROJECT_ID/DATASET_ID (kept for reference in queries)
const PROJECT_ID = process.env.PROJECT_ID || 'lumoviz-production';
const DATASET_ID = 'lumoviz';
const MOCK_USER_EMAIL = process.env.MOCK_USER_EMAIL || 'courtney@carolinafederation.org';

// Admin emails that get full access (checked via substring match)
const ADMIN_EMAILS = [
  'mhughes4@media.mit.edu',
  'eslin@hks.harvard.edu', 
  'emily.s.lin@gmail.com',
  'courtney@carolinafederation.org',
  'sam@carolinafederation.org',
  'ashley@carolinafederation.org'
];

const fs = require('fs');

const app = express();
const port = process.env.PORT || 3003;

// Teams data now comes from BigQuery instead of Google Sheets

// CORS configuration
const corsOptions = {
  origin: [
    'https://lumoviz.carolinafederation.org',
    /\.run\.app$/,   // any Cloud Run URL
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'public')));

// API health check route
app.get('/api/health', (req, res) => {
  const healthStatus = {
    message: 'Carolina Federation Symposium API Server', 
    status: 'running',
    port: port,
    timestamp: new Date().toISOString(),
    bigquery: bigquery ? 'initialized' : 'not initialized',
    environment: {
      hasCredentialsFile: fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS),
    },
    endpoints: [
      '/api/chapters',
      '/api/contacts',
      '/api/idmappings',
      // '/api/links', 
      '/api/network-data',
      '/api/meetings',
      '/api/org-ids',
      // '/api/org-ids-simple',
      // '/api/analytics/events',
      '/api/teams'
    ]
  };
  
  console.log('🏥 Health check requested:', healthStatus);
  res.json(healthStatus);
});

// Analytics endpoint to store events
app.post('/api/analytics/events', async (req, res) => {
  try {
    const { events } = req.body;
    
    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Events array is required' });
    }

    // Prepare events for BigQuery insertion
    const formattedEvents = events.map(event => ({
      event_type: event.event_type,
      user_id: event.user_id || null,
      session_id: event.session_id,
      timestamp: event.timestamp,
      properties: JSON.stringify(event.properties),
      page_url: event.page_url,
      user_agent: event.user_agent,
      inserted_at: new Date().toISOString()
    }));

    // Insert into BigQuery analytics table (reuse the main bigquery client)

    await bigquery
      .dataset(DATASET_ID)
      .table('analytics_events')
      .insert(formattedEvents);
    
    // console.log(`Successfully inserted ${events.length} analytics events`);
    res.json({ success: true, eventsInserted: events.length });
    
  } catch (error) {
    console.error('Error inserting analytics events:', error);
    res.status(500).json({ error: error.message });
  }
});

// Alternative analytics endpoint for file logging
app.post('/api/analytics/log', async (req, res) => {
  try {
    const { events } = req.body;
    
    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Events array is required' });
    }

    const fs = require('fs');
    const path = require('path');
    
    // Create logs directory if it doesn't exist
    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir);
    }

    // Create log file with current date
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logsDir, `analytics-${today}.log`);

    // Format events for logging
    const logEntries = events.map(event => {
      return JSON.stringify({
        ...event,
        logged_at: new Date().toISOString()
      });
    });

    // Append to log file
    fs.appendFileSync(logFile, logEntries.join('\n') + '\n');
    
    // console.log(`Successfully logged ${events.length} analytics events to ${logFile}`);
    res.json({ success: true, eventsLogged: events.length, logFile });
    
  } catch (error) {
    // console.error('Error logging analytics events:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current user info from IAP headers
app.get('/api/user-info', (req, res) => {
  try {
    const isLocalhost = req.headers.host?.includes('localhost') || req.headers.host?.includes('127.0.0.1');
    const userJWT = req.headers['x-goog-iap-jwt-0'];
    
    if (userJWT) {
      const payload = JSON.parse(Buffer.from(userJWT.split('.')[1], 'base64').toString());
      return res.json({
        email: payload.email,
        userId: payload.sub,
        name: payload.name,
        picture: payload.picture,
        isAdmin: isAdmin(payload.email),
        environment: 'production'
      });
    }
    
    if (isLocalhost) {
      return res.json({
        email: MOCK_USER_EMAIL,
        userId: 'dev-user',
        name: MOCK_USER_EMAIL.split('@')[0],
        isAdmin: isAdmin(MOCK_USER_EMAIL),
        environment: 'development'
      });
    }
    
    res.json({ email: null, userId: null, environment: 'production' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== TEAMS API ENDPOINTS =====

// Test BigQuery connection for teams
app.get('/api/teams/test', async (req, res) => {
  try {
    console.log('Testing PostgreSQL teams table: lumoviz_teams');
    const [rows] = await database.query(`SELECT COUNT(*) as count FROM lumoviz_teams`);
    res.json({
      success: true,
      message: 'PostgreSQL teams table accessible',
      teamCount: rows[0].count,
      database: 'PostgreSQL - lumoviz_teams'
    });
  } catch (error) {
    console.error('Teams connection test error:', error);
    console.error('Full error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to connect to PostgreSQL teams table',
      details: error.message,
      database: 'PostgreSQL - lumoviz_teams'
    });
  }
});

// Helper function to log team changes to PostgreSQL
async function logTeamChange(teamId, changedByVanid, changedByName, fieldName, oldValue, newValue, changeReason, changeType = 'update') {
  try {
    const query = `
      INSERT INTO lumoviz_team_changelog
      (team_id, changed_by_vanid, changed_by_name, field_name, old_value, new_value, change_reason, change_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    await pool.query(query, [
      teamId,
      changedByVanid || null,
      changedByName || 'System',
      fieldName,
      oldValue || null,
      newValue || null,
      changeReason || null,
      changeType
    ]);
  } catch (error) {
    console.error('Error logging team change:', error);
    // Don't throw - we don't want logging errors to block the actual update
  }
}

// Get all teams from PostgreSQL
app.get('/api/teams', async (req, res) => {
  try {
    console.log('[/api/teams] Fetching teams from PostgreSQL...');
    const query = `
      SELECT 
        id,
        team_name,
        team_leader,
        chapter,
        team_members,
        turf,
        date_created,
        date_disbanded,
        color,
        shared_purpose,
        norms,
        norm_correction,
        constituency,
        CASE WHEN date_disbanded IS NULL THEN true ELSE false END as is_active
      FROM lumoviz_teams
      ORDER BY date_created DESC
    `;
    
    const result = await pool.query(query);
    const rows = result.rows;
    console.log('[/api/teams] Found', rows.length, 'teams');
    
    // Fetch team members with roles for all teams
    const membersQuery = `
      SELECT 
        team_id,
        member_vanid,
        member_name,
        constituent_role,
        functional_role,
        date_added,
        is_active
      FROM lumoviz_team_members
      WHERE is_active = TRUE
      ORDER BY team_id, date_added
    `;
    const membersResult = await pool.query(membersQuery);
    console.log('[/api/teams] Found', membersResult.rows.length, 'team members with roles');
    
    // Group members by team_id
    const membersByTeam = {};
    membersResult.rows.forEach(member => {
      if (!membersByTeam[member.team_id]) {
        membersByTeam[member.team_id] = [];
      }
      membersByTeam[member.team_id].push({
        id: member.member_vanid,
        name: member.member_name,
        constituentRole: member.constituent_role,
        functionalRole: member.functional_role,
        dateAdded: member.date_added,
        isActive: member.is_active
      });
    });
    
    // Convert PostgreSQL results to expected format
    const teams = rows.map(row => ({
      id: row.id,
      teamName: row.team_name,
      teamLead: row.team_leader,
      chapter: row.chapter,
      teamMembers: row.team_members ? row.team_members.split(', ').filter(m => m.trim()) : [],
      teamMembersWithRoles: membersByTeam[row.id] || [], // Include full member data with roles
      turf: row.turf,
      dateCreated: row.date_created,
      dateDisbanded: row.date_disbanded,
      color: row.color,
      sharedPurpose: row.shared_purpose,
      norms: row.norms,
      normCorrection: row.norm_correction,
      constituency: row.constituency,
      isActive: row.is_active
    }));
    
    res.json({
      success: true,
      teams: teams,
      count: teams.length
    });
  } catch (error) {
    console.error('Error getting teams:', error);
    console.error('Full error details:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get teams from BigQuery',
      details: error.message,
      dataset: 'lumoviz_teams'
    });
  }
});

// Create a new team
app.post('/api/teams', async (req, res) => {
  try {
    const { teamName, teamLead, teamLeadData, chapter, teamMembers, teamMembersData, turf, color, sharedPurpose, norms, normCorrection, constituency, createdBy, changeReason } = req.body;
    
    // Validation
    if (!teamName?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Team name is required'
      });
    }
    
    if (!chapter?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Chapter is required'
      });
    }
    
    const teamData = {
      teamName: teamName.trim(),
      teamLead: teamLead?.trim() || '',
      chapter: chapter.trim(),
      teamMembers: Array.isArray(teamMembers) ? teamMembers : [teamMembers].filter(Boolean),
      turf: turf?.trim() || '',
      color: color || '',
      sharedPurpose: sharedPurpose?.trim() || '',
      norms: norms?.trim() || '',
      normCorrection: normCorrection?.trim() || '',
      constituency: constituency?.trim() || ''
    };
    
    console.log('[POST /api/teams] Creating new team:', teamData);
    console.log('[POST /api/teams] teamLeadData:', JSON.stringify(teamLeadData, null, 2));
    console.log('[POST /api/teams] teamMembersData:', JSON.stringify(teamMembersData, null, 2));
    console.log('[POST /api/teams] Full request body:', JSON.stringify(req.body, null, 2));
    
    // Generate unique team ID and insert into PostgreSQL
    const teamId = `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const membersString = Array.isArray(teamData.teamMembers) ? teamData.teamMembers.join(', ') : (teamData.teamMembers || '');
    const currentDate = new Date().toISOString().split('T')[0];
    
    const query = `
      INSERT INTO lumoviz_teams 
      (id, team_name, team_leader, chapter, team_members, turf, date_created, date_disbanded, color, shared_purpose, norms, norm_correction, constituency)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `;
    
    await pool.query(query, [
      teamId,
      teamData.teamName,
      teamData.teamLead,
      teamData.chapter,
      membersString,
      teamData.turf || '',
      currentDate,
      null, // date_disbanded
      teamData.color || '',
      teamData.sharedPurpose || '',
      teamData.norms || '',
      teamData.normCorrection || '',
      teamData.constituency || ''
    ]);
    
    console.log('[POST /api/teams] About to check team members...');
    console.log('[POST /api/teams] teamLeadData exists?', !!teamLeadData);
    console.log('[POST /api/teams] teamMembersData exists?', !!teamMembersData);
    console.log('[POST /api/teams] teamMembersData length:', teamMembersData?.length);
    
    // Insert team members with roles into lumoviz_team_members table
    if (teamLeadData || (teamMembersData && teamMembersData.length > 0)) {
      const memberInserts = [];
      
      // Add team lead with roles
      if (teamLeadData && teamLeadData.id) {
        console.log('[POST /api/teams] Adding team lead to members:', teamLeadData);
        memberInserts.push({
          team_id: teamId,
          member_vanid: teamLeadData.id,
          member_name: teamLeadData.name,
          constituent_role: teamLeadData.constituentRole || null,
          functional_role: teamLeadData.functionalRole || 'Team Lead'
        });
      }
      
      // Add team members with roles
      if (teamMembersData && Array.isArray(teamMembersData)) {
        teamMembersData.forEach(member => {
          if (member.id) {
            console.log('[POST /api/teams] Adding team member:', member);
            memberInserts.push({
              team_id: teamId,
              member_vanid: member.id,
              member_name: member.name,
              constituent_role: member.constituentRole || null,
              functional_role: member.functionalRole || null
            });
          }
        });
      }
      
      // Bulk insert team members into PostgreSQL
      if (memberInserts.length > 0) {
        console.log('[POST /api/teams] Inserting', memberInserts.length, 'team members with roles');
        const memberQuery = `
          INSERT INTO lumoviz_team_members
          (team_id, member_vanid, member_name, constituent_role, functional_role, date_added, is_active)
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, TRUE)
        `;
        
        // Insert each member individually
        for (const member of memberInserts) {
          await pool.query(memberQuery, [
            member.team_id,
            member.member_vanid,
            member.member_name,
            member.constituent_role,
            member.functional_role
          ]);
          console.log('[POST /api/teams] Inserted member:', member.member_name, 'with roles:', {
            constituent: member.constituent_role,
            functional: member.functional_role
          });
        }
      }
    }
    
    // Log the team creation
    await logTeamChange(
      teamId,
      createdBy?.vanid,
      createdBy?.name || 'System',
      'team_created',
      null,
      JSON.stringify({ teamName: teamData.teamName, chapter: teamData.chapter }),
      changeReason || 'Team created',
      'create'
    );
    
    const result = {
      success: true,
      teamId: teamId,
      data: {
        id: teamId,
        team_name: teamData.teamName,
        team_leader: teamData.teamLead,
        chapter: teamData.chapter,
        team_members: membersString,
        turf: teamData.turf || '',
        date_created: currentDate,
        date_disbanded: '',
        color: teamData.color || '',
        shared_purpose: teamData.sharedPurpose || '',
        norms: teamData.norms || '',
        norm_correction: teamData.normCorrection || '',
        constituency: teamData.constituency || ''
      }
    };
    
    res.json({
      success: true,
      teamId: result.teamId,
      message: 'Team created successfully',
      data: result.data
    });
    
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create team',
      details: error.message || String(error)
    });
  }
});

// Update an existing team
app.put('/api/teams/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const updateData = req.body;
    const { updatedBy, changeReason } = updateData;

    if (!teamId) {
      return res.status(400).json({ success: false, error: 'Team ID is required' });
    }

    // Fetch current team from PostgreSQL for change logging
    const fetchResult = await pool.query('SELECT * FROM lumoviz_teams WHERE id = $1', [teamId]);
    if (fetchResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Team not found' });
    }
    const oldTeam = fetchResult.rows[0];

    // Build dynamic UPDATE for lumoviz_teams
    const setClauses = [];
    const pgParams = [teamId]; // $1 = teamId for WHERE clause
    let paramIdx = 2;

    const fieldMap = {};
    const addField = (col, val, logKey) => {
      setClauses.push(`${col} = $${paramIdx++}`);
      pgParams.push(val);
      if (logKey) fieldMap[logKey] = { old: oldTeam[col], new: val };
    };

    if (updateData.teamName      !== undefined) addField('team_name',       updateData.teamName,      'team_name');
    if (updateData.teamLead      !== undefined) addField('team_leader',     updateData.teamLead,      'team_leader');
    if (updateData.chapter       !== undefined) addField('chapter',         updateData.chapter,       'chapter');
    if (updateData.turf          !== undefined) addField('turf',            updateData.turf,          'turf');
    if (updateData.color         !== undefined) addField('color',           updateData.color,         'color');
    if (updateData.sharedPurpose !== undefined) addField('shared_purpose',  updateData.sharedPurpose, 'shared_purpose');
    if (updateData.norms         !== undefined) addField('norms',           updateData.norms,         'norms');
    if (updateData.normCorrection!== undefined) addField('norm_correction', updateData.normCorrection,'norm_correction');
    if (updateData.constituency  !== undefined) addField('constituency',    updateData.constituency,  'constituency');
    if (updateData.dateDisbanded !== undefined) addField('date_disbanded',  updateData.dateDisbanded, 'date_disbanded');

    if (updateData.teamMembers !== undefined) {
      const membersString = Array.isArray(updateData.teamMembers)
        ? updateData.teamMembers.join(', ')
        : (updateData.teamMembers || '');
      addField('team_members', membersString, 'team_members');
    }

    if (setClauses.length > 0) {
      const updateQuery = `UPDATE lumoviz_teams SET ${setClauses.join(', ')} WHERE id = $1`;
      await pool.query(updateQuery, pgParams);
    }

    // Log changed fields
    for (const [fieldName, values] of Object.entries(fieldMap)) {
      if (String(values.old ?? '') !== String(values.new ?? '')) {
        await logTeamChange(
          teamId,
          updatedBy?.vanid,
          updatedBy?.name || 'System',
          fieldName,
          String(values.old ?? ''),
          String(values.new ?? ''),
          changeReason,
          'update'
        );
      }
    }

    // Replace team members with roles in lumoviz_team_members
    if (updateData.organizerDetails && Array.isArray(updateData.organizerDetails)) {
      // Remove existing active member rows for this team and re-insert fresh
      await pool.query('DELETE FROM lumoviz_team_members WHERE team_id = $1', [teamId]);

      for (const organizer of updateData.organizerDetails) {
        if (!organizer.id) continue;
        await pool.query(
          `INSERT INTO lumoviz_team_members
             (team_id, member_vanid, member_name, constituent_role, functional_role, date_added, is_active)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, TRUE)`,
          [
            teamId,
            organizer.id,
            organizer.name,
            organizer.constituentRole || null,
            organizer.functionalRole  || null
          ]
        );
        console.log(`[PUT /api/teams] Saved member ${organizer.name}: constituent=${organizer.constituentRole}, functional=${organizer.functionalRole}`);
      }
    }

    res.json({ success: true, teamId, message: 'Team updated successfully' });

  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ success: false, error: 'Failed to update team', details: error.message });
  }
});

// Disband a team (set date_disbanded)
app.patch('/api/teams/:teamId/disband', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { disbandedBy, changeReason } = req.body;
    const currentDate = new Date().toISOString().split('T')[0];
    
    const query = `
      UPDATE \`${PROJECT_ID}.${DATASET_ID}.lumoviz_teams\`
      SET date_disbanded = @dateDisbanded
      WHERE id = @teamId
    `;
    
    const options = {
      query: query,
      params: {
        teamId: teamId,
        dateDisbanded: currentDate
      },
      types: {
        teamId: 'STRING',
        dateDisbanded: 'STRING'
      }
    };
    
    await bigquery.query(options);
    
    // Log the disbandment
    await logTeamChange(
      teamId,
      disbandedBy?.vanid,
      disbandedBy?.name || 'System',
      'date_disbanded',
      null,
      currentDate,
      changeReason || 'Team disbanded',
      'disband'
    );
    
    res.json({
      success: true,
      message: 'Team disbanded successfully',
      teamId: teamId,
      dateDisbanded: currentDate
    });
    
  } catch (error) {
    console.error('Error disbanding team:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disband team',
      details: error.message || String(error)
    });
  }
});

// Get changelog for a team
app.get('/api/teams/:teamId/changelog', async (req, res) => {
  try {
    const { teamId } = req.params;
    
    if (!teamId) {
      return res.status(400).json({
        success: false,
        error: 'Team ID is required'
      });
    }
    
    const query = `
      SELECT 
        change_id,
        team_id,
        changed_at,
        changed_by_vanid,
        changed_by_name,
        field_name,
        old_value,
        new_value,
        change_reason,
        change_type
      FROM \`${PROJECT_ID}.${DATASET_ID}.lumoviz_team_changelog\`
      WHERE team_id = @teamId
      ORDER BY changed_at DESC
    `;
    
    const [rows] = await bigquery.query({ query, params: { teamId } });
    
    res.json({
      success: true,
      changelog: rows
    });
    
  } catch (error) {
    console.error('Error fetching team changelog:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team changelog',
      details: error.message
    });
  }
});

// Delete a team completely
app.delete('/api/teams/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    
    const query = `
      DELETE FROM \`${PROJECT_ID}.${DATASET_ID}.lumoviz_teams\`
      WHERE id = @teamId
    `;
    
    const options = {
      query: query,
      params: {
        teamId: teamId
      },
      types: {
        teamId: 'STRING'
      }
    };
    
    await bigquery.query(options);
    
    res.json({
      success: true,
      message: 'Team deleted successfully',
      teamId: teamId
    });
    
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete team',
      details: error.message || String(error)
    });
  }
});

// Update chapter color
app.put('/api/chapters/:chapterName/color', async (req, res) => {
  try {
    const { chapterName } = req.params;
    const { color } = req.body;
    
    if (!chapterName) {
      return res.status(400).json({
        success: false,
        error: 'Chapter name is required'
      });
    }
    
    if (!color) {
      return res.status(400).json({
        success: false,
        error: 'Color is required'
      });
    }
    
    // console.log(`🎨 Updating color for chapter ${chapterName} to ${color}`);
    
    // Update color for all teams in this chapter
    const query = `
      UPDATE \`${PROJECT_ID}.${DATASET_ID}.lumoviz_teams\` 
      SET color = @color
      WHERE chapter = @chapter
    `;
    
    const [job] = await bigquery.query({
      query,
      params: { color, chapter: chapterName }
    });
    
    // Get the number of affected rows
    const stats = job.statistics;
    const updatedCount = stats && stats.dmlStats ? stats.dmlStats.updatedRowCount : 0;
    
    const result = { 
      success: true, 
      updatedCount: parseInt(updatedCount) || 0,
      chapter: chapterName,
      color: color
    };
    
    res.json({
      success: true,
      message: `Color updated for chapter ${chapterName}`,
      updatedCount: result.updatedCount,
      teams: result.teams
    });
    
  } catch (error) {
    console.error('Error updating chapter color:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update chapter color',
      details: error.message
    });
  }
});

// Delete (disband) a team
app.delete('/api/teams/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    
    if (!teamId) {
      return res.status(400).json({
        success: false,
        error: 'Team ID is required'
      });
    }
    
    // console.log(`🗑️ Disbanding team ${teamId}`);
    
    // Mark team as disbanded instead of deleting
    const currentDate = new Date().toISOString().split('T')[0];
    const query = `
      UPDATE \`${PROJECT_ID}.${DATASET_ID}.lumoviz_teams\` 
      SET date_disbanded = @dateDisbanded
      WHERE id = @teamId
    `;
    
    await bigquery.query({
      query,
      params: { 
        teamId: teamId,
        dateDisbanded: currentDate
      }
    });
    
    const result = { success: true, teamId };
    
    res.json({
      success: true,
      teamId: teamId,
      message: 'Team disbanded successfully'
    });
    
  } catch (error) {
    // console.error('Error disbanding team:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disband team',
      details: error.message
    });
  }
});

// ===== END TEAMS API ENDPOINTS =====

// ===== TURF LIST API ENDPOINTS =====

// Add person to turf list (My Turf)
app.post('/api/turf-list', async (req, res) => {
  try {
    const { organizee, organizeeVanid, organizer, organizerVanid, action } = req.body;
    
    // Validation
    if (!organizee?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Organizee name is required'
      });
    }
    
    if (!organizeeVanid) {
      return res.status(400).json({
        success: false,
        error: 'Organizee VAN ID is required'
      });
    }
    
    if (!organizer?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Organizer name is required'
      });
    }
    
    if (!organizerVanid) {
      return res.status(400).json({
        success: false,
        error: 'Organizer VAN ID is required'
      });
    }
    
    // Check if this entry already exists
    const checkQuery = `
      SELECT COUNT(*) as count
      FROM \`${PROJECT_ID}.${DATASET_ID}.lumoviz_lists\`
      WHERE organizee_vanid = @organizeeVanid
        AND organizer_vanid = @organizerVanid
        AND action = @action
    `;
    
    const checkOptions = {
      query: checkQuery,
      params: {
        organizeeVanid: organizeeVanid,
        organizerVanid: organizerVanid.toString(),
        action: action || 'pledges'
      }
    };
    
    const [checkResults] = await bigquery.query(checkOptions);
    
    if (checkResults[0].count > 0) {
      return res.json({
        success: true,
        message: 'Entry already exists',
        alreadyExists: true
      });
    }
    
    // Insert into lumoviz_lists
    const insertQuery = `
      INSERT INTO \`${PROJECT_ID}.${DATASET_ID}.lumoviz_lists\` 
      (organizee, organizee_vanid, organizer, organizer_vanid, action)
      VALUES (@organizee, @organizeeVanid, @organizer, @organizerVanid, @action)
    `;
    
    const insertOptions = {
      query: insertQuery,
      params: {
        organizee: organizee.trim(),
        organizeeVanid: organizeeVanid,
        organizer: organizer.trim(),
        organizerVanid: organizerVanid.toString(),
        action: action || 'pledges'
      },
      types: {
        organizee: 'STRING',
        organizeeVanid: 'INT64',
        organizer: 'STRING',
        organizerVanid: 'STRING',
        action: 'STRING'
      }
    };
    
    await bigquery.query(insertOptions);
    
    res.json({
      success: true,
      message: 'Person added to turf list successfully',
      data: {
        organizee: organizee.trim(),
        organizeeVanid: organizeeVanid,
        organizer: organizer.trim(),
        organizerVanid: organizerVanid.toString(),
        action: action || 'pledges'
      }
    });
    
  } catch (error) {
    console.error('Error adding to turf list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add to turf list',
      details: error.message || String(error)
    });
  }
});

// ===== END TURF LIST API ENDPOINTS =====

// Route to list available datasets
app.get('/api/datasets', async (req, res) => {
  try {
    const datasets = await listAvailableDatasets();
    res.json(datasets);
  } catch (error) {
    // console.error('Error listing datasets:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route to list tables in a dataset
app.get('/api/tables/:dataset', async (req, res) => {
  try {
    const { dataset } = req.params;
    const tables = await listTablesInDataset(dataset);
    res.json(tables);
  } catch (error) {
    // console.error('Error listing tables:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== MIGRATED TO POSTGRESQL =====
// BigQuery initialization removed - now using PostgreSQL connection pool from db.js
// The pool is automatically initialized when required
console.log('✅ Using PostgreSQL database connection');

// ===== ORGANIZATIONAL ACCESS CONTROL FUNCTIONS =====

// Cache for org structure to avoid repeated queries
let orgStructureCache = null;
let orgCacheTimestamp = null;
const ORG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Function to get the complete organizational structure
async function getOrgStructure() {
  const now = Date.now();
  
  // Return cached data if it's still fresh
  if (orgStructureCache && orgCacheTimestamp && (now - orgCacheTimestamp) < ORG_CACHE_TTL) {
    return orgStructureCache;
  }
  
  try {
    // console.log('Fetching organizational structure from BigQuery...');
    
    const query = `
      SELECT 
        userid,
        vanid,
        supervisorid,
        firstname,
        lastname,
        type,
        turf,
        team_role
      FROM \`${PROJECT_ID}.${DATASET_ID}.org_ids\`
      WHERE userid IS NOT NULL
    `;
    
    const [rows] = await bigquery.query({ query });
    
    // Create maps for quick lookups
    const orgStructure = {
      userToSupervisor: new Map(), // userid -> supervisorid
      supervisorToUsers: new Map(), // supervisorid -> [userids]
      userToVanid: new Map(),      // userid -> vanid
      vanidToUser: new Map(),      // vanid -> userid
      userInfo: new Map()          // userid -> user info
    };
    
    rows.forEach(row => {
      const userid = row.userid?.toString();
      const vanid = row.vanid?.toString();
      const supervisorid = row.supervisorid?.toString();
      
      if (userid) {
        // Map user to supervisor
        if (supervisorid) {
          orgStructure.userToSupervisor.set(userid, supervisorid);
          
          // Map supervisor to users
          if (!orgStructure.supervisorToUsers.has(supervisorid)) {
            orgStructure.supervisorToUsers.set(supervisorid, []);
          }
          orgStructure.supervisorToUsers.get(supervisorid).push(userid);
        }
        
        // Map user to vanid and vice versa
        if (vanid) {
          orgStructure.userToVanid.set(userid, vanid);
          orgStructure.vanidToUser.set(vanid, userid);
        }
        
        // Store user info
        orgStructure.userInfo.set(userid, {
          userid,
          vanid,
          supervisorid,
          firstname: row.firstname,
          lastname: row.lastname,
          type: row.type
        });
      }
    });
    
    // Cache the structure
    orgStructureCache = orgStructure;
    orgCacheTimestamp = now;
    
    // console.log(`Loaded org structure: ${orgStructure.userInfo.size} users, ${orgStructure.supervisorToUsers.size} supervisors`);
    
    return orgStructure;
  } catch (error) {
    console.error('Error fetching org structure:', error);
    return null;
  }
}

// Get all accessible user/van IDs for a given user based on org hierarchy
async function getAccessibleIds(loggedInUserId) {
  const orgStructure = await getOrgStructure();
  if (!orgStructure) return new Set();
  
  const accessibleIds = new Set();
  
  function addSubordinates(supervisorId) {
    accessibleIds.add(supervisorId);
    const vanid = orgStructure.userToVanid.get(supervisorId);
    if (vanid) accessibleIds.add(vanid);
    const subordinates = orgStructure.supervisorToUsers.get(supervisorId) || [];
    subordinates.forEach(addSubordinates);
  }
  
  addSubordinates(loggedInUserId);
  return accessibleIds;
}

// Get user ID from email, userid, or vanid
async function getUserIdFromIdentifier(identifier) {
  if (!identifier) return null;
  try {
    const query = `
      SELECT userid FROM \`${PROJECT_ID}.${DATASET_ID}.org_ids\`
      WHERE userid = '${identifier}' OR vanid = '${identifier}'
        OR LOWER(CONCAT(firstname, '@carolinafederation.org')) = LOWER('${identifier}')
      LIMIT 1`;
    const [rows] = await bigquery.query({ query });
    return rows[0]?.userid?.toString() || null;
  } catch { return null; }
}

// Check if email is an admin
function isAdmin(email) {
  if (!email) return false;
  return ADMIN_EMAILS.some(admin => email.includes(admin));
}

// Get all IDs for admin access
async function getAllAccessibleIds() {
  const allIds = new Set();
  const orgStructure = await getOrgStructure();
  if (orgStructure) {
    orgStructure.userInfo.forEach((info, id) => {
      allIds.add(id);
      if (info.vanid) allIds.add(info.vanid);
    });
  }
  try {
    const [rows] = await database.query(`SELECT DISTINCT CAST(vanid AS STRING) as vanid FROM \`${PROJECT_ID}.${DATASET_ID}.contacts\` WHERE vanid IS NOT NULL`);
    rows.forEach(row => row.vanid && allIds.add(row.vanid));
  } catch {}
  return allIds;
}

// Middleware to check data access permissions
async function checkDataAccess(req, res, next) {
  try {
    const isLocalhost = req.headers.host?.includes('localhost') || req.headers.host?.includes('127.0.0.1');
    
    // Get user email from IAP headers or use mock for local dev
    let userEmail = isLocalhost 
      ? MOCK_USER_EMAIL 
      : (req.headers['x-goog-authenticated-user-email'] || req.headers['x-goog-iap-jwt-0']);
    
    // Clean up email (remove accounts.google.com: prefix if present)
    if (userEmail?.includes(':')) userEmail = userEmail.split(':').pop();
    
    const actualUserId = await getUserIdFromIdentifier(userEmail);
    
    // Admin users get full access
    if (isAdmin(userEmail)) {
      req.accessibleIds = await getAllAccessibleIds();
      req.hasDataAccess = true;
      req.currentUserId = actualUserId || 'admin';
      return next();
    }
    
    // Regular users get hierarchical access
    if (actualUserId) {
      req.accessibleIds = await getAccessibleIds(actualUserId);
      req.hasDataAccess = true;
      req.currentUserId = actualUserId;
    } else {
      req.accessibleIds = new Set();
      req.hasDataAccess = true;
      req.currentUserId = 'unknown';
    }
    next();
  } catch {
    req.accessibleIds = new Set();
    req.hasDataAccess = false;
    next();
  }
}

// ============================================================

// Get chapters/sections endpoint
// Returns predefined sections for MLD 377
app.get('/api/chapters', async (req, res) => {
  try {
    // Predefined sections for MLD 377
    const predefinedSections = [
      'Alyssa',
      'Ruhee',
      'Edgar',
      'Zoe',
      'Svitlana',
      'Sepi',
      'Teaching'
    ];
    
    // Also fetch any additional sections from the database
    const query = `
      SELECT DISTINCT chapter
      FROM lumoviz_teams
      WHERE chapter IS NOT NULL AND chapter != ''
      ORDER BY chapter
    `;
    
    const result = await pool.query(query);
    const dbChapters = result.rows.map(row => row.chapter);
    
    // Combine predefined and database chapters, remove duplicates
    const allChapters = [...new Set([...predefinedSections, ...dbChapters])];
    
    console.log(`[/api/chapters] Returning ${allChapters.length} sections:`, allChapters);
    
    res.json(allChapters);
  } catch (error) {
    console.error('Error fetching chapters:', error);
    // If database query fails, still return predefined sections
    res.json(['Alyssa', 'Ruhee', 'Edgar', 'Zoe', 'Svitlana', 'Sepi', 'Teaching']);
  }
});

// Get contacts from contacts table with pagination, filtering, sorting
// PostgreSQL version
app.get('/api/contacts', async (req, res) => {
  try {
    const { 
      chapter, 
      member_status,
      loe,
      search,
      organizer,
      sortBy = 'firstname',
      sortOrder = 'ASC',
      limit = 100,
      offset = 0,
      start_date,
      end_date
    } = req.query;
    
    const queryParams = [];
    let paramCount = 1;
    let whereConditions = ['c.vanid IS NOT NULL'];
    
    // Chapter filter
    if (chapter && chapter !== 'All' && chapter !== 'All Chapters' && chapter !== 'All Sections') {
      whereConditions.push(`LOWER(c.chapter) LIKE LOWER($${paramCount})`);
      queryParams.push(`%${chapter}%`);
      paramCount++;
    }
    
    // Search filter (name, email)
    if (search) {
      whereConditions.push(`(
        LOWER(c.first_name) LIKE LOWER($${paramCount}) OR 
        LOWER(c.last_name) LIKE LOWER($${paramCount + 1}) OR 
        LOWER(c.email) LIKE LOWER($${paramCount + 2}) OR
        LOWER(CONCAT(c.first_name, ' ', c.last_name)) LIKE LOWER($${paramCount + 3})
      )`);
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      paramCount += 4;
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    // Validate sort column to prevent SQL injection
    // Map frontend column names to actual database column names
    const sortColumnMap = {
      'firstname': 'c.first_name',
      'lastname': 'c.last_name',
      'chapter': 'c.chapter',
      'member_status': 'c.member_status',
      'loe': 'c.loe',
      'email': 'c.email',
      'vanid': 'c.vanid'
    };
    const safeSortBy = sortColumnMap[sortBy] || 'c.last_name';
    const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM contacts c
      WHERE ${whereClause}
    `;
    
    // Use pool directly for PostgreSQL queries with positional parameters
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0]?.total) || 0;
    console.log('[/api/contacts] Total contacts:', total);
    
    // Get paginated data with primary_organizer_vanid from lumoviz_contacts
    // Add limit and offset to params first
    queryParams.push(parseInt(limit), parseInt(offset));
    
    const dataQuery = `
      SELECT 
        c.vanid,
        c.first_name as firstname,
        c.last_name as lastname,
        c.chapter,
        c.email,
        c.phone,
        c.member_status,
        c.loe,
        lc.primary_organizer_vanid
      FROM contacts c
      LEFT JOIN lumoviz_contacts lc ON CAST(c.vanid AS TEXT) = CAST(lc.vanid AS TEXT)
      WHERE ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT $${paramCount}
      OFFSET $${paramCount + 1}
    `;
    
    const dataResult = await pool.query(dataQuery, queryParams);
    
    res.json({
      data: dataResult.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + dataResult.rows.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get LOE counts for Kanban - returns total count by LOE status
app.get('/api/contacts/loe-counts', async (req, res) => {
  try {
    // Simplified for PostgreSQL - just return empty for now (not critical)
    res.json({ data: [] });
  } catch (error) {
    console.error('Error fetching LOE counts:', error);
    res.status(500).json({ error: error.message });
  }
});

// OLD BIGQUERY CODE REMOVED (all old /api/contacts variations commented out above)

// Get id mappings
app.get('/api/idmappings', async (req, res) => {
  try {
    // First, let's list the column names to see what's available
    const columnsQuery = `
      SELECT column_name, data_type
      FROM \`${PROJECT_ID}\`.${DATASET_ID}.INFORMATION_SCHEMA.COLUMNS
      WHERE table_name = 'staff'
    `;

    const [columns] = await bigquery.query({ query: columnsQuery });
    
    // console.log('Staff table columns:', columns.map(col => col.column_name));
    
    // Now query with correct column names
    const query = `
      SELECT 
        UserID, 
        VANID,
        first_name as firstName, 
        last_name as lastName
      FROM \`${PROJECT_ID}.${DATASET_ID}.staff\`
    `;

    const options = {
      query,
    };

    const [rows] = await bigquery.query(options);
    // console.log(`Retrieved ${rows.length} ID mappings`);
    
    res.json(rows);
  } catch (error) {
    // console.error('Error fetching ID mappings:', error);
    
    // If we can't get columns, try a fallback query with likely column names
    try {
      // console.log('Trying fallback query for staff table...');
      const fallbackQuery = `
        SELECT 
          UserID,
          VANID,
          first_name as firstName,
          last_name as lastName
        FROM \`${PROJECT_ID}.${DATASET_ID}.staff\`
        LIMIT 1000
      `;
      
      const [fallbackRows] = await bigquery.query({ query: fallbackQuery });
      // console.log(`Retrieved ${fallbackRows.length} ID mappings with fallback query`);
      
      res.json(fallbackRows);
    } catch (fallbackError) {
      // console.error('Fallback query also failed:', fallbackError);
      res.status(500).json({ error: error.message });
    }
  }
});

// Get links with filtering options
app.get('/api/links', async (req, res) => {
  // console.log('Links API called with query params:', req.query);
  try {
    // Set a limit for the number of rows returned
    const limit = req.query.limit ? parseInt(req.query.limit) : 1000;

    // Query from the links table which only has userid, vanid, total
    const query = `
      SELECT 
        userid,
        vanid,
        total
      FROM \`${PROJECT_ID}.${DATASET_ID}.links\`
      LIMIT ${limit}
    `;

    // console.log('Executing query:', query);

    const options = {
      query,
    };

    const [rows] = await bigquery.query(options);
    // console.log(`Retrieved ${rows.length} rows from links table`);
    
    // Log the first row structure to see all columns
    if (rows.length > 0) {
      // console.log('Links table structure:', Object.keys(rows[0]));
      // console.log('Sample row:', JSON.stringify(rows[0], null, 2));
    }
    
    // Map the response to match the expected API format
    // Add placeholder values for missing fields
    const mappedRows = rows.map(row => ({
      userId: row.userid ? row.userid.toString() : '',
      vanId: row.vanid ? row.vanid.toString() : '',
      count: row.total ? row.total.toString() : '1',
      // Add placeholder values for missing fields
      contact_type: 'In-Person',  // Default placeholder
      contact_result: 'Successful', // Default placeholder
      utc_datecanvassed: new Date().toISOString(), // Use current date
      source: row.userid ? row.userid.toString() : '',
      target: row.vanid ? row.vanid.toString() : '',
      source_chapter: 'Unknown',
      target_chapter: 'Unknown'
    }));
    
    // console.log(`Returning ${mappedRows.length} processed rows`);
    res.json(mappedRows);
  } catch (error) {
    // console.error('Error fetching links:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Get available contact types
app.get('/api/contactTypes', async (req, res) => {
  try {
    // First check if contact_type exists in links table
    const columnsQuery = `
      SELECT column_name
      FROM \`${PROJECT_ID}\`.${DATASET_ID}.INFORMATION_SCHEMA.COLUMNS
      WHERE table_name = 'links' AND column_name = 'contact_type'
    `;
    
    const [columns] = await bigquery.query({ query: columnsQuery });
    
    if (columns.length > 0) {
      const query = `
        SELECT DISTINCT contact_type
        FROM \`${PROJECT_ID}.${DATASET_ID}.links\`
        WHERE contact_type IS NOT NULL
        ORDER BY contact_type
      `;

      const options = {
        query,
      };

      const [rows] = await bigquery.query(options);
      res.json(rows.map(row => row.contact_type));
    } else {
      // If contact_type doesn't exist, return default values
      // console.log('contact_type column not found in links table, returning default values');
      res.json(['In-Person', 'Phone', 'Email', 'Text']);
    }
  } catch (error) {
    // console.error('Error fetching contact types:', error);
    // Return default values if query fails
    res.json(['In-Person', 'Phone', 'Email', 'Text']);
  }
});

// Get available contact results
app.get('/api/contactResults', async (req, res) => {
  try {
    // First check if contact_result exists in links table
    const columnsQuery = `
      SELECT column_name
      FROM \`${PROJECT_ID}\`.${DATASET_ID}.INFORMATION_SCHEMA.COLUMNS
      WHERE table_name = 'links' AND column_name = 'contact_result'
    `;
    
    const [columns] = await bigquery.query({ query: columnsQuery });
    
    if (columns.length > 0) {
      const query = `
        SELECT DISTINCT contact_result
        FROM \`${PROJECT_ID}.${DATASET_ID}.links\`
        WHERE contact_result IS NOT NULL
        ORDER BY contact_result
      `;

      const options = {
        query,
      };

      const [rows] = await bigquery.query(options);
      res.json(rows.map(row => row.contact_result));
    } else {
      // If contact_result doesn't exist, return default values
      // console.log('contact_result column not found in links table, returning default values');
      res.json(['Successful', 'Left Message', 'No Answer', 'Wrong Number']);
    }
  } catch (error) {
    // console.error('Error fetching contact results:', error);
    // Return default values if query fails
    res.json(['Successful', 'Left Message', 'No Answer', 'Wrong Number']);
  }
});

// Add a new endpoint to check contact_history table structure
app.get('/api/contact-history-info', async (req, res) => {
  try {
    // console.log('Retrieving contact_history table information...');
    
    // First get the table schema
    const columnsQuery = `
      SELECT column_name, data_type
      FROM \`${PROJECT_ID}\`.${DATASET_ID}.INFORMATION_SCHEMA.COLUMNS
      WHERE table_name = 'contact_history'
      ORDER BY ordinal_position
    `;

    const [columns] = await bigquery.query({ query: columnsQuery });
    
    // console.log('Contact History Columns:');
    columns.forEach(col => {
      // console.log(`- ${col.column_name} (${col.data_type})`);
    });
    
    // Query sample data
    const dataQuery = `
      SELECT *
      FROM \`${PROJECT_ID}.${DATASET_ID}.contact_history\`
      LIMIT 10
    `;

    const [rows] = await bigquery.query({ query: dataQuery });
    
    // console.log(`Retrieved ${rows.length} sample rows`);
    
    // Check if there are any date columns
    const dateColumns = columns.filter(col => 
      col.data_type.toLowerCase().includes('date') || 
      col.data_type.toLowerCase().includes('time') ||
      col.column_name.toLowerCase().includes('date') ||
      col.column_name.toLowerCase().includes('time')
    );
    
    // Check for common columns with links table
    const linksColumnsQuery = `
      SELECT column_name
      FROM \`${PROJECT_ID}\`.${DATASET_ID}.INFORMATION_SCHEMA.COLUMNS
      WHERE table_name = 'links'
    `;
    
    const [linksColumns] = await bigquery.query({ query: linksColumnsQuery });
    const linksColumnNames = linksColumns.map(col => col.column_name);
    const contactHistoryColumnNames = columns.map(col => col.column_name);
    
    const commonColumns = linksColumnNames.filter(col => 
      contactHistoryColumnNames.includes(col)
    );
    
    // Return all the collected information
    res.json({
      columns: columns,
      sampleData: rows,
      dateColumns: dateColumns,
      commonColumnsWithLinks: commonColumns
    });
  } catch (error) {
    // console.error('Error fetching contact history info:', error);
    res.status(500).json({ error: error.message });
  }
});

// First, let's add a base API route
app.get('/api', (req, res) => {
  res.json({ message: 'API is running', routes: ['/api/links', '/api/contacts', '/api/contactTypes', '/api/contactResults', '/api/contact-history'] });
});

// Add a new endpoint to get links from contact_history table
app.get('/api/contact-history', async (req, res) => {
  try {
    // console.log('Contact History API called with query params:', req.query);
    
    // First check if the table exists and get its schema
    const columnsQuery = `
      SELECT column_name, data_type
      FROM \`${PROJECT_ID}\`.${DATASET_ID}.INFORMATION_SCHEMA.COLUMNS
      WHERE table_name = 'contact_history'
      ORDER BY ordinal_position
    `;

    const [columns] = await bigquery.query({ query: columnsQuery });
    
    if (columns.length === 0) {
      return res.status(404).json({ error: 'Contact history table not found' });
    }
    
    // console.log('Contact History Columns:', columns.map(col => col.column_name).join(', '));
    
    // Check for date columns
    const dateColumns = columns.filter(col => 
      col.data_type.toLowerCase().includes('date') || 
      col.data_type.toLowerCase().includes('time') ||
      col.column_name.toLowerCase().includes('date') ||
      col.column_name.toLowerCase().includes('time')
    );
    
    // console.log('Date columns found:', dateColumns.map(col => col.column_name).join(', '));
    
    // Build query based on schema
    let query = `
      SELECT *
      FROM \`${PROJECT_ID}.${DATASET_ID}.contact_history\`
    `;
    
    // Add a LIMIT for safety
    const limit = req.query.limit ? parseInt(req.query.limit) : 1000;
    query += `\nLIMIT ${limit}`;

    // console.log('Executing query:', query);

    const [rows] = await bigquery.query({ query });
    // console.log(`Retrieved ${rows.length} rows from contact_history table`);
    
    // Log the first row structure
    if (rows.length > 0) {
      // console.log('First row sample:', JSON.stringify(rows[0], null, 2));
    }
    
    res.json({
      tableInfo: {
        columns: columns.map(col => ({ name: col.column_name, type: col.data_type })),
        dateColumns: dateColumns.map(col => ({ name: col.column_name, type: col.data_type }))
      },
      data: rows
    });
  } catch (error) {
    // console.error('Error fetching contact history:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Add a new endpoint to get links with dates by joining with contact_history
app.get('/api/links-with-dates', async (req, res) => {
  try {
    // console.log('Links with dates API called with query params:', req.query);
    
    // Extract parameters
    const { startDate, endDate, chapter } = req.query;
    const limit = req.query.limit ? parseInt(req.query.limit) : 1000;
    
    // Build WHERE clause for filtering
    let whereClause = '';
    
    // Date filtering
    if (startDate) {
      whereClause += `\nWHERE ch.utc_datecanvassed >= TIMESTAMP('${startDate}')`;
    }
    
    if (endDate) {
      whereClause += whereClause ? `\nAND ch.utc_datecanvassed <= TIMESTAMP('${endDate}')` :
        `\nWHERE ch.utc_datecanvassed <= TIMESTAMP('${endDate}')`;
    }
    
    // Chapter filtering - build a different query if chapter is specified
    let query;
    
    if (chapter && chapter !== 'All Chapters') {
      // If we have a chapter filter, we need to join with the contacts table
      query = `
        SELECT 
          l.userid,
          l.vanid,
          l.total,
          ch.utc_datecanvassed,
          ch.contact_type,
          ch.contact_result,
          ch.input_source,
          c.chapter as target_chapter
        FROM 
          \`${PROJECT_ID}.${DATASET_ID}.links\` l
        JOIN
          \`${PROJECT_ID}.${DATASET_ID}.contact_history\` ch
        ON
          l.vanid = ch.vanid
        LEFT JOIN
          \`${PROJECT_ID}.${DATASET_ID}.contacts\` c
        ON
          l.vanid = c.vanid
        WHERE 
          ${whereClause ? whereClause.replace('WHERE ', '') + ' AND' : ''} 
          c.chapter = '${chapter}'
        ORDER BY ch.utc_datecanvassed DESC
        LIMIT ${limit}
      `;
    } else {
      // Default query without chapter filtering
      query = `
        SELECT 
          l.userid,
          l.vanid,
          l.total,
          ch.utc_datecanvassed,
          ch.contact_type,
          ch.contact_result,
          ch.input_source
        FROM 
          \`${PROJECT_ID}.${DATASET_ID}.links\` l
        JOIN
          \`${PROJECT_ID}.${DATASET_ID}.contact_history\` ch
        ON
          l.vanid = ch.vanid
        ${whereClause}
        ORDER BY ch.utc_datecanvassed DESC
        LIMIT ${limit}
      `;
    }
    
    // console.log('Executing query:', query);
    
    const [rows] = await bigquery.query({ query });
    // console.log(`Retrieved ${rows.length} rows from links with dates query`);
    
    // Log the first row for debugging
    if (rows.length > 0) {
      // console.log('First row sample:', JSON.stringify(rows[0], null, 2));
    }
    
    // Map the response to match the expected API format
    const mappedRows = rows.map(row => ({
      userid: row.userid ? row.userid.toString() : '',
      vanid: row.vanid ? row.vanid.toString() : '',
      total: row.total || 1,
      contact_type: row.contact_type || 'Unknown',
      contact_result: row.contact_result || 'Unknown',
      utc_datecanvassed: row.utc_datecanvassed?.value || new Date().toISOString(),
      source: row.userid ? row.userid.toString() : '',
      target: row.vanid ? row.vanid.toString() : '',
      source_chapter: 'Unknown',
      target_chapter: row.target_chapter || 'Unknown',
      input_source: row.input_source || 'Unknown'
    }));
    
    // console.log(`Returning ${mappedRows.length} processed rows`);
    res.json(mappedRows);
  } catch (error) {
    // console.error('Error fetching links with dates:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Get staff endpoint
app.get('/api/staff', async (req, res) => {
  try {
    const query = `
      SELECT 
        UserID,
        VANID,
        first_name as firstName,
        last_name as lastName
      FROM \`${PROJECT_ID}.${DATASET_ID}.staff\`
      LIMIT 1000
    `;

    const options = {
      query,
    };

    const [rows] = await bigquery.query(options);
    // console.log(`Retrieved ${rows.length} staff records`);
    
    res.json(rows);
  } catch (error) {
    // console.error('Error fetching staff:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a new endpoint to get network data directly from contact_history with access control
app.get('/api/contact-history-network', checkDataAccess, async (req, res) => {
  try {
    // console.log('Contact History Network API called with query params:', req.query);
    
    // Extract parameters
    const { start_date, end_date, chapter, sample: sampleParam, page = 0, limit = 1000 } = req.query;
    const sample = sampleParam === 'true'; // Whether to use sampling
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    // Build WHERE clause for filtering
    let whereClause = '';
    
    // Date filtering
    if (start_date) {
      whereClause += `\nWHERE ch.utc_datecanvassed >= TIMESTAMP('${start_date}')`;
    }
    
    if (end_date) {
      whereClause += whereClause ? `\nAND ch.utc_datecanvassed <= TIMESTAMP('${end_date}')` :
        `\nWHERE ch.utc_datecanvassed <= TIMESTAMP('${end_date}')`;
    }
    
    // Chapter filtering - add if chapter is specified
    if (chapter && chapter !== 'All Chapters') {
      whereClause += whereClause 
        ? `\nAND c.chapter = '${chapter}'` 
        : `\nWHERE c.chapter = '${chapter}'`;
    }
    
    // Build the query to get direct data from contact_history WITHOUT joining staff table
    let query;
    
    if (sample) {
      // Use a more efficient sampling technique with window functions
      query = `
        WITH SampledContacts AS (
          SELECT 
            ch.userid,
            ch.vanid,
            ch.username,
            ch.utc_datecanvassed,
            ch.contact_type,
            ch.contact_result,
            ch.input_source,
            ROW_NUMBER() OVER (PARTITION BY ch.userid, ch.vanid ORDER BY ch.utc_datecanvassed DESC) as row_num
          FROM 
            \`${PROJECT_ID}.${DATASET_ID}.contact_history\` ch
          LEFT JOIN
            \`${PROJECT_ID}.${DATASET_ID}.contacts\` c
          ON
            ch.vanid = c.vanid
          ${whereClause}
        )
        SELECT 
          sc.userid,
          sc.vanid,
          sc.username,
          sc.utc_datecanvassed,
          sc.contact_type,
          sc.contact_result,
          sc.input_source,
          c.firstname as target_first_name,
          c.lastname as target_last_name,
          c.chapter as target_chapter
        FROM 
          SampledContacts sc
        LEFT JOIN
          \`${PROJECT_ID}.${DATASET_ID}.contacts\` c
        ON
          sc.vanid = c.vanid
        WHERE
          sc.row_num = 1  -- Only get the most recent contact between each pair
        ORDER BY sc.utc_datecanvassed DESC
      `;
    } else {
      // Original query without staff join
      query = `
        SELECT 
          ch.userid,
          ch.vanid,
          ch.username,
          ch.utc_datecanvassed,
          ch.contact_type,
          ch.contact_result,
          ch.input_source,
          c.firstname as target_first_name,
          c.lastname as target_last_name,
          c.chapter as target_chapter,
          um.firstname as organizer_first_name,
          um.lastname as organizer_last_name
        FROM 
          \`${PROJECT_ID}.${DATASET_ID}.contact_history\` ch
        LEFT JOIN
          \`${PROJECT_ID}.${DATASET_ID}.contacts\` c
        ON
          ch.vanid = c.vanid
        LEFT JOIN
          \`${PROJECT_ID}.${DATASET_ID}.user_map\` um
        ON
          ch.userid = um.userid
        ${whereClause}
        ORDER BY ch.utc_datecanvassed DESC
        LIMIT ${limitNum} OFFSET ${pageNum * limitNum}
      `;
    }
    
    // console.log('Executing query:', query);
    
    const [rows] = await bigquery.query({ query });
    // console.log(`Retrieved ${rows.length} rows from contact_history for network graph`);
    
    // Log the first row for debugging
    if (rows.length > 0) {
      // console.log('First row sample:', JSON.stringify(rows[0], null, 2));
    }
    
    // If we got no results from the specific date range, 
    // use a fallback query with a broader date range to ensure we return something
    if (rows.length === 0) {
      // console.log('No data found for specified date range, using fallback query...');
      
      const fallbackQuery = `
        SELECT 
          ch.userid,
          ch.vanid,
          ch.username,
          ch.utc_datecanvassed,
          ch.contact_type,
          ch.contact_result,
          ch.input_source,
          c.firstname as target_first_name,
          c.lastname as target_last_name,
          c.chapter as target_chapter
        FROM 
          \`${PROJECT_ID}.${DATASET_ID}.contact_history\` ch
        LEFT JOIN
          \`${PROJECT_ID}.${DATASET_ID}.contacts\` c
        ON
          ch.vanid = c.vanid
        WHERE ch.userid IS NOT NULL
        AND ch.vanid IS NOT NULL
        ORDER BY ch.utc_datecanvassed DESC
      `;
      
      const [fallbackRows] = await bigquery.query({ query: fallbackQuery });
      // console.log(`Retrieved ${fallbackRows.length} rows from fallback query`);
    
    // Map the response to match the expected API format
      const mappedRows = fallbackRows.map(row => {
        // Extract and format IDs with proper string conversion
        const userid = row.userid ? row.userid.toString() : '';
        const vanid = row.vanid ? row.vanid.toString() : '';
        
        // If either ID is missing, log a warning
        if (!userid || !vanid) {
          console.log('Warning: Fallback record with missing ID:', row);
        }
        
        return {
          userid,
          vanid,
      username: row.username || '',
          source_name: row.username || `User ${userid}`,
      target_name: row.target_first_name && row.target_last_name 
        ? `${row.target_first_name} ${row.target_last_name}` 
            : `Contact ${vanid}`,
          source_chapter: 'Unknown', // Default value since we don't have this in the query
          target_chapter: row.target_chapter || 'Unknown',
          // Use the specified date range even though data is from a different range
          utc_datecanvassed: start_date ? new Date(start_date).toISOString() : new Date().toISOString(),
      contact_type: row.contact_type || 'Unknown',
      contact_result: row.contact_result || 'Unknown',
          input_source: row.input_source || 'Unknown'
        };
      }).filter(row => row.userid && row.vanid); // Filter out any rows with missing IDs
      
      // console.log(`Returning ${mappedRows.length} processed rows from fallback query`);
      
      // Log a sample of the IDs for debugging
      if (mappedRows.length > 0) {
        console.log('Sample IDs from first 3 fallback rows:');
        mappedRows.slice(0, 3).forEach((row, idx) => {
          // console.log(`Row ${idx}: userid=${row.userid}, vanid=${row.vanid}`);
        });
      }
      
      return res.json(mappedRows);
    }
    
    // Apply access control - show all nodes but filter sensitive data
    let processedRows = rows;
    
    if (req.hasDataAccess && req.accessibleIds.size > 0) {
      // Don't filter out rows - show all connections
      // But we'll mark which ones have restricted access for data filtering
      processedRows = rows.map(row => {
        const userid = row.userid?.toString();
        const vanid = row.vanid?.toString();
        
        // User can see full details if they have access to EITHER the organizer (userid) OR the contact (vanid)
        const hasOrganizerAccess = req.accessibleIds.has(userid);
        const hasContactAccess = req.accessibleIds.has(vanid);
        const hasFullAccess = hasOrganizerAccess || hasContactAccess;
        
        return {
          ...row,
          hasFullAccess // Mark whether user can see full details
        };
      });
      
      // console.log(`Access control applied: showing all ${processedRows.length} contact history records, with access restrictions based on org hierarchy for user ${req.currentUserId}`);
    } else {
      // console.log('No access control applied - user has no verified org access');
      processedRows = []; // No access if user not found in org structure
    }

    // Map the response to match the expected API format
    const mappedRows = processedRows.map(row => {
      // Extract and format IDs with proper string conversion
      const userid = row.userid ? row.userid.toString() : '';
      const vanid = row.vanid ? row.vanid.toString() : '';
      
      // If either ID is missing, log a warning
      if (!userid || !vanid) {
        // console.log('Warning: Record with missing ID:', row);
      }
      
      // If user doesn't have full access, hide sensitive information
      const hasFullAccess = row.hasFullAccess !== false; // Default to true if not set
      
      return {
        userid,
        vanid,
        username: hasFullAccess ? (row.username || '') : 'Restricted',
        source_name: hasFullAccess ? (row.username || `User ${userid}`) : 'Restricted User',
        target_name: hasFullAccess && row.target_first_name && row.target_last_name
          ? `${row.target_first_name} ${row.target_last_name}`
          : hasFullAccess ? `Contact ${vanid}` : 'Restricted Contact',
        source_chapter: hasFullAccess ? 'Unknown' : 'Restricted', // Default value since we don't have this in the query
        target_chapter: hasFullAccess ? (row.target_chapter || 'Unknown') : 'Restricted',
        utc_datecanvassed: row.utc_datecanvassed ? row.utc_datecanvassed.value || row.utc_datecanvassed : new Date().toISOString(),
        contact_type: hasFullAccess ? (row.contact_type || 'Unknown') : 'Restricted',
        contact_result: hasFullAccess ? (row.contact_result || 'Unknown') : 'Restricted',
        input_source: hasFullAccess ? (row.input_source || 'Unknown') : 'Restricted',
        hasFullAccess // Include this flag for frontend use
      };
    }).filter(row => row.userid && row.vanid); // Filter out any rows with missing IDs
    
    // console.log(`Returning ${mappedRows.length} processed rows after access control`);
    
    // Log a sample of the IDs for debugging
    if (mappedRows.length > 0) {
      // console.log('Sample accessible IDs from first 3 rows:');
      mappedRows.slice(0, 3).forEach((row, idx) => {
        // console.log(`Row ${idx}: userid=${row.userid}, vanid=${row.vanid}`);
      });
    }
    
    res.json(mappedRows);
  } catch (error) {
    // console.error('Error fetching contact history network data:', error);
    
    // Even if we encounter an error, return some sample data for the frontend
    // console.log('Returning sample data due to error...');
    
    // Generate some sample data
    const sampleData = [];
    for (let i = 0; i < 20; i++) {
      const userId = (1000 + i).toString();
      const vanId = (100000 + i).toString();
      
      sampleData.push({
        userid: userId,
        vanid: vanId,
        username: `sample_user_${i}`,
        source_name: `Sample User ${i}`,
        target_name: `Sample Contact ${i}`,
        source_chapter: 'Sample Chapter',
        target_chapter: 'Sample Chapter',
        utc_datecanvassed: new Date().toISOString(),
        contact_type: ['Phone', 'In-Person', 'Email'][i % 3],
        contact_result: ['Successful', 'Left Message', 'No Answer'][i % 3],
        input_source: 'Sample Data'
      });
    }
    
    // Log sample IDs for debugging
    // console.log('Sample IDs from generated data:');
    sampleData.slice(0, 3).forEach((row, idx) => {
      // console.log(`Row ${idx}: userid=${row.userid}, vanid=${row.vanid}`);
    });
    
    res.json(sampleData);
  }
});

// Add a new endpoint to get date range from contact_history
app.get('/api/contact-history-date-range', async (req, res) => {
  try {
    // console.log('Retrieving contact_history date range...');
    
    // Query to get min and max dates
    const query = `
      SELECT 
        MIN(utc_datecanvassed) as min_date,
        MAX(utc_datecanvassed) as max_date
      FROM 
        \`${PROJECT_ID}.${DATASET_ID}.contact_history\`
      WHERE 
        utc_datecanvassed IS NOT NULL
    `;

    const [result] = await bigquery.query({ query });
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'No date range found' });
    }
    
    // Format the dates
    const minDate = result[0].min_date ? result[0].min_date.value : null;
    const maxDate = result[0].max_date ? result[0].max_date.value : null;
    
    // console.log(`Date range found: ${minDate} to ${maxDate}`);
    
    res.json({
      min_date: minDate,
      max_date: maxDate
    });
  } catch (error) {
    // console.error('Error fetching contact history date range:', error);
    
    // Return a fallback date range that supports the 3-month default
    const now = new Date();
    const fallbackMinDate = new Date(now);
    fallbackMinDate.setFullYear(fallbackMinDate.getFullYear() - 2); // 2 years back
    
    res.json({ 
      min_date: fallbackMinDate.toISOString(), 
      max_date: now.toISOString(),
      fallback: true
    });
  }
});

// Get network data endpoint
app.post('/api/network-data', async (req, res) => {
  try {
    const { start_date, end_date, chapter, showApiUsers, showAdmins, adminUserIds } = req.body;
    // console.log('Network data request:', { start_date, end_date, chapter, showApiUsers, showAdmins });

    let whereClause = `WHERE ch.utc_datecanvassed >= '${start_date}' AND ch.utc_datecanvassed <= '${end_date}'`;
    
    // Add chapter filter if provided
    if (chapter && chapter !== 'All Chapters') {
      whereClause += ` AND c.chapter = '${chapter}'`;
    }
    
    // Filter out API users if requested
    if (showApiUsers === false) {
      whereClause += ` AND (um.api_user IS NULL OR um.api_user = false)`;
    }
    
    // Filter out admin users if requested
    if (showAdmins === false && adminUserIds && adminUserIds.length > 0) {
      const adminIdsStr = adminUserIds.join(',');
      whereClause += ` AND ch.userid NOT IN (${adminIdsStr}) AND ch.vanid NOT IN (${adminIdsStr})`;
    }

    const query = `
      SELECT 
        ch.userid,
        ch.vanid,
        ch.username,
        ch.utc_datecanvassed,
        ch.contact_type,
        ch.contact_result,
        ch.input_source,
        c.firstname as target_first_name,
        c.lastname as target_last_name,
        c.chapter as target_chapter,
        c.loe as target_loe,
        um.firstname as organizer_first_name,
        um.lastname as organizer_last_name
      FROM 
        \`${PROJECT_ID}.${DATASET_ID}.contact_history\` ch
      LEFT JOIN
        \`${PROJECT_ID}.${DATASET_ID}.contacts\` c
      ON
        ch.vanid = c.vanid
      LEFT JOIN
        \`${PROJECT_ID}.${DATASET_ID}.user_map\` um
      ON
        ch.userid = um.userid
      ${whereClause}
      ORDER BY ch.utc_datecanvassed DESC
    `;

    // console.log('Executing query:', query);

    const options = {
      query,
    };

    const [rows] = await bigquery.query(options);
    // console.log(`Retrieved ${rows.length} rows from contact_history for network graph`);
    
    if (rows.length > 0) {
      // console.log('First row sample:', rows[0]);
    }
    
    res.json(rows);
  } catch (error) {
    // console.error('Error fetching network data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a new endpoint to get org_ids data
app.get('/api/org-ids', async (req, res) => {
  try {
    // console.log('Fetching org_ids data...');
    
    // First check the schema to see what columns are available
    const schemaQuery = `
      SELECT column_name, data_type
      FROM \`${PROJECT_ID}\`.${DATASET_ID}.INFORMATION_SCHEMA.COLUMNS
      WHERE table_name = 'org_ids'
      ORDER BY ordinal_position
    `;
    
    const [columns] = await bigquery.query({ query: schemaQuery });
    // console.log('Org_ids columns:', columns.map(col => col.column_name).join(', '));
    
    // Look for ID fields that could match the userID in nodes
    const idColumns = columns.filter(col => 
      col.column_name.toLowerCase().includes('id') ||
      col.column_name.toLowerCase().includes('user') ||
      col.column_name.toLowerCase().includes('van')
    );
    
    // console.log('Potential ID columns:', idColumns.map(col => col.column_name).join(', '));
    
    // Build the column list for the SELECT query
    let selectColumns = ['vanid'];
    
    // Add any other ID columns we found
    idColumns.forEach(col => {
      if (!selectColumns.includes(col.column_name)) {
        selectColumns.push(col.column_name);
      }
    });
    
    // Add name columns
    if (columns.find(col => col.column_name === 'firstname')) {
      selectColumns.push('firstname');
    }
    if (columns.find(col => col.column_name === 'lastname')) {
      selectColumns.push('lastname');
    }
    if (columns.find(col => col.column_name === 'email')) {
      selectColumns.push('email');
    }
    if (columns.find(col => col.column_name === 'chapter')) {
      selectColumns.push('chapter');
    }
    
    // Query the org_ids table with the columns we found
    const query = `
      SELECT 
        ${selectColumns.join(',\n        ')}
      FROM \`${PROJECT_ID}.${DATASET_ID}.org_ids\`
      LIMIT 2000
    `;

    // console.log('Executing query:', query);
    const [rows] = await bigquery.query({ query });
    
    // console.log(`Retrieved ${rows.length} rows from org_ids table`);
    if (rows.length > 0) {
      // console.log('First row sample:', JSON.stringify(rows[0], null, 2));
    }
    
    res.json({
      columns: columns,
      idColumns: idColumns,
      data: rows
    });
  } catch (error) {
    // console.error('Error fetching org_ids data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simplified endpoint for org_ids to ensure we can access the data
app.get('/api/org-ids-simple', async (req, res) => {
  try {
    // console.log('Fetching org_ids data (simple)...');
    
    // Simple direct query of the org_ids table
    const query = `
      SELECT 
        vanid,
        userid,
        firstname,
        lastname,
        supervisorid,
        type,
        turf,
        team_role
        -- email,
        -- chapter
      FROM \`${PROJECT_ID}.${DATASET_ID}.org_ids\`
      LIMIT 5000
    `;

    // console.log('Executing org_ids query:', query);
    const [rows] = await bigquery.query({ query });
    
    // console.log(`Retrieved ${rows.length} rows from org_ids table (simple endpoint)`);
    if (rows.length > 0) {
      // console.log('First row sample:', JSON.stringify(rows[0], null, 2));
    }
    
    // Return direct results without wrapping in an object
    res.json(rows);
  } catch (error) {
    // console.error('Error fetching org_ids data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get conversations endpoint
app.get('/api/conversations-schema', async (req, res) => {
  try {
    // console.log('Checking conversations table schema...');
    
    const schemaQuery = `
      SELECT column_name, data_type
      FROM \`${PROJECT_ID}\`.${DATASET_ID}.INFORMATION_SCHEMA.COLUMNS
      WHERE table_name = 'conversations'
      ORDER BY ordinal_position
    `;
    
    const [columns] = await bigquery.query({ query: schemaQuery });
    // console.log('Conversations columns:', columns.map(col => col.column_name).join(', '));
    
    // Also get a sample row
    const sampleQuery = `
      SELECT *
      FROM \`${PROJECT_ID}.${DATASET_ID}.conversations\`
      LIMIT 3
    `;
    
    const [rows] = await bigquery.query({ query: sampleQuery });
    
    res.json({
      columns: columns,
      sampleData: rows
    });
  } catch (error) {
    // console.error('Error checking conversations schema:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get conversations endpoint with access control (also aliased as /api/meetings for backward compatibility)
app.get('/api/conversations', checkDataAccess, async (req, res) => {
  try {
    const { startDate, endDate, chapter, participant, page = 0, limit = 50000 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    // console.log(`/api/conversations called with: startDate=${startDate}, endDate=${endDate}, chapter=${chapter}, participant=${participant}, limit=${limitNum}`);
    
    // Build base query using conversations table with contacts for LOE data
    // NOTE: Names come from org_ids first, then contacts table as fallback (NOT from conversations)
    let query = `
      WITH ConversationsData AS (
        SELECT 
          c.organizer_vanid,
          -- Organizer name: try org_ids first, then contacts, then 'Unknown Organizer'
          COALESCE(
            NULLIF(TRIM(CONCAT(COALESCE(o1.firstname, ''), ' ', COALESCE(o1.lastname, ''))), ''),
            NULLIF(TRIM(CONCAT(COALESCE(cont2.first_name, ''), ' ', COALESCE(cont2.last_name, ''))), ''),
            'Unknown Organizer'
          ) as organizer,
          c.participant_vanid as vanid,
          c.date_contacted as datestamp,
          c.participant_chapter as chapter,
          c.conversation_type as meeting_type,
          c.purpose as notes_purpose,
          c.commitments as notes_commitments,
          c.stakes as notes_stakes,
          '' as notes_development,
          c.evaluation as notes_evaluation,
          -- Two-on-One meeting fields - host name: try org_ids first, then contacts
          CASE WHEN c.host_vanid IS NOT NULL THEN 
            COALESCE(
              NULLIF(TRIM(CONCAT(COALESCE(o3.firstname, ''), ' ', COALESCE(o3.lastname, ''))), ''),
              NULLIF(TRIM(CONCAT(COALESCE(cont3.first_name, ''), ' ', COALESCE(cont3.last_name, ''))), ''),
              'Unknown Host'
            )
          ELSE NULL END as host_oneonone,
          c.host_vanid,
          c.host_email,
          '' as two_risks,
          '' as two_effective,
          '' as two_support,
          -- Contact information (participant) - use contacts table for participant info
          COALESCE(cont1.first_name, c.participant_first_name) as contact_firstname,
          COALESCE(cont1.last_name, c.participant_last_name) as contact_lastname,
          c.participant_chapter as contact_chapter,
          cont1.loe as contact_loe,
          cont1.member_status as member_status,
          cont1.email as email,
          -- Organizer information - try org_ids first, then contacts
          COALESCE(o1.firstname, cont2.first_name) as organizer_firstname,
          COALESCE(o1.lastname, cont2.last_name) as organizer_lastname,
          cont2.chapter as organizer_chapter,
          cont2.loe as organizer_loe,
          -- Host information (for Two-on-One meetings) - try org_ids first, then contacts
          COALESCE(o3.firstname, cont3.first_name) as host_firstname,
          COALESCE(o3.lastname, cont3.last_name) as host_lastname,
          cont3.chapter as host_chapter,
          cont3.loe as host_loe,
          -- Include org_ids info for access control
          o1.userid as organizer_userid,
          o2.userid as contact_userid,
          o3.userid as host_userid
        FROM \`${PROJECT_ID}.${DATASET_ID}.conversations\` c
        LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.contacts\` cont1 
          ON CAST(c.participant_vanid AS STRING) = CAST(cont1.vanid AS STRING)
        LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.contacts\` cont2 
          ON CAST(c.organizer_vanid AS STRING) = CAST(cont2.vanid AS STRING)
        LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.contacts\` cont3 
          ON CAST(c.host_vanid AS STRING) = CAST(cont3.vanid AS STRING)
        LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.org_ids\` o1
          ON CAST(c.organizer_vanid AS STRING) = CAST(o1.vanid AS STRING)
        LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.org_ids\` o2
          ON CAST(c.participant_vanid AS STRING) = CAST(o2.vanid AS STRING)
        LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.org_ids\` o3
          ON CAST(c.host_vanid AS STRING) = CAST(o3.vanid AS STRING)
        WHERE 1=1
      `;

    // Add date filters
    if (startDate) {
      query += ` AND (c.date_contacted)::date >= ('${startDate}')::date`;
    }
    if (endDate) {
      query += ` AND (c.date_contacted)::date <= ('${endDate}')::date`;
    }
    if (chapter && chapter !== 'All Chapters') {
      // Include conversations where EITHER the participant OR organizer is from the selected chapter
      query += ` AND (c.participant_chapter = '${chapter}' OR cont2.chapter = '${chapter}')`;
    }
    if (participant) {
      // Filter by specific participant VAN ID - cast to STRING for comparison
      query += ` AND CAST(c.participant_vanid AS STRING) = '${participant}'`;
    }


    query += `)
      SELECT * FROM ConversationsData
      ORDER BY datestamp DESC
      LIMIT ${limitNum} OFFSET ${pageNum * limitNum}
    `;

    // console.log('Executing conversations query with access control...');


    const [rows] = await bigquery.query({ query });
    // console.log(`Retrieved ${rows.length} rows from conversations table before access filtering`);
    
    // Debug: Show date range of retrieved data
    if (rows.length > 0) {
      const dates = rows.map(row => {
        // Handle BigQuery date objects
        const date = row.datestamp;
        if (date && typeof date === 'object' && date.value) {
          return date.value;
        }
        return date;
      }).filter(Boolean).sort();
      
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];
      // console.log(`Date range in retrieved data: ${minDate} to ${maxDate}`);
      // console.log(`Sample dates: ${dates.slice(0, 5).join(', ')}`);
      // console.log(`Total unique dates: ${new Set(dates.map(d => d.split('T')[0])).size}`);
      
      // Check if we're hitting the limit and if data is only recent
      const daysDiff = Math.ceil((new Date(maxDate) - new Date(minDate)) / (1000 * 60 * 60 * 24));
      // console.log(`Actual date span in data: ${daysDiff} days`);
      if (rows.length === limitNum) {
        // console.log(`⚠️  WARNING: Hit the limit of ${limitNum} rows. Data might be truncated to recent dates only.`);
      }
    }
    
    // Debug Two-on-One meeting host data
    const twoOnOneMeetings = rows.filter(row => row.meeting_type === 'Two-on-One');
    if (twoOnOneMeetings.length > 0) {
      console.log('Sample Two-on-One meeting raw data from BigQuery:');
      const sample = twoOnOneMeetings[0];
      console.log({
        meeting_type: sample.meeting_type,
        host_vanid: sample.host_vanid,
        host_firstname: sample.host_firstname,
        host_lastname: sample.host_lastname,
        host_chapter: sample.host_chapter,
        organizer: sample.organizer,
        organizer_vanid: sample.organizer_vanid
      });
    }
    
    // Apply access control - show all meetings but filter sensitive notes
    let processedRows = rows;
    
    if (req.hasDataAccess) {
      // If user has data access but no specific accessible IDs, show all meetings with restricted notes
      const hasSpecificAccess = req.accessibleIds.size > 0;
      // console.log(`Has specific access: ${hasSpecificAccess}`);
      processedRows = rows.map(row => {
        const organizerVanId = row.organizer_vanid?.toString();
        const contactVanId = row.vanid?.toString();
        const hostVanId = row.host_vanid?.toString();
        const organizerUserId = row.organizer_userid?.toString();
        const contactUserId = row.contact_userid?.toString();
        const hostUserId = row.host_userid?.toString();
        
        // User can see full meeting details if they have access to the organizer, contact, OR host
        const hasOrganizerAccess = hasSpecificAccess && (req.accessibleIds.has(organizerVanId) || 
                                  req.accessibleIds.has(organizerUserId));
        const hasContactAccess = hasSpecificAccess && (req.accessibleIds.has(contactVanId) || 
                                req.accessibleIds.has(contactUserId));
        const hasHostAccess = hasSpecificAccess && hostVanId && (req.accessibleIds.has(hostVanId) || 
                             req.accessibleIds.has(hostUserId));
        // If user has no specific access (accessibleIds.size = 0), show all meetings but with restricted notes
        // If user has specific access, only show meetings they have access to
        const hasFullAccess = hasSpecificAccess ? (hasOrganizerAccess || hasContactAccess || hasHostAccess) : true;
        
        // For Two-on-One meetings, allow host name access if user has access to host, contact, or organizer
        // Note: organizer_vanid is often null for Two-on-One meetings, so we're more permissive with host names
        const hasTwoOnOneNotesAccess = row.meeting_type === 'Two-on-One' ? 
          (hasOrganizerAccess || hasContactAccess || hasHostAccess) : hasFullAccess;
        
        // Debug access control for Two-on-One meetings
        // if (row.meeting_type === 'Two-on-One') {
        //   console.log(`Two-on-One access control debug for host_vanid ${hostVanId}:`);
        //   console.log(`  Current user: ${req.currentUserId}`);
        //   console.log(`  hasOrganizerAccess: ${hasOrganizerAccess} (organizer: ${organizerVanId}/${organizerUserId})`);
        //   console.log(`  hasContactAccess: ${hasContactAccess} (contact: ${contactVanId}/${contactUserId})`);
        //   console.log(`  hasHostAccess: ${hasHostAccess} (host: ${hostVanId}/${hostUserId})`);
        //   console.log(`  hasFullAccess: ${hasFullAccess}`);
        //   console.log(`  hasTwoOnOneNotesAccess: ${hasTwoOnOneNotesAccess}`);
        //   console.log(`  Accessible IDs count: ${req.accessibleIds.size}`);
        // }
        
        return {
          ...row,
          hasFullAccess, // Mark whether user can see full details including notes
          hasTwoOnOneNotesAccess // Mark whether user can see Two-on-One specific notes
        };
      });
      
      // console.log(`Access control applied: showing all ${processedRows.length} conversations, with note restrictions based on org hierarchy for user ${req.currentUserId}`);
    } else {
      // console.log('No data access - user has no verified access');
      processedRows = []; // No access if user has no data access at all
    }
    
    // Remove the internal userid fields and apply access control to sensitive fields
    const cleanedRows = processedRows.map(row => {
      const { organizer_userid, contact_userid, host_userid, hasFullAccess, hasTwoOnOneNotesAccess, ...cleanedRow } = row;
      
      // If user doesn't have full access, hide meeting notes
      if (!hasFullAccess) {
        return {
          ...cleanedRow,
          notes_purpose: 'Restricted - No Access',
          notes_commitments: 'Restricted - No Access',
          notes_stakes: 'Restricted - No Access',
          notes_development: 'Restricted - No Access',
          notes_evaluation: 'Restricted - No Access',
          // Two-on-One specific notes access is controlled separately
          host_oneonone: cleanedRow.host_oneonone || false,
          host_vanid: cleanedRow.host_vanid || null,
          host_email: hasTwoOnOneNotesAccess ? cleanedRow.host_email : 'Restricted - No Access',
          two_risks: hasTwoOnOneNotesAccess ? cleanedRow.two_risks : 'Restricted - No Access',
          two_effective: hasTwoOnOneNotesAccess ? cleanedRow.two_effective : 'Restricted - No Access',
          two_support: hasTwoOnOneNotesAccess ? cleanedRow.two_support : 'Restricted - No Access',
          // Always show host names for Two-on-One meetings (basic organizational info, not sensitive)
          host_firstname: row.meeting_type === 'Two-on-One' ? cleanedRow.host_firstname : (hasTwoOnOneNotesAccess ? cleanedRow.host_firstname : 'Restricted'),
          host_lastname: row.meeting_type === 'Two-on-One' ? cleanedRow.host_lastname : (hasTwoOnOneNotesAccess ? cleanedRow.host_lastname : 'Restricted'),
          host_chapter: row.meeting_type === 'Two-on-One' ? cleanedRow.host_chapter : (hasTwoOnOneNotesAccess ? cleanedRow.host_chapter : 'Restricted'),
          hasFullAccess: false,
          hasTwoOnOneNotesAccess
        };
      }
      
      return {
        ...cleanedRow,
        // Ensure Two-on-One fields are always included
        host_oneonone: cleanedRow.host_oneonone || false,
        host_vanid: cleanedRow.host_vanid || null,
        host_email: cleanedRow.host_email || null,
        two_risks: cleanedRow.two_risks || null,
        two_effective: cleanedRow.two_effective || null,
        two_support: cleanedRow.two_support || null,
        host_firstname: cleanedRow.host_firstname || null,
        host_lastname: cleanedRow.host_lastname || null,
        host_chapter: cleanedRow.host_chapter || null,
        hasFullAccess: true,
        hasTwoOnOneNotesAccess: true
      };
    });
    
    if (cleanedRows.length > 0) {
      // console.log('Sample accessible meeting:', {
      //   organizer: cleanedRows[0].organizer_firstname + ' ' + cleanedRows[0].organizer_lastname,
      //   contact: cleanedRows[0].contact_firstname + ' ' + cleanedRows[0].contact_lastname,
      //   date: cleanedRows[0].datestamp
      // });
      
      // Debug Two-on-One meeting final output
      const twoOnOneOutput = cleanedRows.find(row => row.meeting_type === 'Two-on-One');
      if (twoOnOneOutput) {
        // console.log('Two-on-One meeting final output to frontend:');
        // console.log({
        //   meeting_type: twoOnOneOutput.meeting_type,
        //   organizer: twoOnOneOutput.organizer,
        //   host_vanid: twoOnOneOutput.host_vanid,
        //   host_firstname: twoOnOneOutput.host_firstname,
        //   host_lastname: twoOnOneOutput.host_lastname,
        //   hasFullAccess: twoOnOneOutput.hasFullAccess,
        //   hasTwoOnOneNotesAccess: twoOnOneOutput.hasTwoOnOneNotesAccess
        // });
        }
      }
    
    // console.log(`\n=== FINAL RESULT ===`);
    // console.log(`Sending ${cleanedRows.length} conversations to frontend`);
    // if (cleanedRows.length > 0) {
    //   console.log('Sample final data being sent:');
    //   console.log(JSON.stringify(cleanedRows.slice(0, 2), null, 2));
    // }
    // console.log(`===================\n`);
    
    res.json(cleanedRows);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

// New endpoint for histogram data aggregation (server-side)
app.get('/api/meetings/histogram', checkDataAccess, async (req, res) => {
  try {
    const { 
      granularity = 'week', // 'day', 'week', or 'month'
      scope = 'federation', // 'federation', 'chapter', 'person', or 'type'
      start_date,
      end_date,
      chapter,
      organizer,
      meeting_types // comma-separated list
    } = req.query;

    // Removed excessive logging - this endpoint is called very frequently
    // console.log(`📊 /api/meetings/histogram called with: granularity=${granularity}, scope=${scope}, start_date=${start_date}, end_date=${end_date}, chapter=${chapter}, organizer=${organizer}, meeting_types=${meeting_types}`);

    // Use native PostgreSQL syntax — no BigQuery FORMAT_DATE / DATE_TRUNC(field, UNIT) patterns
    // to avoid _convertSQLSyntax regex mangling nested-paren expressions.
    let timeBucket;
    let timeLabel;
    switch (granularity) {
      case 'day':
        timeBucket = "date_contacted::date";
        timeLabel  = "TO_CHAR(date_contacted::date, 'Mon DD')";
        break;
      case 'month':
        timeBucket = "DATE_TRUNC('month', date_contacted::date)";
        timeLabel  = "TO_CHAR(DATE_TRUNC('month', date_contacted::date), 'Mon YYYY')";
        break;
      case 'week':
      default:
        timeBucket = "DATE_TRUNC('week', date_contacted::date)";
        timeLabel  = "TO_CHAR(DATE_TRUNC('week', date_contacted::date), 'Mon DD')";
    }

    // Scope grouping (all in native PostgreSQL)
    let scopeCol;
    switch (scope) {
      case 'chapter':
        scopeCol = 'participant_chapter';
        break;
      case 'person':
        scopeCol = "COALESCE(NULLIF(TRIM(CONCAT(COALESCE(o1.firstname,''),' ',COALESCE(o1.lastname,''))),'')"
                 + ", NULLIF(TRIM(CONCAT(COALESCE(cont2.first_name,''),' ',COALESCE(cont2.last_name,''))),''),"
                 + " 'Unknown')";
        break;
      case 'type':
        scopeCol = 'conversation_type';
        break;
      case 'federation':
      default:
        scopeCol = "'Carolina Federation'";
    }

    // WHERE conditions — built as raw SQL (no params needed, values are from server-side query string)
    const convWhereParts = ['1=1'];
    const mtgWhereParts  = ['1=1'];
    if (start_date) {
      convWhereParts.push(`date_contacted::date >= '${start_date}'::date`);
      mtgWhereParts.push(`meeting_date >= '${start_date}'::date`);
    }
    if (end_date) {
      convWhereParts.push(`date_contacted::date <= '${end_date}'::date`);
      mtgWhereParts.push(`meeting_date <= '${end_date}'::date`);
    }
    if (chapter && chapter !== 'All Chapters') {
      convWhereParts.push(`participant_chapter = '${chapter}'`);
    }
    if (organizer) {
      const orgLike = `'%${organizer.replace(/'/g, "''")}%'`;
      convWhereParts.push(`(LOWER(CONCAT(COALESCE(o1.firstname,''),' ',COALESCE(o1.lastname,''))) LIKE LOWER(${orgLike}) OR LOWER(CONCAT(COALESCE(cont2.first_name,''),' ',COALESCE(cont2.last_name,''))) LIKE LOWER(${orgLike}))`);
      mtgWhereParts.push(`(LOWER(CONCAT(COALESCE(o1.firstname,''),' ',COALESCE(o1.lastname,''))) LIKE LOWER(${orgLike}) OR LOWER(CONCAT(COALESCE(cont2.first_name,''),' ',COALESCE(cont2.last_name,''))) LIKE LOWER(${orgLike}))`);
    }

    // UNION conversations (historical) + lumoviz_meetings (newly logged)
    // lumoviz_meetings has meeting_date instead of date_contacted; map to same aliases.
    const query = `
      WITH combined AS (
        SELECT
          ${timeBucket}          AS time_bucket,
          ${timeLabel}           AS time_label,
          ${scopeCol}            AS scope_key
        FROM conversations c
        LEFT JOIN org_ids o1   ON c.organizer_vanid::TEXT = o1.vanid::TEXT
        LEFT JOIN contacts cont2 ON c.organizer_vanid::TEXT = cont2.vanid::TEXT
        WHERE ${convWhereParts.join(' AND ')}

        UNION ALL

        SELECT
          ${timeBucket.replace(/date_contacted/g, 'meeting_date')} AS time_bucket,
          ${timeLabel.replace(/date_contacted/g, 'meeting_date')}  AS time_label,
          'One-on-One'                                             AS scope_key
        FROM lumoviz_meetings m
        LEFT JOIN org_ids o1   ON m.organizer_vanid::TEXT = o1.vanid::TEXT
        LEFT JOIN contacts cont2 ON m.organizer_vanid::TEXT = cont2.vanid::TEXT
        WHERE ${mtgWhereParts.join(' AND ')}
      )
      SELECT time_bucket, time_label, scope_key, COUNT(*) AS meeting_count
      FROM combined
      GROUP BY 1, 2, 3
      ORDER BY 1 ASC
    `;

    const rows = await database.rawQuery(query);

    console.log(`📊 Histogram query returned ${Array.isArray(rows) ? rows.length : 'undefined'} rows`);

    res.json({
      success: true,
      data: Array.isArray(rows) ? rows : [],
      params: { granularity, scope, start_date, end_date, chapter, organizer, meeting_types }
    });
  } catch (error) {
    console.error('❌ Error in /api/meetings/histogram:', error);
    res.status(500).json({ 
      error: 'Failed to fetch histogram data', 
      details: error.message 
    });
  }
});

// Get meetings for specific contact IDs — used by People Panel for Last Contact, count, and notes.
// Returns data from BOTH the historical conversations table AND newly-logged lumoviz_meetings.
app.post('/api/meetings/by-contacts', checkDataAccess, async (req, res) => {
  try {
    const { contact_ids, include_notes = false } = req.body;

    if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
      return res.status(400).json({ error: 'contact_ids array is required' });
    }

    // ids as a PostgreSQL text array for = ANY($1)
    const ids = contact_ids.map(id => String(id));

    // ── Branch 1: historical conversations ──────────────────────────────────
    // conversations table fields: purpose, commitments, stakes, evaluation (no development/values/etc.)
    // NULL placeholders added for lumoviz_meetings-specific columns to make UNION columns match.
    const convCols = include_notes
      ? `conv.participant_vanid,
         conv.organizer_vanid,
         conv.date_contacted,
         conv.conversation_type          AS meeting_type,
         oc.first_name                   AS organizer_first_name,
         oc.last_name                    AS organizer_last_name,
         conv.purpose                    AS notes_purpose,
         conv.commitments                AS notes_commitments,
         conv.stakes                     AS notes_stakes,
         conv.evaluation                 AS notes_evaluation,
         conv.participant_first_name,
         conv.participant_last_name,
         conv.participant_chapter,
         NULL::TEXT                      AS lmtg_values,
         NULL::TEXT                      AS lmtg_difference,
         NULL::TEXT                      AS lmtg_resources,
         NULL::TEXT                      AS lmtg_commitment_what,
         NULL::TEXT                      AS lmtg_commitment_asked,
         NULL::TEXT                      AS lmtg_commitment_made,
         NULL::TEXT                      AS lmtg_leadership_tag,
         NULL::TEXT                      AS lmtg_catapults,
         NULL::TEXT                      AS lmtg_notes,
         NULL::TEXT                      AS lmtg_sp_constituency_stance,
         NULL::TEXT                      AS lmtg_sp_constituency_how,
         NULL::TEXT                      AS lmtg_sp_change_stance,
         NULL::TEXT                      AS lmtg_sp_change_how,
         'conversations'                 AS data_source`
      : `conv.participant_vanid,
         conv.organizer_vanid,
         conv.date_contacted,
         conv.conversation_type          AS meeting_type,
         oc.first_name                   AS organizer_first_name,
         oc.last_name                    AS organizer_last_name,
         conv.purpose                    AS notes_purpose,
         NULL::TEXT                      AS notes_commitments,
         NULL::TEXT                      AS notes_stakes,
         NULL::TEXT                      AS notes_evaluation,
         conv.participant_first_name,
         conv.participant_last_name,
         conv.participant_chapter,
         NULL::TEXT                      AS lmtg_values,
         NULL::TEXT                      AS lmtg_difference,
         NULL::TEXT                      AS lmtg_resources,
         NULL::TEXT                      AS lmtg_commitment_what,
         NULL::TEXT                      AS lmtg_commitment_asked,
         NULL::TEXT                      AS lmtg_commitment_made,
         NULL::TEXT                      AS lmtg_leadership_tag,
         NULL::TEXT                      AS lmtg_catapults,
         NULL::TEXT                      AS lmtg_notes,
         NULL::TEXT                      AS lmtg_sp_constituency_stance,
         NULL::TEXT                      AS lmtg_sp_constituency_how,
         NULL::TEXT                      AS lmtg_sp_change_stance,
         NULL::TEXT                      AS lmtg_sp_change_how,
         'conversations'                 AS data_source`;

    // ── Branch 2: newly-logged lumoviz_meetings ──────────────────────────────
    // Passes BOTH legacy notes_ aliases (for latestNotes computation) AND the
    // real lumoviz_meetings field names (so the display dialog can use proper labels).
    const mtgCols = include_notes
      ? `m.organizee_vanid               AS participant_vanid,
         m.organizer_vanid,
         m.meeting_date                  AS date_contacted,
         COALESCE(m.person_type, 'One-on-One') AS meeting_type,
         oc.first_name                   AS organizer_first_name,
         oc.last_name                    AS organizer_last_name,
         m.purpose                       AS notes_purpose,
         m.commitment_what               AS notes_commitments,
         NULL::TEXT                      AS notes_stakes,
         NULL::TEXT                      AS notes_evaluation,
         c.first_name                    AS participant_first_name,
         c.last_name                     AS participant_last_name,
         c.chapter                       AS participant_chapter,
         m.values                        AS lmtg_values,
         m.difference                    AS lmtg_difference,
         m.resources                     AS lmtg_resources,
         m.commitment_what               AS lmtg_commitment_what,
         m.commitment_asked_yn           AS lmtg_commitment_asked,
         m.commitment_made_yn            AS lmtg_commitment_made,
         m.leadership_tag                AS lmtg_leadership_tag,
         array_to_string(m.catapults, ', ') AS lmtg_catapults,
         m.notes                         AS lmtg_notes,
         m.shared_purpose_constituency_stance AS lmtg_sp_constituency_stance,
         m.shared_purpose_constituency_how    AS lmtg_sp_constituency_how,
         m.shared_purpose_change_stance       AS lmtg_sp_change_stance,
         m.shared_purpose_change_how          AS lmtg_sp_change_how,
         'lumoviz_meetings'              AS data_source`
      : `m.organizee_vanid               AS participant_vanid,
         m.organizer_vanid,
         m.meeting_date                  AS date_contacted,
         COALESCE(m.person_type, 'One-on-One') AS meeting_type,
         oc.first_name                   AS organizer_first_name,
         oc.last_name                    AS organizer_last_name,
         m.purpose                       AS notes_purpose,
         NULL::TEXT                      AS notes_commitments,
         NULL::TEXT                      AS notes_stakes,
         NULL::TEXT                      AS notes_evaluation,
         c.first_name                    AS participant_first_name,
         c.last_name                     AS participant_last_name,
         c.chapter                       AS participant_chapter,
         m.values                        AS lmtg_values,
         m.difference                    AS lmtg_difference,
         m.resources                     AS lmtg_resources,
         m.commitment_what               AS lmtg_commitment_what,
         m.commitment_asked_yn           AS lmtg_commitment_asked,
         m.commitment_made_yn            AS lmtg_commitment_made,
         m.leadership_tag                AS lmtg_leadership_tag,
         array_to_string(m.catapults, ', ') AS lmtg_catapults,
         m.notes                         AS lmtg_notes,
         m.shared_purpose_constituency_stance AS lmtg_sp_constituency_stance,
         m.shared_purpose_constituency_how    AS lmtg_sp_constituency_how,
         m.shared_purpose_change_stance       AS lmtg_sp_change_stance,
         m.shared_purpose_change_how          AS lmtg_sp_change_how,
         'lumoviz_meetings'              AS data_source`;

    const query = `
      SELECT ${convCols}
      FROM   conversations conv
      LEFT JOIN contacts oc ON conv.organizer_vanid::TEXT = oc.vanid::TEXT
      WHERE  conv.participant_vanid::TEXT = ANY($1)

      UNION ALL

      SELECT ${mtgCols}
      FROM   lumoviz_meetings m
      LEFT JOIN contacts oc ON m.organizer_vanid::TEXT = oc.vanid::TEXT
      LEFT JOIN contacts c  ON m.organizee_vanid::TEXT = c.vanid::TEXT
      WHERE  m.organizee_vanid::TEXT = ANY($1)

      ORDER BY date_contacted DESC
    `;

    const rows = await database.rawQuery(query, [ids]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching meetings by contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/meetings - Returns both historical conversations AND newly-logged lumoviz_meetings
app.get('/api/meetings', checkDataAccess, async (req, res) => {
  try {
    const { startDate, endDate, chapter, participant, page = 0, limit = 50000 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // --- Branch 1: historical data from the conversations table (BigQuery-era) ---
    let convWhere = ['1=1'];
    if (startDate) convWhere.push(`(c.date_contacted)::date >= ('${startDate}')::date`);
    if (endDate)   convWhere.push(`(c.date_contacted)::date <= ('${endDate}')::date`);
    if (chapter && chapter !== 'All Chapters')
      convWhere.push(`(c.participant_chapter = '${chapter}' OR cont2.chapter = '${chapter}')`);
    if (participant)
      convWhere.push(`CAST(c.participant_vanid AS TEXT) = '${participant}'`);

    const convQuery = `
      SELECT
        c.organizer_vanid,
        COALESCE(
          NULLIF(TRIM(CONCAT(COALESCE(o1.firstname,''),' ',COALESCE(o1.lastname,''))), ''),
          NULLIF(TRIM(CONCAT(COALESCE(cont2.first_name,''),' ',COALESCE(cont2.last_name,''))), ''),
          'Unknown Organizer'
        ) AS organizer,
        c.participant_vanid::TEXT                                    AS vanid,
        c.date_contacted                                             AS datestamp,
        c.participant_chapter                                        AS chapter,
        c.conversation_type                                         AS meeting_type,
        c.purpose                                                    AS notes_purpose,
        c.commitments                                                AS notes_commitments,
        c.stakes                                                     AS notes_stakes,
        ''                                                           AS notes_development,
        c.evaluation                                                 AS notes_evaluation,
        NULL::TEXT                                                   AS host_oneonone,
        NULL::TEXT                                                   AS host_vanid,
        NULL::TEXT                                                   AS host_email,
        ''                                                           AS two_risks,
        ''                                                           AS two_effective,
        ''                                                           AS two_support,
        COALESCE(cont1.first_name, c.participant_first_name)        AS contact_firstname,
        COALESCE(cont1.last_name,  c.participant_last_name)         AS contact_lastname,
        c.participant_chapter                                        AS contact_chapter,
        cont1.loe                                                    AS contact_loe,
        cont1.member_status                                          AS member_status,
        cont1.email                                                  AS email,
        COALESCE(o1.firstname, cont2.first_name)                    AS organizer_firstname,
        COALESCE(o1.lastname,  cont2.last_name)                     AS organizer_lastname,
        cont2.chapter                                                AS organizer_chapter,
        cont2.loe                                                    AS organizer_loe,
        NULL::TEXT                                                   AS host_firstname,
        NULL::TEXT                                                   AS host_lastname,
        NULL::TEXT                                                   AS host_chapter,
        NULL::TEXT                                                   AS host_loe,
        o1.userid                                                    AS organizer_userid,
        o2.userid                                                    AS contact_userid,
        NULL::TEXT                                                   AS host_userid
      FROM conversations c
      LEFT JOIN contacts  cont1 ON c.participant_vanid::TEXT = cont1.vanid::TEXT
      LEFT JOIN contacts  cont2 ON c.organizer_vanid::TEXT  = cont2.vanid::TEXT
      LEFT JOIN org_ids   o1    ON c.organizer_vanid::TEXT  = o1.vanid::TEXT
      LEFT JOIN org_ids   o2    ON c.participant_vanid::TEXT = o2.vanid::TEXT
      WHERE ${convWhere.join(' AND ')}
    `;

    // --- Branch 2: newly logged meetings from lumoviz_meetings ---
    let mtgWhere = ['1=1'];
    if (startDate) mtgWhere.push(`m.meeting_date >= '${startDate}'::date`);
    if (endDate)   mtgWhere.push(`m.meeting_date <= '${endDate}'::date`);
    if (participant) mtgWhere.push(`m.organizee_vanid::TEXT = '${participant}'`);

    const mtgQuery = `
      SELECT
        m.organizer_vanid,
        COALESCE(
          NULLIF(TRIM(CONCAT(COALESCE(o1.firstname,''),' ',COALESCE(o1.lastname,''))), ''),
          NULLIF(TRIM(CONCAT(COALESCE(cont2.first_name,''),' ',COALESCE(cont2.last_name,''))), ''),
          'Unknown Organizer'
        ) AS organizer,
        m.organizee_vanid::TEXT                                      AS vanid,
        m.meeting_date                                               AS datestamp,
        NULL::TEXT                                                   AS chapter,
        'One-on-One'                                                 AS meeting_type,
        m.purpose                                                    AS notes_purpose,
        m.commitment_what                                            AS notes_commitments,
        m.values                                                     AS notes_stakes,
        m.difference                                                 AS notes_development,
        m.resources                                                  AS notes_evaluation,
        NULL::TEXT                                                   AS host_oneonone,
        NULL::TEXT                                                   AS host_vanid,
        NULL::TEXT                                                   AS host_email,
        ''                                                           AS two_risks,
        ''                                                           AS two_effective,
        ''                                                           AS two_support,
        cont1.first_name                                             AS contact_firstname,
        cont1.last_name                                              AS contact_lastname,
        cont1.chapter                                                AS contact_chapter,
        cont1.loe                                                    AS contact_loe,
        cont1.member_status                                          AS member_status,
        cont1.email                                                  AS email,
        COALESCE(o1.firstname, cont2.first_name)                    AS organizer_firstname,
        COALESCE(o1.lastname,  cont2.last_name)                     AS organizer_lastname,
        cont2.chapter                                                AS organizer_chapter,
        cont2.loe                                                    AS organizer_loe,
        NULL::TEXT                                                   AS host_firstname,
        NULL::TEXT                                                   AS host_lastname,
        NULL::TEXT                                                   AS host_chapter,
        NULL::TEXT                                                   AS host_loe,
        o1.userid                                                    AS organizer_userid,
        o2.userid                                                    AS contact_userid,
        NULL::TEXT                                                   AS host_userid
      FROM lumoviz_meetings m
      LEFT JOIN contacts  cont1 ON m.organizee_vanid::TEXT = cont1.vanid::TEXT
      LEFT JOIN contacts  cont2 ON m.organizer_vanid::TEXT = cont2.vanid::TEXT
      LEFT JOIN org_ids   o1    ON m.organizer_vanid::TEXT = o1.vanid::TEXT
      LEFT JOIN org_ids   o2    ON m.organizee_vanid::TEXT = o2.vanid::TEXT
      WHERE ${mtgWhere.join(' AND ')}
    `;

    // Run both queries in parallel
    const [[convRows], [mtgRows]] = await Promise.all([
      database.query({ query: convQuery }),
      database.query({ query: mtgQuery }),
    ]);

    const allRows = [...(convRows || []), ...(mtgRows || [])];

    // Apply chapter filter to lumoviz_meetings rows (no chapter column there)
    const chapterFiltered = (chapter && chapter !== 'All Chapters')
      ? allRows.filter(r => !r.chapter || r.chapter === chapter || r.organizer_chapter === chapter)
      : allRows;

    // Access control filter
    const filtered = chapterFiltered.filter(row => {
      const orgId  = row.organizer_userid?.toString();
      const conId  = row.contact_userid?.toString();
      const hstId  = row.host_userid?.toString();
      return req.accessibleIds.has(orgId) || req.accessibleIds.has(conId) || req.accessibleIds.has(hstId);
    });

    // Sort combined result by date desc, apply pagination
    filtered.sort((a, b) => new Date(b.datestamp) - new Date(a.datestamp));
    res.json(filtered.slice(pageNum * limitNum, (pageNum + 1) * limitNum));
  } catch (error) {
    console.error('Error in /api/meetings:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get meetings endpoint
app.get('/api/user-map-schema', async (req, res) => {
  try {
    // console.log('Checking user_map table schema...');
    
    const schemaQuery = `
      SELECT column_name, data_type
      FROM \`${PROJECT_ID}\`.${DATASET_ID}.INFORMATION_SCHEMA.COLUMNS
      WHERE table_name = 'user_map'
      ORDER BY ordinal_position
    `;
    
    const [columns] = await bigquery.query({ query: schemaQuery });
    // console.log('User_map columns:', columns.map(col => col.column_name).join(', '));
    
    // Also get a sample row
    const sampleQuery = `
      SELECT *
      FROM \`${PROJECT_ID}.${DATASET_ID}.user_map\`
      LIMIT 5
    `;
    
    const [rows] = await bigquery.query({ query: sampleQuery });
    
    res.json({
      columns: columns,
      sampleData: rows
    });
  } catch (error) {
    console.error('Error checking user_map schema:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add a new endpoint to debug links between two specific nodes
app.get('/api/link-debug/:nodeId1/:nodeId2', async (req, res) => {
  try {
    const { nodeId1, nodeId2 } = req.params;
    // console.log(`Fetching debug data for link between nodes: ${nodeId1} and ${nodeId2}`);
    
    // Query contact_history for any interactions between these two nodes
    const contactHistoryQuery = `
      SELECT 
        ch.userid,
        ch.vanid,
        ch.username,
        ch.utc_datecanvassed,
        ch.contact_type,
        ch.contact_result,
        ch.input_source,
        c.firstname as target_first_name,
        c.lastname as target_last_name,
        c.chapter as target_chapter,
        c.loe as target_loe,
        um.firstname as organizer_first_name,
        um.lastname as organizer_last_name
      FROM 
        \`${PROJECT_ID}.${DATASET_ID}.contact_history\` ch
      LEFT JOIN
        \`${PROJECT_ID}.${DATASET_ID}.contacts\` c
      ON
        ch.vanid = c.vanid
      LEFT JOIN
        \`${PROJECT_ID}.${DATASET_ID}.user_map\` um
      ON
        ch.userid = um.userid
      WHERE 
        ((ch.userid = '${nodeId1}' OR CAST(ch.userid AS STRING) = '${nodeId1}') AND (ch.vanid = '${nodeId2}' OR CAST(ch.vanid AS STRING) = '${nodeId2}'))
        OR
        ((ch.userid = '${nodeId2}' OR CAST(ch.userid AS STRING) = '${nodeId2}') AND (ch.vanid = '${nodeId1}' OR CAST(ch.vanid AS STRING) = '${nodeId1}'))
      ORDER BY ch.utc_datecanvassed DESC
    `;

    // Query conversations for any interactions between these two nodes
    // NOTE: Names come from org_ids first, then contacts table as fallback (NOT from conversations)
    const conversationsQuery = `
      SELECT 
        c.organizer_vanid,
        c.participant_vanid as vanid,
        c.date_contacted as datestamp,
        c.participant_chapter as chapter,
        c.conversation_type as meeting_type,
        c.purpose as notes_purpose,
        c.commitments as notes_commitments,
        c.stakes as notes_stakes,
        '' as notes_development,
        c.evaluation as notes_evaluation,
        -- Contact information (participant) - use contacts table
        COALESCE(cont1.first_name, c.participant_first_name) as contact_firstname,
        COALESCE(cont1.last_name, c.participant_last_name) as contact_lastname,
        c.participant_chapter as contact_chapter,
        cont1.loe as contact_loe,
        -- Organizer information - try org_ids first, then contacts
        COALESCE(o1.firstname, cont2.first_name) as organizer_firstname,
        COALESCE(o1.lastname, cont2.last_name) as organizer_lastname,
        cont2.chapter as organizer_chapter,
        cont2.loe as organizer_loe
      FROM \`${PROJECT_ID}.${DATASET_ID}.conversations\` c
      LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.contacts\` cont1 
        ON CAST(c.participant_vanid AS STRING) = CAST(cont1.vanid AS STRING)
      LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.contacts\` cont2 
        ON CAST(c.organizer_vanid AS STRING) = CAST(cont2.vanid AS STRING)
      LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.org_ids\` o1
        ON CAST(c.organizer_vanid AS STRING) = CAST(o1.vanid AS STRING)
      WHERE 
        ((c.organizer_vanid = '${nodeId1}' OR CAST(c.organizer_vanid AS STRING) = '${nodeId1}') AND (c.participant_vanid = '${nodeId2}' OR CAST(c.participant_vanid AS STRING) = '${nodeId2}'))
        OR
        ((c.organizer_vanid = '${nodeId2}' OR CAST(c.organizer_vanid AS STRING) = '${nodeId2}') AND (c.participant_vanid = '${nodeId1}' OR CAST(c.participant_vanid AS STRING) = '${nodeId1}'))
      ORDER BY c.date_contacted DESC
    `;

    // Execute queries in parallel
    const [contactHistoryRows] = await bigquery.query({ query: contactHistoryQuery });
    const [conversationsRows] = await bigquery.query({ query: conversationsQuery });

    // console.log(`Link debug data between ${nodeId1} and ${nodeId2}:`);
    // console.log(`- Contact History: ${contactHistoryRows.length} rows`);
    // console.log(`- Conversations: ${conversationsRows.length} rows`);

    // Log detailed results
    if (contactHistoryRows.length > 0) {
      // console.log('Contact History Details:');
      contactHistoryRows.forEach((row, idx) => {
        // console.log(`  ${idx + 1}. User ${row.userid} (${row.organizer_first_name} ${row.organizer_last_name}) contacted VAN ${row.vanid} (${row.target_first_name} ${row.target_last_name}) on ${row.utc_datecanvassed}`);
      });
    }

    if (conversationsRows.length > 0) {
      // console.log('Conversations Details:');
      conversationsRows.forEach((row, idx) => {
        // console.log(`  ${idx + 1}. Organizer VAN ${row.organizer_vanid} (${row.organizer_firstname} ${row.organizer_lastname}) met with VAN ${row.vanid} (${row.contact_firstname} ${row.contact_lastname}) on ${row.datestamp}`);
      });
    }

    res.json({
      nodeId1,
      nodeId2,
      contactHistory: contactHistoryRows,
      meetings: conversationsRows,
      summary: {
        contactHistoryCount: contactHistoryRows.length,
        meetingsCount: conversationsRows.length
      }
    });
  } catch (error) {
    // console.error(`Error fetching link debug data between ${req.params.nodeId1} and ${req.params.nodeId2}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Add a new endpoint to get raw meeting/contact data for a specific node for debugging
app.get('/api/node-debug/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    // console.log(`Fetching debug data for node: ${nodeId}`);
    
    // Query contact_history for this node as both source and target
    const contactHistoryQuery = `
      SELECT 
        ch.userid,
        ch.vanid,
        ch.username,
        ch.utc_datecanvassed,
        ch.contact_type,
        ch.contact_result,
        ch.input_source,
        c.firstname as target_first_name,
        c.lastname as target_last_name,
        c.chapter as target_chapter,
        c.loe as target_loe,
        um.firstname as organizer_first_name,
        um.lastname as organizer_last_name
      FROM 
        \`${PROJECT_ID}.${DATASET_ID}.contact_history\` ch
      LEFT JOIN
        \`${PROJECT_ID}.${DATASET_ID}.contacts\` c
      ON
        ch.vanid = c.vanid
      LEFT JOIN
        \`${PROJECT_ID}.${DATASET_ID}.user_map\` um
      ON
        ch.userid = um.userid
      WHERE 
        ch.userid = '${nodeId}' OR ch.vanid = '${nodeId}'
        OR CAST(ch.userid AS STRING) = '${nodeId}' OR CAST(ch.vanid AS STRING) = '${nodeId}'
      ORDER BY ch.utc_datecanvassed DESC
      LIMIT 100
    `;

    // Query conversations for this node as both organizer and participant
    // NOTE: Names come from org_ids first, then contacts table as fallback (NOT from conversations)
    const conversationsQuery = `
      SELECT 
        c.organizer_vanid,
        c.participant_vanid as vanid,
        c.date_contacted as datestamp,
        c.participant_chapter as chapter,
        c.conversation_type as meeting_type,
        c.purpose as notes_purpose,
        c.commitments as notes_commitments,
        c.stakes as notes_stakes,
        '' as notes_development,
        c.evaluation as notes_evaluation,
        -- Contact information (participant) - use contacts table
        COALESCE(cont1.first_name, c.participant_first_name) as contact_firstname,
        COALESCE(cont1.last_name, c.participant_last_name) as contact_lastname,
        c.participant_chapter as contact_chapter,
        cont1.loe as contact_loe,
        -- Organizer information - try org_ids first, then contacts
        COALESCE(o1.firstname, cont2.first_name) as organizer_firstname,
        COALESCE(o1.lastname, cont2.last_name) as organizer_lastname,
        cont2.chapter as organizer_chapter,
        cont2.loe as organizer_loe
      FROM \`${PROJECT_ID}.${DATASET_ID}.conversations\` c
      LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.contacts\` cont1 
        ON CAST(c.participant_vanid AS STRING) = CAST(cont1.vanid AS STRING)
      LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.contacts\` cont2 
        ON CAST(c.organizer_vanid AS STRING) = CAST(cont2.vanid AS STRING)
      LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.org_ids\` o1
        ON CAST(c.organizer_vanid AS STRING) = CAST(o1.vanid AS STRING)
      WHERE 
        c.organizer_vanid = '${nodeId}' OR c.participant_vanid = '${nodeId}'
        OR CAST(c.organizer_vanid AS STRING) = '${nodeId}' OR CAST(c.participant_vanid AS STRING) = '${nodeId}'
      ORDER BY c.date_contacted DESC
      LIMIT 100
    `;

    // Query org_ids to get additional info about this node
    const orgIdsQuery = `
      SELECT *
      FROM \`${PROJECT_ID}.${DATASET_ID}.org_ids\`
      WHERE 
        vanid = '${nodeId}' OR userid = '${nodeId}'
        OR CAST(vanid AS STRING) = '${nodeId}' OR CAST(userid AS STRING) = '${nodeId}'
    `;

    // Query contacts table
    const contactsQuery = `
      SELECT *
      FROM \`${PROJECT_ID}.${DATASET_ID}.contacts\`
      WHERE 
        vanid = '${nodeId}' OR CAST(vanid AS STRING) = '${nodeId}'
    `;

    // Execute all queries in parallel
    const [contactHistoryRows] = await bigquery.query({ query: contactHistoryQuery });
    const [conversationsRows] = await bigquery.query({ query: conversationsQuery });
    const [orgIdsRows] = await bigquery.query({ query: orgIdsQuery });
    const [contactsRows] = await bigquery.query({ query: contactsQuery });

    // console.log(`Debug data for node ${nodeId}:`);
    // console.log(`- Contact History: ${contactHistoryRows.length} rows`);
    // console.log(`- Conversations: ${conversationsRows.length} rows`);
    // console.log(`- Org IDs: ${orgIdsRows.length} rows`);
    // console.log(`- Contacts: ${contactsRows.length} rows`);

    // Return all the raw data
    res.json({
      nodeId,
      contactHistory: contactHistoryRows,
      meetings: conversationsRows,
      orgIds: orgIdsRows,
      contacts: contactsRows,
      summary: {
        contactHistoryCount: contactHistoryRows.length,
        meetingsCount: conversationsRows.length,
        orgIdsCount: orgIdsRows.length,
        contactsCount: contactsRows.length
      }
    });
  } catch (error) {
    // console.error(`Error fetching debug data for node ${req.params.nodeId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Add endpoint to get comprehensive network data including Two-on-One meeting hosts
app.get('/api/network-data-with-hosts', checkDataAccess, async (req, res) => {
  try {
    const { start_date, end_date, chapter, page = 0, limit = 1000 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    // console.log('Network data with hosts request:', { start_date, end_date, chapter, page, limit });

    // Query contact history data directly
    let contactHistoryQuery = `
      SELECT 
        ch.userid,
        ch.vanid,
        ch.username,
        ch.utc_datecanvassed,
        ch.contact_type,
        ch.contact_result,
        ch.input_source,
        c.firstname as target_first_name,
        c.lastname as target_last_name,
        c.chapter as target_chapter,
        um.firstname as organizer_first_name,
        um.lastname as organizer_last_name
      FROM 
        \`${PROJECT_ID}.${DATASET_ID}.contact_history\` ch
      LEFT JOIN
        \`${PROJECT_ID}.${DATASET_ID}.contacts\` c
      ON
        ch.vanid = c.vanid
      LEFT JOIN
        \`${PROJECT_ID}.${DATASET_ID}.user_map\` um
      ON
        ch.userid = um.userid
      WHERE 1=1
    `;

    // Add date filters for contact history
    if (start_date) {
      contactHistoryQuery += ` AND ch.utc_datecanvassed >= TIMESTAMP('${start_date}')`;
    }
    if (end_date) {
      contactHistoryQuery += ` AND ch.utc_datecanvassed <= TIMESTAMP('${end_date}')`;
    }
    if (chapter && chapter !== 'All Chapters') {
      contactHistoryQuery += ` AND c.chapter = '${chapter}'`;
    }
    contactHistoryQuery += ` ORDER BY ch.utc_datecanvassed DESC LIMIT ${limitNum} OFFSET ${pageNum * limitNum}`;

    // Query conversations data with Two-on-One information
    // NOTE: Names come from org_ids first, then contacts table as fallback (NOT from conversations)
    let conversationsQuery = `
      SELECT 
        c.organizer_vanid,
        c.participant_vanid as vanid,
        c.date_contacted as datestamp,
        c.participant_chapter as chapter,
        c.conversation_type as meeting_type,
        c.purpose as notes_purpose,
        c.commitments as notes_commitments,
        c.stakes as notes_stakes,
        '' as notes_development,
        c.evaluation as notes_evaluation,
        -- Two-on-One meeting fields - host name: try org_ids first, then contacts
        CASE WHEN c.host_vanid IS NOT NULL THEN 
          COALESCE(
            NULLIF(TRIM(CONCAT(COALESCE(o3.firstname, ''), ' ', COALESCE(o3.lastname, ''))), ''),
            NULLIF(TRIM(CONCAT(COALESCE(cont3.first_name, ''), ' ', COALESCE(cont3.last_name, ''))), ''),
            'Unknown Host'
          )
        ELSE NULL END as host_oneonone,
        c.host_vanid,
        c.host_email,
        '' as two_risks,
        '' as two_effective,
        '' as two_support,
        -- Contact information (participant) - use contacts table
        COALESCE(cont1.first_name, c.participant_first_name) as contact_firstname,
        COALESCE(cont1.last_name, c.participant_last_name) as contact_lastname,
        c.participant_chapter as contact_chapter,
        -- Organizer information - try org_ids first, then contacts
        COALESCE(o1.firstname, cont2.first_name) as organizer_firstname,
        COALESCE(o1.lastname, cont2.last_name) as organizer_lastname,
        cont2.chapter as organizer_chapter,
        -- Host information (for Two-on-One meetings) - try org_ids first, then contacts
        COALESCE(o3.firstname, cont3.first_name) as host_firstname,
        COALESCE(o3.lastname, cont3.last_name) as host_lastname,
        cont3.chapter as host_chapter,
        o1.userid as organizer_userid,
        o2.userid as contact_userid,
        o3.userid as host_userid
      FROM \`${PROJECT_ID}.${DATASET_ID}.conversations\` c
      LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.contacts\` cont1 
        ON CAST(c.participant_vanid AS STRING) = CAST(cont1.vanid AS STRING)
      LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.contacts\` cont2 
        ON CAST(c.organizer_vanid AS STRING) = CAST(cont2.vanid AS STRING)
      LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.contacts\` cont3 
        ON CAST(c.host_vanid AS STRING) = CAST(cont3.vanid AS STRING)
      
      LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.org_ids\` o1
        ON CAST(c.organizer_vanid AS STRING) = CAST(o1.vanid AS STRING)
      LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.org_ids\` o2
        ON CAST(c.participant_vanid AS STRING) = CAST(o2.vanid AS STRING)
      LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.org_ids\` o3
        ON CAST(c.host_vanid AS STRING) = CAST(o3.vanid AS STRING)
      WHERE 1=1
    `;

    // Add date filters for conversations
    if (start_date) {
      conversationsQuery += ` AND (c.date_contacted)::date >= ('${start_date}')::date`;
    }
    if (end_date) {
      conversationsQuery += ` AND (c.date_contacted)::date <= ('${end_date}')::date`;
    }
    if (chapter && chapter !== 'All Chapters') {
      // Include conversations where EITHER the participant OR organizer is from the selected chapter
      conversationsQuery += ` AND (c.participant_chapter = '${chapter}' OR cont2.chapter = '${chapter}')`;
    }
    conversationsQuery += ` ORDER BY c.date_contacted DESC LIMIT ${limitNum} OFFSET ${pageNum * limitNum}`;

    // Execute both queries
    const [contactHistoryRows] = await bigquery.query({ query: contactHistoryQuery });
    const [conversationsRows] = await bigquery.query({ query: conversationsQuery });

    // console.log(`Retrieved ${contactHistoryRows.length} contact history rows and ${conversationsRows.length} conversation rows`);

    // Apply access control to contact history
    let processedContactHistory = contactHistoryRows.map(row => {
      const userid = row.userid?.toString();
      const vanid = row.vanid?.toString();
      
      const hasOrganizerAccess = req.accessibleIds.has(userid);
      const hasContactAccess = req.accessibleIds.has(vanid);
      const hasFullAccess = hasOrganizerAccess || hasContactAccess;
      
      return {
        ...row,
        hasFullAccess
      };
    });

    // Apply access control to meetings and create host connections
    let processedMeetings = [];
    let hostConnections = [];

    conversationsRows.forEach(row => {
      const organizerVanId = row.organizer_vanid?.toString();
      const contactVanId = row.vanid?.toString();
      const hostVanId = row.host_vanid?.toString();
      const organizerUserId = row.organizer_userid?.toString();
      const contactUserId = row.contact_userid?.toString();
      const hostUserId = row.host_userid?.toString();
      
      // Access control check for general meeting visibility
      const hasOrganizerAccess = req.accessibleIds.has(organizerVanId) || req.accessibleIds.has(organizerUserId);
      const hasContactAccess = req.accessibleIds.has(contactVanId) || req.accessibleIds.has(contactUserId);
      const hasHostAccess = hostVanId && (req.accessibleIds.has(hostVanId) || req.accessibleIds.has(hostUserId));
      const hasFullAccess = hasOrganizerAccess || hasContactAccess || hasHostAccess;

      // For Two-on-One meetings, Two-on-One notes access is based specifically on organizer access
      const hasTwoOnOneNotesAccess = row.meeting_type === 'Two-on-One' ? hasOrganizerAccess : hasFullAccess;

      // Add processed meeting
      processedMeetings.push({
        ...row,
        hasFullAccess,
        hasTwoOnOneNotesAccess
      });

             // Create host connection for Two-on-One meetings
       if (row.meeting_type === 'Two-on-One' && hostVanId && contactVanId) {
        hostConnections.push({
          userid: hostVanId,
          vanid: contactVanId,
          username: row.host_firstname && row.host_lastname 
            ? `${row.host_firstname} ${row.host_lastname}` 
            : `Host ${hostVanId}`,
          source_name: row.host_firstname && row.host_lastname 
            ? `${row.host_firstname} ${row.host_lastname}` 
            : `Host ${hostVanId}`,
          target_name: row.contact_firstname && row.contact_lastname
            ? `${row.contact_firstname} ${row.contact_lastname}`
            : `Contact ${contactVanId}`,
          source_chapter: row.host_chapter || 'Unknown',
          target_chapter: row.contact_chapter || 'Unknown',
          utc_datecanvassed: row.datestamp ? new Date(row.datestamp).toISOString() : new Date().toISOString(),
          contact_type: 'Two-on-One Meeting (Host)',
          contact_result: 'Meeting Completed',
          input_source: 'Two-on-One Meeting',
          hasFullAccess,
          meeting_type: 'host_connection'
        });
      }
    });

    // Format contact history data
    const formattedContactHistory = processedContactHistory.map(row => {
      const userid = row.userid ? row.userid.toString() : '';
      const vanid = row.vanid ? row.vanid.toString() : '';
      const hasFullAccess = row.hasFullAccess !== false;
      
      return {
        userid,
        vanid,
        username: hasFullAccess ? (row.username || '') : 'Restricted',
        source_name: hasFullAccess ? (row.username || `User ${userid}`) : 'Restricted User',
        target_name: hasFullAccess && row.target_first_name && row.target_last_name
          ? `${row.target_first_name} ${row.target_last_name}`
          : hasFullAccess ? `Contact ${vanid}` : 'Restricted Contact',
        source_chapter: hasFullAccess ? 'Unknown' : 'Restricted',
        target_chapter: hasFullAccess ? (row.target_chapter || 'Unknown') : 'Restricted',
        utc_datecanvassed: row.utc_datecanvassed ? row.utc_datecanvassed.value || row.utc_datecanvassed : new Date().toISOString(),
        contact_type: hasFullAccess ? (row.contact_type || 'Unknown') : 'Restricted',
        contact_result: hasFullAccess ? (row.contact_result || 'Unknown') : 'Restricted',
        input_source: hasFullAccess ? (row.input_source || 'Unknown') : 'Restricted',
        hasFullAccess
      };
    }).filter(row => row.userid && row.vanid);

    // Format meetings data
    const formattedMeetings = processedMeetings.map(row => {
      const hasFullAccess = row.hasFullAccess !== false;
      const hasTwoOnOneNotesAccess = row.hasTwoOnOneNotesAccess !== false;
      
      return {
        ...row,
        notes_purpose: hasFullAccess ? row.notes_purpose : 'Restricted - No Access',
        notes_commitments: hasFullAccess ? row.notes_commitments : 'Restricted - No Access',
        notes_stakes: hasFullAccess ? row.notes_stakes : 'Restricted - No Access',
        notes_development: hasFullAccess ? row.notes_development : 'Restricted - No Access',
        notes_evaluation: hasFullAccess ? row.notes_evaluation : 'Restricted - No Access',
        // Two-on-One notes access is based specifically on organizer access
        two_risks: hasTwoOnOneNotesAccess ? row.two_risks : 'Restricted - No Access',
        two_effective: hasTwoOnOneNotesAccess ? row.two_effective : 'Restricted - No Access',
        two_support: hasTwoOnOneNotesAccess ? row.two_support : 'Restricted - No Access'
      };
    });

    // Combine all network data
    const combinedNetworkData = [...formattedContactHistory, ...hostConnections];

    // console.log(`Returning comprehensive network data: ${combinedNetworkData.length} connections (${formattedContactHistory.length} contact history + ${hostConnections.length} host connections)`);
    
    res.json({
      networkData: combinedNetworkData,
      meetingsData: formattedMeetings,
      stats: {
        contactHistoryConnections: formattedContactHistory.length,
        hostConnections: hostConnections.length,
        totalConnections: combinedNetworkData.length,
                 twoOnOneMeetings: formattedMeetings.filter(m => m.meeting_type === 'Two-on-One').length,
        totalMeetings: formattedMeetings.length
      }
    });
  } catch (error) {
    // console.error('Error fetching network data with hosts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add endpoint to test organizational access control
app.get('/api/org-access-test', checkDataAccess, async (req, res) => {
  try {
    const orgStructure = await getOrgStructure();
    
    if (!orgStructure) {
      return res.status(500).json({ error: 'Could not load organizational structure' });
    }
    
    // Get user info
    const userInfo = req.currentUserId ? orgStructure.userInfo.get(req.currentUserId) : null;
    
    // Get subordinates
    const subordinates = [];
    if (req.currentUserId && orgStructure.supervisorToUsers.has(req.currentUserId)) {
      const subordinateIds = orgStructure.supervisorToUsers.get(req.currentUserId);
      subordinateIds.forEach(id => {
        const info = orgStructure.userInfo.get(id);
        if (info) {
          subordinates.push(info);
        }
      });
    }
    
    // Get supervisor
    const supervisorId = req.currentUserId ? orgStructure.userToSupervisor.get(req.currentUserId) : null;
    const supervisor = supervisorId ? orgStructure.userInfo.get(supervisorId) : null;
    
    res.json({
      currentUser: {
        id: req.currentUserId,
        hasAccess: req.hasDataAccess,
        accessibleIds: Array.from(req.accessibleIds).slice(0, 20), // Show first 20 for brevity
        totalAccessibleIds: req.accessibleIds.size,
        userInfo
      },
      hierarchy: {
        supervisor,
        subordinates,
        subordinateCount: subordinates.length
      },
      orgStats: {
        totalUsers: orgStructure.userInfo.size,
        totalSupervisors: orgStructure.supervisorToUsers.size
      }
    });
  } catch (error) {
    console.error('Error in org access test:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to test pledge access
app.get('/api/pledge-access-test', async (req, res) => {
  try {
    const testQuery = `
      SELECT COUNT(*) as count
      FROM \`${PROJECT_ID}.pledge_campaign.pledge_submissions\`
      LIMIT 1
    `;
    
    console.log('Testing pledge access with query:', testQuery);
    
    const [rows] = await bigquery.query({ query: testQuery });
    
    res.json({
      success: true,
      message: 'Server has access to pledge_campaign.pledge_submissions',
      count: rows[0]?.count || 0,
      tableReference: `${PROJECT_ID}.pledge_campaign.pledge_submissions`
    });
  } catch (error) {
    console.error('Pledge access test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      tableReference: `${PROJECT_ID}.pledge_campaign.pledge_submissions`,
      hint: 'The service account may not have access to the pledge_campaign dataset. Ask admin to grant BigQuery Data Viewer role to the service account on the pledge_campaign dataset.',
      serviceAccountHint: 'Check which service account is configured in GOOGLE_APPLICATION_CREDENTIALS or the mounted credentials file'
    });
  }
});

// Get pledge submissions for campaign actuals (DISABLED - not needed)
app.get('/api/pledge-submissions', async (req, res) => {
  // Pledge submissions feature is disabled - return empty data
  res.json({ success: true, data: [], totalPledges: 0, daysWithPledges: 0 });
});

// ============================================================================
// DASHBOARD API ENDPOINTS - Lists, Leaders, Goals
// ============================================================================

// GET /api/actions - Fetch active actions (optionally filtered by organizer)
app.get('/api/actions', async (req, res) => {
  try {
    const { organizer_vanid, organizer_chapter } = req.query;
    console.log('[/api/actions] organizer_vanid:', organizer_vanid, 'organizer_chapter:', organizer_chapter);

    // Columns that exist in PostgreSQL — progress_steps stores what was `fields` in BigQuery.
    // Missing BigQuery-only columns are aliased as NULL/FALSE so the frontend response shape is unchanged.
    const SELECT_COLS = `
          action_id,
          action_name,
          goal_type,
          parent_campaign_id,
          description,
          progress_steps          AS fields,
          goal_field_key,
          TRUE                    AS is_active,
          organizer_vanid,
          visible_to_organizers,
          chapters,
          status,
          started_date,
          archived_date,
          has_goal,
          target_audience,
          is_template,
          template_action_id,
          default_individual_goal,
          action_type,
          recurrence_period,
          recurrence_count,
          deadline_date,
          deadline_type,
          time_tracking_enabled`;

    let queryOptions;

    if (organizer_vanid) {
      const whereChapter = organizer_chapter
        ? `(chapters IS NULL OR ARRAY_LENGTH(chapters) = 0 OR @organizer_chapter = ANY(chapters))`
        : `(chapters IS NULL OR ARRAY_LENGTH(chapters) = 0)`;

      queryOptions = {
        query: `
          SELECT ${SELECT_COLS}
          FROM lumoviz_actions
          WHERE status = 'live'
            AND (
              is_template = TRUE
              OR organizer_vanid = @organizer_vanid
              OR (
                (visible_to_organizers IS NULL OR ARRAY_LENGTH(visible_to_organizers) = 0 OR @organizer_vanid = ANY(visible_to_organizers))
                AND ${whereChapter}
              )
            )
          ORDER BY action_id
        `,
        params: {
          organizer_vanid,
          ...(organizer_chapter && { organizer_chapter })
        }
      };
    } else {
      queryOptions = {
        query: `
          SELECT ${SELECT_COLS}
          FROM lumoviz_actions
          WHERE status = 'live'
          ORDER BY action_id
        `
      };
    }

    const [rows] = await database.query(queryOptions);

    // progress_steps/fields comes back as a parsed object from PostgreSQL JSONB — no extra JSON.parse needed
    const actions = rows.map(row => ({
      ...row,
      fields: row.fields && typeof row.fields === 'string' ? JSON.parse(row.fields) : (row.fields || [])
    }));

    res.json(actions);
  } catch (error) {
    console.error('Error fetching actions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/actions - Create a new action
app.post('/api/actions', async (req, res) => {
  try {
    const {
      action_name,
      fields,
      parent_campaign_id,
      goal_type_id,
      chapters,
      organizer_vanid,
      visible_to_organizers,
      has_goal,
      target_audience,
      is_template,
      template_action_id,
      default_individual_goal,
      goal_field_key,
    } = req.body;

    if (!action_name) {
      return res.status(400).json({ success: false, error: 'action_name is required' });
    }

    // Generate action_id from name (lowercase, underscored)
    const action_id = action_name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    // Store `fields` in progress_steps (JSONB) — the only JSONB column in PostgreSQL schema
    const fieldsJson = fields ? JSON.stringify(fields) : null;

    const query = `
      INSERT INTO lumoviz_actions
      (
        action_id, action_name, description,
        goal_type, has_goal, default_individual_goal,
        parent_campaign_id, organizer_vanid,
        visible_to_organizers, chapters,
        is_template, template_action_id,
        target_audience, status, started_date,
        progress_steps, goal_field_key
      )
      VALUES (
        @action_id, @action_name, '',
        @goal_type, @has_goal, @default_individual_goal,
        @parent_campaign_id, @organizer_vanid,
        @visible_to_organizers, @chapters,
        @is_template, @template_action_id,
        @target_audience, 'live', CURRENT_DATE,
        @progress_steps::jsonb, @goal_field_key
      )
      ON CONFLICT (action_id) DO NOTHING
    `;

    const params = {
      action_id,
      action_name,
      goal_type: goal_type_id || null,
      has_goal: has_goal !== undefined ? has_goal : true,
      default_individual_goal: default_individual_goal !== undefined ? default_individual_goal : 5,
      parent_campaign_id: parent_campaign_id || null,
      organizer_vanid: organizer_vanid || null,
      visible_to_organizers: (visible_to_organizers && visible_to_organizers.length > 0) ? visible_to_organizers : null,
      chapters: (chapters && chapters.length > 0) ? chapters : null,
      is_template: is_template || false,
      template_action_id: template_action_id || null,
      target_audience: target_audience || 'constituent',
      progress_steps: fieldsJson,
      goal_field_key: goal_field_key || null,
    };

    await database.query({ query, params });

    res.json({ success: true, message: 'Action created successfully', action_id });
  } catch (error) {
    console.error('Error creating action:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/actions/:action_id - Update an action
app.put('/api/actions/:action_id', async (req, res) => {
  try {
    const { action_id } = req.params;
    const {
      action_name,
      fields,
      parent_campaign_id,
      goal_type_id,
      chapters,
      organizer_vanid,
      visible_to_organizers,
      has_goal,
      target_audience,
      is_template,
      template_action_id,
      default_individual_goal,
      goal_field_key,
    } = req.body;

    if (!action_id || !action_name) {
      return res.status(400).json({ success: false, error: 'action_id and action_name are required' });
    }

    const fieldsJson = fields ? JSON.stringify(fields) : null;

    const query = `
      UPDATE lumoviz_actions
      SET
        action_name           = @action_name,
        goal_type             = @goal_type,
        parent_campaign_id    = @parent_campaign_id,
        progress_steps        = @progress_steps::jsonb,
        organizer_vanid       = @organizer_vanid,
        visible_to_organizers = @visible_to_organizers,
        chapters              = @chapters,
        has_goal              = @has_goal,
        target_audience       = @target_audience,
        is_template           = @is_template,
        template_action_id    = @template_action_id,
        default_individual_goal = @default_individual_goal,
        goal_field_key        = @goal_field_key,
        updated_at            = CURRENT_TIMESTAMP
      WHERE action_id = @action_id
    `;

    const params = {
      action_id,
      action_name,
      goal_type: goal_type_id || null,
      parent_campaign_id: parent_campaign_id || null,
      progress_steps: fieldsJson,
      organizer_vanid: organizer_vanid || null,
      visible_to_organizers: (visible_to_organizers && visible_to_organizers.length > 0) ? visible_to_organizers : null,
      chapters: (chapters && chapters.length > 0) ? chapters : null,
      has_goal: has_goal !== undefined ? has_goal : true,
      target_audience: target_audience || 'constituent',
      is_template: is_template || false,
      template_action_id: template_action_id || null,
      default_individual_goal: default_individual_goal !== undefined ? default_individual_goal : 5,
      goal_field_key: goal_field_key || null,
    };

    await database.query({ query, params });

    res.json({ success: true, message: 'Action updated successfully' });
  } catch (error) {
    console.error('Error updating action:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/actions/:action_id/status - Update action status (archive/restore)
app.patch('/api/actions/:action_id/status', async (req, res) => {
  try {
    const { action_id } = req.params;
    const { status } = req.body;
    
    if (!action_id || !status) {
      return res.status(400).json({ 
        success: false, 
        error: 'action_id and status are required' 
      });
    }
    
    // Update action status
    // Use CURRENT_DATE() for archived_date when archiving, NULL when restoring
    const query = `
      UPDATE \`${PROJECT_ID}.${DATASET_ID}.lumoviz_actions\`
      SET 
        status = @status,
        archived_date = ${status === 'archived' ? 'CURRENT_DATE()' : 'NULL'}
      WHERE action_id = @action_id
    `;
    
    const params = {
      action_id,
      status
    };
    
    await bigquery.query({ query, params });
    
    res.json({ 
      success: true, 
      message: 'Action status updated successfully'
    });
  } catch (error) {
    console.error('Error updating action status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/lists - Fetch organizer's turf lists
app.get('/api/lists', async (req, res) => {
  try {
    const { organizer_vanid } = req.query;

    if (!organizer_vanid) {
      return res.status(400).json({ success: false, error: 'organizer_vanid is required' });
    }

    // PostgreSQL schema uses contact_vanid / contact_name (not organizee_vanid / organizee)
    const [rows] = await database.query({
      query: `
        SELECT
          l.list_id,
          l.organizer_vanid,
          l.contact_vanid          AS vanid,
          l.contact_name,
          l.action,
          l.action_id,
          l.campaign_id,
          l.progress,
          l.notes,
          l.desired_change,
          l.date_added,
          l.date_pledged,
          l.last_updated,
          l.is_completed,
          l.is_active,
          COALESCE(c.chapter, '') AS chapter
        FROM lumoviz_lists l
        LEFT JOIN contacts c
          ON l.contact_vanid::TEXT = c.vanid::TEXT
        WHERE l.organizer_vanid = @organizer_vanid
          AND (l.is_active = TRUE OR l.is_active IS NULL)
        ORDER BY l.date_added DESC
      `,
      params: { organizer_vanid }
    });

    // progress is JSONB in PostgreSQL — already an object, no JSON.parse needed
    const lists = rows.map(row => ({
      ...row,
      progress: row.progress && typeof row.progress === 'string'
        ? JSON.parse(row.progress)
        : (row.progress || {})
    }));

    res.json({ success: true, data: lists });
  } catch (error) {
    console.error('Error fetching lists:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/lists - Add person to a list
app.post('/api/lists', async (req, res) => {
  try {
    const { organizer_vanid, contact_vanid, contact_name, action_id, action, desired_change, progress } = req.body;

    if (!organizer_vanid || !contact_vanid || !action_id) {
      return res.status(400).json({
        success: false,
        error: 'organizer_vanid, contact_vanid, and action_id are required'
      });
    }

    const progressJson = JSON.stringify(progress || {});

    await database.query({
      query: `
        INSERT INTO lumoviz_lists
          (list_id, organizer_vanid, contact_vanid, contact_name, action, action_id, progress, desired_change, date_added, last_updated, is_completed, is_active)
        VALUES
          (gen_random_uuid()::TEXT, @organizer_vanid, @contact_vanid, @contact_name, @action, @action_id, @progress::jsonb, @desired_change, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE, TRUE)
      `,
      params: {
        organizer_vanid: String(organizer_vanid),
        contact_vanid: parseInt(contact_vanid, 10) || 0,
        contact_name: contact_name || '',
        action: action || '',
        action_id,
        progress: progressJson,
        desired_change: desired_change || ''
      }
    });

    res.json({ success: true, message: 'Person added to list' });
  } catch (error) {
    console.error('Error adding to list:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/lists/:list_id - Update list item
app.put('/api/lists/:list_id', async (req, res) => {
  try {
    const { list_id } = req.params;
    const { progress, notes, desired_change, is_completed } = req.body;

    // Build positional params manually to avoid issues with ::jsonb in the abstraction layer
    const setParts = [];
    const values = [];
    let idx = 1;

    if (progress !== undefined) {
      setParts.push(`progress = $${idx++}::jsonb`);
      values.push(typeof progress === 'string' ? progress : JSON.stringify(progress));
    }
    if (notes !== undefined) {
      setParts.push(`notes = $${idx++}`);
      values.push(notes);
    }
    if (desired_change !== undefined) {
      setParts.push(`desired_change = $${idx++}`);
      values.push(desired_change);
    }
    if (is_completed !== undefined) {
      setParts.push(`is_completed = $${idx++}`);
      values.push(is_completed);
    }

    setParts.push('last_updated = CURRENT_TIMESTAMP');
    values.push(list_id);

    await database.rawQuery(
      `UPDATE lumoviz_lists SET ${setParts.join(', ')} WHERE list_id = $${idx}`,
      values
    );

    res.json({ success: true, message: 'List item updated' });
  } catch (error) {
    console.error('Error updating list item:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/lists/:list_id - Remove person from list
app.delete('/api/lists/:list_id', async (req, res) => {
  try {
    const { list_id } = req.params;

    await database.query({
      query: `UPDATE lumoviz_lists SET is_active = FALSE, last_updated = CURRENT_TIMESTAMP WHERE list_id = @list_id`,
      params: { list_id }
    });

    res.json({ success: true, message: 'Person removed from list' });
  } catch (error) {
    console.error('Error removing from list:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/contacts/:vanid/loe - Update a contact's level of engagement
app.patch('/api/contacts/:vanid/loe', async (req, res) => {
  try {
    const { vanid } = req.params;
    const { loe } = req.body;

    if (!vanid) return res.status(400).json({ success: false, error: 'vanid is required' });

    await pool.query(
      'UPDATE contacts SET loe = $1, updated_at = CURRENT_TIMESTAMP WHERE vanid = $2',
      [loe || null, vanid]
    );

    res.json({ success: true, vanid, loe });
  } catch (error) {
    console.error('Error updating contact LOE:', error);
    res.status(500).json({ success: false, error: 'Failed to update LOE', details: error.message });
  }
});

// PATCH /api/contacts/:vanid/section - Update a contact's section/chapter
app.patch('/api/contacts/:vanid/section', async (req, res) => {
  try {
    const { vanid } = req.params;
    const { section } = req.body;

    if (!vanid) return res.status(400).json({ success: false, error: 'vanid is required' });

    await pool.query(
      'UPDATE contacts SET chapter = $1, updated_at = CURRENT_TIMESTAMP WHERE vanid = $2',
      [section || null, vanid]
    );

    res.json({ success: true, vanid, section });
  } catch (error) {
    console.error('Error updating contact section:', error);
    res.status(500).json({ success: false, error: 'Failed to update section', details: error.message });
  }
});

// POST /api/contacts - Add a new contact
app.post('/api/contacts', async (req, res) => {
  try {
    const { firstname, lastname, chapter, phone, email, vanid, primary_organizer_vanid } = req.body;
    
    if (!firstname || !lastname) {
      return res.status(400).json({
        success: false,
        error: 'firstname and lastname are required'
      });
    }
    
    // Generate a VAN ID if not provided (use negative numbers for manually added contacts)
    const finalVanId = vanid || `-${Date.now()}`;
    
    // Insert into contacts table (main contact data)
    const contactsQuery = `
      INSERT INTO contacts
      (vanid, first_name, last_name, email, phone, chapter, member_status, created_at, updated_at)
      VALUES (@vanid, @first_name, @last_name, @email, @phone, @chapter, 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    
    await database.query({
      query: contactsQuery,
      params: {
        vanid: finalVanId,
        first_name: firstname,
        last_name: lastname,
        email: email || null,
        phone: phone || null,
        chapter: chapter || null
      }
    });
    
    // Also add to org_ids if they should be in the organizer dropdown
    const orgIdsQuery = `
      INSERT INTO org_ids
      (vanid, userid, firstname, lastname, email, chapter, type, created_at, updated_at)
      VALUES (@vanid, @userid, @firstname, @lastname, @email, @chapter, 'constituent', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (vanid) DO NOTHING
    `;
    
    await database.query({
      query: orgIdsQuery,
      params: {
        vanid: finalVanId,
        userid: `${firstname.toLowerCase()}_${lastname.toLowerCase()}_${Date.now()}`,
        firstname,
        lastname,
        email: email || null,
        chapter: chapter || null
      }
    });
    
    // Store extended contact info in lumoviz_contacts table (if primary_organizer provided)
    if (primary_organizer_vanid) {
      const lumovizContactsQuery = `
        INSERT INTO lumoviz_contacts
        (vanid, primary_organizer_vanid, created_at, updated_at)
        VALUES (@vanid, @primary_organizer_vanid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
      
      await database.query({
        query: lumovizContactsQuery,
        params: {
          vanid: finalVanId,
          primary_organizer_vanid: primary_organizer_vanid
        }
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Contact added successfully',
      vanid: finalVanId
    });
  } catch (error) {
    console.error('Error adding contact:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/contacts/:vanid - Update an existing contact
app.put('/api/contacts/:vanid', async (req, res) => {
  try {
    const { vanid } = req.params;
    const { phone, email, primary_organizer_vanid } = req.body;
    
    // Update or insert contact info in lumoviz_contacts table
    // Use MERGE to handle both insert and update
    const query = `
      MERGE \`${PROJECT_ID}.${DATASET_ID}.lumoviz_contacts\` T
      USING (SELECT @vanid as vanid) S
      ON T.vanid = S.vanid
      WHEN MATCHED THEN
        UPDATE SET 
          phone = @phone,
          email = @email,
          primary_organizer_vanid = @primary_organizer_vanid,
          updated_at = CURRENT_TIMESTAMP
      WHEN NOT MATCHED THEN
        INSERT (vanid, phone, email, primary_organizer_vanid, created_at, updated_at)
        VALUES (@vanid, @phone, @email, @primary_organizer_vanid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    
    await bigquery.query({
      query,
      params: {
        vanid,
        phone: phone || null,
        email: email || null,
        primary_organizer_vanid: primary_organizer_vanid || null
      }
    });
    
    res.json({ 
      success: true, 
      message: 'Contact extended info updated successfully'
    });
  } catch (error) {
    console.error('Error updating contact extended info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/meetings - Log a conversation/meeting
app.post('/api/meetings', async (req, res) => {
  try {
    const {
      contact_vanid,
      organizer_vanid,
      date,
      notes,
      person_type,
      purpose,
      values,
      difference,
      resources,
      commitment_asked_yn,
      commitment_made_yn,
      commitment_what,
      catapults,
      shared_purpose_constituency_stance,
      shared_purpose_constituency_how,
      shared_purpose_change_stance,
      shared_purpose_change_how,
      leadership_tag,
      did_share_story,
      what_shared,
      action_id
    } = req.body;

    if (!contact_vanid || !organizer_vanid || !date) {
      return res.status(400).json({
        success: false,
        error: 'contact_vanid, organizer_vanid, and date are required'
      });
    }

    // PostgreSQL schema uses organizee_vanid (not vanid) and meeting_date (not datestamp).
    // meeting_type and chapter do not exist in the PostgreSQL schema.
    await database.query({
      query: `
        INSERT INTO lumoviz_meetings
        (
          meeting_id,
          organizee_vanid,
          organizer_vanid,
          meeting_date,
          notes,
          person_type,
          purpose,
          values,
          difference,
          resources,
          commitment_asked_yn,
          commitment_made_yn,
          commitment_what,
          catapults,
          shared_purpose_constituency_stance,
          shared_purpose_constituency_how,
          shared_purpose_change_stance,
          shared_purpose_change_how,
          leadership_tag,
          did_share_story,
          what_shared,
          action_id,
          created_at
        )
        VALUES (
          gen_random_uuid()::TEXT,
          @organizee_vanid,
          @organizer_vanid,
          @meeting_date,
          @notes,
          @person_type,
          @purpose,
          @values,
          @difference,
          @resources,
          @commitment_asked_yn,
          @commitment_made_yn,
          @commitment_what,
          @catapults,
          @shared_purpose_constituency_stance,
          @shared_purpose_constituency_how,
          @shared_purpose_change_stance,
          @shared_purpose_change_how,
          @leadership_tag,
          @did_share_story,
          @what_shared,
          @action_id,
          CURRENT_TIMESTAMP
        )
      `,
      params: {
        organizee_vanid: parseInt(contact_vanid, 10),
        organizer_vanid: String(organizer_vanid),
        meeting_date: date,
        notes: notes || null,
        person_type: person_type || null,
        purpose: purpose || null,
        values: values || null,
        difference: difference || null,
        resources: resources || null,
        commitment_asked_yn: commitment_asked_yn || null,
        commitment_made_yn: commitment_made_yn || null,
        commitment_what: commitment_what || null,
        catapults: (catapults && catapults.length > 0) ? catapults : null,
        shared_purpose_constituency_stance: shared_purpose_constituency_stance || null,
        shared_purpose_constituency_how: shared_purpose_constituency_how || null,
        shared_purpose_change_stance: shared_purpose_change_stance || null,
        shared_purpose_change_how: shared_purpose_change_how || null,
        leadership_tag: leadership_tag || null,
        did_share_story: did_share_story || false,
        what_shared: what_shared || null,
        action_id: action_id || null
      }
    });

    // If a leadership assessment was given, update the contact's LOE to match.
    // Use pool.query directly (same as PATCH /api/contacts/:vanid/loe) to ensure
    // integer vanid comparison works correctly.
    const validLOE = ['Leader', 'Potential Leader', 'Supporter', 'Unknown'];
    if (leadership_tag && validLOE.includes(leadership_tag)) {
      await pool.query(
        'UPDATE contacts SET loe = $1, updated_at = CURRENT_TIMESTAMP WHERE vanid = $2',
        [leadership_tag, contact_vanid]
      );
      console.log(`[POST /api/meetings] Updated LOE for vanid ${contact_vanid} → ${leadership_tag}`);
    }

    res.json({ success: true, message: 'Conversation logged successfully' });
  } catch (error) {
    console.error('Error logging conversation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/organizer-goals - Fetch organizer's personal goals
app.get('/api/organizer-goals', async (req, res) => {
  try {
    const { organizer_vanid } = req.query;
    
    if (!organizer_vanid) {
      return res.status(400).json({ success: false, error: 'organizer_vanid is required' });
    }
    
    const query = `
      SELECT 
        organizer_vanid,
        action_id,
        goal_value,
        campaign_id,
        created_at,
        updated_at
      FROM \`${PROJECT_ID}.${DATASET_ID}.organizer_goals\`
      WHERE organizer_vanid = @organizer_vanid
    `;
    
    const [rows] = await bigquery.query({
      query,
      params: { organizer_vanid }
    });
    
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching organizer goals:', error);
    // If table doesn't exist, return empty array
    if (error.message?.includes('Not found: Table')) {
      console.warn('[organizer-goals] Table does not exist yet, returning empty array');
      res.json({ success: true, data: [] });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// POST /api/organizer-goals - Save/update organizer's personal goals
app.post('/api/organizer-goals', async (req, res) => {
  try {
    const { organizer_vanid, action_id, goal_value, campaign_id } = req.body;
    
    if (!organizer_vanid || !action_id || goal_value === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'organizer_vanid, action_id, and goal_value are required' 
      });
    }
    
    console.log(`[organizer-goals] Saving goal for organizer ${organizer_vanid}, action ${action_id}, goal ${goal_value}`);
    
    // Use MERGE to insert or update the goal
    const query = `
      MERGE \`${PROJECT_ID}.${DATASET_ID}.organizer_goals\` AS target
      USING (
        SELECT 
          @organizer_vanid AS organizer_vanid,
          @action_id AS action_id,
          @goal_value AS goal_value,
          ${campaign_id ? '@campaign_id' : 'CAST(NULL AS STRING)'} AS campaign_id,
          CURRENT_TIMESTAMP AS updated_at
      ) AS source
      ON target.organizer_vanid = source.organizer_vanid 
        AND target.action_id = source.action_id
      WHEN MATCHED THEN
        UPDATE SET 
          goal_value = source.goal_value,
          campaign_id = source.campaign_id,
          updated_at = source.updated_at
      WHEN NOT MATCHED THEN
        INSERT (organizer_vanid, action_id, goal_value, campaign_id, created_at, updated_at)
        VALUES (source.organizer_vanid, source.action_id, source.goal_value, source.campaign_id, CURRENT_TIMESTAMP, source.updated_at)
    `;
    
    const params = {
      organizer_vanid,
      action_id,
      goal_value
    };
    
    if (campaign_id) {
      params.campaign_id = campaign_id;
    }
    
    await bigquery.query({ query, params });
    
    res.json({ success: true, message: 'Goal saved successfully' });
  } catch (error) {
    console.error('Error saving organizer goal:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// LEADER HIERARCHY ENDPOINTS
// ============================================

// Get leader hierarchy for an organizer
app.get('/api/leader-hierarchy', async (req, res) => {
  try {
    const { organizer_vanid } = req.query;

    // JOIN contacts so the frontend gets names directly without a second lookup
    const baseQuery = `
      SELECT
        h.leader_vanid,
        h.parent_leader_vanid,
        h.organizer_vanid,
        h.created_date,
        h.updated_date,
        TRIM(CONCAT(COALESCE(lc.first_name, ''), ' ', COALESCE(lc.last_name, ''))) AS leader_name,
        TRIM(CONCAT(COALESCE(pc.first_name, ''), ' ', COALESCE(pc.last_name, ''))) AS parent_leader_name,
        TRIM(CONCAT(COALESCE(oc.first_name, ''), ' ', COALESCE(oc.last_name, ''))) AS organizer_name
      FROM lumoviz_leader_hierarchy h
      LEFT JOIN contacts lc ON h.leader_vanid        = lc.vanid::TEXT
      LEFT JOIN contacts pc ON h.parent_leader_vanid = pc.vanid::TEXT
      LEFT JOIN contacts oc ON h.organizer_vanid     = oc.vanid::TEXT
    `;

    let result;
    if (organizer_vanid) {
      result = await pool.query(
        baseQuery + ` WHERE h.organizer_vanid = $1 ORDER BY h.created_date DESC`,
        [organizer_vanid]
      );
    } else {
      result = await pool.query(baseQuery + ` ORDER BY h.created_date DESC`);
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leader hierarchy:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add or update a leader in hierarchy
app.post('/api/leader-hierarchy', async (req, res) => {
  try {
    const { organizer_vanid, leader_vanid, parent_leader_vanid } = req.body;

    if (!organizer_vanid || !leader_vanid) {
      return res.status(400).json({ error: 'organizer_vanid and leader_vanid are required' });
    }

    // PostgreSQL upsert — insert or update on conflict
    await pool.query(
      `INSERT INTO lumoviz_leader_hierarchy
         (organizer_vanid, leader_vanid, parent_leader_vanid, created_date, updated_date)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (organizer_vanid, leader_vanid)
       DO UPDATE SET
         parent_leader_vanid = EXCLUDED.parent_leader_vanid,
         updated_date = CURRENT_TIMESTAMP`,
      [organizer_vanid, leader_vanid, parent_leader_vanid || null]
    );

    res.json({ success: true, message: 'Leader hierarchy saved' });
  } catch (error) {
    console.error('Error saving leader hierarchy:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove a leader from hierarchy
app.delete('/api/leader-hierarchy', async (req, res) => {
  try {
    const { organizer_vanid, leader_vanid } = req.body;

    if (!organizer_vanid || !leader_vanid) {
      return res.status(400).json({ error: 'organizer_vanid and leader_vanid are required' });
    }

    const result = await pool.query(
      `DELETE FROM lumoviz_leader_hierarchy
       WHERE leader_vanid = $1
         AND (organizer_vanid = $2 OR parent_leader_vanid = $2)`,
      [leader_vanid, organizer_vanid]
    );

    res.json({
      success: true,
      message: 'Leader removed from hierarchy',
      rowsDeleted: result.rowCount || 0
    });
  } catch (error) {
    console.error('Error deleting leader from hierarchy:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ORGANIZER MAPPING ENDPOINTS
// ============================================

// Get all organizer mappings
app.get('/api/organizer-mapping', async (req, res) => {
  try {
    const query = `
      SELECT 
        primary_vanid,
        preferred_name,
        alternate_vanids,
        name_variations,
        email,
        notes,
        created_at,
        updated_at
      FROM \`${PROJECT_ID}.${DATASET_ID}.lumoviz_organizer_mapping\`
      ORDER BY preferred_name ASC
    `;
    
    const options = {
      query,
    };
    
    const [rows] = await bigquery.query(options);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching organizer mappings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add or update an organizer mapping
app.post('/api/organizer-mapping', async (req, res) => {
  try {
    const { 
      primary_vanid, 
      preferred_name, 
      alternate_vanids, 
      name_variations, 
      email, 
      notes 
    } = req.body;
    
    if (!primary_vanid || !preferred_name) {
      return res.status(400).json({ 
        error: 'primary_vanid and preferred_name are required' 
      });
    }
    
    // Convert arrays to proper format for BigQuery
    // Ensure all VAN IDs are strings
    const alternateVanidsStr = alternate_vanids && alternate_vanids.length > 0
      ? `[${alternate_vanids.map(id => `"${String(id)}"`).join(', ')}]`
      : 'NULL';
    
    const nameVariationsStr = name_variations && name_variations.length > 0
      ? `[${name_variations.map(name => `"${String(name)}"`).join(', ')}]`
      : 'NULL';
    
    // Build the query - handle NULL values properly for arrays
    const query = `
      MERGE \`${PROJECT_ID}.${DATASET_ID}.lumoviz_organizer_mapping\` T
      USING (SELECT 
        "${String(primary_vanid)}" AS primary_vanid,
        "${preferred_name.replace(/"/g, '\\"')}" AS preferred_name,
        ${alternateVanidsStr !== 'NULL' ? alternateVanidsStr : 'CAST(NULL AS ARRAY<STRING>)'} AS alternate_vanids,
        ${nameVariationsStr !== 'NULL' ? nameVariationsStr : 'CAST(NULL AS ARRAY<STRING>)'} AS name_variations,
        ${email ? `"${String(email).replace(/"/g, '\\"')}"` : 'CAST(NULL AS STRING)'} AS email,
        ${notes ? `"${String(notes).replace(/"/g, '\\"')}"` : 'CAST(NULL AS STRING)'} AS notes,
        CURRENT_TIMESTAMP AS updated_at
      ) S
      ON T.primary_vanid = S.primary_vanid
      WHEN MATCHED THEN
        UPDATE SET 
          preferred_name = S.preferred_name,
          alternate_vanids = S.alternate_vanids,
          name_variations = S.name_variations,
          email = S.email,
          notes = S.notes,
          updated_at = S.updated_at
      WHEN NOT MATCHED THEN
        INSERT (primary_vanid, preferred_name, alternate_vanids, name_variations, email, notes, created_at, updated_at)
        VALUES (S.primary_vanid, S.preferred_name, S.alternate_vanids, S.name_variations, S.email, S.notes, CURRENT_TIMESTAMP, S.updated_at)
    `;
    
    console.log('Executing organizer mapping query:', query);
    
    await bigquery.query({
      query,
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving organizer mapping:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete an organizer mapping
app.delete('/api/organizer-mapping/:vanid', async (req, res) => {
  try {
    const { vanid } = req.params;
    
    if (!vanid) {
      return res.status(400).json({ error: 'vanid is required' });
    }
    
    const query = `
      DELETE FROM \`${PROJECT_ID}.${DATASET_ID}.lumoviz_organizer_mapping\`
      WHERE primary_vanid = "${vanid}"
    `;
    
    await bigquery.query({
      query,
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting organizer mapping:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/organizer-details/:vanid - Get organizer details (turf, team_role)
app.get('/api/organizer-details/:vanid', async (req, res) => {
  try {
    const { vanid } = req.params;
    
    if (!vanid) {
      return res.status(400).json({ success: false, error: 'vanid is required' });
    }
    
    const query = `
      SELECT 
        vanid,
        turf,
        team_role
      FROM \`${PROJECT_ID}.${DATASET_ID}.org_ids\`
      WHERE vanid = @vanid
    `;
    
    const [rows] = await bigquery.query({
      query,
      params: { vanid: vanid }
    });
    
    if (rows.length === 0) {
      return res.json({ 
        success: true, 
        data: { vanid, turf: null, team_role: null }
      });
    }
    
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error fetching organizer details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/organizer-details/:vanid - Update organizer details (turf, team_role)
app.put('/api/organizer-details/:vanid', async (req, res) => {
  try {
    const { vanid } = req.params;
    const { turf, team_role } = req.body;
    
    if (!vanid) {
      return res.status(400).json({ success: false, error: 'vanid is required' });
    }
    
    const query = `
      UPDATE \`${PROJECT_ID}.${DATASET_ID}.org_ids\`
      SET 
        turf = @turf,
        team_role = @team_role
      WHERE vanid = @vanid
    `;
    
    await bigquery.query({
      query,
      params: {
        vanid: vanid,
        turf: turf || null,
        team_role: team_role || null
      }
    });
    
    res.json({ 
      success: true, 
      message: 'Organizer details updated successfully',
      data: { vanid, turf, team_role }
    });
  } catch (error) {
    console.error('Error updating organizer details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// CAMPAIGN MANAGEMENT ENDPOINTS
// ============================================================================

// GET /api/campaigns - Get all campaigns with their goal types and milestones
app.get('/api/campaigns', async (req, res) => {
  try {
    // Fetch campaigns
    const campaignsQuery = `
      SELECT *
      FROM \`${PROJECT_ID}.${DATASET_ID}.lumoviz_campaigns\`
      WHERE status = 'active'
      ORDER BY start_date DESC
    `;
    const [campaigns] = await bigquery.query(campaignsQuery);

    // Fetch all goals (includes both org-wide and chapter-level)
    const goalsQuery = `
      SELECT *
      FROM \`${PROJECT_ID}.${DATASET_ID}.lumoviz_campaign_goals\`
    `;
    const [goals] = await bigquery.query(goalsQuery);

    // Fetch all milestones
    const milestonesQuery = `
      SELECT *
      FROM \`${PROJECT_ID}.${DATASET_ID}.lumoviz_campaign_milestones\`
      ORDER BY milestone_date ASC
    `;
    const [milestones] = await bigquery.query(milestonesQuery);

    // Build nested structure matching frontend expectations
    const campaignsWithDetails = campaigns.map(campaign => {
      // Get all goals for this campaign (both org-wide and chapter-specific)
      const allGoalsForCampaign = goals.filter(g => g.campaign_id === campaign.campaign_id);
      
      // Separate org-wide goals from chapter-specific goals
      const orgWideGoals = allGoalsForCampaign.filter(g => g.chapter === null);
      const chapterGoals = allGoalsForCampaign.filter(g => g.chapter !== null);

      // Group milestones by label and build goalTypeTargets object
      const milestonesByDate = new Map();
      milestones
        .filter(m => m.campaign_id === campaign.campaign_id)
        .forEach(m => {
          const dateKey = m.milestone_date?.value || m.milestone_date;
          if (!milestonesByDate.has(dateKey)) {
            milestonesByDate.set(dateKey, {
              id: m.milestone_id,
              date: dateKey,
              description: m.milestone_label,
              goalTypeTargets: {}
            });
          }
          const milestone = milestonesByDate.get(dateKey);
          if (m.goal_type && m.target_value) {
            milestone.goalTypeTargets[m.goal_type] = m.target_value;
          }
        });

      return {
        id: campaign.campaign_id,
        name: campaign.campaign_name,
        description: campaign.description,
        startDate: campaign.start_date?.value || campaign.start_date,
        endDate: campaign.end_date?.value || campaign.end_date,
        chapters: campaign.chapters || [],
        parentCampaignId: campaign.parent_campaign_id,
        campaignType: 'parent', // Default
        createdDate: campaign.created_at,
        goalTypes: orgWideGoals.map(g => {
          // Find all chapter-specific goals for this goal type
          const chapterGoalsForType = chapterGoals.filter(cg => cg.goal_type === g.goal_type);
          const chapterGoalsMap = {};
          chapterGoalsForType.forEach(cg => {
            if (cg.chapter) {
              chapterGoalsMap[cg.chapter] = cg.target_value;
            }
          });
          
          return {
            id: g.goal_type,  // Use goal_type as the ID (e.g., 'team_members')
            name: g.goal_name,
            description: '',
            totalTarget: g.target_value,
            unit: g.goal_type === 'pledges' ? 'pledges' : 
                  g.goal_type.includes('1on1') ? '1:1s' : 'members',
            dataSource: g.goal_type === 'pledges' ? 'pledges' :
                        g.goal_type === 'membership_1on1s' ? 'meetings_membership' :
                        g.goal_type === 'leadership_1on1s' ? 'meetings_leadership' : 'manual',
            level: 'organization',
            chapterGoals: Object.keys(chapterGoalsMap).length > 0 ? chapterGoalsMap : undefined
          };
        }),
        milestones: Array.from(milestonesByDate.values())
      };
    });

    res.json({ success: true, data: campaignsWithDetails });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/campaigns - Create a new campaign
app.post('/api/campaigns', async (req, res) => {
  try {
    const {
      campaign_name,
      description,
      start_date,
      end_date,
      chapters,
      parent_campaign_id,
      goal_types,
      milestones
    } = req.body;

    if (!campaign_name || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'campaign_name, start_date, and end_date are required'
      });
    }

    const campaign_id = campaign_name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now();

    // Insert campaign
    const campaignQuery = `
      INSERT INTO \`${PROJECT_ID}.${DATASET_ID}.lumoviz_campaigns\`
      (campaign_id, campaign_name, description, start_date, end_date, chapters, parent_campaign_id, status)
      VALUES (@campaign_id, @campaign_name, @description, @start_date, @end_date, @chapters, @parent_campaign_id, 'active')
    `;

    await bigquery.query({
      query: campaignQuery,
      params: {
        campaign_id,
        campaign_name,
        description: description || '',
        start_date,
        end_date,
        chapters: chapters || ['All Chapters'],
        parent_campaign_id: parent_campaign_id || null
      }
    });

    // Insert goal types if provided
    if (goal_types && goal_types.length > 0) {
      for (const gt of goal_types) {
        // Insert org-wide goal
        const goal_id = `${gt.id}_${campaign_id}_${Date.now()}`;
        const gtQuery = `
          INSERT INTO \`${PROJECT_ID}.${DATASET_ID}.lumoviz_campaign_goals\`
          (goal_id, campaign_id, goal_type, goal_name, target_value, chapter)
          VALUES (@goal_id, @campaign_id, @goal_type, @goal_name, @target_value, NULL)
        `;
        await bigquery.query({
          query: gtQuery,
          params: {
            goal_id,
            campaign_id,
            goal_type: gt.id,  // Simple name like 'team_members'
            goal_name: gt.name,
            target_value: gt.totalTarget,
            // chapter is NULL for org-wide goals
          }
        });
        
        // Insert chapter-specific goals if provided
        if (gt.chapterGoals && Object.keys(gt.chapterGoals).length > 0) {
          for (const [chapter, chapterTarget] of Object.entries(gt.chapterGoals)) {
            const chapter_goal_id = `${gt.id}_${campaign_id}_${chapter}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const chapterGtQuery = `
              INSERT INTO \`${PROJECT_ID}.${DATASET_ID}.lumoviz_campaign_goals\`
              (goal_id, campaign_id, goal_type, goal_name, target_value, chapter)
              VALUES (@goal_id, @campaign_id, @goal_type, @goal_name, @target_value, @chapter)
            `;
            await bigquery.query({
              query: chapterGtQuery,
              params: {
                goal_id: chapter_goal_id,
                campaign_id,
                goal_type: gt.id,
                goal_name: gt.name,
                target_value: chapterTarget,
                chapter: chapter
              }
            });
          }
        }
      }
    }

    // Insert milestones if provided
    if (milestones && milestones.length > 0) {
      for (const m of milestones) {
        // Milestones in your schema are one row per goal type
        const goalTypeTargets = m.goalTypeTargets || {};
        for (const [goalType, targetValue] of Object.entries(goalTypeTargets)) {
          const milestone_id = `${m.id}_${goalType}_${Date.now()}`;
          const mQuery = `
            INSERT INTO \`${PROJECT_ID}.${DATASET_ID}.lumoviz_campaign_milestones\`
            (milestone_id, campaign_id, milestone_date, milestone_label, goal_type, target_value)
            VALUES (@milestone_id, @campaign_id, @milestone_date, @milestone_label, @goal_type, @target_value)
          `;
          await bigquery.query({
            query: mQuery,
            params: {
              milestone_id,
              campaign_id,
              milestone_date: m.date,
              milestone_label: m.description || '',
              goal_type: goalType,
              target_value: targetValue
            }
          });
        }
      }
    }

    res.json({
      success: true,
      data: { campaign_id }
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/campaigns/:campaign_id - Update a campaign
app.put('/api/campaigns/:campaign_id', async (req, res) => {
  try {
    const { campaign_id } = req.params;
    const {
      campaign_name,
      description,
      start_date,
      end_date,
      chapters,
      parent_campaign_id,
      status
    } = req.body;

    const updateQuery = `
      UPDATE \`${PROJECT_ID}.${DATASET_ID}.lumoviz_campaigns\`
      SET 
        campaign_name = @campaign_name,
        description = @description,
        start_date = @start_date,
        end_date = @end_date,
        chapters = @chapters,
        parent_campaign_id = @parent_campaign_id,
        status = @status,
        updated_at = CURRENT_TIMESTAMP
      WHERE campaign_id = @campaign_id
    `;

    await bigquery.query({
      query: updateQuery,
      params: {
        campaign_id,
        campaign_name,
        description,
        start_date,
        end_date,
        chapters: chapters || [],
        parent_campaign_id: parent_campaign_id || null,
        status: status || 'active'
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/campaigns/:campaign_id - Delete a campaign
app.delete('/api/campaigns/:campaign_id', async (req, res) => {
  try {
    const { campaign_id } = req.params;

    // Delete related goals
    await bigquery.query({
      query: `DELETE FROM \`${PROJECT_ID}.${DATASET_ID}.lumoviz_campaign_goals\` WHERE campaign_id = @campaign_id`,
      params: { campaign_id }
    });

    // Delete related milestones
    await bigquery.query({
      query: `DELETE FROM \`${PROJECT_ID}.${DATASET_ID}.lumoviz_campaign_milestones\` WHERE campaign_id = @campaign_id`,
      params: { campaign_id }
    });

    // Delete the campaign
    await bigquery.query({
      query: `DELETE FROM \`${PROJECT_ID}.${DATASET_ID}.lumoviz_campaigns\` WHERE campaign_id = @campaign_id`,
      params: { campaign_id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Catch-all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, '0.0.0.0', async () => {
  // Fix: lumoviz_lists uses last_updated, not updated_at, so the generic trigger fails.
  // Drop it and replace with a correct one.
  try {
    await pool.query(`DROP TRIGGER IF EXISTS update_lumoviz_lists_updated_at ON lumoviz_lists`);
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_last_updated_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.last_updated = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);
    await pool.query(`
      CREATE TRIGGER update_lumoviz_lists_last_updated
      BEFORE UPDATE ON lumoviz_lists
      FOR EACH ROW EXECUTE FUNCTION update_last_updated_column()
    `);
  } catch (e) {
    // Trigger may already exist from a previous run — safe to ignore
  }

  // Ensure lumoviz_leader_hierarchy has a unique constraint so upserts work
  try {
    await pool.query(`
      ALTER TABLE lumoviz_leader_hierarchy
      ADD CONSTRAINT uq_leader_hierarchy_org_leader
      UNIQUE (organizer_vanid, leader_vanid)
    `);
  } catch (e) {
    // Constraint already exists — safe to ignore
  }
});
