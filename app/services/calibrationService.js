// app/services/calibrationService.js
// Computes dynamic FPL→Sleeper conversion ratios from actual historical data.
//
// How it works:
// - For each past GW, FFH `results` entries contain actual FPL points scored.
// - Sleeper matchup data contains actual Sleeper points scored for the same GW.
// - Dividing sleeper_actual / fpl_actual gives the true conversion ratio for that player-GW.
// - Aggregating these ratios per position (with outlier trimming) gives calibrated multipliers.
// - Per-player factors are computed for players with enough data and blended toward position average.

import { V3_CONVERSION_RATIOS } from './v3/conversionRatios.js';

const MIN_TOTAL_SAMPLES = 10;  // Need at least 10 data points to calibrate at all
const MIN_PLAYER_SAMPLES = 5;  // Per-player factor requires 5+ valid GW pairs

/**
 * Compute calibrated conversion ratios from historical Sleeper vs FFH data.
 *
 * @param {Object|null} matchupData - Output from fetchSleeperMatchupHistory()
 * @param {Array} players - Enhanced player objects (must have .predictions with source:'results')
 * @returns {Object} calibrationData
 */
export function computeCalibration(matchupData, players) {
  if (!matchupData?.history) {
    return buildFallback('no_matchup_data');
  }

  const { history } = matchupData;
  const positionSamples = { GKP: [], DEF: [], MID: [], FWD: [] };
  const playerSamples = {}; // { sleeperId: { samples: [ratio...], position } }

  for (const player of players) {
    if (!player.ffh_matched || !player.sleeper_id) continue;

    const position = player.position;
    if (!positionSamples[position]) continue;

    const sleeperHistory = history[player.sleeper_id];
    if (!sleeperHistory) continue;

    // Extract FFH actual results for past GWs.
    // Prefer dedicated ffh_gw_results field (processed, source='results' guaranteed).
    // Fall back to filtering predictions array for backward compatibility.
    const fplActualByGW = {};
    const resultsArray = player.ffh_gw_results ||
      (player.predictions && player.predictions.filter(p => p.source === 'results')) ||
      [];
    resultsArray
      .filter(p => p.predicted_pts > 0)
      .forEach(p => { fplActualByGW[p.gw] = p.predicted_pts; });

    // Pair Sleeper actual with FPL actual for each GW
    for (const [gwStr, sleeperPts] of Object.entries(sleeperHistory)) {
      const gw = parseInt(gwStr);
      const fplPts = fplActualByGW[gw];

      // Skip: no FPL data, or either side is 0
      // Zero on either side usually means blank GW, injury, or benched with no mins
      if (!fplPts || fplPts <= 0 || sleeperPts <= 0) continue;

      const ratio = sleeperPts / fplPts;

      // Guard against extreme outliers (ratio > 6 or < 0.15 is statistically implausible)
      if (ratio < 0.15 || ratio > 6.0) continue;

      positionSamples[position].push(ratio);

      if (!playerSamples[player.sleeper_id]) {
        playerSamples[player.sleeper_id] = { samples: [], position };
      }
      playerSamples[player.sleeper_id].samples.push(ratio);
    }
  }

  const totalSamples = Object.values(positionSamples).reduce((s, a) => s + a.length, 0);

  if (process.env.NODE_ENV === 'development') {
    const playersChecked = players.filter(p => p.ffh_matched && p.sleeper_id).length;
    const playersWithSleeperHistory = players.filter(p => p.ffh_matched && p.sleeper_id && history[p.sleeper_id]).length;
    const playersWithResults = players.filter(p => (p.ffh_gw_results?.length > 0) ||
      (p.predictions?.some(r => r.source === 'results'))).length;
    console.log(`🔍 Calibration debug: ${playersChecked} matched players, ${playersWithSleeperHistory} with Sleeper history, ${playersWithResults} with FFH results, ${totalSamples} paired samples`);
    if (totalSamples === 0 && playersWithSleeperHistory > 0 && playersWithResults === 0) {
      console.warn('⚠️  Calibration: Sleeper data found but no FFH results data — check ffh_gw_results population');
    }
    if (totalSamples === 0 && playersWithSleeperHistory === 0) {
      console.warn('⚠️  Calibration: No Sleeper history found — check matchup API response or sleeper_id matching');
    }
  }

  if (totalSamples < MIN_TOTAL_SAMPLES) {
    return buildFallback('insufficient_data', totalSamples, matchupData.gwsLoaded);
  }

  // Compute position ratios using trimmed mean (10% trim each side removes outliers)
  const positionRatios = {};
  const positionSampleCounts = {};

  for (const [pos, ratios] of Object.entries(positionSamples)) {
    positionSampleCounts[pos] = ratios.length;

    if (ratios.length < 3) {
      // Not enough data for this position — use hardcoded fallback
      positionRatios[pos] = V3_CONVERSION_RATIOS[pos];
      continue;
    }

    const sorted = [...ratios].sort((a, b) => a - b);
    const trimN = Math.floor(sorted.length * 0.1);
    const trimmed = trimN > 0 ? sorted.slice(trimN, sorted.length - trimN) : sorted;
    const mean = trimmed.reduce((s, r) => s + r, 0) / trimmed.length;

    positionRatios[pos] = Math.round(mean * 1000) / 1000;
  }

  // Compute per-player correction factors (blended toward position average)
  const playerFactors = {};

  for (const [sleeperId, { samples, position }] of Object.entries(playerSamples)) {
    if (samples.length < MIN_PLAYER_SAMPLES) continue;

    const playerMean = samples.reduce((s, r) => s + r, 0) / samples.length;
    const posRatio = positionRatios[position] ?? V3_CONVERSION_RATIOS[position] ?? 1.0;

    // Confidence blend: at 15+ samples we fully trust player mean;
    // fewer samples = more regression toward position average
    const confidence = Math.min(samples.length / 15, 1.0);
    const blended = playerMean * confidence + posRatio * (1 - confidence);

    playerFactors[sleeperId] = Math.round(blended * 1000) / 1000;
  }

  const confidence = totalSamples >= 50 ? 'high' : totalSamples >= 20 ? 'medium' : 'low';

  if (process.env.NODE_ENV === 'development') {
    console.log(`🎯 Calibration complete: ${totalSamples} samples, confidence=${confidence}`);
    console.log(`📊 Calibrated position ratios:`, positionRatios);
    console.log(`   Hardcoded fallbacks:`, V3_CONVERSION_RATIOS);
    console.log(`👤 Per-player factors: ${Object.keys(playerFactors).length} players calibrated`);
    console.log(`📈 Sample counts by position:`, positionSampleCounts);
  }

  return {
    positionRatios,
    playerFactors,
    sampleCount: totalSamples,
    positionSampleCounts,
    gwsAnalyzed: matchupData.gwsLoaded,
    confidence,
    calibrated: true,
    source: 'sleeper_historical'
  };
}

function buildFallback(reason, sampleCount = 0, gwsAnalyzed = 0) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`⚠️ Calibration fallback (${reason}): using hardcoded V3 ratios`);
  }
  return {
    positionRatios: { ...V3_CONVERSION_RATIOS },
    playerFactors: {},
    sampleCount,
    positionSampleCounts: {},
    gwsAnalyzed,
    confidence: 'none',
    calibrated: false,
    source: 'hardcoded_fallback',
    fallbackReason: reason
  };
}
