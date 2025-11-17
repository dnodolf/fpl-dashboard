/**
 * V3 Sleeper Scoring - Adjustment Functions
 * Playing time, form, fixture, and injury adjustments
 */

/**
 * Playing time confidence adjustment factors
 * Reduces predictions for rotation-risk players
 */
export function applyPlayingTimeAdjustment(prediction, expectedMinutes) {
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
export function calculateFormMomentum(player, currentGameweek) {
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
export function calculateFixtureRunQuality(player, currentGameweek) {
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
 * Calculate injury return adjustment
 * Players returning from injury get reduced predictions for first few games back
 */
export function calculateInjuryReturnAdjustment(player, currentGameweek) {
  // Check if player has injury status indicating recent return
  const injuryStatus = (player.injury_status || '').toLowerCase();
  const news = (player.news || '').toLowerCase();

  // Keywords that indicate injury/return
  const injuryKeywords = ['injured', 'injury', 'out', 'suspended', 'banned'];
  const returnKeywords = ['returned', 'back', 'fit', 'available', 'recovered'];

  const hasInjuryIndicator = injuryKeywords.some(kw => injuryStatus.includes(kw) || news.includes(kw));
  const hasReturnIndicator = returnKeywords.some(kw => news.includes(kw));

  // If no injury info, no adjustment
  if (!hasInjuryIndicator && !hasReturnIndicator) {
    return { multiplier: 1.0, status: 'healthy', source: 'no_injury_data' };
  }

  // Check recent minutes to estimate games back from injury
  if (!player.predictions || player.predictions.length === 0) {
    return { multiplier: 1.0, status: 'unknown', source: 'no_predictions' };
  }

  // Look at last 3 gameweeks of predicted minutes
  const recentGWs = player.predictions
    .filter(p => p.gw < currentGameweek && p.gw >= currentGameweek - 3)
    .sort((a, b) => b.gw - a.gw);

  if (recentGWs.length === 0) {
    return { multiplier: 1.0, status: 'unknown', source: 'no_recent_data' };
  }

  // Count how many recent GWs had low/zero minutes (injury period)
  const lowMinutesGWs = recentGWs.filter(gw => (gw.predicted_mins || gw.xmins || 90) < 30);

  // If player had 1-2 recent low-minute games, they might be returning
  if (lowMinutesGWs.length >= 1 && hasReturnIndicator) {
    const weeksBack = recentGWs.length - lowMinutesGWs.length + 1;

    // Graduated recovery: 70% → 85% → 95% → 100% over 4 weeks
    const recoveryMultipliers = [0.70, 0.85, 0.95, 1.00];
    const multiplier = recoveryMultipliers[Math.min(weeksBack - 1, 3)];

    return {
      multiplier: multiplier,
      status: 'returning',
      weeks_back: weeksBack,
      source: 'calculated',
      description: `Returning from injury (week ${weeksBack})`
    };
  }

  // Player is currently injured/out
  if (hasInjuryIndicator && !hasReturnIndicator) {
    return {
      multiplier: 0.5, // Heavy reduction if currently injured
      status: 'injured',
      source: 'injury_status',
      description: 'Currently injured or doubtful'
    };
  }

  // No adjustment needed
  return { multiplier: 1.0, status: 'healthy', source: 'no_adjustment_needed' };
}
