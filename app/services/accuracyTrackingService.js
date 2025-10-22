// app/services/accuracyTrackingService.js
// Historical accuracy tracking for self-improving V3 predictions

const STORAGE_KEY = 'v3_accuracy_history';
const MAX_GAMEWEEKS_STORED = 20; // Keep last 20 GWs

/**
 * Record predictions for a gameweek (call this before GW starts)
 */
export function recordPredictions(gameweek, players) {
  const history = getHistory();

  // Create/update gameweek entry
  if (!history[gameweek]) {
    history[gameweek] = {
      gameweek,
      predictions: {},
      actuals: {},
      recorded_at: new Date().toISOString()
    };
  }

  // Store predictions for each player
  players.forEach(player => {
    if (player.v3_current_gw && player.v3_current_gw > 0) {
      history[gameweek].predictions[player.id] = {
        player_id: player.id,
        name: player.name || player.full_name,
        position: player.position,
        archetype: player.v3_archetype,
        predicted_points: player.v3_current_gw,
        conversion_ratio: player.v3_conversion_ratio,
        minutes_adjustment: player.v3_minutes_adjustment,
        form_multiplier: player.v3_form_multiplier,
        fixture_multiplier: player.v3_fixture_multiplier
      };
    }
  });

  saveHistory(history);
  console.log(`📝 Recorded predictions for ${Object.keys(history[gameweek].predictions).length} players in GW${gameweek}`);
}

/**
 * Record actual results for a gameweek (call this after GW completes)
 */
export function recordActuals(gameweek, playersWithActuals) {
  const history = getHistory();

  if (!history[gameweek]) {
    console.warn(`⚠️ No predictions found for GW${gameweek}, cannot record actuals`);
    return;
  }

  // Store actual points for each player
  playersWithActuals.forEach(player => {
    const actualPoints = player.actual_sleeper_points || player.sleeper_points || 0;

    if (actualPoints > 0 && history[gameweek].predictions[player.id]) {
      history[gameweek].actuals[player.id] = {
        player_id: player.id,
        actual_points: actualPoints,
        recorded_at: new Date().toISOString()
      };
    }
  });

  saveHistory(history);
  const actualsCount = Object.keys(history[gameweek].actuals).length;
  console.log(`✅ Recorded actuals for ${actualsCount} players in GW${gameweek}`);
}

/**
 * Calculate accuracy metrics for a specific gameweek
 */
export function calculateGameweekAccuracy(gameweek) {
  const history = getHistory();
  const gwData = history[gameweek];

  if (!gwData || !gwData.predictions || !gwData.actuals) {
    return null;
  }

  const comparisons = [];

  // Compare predictions vs actuals
  Object.keys(gwData.predictions).forEach(playerId => {
    const pred = gwData.predictions[playerId];
    const actual = gwData.actuals[playerId];

    if (actual) {
      const error = actual.actual_points - pred.predicted_points;
      const percentError = pred.predicted_points > 0
        ? (error / pred.predicted_points) * 100
        : 0;

      comparisons.push({
        player_id: playerId,
        name: pred.name,
        position: pred.position,
        archetype: pred.archetype,
        predicted: pred.predicted_points,
        actual: actual.actual_points,
        error: error,
        percent_error: percentError,
        absolute_error: Math.abs(error)
      });
    }
  });

  if (comparisons.length === 0) {
    return null;
  }

  // Calculate overall metrics
  const totalPredicted = comparisons.reduce((sum, c) => sum + c.predicted, 0);
  const totalActual = comparisons.reduce((sum, c) => sum + c.actual, 0);
  const mae = comparisons.reduce((sum, c) => sum + c.absolute_error, 0) / comparisons.length;
  const rmse = Math.sqrt(
    comparisons.reduce((sum, c) => sum + (c.error ** 2), 0) / comparisons.length
  );

  return {
    gameweek,
    total_comparisons: comparisons.length,
    total_predicted: totalPredicted,
    total_actual: totalActual,
    overall_ratio: totalActual / totalPredicted,
    mae: mae, // Mean Absolute Error
    rmse: rmse, // Root Mean Square Error
    comparisons: comparisons
  };
}

/**
 * Calculate accuracy by position across multiple gameweeks
 */
export function calculatePositionAccuracy(gameweeks = null) {
  const history = getHistory();
  const gws = gameweeks || Object.keys(history).map(Number).sort((a, b) => b - a).slice(0, 10);

  const byPosition = {
    GKP: { predicted: [], actual: [], count: 0 },
    DEF: { predicted: [], actual: [], count: 0 },
    MID: { predicted: [], actual: [], count: 0 },
    FWD: { predicted: [], actual: [], count: 0 }
  };

  gws.forEach(gw => {
    const gwAccuracy = calculateGameweekAccuracy(gw);
    if (gwAccuracy) {
      gwAccuracy.comparisons.forEach(comp => {
        const pos = comp.position;
        if (byPosition[pos]) {
          byPosition[pos].predicted.push(comp.predicted);
          byPosition[pos].actual.push(comp.actual);
          byPosition[pos].count++;
        }
      });
    }
  });

  // Calculate ratios for each position
  const results = {};
  Object.keys(byPosition).forEach(pos => {
    const data = byPosition[pos];
    if (data.count > 0) {
      const totalPredicted = data.predicted.reduce((a, b) => a + b, 0);
      const totalActual = data.actual.reduce((a, b) => a + b, 0);
      const currentRatio = totalActual / totalPredicted;

      results[pos] = {
        sample_size: data.count,
        total_predicted: totalPredicted,
        total_actual: totalActual,
        current_accuracy_ratio: currentRatio,
        suggested_ratio_adjustment: currentRatio,
        confidence: data.count >= 50 ? 'high' : data.count >= 20 ? 'medium' : 'low'
      };
    }
  });

  return results;
}

/**
 * Get suggested ratio adjustments based on historical accuracy
 */
export function getSuggestedRatioAdjustments(minGameweeks = 5) {
  const history = getHistory();
  const completedGWs = Object.keys(history)
    .map(Number)
    .filter(gw => history[gw].actuals && Object.keys(history[gw].actuals).length > 0);

  if (completedGWs.length < minGameweeks) {
    return {
      error: 'insufficient_data',
      message: `Need at least ${minGameweeks} completed gameweeks, have ${completedGWs.length}`,
      gameweeks_needed: minGameweeks - completedGWs.length
    };
  }

  const positionAccuracy = calculatePositionAccuracy(completedGWs);

  const suggestions = {};
  Object.keys(positionAccuracy).forEach(pos => {
    const data = positionAccuracy[pos];
    const currentRatio = data.current_accuracy_ratio;

    // Only suggest adjustments if we have high confidence and ratio is off by >5%
    if (data.confidence === 'high' && (currentRatio < 0.95 || currentRatio > 1.05)) {
      suggestions[pos] = {
        current_ratio: currentRatio,
        suggested_adjustment: currentRatio,
        sample_size: data.sample_size,
        confidence: data.confidence,
        recommendation: currentRatio > 1.05
          ? `Increase ${pos} ratio by ${((currentRatio - 1) * 100).toFixed(1)}%`
          : `Decrease ${pos} ratio by ${((1 - currentRatio) * 100).toFixed(1)}%`
      };
    }
  });

  return {
    gameweeks_analyzed: completedGWs.length,
    position_accuracy: positionAccuracy,
    suggested_adjustments: suggestions
  };
}

/**
 * Generate accuracy report
 */
export function generateAccuracyReport() {
  const history = getHistory();
  const gameweeks = Object.keys(history).map(Number).sort((a, b) => b - a);

  if (gameweeks.length === 0) {
    return { error: 'no_data', message: 'No accuracy data available yet' };
  }

  const completedGWs = gameweeks.filter(gw =>
    history[gw].actuals && Object.keys(history[gw].actuals).length > 0
  );

  const report = {
    total_gameweeks_tracked: gameweeks.length,
    completed_gameweeks: completedGWs.length,
    latest_gameweek: gameweeks[0],
    gameweek_summaries: [],
    overall_accuracy: null,
    position_accuracy: null,
    suggested_adjustments: null
  };

  // Recent gameweek summaries
  completedGWs.slice(0, 5).forEach(gw => {
    const gwAccuracy = calculateGameweekAccuracy(gw);
    if (gwAccuracy) {
      report.gameweek_summaries.push({
        gameweek: gw,
        players_analyzed: gwAccuracy.total_comparisons,
        overall_ratio: gwAccuracy.overall_ratio,
        mae: gwAccuracy.mae.toFixed(2),
        accuracy: ((1 - (gwAccuracy.mae / gwAccuracy.total_predicted)) * 100).toFixed(1) + '%'
      });
    }
  });

  // Overall position accuracy
  if (completedGWs.length >= 3) {
    report.position_accuracy = calculatePositionAccuracy(completedGWs);
  }

  // Suggested adjustments
  if (completedGWs.length >= 5) {
    report.suggested_adjustments = getSuggestedRatioAdjustments(5);
  }

  return report;
}

/**
 * Clear old gameweek data to prevent storage bloat
 */
export function cleanupOldData() {
  const history = getHistory();
  const gameweeks = Object.keys(history).map(Number).sort((a, b) => b - a);

  if (gameweeks.length > MAX_GAMEWEEKS_STORED) {
    const toRemove = gameweeks.slice(MAX_GAMEWEEKS_STORED);
    toRemove.forEach(gw => delete history[gw]);
    saveHistory(history);
    console.log(`🧹 Cleaned up ${toRemove.length} old gameweeks from accuracy history`);
  }
}

// Storage helpers
function getHistory() {
  if (typeof window === 'undefined') return {}; // Server-side

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error reading accuracy history:', error);
    return {};
  }
}

function saveHistory(history) {
  if (typeof window === 'undefined') return; // Server-side

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Error saving accuracy history:', error);
  }
}

export default {
  recordPredictions,
  recordActuals,
  calculateGameweekAccuracy,
  calculatePositionAccuracy,
  getSuggestedRatioAdjustments,
  generateAccuracyReport,
  cleanupOldData
};
