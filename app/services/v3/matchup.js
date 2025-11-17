/**
 * V3 Sleeper Scoring - Matchup Analysis
 * Current gameweek matchup extraction and start/sit recommendations
 */

/**
 * Extract THIS WEEK's matchup details for start/sit decisions
 * Returns opponent, difficulty, and home/away status for current gameweek
 */
export function extractCurrentGameweekMatchup(player, currentGameweek) {
  if (!player.predictions || !Array.isArray(player.predictions)) {
    return {
      hasMatchup: false,
      opponent: 'TBD',
      difficulty: 3,
      isHome: true,
      source: 'no_predictions'
    };
  }

  // Find current gameweek prediction with opponent data
  const currentPred = player.predictions.find(p => p.gw === currentGameweek);

  if (!currentPred) {
    return {
      hasMatchup: false,
      opponent: 'TBD',
      difficulty: 3,
      isHome: true,
      source: 'no_current_gw_prediction'
    };
  }

  // Extract opponent data from FFH nested array format: opp: [["AVL", "Aston Villa (H)", 3]]
  let opponent = 'TBD';
  let opponentFull = 'TBD';
  let difficulty = 3;

  if (currentPred.opp && Array.isArray(currentPred.opp) && currentPred.opp.length > 0) {
    const oppData = currentPred.opp[0];
    if (Array.isArray(oppData) && oppData.length >= 3) {
      opponent = oppData[0] || 'TBD';
      opponentFull = oppData[1] || 'TBD';
      difficulty = oppData[2] || 3;
    }
  }

  // Determine home/away from opponentFull string (has (H) or (A) suffix)
  const isHome = opponentFull.includes('(H)');
  const cleanOpponent = opponent.toUpperCase();

  return {
    hasMatchup: true,
    opponent: cleanOpponent,
    opponentFull: opponentFull,
    difficulty: difficulty,
    isHome: isHome,
    predicted_points: currentPred.predicted_pts || 0,
    predicted_minutes: currentPred.xmins || currentPred.predicted_mins || 0,
    source: 'ffh_predictions'
  };
}

/**
 * Calculate START/BENCH recommendation based on predicted points
 * Provides clear guidance for weekly lineup decisions
 */
export function calculateStartRecommendation(predictedPoints, position) {
  // Position-adjusted thresholds for V3 Sleeper scoring (lower than FPL)
  // Based on actual V3 prediction ranges: 2-6 pts typical
  let mustStartThreshold = 6;
  let safeStartThreshold = 4;
  let flexThreshold = 3;

  // Adjust thresholds by position (GKP/DEF score less on average)
  if (position === 'GKP') {
    mustStartThreshold = 4.5;
    safeStartThreshold = 3;
    flexThreshold = 2;
  } else if (position === 'DEF') {
    mustStartThreshold = 5;
    safeStartThreshold = 3.5;
    flexThreshold = 2.5;
  } else if (position === 'FWD') {
    mustStartThreshold = 6.5;
    safeStartThreshold = 4.5;
    flexThreshold = 3.5;
  }

  if (predictedPoints >= mustStartThreshold) {
    return {
      recommendation: 'MUST_START',
      label: '✅ MUST START',
      color: 'text-green-500',
      confidence: 'high',
      description: `Excellent projection (${predictedPoints.toFixed(1)} pts)`
    };
  } else if (predictedPoints >= safeStartThreshold) {
    return {
      recommendation: 'SAFE_START',
      label: '✔️ SAFE START',
      color: 'text-blue-500',
      confidence: 'medium',
      description: `Solid projection (${predictedPoints.toFixed(1)} pts)`
    };
  } else if (predictedPoints >= flexThreshold) {
    return {
      recommendation: 'FLEX',
      label: '⚠️ FLEX PLAY',
      color: 'text-yellow-500',
      confidence: 'low',
      description: `Risky play (${predictedPoints.toFixed(1)} pts)`
    };
  } else {
    return {
      recommendation: 'BENCH',
      label: '❌ BENCH',
      color: 'text-red-500',
      confidence: 'none',
      description: `Low projection (${predictedPoints.toFixed(1)} pts)`
    };
  }
}

/**
 * Calculate single gameweek matchup quality
 * Different from fixture run quality - this is ONLY for THIS WEEK's decision
 */
export function calculateSingleGameweekMatchup(player, currentGameweek) {
  const matchup = extractCurrentGameweekMatchup(player, currentGameweek);

  if (!matchup.hasMatchup) {
    return {
      quality: 'unknown',
      label: '❓ Unknown',
      color: 'text-gray-500',
      description: 'No matchup data available',
      opponent: 'TBD',
      opponentFull: 'TBD',
      difficulty: 3,
      adjustedDifficulty: 3,
      isHome: true,
      predicted_points: 0,
      predicted_minutes: 0,
      source: 'no_data'
    };
  }

  const difficulty = matchup.difficulty;
  const isHome = matchup.isHome;

  // Home advantage bonus to difficulty assessment
  const adjustedDifficulty = isHome ? Math.max(1, difficulty - 0.5) : Math.min(5, difficulty + 0.3);

  // Categorize matchup quality
  let quality, label, color, description;

  if (adjustedDifficulty <= 2) {
    quality = 'smash_spot';
    label = '🔥 SMASH SPOT';
    color = 'text-green-500';
    description = `Great matchup vs ${matchup.opponent} ${isHome ? '(H)' : '(A)'}`;
  } else if (adjustedDifficulty <= 2.8) {
    quality = 'favorable';
    label = '✅ GOOD MATCHUP';
    color = 'text-blue-500';
    description = `Favorable vs ${matchup.opponent} ${isHome ? '(H)' : '(A)'}`;
  } else if (adjustedDifficulty <= 3.5) {
    quality = 'neutral';
    label = '➡️ NEUTRAL';
    color: 'text-gray-400';
    description = `Average vs ${matchup.opponent} ${isHome ? '(H)' : '(A)'}`;
  } else if (adjustedDifficulty <= 4.2) {
    quality = 'difficult';
    label = '⚠️ TOUGH MATCHUP';
    color = 'text-orange-500';
    description = `Difficult vs ${matchup.opponent} ${isHome ? '(H)' : '(A)'}`;
  } else {
    quality = 'avoid';
    label = '❌ AVOID';
    color = 'text-red-500';
    description = `Very tough vs ${matchup.opponent} ${isHome ? '(H)' : '(A)'}`;
  }

  return {
    quality,
    label,
    color,
    description,
    opponent: matchup.opponent,
    opponentFull: matchup.opponentFull,
    difficulty: matchup.difficulty,
    adjustedDifficulty,
    isHome,
    predicted_points: matchup.predicted_points,
    predicted_minutes: matchup.predicted_minutes,
    source: 'calculated'
  };
}
