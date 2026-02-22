/**
 * Seed Initial Data from CSV
 * 
 * Populates contacts and teams from the class roster CSV.
 * 
 * Usage: node server/seed-initial-data.js
 */

const pool = require('./db');
const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, 'initial-roster.csv');

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
      else { current += char; }
    }
    values.push(current.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

async function ensureTables(client) {
  console.log('── Ensuring tables exist ──');

  await client.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS lumoviz_teams (
      id VARCHAR(255) PRIMARY KEY,
      team_name VARCHAR(500) NOT NULL,
      team_leader VARCHAR(255),
      chapter VARCHAR(255),
      team_members TEXT,
      turf TEXT,
      date_created DATE,
      date_disbanded VARCHAR(50),
      color VARCHAR(50),
      shared_purpose TEXT,
      norms TEXT,
      norm_correction TEXT,
      constituency TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lumoviz_team_changelog (
      change_id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
      team_id VARCHAR(255) NOT NULL,
      changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      changed_by_vanid VARCHAR(255),
      changed_by_name VARCHAR(500),
      field_name VARCHAR(255) NOT NULL,
      old_value TEXT,
      new_value TEXT,
      change_reason TEXT,
      change_type VARCHAR(50)
    );

    CREATE TABLE IF NOT EXISTS lumoviz_team_members (
      id SERIAL PRIMARY KEY,
      team_id VARCHAR(255) NOT NULL,
      member_vanid VARCHAR(255) NOT NULL,
      member_name VARCHAR(500) NOT NULL,
      constituent_role VARCHAR(100),
      functional_role VARCHAR(100),
      date_added TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      date_removed TIMESTAMP WITH TIME ZONE,
      is_active BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS lumoviz_campaigns (
      campaign_id VARCHAR(255) PRIMARY KEY,
      campaign_name VARCHAR(500) NOT NULL,
      description TEXT,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      parent_campaign_id VARCHAR(255),
      chapters TEXT[],
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      created_by VARCHAR(255)
    );

    CREATE TABLE IF NOT EXISTS lumoviz_campaign_goals (
      goal_id VARCHAR(255) PRIMARY KEY,
      campaign_id VARCHAR(255) NOT NULL,
      goal_type VARCHAR(100) NOT NULL,
      goal_name VARCHAR(500),
      target_value INTEGER NOT NULL,
      chapter VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lumoviz_campaign_milestones (
      milestone_id VARCHAR(255) PRIMARY KEY,
      campaign_id VARCHAR(255) NOT NULL,
      milestone_date DATE NOT NULL,
      milestone_label VARCHAR(500) NOT NULL,
      goal_type VARCHAR(100),
      target_value INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lumoviz_actions (
      action_id VARCHAR(255) PRIMARY KEY,
      action_name VARCHAR(500) NOT NULL,
      description TEXT,
      goal_type VARCHAR(100),
      has_goal BOOLEAN DEFAULT TRUE,
      default_individual_goal INTEGER,
      parent_campaign_id VARCHAR(255),
      organizer_vanid VARCHAR(255),
      visible_to_organizers TEXT[],
      chapters TEXT[],
      is_template BOOLEAN DEFAULT FALSE,
      template_action_id VARCHAR(255),
      target_audience VARCHAR(50),
      status VARCHAR(50) DEFAULT 'live',
      started_date DATE,
      archived_date DATE,
      progress_steps JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lumoviz_lists (
      list_id VARCHAR(255) PRIMARY KEY,
      organizer_vanid VARCHAR(255) NOT NULL,
      contact_vanid BIGINT NOT NULL,
      contact_name VARCHAR(500),
      action VARCHAR(500),
      action_id VARCHAR(255),
      campaign_id VARCHAR(255),
      progress JSONB,
      notes TEXT,
      desired_change TEXT,
      date_added TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      date_pledged TIMESTAMP WITH TIME ZONE,
      last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      is_completed BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS lumoviz_contacts (
      vanid VARCHAR(255) PRIMARY KEY,
      phone VARCHAR(50),
      email VARCHAR(500),
      primary_organizer_vanid VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lumoviz_meetings (
      meeting_id VARCHAR(255) PRIMARY KEY,
      organizee_vanid BIGINT NOT NULL,
      organizer_vanid VARCHAR(255),
      meeting_date DATE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      person_type VARCHAR(50),
      purpose TEXT,
      "values" TEXT,
      difference TEXT,
      resources TEXT,
      commitment_asked_yn VARCHAR(10),
      commitment_made_yn VARCHAR(10),
      commitment_what TEXT,
      catapults TEXT[],
      shared_purpose_constituency_stance VARCHAR(50),
      shared_purpose_constituency_how TEXT,
      shared_purpose_change_stance VARCHAR(50),
      shared_purpose_change_how TEXT,
      leadership_tag VARCHAR(50),
      did_share_story BOOLEAN DEFAULT FALSE,
      what_shared TEXT,
      action_id VARCHAR(255)
    );

    CREATE TABLE IF NOT EXISTS lumoviz_leader_hierarchy (
      id SERIAL PRIMARY KEY,
      leader_vanid VARCHAR(255) NOT NULL,
      parent_leader_vanid VARCHAR(255),
      organizer_vanid VARCHAR(255) NOT NULL,
      created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contacts (
      vanid VARCHAR(255) PRIMARY KEY,
      first_name VARCHAR(255),
      last_name VARCHAR(255),
      chapter VARCHAR(255),
      loe VARCHAR(100),
      member_status VARCHAR(100),
      email VARCHAR(500),
      phone VARCHAR(50),
      address TEXT,
      city VARCHAR(255),
      state VARCHAR(50),
      zip VARCHAR(20),
      type VARCHAR(100),
      role VARCHAR(100),
      primary_organizer_vanid VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      organizer_vanid VARCHAR(255),
      participant_vanid BIGINT,
      participant_first_name VARCHAR(255),
      participant_last_name VARCHAR(255),
      participant_chapter VARCHAR(255),
      date_contacted TIMESTAMP WITH TIME ZONE,
      conversation_type VARCHAR(100),
      purpose TEXT,
      commitments TEXT,
      stakes TEXT,
      evaluation TEXT,
      host_vanid VARCHAR(255),
      host_email VARCHAR(500),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS org_ids (
      vanid VARCHAR(255) PRIMARY KEY,
      userid VARCHAR(255),
      firstname VARCHAR(255),
      lastname VARCHAR(255),
      email VARCHAR(500),
      supervisorid VARCHAR(255),
      type VARCHAR(100),
      turf VARCHAR(255),
      team_role VARCHAR(255),
      chapter VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lumoviz_sections (
      chapter_name VARCHAR(255) PRIMARY KEY,
      lead_vanid VARCHAR(255),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lumoviz_users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(500) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      vanid VARCHAR(255),
      display_name VARCHAR(500),
      role VARCHAR(50) DEFAULT 'user',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP WITH TIME ZONE
    );

    CREATE TABLE IF NOT EXISTS lumoviz_contact_organizers (
      contact_vanid TEXT NOT NULL,
      organizer_vanid TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (contact_vanid, organizer_vanid)
    );

    CREATE TABLE IF NOT EXISTS organizer_goals (
      organizer_vanid TEXT NOT NULL,
      action_id TEXT NOT NULL,
      goal_value INTEGER NOT NULL DEFAULT 5,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (organizer_vanid, action_id)
    );
  `);

  console.log('  ✓ All tables ensured\n');
}

async function seed() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at ${CSV_PATH}`);
    console.error('Place the roster CSV at server/initial-roster.csv');
    process.exit(1);
  }

  const csvText = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCSV(csvText);

  console.log(`\nParsed ${rows.length} rows from CSV\n`);

  const client = await pool.connect();
  try {
    await ensureTables(client);

    // Generate VAN IDs starting from 100001
    let nextVanId = 100001;
    const personMap = new Map(); // name -> { vanid, firstName, lastName, email, section, type, teamNum }

    for (const row of rows) {
      const name = row.Name.trim();
      const nameParts = name.split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      const email = row.Email.trim();
      const section = row.Section.trim();
      const type = row.Type.trim().toLowerCase() === 'teacher' ? 'organizer' : 'constituent';
      const teamNum = row.Team.trim();

      if (!personMap.has(name)) {
        personMap.set(name, {
          vanid: nextVanId++,
          firstName,
          lastName,
          email,
          section,
          type,
          teams: [teamNum],
        });
      } else {
        personMap.get(name).teams.push(teamNum);
      }
    }

    // 1. Clear existing data
    console.log('── Clearing existing data ──');
    await client.query('DELETE FROM lumoviz_team_members');
    await client.query('DELETE FROM lumoviz_team_changelog');
    await client.query('DELETE FROM lumoviz_sections');
    await client.query('DELETE FROM lumoviz_teams');
    await client.query('DELETE FROM contacts');
    console.log('  ✓ Cleared\n');

    // 2. Insert contacts
    console.log('── Inserting contacts ──');
    let contactCount = 0;
    for (const [name, person] of personMap) {
      await client.query(
        `INSERT INTO contacts (vanid, first_name, last_name, email, chapter, type, member_status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (vanid) DO NOTHING`,
        [person.vanid, person.firstName, person.lastName, person.email, person.section, person.type]
      );
      contactCount++;
    }
    console.log(`  ✓ Inserted ${contactCount} contacts`);

    // 2. Build and insert teams
    console.log('\n── Creating teams ──');
    const teamMap = new Map(); // teamNum -> { members: [], section }

    for (const row of rows) {
      const teamNum = row.Team.trim();
      const name = row.Name.trim();
      if (!teamMap.has(teamNum)) {
        teamMap.set(teamNum, { members: [], section: row.Section.trim(), type: row.Type.trim() });
      }
      teamMap.get(teamNum).members.push(name);
    }

    // Identify section leads (teachers whose first name matches a section name)
    const sectionLeads = new Map(); // sectionName -> person
    for (const [name, person] of personMap) {
      if (person.type === 'organizer') {
        // Check if this teacher's first name matches any section name
        for (const [, teamInfo] of teamMap) {
          if (teamInfo.section.toLowerCase() === person.firstName.toLowerCase() && teamInfo.section !== 'Teaching Team') {
            sectionLeads.set(teamInfo.section, person);
          }
        }
      }
    }

    const teamColors = [
      '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c',
      '#0891b2', '#be185d', '#4f46e5', '#ca8a04', '#059669',
      '#7c3aed', '#e11d48', '#0d9488',
    ];

    let teamCount = 0;
    for (const [teamNum, teamInfo] of teamMap) {
      const isTeachingTeam = teamInfo.section === 'Teaching Team';
      const teamId = `team_${teamNum}`;
      const colorIndex = (parseInt(teamNum) - 1) % teamColors.length;

      // Determine team name and lead
      let teamName, teamLead;
      if (isTeachingTeam) {
        teamName = 'Teaching Team';
        teamLead = 'Marshall';
      } else {
        const sectionLead = sectionLeads.get(teamInfo.section);
        teamLead = sectionLead ? `${sectionLead.firstName} ${sectionLead.lastName}`.trim() : teamInfo.members[0];
        teamName = `Team ${teamNum} (${teamInfo.section})`;
      }

      const membersString = teamInfo.members.join(', ');

      await client.query(
        `INSERT INTO lumoviz_teams (id, team_name, team_leader, chapter, team_members, turf, date_created, date_disbanded, color)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, NULL, $7)`,
        [teamId, teamName, teamLead, teamInfo.section, membersString, '', teamColors[colorIndex]]
      );

      // Insert team members
      for (const memberName of teamInfo.members) {
        const person = personMap.get(memberName);
        if (person) {
          await client.query(
            `INSERT INTO lumoviz_team_members (team_id, member_vanid, member_name, constituent_role, functional_role, date_added, is_active)
             VALUES ($1, $2, $3, NULL, NULL, CURRENT_TIMESTAMP, TRUE)`,
            [teamId, person.vanid.toString(), memberName]
          );
        }
      }

      console.log(`  ✓ Team ${teamNum}: "${teamName}" — ${teamInfo.members.length} members (section: ${teamInfo.section})`);
      teamCount++;
    }

    // 3. Set up section leads in lumoviz_sections
    console.log('\n── Setting section leads ──');
    for (const [sectionName, lead] of sectionLeads) {
      await client.query(
        `INSERT INTO lumoviz_sections (chapter_name, lead_vanid, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (chapter_name) DO UPDATE SET lead_vanid = $2, updated_at = CURRENT_TIMESTAMP`,
        [sectionName, lead.vanid.toString()]
      );
      console.log(`  ✓ ${sectionName} → ${lead.firstName} ${lead.lastName}`);
    }

    // Verify data was written
    const verifyResult = await client.query('SELECT COUNT(*) as c FROM contacts');
    console.log(`\n  Verify: ${verifyResult.rows[0].c} contacts in database`);

    console.log(`\n✅ Seed complete!`);
    console.log(`   ${contactCount} contacts`);
    console.log(`   ${teamCount} teams`);
    console.log(`   ${sectionLeads.size} section leads`);
    console.log(`\n   VAN IDs assigned: 100001–${nextVanId - 1}\n`);

  } catch (err) {
    console.error('\n✗ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
