/**
 * V3 Sleeper Scoring - Core Module
 * Main exported functions for V3 scoring calculations
 */

import { getPlayerArchetype } from '../playerArchetypeService.js';
import { FALLBACK_CONVERSION_RATIOS, getCalibrationAwareRatio } from './conversionRatios.js';
import {
  applyPlayingTimeAdjustment,
  calculateFormMomentum,
  calculateFixtureRunQuality,
  calculateInjuryReturnAdjustment
} from './adjustments.js';
import {
  extractCurrentGameweekMatchup,
  calculateStartRecommendation,
  calculateSingleGameweekMatchup
} from './matchup.js';

/**
 * Calculate V3 Sleeper prediction from FFH FPL predictions
 * Uses archetype-based conversion ratios to estimate Sleeper league points
 *
 * Enhancement Pipeline (6 steps):
 * 1. Archetype-based conversion ratio (player style)
 * 2. Form momentum (last 3 GWs vs season avg)
 * 3. Fixture run quality (next 6 GWs vs season avg)
 * 4. Injury return adjustment (graduated recovery)
 * 5. Playing time confidence (rotation risk)
 * 6. Final V3 prediction
 */
export async function calculateV3Prediction(player, currentGameweek, calibrationData = null) {
  try {
    if (!currentGameweek?.number) {
      console.error('❌ V3 Scoring: No currentGameweek provided');
      throw new Error('currentGameweek is required for V3 scoring calculations');
    }

    const position = player.position || 'MID';

    // Use calibration-aware ratio: per-player > calibrated position > hardcoded
    // Falls back to archetype ratio if no calibration data available
    const archetypeInfo = getPlayerArchetype(player);
    const ratio = calibrationData
      ? getCalibrationAwareRatio(position, player.sleeper_id, calibrationData)
      : archetypeInfo.ratio;

    // Use FFH FPL predictions as base
    const fplSeasonTotal = player.predicted_points || 0;
    const fplSeasonAvg = player.season_prediction_avg || 0;
    const fplCurrentGW = player.current_gw_prediction || 0;

    // Convert to Sleeper points using ratio
    const v3SeasonTotal = fplSeasonTotal * ratio;
    const v3SeasonAvg = fplSeasonAvg * ratio;

    // For current GW: blend with FPL's official ep_next model if available
    // Two independent models blended typically outperform either alone
    let v3CurrentGW = fplCurrentGW * ratio;
    if (player.ep_next && player.ep_next > 0 && fplCurrentGW > 0) {
      const ep_next_v3 = player.ep_next * ratio;
      v3CurrentGW = v3CurrentGW * 0.65 + ep_next_v3 * 0.35;
    }

    // Embed v3_pts on each prediction entry so client-side utilities can use
    // calibrated values without needing access to calibration data
    const predictionsWithV3 = player.predictions?.map(pred => ({
      ...pred,
      v3_pts: (pred.predicted_pts || 0) * ratio
    })) || player.predictions;

    // Determine confidence based on FFH data availability
    let confidence = 'none';
    if (fplSeasonTotal > 0) {
      if (player.predictions && player.predictions.length >= 15) {
        confidence = 'high';
      } else if (player.predictions && player.predictions.length >= 10) {
        confidence = 'medium';
      } else {
        confidence = 'low';
      }
    }

    // Get player name for logging (define early to avoid ReferenceError)
    const playerName = player.name || player.full_name || 'Unknown';

    // Step 7: Extract THIS WEEK's matchup data for start/sit decisions
    let thisWeekMatchup;
    try {
      thisWeekMatchup = calculateSingleGameweekMatchup(player, currentGameweek.number);
    } catch (matchupError) {
      console.error(`⚠️ Matchup calculation failed for ${playerName}:`, matchupError.message);
      thisWeekMatchup = {
        quality: 'unknown',
        label: '❓ Unknown',
        color: 'text-gray-500',
        description: 'Matchup calculation error',
        opponent: 'TBD',
        opponentFull: 'TBD',
        difficulty: 3,
        adjustedDifficulty: 3,
        isHome: true,
        predicted_points: 0,
        predicted_minutes: 0,
        source: 'error'
      };
    }

    // Step 8: Calculate START/BENCH recommendation based on V3 current GW prediction
    let startRec;
    try {
      startRec = calculateStartRecommendation(v3CurrentGW, position);
    } catch (startRecError) {
      console.error(`⚠️ Start recommendation failed for ${playerName}:`, startRecError.message);
      startRec = {
        recommendation: 'UNKNOWN',
        label: '❓ N/A',
        color: 'text-gray-500',
        confidence: 'none',
        description: 'Recommendation calculation error'
      };
    }

    return {
      // Updated predictions array with v3_pts embedded per GW
      predictions: predictionsWithV3,
      v3_season_total: Math.round(v3SeasonTotal * 100) / 100,
      v3_season_avg: Math.round(v3SeasonAvg * 100) / 100,
      v3_current_gw: Math.round(v3CurrentGW * 100) / 100,
      v3_calculation_source: calibrationData?.calibrated ? 'calibrated_sleeper_data' : 'fpl_simple_ratio_conversion',
      v3_confidence: confidence,
      v3_conversion_ratio: ratio,
      v3_calibrated: calibrationData?.calibrated || false,
      v3_calibration_source: calibrationData?.source || 'none',
      v3_archetype: archetypeInfo.archetype,
      v3_archetype_source: archetypeInfo.source,
      // THIS WEEK matchup data for start/sit decisions
      v3_this_week_opponent: thisWeekMatchup?.opponent || 'TBD',
      v3_this_week_opponent_full: thisWeekMatchup?.opponentFull || 'TBD',
      v3_this_week_difficulty: thisWeekMatchup?.difficulty || 3,
      v3_this_week_is_home: thisWeekMatchup?.isHome !== undefined ? thisWeekMatchup.isHome : true,
      v3_this_week_matchup_quality: thisWeekMatchup?.quality || 'unknown',
      v3_this_week_matchup_label: thisWeekMatchup?.label || '❓ Unknown',
      v3_this_week_matchup_color: thisWeekMatchup?.color || 'text-gray-500',
      v3_this_week_matchup_description: thisWeekMatchup?.description || 'No matchup data',
      // START/BENCH recommendation
      v3_start_recommendation: startRec?.recommendation || 'UNKNOWN',
      v3_start_label: startRec?.label || '❓ N/A',
      v3_start_color: startRec?.color || 'text-gray-500',
      v3_start_confidence: startRec?.confidence || 'none',
      v3_start_description: startRec?.description || 'No recommendation'
    };

  } catch (error) {
    console.error('V3 calculation error for', player.name, error);
    return {
      v3_season_total: 0,
      v3_season_avg: 0,
      v3_current_gw: 0,
      v3_calculation_source: 'error',
      v3_calculation_error: error.message,
      v3_confidence: 'none'
    };
  }
}

/**
 * Apply V3 scoring to all players
 */
export async function applyV3Scoring(players, currentGameweek, calibrationData = null) {
  if (!Array.isArray(players)) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('applyV3Scoring: players is not an array');
    }
    return players;
  }

  if (!currentGameweek?.number) {
    console.error('❌ applyV3Scoring: No currentGameweek provided');
    throw new Error('currentGameweek is required for V3 scoring');
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`🚀 V3 Sleeper Scoring (Full Pipeline): Processing ${players.length} players for GW${currentGameweek.number}`);
  }

  let playersWithPredictions = 0;
  let playersWithZeroPredictions = 0;
  let playersWithArchetype = 0;
  let playersWithMinutesAdjustment = 0;
  let playersWithFormBoost = 0;
  let playersWithFormPenalty = 0;
  let playersWithFavorableFixtures = 0;
  let playersWithDifficultFixtures = 0;
  let playersReturningFromInjury = 0;
  let playersCurrentlyInjured = 0;

  // Process players in parallel - now lightweight since no external fetches
  const enhancedPlayers = await Promise.all(
    players.map(async (player) => {
      const v3Results = await calculateV3Prediction(player, currentGameweek, calibrationData);

      if (v3Results.v3_current_gw > 0) {
        playersWithPredictions++;
      } else {
        playersWithZeroPredictions++;
      }

      if (v3Results.v3_archetype_source === 'archetype_mapping') {
        playersWithArchetype++;
      }

      if (v3Results.v3_minutes_adjustment && v3Results.v3_minutes_adjustment < 1.0) {
        playersWithMinutesAdjustment++;
      }

      if (v3Results.v3_form_multiplier && v3Results.v3_form_multiplier > 1.05) {
        playersWithFormBoost++;
      } else if (v3Results.v3_form_multiplier && v3Results.v3_form_multiplier < 0.95) {
        playersWithFormPenalty++;
      }

      if (v3Results.v3_fixture_rating === 'favorable') {
        playersWithFavorableFixtures++;
      } else if (v3Results.v3_fixture_rating === 'difficult') {
        playersWithDifficultFixtures++;
      }

      if (v3Results.v3_injury_status === 'returning') {
        playersReturningFromInjury++;
      } else if (v3Results.v3_injury_status === 'injured') {
        playersCurrentlyInjured++;
      }

      return {
        ...player,
        ...v3Results,
        v3_enhanced: true,
        v3_timestamp: new Date().toISOString()
      };
    })
  );

  if (process.env.NODE_ENV === 'development') {
    console.log(`📊 V3 Sleeper Summary: ${playersWithPredictions} with predictions, ${playersWithZeroPredictions} with 0/no predictions`);
    console.log(`🎯 Archetypes: ${playersWithArchetype} players with style-specific ratios`);
    console.log(`⏱️ Playing time: ${playersWithMinutesAdjustment} players adjusted`);
    console.log(`🔥 Form: ${playersWithFormBoost} hot, ${playersWithFormPenalty} cold`);
    console.log(`📅 Fixtures: ${playersWithFavorableFixtures} favorable, ${playersWithDifficultFixtures} difficult`);
    console.log(`🏥 Injury: ${playersReturningFromInjury} returning, ${playersCurrentlyInjured} currently out`);
  }

  return enhancedPlayers;
}

/**
 * Get the appropriate scoring values based on mode
 */
export function getScoringValue(player, field, scoringMode = 'ffh') {
  // V4 Ensemble mode - ML-enhanced predictions
  if (scoringMode === 'v4') {
    switch (field) {
      case 'season_total':
        return player.v4_season_total || player.v3_season_total || player.sleeper_season_total || player.predicted_points || 0;
      case 'season_avg':
        return player.v4_season_avg || player.v3_season_avg || player.sleeper_season_avg || 0;
      case 'current_gw':
        return player.v4_current_gw || player.v3_current_gw || player.current_gw_prediction || 0;
      case 'points_ros':
        return player.v4_season_total || player.v3_season_total || player.sleeper_season_total || player.predicted_points || 0;
      default:
        return player[field] || 0;
    }
  }

  // V3 Sleeper mode - Position-based conversion
  if (scoringMode === 'v3') {
    switch (field) {
      case 'season_total':
        return player.v3_season_total || player.sleeper_season_total || player.predicted_points || 0;
      case 'season_avg':
        return player.v3_season_avg || player.sleeper_season_avg || 0;
      case 'current_gw':
        return player.v3_current_gw || player.current_gw_prediction || 0;
      case 'points_ros':
        return player.v3_season_total || player.sleeper_season_total || player.predicted_points || 0;
      default:
        return player[field] || 0;
    }
  }

  // Pure FFH data for standard mode - use pre-calculated fields
  switch (field) {
    case 'season_total':
    case 'points_ros':
      // Use pre-calculated predicted_points field
      return player.predicted_points || 0;
    case 'season_avg':
      // Direct FFH season_prediction_avg for PPG Predicted
      return player.season_prediction_avg || 0;
    case 'current_gw':
      return player.current_gw_prediction || 0;
    default:
      return player[field] || 0;
  }
}

// Default export for compatibility
const v3ScoringService = {
  calculateV3Prediction,
  applyV3Scoring,
  getScoringValue
};

export default v3ScoringService;
