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

    // Detect FFH/Sleeper GW split: find any GW where FFH has BOTH results
    // (games already played) AND predictions (unplayed games). That GW straddles
    // the Sleeper week boundary — FFH bundles the whole calendar week into one GW
    // while Sleeper may have already advanced to the next week.
    // E.g. FFH gw=33 may contain Apr 18-20 results + Apr 22 predictions.
    //      Sleeper treats Apr 22 games as their week 34.
    // When detected: remap all prediction entries for that GW to gw+1.
    const splitGwNum = (() => {
      const predGws = new Set((ffhData.predictions || []).map(p => p.gw));
      const resultGws = new Set(
        (ffhData.results || [])
          .filter(r => !r.season || r.season === 2025 || r.season === 2026)
          .map(r => r.gw)
      );
      for (const gw of predGws) {
        if (resultGws.has(gw)) return gw;
      }
      return null;
    })();

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
      // Remap split-GW predictions: FFH prediction entries for splitGwNum belong
      // to the next Sleeper week (splitGwNum + 1) since that GW's results are done.
      const remapToNext = splitGwNum !== null &&
        gwPred.gw === splitGwNum &&
        gwPred.source === 'predictions';
      const gwKey = remapToNext ? splitGwNum + 1 : gwPred.gw;
      ffhGwPredictions[gwKey] = (ffhGwPredictions[gwKey] || 0) + gwPred.predicted_pts;
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

    // Build predictions array outside the return so the absorbed-game heuristic can mutate it.
    // Remap split-GW predictions: any FFH prediction entry for splitGwNum belongs to Sleeper's
    // next week (splitGwNum + 1). If player has BOTH entries: sum pts. If ONLY split entry: remap.
    let finalPredictions = (() => {
      let raw = ffhData.predictions || [];
      if (splitGwNum !== null) {
        const splitEntry = raw.find(p => p.gw === splitGwNum);
        const nextEntry = raw.find(p => p.gw === splitGwNum + 1);
        if (splitEntry && nextEntry) {
          raw = raw
            .filter(p => p.gw !== splitGwNum)
            .map(p => p.gw === splitGwNum + 1
              ? { ...p, predicted_pts: p.predicted_pts + splitEntry.predicted_pts }
              : p
            );
        } else if (splitEntry) {
          raw = raw.map(p => p.gw === splitGwNum ? { ...p, gw: splitGwNum + 1 } : p);
        }
      }
      const hasCurrentGW = raw.some(p => p.gw === currentGwNum);
      if (hasCurrentGW || !currentGwNum) return raw;
      // Current GW missing (FFH moved it to results) — inject it back.
      const currentGwEntry = allGameweekPredictions.find(p => p.gw === currentGwNum);
      const pts = currentGwEntry?.predicted_pts || currentGwPrediction || 0;
      let mins = currentGwEntry?.predicted_mins || currentGwMins || 0;
      if (!mins && raw.length > 0) {
        const nextFutureGW = raw.find(p => p.xmins > 0);
        mins = nextFutureGW?.xmins || 0;
      }
      if (pts <= 0 && mins <= 0) return raw;
      const resultEntry = (ffhData.results || []).find(r => r.gw === currentGwNum);
      return [
        { gw: currentGwNum, predicted_pts: pts, predicted_mins: mins, xmins: mins, opp: resultEntry?.opp || null, source: 'injected' },
        ...raw
      ];
    })();

    // Absorbed-game heuristic: FFH sometimes bundles a future midweek game into the
    // previous GW's results entry, leaving currentGW prediction = 0 in the predictions array.
    // This happens when Sleeper advances to week N+1 but FFH's week N still includes games
    // from both the old weekend AND the new week's midweek fixtures.
    // Detection: currentGW entry is 0, player is healthy, and ≥2 future GWs have positive pts.
    // Fix: use the average of the next 2-3 future GWs as a proxy for currentGW.
    if (currentGwNum && chanceOfPlaying >= 75) {
      const currentEntry = finalPredictions.find(p => p.gw === currentGwNum);
      if (currentEntry && currentEntry.predicted_pts === 0) {
        const futureWithPts = finalPredictions
          .filter(p => p.gw > currentGwNum && p.predicted_pts > 0)
          .sort((a, b) => a.gw - b.gw);
        if (futureWithPts.length >= 2) {
          const proxyPts = futureWithPts.slice(0, 3).reduce((s, p) => s + p.predicted_pts, 0) / Math.min(futureWithPts.length, 3);
          finalPredictions = finalPredictions.map(p =>
            p.gw === currentGwNum ? { ...p, predicted_pts: proxyPts, source: 'absorbed_proxy' } : p
          );
          ffhGwPredictions[currentGwNum] = proxyPts;
          currentGwPrediction = proxyPts;
          if (process.env.NODE_ENV === 'development') {
            console.log(`🔀 Absorbed-game proxy for ${sleeperPlayer.full_name || ffhName} GW${currentGwNum}: ${proxyPts.toFixed(2)} pts (from ${futureWithPts.length} future GWs)`);
          }
        }
      }
    }

    // DGW/TGW scaling: finalPredictions comes from ffhData.predictions (raw array).
    // Each entry with predicted_mins > 100 covers multiple fixtures; Sleeper scores one.
    finalPredictions = finalPredictions.map(pred => {
      const mins = pred.predicted_mins || pred.xmins || 0;
      if (mins <= 100) return pred;
      const scale = 90 / mins;
      return {
        ...pred,
        predicted_pts: Math.round((pred.predicted_pts || 0) * scale * 100) / 100,
        predicted_mins: 90,
        xmins: 90,
        dgw_scaled: true,
        dgw_fixture_count: Math.round(mins / 90),
      };
    });

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

      // Predictions array with split-GW remapping and absorbed-game proxy applied.
      predictions: finalPredictions,
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