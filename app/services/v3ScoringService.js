// app/services/v3ScoringService.js
// V3 Sleeper Scoring System with simplified FPL→Sleeper conversion

/**
 * Position-based FPL to Sleeper conversion ratios
 * Based on scoring differences between FPL and custom Sleeper leagues
 */
const CONVERSION_RATIOS = {
  GKP: 0.90,  // GKP: Subtract appearance points, add save bonuses
  DEF: 1.15,  // DEF: Add defensive stat rewards (tackles, interceptions, blocks)
  MID: 1.05,  // MID: Add versatility bonus (goals, assists, defensive actions)
  FWD: 0.97   // FWD: Subtract dispossession penalties
};

/**
 * Calculate V3 Sleeper prediction from FFH FPL predictions
 * Uses position-based conversion ratios to estimate Sleeper league points
 */
export async function calculateV3Prediction(player, currentGameweek) {
  try {
    if (!currentGameweek?.number) {
      console.error('❌ V3 Scoring: No currentGameweek provided');
      throw new Error('currentGameweek is required for V3 scoring calculations');
    }

    const position = player.position || 'MID';
    const ratio = CONVERSION_RATIOS[position] || 1.0;

    // Use FFH FPL predictions as base
    const fplSeasonTotal = player.predicted_points || 0;
    const fplSeasonAvg = player.season_prediction_avg || 0;
    const fplCurrentGW = player.current_gw_prediction || 0;

    // Convert to Sleeper points using position ratio
    const v3SeasonTotal = fplSeasonTotal * ratio;
    const v3SeasonAvg = fplSeasonAvg * ratio;
    const v3CurrentGW = fplCurrentGW * ratio;

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

    return {
      v3_season_total: Math.round(v3SeasonTotal * 100) / 100,
      v3_season_avg: Math.round(v3SeasonAvg * 100) / 100,
      v3_current_gw: Math.round(v3CurrentGW * 100) / 100,
      v3_calculation_source: 'fpl_conversion',
      v3_confidence: confidence,
      v3_conversion_ratio: ratio
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
export async function applyV3Scoring(players, currentGameweek) {
  if (!Array.isArray(players)) {
    console.warn('applyV3Scoring: players is not an array');
    return players;
  }

  if (!currentGameweek?.number) {
    console.error('❌ applyV3Scoring: No currentGameweek provided');
    throw new Error('currentGameweek is required for V3 scoring');
  }

  console.log(`🚀 V3 Sleeper Scoring (FPL Conversion): Processing ${players.length} players for GW${currentGameweek.number}`);

  let playersWithPredictions = 0;
  let playersWithZeroPredictions = 0;

  // Process players in parallel - now lightweight since no external fetches
  const enhancedPlayers = await Promise.all(
    players.map(async (player) => {
      const v3Results = await calculateV3Prediction(player, currentGameweek);

      if (v3Results.v3_current_gw > 0) {
        playersWithPredictions++;
      } else {
        playersWithZeroPredictions++;
      }

      return {
        ...player,
        ...v3Results,
        v3_enhanced: true,
        v3_timestamp: new Date().toISOString()
      };
    })
  );

  console.log(`📊 V3 Sleeper Summary: ${playersWithPredictions} with predictions, ${playersWithZeroPredictions} with 0/no predictions`);

  return enhancedPlayers;
}

/**
 * Get the appropriate scoring values based on mode
 */
export function getScoringValue(player, field, scoringMode = 'ffh') {
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

  // Pure FFH data for standard mode - NO FALLBACKS
  switch (field) {
    case 'season_total':
      // Sum all predictions[].predicted_pts for ROS Points
      if (player.predictions && Array.isArray(player.predictions)) {
        return player.predictions.reduce((sum, pred) => sum + (pred.predicted_pts || 0), 0);
      }
      return 0;
    case 'season_avg':
      // Direct FFH season_prediction_avg for PPG Predicted
      return player.season_prediction_avg || 0;
    case 'current_gw':
      return player.current_gw_prediction || 0;
    case 'points_ros':
      // Same as season_total - sum all predictions
      if (player.predictions && Array.isArray(player.predictions)) {
        return player.predictions.reduce((sum, pred) => sum + (pred.predicted_pts || 0), 0);
      }
      return 0;
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