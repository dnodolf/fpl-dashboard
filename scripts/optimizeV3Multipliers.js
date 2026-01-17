/**
 * V3 Multiplier Optimization Script
 *
 * Uses actual Sleeper results to find optimal position multipliers
 * Run this after collecting more gameweek data to potentially improve V3
 *
 * Usage: node scripts/optimizeV3Multipliers.js
 */

const fs = require('fs');
const path = require('path');

/**
 * Load merged training data
 */
function loadTrainingData() {
  const ffhPath = path.join(__dirname, '..', 'app', 'data', 'ffh_historical_gw1-20.json');
  const sleeperCsvPath = path.join(__dirname, '..', 'temp', 'sleeper_fc_data.csv');

  if (!fs.existsSync(ffhPath)) {
    console.error('❌ FFH historical data not found. Run collectFFHHistoricalData.js first.');
    return null;
  }

  if (!fs.existsSync(sleeperCsvPath)) {
    console.error('❌ Sleeper CSV not found. Add actual Sleeper scores to temp/sleeper_fc_data.csv');
    return null;
  }

  const ffhData = JSON.parse(fs.readFileSync(ffhPath, 'utf-8'));
  const sleeperCsvContent = fs.readFileSync(sleeperCsvPath, 'utf-8');

  // Parse Sleeper CSV
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

  // Match Sleeper to FFH
  const trainingRecords = [];

  for (const sleeperRecord of sleeperRecords) {
    const normalizedName = sleeperRecord.playerName.toLowerCase().replace(/[^a-z]/g, '');

    const ffhPlayer = ffhData.players.find(p => {
      const ffhWebName = (p.name || '').toLowerCase().replace(/[^a-z]/g, '');
      const ffhFullName = (p.full_name || '').toLowerCase().replace(/[^a-z]/g, '');
      const sleeperPos = sleeperRecord.position === 'GK' ? 'GKP' : sleeperRecord.position;
      const positionMatch = p.position === sleeperPos;
      const nameMatch = ffhWebName.includes(normalizedName) || ffhFullName.includes(normalizedName);
      return nameMatch && positionMatch;
    });

    if (ffhPlayer) {
      const gwData = ffhPlayer.gameweeks.find(gw => gw.gw === sleeperRecord.week);
      if (gwData) {
        trainingRecords.push({
          playerName: sleeperRecord.playerName,
          position: sleeperRecord.position,
          gameweek: sleeperRecord.week,
          ffh_predicted_pts: gwData.ffh_predicted_pts,
          sleeper_actual_pts: sleeperRecord.points
        });
      }
    }
  }

  return trainingRecords;
}

/**
 * Calculate MAE for given multipliers
 */
function calculateMAE(records, multipliers) {
  let totalError = 0;
  let count = 0;

  for (const record of records) {
    const multiplier = multipliers[record.position] || 1.0;
    const prediction = record.ffh_predicted_pts * multiplier;
    const error = Math.abs(prediction - record.sleeper_actual_pts);
    totalError += error;
    count++;
  }

  return count > 0 ? totalError / count : null;
}

/**
 * Test a range of multipliers to find optimal
 */
function gridSearch(records) {
  console.log('🔍 Running grid search to find optimal multipliers...\n');

  const positions = ['GKP', 'GK', 'DEF', 'MID', 'FWD'];
  const currentV3 = {
    'GKP': 0.90,
    'GK': 0.90,
    'DEF': 1.15,
    'MID': 1.05,
    'FWD': 0.97
  };

  // Test ranges around current V3 values
  const ranges = {
    'GKP': [0.85, 0.88, 0.90, 0.92, 0.95, 1.00],
    'GK': [0.85, 0.88, 0.90, 0.92, 0.95, 1.00],
    'DEF': [1.10, 1.12, 1.15, 1.17, 1.20, 1.25],
    'MID': [1.00, 1.03, 1.05, 1.07, 1.10, 1.15],
    'FWD': [0.92, 0.95, 0.97, 1.00, 1.02, 1.05]
  };

  let bestMAE = Infinity;
  let bestMultipliers = { ...currentV3 };

  // Simple grid search (not exhaustive - would take too long)
  // Test each position independently
  const results = [];

  for (const pos of ['GKP', 'DEF', 'MID', 'FWD']) {
    const posRecords = records.filter(r => r.position === pos || (pos === 'GKP' && r.position === 'GK'));
    if (posRecords.length === 0) continue;

    console.log(`\n${pos} (${posRecords.length} samples):`);
    console.log('-'.repeat(50));

    for (const testValue of ranges[pos]) {
      const testMultipliers = { ...currentV3, [pos]: testValue };
      if (pos === 'GKP') testMultipliers['GK'] = testValue;

      const mae = calculateMAE(posRecords, testMultipliers);
      results.push({
        position: pos,
        multiplier: testValue,
        mae: mae,
        isCurrent: testValue === currentV3[pos]
      });

      const marker = testValue === currentV3[pos] ? '⭐ CURRENT' : '';
      console.log(`  ${testValue.toFixed(2)}x → MAE ${mae.toFixed(3)} ${marker}`);
    }

    // Find best for this position
    const bestForPos = results.filter(r => r.position === pos).sort((a, b) => a.mae - b.mae)[0];
    console.log(`  → Best: ${bestForPos.multiplier.toFixed(2)}x (MAE ${bestForPos.mae.toFixed(3)})`);
  }

  // Calculate overall MAE with current V3
  const overallV3MAE = calculateMAE(records, currentV3);

  console.log('\n' + '='.repeat(70));
  console.log('📊 Summary:');
  console.log('='.repeat(70));
  console.log(`Current V3 overall MAE: ${overallV3MAE.toFixed(3)}`);
  console.log('\nCurrent V3 multipliers:');
  console.log(`  GKP: ${currentV3.GKP}x`);
  console.log(`  DEF: ${currentV3.DEF}x`);
  console.log(`  MID: ${currentV3.MID}x`);
  console.log(`  FWD: ${currentV3.FWD}x`);

  return currentV3;
}

/**
 * Main optimization function
 */
function optimizeV3() {
  console.log('🚀 V3 Multiplier Optimization');
  console.log('='.repeat(70));
  console.log('');

  const trainingData = loadTrainingData();

  if (!trainingData || trainingData.length === 0) {
    console.error('❌ No training data available');
    return;
  }

  console.log(`✅ Loaded ${trainingData.length} training records`);

  // Show gameweek range
  const gameweeks = [...new Set(trainingData.map(r => r.gameweek))].sort((a, b) => a - b);
  console.log(`📅 Gameweeks: ${gameweeks[0]}-${gameweeks[gameweeks.length - 1]}`);
  console.log('');

  // Position breakdown
  const byPosition = {};
  trainingData.forEach(r => {
    if (!byPosition[r.position]) byPosition[r.position] = 0;
    byPosition[r.position]++;
  });

  console.log('📊 Position breakdown:');
  Object.entries(byPosition).forEach(([pos, count]) => {
    console.log(`  ${pos}: ${count} samples`);
  });

  // Run grid search
  const optimalMultipliers = gridSearch(trainingData);

  console.log('\n💡 Recommendation:');
  console.log('  If sample size is <500, keep current V3 multipliers');
  console.log('  If sample size is >500, test the best multipliers found above');
  console.log('');
}

// Run optimization
if (require.main === module) {
  try {
    optimizeV3();
    process.exit(0);
  } catch (error) {
    console.error('❌ Optimization failed:', error);
    process.exit(1);
  }
}

module.exports = { optimizeV3 };
