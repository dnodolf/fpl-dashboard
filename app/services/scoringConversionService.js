// services/scoringConversionService.js
// Enhanced scoring conversion from FPL to Sleeper scoring systems
// Based on Derek's original Google Apps Script logic

/**
 * FPL Scoring System (what FFH predictions are based on)
 */
const FPL_SCORING_SYSTEM = {
  goals: { GK: 6, DEF: 6, MID: 5, FWD: 4 },
  assists: { GK: 3, DEF: 3, MID: 3, FWD: 3 },
  clean_sheets: { GK: 4, DEF: 4, MID: 1, FWD: 0 },
  goals_conceded: { GK: -1, DEF: -1, MID: 0, FWD: 0 }, // per 2 goals
  yellow_cards: { GK: -1, DEF: -1, MID: -1, FWD: -1 },
  red_cards: { GK: -3, DEF: -3, MID: -3, FWD: -3 },
  own_goals: { GK: -2, DEF: -2, MID: -2, FWD: -2 },
  penalty_missed: { GK: -2, DEF: -2, MID: -2, FWD: -2 },
  penalty_saved: { GK: 5, DEF: 0, MID: 0, FWD: 0 },
  saves: { GK: 1, DEF: 0, MID: 0, FWD: 0 }, // per 3 saves
  bonus: { GK: 1, DEF: 1, MID: 1, FWD: 1 }, // 1-3 points based on BPS
  minutes: { GK: 1, DEF: 1, MID: 1, FWD: 1 } // 1 point for 60+ mins, 2 for 1+ mins
};

/**
 * Fallback default Sleeper scoring settings based on Derek's league
 */
const DEFAULT_SLEEPER_SCORING = {
  // Forwards
  'pos_f_g': 4.0, 'pos_f_at': 3.0, 'pos_f_sot': 0.5, 'pos_f_kp': 0.25, 'pos_f_cos': 0.5, 'pos_f_acnc': 0.25,
  'pos_f_yc': -1.0, 'pos_f_rc': -3.0, 'pos_f_tkw': 0.25, 'pos_f_pks': 4.0, 'pos_f_aer': 0.25, 'pos_f_yc2': -2.0,
  'pos_f_sv': 2.0, 'pos_f_sm': 1.0, 'pos_f_pkm': -3.0, 'pos_f_dis': -0.25, 'pos_f_pkd': 2.0, 'pos_f_hcs': 1.0,
  'pos_f_int': 0.25, 'pos_f_og': -3.0, 'pos_f_bs': 0.25,
  
  // Midfielders
  'pos_m_g': 5.0, 'pos_m_at': 3.0, 'pos_m_sot': 0.25, 'pos_m_kp': 0.5, 'pos_m_cos': 0.25, 'pos_m_acnc': 0.25,
  'pos_m_yc': -1.0, 'pos_m_rc': -3.0, 'pos_m_tkw': 0.5, 'pos_m_pks': 5.0, 'pos_m_aer': 0.25, 'pos_m_yc2': -2.0,
  'pos_m_sv': 2.0, 'pos_m_sm': 1.0, 'pos_m_pkm': -3.0, 'pos_m_dis': -0.25, 'pos_m_pkd': 2.0, 'pos_m_hcs': 1.0,
  'pos_m_int': 0.5, 'pos_m_og': -3.0, 'pos_m_bs': 0.25,
  
  // Defenders
  'pos_d_g': 6.0, 'pos_d_at': 3.0, 'pos_d_sot': 0.25, 'pos_d_kp': 0.25, 'pos_d_cos': 0.25, 'pos_d_acnc': 0.25,
  'pos_d_yc': -1.0, 'pos_d_rc': -3.0, 'pos_d_tkw': 0.75, 'pos_d_pks': 6.0, 'pos_d_aer': 0.5, 'pos_d_yc2': -2.0,
  'pos_d_sv': 2.0, 'pos_d_sm': 1.0, 'pos_d_pkm': -3.0, 'pos_d_dis': -0.25, 'pos_d_pkd': 2.0, 'pos_d_hcs': 4.0,
  'pos_d_int': 0.75, 'pos_d_og': -3.0, 'pos_d_bs': 0.5, 'pos_d_gc': -1.0,
  
  // Goalkeepers
  'pos_gk_g': 8.0, 'pos_gk_at': 3.0, 'pos_gk_sot': 0.25, 'pos_gk_kp': 0.25, 'pos_gk_cos': 0.25, 'pos_gk_acnc': 0.25,
  'pos_gk_yc': -1.0, 'pos_gk_rc': -3.0, 'pos_gk_tkw': 0.25, 'pos_gk_pks': 8.0, 'pos_gk_aer': 0.25, 'pos_gk_yc2': -2.0,
  'pos_gk_sv': 2.0, 'pos_gk_sm': 1.0, 'pos_gk_pkm': -3.0, 'pos_gk_dis': -0.25, 'pos_gk_pkd': 6.0, 'pos_gk_hcs': 6.0,
  'pos_gk_int': 0.25, 'pos_gk_og': -3.0, 'pos_gk_bs': 0.25, 'pos_gk_gc': -1.0, 'pos_gk_psv': 6.0
};

// Cache for API responses
let cachedSleeperScoring = null;
let cachedConversionRatios = null;

/**
 * Fetch current Sleeper league scoring settings
 */
async function fetchSleeperScoringSettings() {
  if (cachedSleeperScoring) {
    return cachedSleeperScoring;
  }
  
  try {
    const leagueId = process.env.SLEEPER_LEAGUE_ID || '1240184286171107328';
    const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
    
    if (!response.ok) {
      console.warn('Sleeper API request failed, using default scoring');
      cachedSleeperScoring = DEFAULT_SLEEPER_SCORING;
      return cachedSleeperScoring;
    }
    
    const data = await response.json();
    cachedSleeperScoring = data.scoring_settings || DEFAULT_SLEEPER_SCORING;
    
    console.log('✅ Fetched live Sleeper scoring settings');
    return cachedSleeperScoring;
  } catch (error) {
    console.warn('Error fetching Sleeper scoring, using defaults:', error.message);
    cachedSleeperScoring = DEFAULT_SLEEPER_SCORING;
    return cachedSleeperScoring;
  }
}

/**
 * Calculate position-specific conversion ratios (FPL → Sleeper)
 */
async function calculateConversionRatios() {
  if (cachedConversionRatios) {
    return cachedConversionRatios;
  }
  
  const sleeperScoring = await fetchSleeperScoringSettings();
  const ratios = {};
  
  // Calculate conversion multipliers for each position
  ['GK', 'DEF', 'MID', 'FWD'].forEach(position => {
    const pos = position === 'GK' ? 'gk' : 
                position === 'DEF' ? 'd' : 
                position === 'MID' ? 'm' : 'f';
    
    const fplPrefix = position === 'DEF' ? 'D' : 
                     position === 'MID' ? 'M' : 
                     position === 'FWD' ? 'F' : 'GK';
    
    // Compare key scoring categories
    const goalWeight = 0.4;  // Goals are most important
    const assistWeight = 0.3; // Assists second most important
    const cleanSheetWeight = 0.2; // Clean sheets for defenders/GKs
    const cardWeight = 0.1;   // Cards less important
    
    // FPL values
    const fplGoals = FPL_SCORING_SYSTEM.goals[fplPrefix] || 0;
    const fplAssists = FPL_SCORING_SYSTEM.assists[fplPrefix] || 0;
    const fplCleanSheets = FPL_SCORING_SYSTEM.clean_sheets[fplPrefix] || 0;
    const fplYellowCards = FPL_SCORING_SYSTEM.yellow_cards[fplPrefix] || 0;
    
    // Sleeper values
    const sleeperGoals = sleeperScoring[`pos_${pos}_g`] || 0;
    const sleeperAssists = sleeperScoring[`pos_${pos}_at`] || 0;
    const sleeperCleanSheets = sleeperScoring[`pos_${pos}_hcs`] || 0;
    const sleeperYellowCards = sleeperScoring[`pos_${pos}_yc`] || 0;
    
    // Calculate weighted ratio
    let totalFpl = 0;
    let totalSleeper = 0;
    
    if (fplGoals && sleeperGoals) {
      totalFpl += Math.abs(fplGoals) * goalWeight;
      totalSleeper += Math.abs(sleeperGoals) * goalWeight;
    }
    
    if (fplAssists && sleeperAssists) {
      totalFpl += Math.abs(fplAssists) * assistWeight;
      totalSleeper += Math.abs(sleeperAssists) * assistWeight;
    }
    
    if (fplCleanSheets && sleeperCleanSheets) {
      totalFpl += Math.abs(fplCleanSheets) * cleanSheetWeight;
      totalSleeper += Math.abs(sleeperCleanSheets) * cleanSheetWeight;
    }
    
    if (fplYellowCards && sleeperYellowCards) {
      totalFpl += Math.abs(fplYellowCards) * cardWeight;
      totalSleeper += Math.abs(sleeperYellowCards) * cardWeight;
    }
    
    // Calculate final multiplier with position-specific adjustments
    let multiplier = totalSleeper > 0 ? totalSleeper / totalFpl : 1.0;
    
    // Apply Derek's original position-specific adjustments
    if (position === 'GK') multiplier *= 0.8;      // GKs less affected by scoring differences
    else if (position === 'DEF') multiplier *= 0.9; // Defenders moderately affected
    else if (position === 'MID') multiplier *= 1.0; // Midfielders baseline
    else if (position === 'FWD') multiplier *= 1.1; // Forwards most affected
    
    // Ensure reasonable bounds
    multiplier = Math.max(0.6, Math.min(1.5, multiplier));
    
    ratios[position] = {
      multiplier: Math.round(multiplier * 100) / 100,
      breakdown: {
        goals: sleeperGoals / fplGoals || 1,
        assists: sleeperAssists / fplAssists || 1,
        clean_sheets: sleeperCleanSheets / fplCleanSheets || 1,
        cards: Math.abs(sleeperYellowCards) / Math.abs(fplYellowCards) || 1
      }
    };
  });
  
  cachedConversionRatios = ratios;
  console.log('✅ Calculated conversion ratios:', ratios);
  return ratios;
}

/**
 * Convert FFH season prediction to Sleeper scoring
 */
async function convertFFHToSleeperPrediction(ffhPrediction, position) {
  if (!ffhPrediction || !position) {
    return ffhPrediction || 0;
  }
  
  const conversionRatios = await calculateConversionRatios();
  const positionRatio = conversionRatios[position.toUpperCase()];
  
  if (!positionRatio) {
    return ffhPrediction;
  }
  
  const convertedPrediction = ffhPrediction * positionRatio.multiplier;
  return Math.round(convertedPrediction * 100) / 100;
}

/**
 * Convert FFH gameweek predictions to Sleeper scoring
 */
async function convertFFHGWPredictionsToSleeper(ffhGwPredictions, position) {
  if (!ffhGwPredictions || !position) {
    return ffhGwPredictions || {};
  }
  
  const conversionRatios = await calculateConversionRatios();
  const positionRatio = conversionRatios[position.toUpperCase()];
  
  if (!positionRatio) {
    return ffhGwPredictions;
  }
  
  const sleeperGwPreds = {};
  
  Object.keys(ffhGwPredictions).forEach(gw => {
    const ffhPoints = ffhGwPredictions[gw] || 0;
    sleeperGwPreds[gw] = Math.round((ffhPoints * positionRatio.multiplier) * 100) / 100;
  });
  
  return sleeperGwPreds;
}

/**
 * Extract position from various data formats
 */
function normalizePosition(player) {
  // From FFH data
  if (player.position_id) {
    const positions = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
    return positions[player.position_id] || 'MID';
  }
  
  // From Sleeper data
  if (player.fantasy_positions && Array.isArray(player.fantasy_positions)) {
    const pos = player.fantasy_positions[0];
    if (pos === 'G') return 'GK';
    if (pos === 'D') return 'DEF';
    if (pos === 'M') return 'MID';
    if (pos === 'F') return 'FWD';
  }
  
  // From position string
  if (player.position) {
    const pos = player.position.toUpperCase();
    if (pos.includes('GK') || pos.includes('KEEPER')) return 'GK';
    if (pos.includes('DEF') || pos.includes('D')) return 'DEF';
    if (pos.includes('MID') || pos.includes('M')) return 'MID';
    if (pos.includes('FWD') || pos.includes('F') || pos.includes('FORWARD')) return 'FWD';
  }
  
  return 'MID'; // Default fallback
}

/**
 * Main conversion function for enhanced player records
 */
async function enhancePlayerWithScoringConversion(player, ffhData) {
  if (!ffhData) {
    return player; // Return unchanged if no FFH data
  }
  
  const position = normalizePosition(ffhData);
  
  // Extract FFH predictions
  const ffhSeasonPrediction = ffhData.season_prediction || 
                              ffhData.range_prediction || 
                              ffhData.predicted_pts || 0;
  
  // Extract gameweek predictions
  let ffhGwPredictions = {};
  if (ffhData.predictions && Array.isArray(ffhData.predictions)) {
    ffhData.predictions.forEach(pred => {
      if (pred.gw && pred.predicted_pts) {
        const pts = typeof pred.predicted_pts === 'object' ? 
                   pred.predicted_pts.predicted_pts : pred.predicted_pts;
        if (typeof pts === 'number') {
          ffhGwPredictions[pred.gw] = pts;
        }
      }
    });
  }
  
  // Convert to Sleeper scoring
  const sleeperSeasonTotal = await convertFFHToSleeperPrediction(ffhSeasonPrediction, position);
  const sleeperSeasonAvg = sleeperSeasonTotal / 38;
  const sleeperGwPredictions = await convertFFHGWPredictionsToSleeper(ffhGwPredictions, position);
  
  // Get conversion ratio for transparency
  const conversionRatios = await calculateConversionRatios();
  const positionRatio = conversionRatios[position];
  
  // Return enhanced player record
  return {
    ...player,
    
    // Position normalization
    position: position,
    
    // FFH original predictions (FPL scoring)
    ffh_season_prediction: ffhSeasonPrediction,
    ffh_season_avg: ffhSeasonPrediction / 38,
    ffh_gw_predictions: JSON.stringify(ffhGwPredictions),
    
    // Sleeper converted predictions
    sleeper_season_total: sleeperSeasonTotal,
    sleeper_season_avg: Math.round(sleeperSeasonAvg * 100) / 100,
    sleeper_gw_predictions: JSON.stringify(sleeperGwPredictions),
    
    // Conversion metadata
    sleeper_conversion_ratio: positionRatio ? positionRatio.multiplier : 1.0,
    scoring_conversion_applied: true,
    
    // FFH metadata
    ffh_id: ffhData.fpl_id || ffhData.id,
    ffh_web_name: ffhData.web_name || ffhData.name,
    ffh_team: ffhData.club || ffhData.team,
    ffh_position_id: ffhData.position_id
  };
}

/**
 * Clear conversion cache (for testing/debugging)
 */
function clearConversionCache() {
  cachedSleeperScoring = null;
  cachedConversionRatios = null;
  console.log('🔄 Conversion cache cleared');
}

module.exports = {
  enhancePlayerWithScoringConversion,
  convertFFHToSleeperPrediction,
  convertFFHGWPredictionsToSleeper,
  calculateConversionRatios,
  normalizePosition,
  clearConversionCache
};