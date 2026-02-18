/**
 * Seed script: clears existing data and imports people + teams from CSV.
 *
 * Tables cleared  : contacts, lumoviz_meetings, lumoviz_team_members, lumoviz_teams
 * Tables populated: contacts, lumoviz_teams, lumoviz_team_members
 *
 * Run from /server:  node seed-from-csv.js
 *              or:   node seed-from-csv.js --dry-run   (prints SQL, no writes)
 */

require('dotenv').config();
const { Pool } = require('pg');
const readline = require('readline');

const DRY_RUN = process.argv.includes('--dry-run');

// ─── Database connection ────────────────────────────────────────────────────
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'lumoviz_app',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'lumoviz',
});

// ─── CSV data ────────────────────────────────────────────────────────────────
// Columns: team (number), section (organizer name), name, email
const CSV = [
  [1,'Alyssa','Tatenda Mujeni','tmujeni@hsph.harvard.edu'],
  [1,'Alyssa','Julia Thayne','julia_thayne@gsd.harvard.edu'],
  [1,'Alyssa','Andrés Porras Gutiérrez','andresporrasgtz@gse.harvard.edu'],
  [1,'Alyssa','Zahra Yarali','zyarali@hds.harvard.edu'],
  [1,'Alyssa','Eliot Genton','egenton@fas.harvard.edu'],
  [1,'Alyssa','Zachary Shulkin','zshulkin@hks.harvard.edu'],
  [2,'Alyssa','Robbie Macpherson','rmacpherson@fas.harvard.edu'],
  [2,'Alyssa','Juan Pedraza Arellano','juanpa@college.harvard.edu'],
  [2,'Alyssa','Abby Charles','Abbycharles@hsph.harvard.edu'],
  [2,'Alyssa','Vaiba Flomo','vflomo@hks.harvard.edu'],
  [2,'Alyssa','Daniela Chacon Arias','daniela_chaconarias@gsd.harvard.edu'],
  [2,'Alyssa','Arundhati Prasad','arundhati_prasad@gsd.harvard.edu'],
  [3,'Zoe','Orlando Carvajal','orlandocarvajal@hks.harvard.edu'],
  [3,'Zoe','Hannah Blau','hblau@gse.harvard.edu'],
  [3,'Zoe','Nitya Basrur','nityabasrur@gse.harvard.edu'],
  [3,'Zoe','Thames Chamjirachaikul','tchamjirachaikul@hks.harvard.edu'],
  [3,'Zoe','Eman Manya','emanya@gse.harvard.edu'],
  [4,'Zoe','Matthew McLaughlin','mmclaughlin@hks.harvard.edu'],
  [4,'Zoe','Adelaide Randall','adelaide_randall@gse.harvard.edu'],
  [4,'Zoe','Giovanni Pintor','giovanni_pintor@hks.harvard.edu'],
  [4,'Zoe','Dhriti Sonawala','dhriti_sonawala@hks.harvard.edu'],
  [4,'Zoe','Hnin Khin Khin Thet','hninkhinkhin_thet@gse.harvard.edu'],
  [5,'Svitlana','Felipe Vergara Iduya','fvergaraiduya@gse.harvard.edu'],
  [5,'Svitlana','Andres Machado Hurtado','amachado@hks.harvard.edu'],
  [5,'Svitlana','Jen Nilsen','jennifer_nilsen@fas.harvard.edu'],
  [5,'Svitlana','Hisako Nomoto','hisako_nomoto@gse.harvard.edu'],
  [5,'Svitlana','McKenzie Swain','mswain@hks.harvard.edu'],
  [5,'Svitlana','Adan Abu Elnag','adann@mit.edu'],
  [5,'Svitlana','Cho Luangprasert','cluangprasert@hks.harvard.edu'],
  [6,'Svitlana','Dia Shah','dia_shah@gse.harvard.edu'],
  [6,'Svitlana','Uliana Malanyak','uliana_m@mit.edu'],
  [6,'Svitlana','Sarah Tran','sarahtran@gse.harvard.edu'],
  [6,'Svitlana','Brett Ascarelli','brettascarelli@yahoo.com'],
  [6,'Svitlana','Muhamad Fakhri Guniar','fguniar9@mit.edu'],
  [6,'Svitlana','Wayne Cher','wcher@gse.harvard.edu'],
  [6,'Svitlana','Emma Pan','emmapan@hks.harvard.edu'],
  [7,'Sepi','Regine Celius','rcelius@gse.harvard.edu'],
  [7,'Sepi','Shuyan Feng','sfeng@hks.harvard.edu'],
  [7,'Sepi','Avleen Kaur','avleenkaur@hks.harvard.edu'],
  [7,'Sepi','Maya Povhe','mpovhe@gse.harvard.edu'],
  [8,'Sepi','Stephanie Gonzalez','sgonzalezdiz@gse.harvard.edu'],
  [8,'Sepi','Oren Adar','orenadar@hks.harvard.edu'],
  [8,'Sepi','Atilla Agussalam','atillaagussalam@gse.harvard.edu'],
  [8,'Sepi','Caro Leibowitz','cleibowitz@hds.harvard.edu'],
  [8,'Sepi','Mia Lei','mialei@hks.harvard.edu'],
  [8,'Sepi','Misol Won','mwon@hsph.harvard.edu'],
  [9,'Edgar','Patricia Finneran','pfinneran@hks.harvard.edu'],
  [9,'Edgar','Francisco Escobar-Onofre','fescobar@hks.harvard.edu'],
  [9,'Edgar','Dilnaz Zhalmagambetova','dilnaz_zhal@gse.harvard.edu'],
  [9,'Edgar','Madhukar Banuri','mbanuri@hks.harvard.edu'],
  [9,'Edgar','Nurilly Rania Binti Jusly','nurillyrania_bintijusly@gse.harvard.edu'],
  [10,'Edgar','Veronica Lopez Gousset','vlopezgousset@hsph.harvard.edu'],
  [10,'Edgar','Sonali Verma','sonaliverma@hsph.harvard.edu'],
  [10,'Edgar','Veronica Salas','vsalas@gse.harvard.edu'],
  [10,'Edgar','Evandro Carvalho','evandrocarvalho@hks.harvard.edu'],
  [10,'Edgar','Yating (Basil) Liu','byliu@mit.edu'],
  [11,'Ruhee','Kelly Ding','kelly999@mit.edu'],
  [11,'Ruhee','Rabia Maniar','rabia_maniar@hms.harvard.edu'],
  [11,'Ruhee','Omar Rahim','omarrahim@gse.harvard.edu'],
  [11,'Ruhee','ZK (Zheng Kun) Gao','zkgao@gse.harvard.edu'],
  [11,'Ruhee','Daria Lisus','darialisus@hsph.harvard.edu'],
  [12,'Ruhee','Sutton Kiplinger','skiplinger@gmail.com'],
  [12,'Ruhee','Ghita Aqallal','ghita_aqallal@gse.harvard.edu'],
  [12,'Ruhee','Shreeya Pradhan','shreeyapradhan@gse.harvard.edu'],
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function splitName(fullName) {
  const trimmed = fullName.trim();
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) return { firstname: trimmed, lastname: '' };
  return {
    firstname: trimmed.slice(0, spaceIdx).trim(),
    lastname: trimmed.slice(spaceIdx + 1).trim(),
  };
}

function confirm(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, ans => { rl.close(); resolve(ans.trim().toLowerCase()); });
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║            LUMOVIZ  —  CSV seed script                  ║');
  if (DRY_RUN) {
    console.log('║                   *** DRY RUN ***                        ║');
  }
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log(`People to import : ${CSV.length}`);
  console.log(`Teams to create  : ${[...new Set(CSV.map(r => r[0]))].length}`);
  console.log(`Sections         : ${[...new Set(CSV.map(r => r[1]))].join(', ')}\n`);

  console.log('⚠️  This will PERMANENTLY DELETE the following tables:');
  console.log('   • contacts');
  console.log('   • lumoviz_meetings  (all logged conversations)');
  console.log('   • lumoviz_team_members');
  console.log('   • lumoviz_teams\n');

  if (!DRY_RUN) {
    const ans = await confirm('Type "yes" to continue, anything else to abort: ');
    if (ans !== 'yes') {
      console.log('\nAborted. No changes made.');
      await pool.end();
      return;
    }
  }

  const client = await pool.connect();
  try {
    if (!DRY_RUN) await client.query('BEGIN');

    // ── 1. Clear tables ──────────────────────────────────────────────────────
    console.log('\n🗑️  Clearing tables…');
    const clears = [
      'DELETE FROM lumoviz_team_members',
      'DELETE FROM lumoviz_teams',
      'DELETE FROM lumoviz_meetings',
      'DELETE FROM contacts',
    ];
    for (const sql of clears) {
      if (DRY_RUN) { console.log('  DRY:', sql); continue; }
      const res = await client.query(sql);
      console.log(`  ✓ ${sql} (${res.rowCount} rows removed)`);
    }

    // ── 2. Build per-person records with stable vanids ───────────────────────
    const now = new Date().toISOString();
    const people = CSV.map((row, i) => {
      const [team, section, fullName, email] = row;
      const { firstname, lastname } = splitName(fullName);
      const vanid = -(i + 1);       // -1, -2, … -63
      return { vanid, firstname, lastname, email, chapter: section, team };
    });

    // ── 3. Insert contacts ───────────────────────────────────────────────────
    console.log('\n👤 Inserting contacts…');
    for (const p of people) {
      const sql = `
        INSERT INTO contacts (vanid, first_name, last_name, email, chapter, loe, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (vanid) DO UPDATE
          SET first_name  = EXCLUDED.first_name,
              last_name   = EXCLUDED.last_name,
              email       = EXCLUDED.email,
              chapter     = EXCLUDED.chapter,
              loe         = EXCLUDED.loe,
              updated_at  = EXCLUDED.updated_at`;
      const vals = [p.vanid, p.firstname, p.lastname, p.email, p.chapter, 'Leader', now, now];
      if (DRY_RUN) {
        console.log(`  DRY: INSERT contact vanid=${p.vanid} "${p.firstname} ${p.lastname}" <${p.email}> section=${p.chapter}`);
      } else {
        await client.query(sql, vals);
        console.log(`  ✓ ${p.firstname} ${p.lastname} (${p.email})  section=${p.chapter}  vanid=${p.vanid}`);
      }
    }

    // ── 4. Build teams map ───────────────────────────────────────────────────
    const teamNums = [...new Set(people.map(p => p.team))].sort((a, b) => a - b);
    const teamIdMap = {}; // teamNum → generated team id
    for (const num of teamNums) {
      teamIdMap[num] = `team_${num}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }

    // ── 5. Insert lumoviz_teams ──────────────────────────────────────────────
    console.log('\n🏷️  Creating teams…');
    for (const num of teamNums) {
      const members = people.filter(p => p.team === num);
      const section = members[0].chapter;
      const memberNames = members.map(p => `${p.firstname} ${p.lastname}`).join(', ');
      const sql = `
        INSERT INTO lumoviz_teams
          (id, team_name, team_leader, chapter, team_members, date_created)
        VALUES ($1, $2, $3, $4, $5, $6)`;
      const vals = [teamIdMap[num], `Team ${num}`, section, section, memberNames, now];
      if (DRY_RUN) {
        console.log(`  DRY: INSERT team "Team ${num}" section=${section} members=(${members.length})`);
      } else {
        await client.query(sql, vals);
        console.log(`  ✓ Team ${num}  section=${section}  members=${members.length}`);
      }
    }

    // ── 6. Insert lumoviz_team_members ───────────────────────────────────────
    console.log('\n👥 Inserting team members…');
    for (const p of people) {
      const teamId = teamIdMap[p.team];
      const sql = `
        INSERT INTO lumoviz_team_members
          (team_id, member_vanid, member_name, constituent_role, functional_role, date_added, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`;
      const vals = [teamId, p.vanid, `${p.firstname} ${p.lastname}`, 'Leader', 'Team Member', now, true];
      if (DRY_RUN) {
        console.log(`  DRY: INSERT member vanid=${p.vanid} into team ${p.team}`);
      } else {
        await client.query(sql, vals);
      }
    }
    if (!DRY_RUN) console.log(`  ✓ ${people.length} team-member rows inserted`);

    // ── Commit ───────────────────────────────────────────────────────────────
    if (!DRY_RUN) {
      await client.query('COMMIT');
      console.log('\n✅ Done! Database seeded successfully.\n');
      console.log(`   ${people.length} contacts imported`);
      console.log(`   ${teamNums.length} teams created`);
      console.log(`   lumoviz_meetings cleared\n`);
    } else {
      console.log('\n✅ Dry run complete — no changes written.\n');
    }
  } catch (err) {
    if (!DRY_RUN) await client.query('ROLLBACK');
    console.error('\n❌ Error — transaction rolled back:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
