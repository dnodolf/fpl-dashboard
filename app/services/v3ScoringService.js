// app/services/v3ScoringService.js
// V3 Predictive Scoring System with enhanced algorithms

/**
 * V3 Enhanced FPL Scoring System with predictive adjustments
 */
const V3_FPL_SCORING_SYSTEM = {
  goals: { GKP: 7, DEF: 7, MID: 6, FWD: 5 }, // Increased slightly for v3
  assists: { GKP: 4, DEF: 4, MID: 4, FWD: 4 }, // Increased for v3
  clean_sheets: { GKP: 5, DEF: 5, MID: 2, FWD: 0 }, // Enhanced clean sheet value
  goals_conceded: { GKP: -0.8, DEF: -0.8, MID: 0, FWD: 0 }, // Slightly less harsh
  yellow_cards: { GKP: -0.8, DEF: -0.8, MID: -0.8, FWD: -0.8 }, // Less harsh
  red_cards: { GKP: -2.5, DEF: -2.5, MID: -2.5, FWD: -2.5 }, // Less harsh
  own_goals: { GKP: -1.5, DEF: -1.5, MID: -1.5, FWD: -1.5 }, // Less harsh
  penalty_missed: { GKP: -1.5, DEF: -1.5, MID: -1.5, FWD: -1.5 }, // Less harsh
  penalty_saved: { GKP: 6, DEF: 0, MID: 0, FWD: 0 }, // Enhanced for GK
  saves: { GKP: 1.2, DEF: 0, MID: 0, FWD: 0 }, // Enhanced save value
  bonus: { GKP: 1.2, DEF: 1.2, MID: 1.2, FWD: 1.2 }, // Enhanced bonus
  minutes: { GKP: 1.1, DEF: 1.1, MID: 1.1, FWD: 1.1 } // Enhanced appearance points
};

/**
 * V3 Enhanced conversion multipliers with predictive algorithms
 */
const V3_POSITION_MULTIPLIERS = {
  'GKP': 1.25, // Enhanced for goalkeepers
  'DEF': 1.15, // Enhanced for defenders
  'MID': 1.10, // Enhanced for midfielders
  'FWD': 1.05  // Slightly enhanced for forwards
};

/**
 * V3 form-based adjustment factors
 */
const V3_FORM_ADJUSTMENTS = {
  excellent: 1.20, // 20% bonus for excellent form
  good: 1.10,      // 10% bonus for good form
  average: 1.00,   // No adjustment
  poor: 0.90,      // 10% penalty for poor form
  terrible: 0.80   // 20% penalty for terrible form
};

/**
 * Calculate form-based multiplier from recent performances
 */
function calculateFormMultiplier(player) {
  // Analyze recent gameweek predictions or points to determine form
  let formScore = 1.0;
  
  try {
    // Check if player has recent gameweek predictions
    if (player.sleeper_gw_predictions) {
      const gwPreds = JSON.parse(player.sleeper_gw_predictions);
      const recentPreds = Object.values(gwPreds).slice(-5); // Last 5 gameweeks
      
      if (recentPreds.length >= 3) {
        const avgRecent = recentPreds.reduce((a, b) => a + b, 0) / recentPreds.length;
        const seasonAvg = player.sleeper_season_avg || player.ffh_season_avg || 0;
        
        if (seasonAvg > 0) {
          const formRatio = avgRecent / seasonAvg;
          
          if (formRatio >= 1.3) formScore = V3_FORM_ADJUSTMENTS.excellent;
          else if (formRatio >= 1.1) formScore = V3_FORM_ADJUSTMENTS.good;
          else if (formRatio >= 0.9) formScore = V3_FORM_ADJUSTMENTS.average;
          else if (formRatio >= 0.7) formScore = V3_FORM_ADJUSTMENTS.poor;
          else formScore = V3_FORM_ADJUSTMENTS.terrible;
        }
      }
    }
  } catch (error) {
    console.warn('Form calculation error for', player.name, error);
  }
  
  return formScore;
}

/**
 * Calculate fixture difficulty adjustment
 */
function calculateFixtureMultiplier(player, currentGameweek) {
  // Simple fixture difficulty - could be enhanced with actual fixture data
  let fixtureScore = 1.0;
  
  // For now, use a basic team strength adjustment
  const strongTeams = ['MCI', 'ARS', 'LIV', 'CHE', 'MUN', 'TOT'];
  const weakTeams = ['BUR', 'SUN', 'LEE', 'NFO', 'BOU'];
  
  const playerTeam = player.team_abbr || player.team;
  
  if (strongTeams.includes(playerTeam)) {
    fixtureScore = 1.05; // 5% bonus for strong teams
  } else if (weakTeams.includes(playerTeam)) {
    fixtureScore = 0.95; // 5% penalty for weak teams
  }
  
  return fixtureScore;
}

/**
 * Calculate minutes weighting factor based on predicted playing time
 */
function calculateMinutesWeight(predictedMinutes) {
  if (!predictedMinutes || predictedMinutes <= 0) return 0;

  // Heavy penalty for low minutes
  if (predictedMinutes < 30) return 0.1;  // 10% value for very low minutes
  if (predictedMinutes < 45) return 0.4;  // 40% value for low minutes
  if (predictedMinutes < 60) return 0.7;  // 70% value for moderate minutes
  if (predictedMinutes < 75) return 0.9;  // 90% value for decent minutes

  return 1.0; // Full value for 75+ minutes
}

/**
 * Enhanced V3 prediction calculation with minutes weighting and gameweek summation
 */
export function calculateV3Prediction(player, currentGameweek) {
  try {
    if (!currentGameweek?.number) {
      console.error('❌ V3 Scoring: No currentGameweek provided');
      throw new Error('currentGameweek is required for V3 scoring calculations');
    }

    const currentGW = currentGameweek.number;
    const position = player.position || 'MID';
    const positionMultiplier = V3_POSITION_MULTIPLIERS[position.toUpperCase()] || 1.0;

    // Calculate form and fixture multipliers
    const formMultiplier = calculateFormMultiplier(player);
    const fixtureMultiplier = calculateFixtureMultiplier(player, currentGameweek);
    const totalMultiplier = positionMultiplier * formMultiplier * fixtureMultiplier;

    // Method 1: Use individual gameweek predictions if available
    if (player.predictions && Array.isArray(player.predictions)) {
      const gwPredictions = player.predictions.filter(p => p.gw && p.predicted_pts !== undefined);

      if (gwPredictions.length >= 10) { // Need substantial prediction data
        let totalV3Points = 0;
        let currentGwV3 = 0;
        let validPredictions = 0;

        for (const gwPred of gwPredictions) {
          const basePoints = gwPred.predicted_pts || 0;
          const minutesWeight = calculateMinutesWeight(gwPred.predicted_mins);

          // Apply minutes weighting and v3 multipliers
          const v3Points = basePoints * minutesWeight * totalMultiplier;
          totalV3Points += v3Points;
          validPredictions++;

          // Track current gameweek specifically
          if (gwPred.gw === currentGW) {
            currentGwV3 = v3Points;
          }
        }

        // Extrapolate to full season based on actual predictions
        const avgPerValidGW = totalV3Points / validPredictions;
        const estimatedSeasonTotal = avgPerValidGW * 38;

        return {
          v3_season_total: Math.round(estimatedSeasonTotal * 100) / 100,
          v3_season_avg: Math.round(avgPerValidGW * 100) / 100,
          v3_current_gw: Math.round(currentGwV3 * 100) / 100,
          v3_adjustments: {
            position: positionMultiplier,
            form: formMultiplier,
            fixture: fixtureMultiplier,
            total: totalMultiplier,
            minutes_weight: 'gameweek_specific'
          },
          v3_calculation_source: 'gameweek_summation',
          v3_confidence: validPredictions >= 15 ? 'high' : 'medium'
        };
      }
    }

    // Method 2: Use FFH gameweek predictions if available
    if (player.ffh_gw_predictions) {
      try {
        const ffhGwPreds = JSON.parse(player.ffh_gw_predictions);
        const gwKeys = Object.keys(ffhGwPreds).filter(gw => ffhGwPreds[gw] > 0);

        if (gwKeys.length >= 10) {
          let totalV3Points = 0;
          let currentGwV3 = 0;

          for (const gw of gwKeys) {
            const basePoints = ffhGwPreds[gw];
            // Get corresponding minutes if available
            const minutesKey = `${gw}_mins`;
            const predictedMinutes = player.ffh_gw_minutes?.[minutesKey] || 70; // Default 70 mins
            const minutesWeight = calculateMinutesWeight(predictedMinutes);

            const v3Points = basePoints * minutesWeight * totalMultiplier;
            totalV3Points += v3Points;

            if (parseInt(gw) === currentGW) {
              currentGwV3 = v3Points;
            }
          }

          const avgPerValidGW = totalV3Points / gwKeys.length;
          const estimatedSeasonTotal = avgPerValidGW * 38;

          return {
            v3_season_total: Math.round(estimatedSeasonTotal * 100) / 100,
            v3_season_avg: Math.round(avgPerValidGW * 100) / 100,
            v3_current_gw: Math.round(currentGwV3 * 100) / 100,
            v3_adjustments: {
              position: positionMultiplier,
              form: formMultiplier,
              fixture: fixtureMultiplier,
              total: totalMultiplier,
              minutes_weight: 'estimated_default'
            },
            v3_calculation_source: 'ffh_gameweek_summation',
            v3_confidence: 'medium'
          };
        }
      } catch (error) {
        console.warn('Error parsing FFH GW predictions for', player.name, error);
      }
    }

    // Method 3: Current gameweek prediction with minutes weighting (fallback)
    const currentGwPrediction = player.predictions?.find(p => p.gw === currentGW);
    const directCurrentPrediction = player.current_gw_prediction || 0;

    if (currentGwPrediction || directCurrentPrediction > 0) {
      const basePoints = currentGwPrediction?.predicted_pts || directCurrentPrediction;
      const predictedMinutes = currentGwPrediction?.predicted_mins || 70;
      const minutesWeight = calculateMinutesWeight(predictedMinutes);

      if (basePoints === 0 || minutesWeight === 0) {
        return {
          v3_season_total: 0,
          v3_season_avg: 0,
          v3_current_gw: 0,
          v3_adjustments: { position: 1.0, form: 1.0, fixture: 1.0, total: 1.0 },
          v3_confidence: 'low'
        };
      }

      const v3CurrentGw = basePoints * minutesWeight * totalMultiplier;
      const estimatedSeasonTotal = v3CurrentGw * 38; // Only as last resort

      return {
        v3_season_total: Math.round(estimatedSeasonTotal * 100) / 100,
        v3_season_avg: Math.round(v3CurrentGw * 100) / 100,
        v3_current_gw: Math.round(v3CurrentGw * 100) / 100,
        v3_adjustments: {
          position: positionMultiplier,
          form: formMultiplier,
          fixture: fixtureMultiplier,
          total: totalMultiplier,
          minutes_weight: minutesWeight
        },
        v3_calculation_source: 'current_gw_extrapolation',
        v3_confidence: 'low'
      };
    }

    // Method 4: Complete fallback - return zeros
    return {
      v3_season_total: 0,
      v3_season_avg: 0,
      v3_current_gw: 0,
      v3_adjustments: {
        position: 1.0,
        form: 1.0,
        fixture: 1.0,
        total: 1.0
      },
      v3_calculation_source: 'no_data',
      v3_confidence: 'none'
    };

  } catch (error) {
    console.error('V3 calculation error for', player.name, error);
    return {
      v3_season_total: 0,
      v3_season_avg: 0,
      v3_current_gw: 0,
      v3_adjustments: { position: 1.0, form: 1.0, fixture: 1.0 },
      v3_calculation_error: error.message
    };
  }
}

/**
 * Apply V3 scoring to all players
 */
export function applyV3Scoring(players, currentGameweek) {
  if (!Array.isArray(players)) {
    console.warn('applyV3Scoring: players is not an array');
    return players;
  }
  
  if (!currentGameweek?.number) {
    console.error('❌ applyV3Scoring: No currentGameweek provided');
    throw new Error('currentGameweek is required for V3 scoring');
  }
  
  console.log(`🚀 V3 Scoring: ${players.length} players for GW${currentGameweek.number}`);
  
  let playersWithPredictions = 0;
  let playersWithZeroPredictions = 0;
  
  const enhancedPlayers = players.map(player => {
    const v3Results = calculateV3Prediction(player, currentGameweek);
    
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
  });
  
  console.log(`📊 V3 Summary: ${playersWithPredictions} players with predictions, ${playersWithZeroPredictions} with 0/no predictions`);
  
  return enhancedPlayers;
}

/**
 * Get the appropriate scoring values based on mode
 */
export function getScoringValue(player, field, scoringMode = 'existing') {
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
  getScoringValue,
  V3_POSITION_MULTIPLIERS,
  V3_FORM_ADJUSTMENTS
};

export default v3ScoringService;