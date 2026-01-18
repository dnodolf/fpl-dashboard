/**
 * Debug Unmatched Players Script
 *
 * Shows which EPL players from Sleeper aren't matching with FFH
 * Helps diagnose why we're at 88.2% instead of higher
 *
 * Usage: node scripts/debugUnmatchedPlayers.js
 */

const SLEEPER_LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID || '1240184286171107328';

// EPL team codes
const EPL_TEAMS = [
  'ARS', 'AVL', 'BOU', 'BRE', 'BHA', 'CHE', 'CRY', 'EVE',
  'FUL', 'LIV', 'MCI', 'MUN', 'NEW', 'NFO', 'TOT', 'WHU',
  'WOL', 'LEI', 'IPS', 'SOU'
];

/**
 * Check if player is from EPL team
 */
function isEPLTeam(team) {
  if (!team) return false;
  const teamUpper = team.toUpperCase();
  return EPL_TEAMS.includes(teamUpper);
}

/**
 * Fetch Sleeper players
 */
async function fetchSleeperPlayers() {
  console.log('📥 Fetching Sleeper players...');

  const response = await fetch('https://api.sleeper.app/v1/players/clubsoccer:epl');
  if (!response.ok) {
    throw new Error(`Sleeper API error: ${response.status}`);
  }

  const data = await response.json();
  const players = Object.values(data);

  console.log(`✅ Fetched ${players.length} total Sleeper players\n`);
  return players;
}

/**
 * Fetch FFH players
 */
async function fetchFFHPlayers() {
  console.log('📥 Fetching FFH players...');

  // Load credentials
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(process.cwd(), '.env.local');

  let FFH_AUTH_STATIC, FFH_BEARER_TOKEN;

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    });
    FFH_AUTH_STATIC = envVars.FFH_AUTH_STATIC;
    FFH_BEARER_TOKEN = envVars.FFH_BEARER_TOKEN;
  }

  if (!FFH_AUTH_STATIC || !FFH_BEARER_TOKEN) {
    throw new Error('FFH credentials not found in .env.local');
  }

  const response = await fetch(
    'https://data.fantasyfootballhub.co.uk/api/player-predictions?orderBy=season_prediction&positions=1,2,3,4&min_cost=0&max_cost=99999&search_term=&gw_start=1&gw_end=38&first=0&last=99999&use_predicted_fixtures=false&selected_players=',
    {
      headers: {
        'Accept-Language': 'en-US',
        'Authorization': FFH_AUTH_STATIC,
        'Content-Type': 'application/json',
        'Token': FFH_BEARER_TOKEN
      }
    }
  );

  if (!response.ok) {
    throw new Error(`FFH API error: ${response.status}`);
  }

  const data = await response.json();
  const players = Array.isArray(data) ? data : [];

  console.log(`✅ Fetched ${players.length} FFH players\n`);
  return players;
}

/**
 * Extract Opta ID from FFH player
 */
function getFFHOptaId(ffhPlayer) {
  return ffhPlayer.opta_uuid ||
         ffhPlayer.opta_id ||
         ffhPlayer.player?.opta_uuid ||
         ffhPlayer.player?.opta_id ||
         null;
}

/**
 * Main debug function
 */
async function debugUnmatchedPlayers() {
  console.log('🔍 Debug Unmatched Players');
  console.log('='.repeat(70));
  console.log('');

  try {
    // Fetch data
    const [sleeperPlayers, ffhPlayers] = await Promise.all([
      fetchSleeperPlayers(),
      fetchFFHPlayers()
    ]);

    // Build FFH Opta ID lookup
    const ffhOptaMap = new Map();
    ffhPlayers.forEach(ffh => {
      const optaId = getFFHOptaId(ffh);
      if (optaId) {
        ffhOptaMap.set(optaId, {
          name: ffh.web_name || ffh.name,
          team: ffh.club || ffh.team?.code_name,
          position: ffh.position
        });
      }
    });

    console.log(`📊 FFH players with Opta ID: ${ffhOptaMap.size}`);
    console.log('');

    // Filter Sleeper to EPL players only
    const sleeperEPL = sleeperPlayers.filter(p =>
      isEPLTeam(p.team_abbr || p.team)
    );

    console.log(`📊 Sleeper EPL players: ${sleeperEPL.length}`);
    console.log('');

    // Find EPL players with Opta ID
    const sleeperEPLWithOpta = sleeperEPL.filter(p => p.opta_id);
    console.log(`📊 Sleeper EPL players w/ Opta: ${sleeperEPLWithOpta.length}`);
    console.log('');

    // Find unmatched
    const unmatched = [];
    const matched = [];

    sleeperEPLWithOpta.forEach(sleeper => {
      if (ffhOptaMap.has(sleeper.opta_id)) {
        matched.push({
          sleeper: sleeper.full_name || sleeper.name,
          ffh: ffhOptaMap.get(sleeper.opta_id).name,
          team: sleeper.team_abbr || sleeper.team,
          position: sleeper.fantasy_positions?.[0] || sleeper.position,
          opta_id: sleeper.opta_id
        });
      } else {
        unmatched.push({
          name: sleeper.full_name || sleeper.name,
          team: sleeper.team_abbr || sleeper.team,
          position: sleeper.fantasy_positions?.[0] || sleeper.position,
          opta_id: sleeper.opta_id,
          player_id: sleeper.player_id || sleeper.id
        });
      }
    });

    // Stats
    const matchRate = (matched.length / sleeperEPLWithOpta.length * 100).toFixed(1);

    console.log('📈 Matching Statistics:');
    console.log('-'.repeat(70));
    console.log(`  Matched:   ${matched.length} / ${sleeperEPLWithOpta.length} (${matchRate}%)`);
    console.log(`  Unmatched: ${unmatched.length}`);
    console.log('');

    // Show unmatched players
    if (unmatched.length > 0) {
      console.log('❌ Unmatched EPL Players (Sleeper has Opta, FFH missing):');
      console.log('='.repeat(70));
      console.log('Name'.padEnd(25) + 'Team'.padEnd(8) + 'Pos'.padEnd(6) + 'Opta ID');
      console.log('-'.repeat(70));

      // Sort by team, then name
      unmatched.sort((a, b) => {
        if (a.team !== b.team) return a.team.localeCompare(b.team);
        return a.name.localeCompare(b.name);
      });

      unmatched.forEach(p => {
        const name = (p.name || 'Unknown').substring(0, 24).padEnd(25);
        const team = (p.team || 'N/A').padEnd(8);
        const pos = (p.position || 'N/A').padEnd(6);
        const opta = p.opta_id || 'N/A';
        console.log(`${name}${team}${pos}${opta}`);
      });

      console.log('');

      // Position breakdown
      const byPosition = {};
      unmatched.forEach(p => {
        const pos = p.position || 'Unknown';
        byPosition[pos] = (byPosition[pos] || 0) + 1;
      });

      console.log('📊 Unmatched by Position:');
      Object.entries(byPosition).sort((a, b) => b[1] - a[1]).forEach(([pos, count]) => {
        console.log(`  ${pos}: ${count} players`);
      });
      console.log('');

      // Team breakdown
      const byTeam = {};
      unmatched.forEach(p => {
        const team = p.team || 'Unknown';
        byTeam[team] = (byTeam[team] || 0) + 1;
      });

      console.log('📊 Unmatched by Team (top 5):');
      Object.entries(byTeam)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([team, count]) => {
          console.log(`  ${team}: ${count} players`);
        });
      console.log('');
    } else {
      console.log('✅ All EPL players matched!');
      console.log('');
    }

    // Sample matched players
    console.log('✅ Sample Matched Players (first 10):');
    console.log('='.repeat(70));
    console.log('Sleeper Name'.padEnd(25) + 'FFH Name'.padEnd(25) + 'Team'.padEnd(8) + 'Pos');
    console.log('-'.repeat(70));

    matched.slice(0, 10).forEach(m => {
      const sleeper = (m.sleeper || 'Unknown').substring(0, 24).padEnd(25);
      const ffh = (m.ffh || 'Unknown').substring(0, 24).padEnd(25);
      const team = (m.team || 'N/A').padEnd(8);
      const pos = m.position || 'N/A';
      console.log(`${sleeper}${ffh}${team}${pos}`);
    });

    console.log('');
    console.log('💡 Analysis:');
    console.log('-'.repeat(70));

    if (unmatched.length > 0) {
      console.log('Possible reasons for unmatched players:');
      console.log('  1. FFH missing these players (not tracking them)');
      console.log('  2. Opta ID mismatch (Sleeper and FFH use different IDs)');
      console.log('  3. Players transferred/retired mid-season');
      console.log('  4. Young/fringe players with minimal game time');
      console.log('');
      console.log('Recommendations:');
      console.log('  - Check if unmatched players have >100 minutes this season');
      console.log('  - If yes: Add fallback name+team matching');
      console.log('  - If no: Accept current match rate as sufficient');
    }

    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  debugUnmatchedPlayers().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { debugUnmatchedPlayers };
