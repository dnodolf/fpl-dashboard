/**
 * V4 Ensemble Combiner
 *
 * Combines predictions from all three models:
 * - Statistical Model: 40% weight
 * - ML Correction Model: 40% weight
 * - Consensus Validator: 20% weight
 *
 * Final output: v4_season_total, v4_season_avg, v4_current_gw, v4_confidence
 */

import { calculateEnhancedPrediction, calculateBatchPredictions } from './statisticalModel.js';
import { getMLPrediction, getMLPredictionBatch } from './mlModel.js';
import { calculateConsensus, calculateBatchConsensus } from './consensusValidator.js';

/**
 * Model weights in final ensemble
 */
const ENSEMBLE_WEIGHTS = {
  STATISTICAL: 0.40,  // 40% weight
  ML: 0.40,           // 40% weight
  CONSENSUS: 0.20     // 20% weight
};

/**
 * Number of remaining gameweeks to predict
 * TODO: Make this dynamic based on current gameweek
 */
const REMAINING_GAMEWEEKS = 38;

/**
 * Combine all three models into final V4 prediction
 *
 * @param {Object} player - Player object with FFH predictions
 * @param {Object} context - Additional context (fixtures, form, etc.)
 * @returns {Object} Final V4 prediction with confidence
 */
export function combineEnsemble(player, context = {}) {
  try {
    // Step 1: Get Statistical Model prediction
    const statResult = calculateEnhancedPrediction(player, context);

    // Step 2: Get ML Model correction
    const mlResult = getMLPrediction(player, context);

    // Step 3: Get Consensus validation
    const consensusResult = calculateConsensus(statResult, mlResult, player);

    // Step 4: Calculate ML-corrected prediction
    // ML model outputs a multiplier to apply to V3 prediction
    const v3Prediction = player.v3_current_gw || (player.current_gw_prediction || 0) * 1.267; // Fallback to MID ratio
    const mlPrediction = v3Prediction * mlResult.correctionMultiplier;

    // Step 5: Weighted ensemble
    const v4CurrentGW = (
      statResult.prediction * ENSEMBLE_WEIGHTS.STATISTICAL +
      mlPrediction * ENSEMBLE_WEIGHTS.ML +
      consensusResult.prediction * ENSEMBLE_WEIGHTS.CONSENSUS
    );

    // Step 6: Calculate season projections
    const remainingGW = context.remainingGameweeks || REMAINING_GAMEWEEKS;
    const v4SeasonTotal = v4CurrentGW * remainingGW;
    const v4SeasonAvg = v4CurrentGW;

    // Step 7: Weighted confidence score
    const v4Confidence = (
      (statResult.confidence || 70) * ENSEMBLE_WEIGHTS.STATISTICAL +
      (mlResult.confidence || 70) * ENSEMBLE_WEIGHTS.ML +
      (consensusResult.confidence || 70) * ENSEMBLE_WEIGHTS.CONSENSUS
    );

    return {
      v4_current_gw: Math.max(0, v4CurrentGW),
      v4_season_total: Math.max(0, v4SeasonTotal),
      v4_season_avg: Math.max(0, v4SeasonAvg),
      v4_confidence: Math.round(Math.max(0, Math.min(100, v4Confidence))),
      v4_breakdown: {
        statistical: {
          prediction: statResult.prediction,
          confidence: statResult.confidence,
          weight: ENSEMBLE_WEIGHTS.STATISTICAL
        },
        ml: {
          prediction: mlPrediction,
          confidence: mlResult.confidence,
          correction_multiplier: mlResult.correctionMultiplier,
          weight: ENSEMBLE_WEIGHTS.ML
        },
        consensus: {
          prediction: consensusResult.prediction,
          confidence: consensusResult.confidence,
          agreement: consensusResult.agreementLevel,
          weight: ENSEMBLE_WEIGHTS.CONSENSUS
        }
      }
    };

  } catch (error) {
    console.error('[V4 Ensemble] Error combining models:', error);
    return {
      v4_current_gw: 0,
      v4_season_total: 0,
      v4_season_avg: 0,
      v4_confidence: 0,
      error: error.message
    };
  }
}

/**
 * Batch ensemble combination for multiple players
 * More efficient than calling combineEnsemble individually
 *
 * @param {Array} players - Array of player objects
 * @param {Object} contextMap - Map of player_id to context
 * @returns {Array} Array of V4 predictions
 */
export function combineEnsembleBatch(players, contextMap = {}) {
  try {
    // Step 1: Get all Statistical Model predictions in batch
    const statResults = calculateBatchPredictions(players, contextMap);

    // Step 2: Get all ML Model corrections in batch
    const mlResults = getMLPredictionBatch(players, contextMap);

    // Step 3: Get all Consensus validations in batch
    const consensusResults = calculateBatchConsensus(statResults, mlResults, players);

    // Step 4: Combine all results
    const v4Predictions = [];

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const statResult = statResults[i];
      const mlResult = mlResults[i];
      const consensusResult = consensusResults[i];
      const context = contextMap[player.player_id || player.id] || {};

      // Calculate ML-corrected prediction
      const v3Prediction = player.v3_current_gw || (player.current_gw_prediction || 0) * 1.267;
      const mlPrediction = v3Prediction * mlResult.correctionMultiplier;

      // Weighted ensemble
      const v4CurrentGW = (
        statResult.prediction * ENSEMBLE_WEIGHTS.STATISTICAL +
        mlPrediction * ENSEMBLE_WEIGHTS.ML +
        consensusResult.prediction * ENSEMBLE_WEIGHTS.CONSENSUS
      );

      // Season projections
      const remainingGW = context.remainingGameweeks || REMAINING_GAMEWEEKS;
      const v4SeasonTotal = v4CurrentGW * remainingGW;
      const v4SeasonAvg = v4CurrentGW;

      // Weighted confidence
      const v4Confidence = (
        (statResult.confidence || 70) * ENSEMBLE_WEIGHTS.STATISTICAL +
        (mlResult.confidence || 70) * ENSEMBLE_WEIGHTS.ML +
        (consensusResult.confidence || 70) * ENSEMBLE_WEIGHTS.CONSENSUS
      );

      v4Predictions.push({
        player_id: player.player_id || player.id,
        v4_current_gw: Math.max(0, v4CurrentGW),
        v4_season_total: Math.max(0, v4SeasonTotal),
        v4_season_avg: Math.max(0, v4SeasonAvg),
        v4_confidence: Math.round(Math.max(0, Math.min(100, v4Confidence))),
        v4_breakdown: {
          statistical: {
            prediction: statResult.prediction,
            confidence: statResult.confidence,
            weight: ENSEMBLE_WEIGHTS.STATISTICAL
          },
          ml: {
            prediction: mlPrediction,
            confidence: mlResult.confidence,
            correction_multiplier: mlResult.correctionMultiplier,
            weight: ENSEMBLE_WEIGHTS.ML
          },
          consensus: {
            prediction: consensusResult.prediction,
            confidence: consensusResult.confidence,
            agreement: consensusResult.agreementLevel,
            weight: ENSEMBLE_WEIGHTS.CONSENSUS
          }
        }
      });
    }

    return v4Predictions;

  } catch (error) {
    console.error('[V4 Ensemble] Batch combination error:', error);
    return players.map(p => ({
      player_id: p.player_id || p.id,
      v4_current_gw: 0,
      v4_season_total: 0,
      v4_season_avg: 0,
      v4_confidence: 0,
      error: error.message
    }));
  }
}

/**
 * Apply V4 predictions to player objects
 * Modifies players in-place by adding v4_* fields
 *
 * @param {Array} players - Array of player objects to enhance
 * @param {Object} contextMap - Optional context for each player
 * @returns {Array} Enhanced players with V4 fields
 */
export function enhancePlayersWithV4(players, contextMap = {}) {
  const v4Predictions = combineEnsembleBatch(players, contextMap);

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const v4Pred = v4Predictions[i];

    // Add V4 fields to player object (additive, not replacing anything)
    player.v4_current_gw = v4Pred.v4_current_gw;
    player.v4_season_total = v4Pred.v4_season_total;
    player.v4_season_avg = v4Pred.v4_season_avg;
    player.v4_confidence = v4Pred.v4_confidence;
    player.v4_breakdown = v4Pred.v4_breakdown;
  }

  return players;
}

/**
 * Get ensemble statistics for debugging
 * Shows how often each model contributes significantly
 */
export function getEnsembleStatistics(v4Predictions) {
  const stats = {
    totalPlayers: v4Predictions.length,
    avgConfidence: 0,
    highConfidence: 0,  // >80
    mediumConfidence: 0, // 60-80
    lowConfidence: 0,   // <60
    modelContributions: {
      statistical: { high: 0, medium: 0, low: 0 },
      ml: { high: 0, medium: 0, low: 0 },
      consensus: { high: 0, medium: 0, low: 0 }
    }
  };

  let totalConfidence = 0;

  for (const pred of v4Predictions) {
    totalConfidence += pred.v4_confidence || 0;

    // Confidence distribution
    if (pred.v4_confidence >= 80) {
      stats.highConfidence++;
    } else if (pred.v4_confidence >= 60) {
      stats.mediumConfidence++;
    } else {
      stats.lowConfidence++;
    }

    // Model contribution analysis
    if (pred.v4_breakdown) {
      ['statistical', 'ml', 'consensus'].forEach(model => {
        const confidence = pred.v4_breakdown[model]?.confidence || 0;
        if (confidence >= 80) {
          stats.modelContributions[model].high++;
        } else if (confidence >= 60) {
          stats.modelContributions[model].medium++;
        } else {
          stats.modelContributions[model].low++;
        }
      });
    }
  }

  stats.avgConfidence = (totalConfidence / stats.totalPlayers).toFixed(1);

  return stats;
}

/**
 * Export weights for testing
 */
export const CONSTANTS = {
  ENSEMBLE_WEIGHTS
};
