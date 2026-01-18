/**
 * Debug Unmatched FFH Players Script
 *
 * Shows which FFH-tracked players aren't matching with Sleeper
 * This reveals if we're missing important EPL players
 *
 * Usage: node scripts/debugUnmatchedFFHPlayers.js
 */

const SLEEPER_LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID || '1240184286171107328';

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
 * Extract Opta ID from Sleeper player
 */
function getSleeperOptaId(sleeperPlayer) {
  return sleeperPlayer.opta_id || null;
}

/**
 * Main debug function
 */
async function debugUnmatchedFFHPlayers() {
  console.log('🔍 Debug Unmatched FFH Players (Reverse Direction)');
  console.log('='.repeat(70));
  console.log('');

  try {
    // Fetch data
    const [sleeperPlayers, ffhPlayers] = await Promise.all([
      fetchSleeperPlayers(),
      fetchFFHPlayers()
    ]);

    // Build Sleeper Opta ID lookup
    const sleeperOptaMap = new Map();
    sleeperPlayers.forEach(sleeper => {
      const optaId = getSleeperOptaId(sleeper);
      if (optaId) {
        sleeperOptaMap.set(optaId, {
          name: sleeper.full_name || sleeper.name,
          team: sleeper.team_abbr || sleeper.team,
          position: sleeper.fantasy_positions?.[0] || sleeper.position
        });
      }
    });

    console.log(`📊 Sleeper players with Opta ID: ${sleeperOptaMap.size}`);
    console.log('');

    // Find FFH players with Opta ID
    const ffhWithOpta = ffhPlayers.filter(ffh => getFFHOptaId(ffh));
    console.log(`📊 FFH players w/ Opta: ${ffhWithOpta.length}`);
    console.log('');

    // Find unmatched
    const unmatched = [];
    const matched = [];

    ffhWithOpta.forEach(ffh => {
      const optaId = getFFHOptaId(ffh);

      if (sleeperOptaMap.has(optaId)) {
        matched.push({
          ffh: ffh.web_name || ffh.name,
          sleeper: sleeperOptaMap.get(optaId).name,
          team: ffh.club || ffh.team?.code_name,
          position: ffh.position,
          opta_id: optaId
        });
      } else {
        unmatched.push({
          name: ffh.web_name || ffh.name,
          full_name: ffh.player?.web_name || ffh.name,
          team: ffh.club || ffh.team?.code_name,
          position: ffh.position,
          opta_id: optaId,
          fpl_id: ffh.fpl_id || ffh.id,
          season_prediction: ffh.season_prediction || 0
        });
      }
    });

    // Stats
    const matchRate = (matched.length / ffhWithOpta.length * 100).toFixed(1);

    console.log('📈 Matching Statistics:');
    console.log('-'.repeat(70));
    console.log(`  Matched:   ${matched.length} / ${ffhWithOpta.length} (${matchRate}%)`);
    console.log(`  Unmatched: ${unmatched.length}`);
    console.log('');

    // Show unmatched players
    if (unmatched.length > 0) {
      console.log('❌ Unmatched FFH Players (FFH has Opta, Sleeper missing):');
      console.log('='.repeat(70));
      console.log('Name'.padEnd(25) + 'Team'.padEnd(8) + 'Pos'.padEnd(6) + 'Pred Pts'.padEnd(10) + 'Opta ID');
      console.log('-'.repeat(70));

      // Sort by predicted points (descending) to show important players first
      unmatched.sort((a, b) => b.season_prediction - a.season_prediction);

      unmatched.forEach(p => {
        const name = (p.name || 'Unknown').substring(0, 24).padEnd(25);
        const team = (p.team || 'N/A').padEnd(8);
        const pos = (p.position || 'N/A').padEnd(6);
        const pred = (p.season_prediction || 0).toFixed(1).padStart(8).padEnd(10);
        const opta = (p.opta_id || 'N/A').substring(0, 30);
        console.log(`${name}${team}${pos}${pred}${opta}`);
      });

      console.log('');

      // Show high-value unmatched (>50 predicted points)
      const highValue = unmatched.filter(p => p.season_prediction > 50);
      if (highValue.length > 0) {
        console.log('⚠️  HIGH-VALUE Unmatched Players (>50 predicted points):');
        console.log('-'.repeat(70));
        highValue.forEach(p => {
          console.log(`  ${p.name.padEnd(20)} (${p.team}) - ${p.season_prediction.toFixed(1)} pts`);
        });
        console.log('');
      }

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

      console.log('📊 Unmatched by Team (top 10):');
      Object.entries(byTeam)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([team, count]) => {
          console.log(`  ${team}: ${count} players`);
        });
      console.log('');

      // Predicted points breakdown
      const highPred = unmatched.filter(p => p.season_prediction > 50).length;
      const medPred = unmatched.filter(p => p.season_prediction > 20 && p.season_prediction <= 50).length;
      const lowPred = unmatched.filter(p => p.season_prediction <= 20).length;

      console.log('📊 Unmatched by Predicted Points:');
      console.log(`  High (>50 pts):  ${highPred} players ⚠️  IMPORTANT`);
      console.log(`  Med (20-50 pts): ${medPred} players`);
      console.log(`  Low (<20 pts):   ${lowPred} players (fringe players)`);
      console.log('');

    } else {
      console.log('✅ All FFH players matched to Sleeper!');
      console.log('');
    }

    // Sample matched players (top predicted points)
    console.log('✅ Sample Matched Players (top 10 by predicted points):');
    console.log('='.repeat(70));
    console.log('FFH Name'.padEnd(25) + 'Sleeper Name'.padEnd(25) + 'Team'.padEnd(8) + 'Pos');
    console.log('-'.repeat(70));

    // Need to add season prediction to matched players for sorting
    const matchedWithPrediction = matched.map(m => {
      const ffhPlayer = ffhPlayers.find(f => (f.web_name || f.name) === m.ffh);
      return {
        ...m,
        season_prediction: ffhPlayer?.season_prediction || 0
      };
    });

    matchedWithPrediction
      .sort((a, b) => b.season_prediction - a.season_prediction)
      .slice(0, 10)
      .forEach(m => {
        const ffh = (m.ffh || 'Unknown').substring(0, 24).padEnd(25);
        const sleeper = (m.sleeper || 'Unknown').substring(0, 24).padEnd(25);
        const team = (m.team || 'N/A').padEnd(8);
        const pos = m.position || 'N/A';
        console.log(`${ffh}${sleeper}${team}${pos}`);
      });

    console.log('');
    console.log('💡 Analysis:');
    console.log('-'.repeat(70));

    if (unmatched.length > 0) {
      const important = unmatched.filter(p => p.season_prediction > 50);

      if (important.length > 0) {
        console.log(`⚠️  ${important.length} HIGH-VALUE players are unmatched!`);
        console.log('');
        console.log('Possible reasons:');
        console.log('  1. Opta ID mismatch between FFH and Sleeper');
        console.log('  2. Name variations (e.g., "Mohamed Salah" vs "Salah")');
        console.log('  3. Players recently transferred/not in Sleeper DB yet');
        console.log('');
        console.log('Recommendation:');
        console.log('  → ADD FALLBACK NAME+TEAM MATCHING for these players');
        console.log('  → This could improve match rate from 84% to ~95%');
      } else {
        console.log('✅ All high-value FFH players are matched!');
        console.log('');
        console.log('Unmatched players are low-value (<50 pts predicted)');
        console.log('Current 84% match rate is acceptable.');
      }
    }

    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  debugUnmatchedFFHPlayers().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { debugUnmatchedFFHPlayers };
