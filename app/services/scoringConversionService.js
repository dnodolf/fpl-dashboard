// app/services/scoringConversionService.js
// FIXED - Proper data enhancement and merging

import { normalizePosition } from '../../utils/positionUtils.js';
import { extractAllGameweekPredictions } from '../utils/ffhDataUtils.js';

/**
 * FPL Scoring System (what FFH predictions are based on)
 */
const FPL_SCORING_SYSTEM = {
  goals: { GKP: 6, DEF: 6, MID: 5, FWD: 4 },
  assists: { GKP: 3, DEF: 3, MID: 3, FWD: 3 },
  clean_sheets: { GKP: 4, DEF: 4, MID: 1, FWD: 0 },
  goals_conceded: { GKP: -1, DEF: -1, MID: 0, FWD: 0 }, // per 2 goals
  yellow_cards: { GKP: -1, DEF: -1, MID: -1, FWD: -1 },
  red_cards: { GKP: -3, DEF: -3, MID: -3, FWD: -3 },
  own_goals: { GKP: -2, DEF: -2, MID: -2, FWD: -2 },
  penalty_missed: { GKP: -2, DEF: -2, MID: -2, FWD: -2 },
  penalty_saved: { GKP: 5, DEF: 0, MID: 0, FWD: 0 },
  saves: { GKP: 1, DEF: 0, MID: 0, FWD: 0 }, // per 3 saves
  bonus: { GKP: 1, DEF: 1, MID: 1, FWD: 1 }, // 1-3 points based on BPS
  minutes: { GKP: 1, DEF: 1, MID: 1, FWD: 1 } // 1 point for 60+ mins, 2 for 1+ mins
};

/**
 * Fallback default Sleeper scoring settings based on Derek's league
 */
const DEFAULT_SLEEPER_SCORING = {
  // Goalkeepers
  'pos_gk_g': 6.0, 'pos_gk_at': 3.0, 'pos_gk_cs': 5.0, 'pos_gk_sv': 1.0, 'pos_gk_hcs': 1.0,
  'pos_gk_sm': 1.0, 'pos_gk_yc': -2.0, 'pos_gk_rc': -5.0, 'pos_gk_og': -4.0, 'pos_gk_pkm': -4.0,
  'pos_gk_ga': -0.5, 'pos_gk_cos': 0.5, 'pos_gk_sot': 0.5, 'pos_gk_tkw': 0.5, 'pos_gk_int': 0.5,
  
  // Defenders  
  'pos_d_g': 6.0, 'pos_d_at': 3.0, 'pos_d_cs': 4.0, 'pos_d_tkw': 1.0, 'pos_d_int': 0.5,
  'pos_d_bs': 1.0, 'pos_d_aer': 0.5, 'pos_d_yc': -1.0, 'pos_d_rc': -3.0, 'pos_d_og': -4.0,
  
  // Midfielders
  'pos_m_g': 5.0, 'pos_m_at': 3.0, 'pos_m_kp': 1.0, 'pos_m_sot': 0.5, 'pos_m_tkw': 0.5,
  'pos_m_int': 1.0, 'pos_m_yc': -1.0, 'pos_m_rc': -3.0,
  
  // Forwards
  'pos_f_g': 4.0, 'pos_f_at': 3.0, 'pos_f_sot': 1.0, 'pos_f_kp': 0.5, 'pos_f_yc': -1.0, 'pos_f_rc': -3.0
};

// Cache for expensive operations
let cachedSleeperScoring = null;
let cachedConversionRatios = null;

/**
 * FIXED: Main conversion function for enhanced player records
 */
export async function enhancePlayerWithScoringConversion(player, ffhData, currentGameweek) {
  if (!ffhData) {
    // Return player with minimal enhancement if no FFH data
    return {
      ...player,
      predicted_points: 0,
      sleeper_points: 0,
      ffh_matched: false,
      enhancement_status: 'no_ffh_data'
    };
  }
  
  try {
    // CRITICAL: Preserve Sleeper player data as base
    const sleeperPlayer = { ...player };
    
    // Use unified position logic - SLEEPER FIRST, then FFH fallback
    const position = normalizePosition(player);
    
    // Extract FFH basic info
    const ffhName = ffhData.web_name || ffhData.name || '';
    const ffhTeam = ffhData.team?.code_name || ffhData.team_short_name || ffhData.club || '';
    
    // Extract FFH predictions using enhanced logic
    const gameweekPredictions = extractAllGameweekPredictions(ffhData);
    const allGameweekPredictions = gameweekPredictions.all || [];

    // Dev diagnostic: log results count for first few players to verify FFH returns historical data
    if (process.env.NODE_ENV === 'development' && Math.random() < 0.005) {
      const resultsCount = allGameweekPredictions.filter(p => p.source === 'results').length;
      const predictionsCount = allGameweekPredictions.filter(p => p.source === 'predictions').length;
      console.log(`📊 FFH data for ${ffhData.web_name || 'player'}: ${predictionsCount} predictions, ${resultsCount} results (raw results array: ${ffhData.results?.length || 0} entries)`);
    }

    // Calculate season totals from FUTURE predictions only (source:'predictions').
    // ffhData.season_prediction covers GW1-38 including past weeks — using it as "ROS points"
    // is misleading for players whose future predictions are all zero (e.g. injured/transferred).
    const futurePredictions = allGameweekPredictions.filter(p => p.source === 'predictions');
    const ffhSeasonPrediction = futurePredictions.length > 0
      ? futurePredictions.reduce((sum, gw) => sum + gw.predicted_pts, 0)
      : (ffhData.season_prediction || ffhData.range_prediction || ffhData.predicted_pts || 0);

    const remainingGWs = Math.max(futurePredictions.length, 1);
    const ffhSeasonAvg = ffhSeasonPrediction / remainingGWs;

    // Create gameweek predictions object - PURE FFH DATA
    const ffhGwPredictions = {};

    allGameweekPredictions.forEach(gwPred => {
      ffhGwPredictions[gwPred.gw] = gwPred.predicted_pts;
    });

    // Get current gameweek prediction and minutes - PURE FFH DATA
    let currentGwPrediction = ffhGwPredictions[currentGameweek] || ffhSeasonAvg || 0;
    let currentGwMins = 0;

    // Extract predicted minutes for current gameweek
    const currentGwData = allGameweekPredictions.find(gw => gw.gw === currentGameweek);
    if (currentGwData) {
      currentGwMins = currentGwData.predicted_mins || 0;
      if (process.env.NODE_ENV === 'development') {
        if (currentGwMins > 0 && Math.random() < 0.01) {
          console.log(`✅ Predicted minutes for ${sleeperPlayer.full_name || ffhName} GW${currentGameweek}: ${currentGwMins}`);
        }
      }
    }

    // Check if player is available for next round
    const chanceOfPlaying = ffhData.chance_of_playing_next_round ??
                           ffhData.chance_of_playing_this_round ??
                           ffhData.chance_next_round ??
                           100; // Default to 100% if not specified

    // Zero out current gameweek prediction if player isn't playing
    if (chanceOfPlaying !== null && chanceOfPlaying !== undefined && chanceOfPlaying < 25) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`⚠️ ${sleeperPlayer.full_name || ffhName}: Not playing (${chanceOfPlaying}% chance) - zeroing GW${currentGameweek} prediction`);
      }
      currentGwPrediction = 0;
      currentGwMins = 0;
    }

    // FIXED: Return enhanced player with ALL data properly merged
    return {
      // PRESERVE all original Sleeper data
      ...sleeperPlayer,
      
      // Core display data (CRITICAL for UI)
      name: sleeperPlayer.full_name || sleeperPlayer.name || ffhName,
      web_name: ffhName,
      full_name: sleeperPlayer.full_name || sleeperPlayer.name,
      team_abbr: sleeperPlayer.team_abbr || sleeperPlayer.team,
      
      // Position (Sleeper authority)
      position: position,
      
      // FFH original predictions (PURE FPL scoring - no multipliers)
      ffh_season_prediction: ffhSeasonPrediction,
      ffh_season_avg: ffhSeasonAvg,
      ffh_gw_predictions: JSON.stringify(ffhGwPredictions),
      ffh_web_name: ffhName,
      ffh_team: ffhTeam,
      ffh_position_id: ffhData.position_id,

      // PURE FFH DATA - Preserve original fields for direct mapping
      predictions: ffhData.predictions || [],
      // Processed past-GW results for V3 calibration (source: 'results' entries)
      ffh_gw_results: allGameweekPredictions.filter(p => p.source === 'results'),
      season_prediction_avg: ffhData.season_prediction_avg || 0,
      news: ffhData.player?.news || ffhData.news || '',
      chance_next_round: chanceOfPlaying,
      chance_of_playing_next_round: chanceOfPlaying,

      // Main prediction fields (PURE FFH DATA - no Sleeper conversion)
      current_gw_prediction: Math.round(currentGwPrediction * 100) / 100,
      predicted_mins: Math.round(currentGwMins),
      current_gameweek_prediction: {
        predicted_mins: Math.round(currentGwMins),
        predicted_pts: Math.round(currentGwPrediction * 100) / 100
      },

      // CRITICAL: Set the main predicted_points field to PURE FFH data
      predicted_points: ffhSeasonPrediction,
      season_total: ffhSeasonPrediction,
      season_avg: ffhSeasonAvg,
      
      // Enhanced status tracking
      ffh_matched: true,
      ffh_id: ffhData.fpl_id || ffhData.id,
      scoring_conversion_applied: false, // No conversion - pure FFH data
      enhancement_status: 'success',
      
      // Metadata for debugging
      prediction_source: allGameweekPredictions.length > 0 ? 'gameweek_array' : 'season_total',
      gameweek_predictions_count: allGameweekPredictions.length,
      enhancement_timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ Enhancement error for ${player.name}:`, error);
    
    // Return player with error info but preserve base data
    return {
      ...player,
      predicted_points: 0,
      sleeper_points: 0,
      ffh_matched: true,
      enhancement_status: 'error',
      enhancement_error: error.message
    };
  }
}

/**
 * Convert FFH season prediction to Sleeper scoring
 */
export async function convertFFHToSleeperPrediction(ffhPrediction, position) {
  if (!ffhPrediction || !position) {
    return ffhPrediction || 0;
  }
  
  try {
    const conversionRatios = await calculateConversionRatios();
    const positionRatio = conversionRatios[position.toUpperCase()];
    
    if (!positionRatio) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`No conversion ratio for position ${position}, using 1.0`);
      }
      return ffhPrediction;
    }
    
    const convertedPrediction = ffhPrediction * positionRatio.multiplier;
    return Math.round(convertedPrediction * 100) / 100;
  } catch (error) {
    console.error('Conversion error:', error);
    return ffhPrediction; // Fallback to original
  }
}

/**
 * Calculate conversion ratios from Sleeper scoring settings
 */
async function calculateConversionRatios() {
  if (cachedConversionRatios) {
    return cachedConversionRatios;
  }
  
  try {
    const sleeperScoring = await fetchSleeperScoringSettings();
    
    const ratios = {};
    
    // Calculate for each position
    ['GKP', 'DEF', 'MID', 'FWD'].forEach(position => {
      const pos = position.toLowerCase();
      const prefix = pos === 'gkp' ? 'gk' : pos === 'def' ? 'd' : pos === 'mid' ? 'm' : 'f';
      
      // Get Sleeper scoring values
      const sleeperGoals = sleeperScoring[`pos_${prefix}_g`] || DEFAULT_SLEEPER_SCORING[`pos_${prefix}_g`] || 4;
      const sleeperAssists = sleeperScoring[`pos_${prefix}_at`] || DEFAULT_SLEEPER_SCORING[`pos_${prefix}_at`] || 3;
      const sleeperCleanSheets = sleeperScoring[`pos_${prefix}_cs`] || DEFAULT_SLEEPER_SCORING[`pos_${prefix}_cs`] || 4;
      
      // FPL scoring values
      const fplGoals = FPL_SCORING_SYSTEM.goals[position];
      const fplAssists = FPL_SCORING_SYSTEM.assists[position];
      const fplCleanSheets = FPL_SCORING_SYSTEM.clean_sheets[position];
      
      // Calculate weighted multiplier
      let multiplier = (sleeperGoals * 2 + sleeperAssists + sleeperCleanSheets) / 
                      (fplGoals * 2 + fplAssists + fplCleanSheets);
      
      // Position-specific adjustments
      if (position === 'GKP') multiplier *= 1.1; // Goalkeepers get saves bonus
      else if (position === 'DEF') multiplier *= 1.0;
      else if (position === 'MID') multiplier *= 1.0;
      else if (position === 'FWD') multiplier *= 0.95;
      
      // Ensure reasonable bounds
      multiplier = Math.max(0.7, Math.min(1.4, multiplier));
      
      ratios[position] = {
        multiplier: Math.round(multiplier * 100) / 100,
        breakdown: {
          goals: sleeperGoals / fplGoals,
          assists: sleeperAssists / fplAssists,
          clean_sheets: sleeperCleanSheets / fplCleanSheets
        }
      };
    });
    
    cachedConversionRatios = ratios;
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Calculated conversion ratios:', ratios);
    }
    return ratios;
  } catch (error) {
    console.error('Error calculating conversion ratios:', error);
    // Return fallback ratios
    return {
      'GKP': { multiplier: 1.1, breakdown: {} },
      'DEF': { multiplier: 1.0, breakdown: {} },
      'MID': { multiplier: 1.0, breakdown: {} },
      'FWD': { multiplier: 0.95, breakdown: {} }
    };
  }
}

/**
 * Fetch Sleeper scoring settings
 */
export async function fetchSleeperScoringSettings() {
  if (cachedSleeperScoring) {
    return cachedSleeperScoring;
  }
  
  try {
    const leagueId = process.env.SLEEPER_LEAGUE_ID || '1240184286171107328';
    const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch league data: ${response.status}`);
    }
    
    const leagueData = await response.json();
    const scoring = leagueData.scoring_settings || {};
    
    // Merge with defaults for missing values
    const enhancedScoring = { ...DEFAULT_SLEEPER_SCORING, ...scoring };
    
    cachedSleeperScoring = enhancedScoring;
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Sleeper scoring settings fetched and cached');
    }
    return enhancedScoring;
  } catch (error) {
    console.error('Error fetching Sleeper scoring:', error);
    if (process.env.NODE_ENV === 'development') {
      console.log('📋 Using fallback scoring settings');
    }
    cachedSleeperScoring = DEFAULT_SLEEPER_SCORING;
    return DEFAULT_SLEEPER_SCORING;
  }
}

/**
 * Clear conversion cache (for testing/debugging)
 */
export function clearConversionCache() {
  cachedSleeperScoring = null;
  cachedConversionRatios = null;
  if (process.env.NODE_ENV === 'development') {
    console.log('🔄 Conversion cache cleared');
  }
}

// Default export for compatibility
const scoringConversionService = {
  enhancePlayerWithScoringConversion,
  convertFFHToSleeperPrediction,
  calculateConversionRatios,
  fetchSleeperScoringSettings,
  clearConversionCache
};

export default scoringConversionService;