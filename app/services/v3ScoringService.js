// app/services/v3ScoringService.js
// V3 Sleeper Scoring System with archetype-based FPL→Sleeper conversion

import { getPlayerArchetype, getArchetypeStats } from './playerArchetypeService.js';

/**
 * Fallback position-based FPL to Sleeper conversion ratios
 * Used when player archetype cannot be determined
 */
const FALLBACK_CONVERSION_RATIOS = {
  GKP: 0.90,  // GKP: Subtract appearance points, add save bonuses
  DEF: 1.15,  // DEF: Add defensive stat rewards (tackles, interceptions, blocks)
  MID: 1.05,  // MID: Add versatility bonus (goals, assists, defensive actions)
  FWD: 0.97   // FWD: Subtract dispossession penalties
};

/**
 * Playing time confidence adjustment factors
 * Reduces predictions for rotation-risk players
 */
function applyPlayingTimeAdjustment(prediction, expectedMinutes) {
  if (!expectedMinutes || expectedMinutes <= 0) {
    // No minutes data - apply conservative reduction
    return prediction * 0.7;
  }

  if (expectedMinutes < 30) {
    // Substitute/rotation risk - heavy reduction
    return prediction * 0.4;
  } else if (expectedMinutes < 60) {
    // Partial starter - moderate reduction
    return prediction * 0.75;
  } else if (expectedMinutes < 75) {
    // Regular but sometimes subbed - light reduction
    return prediction * 0.90;
  }

  // Regular starter (75+ mins) - no reduction
  return prediction;
}

/**
 * Calculate form momentum based on recent gameweek performance
 * Compares last 3 gameweeks to season average to capture hot/cold streaks
 */
function calculateFormMomentum(player, currentGameweek) {
  // Need predictions array and season average
  if (!player.predictions || !Array.isArray(player.predictions) || player.predictions.length < 3) {
    return { multiplier: 1.0, source: 'insufficient_data' };
  }

  const seasonAvg = player.season_prediction_avg || 0;
  if (seasonAvg <= 0) {
    return { multiplier: 1.0, source: 'no_season_avg' };
  }

  // Get last 3 gameweeks before current (recently completed games)
  const recentGWs = player.predictions
    .filter(p => p.gw < currentGameweek && p.gw >= currentGameweek - 3)
    .sort((a, b) => b.gw - a.gw) // Most recent first
    .slice(0, 3);

  if (recentGWs.length < 2) {
    // Need at least 2 recent gameweeks for meaningful trend
    return { multiplier: 1.0, source: 'insufficient_recent_data' };
  }

  // Calculate average of recent gameweeks
  const recentAvg = recentGWs.reduce((sum, gw) => sum + (gw.predicted_pts || 0), 0) / recentGWs.length;

  // Calculate momentum ratio
  const momentum = recentAvg / seasonAvg;

  // Apply caps: 0.8x to 1.2x (±20% max adjustment)
  // This prevents extreme swings from small sample sizes
  let cappedMomentum = Math.max(0.8, Math.min(1.2, momentum));

  // Determine trend direction
  let trend = 'neutral';
  if (cappedMomentum > 1.05) trend = 'hot';
  else if (cappedMomentum < 0.95) trend = 'cold';

  return {
    multiplier: cappedMomentum,
    recentAvg: Math.round(recentAvg * 100) / 100,
    seasonAvg: Math.round(seasonAvg * 100) / 100,
    trend: trend,
    gameweeksUsed: recentGWs.length,
    source: 'calculated'
  };
}

/**
 * Calculate fixture run quality adjustment
 * Analyzes upcoming fixtures to see if they're easier or harder than average
 * FFH predictions already factor in fixtures, so we infer difficulty from predicted points
 */
function calculateFixtureRunQuality(player, currentGameweek) {
  // Need predictions array and season average
  if (!player.predictions || !Array.isArray(player.predictions) || player.predictions.length < 3) {
    return { multiplier: 1.0, source: 'insufficient_data' };
  }

  const seasonAvg = player.season_prediction_avg || 0;
  if (seasonAvg <= 0) {
    return { multiplier: 1.0, source: 'no_season_avg' };
  }

  // Get next 6 gameweeks (medium-term fixture run)
  const upcomingGWs = player.predictions
    .filter(p => p.gw >= currentGameweek && p.gw < currentGameweek + 6)
    .sort((a, b) => a.gw - b.gw);

  if (upcomingGWs.length < 3) {
    // Need at least 3 upcoming gameweeks for meaningful assessment
    return { multiplier: 1.0, source: 'insufficient_upcoming_data' };
  }

  // Calculate average of upcoming gameweeks
  const upcomingAvg = upcomingGWs.reduce((sum, gw) => sum + (gw.predicted_pts || 0), 0) / upcomingGWs.length;

  // Calculate fixture quality ratio
  const fixtureQuality = upcomingAvg / seasonAvg;

  // Apply conservative caps: 0.92x to 1.08x (±8% max adjustment)
  // More conservative than form because fixtures are already in FFH predictions
  let cappedQuality = Math.max(0.92, Math.min(1.08, fixtureQuality));

  // Determine fixture run rating
  let rating = 'average';
  if (cappedQuality > 1.05) rating = 'favorable';
  else if (cappedQuality < 0.95) rating = 'difficult';

  return {
    multiplier: cappedQuality,
    upcomingAvg: Math.round(upcomingAvg * 100) / 100,
    seasonAvg: Math.round(seasonAvg * 100) / 100,
    rating: rating,
    gameweeksAnalyzed: upcomingGWs.length,
    source: 'calculated'
  };
}

/**
 * Calculate V3 Sleeper prediction from FFH FPL predictions
 * Uses archetype-based conversion ratios to estimate Sleeper league points
 * NOW INCLUDES: Archetype + Playing time + Form momentum + Fixture run quality
 */
export async function calculateV3Prediction(player, currentGameweek) {
  try {
    if (!currentGameweek?.number) {
      console.error('❌ V3 Scoring: No currentGameweek provided');
      throw new Error('currentGameweek is required for V3 scoring calculations');
    }

    const position = player.position || 'MID';

    // Get player-specific archetype and ratio
    const archetypeInfo = getPlayerArchetype(player);
    const ratio = archetypeInfo.ratio;

    // Use FFH FPL predictions as base
    const fplSeasonTotal = player.predicted_points || 0;
    const fplSeasonAvg = player.season_prediction_avg || 0;
    const fplCurrentGW = player.current_gw_prediction || 0;

    // Step 1: Convert to Sleeper points using position ratio
    let v3SeasonTotal = fplSeasonTotal * ratio;
    let v3SeasonAvg = fplSeasonAvg * ratio;
    let v3CurrentGW = fplCurrentGW * ratio;

    // Step 2: Apply form momentum adjustment
    const formData = calculateFormMomentum(player, currentGameweek.number);
    const formMultiplier = formData.multiplier;

    v3SeasonTotal *= formMultiplier;
    v3SeasonAvg *= formMultiplier;
    v3CurrentGW *= formMultiplier;

    // Step 3: Apply fixture run quality adjustment
    const fixtureData = calculateFixtureRunQuality(player, currentGameweek.number);
    const fixtureMultiplier = fixtureData.multiplier;

    v3SeasonTotal *= fixtureMultiplier;
    v3SeasonAvg *= fixtureMultiplier;
    v3CurrentGW *= fixtureMultiplier;

    // Step 4: Get expected minutes for playing time adjustment
    // Try multiple sources: current GW prediction, season average, or player metadata
    let expectedMinutes = 90; // Default assumption

    if (player.predictions && player.predictions.length > 0) {
      // Find current gameweek prediction for minutes
      const currentPred = player.predictions.find(p => p.gw === currentGameweek.number);
      if (currentPred && currentPred.predicted_mins) {
        expectedMinutes = currentPred.predicted_mins;
      } else if (currentPred && currentPred.xmins) {
        expectedMinutes = currentPred.xmins;
      } else {
        // Calculate average expected minutes from all predictions
        const minsData = player.predictions
          .map(p => p.predicted_mins || p.xmins || 0)
          .filter(m => m > 0);

        if (minsData.length > 0) {
          expectedMinutes = minsData.reduce((a, b) => a + b) / minsData.length;
        }
      }
    }

    // Step 5: Apply playing time adjustment
    const playingTimeMultiplier = applyPlayingTimeAdjustment(1.0, expectedMinutes);

    v3SeasonTotal *= playingTimeMultiplier;
    v3SeasonAvg *= playingTimeMultiplier;
    v3CurrentGW *= playingTimeMultiplier;

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

    // Log significant adjustments (only for players with meaningful predictions)
    const totalMultiplier = formMultiplier * fixtureMultiplier * playingTimeMultiplier;
    const playerName = player.name || player.full_name;

    // Log archetype assignment for known players
    if (archetypeInfo.source === 'archetype_mapping' && fplSeasonTotal > 100) {
      console.log(`🎯 Archetype: ${playerName} → ${archetypeInfo.archetype} (${ratio}x)`);
    }

    if (formMultiplier !== 1.0 && formData.trend !== 'neutral' && fplSeasonTotal > 50) {
      console.log(`🔥 Form ${formData.trend}: ${playerName} - Recent: ${formData.recentAvg} vs Avg: ${formData.seasonAvg} → ${(formMultiplier * 100).toFixed(0)}%`);
    }

    if (fixtureMultiplier !== 1.0 && fixtureData.rating !== 'average' && fplSeasonTotal > 50) {
      console.log(`📅 Fixtures ${fixtureData.rating}: ${playerName} - Upcoming: ${fixtureData.upcomingAvg} vs Avg: ${fixtureData.seasonAvg} → ${(fixtureMultiplier * 100).toFixed(0)}%`);
    }

    if (playingTimeMultiplier < 0.95 && fplSeasonTotal > 50) {
      console.log(`⏱️ Minutes adjustment: ${playerName} - ${expectedMinutes}min → ${(playingTimeMultiplier * 100).toFixed(0)}%`);
    }

    if (totalMultiplier < 0.85 || totalMultiplier > 1.15) {
      console.log(`📊 Total adjustments: ${playerName} - ${(fplSeasonTotal * ratio).toFixed(1)} → ${v3SeasonTotal.toFixed(1)} pts (${(totalMultiplier * 100).toFixed(0)}%)`);
    }

    return {
      v3_season_total: Math.round(v3SeasonTotal * 100) / 100,
      v3_season_avg: Math.round(v3SeasonAvg * 100) / 100,
      v3_current_gw: Math.round(v3CurrentGW * 100) / 100,
      v3_calculation_source: 'fpl_conversion_with_archetypes',
      v3_confidence: confidence,
      v3_conversion_ratio: ratio,
      v3_archetype: archetypeInfo.archetype,
      v3_archetype_source: archetypeInfo.source,
      v3_minutes_adjustment: playingTimeMultiplier,
      v3_expected_minutes: Math.round(expectedMinutes),
      v3_form_multiplier: formMultiplier,
      v3_form_trend: formData.trend,
      v3_form_recent_avg: formData.recentAvg,
      v3_form_season_avg: formData.seasonAvg,
      v3_fixture_multiplier: fixtureMultiplier,
      v3_fixture_rating: fixtureData.rating,
      v3_fixture_upcoming_avg: fixtureData.upcomingAvg
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

  console.log(`🚀 V3 Sleeper Scoring (Full Pipeline with Archetypes): Processing ${players.length} players for GW${currentGameweek.number}`);

  let playersWithPredictions = 0;
  let playersWithZeroPredictions = 0;
  let playersWithArchetype = 0;
  let playersWithMinutesAdjustment = 0;
  let playersWithFormBoost = 0;
  let playersWithFormPenalty = 0;
  let playersWithFavorableFixtures = 0;
  let playersWithDifficultFixtures = 0;

  // Process players in parallel - now lightweight since no external fetches
  const enhancedPlayers = await Promise.all(
    players.map(async (player) => {
      const v3Results = await calculateV3Prediction(player, currentGameweek);

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

      return {
        ...player,
        ...v3Results,
        v3_enhanced: true,
        v3_timestamp: new Date().toISOString()
      };
    })
  );

  console.log(`📊 V3 Sleeper Summary: ${playersWithPredictions} with predictions, ${playersWithZeroPredictions} with 0/no predictions`);
  console.log(`🎯 Archetypes: ${playersWithArchetype} players with style-specific ratios`);
  console.log(`⏱️ Playing time: ${playersWithMinutesAdjustment} players adjusted`);
  console.log(`🔥 Form: ${playersWithFormBoost} hot, ${playersWithFormPenalty} cold`);
  console.log(`📅 Fixtures: ${playersWithFavorableFixtures} favorable, ${playersWithDifficultFixtures} difficult`);

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