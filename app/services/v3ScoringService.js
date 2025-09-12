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
 * Enhanced V3 prediction calculation
 */
export function calculateV3Prediction(player, currentGameweek) {
  try {
    // Get base prediction from existing scoring
    const basePrediction = player.sleeper_season_total || 
                          player.ffh_season_prediction || 
                          player.predicted_points || 
                          (player.current_gw_prediction ? player.current_gw_prediction * 38 : 0) || // Estimate season from gameweek
                          0;
    
    // Debug logging for Bruno Fernandes specifically
    if ((player.name && player.name.includes('Bruno')) || (player.web_name && player.web_name.includes('Bruno'))) {
      console.log(`🔍 V3 Debug for ${player.name || player.web_name}:`, {
        basePrediction,
        sleeper_season_total: player.sleeper_season_total,
        predicted_points: player.predicted_points,
        current_gw_prediction: player.current_gw_prediction,
        calculatedBasePrediction: player.current_gw_prediction ? player.current_gw_prediction * 38 : 0
      });
    }
    
    if (basePrediction === 0) {
      return {
        v3_season_total: 0,
        v3_season_avg: 0,
        v3_current_gw: 0,
        v3_adjustments: {
          position: 1.0,
          form: 1.0,
          fixture: 1.0
        }
      };
    }
    
    // Apply V3 position multiplier
    const position = player.position || 'MID';
    const positionMultiplier = V3_POSITION_MULTIPLIERS[position.toUpperCase()] || 1.0;
    
    // Calculate form-based adjustment
    const formMultiplier = calculateFormMultiplier(player);
    
    // Calculate fixture-based adjustment
    const fixtureMultiplier = calculateFixtureMultiplier(player, currentGameweek);
    
    // Apply all multipliers
    const totalMultiplier = positionMultiplier * formMultiplier * fixtureMultiplier;
    const v3SeasonTotal = Math.round(basePrediction * totalMultiplier * 100) / 100;
    const v3SeasonAvg = Math.round((v3SeasonTotal / 38) * 100) / 100;
    
    // Calculate current gameweek prediction
    let v3CurrentGw = v3SeasonAvg;
    
    // Try to get specific gameweek prediction if available
    try {
      if (player.sleeper_gw_predictions) {
        const gwPreds = JSON.parse(player.sleeper_gw_predictions);
        const baseGwPred = gwPreds[currentGameweek] || v3SeasonAvg;
        v3CurrentGw = Math.round(baseGwPred * totalMultiplier * 100) / 100;
      }
    } catch (e) {
      // Use season average if gameweek prediction fails
    }
    
    const result = {
      v3_season_total: v3SeasonTotal,
      v3_season_avg: v3SeasonAvg,
      v3_current_gw: v3CurrentGw,
      v3_adjustments: {
        position: positionMultiplier,
        form: formMultiplier,
        fixture: fixtureMultiplier,
        total: totalMultiplier
      },
      v3_calculation_source: 'enhanced'
    };
    
    // Debug logging for Bruno Fernandes specifically
    if ((player.name && player.name.includes('Bruno')) || (player.web_name && player.web_name.includes('Bruno'))) {
      console.log(`🔍 V3 Result for ${player.name || player.web_name}:`, result);
    }
    
    return result;
  } catch (error) {
    console.error('V3 calculation error for', player.name, error);
    return {
      v3_season_total: 0,
      v3_season_avg: 0,
      v3_current_gw: 0,
      v3_adjustments: {
        position: 1.0,
        form: 1.0,
        fixture: 1.0
      },
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
  
  console.log(`🚀 Applying V3 scoring to ${players.length} players for GW${currentGameweek}`);
  
  return players.map(player => {
    const v3Results = calculateV3Prediction(player, currentGameweek);
    
    return {
      ...player,
      ...v3Results,
      v3_enhanced: true,
      v3_timestamp: new Date().toISOString()
    };
  });
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
  
  // Default to existing scoring
  switch (field) {
    case 'season_total':
      return player.sleeper_season_total || player.predicted_points || 0;
    case 'season_avg':
      return player.sleeper_season_avg || 0;
    case 'current_gw':
      return player.current_gw_prediction || 0;
    case 'points_ros':
      return player.sleeper_season_total || player.predicted_points || 0;
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