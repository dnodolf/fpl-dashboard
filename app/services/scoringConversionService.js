// app/services/scoringConversionService.js
// FIXED - Proper data enhancement and merging

import { normalizePosition } from '../../utils/positionUtils.js';
import { extractAllGameweekPredictions } from '../utils/ffhDataUtils.js';

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
    // Normalise currentGameweek to a plain number — callers may pass the full
    // gameweek object ({number, status, …}) or just the number.
    const currentGwNum = typeof currentGameweek === 'object' && currentGameweek !== null
      ? currentGameweek.number
      : currentGameweek;

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
    let currentGwPrediction = ffhGwPredictions[currentGwNum] || ffhSeasonAvg || 0;
    let currentGwMins = 0;

    // Extract predicted minutes for current gameweek
    const currentGwData = allGameweekPredictions.find(gw => gw.gw === currentGwNum);
    if (currentGwData) {
      currentGwMins = currentGwData.predicted_mins || 0;
      if (process.env.NODE_ENV === 'development') {
        if (currentGwMins > 0 && Math.random() < 0.01) {
          console.log(`✅ Predicted minutes for ${sleeperPlayer.full_name || ffhName} GW${currentGwNum}: ${currentGwMins}`);
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
        console.log(`⚠️ ${sleeperPlayer.full_name || ffhName}: Not playing (${chanceOfPlaying}% chance) - zeroing GW${currentGwNum} prediction`);
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

      // Predictions array: raw FFH predictions (have opp data for fixtures),
      // but ensure the current GW is included even if FFH moved it to results.
      // This is critical for Start/Sit and other tabs that read predictions for the live GW.
      predictions: (() => {
        const raw = ffhData.predictions || [];
        const hasCurrentGW = raw.some(p => p.gw === currentGwNum);
        if (hasCurrentGW || !currentGwNum) return raw;
        // Current GW missing (FFH moved it to results) — inject it back.
        // Use allGameweekPredictions first, then fall back to the already-calculated
        // currentGwPrediction (which itself falls back to season avg).
        const currentGwEntry = allGameweekPredictions.find(p => p.gw === currentGwNum);
        const pts = currentGwEntry?.predicted_pts || currentGwPrediction || 0;
        // FFH results often drop predicted_mins — use the next future GW's xmins as proxy
        let mins = currentGwEntry?.predicted_mins || currentGwMins || 0;
        if (!mins && raw.length > 0) {
          const nextFutureGW = raw.find(p => p.xmins > 0);
          mins = nextFutureGW?.xmins || 0;
        }
        if (pts <= 0 && mins <= 0) return raw; // Nothing useful to inject
        // Also check raw results for opp data
        const resultEntry = (ffhData.results || []).find(r => r.gw === currentGwNum);
        return [
          { gw: currentGwNum, predicted_pts: pts, predicted_mins: mins, xmins: mins, opp: resultEntry?.opp || null, source: 'injected' },
          ...raw
        ];
      })(),
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
      ffh_code: ffhData.code || null,
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

// Default export for compatibility
const scoringConversionService = {
  enhancePlayerWithScoringConversion
};

export default scoringConversionService;