/**
 * V4 Enhanced Statistical Model
 *
 * Improvements over V3:
 * 1. Learned position multipliers from training data (NOT hardcoded guesses)
 * 2. Minutes-weighted predictions (rotation risk modeling)
 * 3. Form-based adjustments (recent performance trends)
 * 4. Fixture difficulty integration
 *
 * Weight in V4 Ensemble: 40%
 */

/**
 * Position-specific FPL → Sleeper conversion multipliers
 * LEARNED from training data (160 samples, GW 1-20)
 *
 * Previous V3 ratios were significantly wrong:
 * - GKP: V3 used 0.90x, actual is 1.13x (+25% error)
 * - DEF: V3 used 1.15x, actual is 1.26x (+10% error)
 * - MID: V3 used 1.05x, actual is 1.27x (+21% error)
 * - FWD: V3 used 0.97x, actual is 1.28x (+32% error)
 */
const LEARNED_POSITION_MULTIPLIERS = {
  'GKP': 1.129,  // From training: 1.129x actual vs FPL
  'GK': 1.129,   // Alias for GKP
  'DEF': 1.264,  // From training: 1.264x actual vs FPL
  'MID': 1.267,  // From training: 1.267x actual vs FPL
  'FWD': 1.282   // From training: 1.282x actual vs FPL
};

/**
 * Minutes consistency bands for rotation risk modeling
 * Based on predicted minutes percentage
 */
const MINUTES_BANDS = {
  NAILED: { min: 85, multiplier: 1.0 },      // 85+ mins = no penalty
  HIGH: { min: 70, max: 85, multiplier: 0.95 },  // 70-85 mins = slight risk
  MEDIUM: { min: 50, max: 70, multiplier: 0.85 }, // 50-70 mins = rotation risk
  LOW: { min: 0, max: 50, multiplier: 0.65 }     // <50 mins = high risk
};

/**
 * Form adjustment windows
 * Recent performance relative to season average
 */
const FORM_WINDOWS = {
  RECENT: 3,  // Last 3 gameweeks for short-term form
  MEDIUM: 5   // Last 5 gameweeks for medium-term trend
};

/**
 * Enhanced Statistical Model
 * Converts FFH FPL predictions to Sleeper-adjusted predictions
 *
 * @param {Object} player - Player object with FFH predictions
 * @param {Object} context - Additional context (fixtures, form, etc.)
 * @returns {Object} Enhanced predictions with confidence
 */
export function calculateEnhancedPrediction(player, context = {}) {
  try {
    // Base FFH prediction (FPL-based)
    const ffhPrediction = player.current_gw_prediction || 0;
    const predictedMins = player.predicted_mins || 90;
    const position = player.fantasy_positions?.[0] || player.position || 'MID';

    // Step 1: Apply learned position multiplier
    const positionMultiplier = LEARNED_POSITION_MULTIPLIERS[position] || 1.267; // Default to MID
    let enhancedPrediction = ffhPrediction * positionMultiplier;

    // Step 2: Apply minutes-weighted adjustment (rotation risk)
    const minutesMultiplier = getMinutesMultiplier(predictedMins);
    enhancedPrediction *= minutesMultiplier;

    // Step 3: Apply form adjustment (if available)
    if (context.recentForm) {
      const formMultiplier = getFormMultiplier(context.recentForm, position);
      enhancedPrediction *= formMultiplier;
    }

    // Step 4: Apply fixture difficulty adjustment (if available)
    if (context.fixtureDifficulty) {
      const fixtureMultiplier = getFixtureMultiplier(context.fixtureDifficulty, position);
      enhancedPrediction *= fixtureMultiplier;
    }

    // Calculate confidence based on data quality
    const confidence = calculateConfidence({
      hasMins: !!player.predicted_mins,
      hasForm: !!context.recentForm,
      hasFixture: !!context.fixtureDifficulty,
      minutesConsistency: minutesMultiplier
    });

    return {
      prediction: Math.max(0, enhancedPrediction), // Never predict negative
      confidence,
      breakdown: {
        ffh_base: ffhPrediction,
        position_adj: positionMultiplier,
        minutes_adj: minutesMultiplier,
        form_adj: context.recentForm ? getFormMultiplier(context.recentForm, position) : 1.0,
        fixture_adj: context.fixtureDifficulty ? getFixtureMultiplier(context.fixtureDifficulty, position) : 1.0
      }
    };

  } catch (error) {
    console.error('[V4 Statistical Model] Error:', error);
    return {
      prediction: 0,
      confidence: 0,
      error: error.message
    };
  }
}

/**
 * Calculate minutes-based multiplier for rotation risk
 * Lower predicted minutes = higher penalty
 */
function getMinutesMultiplier(predictedMins) {
  if (predictedMins >= MINUTES_BANDS.NAILED.min) {
    return MINUTES_BANDS.NAILED.multiplier;
  } else if (predictedMins >= MINUTES_BANDS.HIGH.min) {
    return MINUTES_BANDS.HIGH.multiplier;
  } else if (predictedMins >= MINUTES_BANDS.MEDIUM.min) {
    return MINUTES_BANDS.MEDIUM.multiplier;
  } else {
    return MINUTES_BANDS.LOW.multiplier;
  }
}

/**
 * Calculate form-based adjustment
 * Compare recent performance to expected level
 *
 * @param {Object} recentForm - Recent gameweek performance
 * @param {string} position - Player position
 * @returns {number} Multiplier (0.8 to 1.2)
 */
function getFormMultiplier(recentForm, position) {
  if (!recentForm || !recentForm.last3Avg) {
    return 1.0; // No adjustment if no form data
  }

  const { last3Avg, seasonAvg } = recentForm;

  if (!seasonAvg || seasonAvg === 0) {
    return 1.0; // Can't calculate ratio
  }

  // Calculate form ratio (recent vs season average)
  const formRatio = last3Avg / seasonAvg;

  // Apply bounded adjustment
  // Hot form (1.3x season avg) = +15% boost
  // Cold form (0.7x season avg) = -15% penalty
  if (formRatio >= 1.3) {
    return 1.15; // Hot streak
  } else if (formRatio >= 1.1) {
    return 1.08; // Good form
  } else if (formRatio <= 0.7) {
    return 0.85; // Cold streak
  } else if (formRatio <= 0.9) {
    return 0.92; // Poor form
  } else {
    return 1.0; // Normal form
  }
}

/**
 * Calculate fixture difficulty adjustment
 * Easier fixtures = slight boost, harder = slight penalty
 *
 * @param {number} difficulty - Fixture difficulty (1-5, where 1=easy, 5=hard)
 * @param {string} position - Player position
 * @returns {number} Multiplier (0.90 to 1.10)
 */
function getFixtureMultiplier(difficulty, position) {
  if (!difficulty) {
    return 1.0;
  }

  // Attackers benefit more from easy fixtures
  // Defenders benefit more from hard fixtures (clean sheet odds)
  const isDefensive = position === 'GKP' || position === 'GK' || position === 'DEF';

  if (isDefensive) {
    // Defenders: easier fixture = harder to get clean sheet
    switch(difficulty) {
      case 1: return 0.95; // Very easy opponent = likely concede
      case 2: return 0.98;
      case 3: return 1.0;  // Average
      case 4: return 1.05; // Hard opponent = clean sheet possible
      case 5: return 1.08; // Very hard opponent = potential clean sheet
      default: return 1.0;
    }
  } else {
    // Attackers: easier fixture = more goals/assists
    switch(difficulty) {
      case 1: return 1.10; // Very easy opponent = feast
      case 2: return 1.05;
      case 3: return 1.0;  // Average
      case 4: return 0.95; // Hard opponent = tough
      case 5: return 0.90; // Very hard opponent = very tough
      default: return 1.0;
    }
  }
}

/**
 * Calculate model confidence score
 * Based on data quality and consistency
 */
function calculateConfidence(factors) {
  let confidence = 70; // Base confidence

  // Boost for having predicted minutes
  if (factors.hasMins) confidence += 10;

  // Boost for having form data
  if (factors.hasForm) confidence += 10;

  // Boost for having fixture data
  if (factors.hasFixture) confidence += 5;

  // Penalty for rotation risk
  if (factors.minutesConsistency < 0.9) {
    confidence -= 15; // High rotation risk
  } else if (factors.minutesConsistency < 0.95) {
    confidence -= 5; // Moderate rotation risk
  }

  return Math.max(0, Math.min(100, confidence));
}

/**
 * Batch prediction for multiple players
 * More efficient than calling calculateEnhancedPrediction individually
 */
export function calculateBatchPredictions(players, contextMap = {}) {
  return players.map(player => {
    const playerId = player.player_id || player.id;
    const context = contextMap[playerId] || {};

    return {
      player_id: playerId,
      ...calculateEnhancedPrediction(player, context)
    };
  });
}

/**
 * Get position multiplier for a given position
 * Useful for debugging and analysis
 */
export function getPositionMultiplier(position) {
  return LEARNED_POSITION_MULTIPLIERS[position] || 1.267;
}

/**
 * Export constants for testing and validation
 */
export const CONSTANTS = {
  LEARNED_POSITION_MULTIPLIERS,
  MINUTES_BANDS,
  FORM_WINDOWS
};
