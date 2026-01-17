/**
 * Script to collect FFH historical predictions vs actuals for entire season (2025 season)
 * This data will be combined with Sleeper actuals to train the V4 model
 *
 * Future-proofed: Fetches all 38 gameweeks automatically
 */

const fs = require('fs');
const path = require('path');

const FFH_API_URL = 'https://data.fantasyfootballhub.co.uk/api/player-predictions';

async function collectFFHHistoricalData() {
  console.log('🔍 Fetching FFH historical predictions and actuals...\n');

  try {
    // Load FFH credentials from .env file
    const envPath = path.join(__dirname, '..', '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    });

    const FFH_AUTH_STATIC = envVars.FFH_AUTH_STATIC;
    const FFH_BEARER_TOKEN = envVars.FFH_BEARER_TOKEN;

    if (!FFH_AUTH_STATIC || !FFH_BEARER_TOKEN) {
      throw new Error('FFH credentials not found in .env.local file');
    }

    // Fetch all players with full season data (GW 1-38)
    const url = `${FFH_API_URL}?orderBy=points&focus=range&positions=1,2,3,4&min_cost=0&max_cost=99999&search_term=&gw_start=1&gw_end=38&first=0&last=99999&use_predicted_fixtures=false&selected_players=`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept-Language': 'en-US',
        'Authorization': FFH_AUTH_STATIC,
        'Content-Type': 'application/json',
        'Token': FFH_BEARER_TOKEN
      }
    });

    if (!response.ok) {
      throw new Error(`FFH API returned ${response.status}`);
    }

    const data = await response.json();

    // Response is a direct array of players
    const players = Array.isArray(data) ? data : [];
    console.log(`✅ Fetched ${players.length} players from FFH`);

    // Debug: Check first player structure
    if (players.length > 0) {
      const sample = players[0];
      console.log(`\n🔍 Sample player keys: ${Object.keys(sample).slice(0, 20).join(', ')}...`);
      console.log(`   position: ${sample.position}, team: ${sample.team}, club: ${sample.club}`);
      console.log(`   player keys: ${sample.player ? Object.keys(sample.player).join(', ') : 'N/A'}`);
    }

    // Transform data into training format
    const trainingData = {
      source: 'FFH API',
      fetch_date: new Date().toISOString(),
      season: '2025-26',
      gameweeks: '1-38',
      description: 'FFH predictions vs FPL actuals for entire season. This will be combined with Sleeper actuals to train V4 model.',
      players: []
    };

    // Process each player
    for (const player of players) {
      const playerData = {
        fpl_id: player.player?.fpl_id || player.player?.id,
        name: player.web_name,
        full_name: player.player?.web_name || player.web_name,
        team: player.club,
        position: convertPositionToCode(player.position),
        opta_id: player.player?.opta_uuid,
        gameweeks: []
      };

      // Process each gameweek result
      if (player.results && Array.isArray(player.results)) {
        for (const result of player.results) {
          if (result.season === 2025 && result.gw >= 1 && result.gw <= 38) {
            const gwData = {
              gw: result.gw,
              // FFH Predictions (FPL-based)
              ffh_predicted_pts: result.predicted_pts?.predicted_pts || null,
              ffh_predicted_mins: result.predicted_pts?.predicted_mins || null,
              ffh_predicted_xa90: result.predicted_pts?.predicted_xa90 || null,
              ffh_predicted_xg90: result.predicted_pts?.predicted_xg90 || null,

              // FPL Actuals
              fpl_actual_pts: result.actual_pts || 0,
              fpl_actual_mins: result.mins || 0,
              fpl_actual_xa: result.xa || 0,
              fpl_actual_xgnp: result.xgnp || 0,

              // Match context
              opponent: result.opp?.[0] || null,
              injured: result.injured || false,
              suspended: result.suspended || false,
              in_squad: result.in_squad !== false
            };

            playerData.gameweeks.push(gwData);
          }
        }
      }

      // Only include players with at least 1 gameweek of data
      if (playerData.gameweeks.length > 0) {
        trainingData.players.push(playerData);
      }
    }

    // Save to file
    const outputPath = path.join(__dirname, '..', 'app', 'data', 'ffh_historical_gw1-20.json');
    fs.writeFileSync(outputPath, JSON.stringify(trainingData, null, 2));

    console.log(`\n✅ FFH historical data saved to: ${outputPath}`);
    console.log(`📊 Total players: ${trainingData.players.length}`);
    console.log(`📋 Total player-gameweek records: ${trainingData.players.reduce((sum, p) => sum + p.gameweeks.length, 0)}`);

    // Print sample data for validation
    console.log('\n📋 Sample data (first player, first 3 gameweeks):');
    const sample = trainingData.players[0];
    if (sample) {
      console.log(`\nPlayer: ${sample.name} (${sample.team}, ${sample.position})`);
      console.log(`Opta ID: ${sample.opta_id}`);
      console.log('\nGameweeks:');
      sample.gameweeks.slice(0, 3).forEach(gw => {
        console.log(`  GW${gw.gw}: FFH predicted ${gw.ffh_predicted_pts?.toFixed(2)} pts, FPL actual ${gw.fpl_actual_pts} pts (diff: ${(gw.fpl_actual_pts - (gw.ffh_predicted_pts || 0)).toFixed(2)})`);
      });
    }

    // Calculate accuracy stats
    console.log('\n📊 FFH Prediction Accuracy (FPL):');
    let totalPredictions = 0;
    let totalError = 0;
    let totalSquaredError = 0;

    trainingData.players.forEach(player => {
      player.gameweeks.forEach(gw => {
        if (gw.ffh_predicted_pts !== null && gw.fpl_actual_pts !== null) {
          const error = Math.abs(gw.fpl_actual_pts - gw.ffh_predicted_pts);
          totalError += error;
          totalSquaredError += error * error;
          totalPredictions++;
        }
      });
    });

    if (totalPredictions > 0) {
      const mae = totalError / totalPredictions;
      const rmse = Math.sqrt(totalSquaredError / totalPredictions);
      console.log(`  MAE (Mean Absolute Error): ${mae.toFixed(2)} points`);
      console.log(`  RMSE (Root Mean Squared Error): ${rmse.toFixed(2)} points`);
      console.log(`  Total predictions analyzed: ${totalPredictions}`);
    }

    return trainingData;

  } catch (error) {
    console.error('❌ Error fetching FFH historical data:', error.message);
    throw error;
  }
}

function convertPositionToCode(position) {
  // FFH uses string positions: "Goalkeeper", "Defender", "Midfielder", "Forward"
  const positionMap = {
    'Goalkeeper': 'GKP',
    'Defender': 'DEF',
    'Midfielder': 'MID',
    'Forward': 'FWD'
  };
  return positionMap[position] || position;
}

// Run the script
if (require.main === module) {
  collectFFHHistoricalData()
    .then(() => {
      console.log('\n✅ Data collection complete!');
      console.log('📝 Next step: Manually enter Sleeper actuals, then merge the datasets.');
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { collectFFHHistoricalData };
