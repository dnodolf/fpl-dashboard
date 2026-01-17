/**
 * Merge FFH historical data with Sleeper actuals to create training dataset
 * Used for validating and optimizing V3 scoring multipliers
 *
 * Combines:
 * 1. FFH predictions (FPL-based)
 * 2. FPL actuals (from FFH)
 * 3. Sleeper actuals (from manual CSV entry)
 */

const fs = require('fs');
const path = require('path');

function mergeTrainingData() {
  console.log('🔄 Merging FFH and Sleeper training data...\n');

  try {
    // Load FFH historical data
    const ffhPath = path.join(__dirname, '..', 'app', 'data', 'ffh_historical_gw1-20.json');
    const ffhData = JSON.parse(fs.readFileSync(ffhPath, 'utf-8'));

    // Load Sleeper CSV data
    const sleeperCsvPath = path.join(__dirname, '..', 'temp', 'sleeper_fc_data.csv');
    const sleeperCsvContent = fs.readFileSync(sleeperCsvPath, 'utf-8');

    // Parse CSV (skip header row)
    const sleeperRecords = [];
    const lines = sleeperCsvContent.split('\n').slice(1); // Skip header

    for (const line of lines) {
      if (!line.trim()) continue;

      const [week, playerName, position, points, starting] = line.split(',').map(s => s.trim());

      if (week && playerName && position && playerName !== 'Empty Slot') {
        sleeperRecords.push({
          week: parseInt(week),
          playerName,
          position,
          points: points === '' ? 0 : parseFloat(points),
          starting: starting === 'TRUE'
        });
      }
    }

    console.log(`✅ Loaded ${ffhData.players.length} FFH players`);
    console.log(`✅ Loaded ${sleeperRecords.length} Sleeper records from CSV\n`);

    // Create training dataset for V3 optimization
    const trainingData = {
      source: 'Merged FFH + Sleeper',
      created: new Date().toISOString(),
      season: '2025-26',
      gameweeks: '1-21',
      description: 'Combined FFH predictions, FPL actuals, and Sleeper actuals for V3 validation and optimization',
      records: []
    };

    // Match Sleeper records to FFH players
    let matched = 0;
    let unmatched = 0;
    const unmatchedPlayers = new Set();

    for (const sleeperRecord of sleeperRecords) {
      const { week, playerName, position, points: sleeperPoints } = sleeperRecord;

      // Try to find matching FFH player
      // Match on: name (last name in full name) + position
      const normalizedName = playerName.toLowerCase().replace(/[^a-z]/g, '');

      const ffhPlayer = ffhData.players.find(p => {
        // Use web_name (last name) instead of full name for better matching
        const ffhWebName = (p.name || '').toLowerCase().replace(/[^a-z]/g, '');
        const ffhFullName = (p.full_name || '').toLowerCase().replace(/[^a-z]/g, '');

        // Normalize position for matching (GK vs GKP)
        const sleeperPos = position === 'GK' ? 'GKP' : position;
        const positionMatch = p.position === sleeperPos;

        // Match if CSV name is contained in FFH web_name or full_name
        const nameMatch = ffhWebName.includes(normalizedName) || ffhFullName.includes(normalizedName);

        return nameMatch && positionMatch;
      });

      if (ffhPlayer) {
        // Find the specific gameweek data
        const gwData = ffhPlayer.gameweeks.find(gw => gw.gw === week);

        if (gwData) {
          // Create training record
          const record = {
            // Player info
            player_name: playerName,
            ffh_player_name: ffhPlayer.name,
            fpl_id: ffhPlayer.fpl_id,
            opta_id: ffhPlayer.opta_id,
            position,
            team: ffhPlayer.team,

            // Gameweek context
            gameweek: week,
            opponent: gwData.opponent,
            injured: gwData.injured,
            suspended: gwData.suspended,
            in_squad: gwData.in_squad,

            // FFH Predictions (FPL-based)
            ffh_predicted_pts: gwData.ffh_predicted_pts,
            ffh_predicted_mins: gwData.ffh_predicted_mins,
            ffh_predicted_xa90: gwData.ffh_predicted_xa90,
            ffh_predicted_xg90: gwData.ffh_predicted_xg90,

            // FPL Actuals
            fpl_actual_pts: gwData.fpl_actual_pts,
            fpl_actual_mins: gwData.fpl_actual_mins,

            // Sleeper Actuals (YOUR league)
            sleeper_actual_pts: sleeperPoints,

            // V3 Conversion (for comparison)
            v3_conversion_ratio: getV3ConversionRatio(position),
            v3_predicted_pts: gwData.ffh_predicted_pts ? gwData.ffh_predicted_pts * getV3ConversionRatio(position) : null
          };

          trainingData.records.push(record);
          matched++;
        }
      } else {
        unmatched++;
        unmatchedPlayers.add(`${playerName} (${position})`);
      }
    }

    // Save merged dataset
    const outputPath = path.join(__dirname, '..', 'app', 'data', 'v4_training_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(trainingData, null, 2));

    console.log(`\n✅ Training data created: ${outputPath}`);
    console.log(`📊 Total training records: ${trainingData.records.length}`);
    console.log(`✅ Matched: ${matched} records`);
    console.log(`⚠️  Unmatched: ${unmatched} records\n`);

    if (unmatchedPlayers.size > 0) {
      console.log('Unmatched players:');
      Array.from(unmatchedPlayers).sort().forEach(p => console.log(`  - ${p}`));
      console.log('');
    }

    // Calculate accuracy stats
    console.log('📊 Prediction Accuracy Analysis:\n');

    // FFH vs FPL
    const ffhFplComparisons = trainingData.records.filter(r => r.ffh_predicted_pts !== null && r.fpl_actual_pts !== null);
    if (ffhFplComparisons.length > 0) {
      const ffhFplMae = ffhFplComparisons.reduce((sum, r) => sum + Math.abs(r.fpl_actual_pts - r.ffh_predicted_pts), 0) / ffhFplComparisons.length;
      console.log(`  FFH → FPL MAE: ${ffhFplMae.toFixed(2)} points (${ffhFplComparisons.length} records)`);
    }

    // FFH vs Sleeper
    const ffhSleeperComparisons = trainingData.records.filter(r => r.ffh_predicted_pts !== null && r.sleeper_actual_pts !== 0);
    if (ffhSleeperComparisons.length > 0) {
      const ffhSleeperMae = ffhSleeperComparisons.reduce((sum, r) => sum + Math.abs(r.sleeper_actual_pts - r.ffh_predicted_pts), 0) / ffhSleeperComparisons.length;
      console.log(`  FFH → Sleeper MAE: ${ffhSleeperMae.toFixed(2)} points (${ffhSleeperComparisons.length} records)`);
    }

    // V3 vs Sleeper
    const v3SleeperComparisons = trainingData.records.filter(r => r.v3_predicted_pts !== null && r.sleeper_actual_pts !== 0);
    if (v3SleeperComparisons.length > 0) {
      const v3SleeperMae = v3SleeperComparisons.reduce((sum, r) => sum + Math.abs(r.sleeper_actual_pts - r.v3_predicted_pts), 0) / v3SleeperComparisons.length;
      console.log(`  V3 → Sleeper MAE: ${v3SleeperMae.toFixed(2)} points (${v3SleeperComparisons.length} records)`);
    }

    // FPL vs Sleeper (scoring system difference)
    const fplSleeperComparisons = trainingData.records.filter(r => r.fpl_actual_pts !== null && r.sleeper_actual_pts !== 0);
    if (fplSleeperComparisons.length > 0) {
      const avgFpl = fplSleeperComparisons.reduce((sum, r) => sum + r.fpl_actual_pts, 0) / fplSleeperComparisons.length;
      const avgSleeper = fplSleeperComparisons.reduce((sum, r) => sum + r.sleeper_actual_pts, 0) / fplSleeperComparisons.length;
      console.log(`\n  FPL avg actual: ${avgFpl.toFixed(2)} points`);
      console.log(`  Sleeper avg actual: ${avgSleeper.toFixed(2)} points`);
      console.log(`  Sleeper scoring multiplier: ${(avgSleeper / avgFpl).toFixed(2)}x vs FPL`);
    }

    // Position-specific analysis
    console.log('\n📊 Position-Specific Sleeper Multipliers (vs FPL):');
    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
      const posRecords = fplSleeperComparisons.filter(r => r.position === pos || r.position === 'GK' && pos === 'GKP');
      if (posRecords.length > 0) {
        const avgFpl = posRecords.reduce((sum, r) => sum + r.fpl_actual_pts, 0) / posRecords.length;
        const avgSleeper = posRecords.reduce((sum, r) => sum + r.sleeper_actual_pts, 0) / posRecords.length;
        const multiplier = avgSleeper / avgFpl;
        const v3Ratio = getV3ConversionRatio(pos);
        console.log(`  ${pos}: ${multiplier.toFixed(3)}x actual (V3 uses ${v3Ratio.toFixed(2)}x) - ${posRecords.length} records`);
      }
    });

    console.log('\n✅ Training data merge complete!');
    console.log('📝 Next step: Run scripts/optimizeV3Multipliers.js to test different multiplier values');

    return trainingData;

  } catch (error) {
    console.error('❌ Error merging training data:', error.message);
    throw error;
  }
}

function getV3ConversionRatio(position) {
  const ratios = {
    'GKP': 0.90,
    'GK': 0.90,
    'DEF': 1.15,
    'MID': 1.05,
    'FWD': 0.97
  };
  return ratios[position] || 1.0;
}

// Run the script
if (require.main === module) {
  try {
    mergeTrainingData();
    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
}

module.exports = { mergeTrainingData };
