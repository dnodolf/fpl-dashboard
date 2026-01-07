/**
 * V4 Consensus Validator
 *
 * Purpose: Validate that Statistical and ML models agree
 * Weight in V4 Ensemble: 20%
 *
 * Acts as sanity check:
 * - If models agree (within 10%) → High confidence, use their average
 * - If models disagree (>20%) → Low confidence, blend with FFH baseline
 * - Detects outliers and adjusts confidence scores
 */

/**
 * Agreement thresholds for model consensus
 */
const AGREEMENT_THRESHOLDS = {
  STRONG: 0.10,   // Within 10% = strong agreement
  MODERATE: 0.20, // 10-20% = moderate agreement
  WEAK: 0.30      // 20-30% = weak agreement
  // >30% = disagreement
};

/**
 * Confidence adjustments based on agreement level
 */
const CONFIDENCE_ADJUSTMENTS = {
  STRONG_AGREEMENT: 15,    // Boost confidence
  MODERATE_AGREEMENT: 5,   // Slight boost
  WEAK_AGREEMENT: -5,      // Slight penalty
  DISAGREEMENT: -20        // Major penalty
};

/**
 * Calculate consensus between Statistical and ML models
 *
 * @param {Object} statisticalResult - Result from statistical model
 * @param {Object} mlResult - Result from ML model
 * @param {Object} player - Original player object (for FFH baseline)
 * @returns {Object} Consensus prediction with confidence
 */
export function calculateConsensus(statisticalResult, mlResult, player) {
  try {
    const statPrediction = statisticalResult.prediction || 0;
    const mlPrediction = (player.v3_current_gw || 0) * (mlResult.correctionMultiplier || 1.0);
    const ffhBaseline = player.current_gw_prediction || 0;

    // Calculate agreement percentage
    const avgPrediction = (statPrediction + mlPrediction) / 2;
    const difference = Math.abs(statPrediction - mlPrediction);
    const agreementRatio = avgPrediction > 0 ? difference / avgPrediction : 0;

    // Determine agreement level
    const agreementLevel = getAgreementLevel(agreementRatio);

    // Calculate base consensus prediction
    let consensusPrediction;
    let confidenceAdjustment;

    switch (agreementLevel) {
      case 'STRONG':
        // Models agree strongly - use their average with high confidence
        consensusPrediction = avgPrediction;
        confidenceAdjustment = CONFIDENCE_ADJUSTMENTS.STRONG_AGREEMENT;
        break;

      case 'MODERATE':
        // Models moderately agree - use their average with normal confidence
        consensusPrediction = avgPrediction;
        confidenceAdjustment = CONFIDENCE_ADJUSTMENTS.MODERATE_AGREEMENT;
        break;

      case 'WEAK':
        // Models weakly agree - blend with FFH baseline
        consensusPrediction = (avgPrediction * 0.7) + (ffhBaseline * 0.3);
        confidenceAdjustment = CONFIDENCE_ADJUSTMENTS.WEAK_AGREEMENT;
        break;

      case 'DISAGREEMENT':
      default:
        // Models disagree - heavily blend with FFH baseline for safety
        consensusPrediction = (avgPrediction * 0.5) + (ffhBaseline * 0.5);
        confidenceAdjustment = CONFIDENCE_ADJUSTMENTS.DISAGREEMENT;
        break;
    }

    // Calculate overall confidence
    const baseConfidence = Math.min(statisticalResult.confidence || 70, mlResult.confidence || 70);
    const finalConfidence = Math.max(0, Math.min(100, baseConfidence + confidenceAdjustment));

    // Detect outliers (predictions > 3x FFH baseline)
    const isOutlier = ffhBaseline > 0 && consensusPrediction > ffhBaseline * 3;
    if (isOutlier) {
      // Cap outlier predictions and reduce confidence
      consensusPrediction = Math.min(consensusPrediction, ffhBaseline * 2.5);
      confidenceAdjustment -= 15;
    }

    return {
      prediction: Math.max(0, consensusPrediction),
      confidence: Math.max(0, Math.min(100, baseConfidence + confidenceAdjustment)),
      agreementLevel,
      agreementRatio,
      breakdown: {
        statistical_prediction: statPrediction,
        ml_prediction: mlPrediction,
        ffh_baseline: ffhBaseline,
        agreement_ratio: agreementRatio,
        is_outlier: isOutlier,
        confidence_adjustment: confidenceAdjustment
      }
    };

  } catch (error) {
    console.error('[V4 Consensus] Error:', error);
    return {
      prediction: 0,
      confidence: 0,
      error: error.message
    };
  }
}

/**
 * Determine agreement level based on difference ratio
 */
function getAgreementLevel(agreementRatio) {
  if (agreementRatio <= AGREEMENT_THRESHOLDS.STRONG) {
    return 'STRONG';
  } else if (agreementRatio <= AGREEMENT_THRESHOLDS.MODERATE) {
    return 'MODERATE';
  } else if (agreementRatio <= AGREEMENT_THRESHOLDS.WEAK) {
    return 'WEAK';
  } else {
    return 'DISAGREEMENT';
  }
}

/**
 * Batch consensus calculation for multiple players
 */
export function calculateBatchConsensus(statisticalResults, mlResults, players) {
  const results = [];

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const statResult = statisticalResults[i] || { prediction: 0, confidence: 0 };
    const mlResult = mlResults[i] || { correctionMultiplier: 1.0, confidence: 0 };

    results.push({
      player_id: player.player_id || player.id,
      ...calculateConsensus(statResult, mlResult, player)
    });
  }

  return results;
}

/**
 * Analyze consensus patterns for debugging
 * Useful for understanding where models agree/disagree
 */
export function analyzeConsensusPatterns(consensusResults) {
  const patterns = {
    strong: 0,
    moderate: 0,
    weak: 0,
    disagreement: 0,
    outliers: 0,
    totalPlayers: consensusResults.length
  };

  for (const result of consensusResults) {
    switch (result.agreementLevel) {
      case 'STRONG':
        patterns.strong++;
        break;
      case 'MODERATE':
        patterns.moderate++;
        break;
      case 'WEAK':
        patterns.weak++;
        break;
      case 'DISAGREEMENT':
        patterns.disagreement++;
        break;
    }

    if (result.breakdown?.is_outlier) {
      patterns.outliers++;
    }
  }

  // Calculate percentages
  patterns.strongPct = (patterns.strong / patterns.totalPlayers * 100).toFixed(1);
  patterns.moderatePct = (patterns.moderate / patterns.totalPlayers * 100).toFixed(1);
  patterns.weakPct = (patterns.weak / patterns.totalPlayers * 100).toFixed(1);
  patterns.disagreementPct = (patterns.disagreement / patterns.totalPlayers * 100).toFixed(1);
  patterns.outlierPct = (patterns.outliers / patterns.totalPlayers * 100).toFixed(1);

  return patterns;
}

/**
 * Export thresholds for testing
 */
export const CONSTANTS = {
  AGREEMENT_THRESHOLDS,
  CONFIDENCE_ADJUSTMENTS
};
